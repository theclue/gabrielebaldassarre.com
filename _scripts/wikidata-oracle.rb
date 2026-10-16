#!/usr/bin/env ruby

require "date"
require "digest"
require "ipaddr"
require "json"
require "net/http"
require "optparse"
require "time"
require "timeout"
require "uri"
require "yaml"

class WikidataOracle
  DEFAULTS = {
    "retrieval_ms" => 60_000, "state_ttl_ms" => 1_800_000, "http_requests" => 30,
    "retries_per_request" => 2, "concepts" => 100, "concepts_per_discover" => 20,
    "candidates_per_concept" => 5, "entities" => 100, "hops" => 2, "arcs" => 200,
    "document_bytes" => 128 * 1024, "input_line_bytes" => 1024 * 1024,
    "output_bytes" => 4 * 1024 * 1024, "terminal_reserve_bytes" => 64 * 1024,
    "validation_ms" => 5_000
  }.freeze
  PROPERTIES = %w[P31 P279 P366 P2283 P1547 P361 P527 P144].freeze
  ID = /\A[A-Za-z0-9._:-]{1,128}\z/
  QID = /\AQ[1-9][0-9]*\z/

  def initialize(options)
    @root = File.realpath(options.fetch(:root))
    raise "root is not a directory" unless File.directory?(@root)
    @user_agent = options.fetch(:user_agent)
    raise "user-agent must contain a public project URL" unless @user_agent.match?(%r{https?://[^\s]+})
    @api = endpoint(options[:api_endpoint] || "https://www.wikidata.org/w/api.php")
    @sparql = endpoint(options[:sparql_endpoint] || "https://query.wikidata.org/sparql")
    @limits = load_limits(options[:limits_file])
    @run = nil
    @request_ids = {}
    @output_bytes = 0
    @terminal_bytes = 0
    @exit_code = 0
  end

  def run
    loop do
      line = STDIN.gets(@limits["input_line_bytes"] + 2)
      break unless line
      if line.bytesize > @limits["input_line_bytes"] || !line.end_with?("\n")
        emit_fatal("PROTOCOL_FATAL", "invalid or oversized JSONL frame")
        @exit_code = 2
        break
      end
      begin
        request = JSON.parse(line)
      rescue JSON::ParserError, EncodingError
        emit_fatal("PROTOCOL_FATAL", "invalid JSONL frame")
        @exit_code = 2
        break
      end
      if request.is_a?(Hash) &&
          (!request.key?("protocol_version") || !(request["protocol_version"].is_a?(Integer) && request["protocol_version"] == 1))
        emit_fatal("PROTOCOL_FATAL", "unsupported protocol version", request)
        @exit_code = 2
        break
      end
      response = handle(request)
      unless emit(response, terminal: terminal_operation?(response["operation"]))
        @exit_code = 3
        break
      end
    end
    @exit_code
  rescue StandardError
    warn "wikidata-oracle: internal operation failure"
    @exit_code = 3
  end

  private

  def monotonic
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end

  def endpoint(value)
    uri = URI.parse(value)
    allowed = uri.is_a?(URI::HTTPS) || (uri.is_a?(URI::HTTP) && loopback?(uri.host))
    raise "invalid endpoint" unless allowed && uri.host && uri.userinfo.nil? && uri.fragment.nil?
    uri
  rescue URI::InvalidURIError
    raise "invalid endpoint"
  end

  def loopback?(host)
    IPAddr.new(host).loopback?
  rescue IPAddr::InvalidAddressError
    host == "localhost"
  end

  def load_limits(path)
    values = DEFAULTS.dup
    return values unless path
    st = File.lstat(path)
    raise "limits must be a regular non-symlink file" unless st.file? && !st.symlink?
    parsed = JSON.parse(File.read(path, encoding: "UTF-8"))
    raise "invalid limits" unless parsed.is_a?(Hash) && (parsed.keys - DEFAULTS.keys).empty?
    parsed.each do |key, value|
      raise "invalid limit" unless value.is_a?(Integer) && value >= 0 && value <= values.fetch(key)
      values[key] = value
    end
    raise "invalid output reserve" if values["terminal_reserve_bytes"] < 64 * 1024 || values["output_bytes"] <= values["terminal_reserve_bytes"]
    values
  end

  def handle(req)
    unless req.is_a?(Hash) && (req.keys - %w[protocol_version request_id operation run_id input]).empty? &&
        req["protocol_version"].is_a?(Integer) && req["protocol_version"] == 1 && req["request_id"].is_a?(String) && !req["request_id"].empty? &&
        req["request_id"].bytesize <= 128 && !@request_ids.key?(req["request_id"])
      return envelope(req.is_a?(Hash) ? req : {}, "invalid_request", nil, error("INVALID_INPUT", "invalid request envelope"))
    end
    @request_ids[req["request_id"]] = true
    operation = req["operation"]
    input = req["input"]
    return envelope(req, "invalid_request", nil, error("INVALID_INPUT", "input must be an object")) unless input.is_a?(Hash)
    case operation
    when "open" then open_run(req, input)
    when "discover", "expand", "validate", "close" then run_operation(req, input)
    else envelope(req, "invalid_request", nil, error("INVALID_INPUT", "unknown operation"))
    end
  end

  def open_run(req, input)
    return invalid(req, "INVALID_STATE", "run already opened") if @run
    return invalid(req, "INVALID_INPUT", "unknown open fields") unless (input.keys - %w[post_path concepts]).empty?
    path = input["post_path"]
    concepts = input["concepts"]
    return invalid(req, "INVALID_INPUT", "invalid target or concept registry") unless path.is_a?(String) && concepts.is_a?(Array) && concepts.length <= @limits["concepts"]
    file, relative = safe_open_target(path)
    bytes = file.read(@limits["document_bytes"] + 1)
    raise Invalid.new("INVALID_INPUT", "document exceeds limit") if bytes.bytesize > @limits["document_bytes"]
    raise Invalid.new("INVALID_INPUT", "document is not UTF-8") unless bytes.dup.force_encoding("UTF-8").valid_encoding?
    stat = file.stat
    file.close
    registry = validate_registry(concepts, bytes)
    metadata = target_metadata(relative, stat, bytes)
    snapshot = snapshot_id(bytes, stat)
    run_id = "run-#{SecureRandom.hex(16)}"
    @run = {
      id: run_id, started: monotonic, expires: monotonic + @limits["state_ttl_ms"] / 1000.0,
      active_ms: 0, http: 0, entities: 0, arcs: 0, concepts: registry, target: metadata,
      snapshot: snapshot, original: bytes, evidence: {}, pending_evidence: {}, candidates: {}, pending_candidates: {}, validated: false,
      entity_qids: {},
      delivered_evidence: {}, delivered_candidates: {},
      outcome: "not_attempted", closed: false, retrieval_output: 0
    }
    existing = existing_identities(bytes, registry)
    result = { "snapshot_id" => snapshot, "target" => metadata, "concepts" => registry.values,
               "existing_identities" => existing, "limits" => @limits, "state_ttl_ms" => @limits["state_ttl_ms"] }
    envelope(req, "ok", result, nil, run_id: run_id)
  rescue Invalid => e
    invalid(req, e.code, e.message)
  rescue SystemCallError, ArgumentError
    invalid(req, "UNSAFE_TARGET", "target could not be safely opened")
  end

  def safe_open_target(path)
    raise Invalid.new("UNSAFE_TARGET", "target path must be relative") if path.empty? || path.start_with?("/") || path.include?("\\")
    parts = path.split("/")
    raise Invalid.new("UNSAFE_TARGET", "target path is unsafe") if parts.any? { |p| p.empty? || p == "." || p == ".." }
    candidate = File.join(@root, *parts)
    current = @root
    parts.each do |part|
      current = File.join(current, part)
      st = File.lstat(current)
      raise Invalid.new("UNSAFE_TARGET", "symlinks are not allowed") if st.symlink?
    end
    canonical = File.realpath(candidate)
    raise Invalid.new("UNSAFE_TARGET", "target escapes root") unless canonical.start_with?(@root + File::SEPARATOR)
    io = File.open(candidate, "rb")
    st = io.stat
    now = File.stat(canonical)
    raise Invalid.new("UNSAFE_TARGET", "target identity changed") unless st.file? && st.dev == now.dev && st.ino == now.ino &&
      parts.each_with_index.all? { |_, index| !File.lstat(File.join(@root, *parts.take(index + 1))).symlink? }
    [io, path]
  rescue Errno::ENOENT, Errno::EACCES
    raise Invalid.new("UNSAFE_TARGET", "target does not exist or cannot be read")
  end

  def validate_registry(concepts, bytes)
    raise Invalid.new("INVALID_INPUT", "concept registry must be an array") unless concepts.length <= @limits["concepts"]
    body = utf8(bytes)
    seen = {}
    concepts.map do |c|
      allowed = %w[concept_id label language context]
      raise Invalid.new("INVALID_INPUT", "invalid concept record") unless c.is_a?(Hash) && c.keys.sort == allowed.sort
      id, label, language, context = c.values_at(*allowed)
      raise Invalid.new("INVALID_INPUT", "invalid concept fields") unless id.is_a?(String) && ID.match?(id) && label.is_a?(String) && !label.empty? && label.bytesize <= 512 && language.is_a?(String) && language.match?(/\A[a-zA-Z0-9-]{2,16}\z/) && context.is_a?(String) && !context.empty? && context.bytesize <= 4096 && !seen[id]
      raise Invalid.new("INVALID_INPUT", "context must occur in original document") unless body.include?(context)
      seen[id] = true
      { "concept_id" => id, "label" => label, "language" => language, "context" => context }
    end.to_h { |c| [c["concept_id"], c] }
  end

  def run_operation(req, input)
    run_id = req["run_id"]
    return invalid(req, "INVALID_STATE", "run is not open") unless @run
    return envelope(req, "invalid_request", nil, error("FOREIGN_RUN", "run identifier does not match"), run_id: @run[:id]) unless run_id == @run[:id]
    return invalid(req, "INVALID_STATE", "run is closed") if @run[:closed]
    return invalid(req, "INVALID_STATE", "only close is allowed after validation") if @run[:validated] && req["operation"] != "close"
    if req["operation"] != "close" && req["operation"] != "validate" && monotonic >= @run[:expires]
      return envelope(req, "invalidated", nil, error("STATE_EXPIRED", "run state has expired"))
    end
    case req["operation"]
    when "discover" then retrieval_operation { discover(req, input) }
    when "expand" then retrieval_operation { expand(req, input) }
    when "validate" then validate(req, input)
    when "close" then close_run(req, input)
    end
  end

  def discover(req, input)
    return invalid(req, "INVALID_INPUT", "unknown discover fields") unless (input.keys - ["concept_ids"]).empty?
    ids = input["concept_ids"]
    return invalid(req, "INVALID_INPUT", "invalid concept ids") unless ids.is_a?(Array) && ids.uniq == ids && ids.length <= @limits["concepts_per_discover"] && ids.all? { |id| @run[:concepts].key?(id) }
    results = []
    errors = []
    omitted_ids = []
    reason_codes = []
    ids.each do |id|
      concept = @run[:concepts].fetch(id)
      candidates = []
      entity_limited = false
      begin
        search = retrieve_api("wbsearchentities", "search" => concept["label"], "language" => concept["language"], "uselang" => concept["language"], "limit" => @limits["candidates_per_concept"])
        raise Remote.new("API_ERROR", "malformed Wikidata search response") unless search.is_a?(Hash)
        raise Remote.new("API_ERROR", "Wikidata returned an API error") if search.key?("error")
        hits = search["search"]
        raise Remote.new("API_ERROR", "malformed Wikidata search response") unless hits.is_a?(Array)
        hits.take(@limits["candidates_per_concept"]).each do |hit|
          next unless hit.is_a?(Hash) && QID.match?(hit["id"].to_s)
          if @run[:entities] >= @limits["entities"] && !@run[:entity_qids][hit["id"]]
            entity_limited = true
            next
          end
          entity_data = retrieve_api("wbgetentities", "ids" => hit["id"], "props" => "labels|descriptions|aliases|sitelinks|claims|info", "languages" => concept["language"])
          raise Remote.new("API_ERROR", "Wikidata returned an API error") unless entity_data.is_a?(Hash) && !entity_data.key?("error")
          entities = entity_data["entities"]
          raise Remote.new("API_ERROR", "malformed Wikidata entity response") unless entities.is_a?(Hash) && entities.key?(hit["id"]) && entities[hit["id"]].is_a?(Hash)
          entity = entities[hit["id"]]
          next if entity.key?("missing")
          unless @run[:entity_qids][hit["id"]]
            @run[:entities] += 1
            @run[:entity_qids][hit["id"]] = true
          end
          evidence = evidence_record("api_search", @api, qid: hit["id"], language: concept["language"], label: bounded(hit["label"]), description: bounded(hit["description"]), projection: "search", missing: [])
          search_eid = deliver_evidence(evidence)
          entity_evidence = entity_to_evidence(entity, hit["id"], concept["language"])
          entity_eid = deliver_evidence(entity_evidence)
          label = localized(entity["labels"], concept["language"])
          description = localized(entity["descriptions"], concept["language"])
          candidate_id = "cand-#{SecureRandom.hex(12)}"
          candidate = { "candidate_id" => candidate_id, "concept_id" => id, "qid" => hit["id"], "label" => bounded(label&.fetch("value", nil) || hit["label"]) || "", "description" => bounded(description&.fetch("value", nil) || hit["description"]) || "", "language" => bounded(label&.fetch("language", nil)), "aliases" => aliases_for(entity, concept["language"]), "sitelinks" => sitelinks_for(entity), "evidence_ids" => [search_eid, entity_eid] }
          candidates << candidate
          @run[:pending_candidates][candidate_id] = candidate
        end
        if entity_limited
          omitted_ids << id
          reason_codes << "ENTITY_LIMIT"
        end
        status = if entity_limited then candidates.empty? ? "unprocessed" : "partial"
                 elsif candidates.empty? then "no_match"
                 elsif candidates.length > 1 then "ambiguous"
                 else "ok" end
        results << { "concept_id" => id, "status" => status, "candidates" => candidates, "reason_code" => entity_limited ? "ENTITY_LIMIT" : nil }
      rescue Remote => e
        errors << e
        if entity_limited
          omitted_ids << id
          reason_codes << "ENTITY_LIMIT"
        end
        reason_codes << e.code
        status = candidates.empty? ? "unavailable" : "partial"
        results << { "concept_id" => id, "status" => status, "candidates" => candidates, "reason_code" => e.code }
      end
    end
    status = if results.all? { |r| r["status"] == "no_match" } then "no_match"
             elsif results.all? { |r| r["status"] == "unavailable" } then "unavailable"
             elsif errors.any? || results.any? { |r| %w[unavailable unprocessed partial].include?(r["status"]) } then "partial"
             elsif results.any? { |r| r["status"] == "ambiguous" } then "ambiguous"
             else "ok" end
    omitted_ids.uniq!
    result = { "concept_results" => results, "evidence" => (@run[:evidence].values + @run[:pending_evidence].values), "coverage" => coverage(ids.length, ids.length - omitted_ids.length, omitted_ids.length, omitted_ids, true, reason_codes.uniq) }
    envelope(req, status, result, errors.empty? ? nil : error(errors.first.code, "one or more Wikidata lookups failed", retryable: errors.first.retryable))
  rescue Invalid => e
    invalid(req, e.code, e.message)
  end

  def expand(req, input)
    return invalid(req, "INVALID_INPUT", "unknown expand fields") unless (input.keys - ["selections"]).empty?
    selections = input["selections"]
    return invalid(req, "INVALID_INPUT", "invalid selections") unless selections.is_a?(Array) && selections.length <= @run[:concepts].length
    seeds = []
    errors = []
    selections.each do |s|
      allowed = %w[concept_id candidate_id evidence_ids rationale hop]
      raise Invalid.new("INVALID_INPUT", "invalid selection") unless s.is_a?(Hash) && s.keys.sort == allowed.sort && @run[:concepts].key?(s["concept_id"]) && s["candidate_id"].is_a?(String) && s["rationale"].is_a?(String) && s["rationale"].bytesize <= 2048 && s["hop"].is_a?(Integer) && s["hop"].between?(1, @limits["hops"])
      c = @run[:candidates][s["candidate_id"]]
      raise Invalid.new("INVALID_INPUT", "candidate does not belong to concept") unless c && @run[:delivered_candidates][s["candidate_id"]] && c["concept_id"] == s["concept_id"]
      evidence_ids = s["evidence_ids"]
      raise Invalid.new("INVALID_INPUT", "evidence not delivered for candidate") unless evidence_ids.is_a?(Array) && !evidence_ids.empty? && (evidence_ids - c["evidence_ids"]).empty? && evidence_ids.all? { |eid| @run[:delivered_evidence][eid] }
      seeds << { "concept_id" => s["concept_id"], "candidate_id" => c["candidate_id"], "evidence_ids" => evidence_ids }
    end
    arcs = []
    paths = []
    nodes = []
    omitted_ids = []
    omitted_count = 0
    omitted_arc_keys = {}
    reason_codes = []
    coverage_complete = true
    selections.each do |s|
      c = @run[:candidates][s["candidate_id"]]
      properties = PROPERTIES.map { |p| "wdt:#{p}" }.join(" ")
      frontier = [{ "uri" => "http://www.wikidata.org/entity/#{c['qid']}", "steps" => [], "visited" => { "http://www.wikidata.org/entity/#{c['qid']}" => true } }]
      1.upto(s["hop"]) do |depth|
        break if frontier.empty?
        if @run[:arcs] >= @limits["arcs"]
          coverage_complete = false
          reason_codes << "ARC_LIMIT"
          break
        end
        current_uris = frontier.map { |entry| entry["uri"] }.uniq
        iri_values = current_uris.map { |uri| "<#{uri}>" }.join(" ")
        query_limit = [@limits["arcs"] - @run[:arcs], 200].min
        query = "PREFIX wdt: <http://www.wikidata.org/prop/direct/> SELECT ?item ?property ?value ?subject ?object WHERE { VALUES ?item { #{iri_values} } VALUES ?property { #{properties} } { ?item ?property ?value . BIND(?item AS ?subject) BIND(?value AS ?object) } UNION { ?value ?property ?item . BIND(?value AS ?subject) BIND(?item AS ?object) } } LIMIT #{query_limit}"
        begin
          payload = retrieve_sparql(query)
          bindings = payload.dig("results", "bindings")
          raise Remote.new("HTTP_ERROR", "malformed SPARQL response") unless bindings.is_a?(Array)
          if bindings.length >= query_limit
            coverage_complete = false
            reason_codes << "ARC_LIMIT"
          end
          next_frontier = []
          bindings.each do |binding|
            next unless binding.is_a?(Hash) && %w[item property value].all? { |key| binding[key].is_a?(Hash) }
            item = rdf_value(binding.fetch("item"))
            next unless item["type"] == "uri" && current_uris.include?(item["value"])
            rdf_predicate = rdf_value(binding.fetch("property"))
            rdf_value_term = rdf_value(binding.fetch("value"))
            property_id = rdf_predicate["value"].match(%r{\Ahttp://www\.wikidata\.org/prop/direct/(P[1-9][0-9]*)\z})&.[](1)
            next unless PROPERTIES.include?(property_id)
            rdf_subject = binding["subject"].is_a?(Hash) ? rdf_value(binding.fetch("subject")) : item
            rdf_object = binding["object"].is_a?(Hash) ? rdf_value(binding.fetch("object")) : rdf_value_term
            next unless [rdf_subject["value"], rdf_object["value"]].include?(item["value"])
            key = [rdf_subject.values, rdf_predicate.values, rdf_object.values].flatten.join("\0")
            next if @run[:arc_keys]&.key?(key)
            if @run[:arcs] >= @limits["arcs"]
              coverage_complete = false
              reason_codes << "ARC_LIMIT"
              unless omitted_arc_keys[key]
                omitted_arc_keys[key] = true
                omitted_count += 1
              end
              next
            end
            unless admit_qid_endpoints?(rdf_subject, rdf_object)
              coverage_complete = false
              reason_codes << "ENTITY_LIMIT"
              unless omitted_arc_keys[key]
                omitted_arc_keys[key] = true
                omitted_count += 1
              end
              next
            end
            @run[:arc_keys] ||= {}
            @run[:arc_keys][key] = true
            eid = deliver_evidence(evidence_record("wdqs", @sparql, qid: c["qid"], language: c["language"], projection: "truthy", bindings: binding.map { |name, value| { "name" => name, "value" => rdf_value(value) } }, missing: ["qualifiers", "references"]))
            arc = { "arc_id" => "arc-#{SecureRandom.hex(10)}", "subject" => rdf_subject, "predicate" => rdf_predicate, "object" => rdf_object, "property_id" => property_id, "evidence_ids" => [eid] }
            arcs << arc
            @run[:arcs] += 1
            if @run[:arcs] >= @limits["arcs"]
              coverage_complete = false
              reason_codes << "ARC_LIMIT"
            end
            nodes << node_for(rdf_subject, eid, rdf_subject["value"] == "http://www.wikidata.org/entity/#{c['qid']}" ? c : nil) << node_for(rdf_object, eid, rdf_object["value"] == "http://www.wikidata.org/entity/#{c['qid']}" ? c : nil)
            parent = frontier.find { |entry| entry["uri"] == item["value"] }
            traversal = rdf_subject["value"] == item["value"] ? "forward" : "reverse"
            step = { "arc_id" => arc["arc_id"], "traversal" => traversal }
            steps = parent["steps"] + [step]
            paths << { "path_id" => "path-#{SecureRandom.hex(10)}", "seed_candidate_id" => c["candidate_id"], "steps" => steps }
            next if depth >= s["hop"]
            neighbor = traversal == "forward" ? rdf_object : rdf_subject
            match = %r{\Ahttp://www\.wikidata\.org/entity/(Q[1-9][0-9]*)\z}.match(neighbor["value"])
            next unless neighbor["type"] == "uri" && match
            next if parent["visited"][neighbor["value"]]
            visited = parent["visited"].merge(neighbor["value"] => true)
            next_frontier << { "uri" => neighbor["value"], "steps" => steps, "visited" => visited }
          end
          frontier = next_frontier.uniq { |entry| entry["uri"] }
        rescue Remote => e
          errors << e
          break
        end
      end
    end
    nodes = nodes.uniq { |n| n["node_id"] }
    status = if !coverage_complete || (errors.any? && !arcs.empty?) then "partial" elsif errors.any? then "unavailable" else "ok" end
    coverage_requested = arcs.length + omitted_count
    result = { "seeds" => seeds, "nodes" => nodes, "arcs" => arcs, "paths" => paths, "evidence" => (@run[:evidence].values + @run[:pending_evidence].values).select { |e| e["source"] == "wdqs" }, "coverage" => coverage(coverage_requested, arcs.length, omitted_count, omitted_ids.uniq, coverage_complete, reason_codes.uniq) }
    envelope(req, status, result, errors.empty? ? nil : error(errors.first.code, "graph retrieval was incomplete", retryable: errors.first.retryable))
  rescue Invalid => e
    invalid(req, e.code, e.message)
  end

  def validate(req, input)
    if monotonic >= @run[:expires]
      input_error = validation_input_error(req, input)
      return input_error if input_error
      return invalidate_expired_validation(req, input)
    end
    Timeout.timeout(@limits["validation_ms"] / 1000.0, LocalValidationTimeout) do
      validate_document(req, input)
    end
  rescue LocalValidationTimeout
    @run[:validated] = true
    @run[:outcome] = "rejected"
    doc = input.is_a?(Hash) ? input["proposed_document"] : nil
    hash = doc.is_a?(String) && doc.encoding == Encoding::UTF_8 && doc.valid_encoding? ? Digest::SHA256.hexdigest(doc.b) : Digest::SHA256.hexdigest("")
    report = {
      "accepted" => false, "assurance" => "none", "write_enforcement" => "not_provided_by_core",
      "snapshot_id" => @run[:snapshot], "target" => @run[:target], "proposed_sha256" => hash,
      "proposed_size_bytes" => doc.is_a?(String) ? doc.bytesize : 0,
      "checks" => %w[snapshot target_identity body_bytes frontmatter_scope concept_preservation identity_provenance].map { |name| { "name" => name, "passed" => false } },
      "new_identities" => [], "preserved_identities" => [],
      "violations" => [detail("proposed_document", nil, "local validation time limit exceeded")]
    }
    envelope(req, "rejected", report, error("LOCAL_VALIDATION_TIMEOUT", "local validation time limit exceeded"))
  end

  def validate_document(req, input)
    input_error = validation_input_error(req, input)
    return input_error if input_error
    doc = input["proposed_document"]
    decisions = input["decisions"]
    @run[:validated] = true
    @run[:outcome] = "rejected"
    original_check = reread_target
    violations = []
    decision_map = {}
    unless decisions.is_a?(Array) && decisions.length == @run[:concepts].length
      violations << detail("decisions", nil, "one decision per registered concept is required")
    else
      decisions.each do |d|
        unless d.is_a?(Hash) && d["concept_id"].is_a?(String) && @run[:concepts].key?(d["concept_id"]) && !decision_map.key?(d["concept_id"])
          violations << detail("decisions", nil, "decision does not match the concept registry")
          next
        end
        decision_map[d["concept_id"]] = d
      end
      violations << detail("decisions", nil, "decision set is incomplete") unless decision_map.keys.sort == @run[:concepts].keys.sort
    end
    checks = [
      { "name" => "snapshot", "passed" => input["acknowledged_snapshot_id"] == @run[:snapshot] },
      { "name" => "target_identity", "passed" => original_check[:identity] },
      { "name" => "body_bytes", "passed" => false },
      { "name" => "frontmatter_scope", "passed" => false },
      { "name" => "concept_preservation", "passed" => false },
      { "name" => "identity_provenance", "passed" => false }
    ]
    violations << detail("acknowledged_snapshot_id", nil, "snapshot acknowledgement mismatch") unless checks[0]["passed"]
    proposed_hash = Digest::SHA256.hexdigest(doc.b)
    parsed_original = parse_document(@run[:original])
    parsed_proposed = parse_document(doc.b)
    if parsed_original && parsed_proposed
      ofm, obody = parsed_original
      pfm, pbody = parsed_proposed
      checks[2]["passed"] = obody == pbody
      checks[3]["passed"] = frontmatter_scope_equal?(ofm, pfm)
      checks[4]["passed"] = concepts_preserved?(ofm, pfm, decision_map)
      checks[5]["passed"] = decision_provenance?(pfm, decision_map)
    else
      violations << detail("proposed_document", nil, "frontmatter is outside the supported safe YAML subset")
    end
    checks.each { |c| violations << detail(c["name"], nil, "check failed") unless c["passed"] }
    accepted = violations.empty? && checks.all? { |c| c["passed"] }
    @run[:outcome] = accepted ? "accepted" : (original_check[:identity] ? "rejected" : "invalidated")
    report = { "accepted" => accepted, "assurance" => accepted ? "provenance_and_document_checks" : "none", "write_enforcement" => "not_provided_by_core", "snapshot_id" => @run[:snapshot], "target" => original_check[:target], "proposed_sha256" => proposed_hash, "proposed_size_bytes" => doc.bytesize, "checks" => checks, "new_identities" => accepted ? new_identities(decision_map) : [], "preserved_identities" => preserved_identities(decision_map), "violations" => violations.take(16) }
    envelope(req, accepted ? "ok" : (original_check[:identity] ? "rejected" : "invalidated"), report, accepted ? nil : error(original_check[:identity] ? "VALIDATION_FAILED" : "TARGET_CHANGED", "proposal did not pass all checks"))
  rescue Invalid => e
    invalid(req, e.code, e.message)
  end

  def validation_input_error(req, input)
    return invalid(req, "INVALID_INPUT", "unknown validate fields") unless (input.keys - %w[proposed_document acknowledged_snapshot_id decisions]).empty?
    doc = input["proposed_document"]
    return invalid(req, "INVALID_INPUT", "proposed document must be UTF-8 text") unless doc.is_a?(String) && doc.encoding == Encoding::UTF_8 && doc.valid_encoding? && doc.bytesize <= @limits["document_bytes"]
    snapshot_id = input["acknowledged_snapshot_id"]
    return invalid(req, "INVALID_INPUT", "snapshot acknowledgement must be a SHA-256 identifier") unless snapshot_id.is_a?(String) && /\A[a-f0-9]{64}\z/.match?(snapshot_id)
    decisions = input["decisions"]
    return invalid(req, "INVALID_INPUT", "decisions must include a recognized type") unless decisions.is_a?(Array) && decisions.all? { |d| valid_decision_shape?(d) }
    nil
  end

  def invalidate_expired_validation(req, input)
    @run[:validated] = true
    @run[:outcome] = "invalidated"
    doc = input["proposed_document"]
    report = {
      "accepted" => false, "assurance" => "none", "write_enforcement" => "not_provided_by_core",
      "snapshot_id" => @run[:snapshot], "target" => @run[:target], "proposed_sha256" => Digest::SHA256.hexdigest(doc.b),
      "proposed_size_bytes" => doc.bytesize,
      "checks" => %w[snapshot target_identity body_bytes frontmatter_scope concept_preservation identity_provenance].map { |name| { "name" => name, "passed" => false } },
      "new_identities" => [], "preserved_identities" => [],
      "violations" => [detail("state", nil, "run state has expired")]
    }
    envelope(req, "invalidated", report, error("STATE_EXPIRED", "run state has expired"))
  end

  def close_run(req, input)
    return invalid(req, "INVALID_INPUT", "close input must be empty") unless input.empty?
    @run[:closed] = true
    result = { "closed" => true, "validation_outcome" => @run[:outcome], "http_requests_used" => @run[:http], "retrieval_ms_used" => @run[:active_ms].to_i }
    envelope(req, "ok", result, nil)
  end

  def retrieve_api(action, params)
    uri = @api.dup
    query = URI.decode_www_form(uri.query.to_s)
    uri.query = URI.encode_www_form(query + [["action", action], ["format", "json"], ["formatversion", "2"]] + params.to_a)
    http_json(uri, "GET")
  end

  def retrieve_sparql(query)
    uri = @sparql.dup
    uri.query = URI.encode_www_form([["query", query], ["format", "json"]])
    http_json(uri, "GET", "application/sparql-results+json")
  end

  def http_json(uri, method, accept = "application/json")
    retries = 0
    loop do
      raise Remote.new("RETRIEVAL_BUDGET_EXHAUSTED", "retrieval budget exhausted") if active_retrieval_ms >= @limits["retrieval_ms"] || @run[:http] >= @limits["http_requests"]
      @run[:http] += 1
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      remaining = [(@limits["retrieval_ms"] - active_retrieval_ms) / 1000.0, 10.0].min
      raise Remote.new("RETRIEVAL_BUDGET_EXHAUSTED", "retrieval budget exhausted") unless remaining.positive?
      http.open_timeout = remaining
      http.read_timeout = remaining
      http.write_timeout = remaining if http.respond_to?(:write_timeout=)
      request = Net::HTTP::Get.new(uri.request_uri)
      request["User-Agent"] = @user_agent
      request["Accept"] = accept
      body = +""
      response = Timeout.timeout(remaining) do
        http.request(request) do |incoming|
          incoming.read_body do |chunk|
            raise Remote.new("HTTP_ERROR", "remote response exceeded safety limit") if body.bytesize + chunk.bytesize > 2 * 1024 * 1024
            body << chunk
          end
        end
      end
      if [429, 503].include?(response.code.to_i) && retries < @limits["retries_per_request"]
        wait = retry_delay(response["Retry-After"])
        remaining_retrieval_ms = @limits["retrieval_ms"] - active_retrieval_ms
        raise Remote.new("RETRIEVAL_TIMEOUT", "retry exceeds retrieval budget") if wait * 1000 >= remaining_retrieval_ms
        sleep(wait)
        retries += 1
        next
      end
      raise Remote.new("HTTP_ERROR", "remote service returned HTTP #{response.code}", [429, 503].include?(response.code.to_i)) unless response.code.to_i.between?(200, 299)
      break JSON.parse(body)
    rescue Net::OpenTimeout, Net::ReadTimeout, Net::WriteTimeout, Timeout::Error
      raise Remote.new("RETRIEVAL_TIMEOUT", "remote request timed out", true)
    rescue IOError, SystemCallError, SocketError, OpenSSL::SSL::SSLError
      raise Remote.new("HTTP_ERROR", "remote request failed", true)
    end
  rescue JSON::ParserError
    raise Remote.new("API_ERROR", "remote service returned invalid JSON")
  end

  def retry_delay(header)
    return 5.0 unless header.is_a?(String) && !header.empty?
    return Integer(header, 10) if /\A[0-9]+\z/.match?(header)
    [(Time.httpdate(header) - Time.now), 0].max
  rescue ArgumentError, TypeError, RangeError
    5.0
  end

  def entity_to_evidence(entity, qid, lang)
    missing = %w[labels descriptions aliases sitelinks claims].reject { |key| entity.key?(key) }
    statements = []
    if entity["claims"].is_a?(Hash)
      entity["claims"].each do |prop, claims|
        next unless prop.match?(/\AP[1-9][0-9]*\z/) && claims.is_a?(Array)
        claims.each do |claim|
          next unless claim.is_a?(Hash)
          mainsnak = claim["mainsnak"]
          next unless mainsnak.is_a?(Hash)
          snak_type = %w[value somevalue novalue].include?(mainsnak["snaktype"]) ? mainsnak["snaktype"] : "novalue"
          main_value = snak_type == "value" ? wikibase_value(mainsnak["datavalue"]) : nil
          if snak_type == "value" && !main_value
            missing << "unsupported_statement_value:#{prop}"
            next
          end
          qualifiers = []
          qualifier_data = claim["qualifiers"]
          if qualifier_data.is_a?(Hash)
            qualifier_data.each do |qualifier_prop, qualifier_snaks|
              Array(qualifier_snaks).each do |qualifier_snak|
                normalized = normalize_snak(qualifier_prop, qualifier_snak)
                if normalized
                  qualifiers << normalized
                else
                  missing << "unsupported_qualifier:#{prop}"
                end
              end
            end
          elsif claim.key?("qualifiers")
            missing << "unsupported_qualifier:#{prop}"
          end
          references = []
          if claim["references"].is_a?(Array)
            claim["references"].each do |reference|
              next unless reference.is_a?(Hash) && reference["snaks"].is_a?(Hash)
              snaks = []
              reference["snaks"].each do |reference_prop, reference_snaks|
                Array(reference_snaks).each do |reference_snak|
                  normalized = normalize_snak(reference_prop, reference_snak)
                  normalized ? snaks << normalized : missing << "unsupported_reference:#{prop}"
                end
              end
              references << { "reference_id" => bounded(reference["hash"]), "snaks" => snaks.take(100) }
            end
          elsif claim.key?("references")
            missing << "unsupported_reference:#{prop}"
          end
          statements << { "property_id" => prop, "statement_id" => bounded(claim["id"]), "snak_type" => snak_type, "value" => main_value, "rank" => %w[preferred normal deprecated].include?(claim["rank"]) ? claim["rank"] : nil, "qualifiers" => qualifiers.take(100), "references" => references.take(20) }
        end
      end
    end
    missing << "additional_statements" if statements.length > 20
    revision = entity["lastrevid"] || entity.dig("pageinfo", "lastrevid")
    evidence_record("api_entity", @api, qid: qid, language: lang, label: localized(entity["labels"], lang)&.fetch("value", nil), description: localized(entity["descriptions"], lang)&.fetch("value", nil), aliases: aliases_for(entity, lang), sitelinks: sitelinks_for(entity), statements: statements.take(20), projection: "statement", missing: missing, revision_id: revision)
  end

  def normalize_snak(property_id, snak)
    return nil unless property_id.is_a?(String) && property_id.match?(/\AP[1-9][0-9]*\z/) && snak.is_a?(Hash)
    type = %w[value somevalue novalue].include?(snak["snaktype"]) ? snak["snaktype"] : nil
    return nil unless type
    value = type == "value" ? wikibase_value(snak["datavalue"]) : nil
    return nil if type == "value" && !value
    { "property_id" => property_id, "snak_type" => type, "value" => value }
  end

  def wikibase_value(dv)
    return nil unless dv.is_a?(Hash)
    value = dv["value"]
    return rdf_value({ "type" => "literal", "value" => value }) if value.is_a?(String)
    return nil unless value.is_a?(Hash)
    if value["id"].is_a?(String) && QID.match?(value["id"])
      rdf_value({ "type" => "uri", "value" => "http://www.wikidata.org/entity/#{value['id']}" })
    elsif value["time"].is_a?(String)
      rdf_value({ "type" => "literal", "value" => value["time"], "datatype" => "http://www.w3.org/2001/XMLSchema#dateTime" })
    elsif value["amount"].is_a?(String)
      rdf_value({ "type" => "literal", "value" => value["amount"], "datatype" => "http://www.w3.org/2001/XMLSchema#decimal" })
    elsif value["text"].is_a?(String) && value["language"].is_a?(String)
      rdf_value({ "type" => "literal", "value" => value["text"], "lang" => value["language"] })
    elsif value.is_a?(String)
      rdf_value({ "type" => "literal", "value" => value })
    else
      nil
    end
  end

  def localized(map, lang)
    return nil unless map.is_a?(Hash)
    map[lang] || map.values.find { |v| v.is_a?(Hash) }
  end

  def aliases_for(entity, lang)
    (entity.dig("aliases", lang) || []).filter_map { |a| bounded(a["value"]) if a.is_a?(Hash) }.take(50)
  end

  def sitelinks_for(entity)
    links = entity["sitelinks"]
    return [] unless links.is_a?(Hash)
    links.sort_by { |site, _| site.to_s }.take(50).filter_map do |site, record|
      next unless record.is_a?(Hash) && record["title"].is_a?(String)
      { "site" => bounded(site), "title" => bounded(record["title"]), "url" => bounded(record["url"]) || "" }
    end
  end

  def evidence_record(source, endpoint, qid: nil, language: nil, label: nil, description: nil, aliases: [], sitelinks: [], statements: [], bindings: [], projection:, missing: [], revision_id: nil)
    safe_url = endpoint.dup.tap { |u| u.query = nil; u.userinfo = nil }.to_s
    { "evidence_id" => "ev-#{SecureRandom.hex(12)}", "source" => source, "source_url" => safe_url, "retrieved_at" => Time.now.utc.iso8601, "revision_id" => revision_id&.to_s, "entity_qid" => qid, "language" => bounded(language), "label" => bounded(label), "description" => bounded(description), "aliases" => aliases.take(50), "sitelinks" => sitelinks.take(50), "statements" => statements.take(20), "bindings" => bindings.take(20), "projection" => projection, "missing_fields" => missing.uniq.take(30) }
  end

  def deliver_evidence(record)
    @run[:pending_evidence][record["evidence_id"]] = record
    record["evidence_id"]
  end

  def rdf_value(value)
    type = value["type"]
    mapped = { "uri" => "uri", "literal" => "literal", "typed-literal" => "literal", "bnode" => "bnode" }[type]
    raise Remote.new("API_ERROR", "unsupported RDF term") unless mapped && value["value"].is_a?(String)
    lang = value["xml:lang"] || value["lang"]
    datatype = value["datatype"]
    { "type" => mapped, "value" => bounded(value["value"]) || "", "language" => mapped == "literal" && lang.is_a?(String) ? bounded(lang) : nil, "datatype" => mapped == "literal" && lang.nil? && datatype.is_a?(String) ? bounded(datatype) : nil }
  end

  def node_for(value, eid, candidate)
    { "node_id" => "node-#{Digest::SHA256.hexdigest(value.values.join("\0"))[0, 24]}", "value" => value, "label" => candidate ? candidate["label"] : "", "description" => candidate ? candidate["description"] : "", "language" => candidate && candidate["language"], "evidence_ids" => [eid] }
  end

  def coverage(requested, returned, omitted, ids, complete, reasons)
    { "requested_count" => requested, "returned_count" => returned, "omitted_count" => omitted, "omitted_ids" => ids, "omitted_ids_complete" => complete, "reason_codes" => reasons }
  end

  def admit_qid_endpoints?(*terms)
    qids = terms.filter_map do |term|
      next unless term["type"] == "uri"
      %r{\Ahttp://www\.wikidata\.org/entity/(Q[1-9][0-9]*)\z}.match(term["value"])&.[](1)
    end.uniq
    new_qids = qids.reject { |qid| @run[:entity_qids][qid] }
    return false if @run[:entities] + new_qids.length > @limits["entities"]
    new_qids.each do |qid|
      @run[:entity_qids][qid] = true
      @run[:entities] += 1
    end
    true
  end

  def reread_target
    io, relative = safe_open_target(@run[:target]["relative_path"])
    bytes = io.read(@limits["document_bytes"] + 1)
    st = io.stat
    io.close
    target = target_metadata(relative, st, bytes)
    identity = st.dev.to_s == @run[:target]["device"] && st.ino.to_s == @run[:target]["inode"] && Digest::SHA256.hexdigest(bytes) == @run[:target]["sha256"]
    { identity: identity, target: target }
  rescue Invalid, SystemCallError
    { identity: false, target: nil }
  end

  def target_metadata(relative, stat, bytes)
    canonical = File.realpath(File.join(@root, relative))
    { "relative_path" => relative, "canonical_path" => canonical, "sha256" => Digest::SHA256.hexdigest(bytes), "device" => stat.dev.to_s, "inode" => stat.ino.to_s, "size_bytes" => bytes.bytesize }
  end

  def snapshot_id(bytes, stat)
    Digest::SHA256.hexdigest([stat.dev, stat.ino, bytes.bytesize].join(":") + "\0" + bytes)
  end

  def existing_identities(bytes, registry)
    parsed = parse_document(bytes)
    return [] unless parsed
    prereqs = parsed[0]["knowledge_prerequisites"]
    return [] unless prereqs.is_a?(Array)
    prereqs.filter_map do |item|
      next unless item.is_a?(Hash) && item["concept"].is_a?(String) && registry.key?(item["concept"]) && item["sameAs"].is_a?(String)
      { "concept_id" => item["concept"], "same_as" => item["sameAs"], "qid" => qid_from_url(item["sameAs"]) }
    end
  end

  def parse_document(bytes)
    text = utf8(bytes)
    match = /\A---\r?\n(.*?)\r?\n---\r?\n/m.match(text)
    return nil unless match
    yaml = YAML.safe_load(match[1], permitted_classes: [Date, Time], permitted_symbols: [], aliases: false)
    return nil unless yaml.is_a?(Hash)
    [yaml, text.byteslice(match[0].bytesize..).to_s]
  rescue Psych::Exception, EncodingError
    nil
  end

  def frontmatter_scope_equal?(original, proposed)
    left = deep_copy(original)
    right = deep_copy(proposed)
    left.delete("knowledge_prerequisites")
    right.delete("knowledge_prerequisites")
    if !left.key?("difficulty_computed") && right["difficulty_computed"].is_a?(Hash) && right["difficulty_computed"].keys == ["semantic"]
      right.delete("difficulty_computed")
    end
    if left["difficulty_computed"].is_a?(Hash) && right["difficulty_computed"].is_a?(Hash)
      left["difficulty_computed"].delete("semantic")
      right["difficulty_computed"].delete("semantic")
    end
    left == right
  end

  def concepts_preserved?(original, proposed, decisions)
    old = prerequisite_records(original)
    now = proposed["knowledge_prerequisites"]
    return false unless old && now.is_a?(Array) && now.length >= old.length
    expected_same_as = old.map do |item|
      return false unless item.is_a?(Hash)
      changed = decisions[item["concept"]]
      changed && changed["type"] == "select" ? "https://www.wikidata.org/wiki/#{@run[:candidates][changed['candidate_id']].to_h['qid']}" : item["sameAs"]
    end
    matched_proposed = Array.new(old.length)
    matched_original = Array.new(now.length)
    while matched_proposed.any?(&:nil?)
      distances = Array.new(old.length)
      queue = []
      old.each_index do |index|
        if matched_proposed[index].nil?
          distances[index] = 0
          queue << index
        end
      end

      shortest = nil
      head = 0
      while head < queue.length
        index = queue[head]
        head += 1
        next if shortest && distances[index] + 1 > shortest
        now.each_index do |candidate_index|
          next unless preserved_prerequisite_match?(old[index], now[candidate_index], expected_same_as[index])
          matched = matched_original[candidate_index]
          if matched.nil?
            shortest = distances[index] + 1 if shortest.nil? || distances[index] + 1 < shortest
          elsif distances[matched].nil?
            distances[matched] = distances[index] + 1
            queue << matched
          end
        end
      end
      return false unless shortest

      next_candidate = Array.new(old.length, 0)
      old.each_index do |root|
        next unless matched_proposed[root].nil?
        stack = [root]
        path_candidates = []
        augmented = false
        until stack.empty?
          index = stack[-1]
          advanced = false
          while next_candidate[index] < now.length
            candidate_index = next_candidate[index]
            next_candidate[index] += 1
            next unless preserved_prerequisite_match?(old[index], now[candidate_index], expected_same_as[index])
            matched = matched_original[candidate_index]
            if matched.nil?
              next unless distances[index] + 1 == shortest
              path = path_candidates + [candidate_index]
              stack.each_with_index do |original_index, path_index|
                proposed_index = path[path_index]
                matched_proposed[original_index] = proposed_index
                matched_original[proposed_index] = original_index
              end
              augmented = true
              break
            elsif distances[matched] == distances[index] + 1 && distances[matched] < shortest
              stack << matched
              path_candidates << candidate_index
              advanced = true
              break
            end
          end
          break if augmented
          next if advanced
          distances[index] = Float::INFINITY
          stack.pop
          path_candidates.pop unless path_candidates.empty?
        end
      end
    end
    true
  end

  def preserved_prerequisite_match?(original, candidate, expected_same_as)
    candidate.is_a?(Hash) && candidate["concept"] == original["concept"] && candidate["sameAs"] == expected_same_as &&
      original.all? { |key, value| key == "sameAs" || candidate[key] == value }
  end

  def decision_provenance?(proposed, decisions)
    return false unless decisions.length == @run[:concepts].length
    return false unless proposed_identities_authorized?(proposed, decisions)
    decisions.all? do |id, decision|
      case decision["type"]
      when "select"
        authorized_selection_identity?(id, decision, decision["proposed_sameAs"]) && proposed_same_as_values(proposed, id).include?(decision["proposed_sameAs"])
      when "abstain"
        %w[ambiguous no_match unavailable unprocessed insufficient_evidence].include?(decision["reason"]) && proposed_qid_for(proposed, id) == original_qid_for(id)
      when "preserve_existing"
        !original_same_as_for(id).nil? && proposed_same_as_for(proposed, id) == original_same_as_for(id)
      else false
      end
    end
  end

  def proposed_identities_authorized?(proposed, decisions)
    original_frontmatter = parse_document(@run[:original])&.first
    original = original_frontmatter && prerequisite_records(original_frontmatter)
    current = proposed["knowledge_prerequisites"]
    return false unless original && current.is_a?(Array)

    original_counts = Hash.new(0)
    original.each do |item|
      next unless item.is_a?(Hash) && qid_from_url(item["sameAs"])
      original_counts[[item["concept"], item["sameAs"]]] += 1
    end
    consumed = Hash.new(0)
    current.each do |item|
      next unless item.is_a?(Hash) && qid_from_url(item["sameAs"])
      identity = [item["concept"], item["sameAs"]]
      decision = decisions[identity[0]]
      if decision && decision["type"] == "select"
        return false unless authorized_selection_identity?(identity[0], decision, identity[1])
        next
      end
      if consumed[identity] < original_counts[identity]
        consumed[identity] += 1
      else
        return false
      end
    end
    true
  end

  def prerequisite_records(frontmatter)
    return [] unless frontmatter.key?("knowledge_prerequisites")
    records = frontmatter["knowledge_prerequisites"]
    records if records.is_a?(Array)
  end

  def authorized_selection_identity?(concept_id, decision, same_as)
    return false unless decision.is_a?(Hash) && decision["type"] == "select" && decision["proposed_sameAs"] == same_as
    candidate = @run[:candidates][decision["candidate_id"]]
    evidence_ids = decision["evidence_ids"]
    qid = qid_from_url(same_as)
    candidate && @run[:delivered_candidates][decision["candidate_id"]] && candidate["concept_id"] == concept_id && candidate["qid"] == qid &&
      same_as == "https://www.wikidata.org/wiki/#{candidate['qid']}" && evidence_ids.is_a?(Array) && !evidence_ids.empty? &&
      (evidence_ids - candidate["evidence_ids"]).empty? && evidence_ids.all? { |eid| @run[:delivered_evidence][eid] }
  end

  def proposed_same_as_values(doc, id)
    items = doc["knowledge_prerequisites"]
    return [] unless items.is_a?(Array)
    items.filter_map { |item| item["sameAs"] if item.is_a?(Hash) && item["concept"] == id }
  end

  def new_identities(decisions)
    decisions.filter_map do |id, d|
      next unless d["type"] == "select"
      { "concept_id" => id, "qid" => @run[:candidates].fetch(d["candidate_id"])["qid"], "candidate_id" => d["candidate_id"], "evidence_ids" => d["evidence_ids"] }
    end
  end

  def preserved_identities(decisions)
    existing_identities(@run[:original], @run[:concepts]).select { |e| decisions.dig(e["concept_id"], "type") == "preserve_existing" }
  end

  def proposed_qid_for(doc, id)
    item = doc["knowledge_prerequisites"].is_a?(Array) && doc["knowledge_prerequisites"].find { |x| x.is_a?(Hash) && x["concept"] == id }
    item && qid_from_url(item["sameAs"])
  end

  def original_qid_for(id)
    existing_identities(@run[:original], @run[:concepts]).find { |e| e["concept_id"] == id }&.fetch("qid")
  end

  def valid_decision_shape?(decision)
    return false unless decision.is_a?(Hash) && decision["concept_id"].is_a?(String)
    case decision["type"]
    when "select"
      decision.keys.sort == %w[candidate_id concept_id evidence_ids proposed_sameAs rationale type].sort &&
        decision["candidate_id"].is_a?(String) && ID.match?(decision["candidate_id"]) && decision["evidence_ids"].is_a?(Array) &&
        !decision["evidence_ids"].empty? && decision["evidence_ids"].all? { |e| e.is_a?(String) && ID.match?(e) } &&
        decision["evidence_ids"].uniq == decision["evidence_ids"] && decision["rationale"].is_a?(String) && decision["rationale"].bytesize <= 2048 && decision["proposed_sameAs"].is_a?(String)
    when "abstain"
      decision.keys.sort == %w[concept_id reason type].sort && decision["reason"].is_a?(String)
    when "preserve_existing"
      decision.keys.sort == %w[concept_id type].sort
    else false
    end
  end

  def proposed_same_as_for(doc, id)
    item = doc["knowledge_prerequisites"].is_a?(Array) && doc["knowledge_prerequisites"].find { |x| x.is_a?(Hash) && x["concept"] == id }
    item && item["sameAs"]
  end

  def original_same_as_for(id)
    parsed = parse_document(@run[:original])
    return nil unless parsed && parsed[0]["knowledge_prerequisites"].is_a?(Array)
    item = parsed[0]["knowledge_prerequisites"].find { |x| x.is_a?(Hash) && x["concept"] == id }
    item && item["sameAs"]
  end

  def qid_from_url(value)
    return nil unless value.is_a?(String)
    match = %r{\Ahttps?://www\.wikidata\.org/wiki/(Q[1-9][0-9]*)\z}.match(value)
    match && match[1]
  end

  def deep_copy(value)
    Marshal.load(Marshal.dump(value))
  end

  def utf8(bytes)
    text = bytes.dup.force_encoding(Encoding::UTF_8)
    raise EncodingError unless text.valid_encoding?
    text
  end

  def bounded(value, max = 2048)
    value.is_a?(String) ? value.encode("UTF-8", invalid: :replace, undef: :replace, replace: "�").byteslice(0, max).to_s.scrub : nil
  end

  def detail(field, concept_id, reason)
    { "field" => field.to_s[0, 128], "concept_id" => concept_id, "reason" => reason.to_s[0, 256] }
  end

  def error(code, message, retryable: false)
    { "code" => code, "message" => message.to_s[0, 512], "retryable" => retryable, "details" => [], "details_omitted_count" => 0 }
  end

  def invalid(req, code, message)
    envelope(req, "invalid_request", nil, error(code, message))
  end

  def envelope(req, status, result, err, run_id: nil)
    { "protocol_version" => 1, "request_id" => req.is_a?(Hash) && req["request_id"].is_a?(String) ? req["request_id"] : nil,
      "operation" => req.is_a?(Hash) && req["operation"].is_a?(String) ? req["operation"] : nil,
      "run_id" => run_id || @run&.dig(:id), "status" => status, "result" => result, "error" => err,
      "warnings" => [], "budget_remaining" => budget_remaining }
  end

  def budget_remaining
    return nil unless @run
    elapsed = [(monotonic - @run[:started]) * 1000, @limits["state_ttl_ms"]].min
    { "retrieval_ms" => [@limits["retrieval_ms"] - active_retrieval_ms.to_i, 0].max,
      "state_ms" => [@limits["state_ttl_ms"] - elapsed.to_i, 0].max,
      "http_requests" => [@limits["http_requests"] - @run[:http], 0].max,
      "entities" => [@limits["entities"] - @run[:entities], 0].max,
      "arcs" => [@limits["arcs"] - @run[:arcs], 0].max,
      "retrieval_output_bytes" => [@limits["output_bytes"] - @limits["terminal_reserve_bytes"] - @output_bytes, 0].max,
      "terminal_output_bytes" => [@limits["terminal_reserve_bytes"] - @terminal_bytes, 0].max }
  end

  def retrieval_operation
    started = monotonic
    @retrieval_started ||= started
    yield
  ensure
    @run[:active_ms] = [@run[:active_ms] + ((monotonic - @retrieval_started) * 1000).to_i, @limits["retrieval_ms"]].min
    @retrieval_started = nil
  end

  def active_retrieval_ms
    @run[:active_ms] + (@retrieval_started ? ((monotonic - @retrieval_started) * 1000) : 0)
  end

  def emit(response, terminal: false)
    unless terminal
      initial_size = JSON.generate(response).bytesize + 1
      available = @limits["output_bytes"] - @limits["terminal_reserve_bytes"] - @output_bytes
      if initial_size > available
        response = output_exhausted_response(response)
        terminal = true
      end
    end
    # Count the current envelope as required; a small fixed point accounts for digit growth.
    3.times do
      json = JSON.generate(response)
      count = json.bytesize + 1
      residual = [@limits["output_bytes"] - @output_bytes - count, 0].max
      response["budget_remaining"]["retrieval_output_bytes"] = [residual - @limits["terminal_reserve_bytes"], 0].max if response["budget_remaining"]
      response["budget_remaining"]["terminal_output_bytes"] = [@limits["terminal_reserve_bytes"] - @terminal_bytes - (terminal ? count : 0), 0].max if response["budget_remaining"]
    end
    json = JSON.generate(response)
    count = json.bytesize + 1
    if terminal
      return false if @terminal_bytes + count > @limits["terminal_reserve_bytes"] || @output_bytes + count > @limits["output_bytes"]
      @terminal_bytes += count
    else
      return false if @output_bytes + count > @limits["output_bytes"] - @limits["terminal_reserve_bytes"]
    end
    @output_bytes += count
    STDOUT.write(json + "\n")
    STDOUT.flush
    mark_delivered(response)
    true
  end

  def mark_delivered(response)
    return unless @run && response["result"].is_a?(Hash)
    result = response["result"]
    Array(result["evidence"]).each do |entry|
      if entry.is_a?(Hash) && entry["evidence_id"].is_a?(String)
        @run[:evidence][entry["evidence_id"]] = entry
        @run[:pending_evidence].delete(entry["evidence_id"])
        @run[:delivered_evidence][entry["evidence_id"]] = true
      end
    end
    Array(result["concept_results"]).each do |concept_result|
      next unless concept_result.is_a?(Hash)
      Array(concept_result["candidates"]).each do |candidate|
        next unless candidate.is_a?(Hash)
        if candidate["candidate_id"].is_a?(String)
          @run[:candidates][candidate["candidate_id"]] = candidate
          @run[:pending_candidates].delete(candidate["candidate_id"])
          @run[:delivered_candidates][candidate["candidate_id"]] = true
        end
        Array(candidate["evidence_ids"]).each { |id| @run[:delivered_evidence][id] = true }
      end
    end
    Array(result["arcs"]).each do |arc|
      Array(arc["evidence_ids"]).each { |id| @run[:delivered_evidence][id] = true } if arc.is_a?(Hash)
    end
  end

  def output_exhausted_response(response)
    result = response["result"] || {}
    case response["operation"]
    when "discover"
      omitted = Array(result["concept_results"]).filter_map { |entry| entry["concept_id"] if entry.is_a?(Hash) }
      replacement = {
        "concept_results" => omitted.map { |id| { "concept_id" => id, "status" => "unprocessed", "candidates" => [], "reason_code" => "OUTPUT_BUDGET_EXHAUSTED" } },
        "evidence" => [],
        "coverage" => coverage(omitted.length, 0, omitted.length, omitted, true, ["OUTPUT_BUDGET_EXHAUSTED"])
      }
    when "expand"
      records = %w[nodes arcs paths evidence].flat_map { |key| Array(result[key]) }
      omitted = records.filter_map { |entry| entry["arc_id"] || entry["node_id"] || entry["path_id"] || entry["evidence_id"] if entry.is_a?(Hash) }
      replacement = {
        "seeds" => Array(result["seeds"]), "nodes" => [], "arcs" => [], "paths" => [], "evidence" => [],
        "coverage" => coverage(records.length, 0, records.length, omitted, omitted.length == records.length, ["OUTPUT_BUDGET_EXHAUSTED"])
      }
    else
      replacement = {}
    end
    response.merge("status" => "partial", "result" => replacement,
                   "error" => error("OUTPUT_BUDGET_EXHAUSTED", "complete records omitted to fit the output budget"),
                   "warnings" => [])
  end

  def emit_fatal(code, message, request = nil)
    request_id = request["request_id"] if request.is_a?(Hash) && request["request_id"].is_a?(String) && !request["request_id"].empty? && request["request_id"].length <= 128
    operation = request["operation"] if request.is_a?(Hash) && %w[open discover expand validate close].include?(request["operation"])
    run_id = @run[:id] if request.is_a?(Hash) && @run && request["run_id"] == @run[:id]
    response = { "protocol_version" => 1, "request_id" => request_id, "operation" => operation, "run_id" => run_id, "status" => "invalid_request", "result" => nil, "error" => error(code, message), "warnings" => [], "budget_remaining" => budget_remaining }
    emit(response, terminal: true)
  end

  def terminal_operation?(operation)
    %w[validate close].include?(operation)
  end

  class Invalid < StandardError
    attr_reader :code
    def initialize(code, message)
      super(message)
      @code = code
    end
  end

  class Remote < StandardError
    attr_reader :code, :retryable
    def initialize(code, message, retryable = false)
      super(message)
      @code, @retryable = code, retryable
    end
  end

  class LocalValidationTimeout < Exception
  end
end

options = {}
OptionParser.new do |parser|
  parser.on("--root PATH") { |v| options[:root] = v }
  parser.on("--user-agent VALUE") { |v| options[:user_agent] = v }
  parser.on("--api-endpoint URL") { |v| options[:api_endpoint] = v }
  parser.on("--sparql-endpoint URL") { |v| options[:sparql_endpoint] = v }
  parser.on("--limits-file PATH") { |v| options[:limits_file] = v }
end.parse!
unless options[:root] && options[:user_agent] && ARGV.empty?
  warn "wikidata-oracle: required launcher arguments missing"
  exit 2
end
begin
  require "securerandom"
  require "openssl"
  exit WikidataOracle.new(options).run
rescue StandardError
  warn "wikidata-oracle: launcher configuration invalid"
  exit 2
end
