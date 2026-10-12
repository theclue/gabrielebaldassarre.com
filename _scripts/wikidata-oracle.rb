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
        response = handle(request)
      rescue JSON::ParserError, EncodingError
        emit_fatal("PROTOCOL_FATAL", "invalid JSONL frame")
        @exit_code = 2
        break
      rescue StandardError
        response = envelope(request.is_a?(Hash) ? request : {}, "invalid_request", nil,
                            error("INTERNAL_ERROR", "internal operation failure"))
      end
      unless emit(response, terminal: terminal_operation?(response["operation"]))
        @exit_code = 3
        break
      end
    end
    @exit_code
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
        req["protocol_version"] == 1 && req["request_id"].is_a?(String) && !req["request_id"].empty? &&
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
      snapshot: snapshot, original: bytes, evidence: {}, candidates: {}, validated: false,
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
    if req["operation"] != "close" && monotonic >= @run[:expires]
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
    ids.each do |id|
      concept = @run[:concepts].fetch(id)
      begin
        search = retrieve_api("wbsearchentities", "search" => concept["label"], "language" => concept["language"], "uselang" => concept["language"], "limit" => @limits["candidates_per_concept"])
        raise Remote.new("API_ERROR", "Wikidata returned an API error") if search.key?("error")
        hits = search["search"]
        raise Remote.new("API_ERROR", "malformed Wikidata search response") unless hits.is_a?(Array)
        candidates = []
        hits.take(@limits["candidates_per_concept"]).each do |hit|
          next unless hit.is_a?(Hash) && QID.match?(hit["id"].to_s)
          next if @run[:entities] >= @limits["entities"] && !@run[:candidates].values.any? { |c| c["qid"] == hit["id"] }
          entity_data = retrieve_api("wbgetentities", "ids" => hit["id"], "props" => "labels|descriptions|aliases|sitelinks|claims|info", "languages" => concept["language"])
          entity = entity_data.fetch("entities", {})[hit["id"]]
          next unless entity.is_a?(Hash) && !entity.key?("missing")
          @run[:entities] += 1 unless @run[:candidates].values.any? { |c| c["qid"] == hit["id"] }
          evidence = evidence_record("api_search", @api, qid: hit["id"], language: concept["language"], label: bounded(hit["label"]), description: bounded(hit["description"]), projection: "search", missing: [])
          search_eid = deliver_evidence(evidence)
          entity_evidence = entity_to_evidence(entity, hit["id"], concept["language"])
          entity_eid = deliver_evidence(entity_evidence)
          label = localized(entity["labels"], concept["language"])
          description = localized(entity["descriptions"], concept["language"])
          candidate_id = "cand-#{SecureRandom.hex(12)}"
          candidate = { "candidate_id" => candidate_id, "concept_id" => id, "qid" => hit["id"], "label" => bounded(label&.fetch("value", nil) || hit["label"]) || "", "description" => bounded(description&.fetch("value", nil) || hit["description"]) || "", "language" => bounded(label&.fetch("language", nil)), "aliases" => aliases_for(entity, concept["language"]), "sitelinks" => sitelinks_for(entity), "evidence_ids" => [search_eid, entity_eid] }
          candidates << candidate
          @run[:candidates][candidate_id] = candidate
        end
        status = candidates.empty? ? "no_match" : (candidates.length > 1 ? "ambiguous" : "ok")
        results << { "concept_id" => id, "status" => status, "candidates" => candidates, "reason_code" => nil }
      rescue Remote => e
        errors << e
        results << { "concept_id" => id, "status" => "unavailable", "candidates" => [], "reason_code" => e.code }
      end
    end
    status = if results.all? { |r| r["status"] == "no_match" } then "no_match"
             elsif results.all? { |r| r["status"] == "unavailable" } then "unavailable"
             elsif errors.any? || results.any? { |r| r["status"] == "unavailable" } then "partial"
             elsif results.any? { |r| r["status"] == "ambiguous" } then "ambiguous"
             else "ok" end
    result = { "concept_results" => results, "evidence" => @run[:evidence].values, "coverage" => coverage(ids.length, results.length, 0, [], true, []) }
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
      raise Invalid.new("INVALID_INPUT", "candidate does not belong to concept") unless c && c["concept_id"] == s["concept_id"]
      evidence_ids = s["evidence_ids"]
      raise Invalid.new("INVALID_INPUT", "evidence not delivered for candidate") unless evidence_ids.is_a?(Array) && !evidence_ids.empty? && (evidence_ids - c["evidence_ids"]).empty?
      seeds << { "concept_id" => s["concept_id"], "candidate_id" => c["candidate_id"], "evidence_ids" => evidence_ids }
    end
    arcs = []
    paths = []
    nodes = []
    selections.each do |s|
      c = @run[:candidates][s["candidate_id"]]
      seed_uri = "http://www.wikidata.org/entity/#{c['qid']}"
      properties = PROPERTIES.map { |p| "wdt:#{p}" }.join(" ")
      query = "PREFIX wdt: <http://www.wikidata.org/prop/direct/> SELECT ?item ?property ?value WHERE { VALUES ?item { <#{seed_uri}> } VALUES ?property { #{properties} } { ?item ?property ?value } UNION { ?value ?property ?item } } LIMIT #{[@limits['arcs'] - arcs.length, 200].min}"
      begin
        payload = retrieve_sparql(query)
        bindings = payload.dig("results", "bindings")
        raise Remote.new("HTTP_ERROR", "malformed SPARQL response") unless bindings.is_a?(Array)
        bindings.each do |binding|
          next unless binding.is_a?(Hash) && %w[item property value].all? { |key| binding[key].is_a?(Hash) }
          rdf_subject = rdf_value(binding.fetch("item"))
          rdf_predicate = rdf_value(binding.fetch("property"))
          rdf_object = rdf_value(binding.fetch("value"))
          property_id = rdf_predicate["value"].match(%r{/P[1-9][0-9]*\z})&.to_s&.delete_prefix("/")
          next unless PROPERTIES.include?(property_id)
          eid = deliver_evidence(evidence_record("wdqs", @sparql, qid: c["qid"], language: c["language"], projection: "truthy", bindings: binding.map { |name, value| { "name" => name, "value" => rdf_value(value) } }, missing: ["qualifiers", "references"]))
          arc = { "arc_id" => "arc-#{SecureRandom.hex(10)}", "subject" => rdf_subject, "predicate" => rdf_predicate, "object" => rdf_object, "property_id" => property_id, "evidence_ids" => [eid] }
          arcs << arc
          @run[:arcs] += 1
          nodes << node_for(rdf_subject, eid, c) << node_for(rdf_object, eid, nil)
          paths << { "path_id" => "path-#{SecureRandom.hex(10)}", "seed_candidate_id" => c["candidate_id"], "steps" => [{ "arc_id" => arc["arc_id"], "traversal" => rdf_subject["value"] == seed_uri ? "forward" : "reverse" }] }
          break if arcs.length >= @limits["arcs"]
        end
      rescue Remote => e
        errors << e
      end
    end
    nodes = nodes.uniq { |n| n["node_id"] }
    status = if errors.any? && arcs.empty? then "unavailable" elsif errors.any? then "partial" else "ok" end
    result = { "seeds" => seeds, "nodes" => nodes, "arcs" => arcs, "paths" => paths, "evidence" => @run[:evidence].values.select { |e| e["source"] == "wdqs" }, "coverage" => coverage(selections.length, arcs.length, 0, [], true, []) }
    envelope(req, status, result, errors.empty? ? nil : error(errors.first.code, "graph retrieval was incomplete", retryable: errors.first.retryable))
  rescue Invalid => e
    invalid(req, e.code, e.message)
  end

  def validate(req, input)
    return invalid(req, "INVALID_INPUT", "unknown validate fields") unless (input.keys - %w[proposed_document acknowledged_snapshot_id decisions]).empty?
    doc = input["proposed_document"]
    return invalid(req, "INVALID_INPUT", "proposed document must be UTF-8 text") unless doc.is_a?(String) && doc.encoding == Encoding::UTF_8 && doc.valid_encoding? && doc.bytesize <= @limits["document_bytes"]
    decisions = input["decisions"]
    return invalid(req, "INVALID_INPUT", "decisions must include a recognized type") unless decisions.is_a?(Array) && decisions.all? { |d| valid_decision_shape?(d) }
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
  rescue StandardError
    invalid(req, "DOCUMENT_UNSUPPORTED", "document could not be safely validated")
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
      http.open_timeout = [remaining, 0.1].max
      http.read_timeout = [remaining, 0.1].max
      http.write_timeout = [remaining, 0.1].max if http.respond_to?(:write_timeout=)
      request = Net::HTTP::Get.new(uri.request_uri)
      request["User-Agent"] = @user_agent
      request["Accept"] = accept
      response = http.request(request)
      body = response.body.to_s
      raise Remote.new("HTTP_ERROR", "remote response exceeded safety limit") if body.bytesize > 2 * 1024 * 1024
      if [429, 503].include?(response.code.to_i) && retries < @limits["retries_per_request"]
        wait = retry_delay(response["Retry-After"])
        raise Remote.new("RETRIEVAL_TIMEOUT", "retry exceeds retrieval budget") if wait * 1000 > @limits["retrieval_ms"] - active_retrieval_ms
        sleep(wait)
        retries += 1
        next
      end
      raise Remote.new("HTTP_ERROR", "remote service returned HTTP #{response.code}", [429, 503].include?(response.code.to_i)) unless response.code.to_i.between?(200, 299)
      JSON.parse(body)
    rescue Net::OpenTimeout, Net::ReadTimeout, Net::WriteTimeout, Timeout::Error
      raise Remote.new("RETRIEVAL_TIMEOUT", "remote request timed out", true)
    rescue IOError, SystemCallError, SocketError, OpenSSL::SSL::SSLError
      raise Remote.new("HTTP_ERROR", "remote request failed", true)
    end
  rescue JSON::ParserError
    raise Remote.new("API_ERROR", "remote service returned invalid JSON")
  end

  def retry_delay(header)
    return 0.25 unless header
    value = Float(header) rescue nil
    value ||= begin (Time.httpdate(header) - Time.now).clamp(0, 5) rescue 0.25 end
    value.clamp(0, 5)
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
          statements << { "property_id" => prop, "statement_id" => bounded(claim["id"]), "snak_type" => snak_type, "value" => snak_type == "value" ? wikibase_value(mainsnak["datavalue"]) : nil, "rank" => %w[preferred normal deprecated].include?(claim["rank"]) ? claim["rank"] : nil, "qualifiers" => [], "references" => [] }
        end
      end
    end
    evidence_record("api_entity", @api, qid: qid, language: lang, label: localized(entity["labels"], lang)&.fetch("value", nil), description: localized(entity["descriptions"], lang)&.fetch("value", nil), aliases: aliases_for(entity, lang), sitelinks: sitelinks_for(entity), statements: statements.take(20), projection: "statement", missing: missing + %w[qualifiers references])
  end

  def wikibase_value(dv)
    return nil unless dv.is_a?(Hash)
    value = dv["value"]
    return nil unless value.is_a?(Hash)
    if value["id"].is_a?(String) && QID.match?(value["id"])
      rdf_value({ "type" => "uri", "value" => "http://www.wikidata.org/entity/#{value['id']}" })
    elsif value["time"].is_a?(String)
      rdf_value({ "type" => "literal", "value" => value["time"], "datatype" => value["timeprecision"].to_s })
    elsif value["amount"].is_a?(String)
      rdf_value({ "type" => "literal", "value" => value["amount"], "datatype" => "http://www.w3.org/2001/XMLSchema#decimal" })
    else
      rdf_value({ "type" => "literal", "value" => value.to_s })
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

  def evidence_record(source, endpoint, qid: nil, language: nil, label: nil, description: nil, aliases: [], sitelinks: [], statements: [], bindings: [], projection:, missing: [])
    safe_url = endpoint.dup.tap { |u| u.query = nil; u.userinfo = nil }.to_s
    { "evidence_id" => "ev-#{SecureRandom.hex(12)}", "source" => source, "source_url" => safe_url, "retrieved_at" => Time.now.utc.iso8601, "revision_id" => nil, "entity_qid" => qid, "language" => bounded(language), "label" => bounded(label), "description" => bounded(description), "aliases" => aliases.take(50), "sitelinks" => sitelinks.take(50), "statements" => statements.take(20), "bindings" => bindings.take(20), "projection" => projection, "missing_fields" => missing.uniq.take(30) }
  end

  def deliver_evidence(record)
    @run[:evidence][record["evidence_id"]] = record
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
    if left["difficulty_computed"].is_a?(Hash) && right["difficulty_computed"].is_a?(Hash)
      left["difficulty_computed"].delete("semantic")
      right["difficulty_computed"].delete("semantic")
    end
    left == right
  end

  def concepts_preserved?(original, proposed, decisions)
    old = original["knowledge_prerequisites"]
    now = proposed["knowledge_prerequisites"]
    return false unless old.is_a?(Array) && now.is_a?(Array) && now.length >= old.length
    old.each do |item|
      return false unless item.is_a?(Hash)
      matches = now.select { |candidate| candidate.is_a?(Hash) && candidate["concept"] == item["concept"] }
      return false if matches.empty?
      changed = decisions[item["concept"]]
      expected = changed && changed["type"] == "select" ? "https://www.wikidata.org/wiki/#{@run[:candidates][changed['candidate_id']].to_h['qid']}" : item["sameAs"]
      return false unless matches.any? { |candidate| candidate["sameAs"] == expected && item.all? { |key, value| key == "sameAs" || candidate[key] == value } }
    end
    true
  end

  def decision_provenance?(proposed, decisions)
    return false unless decisions.length == @run[:concepts].length
    decisions.all? do |id, decision|
      case decision["type"]
      when "select"
        candidate = @run[:candidates][decision["candidate_id"]]
        qid = qid_from_url(decision["proposed_sameAs"])
        evs = decision["evidence_ids"]
        candidate && candidate["concept_id"] == id && candidate["qid"] == qid && decision["proposed_sameAs"] == "https://www.wikidata.org/wiki/#{candidate['qid']}" && evs.is_a?(Array) && !evs.empty? && (evs - candidate["evidence_ids"]).empty? && proposed_qid_for(proposed, id) == qid
      when "abstain"
        %w[ambiguous no_match unavailable unprocessed insufficient_evidence].include?(decision["reason"]) && proposed_qid_for(proposed, id) == original_qid_for(id)
      when "preserve_existing"
        !original_same_as_for(id).nil? && proposed_same_as_for(proposed, id) == original_same_as_for(id)
      else false
      end
    end
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
    true
  end

  def emit_fatal(code, message)
    response = { "protocol_version" => 1, "request_id" => nil, "operation" => nil, "run_id" => @run&.dig(:id), "status" => "invalid_request", "result" => nil, "error" => error(code, message), "warnings" => [], "budget_remaining" => budget_remaining }
    STDOUT.write(JSON.generate(response) + "\n")
    STDOUT.flush
  rescue StandardError
    nil
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
