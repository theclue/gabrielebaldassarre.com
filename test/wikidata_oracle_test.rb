#!/usr/bin/env ruby

require "fileutils"
require "digest"
require "json"
require "minitest/autorun"
require "open3"
require "rbconfig"
require "socket"
require "uri"

class WikidataOracleTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  CLI = File.join(ROOT, "_scripts", "wikidata-oracle.rb")
  SCRATCH_ROOT = "/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode"
  POST_PATH = "_posts/oracle-fixture.md"
  CONTEXTS = {
    "zsh" => "Z shell helps manage commands.",
    "federation-source" => "A federation source supplies data."
  }.freeze

  def setup
    @scratch_root = File.join(SCRATCH_ROOT, "wave2-wikidata-tests-c0b70f9223")
    FileUtils.mkdir_p(@scratch_root)
    @scratch = File.join(@scratch_root, "run-#{Process.pid}-#{object_id}")
    FileUtils.mkdir_p(@scratch)
    @root = File.join(@scratch, "trusted-root")
    FileUtils.mkdir_p(File.join(@root, "_posts"))
    @post_file = File.join(@root, POST_PATH)
    File.binwrite(@post_file, fixture_document)
    @original_bytes = File.binread(@post_file)
    @http = FakeWikidata.new
    @limits_file = File.join(@scratch, "limits.json")
    File.write(@limits_file, JSON.generate(
      "retrieval_ms" => 2_000,
      "state_ttl_ms" => 10_000,
      "http_requests" => 8,
      "retries_per_request" => 0,
      "concepts" => 2,
      "concepts_per_discover" => 2,
      "candidates_per_concept" => 2,
      "entities" => 4,
      "hops" => 2,
      "arcs" => 4,
      "document_bytes" => 16_384,
      "input_line_bytes" => 16_384,
      "output_bytes" => 262_144,
      "terminal_reserve_bytes" => 65_536,
      "validation_ms" => 1_000
    ))
  end

  def teardown
    @http&.close
    FileUtils.remove_entry(@scratch) if @scratch && File.exist?(@scratch)
    Dir.rmdir(@scratch_root) if @scratch_root && Dir.exist?(@scratch_root)
  rescue Errno::ENOTEMPTY
    nil
  end

  def test_jsonl_retrieval_validation_and_close_follow_frozen_contract
    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      assert_common_response(opened, "open", "open-1")
      assert_equal "ok", opened.fetch("status")
      run_id = opened.fetch("run_id")
      opened_result = opened.fetch("result")
      assert_match(/\A[a-f0-9]{64}\z/, opened_result.fetch("snapshot_id"))
      assert_equal %w[federation-source zsh], opened_result.fetch("concepts").map { |c| c.fetch("concept_id") }.sort

      discovered = cli.exchange("discover", {
        "run_id" => run_id,
        "concept_ids" => %w[zsh federation-source]
      })
      assert_common_response(discovered, "discover", "discover-1", run_id)
      discovery = discovered.fetch("result")
      assert_equal %w[federation-source zsh], discovery.fetch("concept_results").map { |c| c.fetch("concept_id") }.sort
      candidates = discovery.fetch("concept_results").flat_map { |c| c.fetch("candidates") }
      qids = candidates.to_h { |candidate| [candidate.fetch("qid"), candidate.fetch("description")] }
      assert_equal "Unix shell and command language", qids.fetch("Q227308")
      assert_equal "Source used in data federation", qids.fetch("Q306138")
      evidence_ids = discovery.fetch("evidence").map { |evidence| evidence.fetch("evidence_id") }
      assert evidence_ids.any?, "discovery must deliver evidence, not model-supplied identifiers"

      selected = candidates.to_h { |candidate| [candidate.fetch("concept_id"), candidate] }
      expanded = cli.exchange("expand", {
        "run_id" => run_id,
        "selections" => %w[zsh federation-source].map do |concept_id|
          candidate = selected.fetch(concept_id)
          {
            "concept_id" => concept_id,
            "candidate_id" => candidate.fetch("candidate_id"),
            "evidence_ids" => candidate.fetch("evidence_ids"),
            "rationale" => "Reviewed the retrieved candidate in its editorial context.",
            "hop" => 1
          }
        end
      })
      assert_common_response(expanded, "expand", "expand-1", run_id)
      graph = expanded.fetch("result")
      refute_empty graph.fetch("arcs")
      assert graph.fetch("arcs").all? { |arc| arc.fetch("subject").fetch("type") && arc.fetch("object").fetch("type") }
      wdqs_evidence = graph.fetch("evidence").find { |entry| entry.fetch("source") == "wdqs" }
      refute_nil wdqs_evidence, "expand should retain provenance for fake WDQS bindings"
      assert wdqs_evidence.fetch("bindings").any? { |binding| binding.fetch("value").fetch("type") == "uri" }

      proposed = @original_bytes.sub(
        "sameAs: https://www.wikidata.org/wiki/Q999999",
        "sameAs: https://www.wikidata.org/wiki/Q227308"
      )
      decisions = [
        {
          "concept_id" => "zsh",
          "candidate_id" => selected.fetch("zsh").fetch("candidate_id"),
          "evidence_ids" => selected.fetch("zsh").fetch("evidence_ids"),
          "rationale" => "A human selected the candidate; the core checks provenance only.",
          "proposed_sameAs" => "https://www.wikidata.org/wiki/Q227308",
          "type" => "select"
        },
        { "concept_id" => "federation-source", "type" => "preserve_existing" }
      ]
      validated = cli.exchange("validate", {
        "run_id" => run_id,
        "proposed_document" => proposed.force_encoding(Encoding::UTF_8),
        "acknowledged_snapshot_id" => opened_result.fetch("snapshot_id"),
        "decisions" => decisions
      })
      assert_common_response(validated, "validate", "validate-1", run_id)
      report = validated.fetch("result")
      assert report.fetch("accepted"), "provenance-valid proposal should pass without claiming semantic verification"
      assert_equal "provenance_and_document_checks", report.fetch("assurance")
      assert_equal "not_provided_by_core", report.fetch("write_enforcement")
      assert_equal Digest::SHA256.hexdigest(proposed), report.fetch("proposed_sha256")
      assert_equal ["Q227308"], report.fetch("new_identities").map { |identity| identity.fetch("qid") }
      assert_equal "https://www.wikidata.org/wiki/Q306138",
        report.fetch("preserved_identities").find { |identity| identity.fetch("concept_id") == "federation-source" }.fetch("same_as")
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"

      closed = cli.exchange("close", {}, run_id: run_id)
      assert_common_response(closed, "close", "close-1", run_id)
      assert_equal true, closed.fetch("result").fetch("closed")
    end
    assert_operator @http.requests.count { |request| request.start_with?("/w/api.php") }, :>=, 1
    assert_operator @http.requests.count { |request| request.start_with?("/sparql") }, :>=, 1
  end

  def test_open_rejects_symlink_target_without_contacting_retrieval_endpoints
    external = File.join(@scratch, "outside.md")
    File.write(external, fixture_document)
    File.symlink(external, File.join(@root, "_posts", "linked.md"))

    with_cli do |cli|
      response = cli.exchange("open", "post_path" => "_posts/linked.md", "concepts" => concepts)
      assert_equal "open", response.fetch("operation")
      assert_equal "UNSAFE_TARGET", response.fetch("error").fetch("code")
    end
    assert_empty @http.requests
  end

  def test_validate_rejects_changed_body_and_never_writes_the_target
    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      run_id = opened.fetch("run_id")
      snapshot_id = opened.fetch("result").fetch("snapshot_id")
      changed = @original_bytes.sub("helps manage commands", "magically validates commands")
      response = cli.exchange("validate", {
        "run_id" => run_id,
        "proposed_document" => changed.force_encoding(Encoding::UTF_8),
        "acknowledged_snapshot_id" => snapshot_id,
        "decisions" => [
          { "concept_id" => "zsh", "type" => "preserve_existing" },
          { "concept_id" => "federation-source", "type" => "preserve_existing" }
        ]
      })
      assert_includes %w[rejected invalidated], response.fetch("status")
      refute response.fetch("result").fetch("accepted")
      refute response.fetch("result").fetch("checks").find { |check| check.fetch("name") == "body_bytes" }.fetch("passed")
      assert_equal @original_bytes, File.binread(@post_file)
    end
  end

  private

  def concepts
    CONTEXTS.map do |concept_id, context|
      { "concept_id" => concept_id, "label" => concept_id, "language" => "en", "context" => context }
    end
  end

  def fixture_document
    <<~POST
      ---
      title: "Offline Wikidata oracle fixture"
      tags:
        - shell
        - federation
      difficulty_computed:
        semantic:
          concept_count: 2
      knowledge_prerequisites:
        - concept: zsh
          label: Z shell
          sameAs: https://www.wikidata.org/wiki/Q999999
          importance: required
          depth: 1
        - concept: federation-source
          label: federation source
          sameAs: https://www.wikidata.org/wiki/Q306138
          importance: recommended
          depth: 2
      ---
      Z shell helps manage commands.
      A federation source supplies data.
    POST
  end

  def assert_common_response(response, operation, request_id, run_id = nil)
    assert_equal %w[budget_remaining error operation protocol_version request_id result run_id status warnings], response.keys.sort
    assert_equal 1, response.fetch("protocol_version")
    assert_equal operation, response.fetch("operation")
    assert_equal request_id, response.fetch("request_id")
    assert_equal run_id, response.fetch("run_id") if run_id
    assert_kind_of Array, response.fetch("warnings")
    assert_kind_of Hash, response.fetch("budget_remaining")
  end

  def with_cli
    argv = [
      RbConfig.ruby, CLI,
      "--root", @root,
      "--user-agent", "Wikidata oracle test suite https://example.invalid/project",
      "--api-endpoint", "http://127.0.0.1:#{@http.port}/w/api.php",
      "--sparql-endpoint", "http://127.0.0.1:#{@http.port}/sparql",
      "--limits-file", @limits_file
    ]
    stdin, stdout, stderr, wait_thread = Open3.popen3(*argv)
    client = JsonlClient.new(stdin, stdout, stderr, wait_thread, self)
    yield client
  ensure
    client&.stop
  end

  class JsonlClient
    def initialize(stdin, stdout, stderr, wait_thread, assertions)
      @stdin, @stdout, @stderr, @wait_thread = stdin, stdout, stderr, wait_thread
      @assertions = assertions
      @operation_counts = Hash.new(0)
    end

    def exchange(operation, input = nil, run_id: nil, **input_fields)
      input ||= input_fields
      @operation_counts[operation] += 1
      request_id = "#{operation}-#{@operation_counts[operation]}"
      request = { "protocol_version" => 1, "request_id" => request_id, "operation" => operation, "input" => input }
      request["run_id"] = run_id if run_id
      @stdin.write(JSON.generate(request) + "\n")
      @stdin.flush
      ready = IO.select([@stdout], nil, nil, 4)
      line = ready && @stdout.gets
      @assertions.assert(line, "CLI emitted no JSONL response for #{operation} (exit=#{exit_status}, stderr=#{stderr_excerpt})")
      JSON.parse(line)
    end

    def stop
      @stdin.close unless @stdin.closed?
      @wait_thread.join(2)
      Process.kill("KILL", @wait_thread.pid) if @wait_thread.alive?
      @wait_thread.join(1)
      @stdout.close unless @stdout.closed?
      @stderr.close unless @stderr.closed?
    rescue Errno::ESRCH, IOError
      nil
    end

    private

    def exit_status
      @wait_thread.join(0.2)
      @wait_thread.value.exitstatus if @wait_thread.stop?
    rescue IOError
      "unknown"
    end

    def stderr_excerpt
      @stderr.read_nonblock(2_048, exception: false).to_s
    rescue IOError
      ""
    end
  end

  class FakeWikidata
    attr_reader :port, :requests

    def initialize
      @server = TCPServer.new("127.0.0.1", 0)
      @port = @server.addr[1]
      @requests = []
      @mutex = Mutex.new
      @worker_threads = []
      @thread = Thread.new { serve }
    end

    def close
      @server.close
      @thread.join(1)
      @thread.kill if @thread.alive?
      @thread.join(1)
      @worker_threads.each do |worker|
        worker.join(0.2)
        worker.kill if worker.alive?
        worker.join(0.2)
      end
    rescue IOError
      nil
    end

    private

    def serve
      loop do
        socket = @server.accept
        worker = Thread.new(socket) { |client| handle(client) }
        @mutex.synchronize { @worker_threads << worker }
      end
    rescue IOError, Errno::EBADF
      nil
    end

    def handle(socket)
      request_line = socket.gets
      return unless request_line
      headers = {}
      while (line = socket.gets) && line != "\r\n"
        key, value = line.split(":", 2)
        headers[key.downcase] = value.to_s.strip
      end
      body = socket.read(headers.fetch("content-length", "0").to_i)
      method, target = request_line.split(" ", 3)
      uri = URI("http://127.0.0.1#{target}")
      params = URI.decode_www_form(uri.query.to_s).to_h
      params.merge!(URI.decode_www_form(body).to_h) if method == "POST"
      @mutex.synchronize { @requests << uri.request_uri }
      payload = if uri.path == "/sparql"
        sparql_response
      elsif params["action"] == "wbsearchentities"
        search_response
      elsif params["action"] == "wbgetentities"
        entities_response(params["ids"].to_s.split("|"))
      else
        { "error" => { "code" => "unknown_action", "info" => "fake endpoint received an unknown action" } }
      end
      json = JSON.generate(payload)
      socket.write("HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: #{json.bytesize}\r\nConnection: close\r\n\r\n#{json}")
    rescue IOError, Errno::EPIPE
      nil
    ensure
      socket&.close
    end

    def search_response
      { "search" => [
        { "id" => "Q227308", "label" => "Z shell", "description" => "Unix shell and command language", "match" => { "language" => "en", "text" => "Z shell" } },
        { "id" => "Q306138", "label" => "Federation source", "description" => "Source used in data federation", "match" => { "language" => "en", "text" => "federation source" } }
      ] }
    end

    def entities_response(ids)
      { "entities" => ids.each_with_object({}) do |qid, entities|
        label, description = case qid
        when "Q227308" then ["Z shell", "Unix shell and command language"]
        when "Q306138" then ["Federation source", "Source used in data federation"]
        else [qid, "Fixture entity"]
        end
        entities[qid] = {
          "id" => qid,
          "labels" => { "en" => { "language" => "en", "value" => label } },
          "descriptions" => { "en" => { "language" => "en", "value" => description } },
          "aliases" => { "en" => [] },
          "sitelinks" => {},
          "claims" => {}
        }
      end }
    end

    def sparql_response
      { "head" => { "vars" => %w[item property value] }, "results" => { "bindings" => [
        {
          "item" => { "type" => "uri", "value" => "http://www.wikidata.org/entity/Q227308" },
          "property" => { "type" => "uri", "value" => "http://www.wikidata.org/prop/direct/P279" },
          "value" => { "type" => "uri", "value" => "http://www.wikidata.org/entity/Q306138" }
        }
      ] } }
    end
  end
end
