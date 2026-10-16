#!/usr/bin/env ruby

require "fileutils"
require "digest"
require "json"
require "minitest/autorun"
require "open3"
require "rbconfig"
require "socket"
require "time"
require "uri"

class WikidataOracleTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  CLI = File.join(ROOT, "_scripts", "wikidata-oracle.rb")
  SCRATCH_ROOT = "/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode"
  POST_PATH = "_posts/oracle-fixture.md"
  INTERNAL_ERROR_MARKER = "T8_TEST_PRIVATE_DIAGNOSTIC_SENTINEL"
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
        "concept_ids" => %w[zsh federation-source]
      }, run_id: run_id)
      assert_common_response(discovered, "discover", "discover-1", run_id)
      discovery = discovered.fetch("result")
      assert_equal %w[federation-source zsh], discovery.fetch("concept_results").map { |c| c.fetch("concept_id") }.sort
      candidates = discovery.fetch("concept_results").flat_map { |c| c.fetch("candidates") }
      qids = candidates.to_h { |candidate| [candidate.fetch("qid"), candidate.fetch("description")] }
      assert qids.key?("Q227308"), "expected shell result; discovery=#{discovery.inspect}; requests=#{@http.requests.inspect}"
      assert_equal "Unix shell and command language", qids.fetch("Q227308")
      assert qids.key?("Q306138"), "expected federation result; discovery=#{discovery.inspect}; requests=#{@http.requests.inspect}"
      assert_equal "Source used in data federation", qids.fetch("Q306138")
      evidence_ids = discovery.fetch("evidence").map { |evidence| evidence.fetch("evidence_id") }
      assert evidence_ids.any?, "discovery must deliver evidence, not model-supplied identifiers"

      # The caller—not the core—chooses among retrieved candidates for each concept.
      selected = {
        "zsh" => candidates.find { |candidate| candidate.fetch("concept_id") == "zsh" && candidate.fetch("qid") == "Q227308" },
        "federation-source" => candidates.find { |candidate| candidate.fetch("concept_id") == "federation-source" && candidate.fetch("qid") == "Q306138" }
      }
      assert selected.values.all?, "fixture should expose both explicitly selected QIDs"
      expanded = cli.exchange("expand", {
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
      }, run_id: run_id)
      assert_common_response(expanded, "expand", "expand-1", run_id)
      assert_equal "ok", expanded.fetch("status"), "expand response: #{expanded.inspect}; fake requests: #{@http.requests.inspect}"
      graph = expanded.fetch("result")
      refute_empty graph.fetch("arcs"), "expand response: #{expanded.inspect}; fake requests: #{@http.requests.inspect}"
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
        "proposed_document" => proposed.force_encoding(Encoding::UTF_8),
        "acknowledged_snapshot_id" => opened_result.fetch("snapshot_id"),
        "decisions" => decisions
      }, run_id: run_id)
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
        "proposed_document" => changed.force_encoding(Encoding::UTF_8),
        "acknowledged_snapshot_id" => snapshot_id,
        "decisions" => [
          { "concept_id" => "zsh", "type" => "preserve_existing" },
          { "concept_id" => "federation-source", "type" => "preserve_existing" }
        ]
      }, run_id: run_id)
      assert_includes %w[rejected invalidated], response.fetch("status")
      refute response.fetch("result").fetch("accepted")
      refute response.fetch("result").fetch("checks").find { |check| check.fetch("name") == "body_bytes" }.fetch("passed")
      assert_equal @original_bytes, File.binread(@post_file)
    end
  end

  def test_validate_rejects_unregistered_prerequisite_with_unselected_qid
    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      proposed = selected_zsh_proposal(candidate)
      proposed = proposed.sub(
        "  - concept: federation-source\n    label: federation source\n    sameAs: https://www.wikidata.org/wiki/Q306138\n    importance: recommended\n    depth: 2\n",
        "  - concept: federation-source\n    label: federation source\n    sameAs: https://www.wikidata.org/wiki/Q306138\n    importance: recommended\n    depth: 2\n  - concept: unregistered-prerequisite\n    label: Unregistered prerequisite\n    sameAs: https://www.wikidata.org/wiki/Q888888\n    importance: required\n    depth: 1\n"
      )
      response, report = validate_proposal(cli, opened, proposed, selection_decisions(candidate))

      assert_exact_proposal_report(report, proposed)
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
      assert_equal(
        { "accepted" => false, "identity_provenance" => false, "status" => "rejected" },
        {
          "accepted" => report.fetch("accepted"),
          "identity_provenance" => report.fetch("checks").find { |check| check.fetch("name") == "identity_provenance" }.fetch("passed"),
          "status" => response.fetch("status")
        },
        "an unselected QID must not be accepted outside the run registry"
      )
    end
  end

  def test_validate_does_not_let_a_selected_candidate_for_one_concept_authorize_another
    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      proposed = selected_zsh_proposal(candidate).sub(
        "sameAs: https://www.wikidata.org/wiki/Q306138",
        "sameAs: https://www.wikidata.org/wiki/Q227308"
      )
      decisions = [select_decision(candidate), select_decision(candidate, "federation-source")]
      response, report = validate_proposal(cli, opened, proposed, decisions)

      assert_exact_proposal_report(report, proposed)
      assert_equal false, report.fetch("accepted")
      assert_equal false, report.fetch("checks").find { |check| check.fetch("name") == "identity_provenance" }.fetch("passed")
      assert_equal "rejected", response.fetch("status")
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
    end
  end

  def test_validate_rejects_unapproved_duplicate_identity_after_selected_record
    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      proposed = selected_zsh_proposal(candidate).sub(
        "  - concept: federation-source\n",
        "  - concept: zsh\n    label: Injected duplicate\n    sameAs: https://www.wikidata.org/wiki/Q888888\n    importance: recommended\n    depth: 4\n  - concept: federation-source\n"
      )
      response, report = validate_proposal(cli, opened, proposed, selection_decisions(candidate))

      assert_exact_proposal_report(report, proposed)
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
      assert_equal(
        { "accepted" => false, "identity_provenance" => false, "status" => "rejected" },
        {
          "accepted" => report.fetch("accepted"),
          "identity_provenance" => report.fetch("checks").find { |check| check.fetch("name") == "identity_provenance" }.fetch("passed"),
          "status" => response.fetch("status")
        },
        "an extra QID must not be authorized by the first record for this concept"
      )
    end
  end

  def test_validate_rejects_unapproved_duplicate_identity_before_selected_record
    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      proposed = selected_zsh_proposal(candidate).sub(
        "  - concept: zsh\n",
        "  - concept: zsh\n    label: Injected duplicate\n    sameAs: https://www.wikidata.org/wiki/Q888888\n    importance: recommended\n    depth: 4\n  - concept: zsh\n"
      )
      response, report = validate_proposal(cli, opened, proposed, selection_decisions(candidate))

      assert_exact_proposal_report(report, proposed)
      assert_equal false, report.fetch("accepted")
      assert_equal false, report.fetch("checks").find { |check| check.fetch("name") == "identity_provenance" }.fetch("passed")
      assert_equal "rejected", response.fetch("status")
    end
  end

  def test_abstain_rejects_mutation_of_non_qid_original_identity
    @original_bytes = @original_bytes.sub(
      "sameAs: https://www.wikidata.org/wiki/Q999999",
      "sameAs: https://example.org/original-identity"
    )
    File.binwrite(@post_file, @original_bytes)

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      proposed = @original_bytes.sub(
        "sameAs: https://example.org/original-identity",
        "sameAs: https://example.net/changed-identity"
      )
      decisions = [
        { "concept_id" => "zsh", "type" => "abstain", "reason" => "no_match" },
        { "concept_id" => "federation-source", "type" => "preserve_existing" }
      ]
      response, report = validate_proposal(cli, opened, proposed, decisions)

      assert_exact_proposal_report(report, proposed)
      assert_equal false, report.fetch("accepted")
      assert_equal true, report.fetch("checks").find { |check| check.fetch("name") == "identity_provenance" }.fetch("passed"),
        "the current QID-only provenance comparison does not notice this mutation"
      assert_equal false, report.fetch("checks").find { |check| check.fetch("name") == "concept_preservation" }.fetch("passed"),
        "the independent preservation check must still reject it"
      assert_equal "rejected", response.fetch("status")
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
    end
  end

  def test_validate_does_not_reuse_one_record_to_preserve_duplicate_originals
    @original_bytes = @original_bytes.sub(
      "  - concept: federation-source\n",
      "  - concept: zsh\n    label: Z shell\n    sameAs: https://www.wikidata.org/wiki/Q999999\n    importance: required\n    depth: 1\n  - concept: federation-source\n"
    )
    File.binwrite(@post_file, @original_bytes)

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      proposed = @original_bytes.sub(
        "  - concept: zsh\n    label: Z shell\n    sameAs: https://www.wikidata.org/wiki/Q999999\n    importance: required\n    depth: 1\n  - concept: federation-source\n",
        "  - concept: federation-source\n"
      ).sub(
        "  - concept: federation-source\n",
        "  - concept: federation-source\n    label: federation source\n    sameAs: https://www.wikidata.org/wiki/Q306138\n    importance: recommended\n    depth: 2\n  - concept: unregistered-prerequisite\n    label: New record\n    importance: recommended\n    depth: 1\n"
      )
      decisions = [
        { "concept_id" => "zsh", "type" => "preserve_existing" },
        { "concept_id" => "federation-source", "type" => "preserve_existing" }
      ]
      response, report = validate_proposal(cli, opened, proposed, decisions)

      assert_exact_proposal_report(report, proposed)
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
      assert_equal(
        { "accepted" => false, "concept_preservation" => false, "status" => "rejected" },
        {
          "accepted" => report.fetch("accepted"),
          "concept_preservation" => report.fetch("checks").find { |check| check.fetch("name") == "concept_preservation" }.fetch("passed"),
          "status" => response.fetch("status")
        },
        "each original prerequisite record needs a distinct preserved counterpart"
      )
    end
  end

  def test_validate_preserves_preexisting_duplicate_identities_without_certifying_them
    @original_bytes = @original_bytes.sub(
      "  - concept: federation-source\n",
      "  - concept: zsh\n    label: Z shell\n    sameAs: https://www.wikidata.org/wiki/Q999999\n    importance: required\n    depth: 1\n  - concept: federation-source\n"
    )
    File.binwrite(@post_file, @original_bytes)

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      decisions = [
        { "concept_id" => "zsh", "type" => "preserve_existing" },
        { "concept_id" => "federation-source", "type" => "preserve_existing" }
      ]
      response, report = validate_proposal(cli, opened, @original_bytes, decisions)

      assert_equal "ok", response.fetch("status")
      assert_equal true, report.fetch("accepted")
      assert_equal 2, report.fetch("preserved_identities").count { |identity| identity.fetch("concept_id") == "zsh" }
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
    end
  end

  def test_validate_preserves_unchanged_prerequisite_outside_registry_without_discovery
    @original_bytes = @original_bytes.sub(
      "  - concept: federation-source\n",
      "  - concept: unregistered-prerequisite\n    label: Unregistered prerequisite\n    sameAs: https://www.wikidata.org/wiki/Q888888\n    importance: recommended\n    depth: 1\n  - concept: federation-source\n"
    )
    File.binwrite(@post_file, @original_bytes)

    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      proposed = selected_zsh_proposal(candidate)
      response, report = validate_proposal(cli, opened, proposed, selection_decisions(candidate))

      assert_equal "ok", response.fetch("status")
      assert_equal true, report.fetch("accepted")
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
    end
  end

  def test_select_does_not_authorize_old_qid_as_an_additional_duplicate
    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      proposed = selected_zsh_proposal(candidate).sub(
        "  - concept: federation-source\n",
        "  - concept: zsh\n    label: Z shell\n    sameAs: https://www.wikidata.org/wiki/Q999999\n    importance: required\n    depth: 1\n  - concept: federation-source\n"
      )
      response, report = validate_proposal(cli, opened, proposed, selection_decisions(candidate))

      assert_exact_proposal_report(report, proposed)
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
      assert_equal(
        { "accepted" => false, "identity_provenance" => false, "status" => "rejected" },
        {
          "accepted" => report.fetch("accepted"),
          "identity_provenance" => report.fetch("checks").find { |check| check.fetch("name") == "identity_provenance" }.fetch("passed"),
          "status" => response.fetch("status")
        },
        "selecting a new QID must not authorize adding the old QID as another identity"
      )
    end
  end

  def test_preservation_accepts_reordered_original_records_with_optional_fields
    subset = "  - concept: zsh\n    sameAs: https://www.wikidata.org/wiki/Q999999\n    importance: required\n    depth: 1\n"
    superset = "  - concept: zsh\n    label: Z shell\n    sameAs: https://www.wikidata.org/wiki/Q999999\n    importance: required\n    depth: 1\n"
    original_pair = "  - concept: zsh\n    label: Z shell\n    sameAs: https://www.wikidata.org/wiki/Q999999\n    importance: required\n    depth: 1\n"
    @original_bytes = @original_bytes.sub(
      original_pair + "  - concept: federation-source\n",
      subset + superset + "  - concept: federation-source\n"
    )
    File.binwrite(@post_file, @original_bytes)

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      proposed = @original_bytes.sub(subset + superset, superset + subset)
      decisions = [
        { "concept_id" => "zsh", "type" => "preserve_existing" },
        { "concept_id" => "federation-source", "type" => "preserve_existing" }
      ]
      response, report = validate_proposal(cli, opened, proposed, decisions)

      assert_exact_proposal_report(report, proposed)
      assert_equal @original_bytes, File.binread(@post_file), "validate is read-only"
      assert_equal(
        { "accepted" => true, "concept_preservation" => true, "identity_provenance" => true, "status" => "ok" },
        {
          "accepted" => report.fetch("accepted"),
          "concept_preservation" => report.fetch("checks").find { |check| check.fetch("name") == "concept_preservation" }.fetch("passed"),
          "identity_provenance" => report.fetch("checks").find { |check| check.fetch("name") == "identity_provenance" }.fetch("passed"),
          "status" => response.fetch("status")
        },
        "reordering identical original records is not forbidden by the contract"
      )
    end
  end

  def test_first_prerequisite_annotation_accepts_when_original_list_is_absent
    original = i1_document(semantic: i1_semantic_yaml(blocking_count: 0))
    proposed = i1_document(
      semantic: i1_semantic_yaml(blocking_count: 0),
      prerequisites: i1_new_prerequisite_yaml
    )
    decisions = [
      { "concept_id" => "zsh", "type" => "abstain", "reason" => "no_match" },
      { "concept_id" => "federation-source", "type" => "abstain", "reason" => "no_match" }
    ]

    assert_equal i1_accepted_expectation(original, proposed), i1_validate_observation(original, proposed, decisions),
      "an absent original prerequisite list has no records to drop; a reviewed no-QID entry is within the authorized semantic section"
  end

  def test_first_semantic_annotation_accepts_when_computed_parent_is_absent
    original = i1_document(prerequisites: i1_existing_prerequisites_yaml)
    proposed = i1_document(
      difficulty: i1_semantic_yaml(blocking_count: 1),
      prerequisites: i1_existing_prerequisites_yaml
    )
    decisions = [
      { "concept_id" => "zsh", "type" => "preserve_existing" },
      { "concept_id" => "federation-source", "type" => "preserve_existing" }
    ]

    assert_equal i1_accepted_expectation(original, proposed), i1_validate_observation(original, proposed, decisions),
      "creating the computed parent solely to populate its authorized semantic child must preserve all other fields"
  end

  def test_first_annotation_accepts_when_both_authorized_sections_are_absent
    original = i1_document
    proposed = i1_document(
      difficulty: i1_semantic_yaml(blocking_count: 0),
      prerequisites: i1_new_prerequisite_yaml
    )
    decisions = [
      { "concept_id" => "zsh", "type" => "abstain", "reason" => "no_match" },
      { "concept_id" => "federation-source", "type" => "abstain", "reason" => "no_match" }
    ]

    assert_equal i1_accepted_expectation(original, proposed), i1_validate_observation(original, proposed, decisions),
      "first annotation may initialize only the two authorized semantic sections"
  end

  def test_first_semantic_annotation_preserves_existing_nonsemantic_children
    lexical = i1_lexical_parent_yaml
    original = i1_document(difficulty: lexical, prerequisites: i1_existing_prerequisites_yaml)
    proposed = i1_document(
      difficulty: i1_difficulty_with_lexical_and_semantic(blocking_count: 1),
      prerequisites: i1_existing_prerequisites_yaml
    )
    decisions = [
      { "concept_id" => "zsh", "type" => "preserve_existing" },
      { "concept_id" => "federation-source", "type" => "preserve_existing" }
    ]

    assert_equal i1_accepted_expectation(original, proposed), i1_validate_observation(original, proposed, decisions)
  end

  def test_first_annotation_does_not_create_unauthorized_nonsemantic_child
    original = i1_document(prerequisites: i1_existing_prerequisites_yaml)
    proposed = i1_document(
      difficulty: i1_lexical_parent_yaml,
      prerequisites: i1_existing_prerequisites_yaml
    )
    decisions = [
      { "concept_id" => "zsh", "type" => "preserve_existing" },
      { "concept_id" => "federation-source", "type" => "preserve_existing" }
    ]
    actual = i1_validate_observation(original, proposed, decisions)

    assert_equal false, actual.fetch("accepted")
    assert_equal "rejected", actual.fetch("status")
    assert_equal false, actual.fetch("checks").fetch("frontmatter_scope")
    assert_equal true, actual.fetch("checks").fetch("concept_preservation")
    assert_equal true, actual.fetch("checks").fetch("identity_provenance")
    assert_equal Digest::SHA256.hexdigest(proposed), actual.fetch("proposed_sha256")
    assert_equal Digest::SHA256.hexdigest(original), actual.fetch("target_sha256")
    assert_equal true, actual.fetch("target_unchanged")
  end

  def test_first_annotation_does_not_coerce_null_scalar_or_malformed_original_list
    malformed_lists = {
      "null" => "knowledge_prerequisites: null\n",
      "scalar" => "knowledge_prerequisites: malformed-existing-list\n",
      "mapping" => "knowledge_prerequisites:\n  concept: zsh\n"
    }
    malformed_lists.each do |shape, original_list_yaml|
      original = i1_document(semantic: i1_semantic_yaml(blocking_count: 0), prerequisites: original_list_yaml)
      proposed = i1_document(
        semantic: i1_semantic_yaml(blocking_count: 0),
        prerequisites: i1_new_prerequisite_yaml
      )
      decisions = [
        { "concept_id" => "zsh", "type" => "abstain", "reason" => "no_match" },
        { "concept_id" => "federation-source", "type" => "abstain", "reason" => "no_match" }
      ]
      actual = i1_validate_observation(original, proposed, decisions)

      assert_equal false, actual.fetch("accepted"), "#{shape} source list must not be coerced to an empty list"
      assert_equal "rejected", actual.fetch("status")
      assert_equal false, actual.fetch("checks").fetch("concept_preservation")
      assert_equal Digest::SHA256.hexdigest(proposed), actual.fetch("proposed_sha256")
      assert_equal Digest::SHA256.hexdigest(original), actual.fetch("target_sha256")
      assert_equal true, actual.fetch("target_unchanged")
    end
  end

  def test_discover_reports_entity_cap_omission_across_batches_by_concept_id
    configure_limits("entities" => 1, "candidates_per_concept" => 1)
    @http.configure(search_by_label: {
      "zsh" => [search_hit("Q227308", "Z shell")],
      "federation-source" => [search_hit("Q306138", "Federation source")]
    })

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      first = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      assert_equal "ok", first.fetch("status")
      assert_equal 1, first.fetch("result").fetch("concept_results").first.fetch("candidates").length

      second = cli.exchange("discover", { "concept_ids" => ["federation-source"] }, run_id: opened.fetch("run_id"))
      discovery = second.fetch("result")
      omitted_concept = discovery.fetch("concept_results").find { |entry| entry.fetch("concept_id") == "federation-source" }
      coverage = discovery.fetch("coverage")

      assert_equal(
        { "global" => "partial", "concept" => "partial_or_unprocessed", "reason" => "ENTITY_LIMIT", "omitted_count" => 1, "omitted_ids" => ["federation-source"] },
        {
          "global" => second.fetch("status"),
          "concept" => %w[partial unprocessed].include?(omitted_concept.fetch("status")) ? "partial_or_unprocessed" : omitted_concept.fetch("status"),
          "reason" => omitted_concept.fetch("reason_code"),
          "omitted_count" => coverage.fetch("omitted_count"),
          "omitted_ids" => coverage.fetch("omitted_ids")
        },
        "a known hit skipped at the run entity cap is not a genuine no-match; discovery coverage identifies concepts, not unexposed QIDs"
      )
    end
  end

  def test_discover_distinguishes_api_error_from_missing_entity_and_retains_prior_candidate
    @http.configure(
      search_by_label: {
        "zsh" => [search_hit("Q227308", "Z shell"), search_hit("Q306138", "Later API error")],
        "federation-source" => [search_hit("Q888888", "Missing entity")]
      },
      entity_overrides: {
        "Q306138" => { "error" => { "code" => "fixture-error", "info" => "programmed HTTP 200 API error" } },
        "Q888888" => { "entities" => { "Q888888" => { "id" => "Q888888", "missing" => "" } } }
      }
    )

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => %w[zsh federation-source] }, run_id: opened.fetch("run_id"))
      result = response.fetch("result")
      zsh = result.fetch("concept_results").find { |entry| entry.fetch("concept_id") == "zsh" }
      federation = result.fetch("concept_results").find { |entry| entry.fetch("concept_id") == "federation-source" }

      assert_equal(
        { "status" => "partial", "error_code" => "API_ERROR", "zsh_status" => "partial", "zsh_qids" => ["Q227308"], "federation_status" => "no_match" },
        {
          "status" => response.fetch("status"),
          "error_code" => response.dig("error", "code"),
          "zsh_status" => zsh.fetch("status"),
          "zsh_qids" => zsh.fetch("candidates").map { |candidate| candidate.fetch("qid") },
          "federation_status" => federation.fetch("status")
        },
        "an API error is not a missing entity, and earlier useful candidate data must survive"
      )
      evidence_ids = result.fetch("evidence").map { |entry| entry.fetch("evidence_id") }
      assert zsh.fetch("candidates").first.fetch("evidence_ids").all? { |id| evidence_ids.include?(id) }
    end
  end

  def test_discover_reports_genuine_search_no_match_without_omission
    @http.configure(search_by_label: { "zsh" => [] })

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      concept_result = response.fetch("result").fetch("concept_results").first
      coverage = response.fetch("result").fetch("coverage")

      assert_equal "no_match", response.fetch("status")
      assert_equal "no_match", concept_result.fetch("status")
      assert_empty concept_result.fetch("candidates")
      assert_equal 0, coverage.fetch("omitted_count")
      assert_empty coverage.fetch("omitted_ids")
    end
  end

  def test_discover_preserves_candidate_when_request_budget_expires_mid_batch
    configure_limits("http_requests" => 2)
    @http.configure(search_by_label: { "zsh" => [search_hit("Q227308", "Z shell"), search_hit("Q306138", "Second hit")] })

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      result = response.fetch("result")
      concept_result = result.fetch("concept_results").first

      assert_equal(
        { "status" => "partial", "error" => "RETRIEVAL_BUDGET_EXHAUSTED", "concept" => "partial", "qids" => ["Q227308"], "requests" => 2 },
        {
          "status" => response.fetch("status"),
          "error" => response.dig("error", "code"),
          "concept" => concept_result.fetch("status"),
          "qids" => concept_result.fetch("candidates").map { |candidate| candidate.fetch("qid") },
          "requests" => @http.requests.length
        },
        "useful candidates survive later budget exhaustion, without issuing a third HTTP request"
      )
      evidence_ids = result.fetch("evidence").map { |entry| entry.fetch("evidence_id") }
      assert concept_result.fetch("candidates").first.fetch("evidence_ids").all? { |id| evidence_ids.include?(id) }
    end
  end

  def test_discover_preserves_candidate_when_later_request_times_out
    configure_limits("retrieval_ms" => 350)
    @http.configure(
      search_by_label: { "zsh" => [search_hit("Q227308", "Z shell"), search_hit("Q306138", "Slow hit")] },
      delay_by_entity: { "Q306138" => 1.5 }
    )

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      result = response.fetch("result")
      concept_result = result.fetch("concept_results").first

      assert_equal(
        { "status" => "partial", "error" => "RETRIEVAL_TIMEOUT", "concept" => "partial", "qids" => ["Q227308"] },
        {
          "status" => response.fetch("status"),
          "error" => response.dig("error", "code"),
          "concept" => concept_result.fetch("status"),
          "qids" => concept_result.fetch("candidates").map { |candidate| candidate.fetch("qid") }
        },
        "useful candidates survive a later local fake-endpoint timeout"
      )
      evidence_ids = result.fetch("evidence").map { |entry| entry.fetch("evidence_id") }
      assert concept_result.fetch("candidates").first.fetch("evidence_ids").all? { |id| evidence_ids.include?(id) }
    end
  end

  def test_expand_admits_only_run_budgeted_qid_endpoints_across_hops_and_directions
    configure_limits("entities" => 3, "candidates_per_concept" => 1, "arcs" => 10)
    seed = "http://www.wikidata.org/entity/Q227308"
    first_neighbor = "http://www.wikidata.org/entity/Q306138"
    reverse_neighbor = "http://www.wikidata.org/entity/Q888888"
    @http.configure(
      search_by_label: { "zsh" => [search_hit("Q227308", "Z shell")] },
      sparql_by_seed: {
        seed => wdqs_response(
          wdqs_edge("Q227308", "Q306138", "forward"),
          wdqs_edge("Q227308", "Q888888", "reverse")
        ),
        first_neighbor => wdqs_response(
          wdqs_edge("Q306138", "Q999999", "forward"),
          wdqs_edge("Q306138", "Q777777", "reverse"),
          wdqs_edge("Q888888", "Q666666", "forward"),
          wdqs_edge("Q888888", "Q555555", "reverse"),
          wdqs_literal_edge("Q306138", "literal endpoint")
        )
      }
    )

    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      response = cli.exchange("expand", { "selections" => [selection_for(candidate, hop: 2)] }, run_id: opened.fetch("run_id"))
      graph = response.fetch("result")
      coverage = graph.fetch("coverage")
      allowed_qids = %w[Q227308 Q306138 Q888888].map { |qid| "http://www.wikidata.org/entity/#{qid}" }
      graph_qids = graph.fetch("arcs").flat_map do |arc|
        [arc.fetch("subject"), arc.fetch("object")].select { |term| term.fetch("type") == "uri" }.map { |term| term.fetch("value") }
      end
      arc_ids = graph.fetch("arcs").map { |arc| arc.fetch("arc_id") }
      evidence_ids = graph.fetch("evidence").map { |entry| entry.fetch("evidence_id") }
      path_arc_ids = graph.fetch("paths").flat_map { |path| path.fetch("steps").map { |step| step.fetch("arc_id") } }

      assert_equal(
        { "status" => "partial", "arcs" => 3, "omitted_count" => 4, "entity_limit" => true, "budget_entities" => 0 },
        {
          "status" => response.fetch("status"),
          "arcs" => graph.fetch("arcs").length,
          "omitted_count" => coverage.fetch("omitted_count"),
          "entity_limit" => coverage.fetch("reason_codes").include?("ENTITY_LIMIT"),
          "budget_entities" => response.fetch("budget_remaining").fetch("entities")
        },
        "only admitted QIDs may be exposed; literal endpoints do not consume entity admission"
      )
      assert (graph_qids - allowed_qids).empty?, "no unadmitted QID endpoint may be exposed"
      assert graph.fetch("arcs").all? { |arc| (arc.fetch("evidence_ids") - evidence_ids).empty? }, "returned arcs must not dangle evidence references"
      assert (path_arc_ids - arc_ids).empty?, "returned paths must reference returned arcs only"
      refute (coverage.fetch("omitted_ids") & (arc_ids + evidence_ids + path_arc_ids)).any?, "omitted IDs are not selectable returned records"
      assert_equal 0, response.fetch("budget_remaining").fetch("entities")
    end
  end

  def test_expand_enforces_arc_cap_across_distinct_batches
    configure_limits("arcs" => 1)

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      discovered = cli.exchange("discover", { "concept_ids" => %w[zsh federation-source] }, run_id: opened.fetch("run_id"))
      candidates = discovered.fetch("result").fetch("concept_results").flat_map { |item| item.fetch("candidates") }
      zsh = candidates.find { |candidate| candidate.fetch("concept_id") == "zsh" && candidate.fetch("qid") == "Q227308" }
      federation = candidates.find { |candidate| candidate.fetch("concept_id") == "federation-source" && candidate.fetch("qid") == "Q306138" }
      first = cli.exchange("expand", { "selections" => [selection_for(zsh)] }, run_id: opened.fetch("run_id"))
      second = cli.exchange("expand", { "selections" => [selection_for(federation)] }, run_id: opened.fetch("run_id"))
      second_graph = second.fetch("result")
      coverage = second_graph.fetch("coverage")

      assert_equal 1, first.fetch("result").fetch("arcs").length
      assert_equal(
        { "status" => "partial", "arcs" => 0, "omitted_count" => 0, "omitted_ids" => [], "omitted_ids_complete" => false, "reason_codes" => ["ARC_LIMIT"] },
        {
          "status" => second.fetch("status"),
          "arcs" => second_graph.fetch("arcs").length,
          "omitted_count" => coverage.fetch("omitted_count"),
          "omitted_ids" => coverage.fetch("omitted_ids"),
          "omitted_ids_complete" => coverage.fetch("omitted_ids_complete"),
          "reason_codes" => coverage.fetch("reason_codes")
        },
        "a later batch cannot extend the run arc budget or invent a tail count"
      )
    end
  end

  def test_expand_marks_reached_arc_limit_partial_without_fabricating_tail_count
    configure_limits("arcs" => 1)
    @http.configure(search_by_label: { "zsh" => [search_hit("Q227308", "Z shell")] })

    with_cli do |cli|
      opened, candidate = open_and_discover_zsh(cli)
      response = cli.exchange("expand", { "selections" => [selection_for(candidate)] }, run_id: opened.fetch("run_id"))
      graph = response.fetch("result")
      coverage = graph.fetch("coverage")

      assert_equal(
        { "status" => "partial", "arcs" => 1, "returned_count" => 1, "omitted_count" => 0, "omitted_ids" => [], "omitted_ids_complete" => false, "reason_codes" => ["ARC_LIMIT"] },
        {
          "status" => response.fetch("status"),
          "arcs" => graph.fetch("arcs").length,
          "returned_count" => coverage.fetch("returned_count"),
          "omitted_count" => coverage.fetch("omitted_count"),
          "omitted_ids" => coverage.fetch("omitted_ids"),
          "omitted_ids_complete" => coverage.fetch("omitted_ids_complete"),
          "reason_codes" => coverage.fetch("reason_codes")
        },
        "reaching LIMIT signals possible incompleteness, not a fabricated omitted tail"
      )
      evidence_ids = graph.fetch("evidence").map { |entry| entry.fetch("evidence_id") }
      assert graph.fetch("arcs").all? { |arc| (arc.fetch("evidence_ids") - evidence_ids).empty? }
    end
  end

  def test_validate_and_close_remain_local_after_retrieval_budget_exhaustion
    configure_limits("http_requests" => 1)

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      discovery = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      assert_equal "unavailable", discovery.fetch("status")
      requests_after_exhaustion = @http.requests.length
      validated = cli.exchange("validate", {
        "proposed_document" => @original_bytes.dup.force_encoding(Encoding::UTF_8),
        "acknowledged_snapshot_id" => opened.fetch("result").fetch("snapshot_id"),
        "decisions" => [
          { "concept_id" => "zsh", "type" => "preserve_existing" },
          { "concept_id" => "federation-source", "type" => "preserve_existing" }
        ]
      }, run_id: opened.fetch("run_id"))
      closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))

      assert_equal "ok", validated.fetch("status")
      assert_equal true, validated.fetch("result").fetch("accepted")
      assert_equal "ok", closed.fetch("status")
      assert_equal true, closed.fetch("result").fetch("closed")
      assert_equal requests_after_exhaustion, @http.requests.length, "validate and close must not make further HTTP requests"
      assert_equal @original_bytes, File.binread(@post_file), "local validation is read-only"
    end
  end

  def test_429_and_503_honor_full_twelve_second_retry_after_and_count_failed_attempts
    configure_limits("retrieval_ms" => 30_000, "http_requests" => 8, "retries_per_request" => 1, "entities" => 2)
    @http.configure(
      search_by_label: {
        "zsh" => [search_hit("Q227308", "Z shell")],
        "federation-source" => [search_hit("Q306138", "Federation source")]
      },
      rate_limits_by_search: {
        "zsh" => { status: 429, retry_after: "12" },
        "federation-source" => { status: 503, retry_after: "12" }
      }
    )
    activate_virtual_retry_clock

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      discovery = cli.exchange("discover", { "concept_ids" => %w[zsh federation-source] }, run_id: opened.fetch("run_id"))
      closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))
      events = virtual_retry_events
      search_attempts = wikidata_search_attempts
      actual = {
        "status" => discovery.fetch("status"),
        "waits" => events.map { |event| event.fetch(:requested) },
        "effective_waits" => events.map { |event| event.fetch(:after) - event.fetch(:before) >= event.fetch(:requested) },
        "search_attempts" => search_attempts,
        "http_requests" => @http.requests.length,
        "http_budget_remaining" => discovery.fetch("budget_remaining").fetch("http_requests"),
        "retrieval_ms_used_at_least_24000" => closed.fetch("result").fetch("retrieval_ms_used") >= 24_000
      }

      assert_equal(
        { "status" => "ok", "waits" => [12.0, 12.0], "effective_waits" => [true, true],
          "search_attempts" => { "zsh" => 2, "federation-source" => 2 }, "http_requests" => 6,
          "http_budget_remaining" => 2, "retrieval_ms_used_at_least_24000" => true },
        actual,
        "429 and 503 Retry-After values must be fully honored and counted against active time and HTTP budget; " \
          "clock events=#{events.inspect}, retrieval_ms_used=#{closed.fetch("result").fetch("retrieval_ms_used")}, attempts=#{search_attempts.inspect}"
      )
    end
  end

  def test_retry_after_longer_than_remaining_budget_is_not_shortened
    configure_limits("retrieval_ms" => 20_000, "http_requests" => 8, "retries_per_request" => 1)
    @http.configure(
      search_by_label: { "zsh" => [search_hit("Q227308", "Z shell")] },
      rate_limits_by_search: { "zsh" => { status: 429, retry_after: "120" } }
    )
    activate_virtual_retry_clock

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      attempts = wikidata_search_attempts
      actual = {
        "status" => response.fetch("status"),
        "error" => response.dig("error", "code"),
        "search_attempts" => attempts.fetch("zsh", 0),
        "waits" => virtual_retry_events.map { |event| event.fetch(:requested) }
      }

      assert_equal(
        { "status" => "unavailable", "error" => "RETRIEVAL_TIMEOUT", "search_attempts" => 1, "waits" => [] },
        actual,
        "a 120-second Retry-After cannot be shortened to fit a 20-second retrieval budget"
      )
    end
  end

  def test_compatible_numeric_and_http_date_retry_after_use_full_controlled_waits
    epoch = Time.utc(2025, 1, 1, 0, 0, 0).to_i
    configure_limits("retrieval_ms" => 20_000, "http_requests" => 8, "retries_per_request" => 1, "entities" => 2)
    @http.configure(
      search_by_label: {
        "zsh" => [search_hit("Q227308", "Z shell")],
        "federation-source" => [search_hit("Q306138", "Federation source")]
      },
      rate_limits_by_search: {
        "zsh" => { status: 429, retry_after: "2" },
        "federation-source" => { status: 503, retry_after: Time.at(epoch + 5).utc.httpdate }
      }
    )
    activate_virtual_retry_clock(epoch)

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => %w[zsh federation-source] }, run_id: opened.fetch("run_id"))
      events = virtual_retry_events

      assert_equal "ok", response.fetch("status")
      assert_equal [2.0, 3.0], events.map { |event| event.fetch(:requested) }, "HTTP-date is interpreted against the controlled wall clock after the first wait"
      assert events.all? { |event| event.fetch(:after) - event.fetch(:before) >= event.fetch(:requested) },
        "monotonic time must advance by each complete wait: #{events.inspect}"
      assert_equal({ "zsh" => 2, "federation-source" => 2 }, wikidata_search_attempts)
    end
  end

  def test_absent_and_invalid_retry_after_use_at_least_five_second_fallback
    configure_limits("retrieval_ms" => 30_000, "http_requests" => 8, "retries_per_request" => 1, "entities" => 2)
    @http.configure(
      search_by_label: {
        "zsh" => [search_hit("Q227308", "Z shell")],
        "federation-source" => [search_hit("Q306138", "Federation source")]
      },
      rate_limits_by_search: {
        "zsh" => { status: 429 },
        "federation-source" => { status: 503, retry_after: "not-a-date" }
      }
    )
    activate_virtual_retry_clock

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => %w[zsh federation-source] }, run_id: opened.fetch("run_id"))
      waits = virtual_retry_events.map { |event| event.fetch(:requested) }

      assert_equal "ok", response.fetch("status")
      assert_equal 2, waits.length
      assert waits.all? { |wait| wait >= 5 }, "fallback waits must be at least five seconds; observed #{waits.inspect}"
    end
  end

  def test_failed_retry_attempt_consumes_the_cumulative_http_budget
    configure_limits("retrieval_ms" => 10_000, "http_requests" => 1, "retries_per_request" => 2)
    @http.configure(
      search_by_label: { "zsh" => [search_hit("Q227308", "Z shell")] },
      rate_limits_by_search: { "zsh" => { status: 429, retry_after: "2" } }
    )
    activate_virtual_retry_clock

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))

      assert_equal "unavailable", response.fetch("status")
      assert_equal "RETRIEVAL_BUDGET_EXHAUSTED", response.dig("error", "code")
      assert_equal 1, wikidata_search_attempts.fetch("zsh", 0), "the failed first attempt consumes the only run HTTP request"
      assert_equal 0, response.fetch("budget_remaining").fetch("http_requests")
      assert_equal [2.0], virtual_retry_events.map { |event| event.fetch(:requested) }
    end
  end

  def test_fractional_and_exponent_retry_after_values_are_invalid_and_use_fallback
    configure_limits("retrieval_ms" => 30_000, "http_requests" => 8, "retries_per_request" => 1, "entities" => 2)
    @http.configure(
      search_by_label: {
        "zsh" => [search_hit("Q227308", "Z shell")],
        "federation-source" => [search_hit("Q306138", "Federation source")]
      },
      rate_limits_by_search: {
        "zsh" => { status: 429, retry_after: "0.5" },
        "federation-source" => { status: 503, retry_after: "1e0" }
      }
    )
    activate_virtual_retry_clock

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => %w[zsh federation-source] }, run_id: opened.fetch("run_id"))
      waits = virtual_retry_events.map { |event| event.fetch(:requested) }

      assert_equal "ok", response.fetch("status")
      assert_equal 2, waits.length
      assert waits.all? { |wait| wait >= 5 },
        "fractional and exponent-form Retry-After are invalid; fallback waits observed=#{waits.inspect}"
      assert_equal({ "zsh" => 2, "federation-source" => 2 }, wikidata_search_attempts)
    end
  end

  def test_huge_valid_integer_retry_after_exceeding_budget_stops_without_sleep_or_retry
    configure_limits("retrieval_ms" => 20_000, "http_requests" => 8, "retries_per_request" => 1)
    @http.configure(
      search_by_label: { "zsh" => [search_hit("Q227308", "Z shell")] },
      rate_limits_by_search: { "zsh" => { status: 429, retry_after: "9" * 400 } }
    )
    activate_virtual_retry_clock

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      actual = {
        "status" => response.fetch("status"),
        "error" => response.dig("error", "code"),
        "search_attempts" => wikidata_search_attempts.fetch("zsh", 0),
        "waits" => virtual_retry_events.map { |event| event.fetch(:requested) }
      }

      assert_equal(
        { "status" => "unavailable", "error" => "RETRIEVAL_TIMEOUT", "search_attempts" => 1, "waits" => [] },
        actual,
        "a valid large integer delay must remain larger than the remaining budget, not overflow into fallback"
      )
    end
  end

  def test_protocol_version_two_is_fatal_exit_two_and_does_not_process_following_frame
    with_cli do |cli|
      cli.send_raw_frames(
        JSON.generate(open_request("version-two", protocol_version: 2)) + "\n",
        JSON.generate(open_request("following-valid")) + "\n"
      )
      cli.close_input
      cli.read_stdout_until_eof
      status = cli.wait_for_exit(timeout: 3)
      frames = parse_complete_protocol_lines(cli.stdout_lines)
      fatal = frames.first || {}
      actual = {
        "child_exit" => status&.exitstatus,
        "was_signaled" => status&.signaled?,
        "output_frames" => frames.length,
        "fatal_status" => fatal["status"],
        "fatal_error" => fatal.dig("error", "code"),
        "fatal_request_id" => fatal["request_id"],
        "fatal_operation" => fatal["operation"],
        "child_was_killed_for_cleanup" => cli.cleanup_killed?
      }

      assert_equal(
        { "child_exit" => 2, "was_signaled" => false, "output_frames" => 1, "fatal_status" => "invalid_request",
          "fatal_error" => "PROTOCOL_FATAL", "fatal_request_id" => "version-two", "fatal_operation" => "open",
          "child_was_killed_for_cleanup" => false },
        actual,
        "protocol version 2 is fatal and must stop before the following frame; recovered fields are echoed per docs §250"
      )
      assert_operator cli.stdout_bytes, :>, 0
    end
  end

  def test_normal_close_has_child_exit_zero_without_cleanup_kill
    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))
      cli.close_input
      cli.read_stdout_until_eof
      status = cli.wait_for_exit(timeout: 3)

      assert_equal true, closed.dig("result", "closed")
      assert_equal 0, status&.exitstatus
      refute status&.signaled?
      refute cli.cleanup_killed?
      assert_equal 2, parse_complete_protocol_lines(cli.stdout_lines).length
      assert_equal cli.stdout_lines.sum(&:bytesize), cli.stdout_bytes
    end
  end

  def test_protocol_version_float_one_is_not_accepted_as_integer_one
    with_cli do |cli|
      cli.send_raw_frames(
        JSON.generate(open_request("float-version", protocol_version: 1.0)) + "\n",
        JSON.generate(open_request("following-valid")) + "\n"
      )
      cli.close_input
      cli.read_stdout_until_eof
      status = cli.wait_for_exit(timeout: 3)
      frames = parse_complete_protocol_lines(cli.stdout_lines)
      fatal = frames.first || {}
      actual = {
        "child_exit" => status&.exitstatus,
        "was_signaled" => status&.signaled?,
        "output_frames" => frames.length,
        "fatal_status" => fatal["status"],
        "fatal_error" => fatal.dig("error", "code"),
        "fatal_request_id" => fatal["request_id"],
        "fatal_operation" => fatal["operation"],
        "child_was_killed_for_cleanup" => cli.cleanup_killed?
      }

      assert_equal(
        { "child_exit" => 2, "was_signaled" => false, "output_frames" => 1, "fatal_status" => "invalid_request",
          "fatal_error" => "PROTOCOL_FATAL", "fatal_request_id" => "float-version", "fatal_operation" => "open",
          "child_was_killed_for_cleanup" => false },
        actual,
        "JSON 1.0 is not the protocol's integer version 1; recoverable fields are echoed per docs §250"
      )
      assert_operator cli.stdout_bytes, :>, 0
    end
  end

  def test_missing_protocol_version_is_fatal_and_does_not_process_following_frame
    with_cli do |cli|
      missing_version = open_request("missing-version")
      missing_version.delete("protocol_version")
      cli.send_raw_frames(
        JSON.generate(missing_version) + "\n",
        JSON.generate(open_request("following-valid")) + "\n"
      )
      cli.close_input
      cli.read_stdout_until_eof
      status = cli.wait_for_exit(timeout: 3)
      frames = parse_complete_protocol_lines(cli.stdout_lines)
      fatal = frames.first || {}
      actual = {
        "child_exit" => status&.exitstatus,
        "output_frames" => frames.length,
        "fatal_status" => fatal["status"],
        "fatal_error" => fatal.dig("error", "code"),
        "fatal_request_id" => fatal["request_id"],
        "fatal_operation" => fatal["operation"],
        "child_was_killed_for_cleanup" => cli.cleanup_killed?
      }

      assert_equal(
        { "child_exit" => 2, "output_frames" => 1, "fatal_status" => "invalid_request", "fatal_error" => "PROTOCOL_FATAL",
          "fatal_request_id" => "missing-version", "fatal_operation" => "open", "child_was_killed_for_cleanup" => false },
        actual,
        "missing version is fatal; the parseable request ID/operation are recoverable and echoed"
      )
    end
  end

  def test_unexpected_internal_exception_has_exit_three_and_redacted_diagnostic
    activate_internal_exception_injection

    with_cli do |cli|
      cli.send_raw_frames(JSON.generate(open_request("internal-failure")) + "\n")
      cli.close_input
      cli.read_stdout_until_eof
      status = cli.wait_for_exit(timeout: 3)
      actual = {
        "child_exit" => status&.exitstatus,
        "was_signaled" => status&.signaled?,
        "cleanup_killed_child" => cli.cleanup_killed?,
        "diagnostic_present" => !cli.stderr_text.to_s.empty?,
        "injected_marker_leaked" => cli.stderr_text.to_s.include?(INTERNAL_ERROR_MARKER),
        "stack_trace_leaked" => cli.stderr_text.to_s.match?(/(?:wikidata-oracle\.rb:\d+|Traceback|from .*_scripts)/),
        "stdout_frames" => cli.stdout_lines.length
      }

      assert_equal(
        { "child_exit" => 3, "was_signaled" => false, "cleanup_killed_child" => false,
          "diagnostic_present" => true, "injected_marker_leaked" => false, "stack_trace_leaked" => false, "stdout_frames" => 0 },
        actual,
        "test-only injected exception must take the internal-error exit path without exposing its message"
      )
    end
  end

  def test_expired_validate_precedence_report_finalization_and_child_exit
    configure_limits("retrieval_ms" => 30_000, "http_requests" => 8, "retries_per_request" => 1)
    @http.configure(
      search_by_label: { "zsh" => [search_hit("Q227308", "Z shell")] },
      rate_limits_by_search: { "zsh" => { status: 429, retry_after: "12" } }
    )
    activate_virtual_retry_clock

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      discovery = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      snapshot_id = opened.fetch("result").fetch("snapshot_id")
      invalid_decisions = [
        { "concept_id" => "zsh", "type" => "preserve_existing" },
        { "concept_id" => "federation-source", "type" => "preserve_existing" }
      ]
      invalid_request = cli.exchange("validate", {
        "proposed_document" => 42,
        "acknowledged_snapshot_id" => snapshot_id,
        "decisions" => invalid_decisions
      }, run_id: opened.fetch("run_id"))
      proposed = @original_bytes.sub("helps manage commands", "changed body after expiry").force_encoding(Encoding::UTF_8)
      wrong_but_wellformed_ack = "0" * 64
      assert_match(/\A[0-9a-f]{64}\z/, wrong_but_wellformed_ack)
      expired_validation = cli.exchange("validate", {
        "proposed_document" => proposed,
        "acknowledged_snapshot_id" => wrong_but_wellformed_ack,
        "decisions" => invalid_decisions
      }, run_id: opened.fetch("run_id"))
      report = expired_validation["result"].is_a?(Hash) ? expired_validation.fetch("result") : {}
      snapshot_check = Array(report["checks"]).find { |check| check.fetch("name") == "snapshot" }
      after_finalization = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))
      cli.close_input
      cli.read_stdout_until_eof
      child_status = cli.wait_for_exit(timeout: 3)
      actual = {
        "initial_discovery" => discovery.fetch("status"),
        "invalid_validate_status" => invalid_request.fetch("status"),
        "invalid_validate_error" => invalid_request.dig("error", "code"),
        "expired_validate_status" => expired_validation.fetch("status"),
        "expired_validate_error" => expired_validation.dig("error", "code"),
        "report_structured" => !report.empty? && report["checks"].is_a?(Array),
        "accepted" => report["accepted"],
        "assurance" => report["assurance"],
        "proposed_sha256" => report["proposed_sha256"],
        "proposed_size_bytes" => report["proposed_size_bytes"],
        "target_sha256" => report.dig("target", "sha256"),
        "wellformed_wrong_ack_snapshot_check" => snapshot_check && snapshot_check.fetch("passed"),
        "after_finalize_status" => after_finalization.fetch("status"),
        "after_finalize_error" => after_finalization.dig("error", "code"),
        "close_outcome" => closed.dig("result", "validation_outcome"),
        "child_exit" => child_status&.exitstatus,
        "child_was_killed_for_cleanup" => cli.cleanup_killed?,
        "http_requests_unchanged_after_discovery" => @http.requests.length == 3,
        "target_unchanged" => File.binread(@post_file) == @original_bytes
      }

      assert_equal(
        { "initial_discovery" => "ok", "invalid_validate_status" => "invalid_request", "invalid_validate_error" => "INVALID_INPUT",
          "expired_validate_status" => "invalidated", "expired_validate_error" => "STATE_EXPIRED", "report_structured" => true,
          "accepted" => false, "assurance" => "none", "proposed_sha256" => Digest::SHA256.hexdigest(proposed.b),
          "proposed_size_bytes" => proposed.bytesize, "target_sha256" => Digest::SHA256.hexdigest(@original_bytes),
          "wellformed_wrong_ack_snapshot_check" => false,
          "after_finalize_status" => "invalid_request", "after_finalize_error" => "INVALID_STATE", "close_outcome" => "invalidated",
          "child_exit" => 0, "child_was_killed_for_cleanup" => false, "http_requests_unchanged_after_discovery" => true, "target_unchanged" => true },
        actual,
        "invalid_request precedes expired state, while a well-formed expired validation finalizes as invalidated and permits only close"
      )
    end
  end

  def test_expired_validate_rejects_missing_snapshot_ack_without_consuming_attempt
    actual = expired_acknowledgement_observation(:missing)

    assert_equal expired_acknowledgement_expectation, actual,
      "missing acknowledged_snapshot_id is invalid input even after TTL expiry; it must not consume the validation attempt"
  end

  def test_expired_validate_rejects_nonstring_snapshot_ack_without_consuming_attempt
    actual = expired_acknowledgement_observation(:nonstring)

    assert_equal expired_acknowledgement_expectation, actual,
      "non-string acknowledged_snapshot_id is invalid input even after TTL expiry; it must not consume the validation attempt"
  end

  def test_expired_validate_rejects_malformed_snapshot_ack_using_documented_sha256_shape
    actual = expired_acknowledgement_observation(:malformed)

    assert_equal expired_acknowledgement_expectation, actual,
      "acknowledged_snapshot_id must use the documented 64-character lowercase SHA-256 form before TTL handling"
  end

  def test_unexpected_exception_inside_validation_is_internal_process_failure
    activate_validation_exception_injection

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      request = {
        "protocol_version" => 1, "request_id" => "validate-injected-error", "operation" => "validate",
        "run_id" => opened.fetch("run_id"),
        "input" => {
          "proposed_document" => @original_bytes.dup.force_encoding(Encoding::UTF_8),
          "acknowledged_snapshot_id" => opened.fetch("result").fetch("snapshot_id"),
          "decisions" => [
            { "concept_id" => "zsh", "type" => "preserve_existing" },
            { "concept_id" => "federation-source", "type" => "preserve_existing" }
          ]
        }
      }
      cli.send_raw_frames(JSON.generate(request) + "\n")
      cli.close_input
      cli.read_stdout_until_eof
      status = cli.wait_for_exit(timeout: 3)
      frames = parse_complete_protocol_lines(cli.stdout_lines)
      validation_frame = frames.find { |frame| frame["operation"] == "validate" } || {}
      actual = {
        "child_exit" => status&.exitstatus,
        "operations_emitted" => frames.map { |frame| frame["operation"] },
        "validation_status" => validation_frame["status"],
        "validation_error" => validation_frame.dig("error", "code"),
        "diagnostic_present" => !cli.stderr_text.to_s.empty?,
        "injected_marker_leaked" => cli.stderr_text.to_s.include?(INTERNAL_ERROR_MARKER),
        "stack_trace_leaked" => cli.stderr_text.to_s.match?(/(?:wikidata-oracle\.rb:\d+|Traceback|from .*_scripts)/),
        "child_was_killed_for_cleanup" => cli.cleanup_killed?
      }

      assert_equal(
        { "child_exit" => 3, "operations_emitted" => ["open"], "validation_status" => nil, "validation_error" => nil,
          "diagnostic_present" => true,
          "injected_marker_leaked" => false, "stack_trace_leaked" => false, "child_was_killed_for_cleanup" => false },
        actual,
        "unexpected validation runtime failure must not be downgraded to DOCUMENT_UNSUPPORTED or emit a validation response"
      )
    end
  end

  def test_safe_validation_errors_for_malformed_unsafe_and_aliased_yaml_remain_controlled
    cases = {
      "malformed" => @original_bytes.sub(
        "title: \"Offline Wikidata oracle fixture\"",
        "title: [T10_YAML_MALFORMED"
      ),
      "disallowed_class" => @original_bytes.sub(
        "title: \"Offline Wikidata oracle fixture\"",
        "title: \"Offline Wikidata oracle fixture\"\nunsafe: !ruby/object:Object { marker: T10_YAML_CLASS }"
      ),
      "disabled_alias" => @original_bytes.sub(
        "title: \"Offline Wikidata oracle fixture\"",
        "title: \"Offline Wikidata oracle fixture\"\nanchor: &T10_YAML_ALIAS safe\nalias: *T10_YAML_ALIAS"
      )
    }
    observations = {}

    cases.each do |name, proposed_bytes|
      with_cli do |cli|
        opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
        response = cli.exchange("validate", {
          "proposed_document" => proposed_bytes.dup.force_encoding(Encoding::UTF_8),
          "acknowledged_snapshot_id" => opened.fetch("result").fetch("snapshot_id"),
          "decisions" => [
            { "concept_id" => "zsh", "type" => "preserve_existing" },
            { "concept_id" => "federation-source", "type" => "preserve_existing" }
          ]
        }, run_id: opened.fetch("run_id"))
        report = response["result"].is_a?(Hash) ? response.fetch("result") : {}
        closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))
        cli.close_input
        cli.read_stdout_until_eof
        child_status = cli.wait_for_exit(timeout: 3)
        serialized = JSON.generate(response)
        observations[name] = {
          "status" => response.fetch("status"),
          "error" => response.dig("error", "code"),
          "report_structured" => !report.empty? && report["checks"].is_a?(Array),
          "accepted" => report["accepted"],
          "assurance" => report["assurance"],
          "source_marker_leaked" => %w[T10_YAML_MALFORMED T10_YAML_CLASS T10_YAML_ALIAS].any? { |marker| serialized.include?(marker) },
          "close_outcome" => closed.dig("result", "validation_outcome"),
          "child_exit" => child_status&.exitstatus,
          "child_killed_for_cleanup" => cli.cleanup_killed?,
          "target_unchanged" => File.binread(@post_file) == @original_bytes
        }
      end
    end

    expected_case = {
      "status" => "rejected", "error" => "VALIDATION_FAILED", "report_structured" => true,
      "accepted" => false, "assurance" => "none", "source_marker_leaked" => false,
      "close_outcome" => "rejected", "child_exit" => 0, "child_killed_for_cleanup" => false,
      "target_unchanged" => true
    }
    assert_equal expected_case, observations.fetch("malformed")
    assert_equal expected_case, observations.fetch("disallowed_class")
    assert_equal expected_case, observations.fetch("disabled_alias")
  end

  def test_preservation_matching_handles_hundred_concepts_and_distinct_optional_occurrences
    configure_limits("concepts" => 100, "input_line_bytes" => 65_536)
    registry = 100.times.map do |index|
      id = format("c%03d", index)
      { "concept_id" => id, "label" => id, "language" => "en", "context" => "Context #{id}." }
    end
    subset = "  - concept: c000\n    sameAs: https://example.org/id/c000\n    importance: required\n    depth: 1\n"
    superset = "  - concept: c000\n    label: Label c000\n    sameAs: https://example.org/id/c000\n    importance: required\n    depth: 1\n"
    other_records = registry.drop(1).map do |concept|
      id = concept.fetch("concept_id")
      "  - concept: #{id}\n    label: Label #{id}\n    sameAs: https://example.org/id/#{id}\n    importance: required\n    depth: 1\n"
    end.join
    body = registry.map { |concept| concept.fetch("context") }.join("\n") + "\n"
    @original_bytes = ("---\ntitle: Matcher scale fixture\ntags: []\nknowledge_prerequisites:\n" + subset + superset + other_records + "---\n" + body).b
    File.binwrite(@post_file, @original_bytes)
    proposed = @original_bytes.sub(subset + superset, superset + subset).force_encoding(Encoding::UTF_8)
    test_limits = JSON.parse(File.read(@limits_file))
    assert_equal 100, test_limits.fetch("concepts")
    assert_equal 65_536, test_limits.fetch("input_line_bytes"), "trusted test override stays below the frozen 1 MiB ceiling"
    assert_operator @original_bytes.bytesize, :<=, test_limits.fetch("document_bytes")
    assert_operator proposed.bytesize, :<=, test_limits.fetch("document_bytes")

    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => registry)
      assert_equal "ok", opened.fetch("status")
      assert_equal 100, opened.fetch("result").fetch("concepts").length
      decisions = registry.map { |concept| { "concept_id" => concept.fetch("concept_id"), "type" => "preserve_existing" } }
      response = cli.exchange("validate", {
        "proposed_document" => proposed,
        "acknowledged_snapshot_id" => opened.fetch("result").fetch("snapshot_id"),
        "decisions" => decisions
      }, run_id: opened.fetch("run_id"))
      report = response.fetch("result")
      checks = report.fetch("checks").to_h { |check| [check.fetch("name"), check.fetch("passed")] }
      closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))
      cli.close_input
      cli.read_stdout_until_eof
      child_status = cli.wait_for_exit(timeout: 3)
      actual = {
        "status" => response.fetch("status"),
        "accepted" => report.fetch("accepted"),
        "all_document_checks_passed" => %w[snapshot target_identity body_bytes frontmatter_scope concept_preservation identity_provenance].all? { |name| checks[name] },
        "proposed_sha256" => report.fetch("proposed_sha256"),
        "proposed_size_bytes" => report.fetch("proposed_size_bytes"),
        "preserved_records" => report.fetch("preserved_identities").length,
        "duplicate_occurrences_preserved" => report.fetch("preserved_identities").count { |identity| identity.fetch("concept_id") == "c000" },
        "target_sha256" => report.fetch("target").fetch("sha256"),
        "close_outcome" => closed.dig("result", "validation_outcome"),
        "child_exit" => child_status&.exitstatus,
        "child_killed_for_cleanup" => cli.cleanup_killed?,
        "target_unchanged" => File.binread(@post_file) == @original_bytes
      }

      assert_equal(
        { "status" => "ok", "accepted" => true, "all_document_checks_passed" => true,
          "proposed_sha256" => Digest::SHA256.hexdigest(proposed.b), "proposed_size_bytes" => proposed.bytesize,
          "preserved_records" => 101, "duplicate_occurrences_preserved" => 2,
          "target_sha256" => Digest::SHA256.hexdigest(@original_bytes), "close_outcome" => "accepted",
          "child_exit" => 0, "child_killed_for_cleanup" => false, "target_unchanged" => true },
        actual,
        "bounded 100-concept validation must preserve every occurrence despite optional-field reassignment"
      )
    end
  end

  def test_fatal_frame_near_stdout_limit_is_complete_or_omitted_without_overflow
    output_limit = 65_537
    configure_limits("output_bytes" => output_limit)

    with_cli do |cli|
      digits = "0123456789abcdefghijklmnopqrstuvwxyz"
      filler_frames = 240.times.map do |index|
        request_id = digits[index / digits.length] + digits[index % digits.length]
        JSON.generate(protocol_request("close", request_id)) + "\n"
      end
      cli.send_raw_frames(*filler_frames)
      assert_equal 240, cli.read_stdout_lines(240, timeout: 5)&.length, "child must emit all bounded terminal frames before the fatal frame"

      fatal_frame = {
        "protocol_version" => 1, "request_id" => nil, "operation" => nil, "run_id" => nil,
        "status" => "invalid_request", "result" => nil,
        "error" => { "code" => "PROTOCOL_FATAL", "message" => "invalid JSONL frame", "retryable" => false,
                     "details" => [], "details_omitted_count" => 0 },
        "warnings" => [], "budget_remaining" => nil
      }
      fatal_frame_bytes = JSON.generate(fatal_frame).bytesize + 1
      remaining_before_fatal = output_limit - cli.stdout_bytes
      assert_equal 65_280, cli.stdout_bytes
      assert_operator remaining_before_fatal, :>, 0
      assert_operator remaining_before_fatal, :<, fatal_frame_bytes, "complete protocol-fatal envelope cannot fit in this remaining space"
      frames_before_fatal = cli.stdout_lines.length

      cli.send_raw_frames("{malformed-json\n")
      cli.close_input
      cli.read_stdout_until_eof
      status = cli.wait_for_exit(timeout: 3)
      complete_lines = cli.stdout_lines.all? do |line|
        line.end_with?("\n") && JSON.parse(line)
      rescue JSON::ParserError
        false
      end
      actual = {
        "child_exit" => status&.exitstatus,
        "stdout_within_limit" => cli.stdout_bytes <= output_limit,
        "stdout_bytes" => cli.stdout_bytes,
        "output_limit" => output_limit,
        "fatal_frame_bytes" => fatal_frame_bytes,
        "bytes_remaining_before_fatal" => remaining_before_fatal,
        "no_extra_fatal_frame" => cli.stdout_lines.length == frames_before_fatal,
        "all_frames_complete_jsonl" => complete_lines,
        "child_was_killed_for_cleanup" => cli.cleanup_killed?
      }

      assert_equal(
        { "child_exit" => 2, "stdout_within_limit" => true, "stdout_bytes" => 65_280, "output_limit" => 65_537,
          "fatal_frame_bytes" => 274, "bytes_remaining_before_fatal" => 257, "no_extra_fatal_frame" => true,
          "all_frames_complete_jsonl" => true, "child_was_killed_for_cleanup" => false },
        actual,
        "a complete fatal frame that cannot fit must be omitted; stdout may not exceed the configured total byte cap"
      )
    end
  end

  private

  def configure_limits(overrides)
    current = JSON.parse(File.read(@limits_file))
    File.write(@limits_file, JSON.generate(current.merge(overrides)))
  end

  def i1_document(semantic: nil, difficulty: nil, prerequisites: nil)
    lines = ["---", "title: I1 authorized-field fixture", "tags:", "  - shell", "  - federation"]
    difficulty_yaml = difficulty || semantic
    lines.concat(difficulty_yaml.lines(chomp: true)) if difficulty_yaml
    lines.concat(prerequisites.lines(chomp: true)) if prerequisites
    (lines + ["---"]).join("\n") + "\nZ shell helps manage commands.\nA federation source supplies data.\n"
  end

  def i1_semantic_yaml(blocking_count:)
    [
      "difficulty_computed:", "  semantic:", "    concept_count: 2", "    concept_density: 1.0",
      "    jargon_ratio: 4.5", "    definition_coverage: 0.5", "    external_knowledge_demand: 1",
      "    prerequisite_depth: 1.5", "    math_density: 0.0", "    code_density: 0.0",
      "    blocking_prerequisite_count: #{blocking_count}"
    ].join("\n")
  end

  def i1_new_prerequisite_yaml
    [
      "knowledge_prerequisites:", "  - concept: zsh", "    label: Z shell",
      "    importance: recommended", "    depth: 1"
    ].join("\n")
  end

  def i1_existing_prerequisites_yaml
    [
      "knowledge_prerequisites:",
      "  - concept: zsh", "    label: Z shell", "    sameAs: https://www.wikidata.org/wiki/Q999999", "    importance: required", "    depth: 1",
      "  - concept: federation-source", "    label: federation source", "    sameAs: https://www.wikidata.org/wiki/Q306138", "    importance: recommended", "    depth: 2"
    ].join("\n")
  end

  def i1_lexical_parent_yaml
    ["difficulty_computed:", "  lexical:", "    gulpease: 70.0", "    word_count: 25"].join("\n")
  end

  def i1_difficulty_with_lexical_and_semantic(blocking_count:)
    lexical_lines = i1_lexical_parent_yaml.lines(chomp: true)
    semantic_lines = i1_semantic_yaml(blocking_count: blocking_count).lines(chomp: true).drop(1)
    (lexical_lines + semantic_lines).join("\n")
  end

  def i1_validate_observation(original, proposed, decisions)
    File.binwrite(@post_file, original)
    @original_bytes = File.binread(@post_file)
    observation = nil
    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      response = cli.exchange("validate", {
        "proposed_document" => proposed.dup.force_encoding(Encoding::UTF_8),
        "acknowledged_snapshot_id" => opened.fetch("result").fetch("snapshot_id"),
        "decisions" => decisions
      }, run_id: opened.fetch("run_id"))
      report = response["result"].is_a?(Hash) ? response.fetch("result") : {}
      closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))
      cli.close_input
      cli.read_stdout_until_eof
      process_status = cli.wait_for_exit(timeout: 3)
      observation = {
        "open_status" => opened.fetch("status"),
        "status" => response.fetch("status"),
        "error" => response.dig("error", "code"),
        "accepted" => report["accepted"],
        "assurance" => report["assurance"],
        "checks" => Array(report["checks"]).to_h { |check| [check.fetch("name"), check.fetch("passed")] },
        "proposed_sha256" => report["proposed_sha256"],
        "proposed_size_bytes" => report["proposed_size_bytes"],
        "target_sha256" => report.dig("target", "sha256"),
        "target_unchanged" => File.binread(@post_file) == original,
        "fake_http_requests" => @http.requests.length,
        "close_outcome" => closed.dig("result", "validation_outcome"),
        "child_exit" => process_status&.exitstatus,
        "child_killed_for_cleanup" => cli.cleanup_killed?
      }
    end
    observation
  end

  def i1_accepted_expectation(original, proposed)
    {
      "open_status" => "ok", "status" => "ok", "error" => nil, "accepted" => true,
      "assurance" => "provenance_and_document_checks",
      "checks" => { "snapshot" => true, "target_identity" => true, "body_bytes" => true,
                    "frontmatter_scope" => true, "concept_preservation" => true, "identity_provenance" => true },
      "proposed_sha256" => Digest::SHA256.hexdigest(proposed.b), "proposed_size_bytes" => proposed.bytesize,
      "target_sha256" => Digest::SHA256.hexdigest(original), "target_unchanged" => true, "fake_http_requests" => 0,
      "close_outcome" => "accepted", "child_exit" => 0, "child_killed_for_cleanup" => false
    }
  end

  def expired_acknowledgement_observation(kind)
    configure_limits("retrieval_ms" => 30_000, "http_requests" => 8, "retries_per_request" => 1)
    @http.configure(
      search_by_label: { "zsh" => [search_hit("Q227308", "Z shell")] },
      rate_limits_by_search: { "zsh" => { status: 429, retry_after: "12" } }
    )
    activate_virtual_retry_clock

    observation = nil
    with_cli do |cli|
      opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
      discovery = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      assert_equal "ok", discovery.fetch("status"), "fixture must expire a live run after useful retrieval"
      snapshot_id = opened.fetch("result").fetch("snapshot_id")
      decisions = [
        { "concept_id" => "zsh", "type" => "preserve_existing" },
        { "concept_id" => "federation-source", "type" => "preserve_existing" }
      ]
      invalid_input = {
        "proposed_document" => @original_bytes.dup.force_encoding(Encoding::UTF_8),
        "decisions" => decisions
      }
      invalid_input["acknowledged_snapshot_id"] = 42 if kind == :nonstring
      invalid_input["acknowledged_snapshot_id"] = "not-a-snapshot-hash" if kind == :malformed
      invalid_ack = cli.exchange("validate", invalid_input, run_id: opened.fetch("run_id"))
      valid_expired = cli.exchange("validate", {
        "proposed_document" => @original_bytes.dup.force_encoding(Encoding::UTF_8),
        "acknowledged_snapshot_id" => snapshot_id,
        "decisions" => decisions
      }, run_id: opened.fetch("run_id"))
      report = valid_expired["result"].is_a?(Hash) ? valid_expired.fetch("result") : {}
      after_finalization = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
      closed = cli.exchange("close", {}, run_id: opened.fetch("run_id"))
      cli.close_input
      cli.read_stdout_until_eof
      child_status = cli.wait_for_exit(timeout: 3)
      observation = {
        "bad_ack_status" => invalid_ack.fetch("status"),
        "bad_ack_error" => invalid_ack.dig("error", "code"),
        "bad_ack_result_nil" => invalid_ack["result"].nil?,
        "followup_validate_status" => valid_expired.fetch("status"),
        "followup_validate_error" => valid_expired.dig("error", "code"),
        "followup_report_structured" => !report.empty? && report["checks"].is_a?(Array),
        "followup_accepted" => report["accepted"],
        "followup_assurance" => report["assurance"],
        "followup_sha256" => report["proposed_sha256"],
        "followup_size" => report["proposed_size_bytes"],
        "followup_target_sha256" => report.dig("target", "sha256"),
        "after_finalization_status" => after_finalization.fetch("status"),
        "after_finalization_error" => after_finalization.dig("error", "code"),
        "close_outcome" => closed.dig("result", "validation_outcome"),
        "http_requests_unchanged_after_discovery" => @http.requests.length == 3,
        "target_unchanged" => File.binread(@post_file) == @original_bytes,
        "child_exit" => child_status&.exitstatus,
        "child_killed_for_cleanup" => cli.cleanup_killed?
      }
    end
    observation
  end

  def expired_acknowledgement_expectation
    {
      "bad_ack_status" => "invalid_request", "bad_ack_error" => "INVALID_INPUT", "bad_ack_result_nil" => true,
      "followup_validate_status" => "invalidated", "followup_validate_error" => "STATE_EXPIRED",
      "followup_report_structured" => true, "followup_accepted" => false, "followup_assurance" => "none",
      "followup_sha256" => Digest::SHA256.hexdigest(@original_bytes), "followup_size" => @original_bytes.bytesize,
      "followup_target_sha256" => Digest::SHA256.hexdigest(@original_bytes),
      "after_finalization_status" => "invalid_request", "after_finalization_error" => "INVALID_STATE",
      "close_outcome" => "invalidated", "http_requests_unchanged_after_discovery" => true,
      "target_unchanged" => true, "child_exit" => 0, "child_killed_for_cleanup" => false
    }
  end

  def search_hit(qid, label)
    { "id" => qid, "label" => label, "description" => "Fixture description for #{qid}", "match" => { "language" => "en", "text" => label } }
  end

  def selection_for(candidate, hop: 1)
    {
      "concept_id" => candidate.fetch("concept_id"),
      "candidate_id" => candidate.fetch("candidate_id"),
      "evidence_ids" => candidate.fetch("evidence_ids"),
      "rationale" => "Selected retrieved candidate for the bounded offline test.",
      "hop" => hop
    }
  end

  def wdqs_uri(qid)
    { "type" => "uri", "value" => "http://www.wikidata.org/entity/#{qid}" }
  end

  def wdqs_edge(item_qid, other_qid, direction)
    item = wdqs_uri(item_qid)
    other = wdqs_uri(other_qid)
    subject, object = direction == "forward" ? [item, other] : [other, item]
    { "item" => item, "property" => { "type" => "uri", "value" => "http://www.wikidata.org/prop/direct/P279" },
      "value" => other, "subject" => subject, "object" => object }
  end

  def wdqs_literal_edge(item_qid, value)
    item = wdqs_uri(item_qid)
    literal = { "type" => "literal", "value" => value, "xml:lang" => "en" }
    { "item" => item, "property" => { "type" => "uri", "value" => "http://www.wikidata.org/prop/direct/P279" },
      "value" => literal, "subject" => item, "object" => literal }
  end

  def wdqs_response(*bindings)
    { "head" => { "vars" => %w[item property value subject object] }, "results" => { "bindings" => bindings } }
  end

  def open_request(request_id, protocol_version: 1)
    { "protocol_version" => protocol_version, "request_id" => request_id, "operation" => "open",
      "input" => { "post_path" => POST_PATH, "concepts" => concepts } }
  end

  def protocol_request(operation, request_id)
    { "protocol_version" => 1, "request_id" => request_id, "operation" => operation, "input" => {} }
  end

  def parse_complete_protocol_lines(lines)
    lines.map do |line|
      assert line.end_with?("\n"), "stdout contained an incomplete JSONL frame: #{line.inspect}"
      JSON.parse(line)
    end
  end

  def activate_internal_exception_injection
    @internal_error_preload = File.join(@scratch, "internal-error-preload.rb")
    File.write(@internal_error_preload, <<~'RUBY')
      trace = TracePoint.new(:end) do |event|
        klass = event.self
        next unless klass.is_a?(Class) && klass.name == "WikidataOracle"

        injection = Module.new do
          define_method(:emit) do |response, terminal: false|
            raise RuntimeError, "T8_TEST_PRIVATE_DIAGNOSTIC_SENTINEL"
          end
          private :emit
        end
        klass.prepend(injection)
        trace.disable
      end
      trace.enable
    RUBY
  end

  def activate_validation_exception_injection
    @validation_error_preload = File.join(@scratch, "validation-error-preload.rb")
    File.write(@validation_error_preload, <<~'RUBY')
      trace = TracePoint.new(:end) do |event|
        klass = event.self
        next unless klass.is_a?(Class) && klass.name == "WikidataOracle"

        injection = Module.new do
          define_method(:frontmatter_scope_equal?) do |original, proposed|
            raise RuntimeError, "T8_TEST_PRIVATE_DIAGNOSTIC_SENTINEL"
          end
          private :frontmatter_scope_equal?
        end
        klass.prepend(injection)
        trace.disable
      end
      trace.enable
    RUBY
  end

  def activate_virtual_retry_clock(epoch = Time.utc(2025, 1, 1, 0, 0, 0).to_i)
    @retry_clock_log = File.join(@scratch, "retry-clock.tsv")
    @retry_clock_preload = File.join(@scratch, "retry-clock-preload.rb")
    File.write(@retry_clock_preload, <<~'RUBY')
      class << Process
        alias_method :wikidata_oracle_real_clock_gettime, :clock_gettime

        def clock_gettime(clock_id, *arguments)
          current = wikidata_oracle_real_clock_gettime(clock_id, *arguments)
          clock_id == Process::CLOCK_MONOTONIC ? current + wikidata_oracle_virtual_seconds : current
        end

        def wikidata_oracle_virtual_seconds
          Thread.current[:wikidata_oracle_virtual_seconds].to_f
        end

        def wikidata_oracle_advance_clock(seconds)
          Thread.current[:wikidata_oracle_virtual_seconds] = wikidata_oracle_virtual_seconds + seconds
        end
      end

      class << Time
        alias_method :wikidata_oracle_real_now, :now

        def now(*arguments)
          epoch = ENV["WIKIDATA_TEST_WALL_EPOCH"]
          return wikidata_oracle_real_now(*arguments) unless epoch

          Time.at(Float(epoch) + Process.wikidata_oracle_virtual_seconds).utc
        end
      end

      module WikidataOracleVirtualRetrySleep
        def sleep(duration = 0)
          return super unless ENV["WIKIDATA_TEST_CLOCK_LOG"]

          requested = Float(duration)
          before = Process.clock_gettime(Process::CLOCK_MONOTONIC)
          Process.wikidata_oracle_advance_clock(requested)
          after = Process.clock_gettime(Process::CLOCK_MONOTONIC)
          wall = Time.now.to_f
          File.open(ENV.fetch("WIKIDATA_TEST_CLOCK_LOG"), "a") do |file|
            file.puts([requested, before, after, wall].join("\t"))
          end
          requested
        end
      end

      Kernel.prepend(WikidataOracleVirtualRetrySleep)
    RUBY
    @retry_clock_epoch = epoch
  end

  def virtual_retry_events
    return [] unless @retry_clock_log && File.file?(@retry_clock_log)

    File.readlines(@retry_clock_log).map do |line|
      requested, before, after, wall = line.split.map(&:to_f)
      { requested: requested, before: before, after: after, wall: wall }
    end
  end

  def wikidata_search_attempts
    @http.requests.each_with_object(Hash.new(0)) do |request, counts|
      uri = URI("http://127.0.0.1#{request}")
      params = URI.decode_www_form(uri.query.to_s).to_h
      counts[params.fetch("search")] += 1 if params["action"] == "wbsearchentities"
    end
  end

  def open_and_discover_zsh(cli)
    opened = cli.exchange("open", "post_path" => POST_PATH, "concepts" => concepts)
    discovery = cli.exchange("discover", { "concept_ids" => ["zsh"] }, run_id: opened.fetch("run_id"))
    candidate = discovery.fetch("result").fetch("concept_results").find { |item| item.fetch("concept_id") == "zsh" }
      .fetch("candidates").find { |item| item.fetch("qid") == "Q227308" }
    refute_nil candidate, "fixture should return the selected zsh candidate"
    [opened, candidate]
  end

  def select_decision(candidate, concept_id = "zsh")
    {
      "concept_id" => concept_id,
      "candidate_id" => candidate.fetch("candidate_id"),
      "evidence_ids" => candidate.fetch("evidence_ids"),
      "rationale" => "The caller selected this retrieved candidate.",
      "proposed_sameAs" => "https://www.wikidata.org/wiki/#{candidate.fetch("qid")}",
      "type" => "select"
    }
  end

  def selection_decisions(candidate)
    [select_decision(candidate), { "concept_id" => "federation-source", "type" => "preserve_existing" }]
  end

  def selected_zsh_proposal(candidate)
    @original_bytes.sub(
      "sameAs: https://www.wikidata.org/wiki/Q999999",
      "sameAs: https://www.wikidata.org/wiki/#{candidate.fetch("qid")}"
    ).force_encoding(Encoding::UTF_8)
  end

  def validate_proposal(cli, opened, proposed, decisions)
    response = cli.exchange("validate", {
      "proposed_document" => proposed.dup.force_encoding(Encoding::UTF_8),
      "acknowledged_snapshot_id" => opened.fetch("result").fetch("snapshot_id"),
      "decisions" => decisions
    }, run_id: opened.fetch("run_id"))
    [response, response.fetch("result")]
  end

  def assert_exact_proposal_report(report, proposed)
    assert_equal Digest::SHA256.hexdigest(proposed.b), report.fetch("proposed_sha256")
    assert_equal proposed.bytesize, report.fetch("proposed_size_bytes")
    assert_equal Digest::SHA256.hexdigest(@original_bytes), report.fetch("target").fetch("sha256")
  end

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
    environment = {}
    preload_paths = [@retry_clock_preload, @internal_error_preload, @validation_error_preload].compact
    unless preload_paths.empty?
      environment["RUBYOPT"] = ([ENV["RUBYOPT"]] + preload_paths.map { |path| "-r#{path}" }).compact.reject(&:empty?).join(" ")
    end
    if @retry_clock_preload
      environment["WIKIDATA_TEST_CLOCK_LOG"] = @retry_clock_log
      environment["WIKIDATA_TEST_WALL_EPOCH"] = @retry_clock_epoch.to_s
    end
    stdin, stdout, stderr, wait_thread = Open3.popen3(environment, *argv)
    client = JsonlClient.new(stdin, stdout, stderr, wait_thread, self)
    yield client
  ensure
    client&.stop
  end

  class JsonlClient
    attr_reader :process_status, :stdout_lines, :stdout_bytes, :stderr_text

    def initialize(stdin, stdout, stderr, wait_thread, assertions)
      @stdin, @stdout, @stderr, @wait_thread = stdin, stdout, stderr, wait_thread
      @assertions = assertions
      @operation_counts = Hash.new(0)
      @stdout_lines = []
      @stdout_bytes = 0
      @stderr_text = ""
      @cleanup_killed = false
    end

    def exchange(operation, input = nil, run_id: nil, **input_fields)
      input ||= input_fields
      @operation_counts[operation] += 1
      request_id = "#{operation}-#{@operation_counts[operation]}"
      request = { "protocol_version" => 1, "request_id" => request_id, "operation" => operation, "input" => input }
      request["run_id"] = run_id if run_id
      exchange_request(request)
    end

    def exchange_request(request)
      @stdin.write(JSON.generate(request) + "\n")
      @stdin.flush
      ready = IO.select([@stdout], nil, nil, 4)
      line = ready && @stdout.gets
      operation = request["operation"].to_s
      operation_label = operation.bytesize > 80 ? "#{operation[0, 40]}...(#{operation.bytesize} bytes)" : operation
      @assertions.assert(line, "CLI emitted no JSONL response for #{operation_label} (exit=#{exit_status}, stdout_bytes=#{@stdout_bytes}, stderr=#{stderr_excerpt})")
      record_stdout(line)
      JSON.parse(line)
    end

    def send_raw_frames(*frames)
      frames.each { |frame| @stdin.write(frame) }
      @stdin.flush
    end

    def close_input
      @stdin.close unless @stdin.closed?
    rescue IOError
      nil
    end

    def read_stdout_until_eof(timeout: 4)
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + timeout
      loop do
        remaining = deadline - Process.clock_gettime(Process::CLOCK_MONOTONIC)
        break unless remaining.positive?
        ready = IO.select([@stdout], nil, nil, remaining)
        break unless ready
        line = @stdout.gets
        break unless line
        record_stdout(line)
      end
      @stdout_lines
    end

    def read_stdout_lines(count, timeout: 5)
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + timeout
      while @stdout_lines.length < count
        remaining = deadline - Process.clock_gettime(Process::CLOCK_MONOTONIC)
        return nil unless remaining.positive?
        ready = IO.select([@stdout], nil, nil, remaining)
        return nil unless ready
        line = @stdout.gets
        return nil unless line
        record_stdout(line)
      end
      @stdout_lines
    end

    def wait_for_exit(timeout: 2)
      return @process_status if @process_status
      return nil unless @wait_thread.join(timeout)

      @process_status = @wait_thread.value
      collect_remaining_stdout
      @stderr_text = @stderr.read unless @stderr.closed?
      @process_status
    rescue IOError
      @process_status
    end

    def cleanup_killed?
      @cleanup_killed
    end

    def stop
      close_input
      unless wait_for_exit(timeout: 2)
        @cleanup_killed = true
        Process.kill("KILL", @wait_thread.pid) if @wait_thread.alive?
        @wait_thread.join(1)
        @process_status = @wait_thread.value unless @wait_thread.alive?
        collect_remaining_stdout
        @stderr_text = @stderr.read unless @stderr.closed?
      end
      @stdout.close unless @stdout.closed?
      @stderr.close unless @stderr.closed?
    rescue Errno::ESRCH, IOError
      nil
    end

    private

    def exit_status
      return @wait_thread.value.exitstatus if @wait_thread.join(0.2)

      "still-running"
    rescue IOError
      "unknown"
    end

    def stderr_excerpt
      @stderr.read_nonblock(2_048, exception: false).to_s
    rescue IOError
      ""
    end

    def record_stdout(line)
      @stdout_lines << line
      @stdout_bytes += line.bytesize
    end

    def collect_remaining_stdout
      while (line = @stdout.gets)
        record_stdout(line)
      end
    rescue IOError
      nil
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
      @plan = { search_by_label: {}, entity_overrides: {}, sparql_by_seed: {}, delay_by_entity: {}, rate_limits_by_search: {} }
      @rate_limit_counts = Hash.new(0)
      @thread = Thread.new { serve }
    end

    def configure(search_by_label: {}, entity_overrides: {}, sparql_by_seed: {}, delay_by_entity: {}, rate_limits_by_search: {})
      @mutex.synchronize do
        @plan = {
          search_by_label: search_by_label,
          entity_overrides: entity_overrides,
          sparql_by_seed: sparql_by_seed,
          delay_by_entity: delay_by_entity,
          rate_limits_by_search: rate_limits_by_search
        }
        @rate_limit_counts = Hash.new(0)
      end
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
      plan = @mutex.synchronize do
        @requests << uri.request_uri
        @plan
      end
      rate_limit = params["action"] == "wbsearchentities" ? consume_rate_limit(params["search"]) : nil
      payload = if rate_limit
        { "error" => { "code" => "fixture-rate-limit", "info" => "programmed fake HTTP retry response" } }
      elsif uri.path == "/sparql"
        sparql_response(params["query"], plan)
      elsif params["action"] == "wbsearchentities"
        search_response(params["search"], plan)
      elsif params["action"] == "wbgetentities"
        entities_response(params["ids"].to_s.split("|"), plan)
      else
        { "error" => { "code" => "unknown_action", "info" => "fake endpoint received an unknown action" } }
      end
      json = JSON.generate(payload)
      status = rate_limit ? rate_limit.fetch(:status) : 200
      status_text = { 429 => "Too Many Requests", 503 => "Service Unavailable" }.fetch(status, "OK")
      retry_after_header = rate_limit && rate_limit[:retry_after] ? "Retry-After: #{rate_limit.fetch(:retry_after)}\r\n" : ""
      socket.write("HTTP/1.1 #{status} #{status_text}\r\nContent-Type: application/json; charset=utf-8\r\n#{retry_after_header}Content-Length: #{json.bytesize}\r\nConnection: close\r\n\r\n#{json}")
    rescue IOError, Errno::EPIPE
      nil
    ensure
      socket&.close
    end

    def search_response(search_text, plan)
      if plan[:search_by_label].key?(search_text)
        return { "search" => plan[:search_by_label].fetch(search_text) }
      end

      { "search" => [
        { "id" => "Q227308", "label" => "Z shell", "description" => "Unix shell and command language", "match" => { "language" => "en", "text" => "Z shell" } },
        { "id" => "Q306138", "label" => "Federation source", "description" => "Source used in data federation", "match" => { "language" => "en", "text" => "federation source" } }
      ] }
    end

    def entities_response(ids, plan)
      if ids.length == 1
        sleep(plan[:delay_by_entity].fetch(ids.first, 0))
        return plan[:entity_overrides].fetch(ids.first) if plan[:entity_overrides].key?(ids.first)
      end

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

    def consume_rate_limit(search_text)
      @mutex.synchronize do
        rule = @plan[:rate_limits_by_search][search_text]
        return nil unless rule

        @rate_limit_counts[search_text] += 1
        return nil if @rate_limit_counts[search_text] > rule.fetch(:times, 1)

        rule
      end
    end

    def sparql_response(query, plan)
      # A mechanically valid seed-matched graph edge; this fake makes no semantic claim.
      seed_uri = query.to_s[/VALUES \?item \{ <([^>]+)>/, 1]
      return plan[:sparql_by_seed].fetch(seed_uri) if plan[:sparql_by_seed].key?(seed_uri)
      return { "head" => { "vars" => %w[item property value subject object] }, "results" => { "bindings" => [] } } unless seed_uri

      value = { "type" => "uri", "value" => seed_uri }
      { "head" => { "vars" => %w[item property value subject object] }, "results" => { "bindings" => [
        {
          "item" => value,
          "property" => { "type" => "uri", "value" => "http://www.wikidata.org/prop/direct/P279" },
          "value" => value,
          "subject" => value,
          "object" => value
        }
      ] } }
    end
  end
end
