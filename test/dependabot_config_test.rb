#!/usr/bin/env ruby

require "minitest/autorun"
require "yaml"

class DependabotConfigTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  DEPENDABOT_CONFIG = File.join(ROOT, ".github", "dependabot.yml")
  DEPENDABOT_WORKFLOW = File.join(ROOT, ".github", "workflows", "dependabot.yml")

  def test_renovate_config_is_removed
    refute File.exist?(File.join(ROOT, "renovate.json")), "renovate.json should not exist"
  end

  def test_dependabot_config_defines_expected_updates
    assert File.file?(DEPENDABOT_CONFIG), ".github/dependabot.yml should exist"
    config = YAML.safe_load_file(DEPENDABOT_CONFIG)

    assert_equal 2, config.fetch("version")

    updates = config.fetch("updates")
    expected_pairs = [
      ["bundler", "/"],
      ["npm", "/_scripts/author-extraction"],
      ["npm", "/_scripts/wikidata-integration"],
      ["pip", "/"],
      ["docker", "/"],
      ["github-actions", "/"]
    ]
    assert File.exist?(File.join(ROOT, "_scripts/author-extraction/package-lock.json"))
    refute File.exist?(File.join(ROOT, "_scripts/author-extraction/bun.lock"))
    actual_pairs = updates.map do |update|
      [update.fetch("package-ecosystem"), update.fetch("directory")]
    end
    assert_equal expected_pairs.sort, actual_pairs.sort
    refute updates.any? { |update| Array(update.fetch("directory")).any? { |directory| directory.include?("containers/**") } },
      "containers/** directories should not be configured"

    updates.each do |update|
      assert_nil update["ignore"]
      assert_equal 8, update.dig("cooldown", "default-days")
      assert_equal "daily", update.dig("schedule", "interval")
      assert_equal "Europe/Rome", update.dig("schedule", "timezone")
      assert_equal "chore(deps)", update.dig("commit-message", "prefix")
      group = update.dig("groups", "minor-and-patch")
      assert_equal %w[minor patch], group.fetch("update-types")
      refute_includes group.fetch("update-types"), "major"
    end

    pip_update = updates.find { |update| update["package-ecosystem"] == "pip" }
    refute_nil pip_update
    assert_equal [{ "dependency-type" => "all" }], pip_update.fetch("allow")
  end

  def test_dependabot_workflow_checks_and_automerges_pull_requests
    assert File.file?(DEPENDABOT_WORKFLOW), ".github/workflows/dependabot.yml should exist"
    workflow = YAML.safe_load_file(DEPENDABOT_WORKFLOW)

    triggers = workflow.fetch("on") { workflow.fetch(true) }
    assert_equal %w[main master], triggers.dig("pull_request", "branches").sort
    assert_equal %w[main master], triggers.dig("push", "branches").sort
    assert_equal %w[requirements*.txt requirements*.in Gemfile.lock _scripts/**/package-lock.json].sort,
      triggers.dig("push", "paths").sort

    jobs = workflow.fetch("jobs")
    assert_equal %w[
      metadata
      flag-major
      build-site
      test-scripts
      build-seo
      automerge
      autoclose-unresolvable
      evaluate-blocked-prs
      reopen-blocked-prs
    ], jobs.keys

    %w[build-site test-scripts build-seo].each do |job|
      assert_equal "github.actor == 'dependabot[bot]'", jobs.fetch(job).fetch("if")
    end

    test_script_steps = jobs.fetch("test-scripts").fetch("steps")
    test_script_steps.each do |step|
      refute_match(/\bsudo\b/, step.to_yaml)
      refute_includes step.to_yaml, "/private/var/folders"
    end
    refute_includes test_script_steps.to_yaml, "oven-sh/setup-bun"
    refute_match(/\bbun install\b/, test_script_steps.to_yaml)
    assert test_script_steps.any? { |step| step["run"]&.include?("npm --prefix _scripts/author-extraction ci") },
      "test-scripts should install author-extraction dependencies with npm ci"

    flag_major = jobs.fetch("flag-major")
    assert_equal ["metadata"], flag_major.fetch("needs")
    assert_match(/github\.actor\s*==\s*['"]dependabot\[bot\]['"]/, flag_major.fetch("if"))
    assert_match(/needs\.metadata\.outputs\.update-type\s*==\s*['"]version-update:semver-major['"]/, flag_major.fetch("if"))
    assert_equal "write", flag_major.dig("permissions", "issues")
    assert_equal "write", flag_major.dig("permissions", "pull-requests")
    label_step = flag_major.fetch("steps").find do |step|
      run = step["run"]
      run&.include?('gh label create "major"') && run.include?('gh pr edit "$PR_URL" --add-label "major"')
    end
    refute_nil label_step, "flag-major should ensure the major label and apply it to the pull request"
    assert_equal "${{ github.repository }}", label_step.dig("env", "GH_REPO")
    assert_includes label_step.fetch("run"), 'gh label create "major" --repo "$GH_REPO"'

    automerge = jobs.fetch("automerge")
    assert_equal %w[metadata build-site test-scripts build-seo].sort, automerge.fetch("needs").sort
    assert_match(/!=\s*['"]version-update:semver-major['"]/, automerge.fetch("if"))
    assert_match(/==\s*['"]version-update:semver-minor['"]/, automerge.fetch("if"))
    assert_match(/==\s*['"]version-update:semver-patch['"]/, automerge.fetch("if"))

    build_seo = jobs.fetch("build-seo")
    assert_equal "${{ steps.pip-check.outputs.pip_resolution_failed }}",
      build_seo.dig("outputs", "pip_resolution_failed")
    pip_check_step = build_seo.fetch("steps").find { |step| step["id"] == "pip-check" }
    refute_nil pip_check_step
    assert_includes pip_check_step.fetch("run"),
      "python3 -m pip install --dry-run --ignore-installed --break-system-packages -r requirements-seo.txt"

    autoclose = jobs.fetch("autoclose-unresolvable")
    assert_equal ["build-seo"], autoclose.fetch("needs")
    assert_equal({ "contents" => "read", "pull-requests" => "write", "issues" => "write" }, autoclose.fetch("permissions"))
    assert_includes autoclose.fetch("if"), "needs.build-seo.outputs.pip_resolution_failed == 'true'"
    autoclose_run = autoclose.fetch("steps").first.fetch("run")
    assert_includes autoclose_run, "blocked-by-constraint"
    assert_includes autoclose_run, "gh pr close"
    refute_includes autoclose_run, "--delete-branch"
    refute_includes autoclose_run, "@dependabot ignore"

    evaluate_blocked = jobs.fetch("evaluate-blocked-prs")
    assert_equal({ "contents" => "read", "pull-requests" => "read" }, evaluate_blocked.fetch("permissions"))
    assert_equal "${{ steps.evaluate.outputs.reopen_prs }}", evaluate_blocked.dig("outputs", "reopen_prs")

    reopen_blocked = jobs.fetch("reopen-blocked-prs")
    assert_equal ["evaluate-blocked-prs"], reopen_blocked.fetch("needs")
    assert_equal({ "contents" => "read", "pull-requests" => "write", "issues" => "write" }, reopen_blocked.fetch("permissions"))
    reopen_steps_yaml = reopen_blocked.fetch("steps").to_yaml
    refute_includes reopen_steps_yaml, "actions/checkout"
    refute_match(/\bpip\b/, reopen_steps_yaml)
    assert_includes reopen_steps_yaml, "@dependabot recreate"
  end

  def test_seo_runtime_uses_dbt_compatible_python_3_13
    dockerfile = File.read(File.join(ROOT, "Dockerfile.seo"))
    assert_match(/^FROM python:3\.13-slim\b/, dockerfile)

    monitor_workflow = YAML.safe_load_file(File.join(ROOT, ".github", "workflows", "seo-monitor.yml"))
    monitor_job = monitor_workflow.fetch("jobs").fetch("monitor")
    monitor_setup_python_step = monitor_job.fetch("steps").find do |step|
      step["uses"]&.start_with?("actions/setup-python@")
    end
    refute_nil monitor_setup_python_step, "monitor should set up Python"
    assert_equal "3.13", monitor_setup_python_step.dig("with", "python-version")

    pipeline_workflow = YAML.safe_load_file(File.join(ROOT, ".github", "workflows", "seo-pipeline.yml"))
    post_history_job = pipeline_workflow.fetch("jobs").fetch("post-history")
    post_history_setup_python_step = post_history_job.fetch("steps").find do |step|
      step["uses"]&.start_with?("actions/setup-python@")
    end
    refute_nil post_history_setup_python_step, "post-history should set up Python"
    assert_equal "3.13", post_history_setup_python_step.dig("with", "python-version")
  end
end
