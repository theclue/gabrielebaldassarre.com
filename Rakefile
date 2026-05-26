require "time"
require "fileutils"

SOURCE = "."
POSTS  = File.join(SOURCE, "_posts")
DRAFTS = File.join(SOURCE, "_drafts")
CONFIG = File.join(SOURCE, "_config.yml")

## ── New post ──────────────────────────────────────────────────────────────────
# Usage: rake post title="My Title" category="DevOps" [date="2026-05-26"]
desc "Create a new post in _posts/<category>/"
task :post do
  title    = ENV["title"] || abort("Missing title= argument")
  category = ENV["category"] || abort("Missing category= argument")
  subtitle = ENV["subtitle"]
  subtitle = nil if subtitle && subtitle.strip.empty?

  slug = title.downcase.strip.gsub(" ", "-").gsub(/[^\w-]/, "")
  date = (ENV["date"] ? Time.parse(ENV["date"]) : Time.now).strftime("%Y-%m-%d")

  dir = File.join(POSTS, category.downcase.strip.gsub(" ", "-"))
  filename = File.join(dir, "#{date}-#{slug}.md")

  FileUtils.mkdir_p(dir)

  if File.exist?(filename)
    abort "#{filename} already exists."
  end

  puts "Creating post: #{filename}"
  File.open(filename, "w") do |f|
    f.puts "---"
    f.puts "category: #{category}"
    f.puts "title: \"#{title}\""
    f.puts "subtitle: \"#{subtitle}\"" if subtitle
    f.puts "excerpt: \"\""
    f.puts "master: /assets/images/posts/#{slug}.png"
    f.puts "image_meta:"
    f.puts "  role: illustration"
    f.puts "  context: ambient"
    f.puts "  caption: \"\""
    f.puts "header:"
    f.puts "  overlay_filter: 0.5"
    f.puts "broadcast:"
    f.puts "  channels: [linkedin,mastodon]"
    f.puts "  sent: false"
    f.puts "intended_audience: practitioner"
    f.puts "proficiency_level: intermediate"
    f.puts "---"
  end
end

## ── New draft ─────────────────────────────────────────────────────────────────
# Usage: rake draft title="My Draft"
desc "Create a new draft in _drafts/"
task :draft do
  title    = ENV["title"] || abort("Missing title= argument")
  slug = title.downcase.strip.gsub(" ", "-").gsub(/[^\w-]/, "")
  filename = File.join(DRAFTS, "#{slug}.md")

  if File.exist?(filename)
    abort "#{filename} already exists."
  end

  puts "Creating draft: #{filename}"
  File.open(filename, "w") do |f|
    f.puts "---"
    f.puts "layout: post"
    f.puts "title: \"#{title}\""
    f.puts "category: "
    f.puts "---"
  end
end

## ── Publish draft ─────────────────────────────────────────────────────────────
# Usage: rake publish draft="_drafts/my-draft.md" category="Home Assistant"
desc "Publish a draft to _posts/<category>/"
task :publish do
  draft    = ENV["draft"] || abort("Missing draft= argument")
  category = ENV["category"] || abort("Missing category= argument")

  abort "#{draft} not found." unless File.exist?(draft)

  base = File.basename(draft, ".md")
  date = Time.now.strftime("%Y-%m-%d")

  dir = File.join(POSTS, category.downcase.strip.gsub(" ", "-"))
  dest = File.join(dir, "#{date}-#{base}.md")

  FileUtils.mkdir_p(dir)

  abort "#{dest} already exists." if File.exist?(dest)

  content = File.read(draft)
  updated = content.sub(/^---\n.*?^---/m) do |fm|
    fm.sub(/^category:.*$/, "category: #{category}")
  end

  File.write(dest, updated)
  File.delete(draft)
  puts "Published: #{dest}"
end

## ── Build (Docker) ────────────────────────────────────────────────────────────
desc "Build the site (production)"
task :build do
  sh "make site"
end

## ── Dev server (Docker) ───────────────────────────────────────────────────────
desc "Start local dev server with live-reload"
task :dev do
  sh "make dev"
end

## ── Clean ─────────────────────────────────────────────────────────────────────
desc "Remove _site output"
task :clean do
  sh "make clean"
end

desc "Build the site"
task default: :build
