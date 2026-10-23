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
      ["bun", "/_scripts/author-extraction"],
      ["npm", "/_scripts/wikidata-integration"],
      ["pip", "/"],
      ["docker", "/"],
      ["github-actions", "/"]
    ]
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
  end

  def test_dependabot_workflow_checks_and_automerges_pull_requests
    assert File.file?(DEPENDABOT_WORKFLOW), ".github/workflows/dependabot.yml should exist"
    workflow = YAML.safe_load_file(DEPENDABOT_WORKFLOW)

    triggers = workflow.fetch("on") { workflow.fetch(true) }
    assert_equal %w[main master], triggers.dig("pull_request", "branches").sort

    jobs = workflow.fetch("jobs")
    assert_equal %w[metadata flag-major build-site test-scripts build-seo automerge], jobs.keys

    %w[build-site test-scripts build-seo].each do |job|
      assert_equal "github.actor == 'dependabot[bot]'", jobs.fetch(job).fetch("if")
    end

    jobs.fetch("test-scripts").fetch("steps").each do |step|
      refute_match(/\bsudo\b/, step.to_yaml)
      refute_includes step.to_yaml, "/private/var/folders"
    end

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

    automerge = jobs.fetch("automerge")
    assert_equal %w[metadata build-site test-scripts build-seo].sort, automerge.fetch("needs").sort
    assert_match(/!=\s*['"]version-update:semver-major['"]/, automerge.fetch("if"))
    assert_match(/==\s*['"]version-update:semver-minor['"]/, automerge.fetch("if"))
    assert_match(/==\s*['"]version-update:semver-patch['"]/, automerge.fetch("if"))
  end
end
