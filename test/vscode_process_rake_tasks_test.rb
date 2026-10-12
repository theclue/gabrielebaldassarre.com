#!/usr/bin/env ruby

require "json"
require "fileutils"
require "minitest/autorun"
require "open3"
require "rbconfig"
require "tmpdir"

class VscodeProcessRakeTasksTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  TASKS_FILE = File.join(ROOT, ".vscode", "tasks.json")
  RAKEFILE = File.join(ROOT, "Rakefile")
  FIXTURE = File.join(ROOT, "R", "includes", "template.Rmd")
  DATE = "2026-01-02"

  TASK_LABELS = {
    "📝 Nuovo post" => ["postTitle", "postCategory", "postSlug"],
    "✏️ Nuova bozza" => ["draftTitle", "postCategory", "draftSlug"],
    "📔 Esegui knitr sull'Rmd corrente" => ["relativeFile"],
    "✨ Nuovo workbook Rmd" => ["rmdTitle", "rmdCategory", "rmdSlug"],
    "✨ Nuovo asset 3D" => ["cadTitle", "cadSlug"]
  }.freeze

  VALUES = {
    "postTitle" => "A Post Title",
    "postCategory" => "Home Assistant",
    "postSlug" => "a-post-slug",
    "draftTitle" => "A Draft Title",
    "draftSlug" => "a-draft-slug",
    "relativeFile" => "_posts/example.Rmd",
    "rmdTitle" => "An Rmd Title",
    "rmdCategory" => "Reti Sociali",
    "rmdSlug" => "an-rmd-slug",
    "cadTitle" => "A CAD Title",
    "cadSlug" => "a-cad-slug"
  }.freeze

  def test_all_affected_process_tasks_have_no_shell_quote_delimiters
    tasks = JSON.parse(File.read(TASKS_FILE))["tasks"]

    TASK_LABELS.each do |label, _input_ids|
      task = tasks.find { |candidate| candidate["label"] == label }
      refute_nil task, "missing process task #{label.inspect}"
      assert_equal "process", task["type"], label
      expression = task.fetch("args").fetch(0)
      refute_includes expression, "'", "#{label} retains apostrophe delimiters"
    end
  end

  def test_post_draft_new_rmd_and_new_3d_use_clean_generated_values
    with_temp_workspace(copy_rmd_fixture: true) do |workspace|
      run_task(workspace, "📝 Nuovo post", "postTitle", "postCategory", "postSlug")
      post = File.join(workspace, "_posts", "home-assistant", "#{DATE}-a-post-slug.md")
      assert File.file?(post), "post path should not contain quote characters"
      assert_includes File.read(post), "category: Home Assistant\n"
      assert_includes File.read(post), "title: \"A Post Title\"\n"
      assert_includes File.read(post), "master: /assets/images/posts/a-post-slug.png\n"

      run_task(workspace, "✏️ Nuova bozza", "draftTitle", "postCategory", "draftSlug")
      draft = File.join(workspace, "_drafts", "a-draft-slug.md")
      assert File.file?(draft), "draft path should not contain quote characters"
      assert_includes File.read(draft), "category: Home Assistant\n"
      assert_includes File.read(draft), "title: \"A Draft Title\"\n"
      assert_includes File.read(draft), "master: /assets/images/posts/a-draft-slug.png\n"

      run_task(workspace, "✨ Nuovo workbook Rmd", "rmdTitle", "rmdCategory", "rmdSlug")
      rmd = File.join(workspace, "_posts", "reti-sociali", "#{DATE}-an-rmd-slug.Rmd")
      assert File.file?(rmd), "Rmd path should not contain quote characters"
      rmd_content = File.read(rmd)
      assert_includes rmd_content, "title: \"An Rmd Title\"\n"
      assert_includes rmd_content, "category: \"Reti Sociali\"\n"

      run_task(workspace, "✨ Nuovo asset 3D", "cadTitle", "cadSlug")
      scad = File.join(workspace, "_cad", "a-cad-slug", "a-cad-slug.scad")
      assert File.file?(scad), "CAD path should not contain quote characters"
      scad_content = File.read(scad)
      assert_includes scad_content, "// A CAD Title\n"
      assert_includes scad_content, "_cad/a-cad-slug/a-cad-slug.scad\n"
    end
  end

  private

  def with_temp_workspace(copy_rmd_fixture:)
    Dir.mktmpdir("vscode-rake-tasks-") do |workspace|
      FileUtils.mkdir_p(File.join(workspace, "_drafts"))
      if copy_rmd_fixture
        FileUtils.mkdir_p(File.join(workspace, "R", "includes"))
        FileUtils.cp(FIXTURE, File.join(workspace, "R", "includes", "template.Rmd"))
      end
      yield workspace
    end
  end

  def run_task(workspace, label, *input_ids)
    tasks = JSON.parse(File.read(TASKS_FILE))["tasks"]
    task = tasks.find { |candidate| candidate["label"] == label }
    refute_nil task, "missing process task #{label.inspect}"
    expression = task.fetch("args").fetch(0)
    input_ids.each { |input_id| expression = expression.gsub("${input:#{input_id}}", VALUES.fetch(input_id)) }

    stdout, stderr, status = Open3.capture3(
      { "date" => DATE },
      RbConfig.ruby, "-S", "rake", "-f", RAKEFILE, expression,
      chdir: workspace
    )
    assert status.success?, "#{label} failed:\n#{stdout}\n#{stderr}"
  end
end
