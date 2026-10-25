require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "time"

unless defined?(Jekyll::Generator)
  module Jekyll
    class Generator
      def self.safe(*)
      end

      def self.priority(*)
      end
    end
  end
end

require_relative "../_plugins/llms_full_generator"

class LLMsFullGeneratorTest < Minitest::Test
  def test_strips_nested_and_unclosed_html_tags_completely
    Dir.mktmpdir do |destination|
      post = Struct.new(:content, :data, :date, :path, :url).new(
        "<p>Intro</p>\n\n\n<scr<script>ipt>alert(1)</scr</script>ipt><script\n<p>Outro</p>",
        { "title" => "Fixture" }, Time.utc(2025, 1, 1), "fixture.md", "/fixture/"
      )
      site = Struct.new(:posts, :config, :dest, :keep_files).new(
        Struct.new(:docs).new([post]), { "url" => "https://example.com" }, destination, []
      )

      Jekyll::LLMsFullGenerator.new.send(:write_llms_file, site)
      output = File.read(File.join(destination, "llms-full.txt"))
      body = output.split("---\n\n", 2).last

      refute_includes output, "<script"
      refute_match(/[<>]/, body)
      assert_includes body, "Intro\n\nalert(1)"
    end
  end
end
