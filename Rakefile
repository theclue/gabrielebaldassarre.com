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

## ── Knitr ──────────────────────────────────────────────────────────────────────

# Usage: rake knit["_posts/reti-sociali/2018-08-17-reti-smallworld.Rmd"]
desc "Knit a single .Rmd file via Docker (outputs .md alongside)"
task :knit, [:file] do |t, args|
  rmd = args[:file] || abort("Missing file= argument. Usage: rake knit['path/to/file.Rmd']")
  abort "#{rmd} not found." unless File.exist?(rmd)

  md = rmd.sub(/\.Rmd$/i, ".md")
  puts "Knitting: #{rmd} → #{md}"

  # Run build_one.R inside the knitr Docker container
  sh "docker run --rm -v #{Dir.pwd}:/srv/jekyll -w /srv/jekyll " \
     "-e TZ=Europe/Rome " \
     "gabrielebaldassarre/knitr:latest " \
     "Rscript R/build_one.R '#{rmd}' '#{md}'"
end

# Usage: rake knit_all
desc "Knit all .Rmd files (builds Docker image if needed)"
task :knit_all do
  sh "make knitr"
end

## ── New Rmd post ────────────────────────────────────────────────────────────────

# Usage: rake new_rmd["Reti Smallworld - Analisi Quantitativa","Reti Sociali"]
desc "Create a new .Rmd post from template"
task :new_rmd, [:title, :category] do |t, args|
  title    = args[:title] || abort("Missing title argument. Usage: rake new_rmd['Title','Category']")
  category = args[:category] || abort("Missing category argument")

  slug = title.downcase.strip.gsub(" ", "-").gsub(/[^\w-]/, "")
  date = ENV["date"] ? Time.parse(ENV["date"]).strftime("%Y-%m-%d") : Time.now.strftime("%Y-%m-%d")

  dir = File.join(POSTS, category.downcase.strip.gsub(" ", "-"))
  filename = File.join(dir, "#{date}-#{slug}.Rmd")

  FileUtils.mkdir_p(dir)
  abort "#{filename} already exists." if File.exist?(filename)

  template = File.join(SOURCE, "R", "includes", "template.Rmd")
  abort "Template not found: #{template}" unless File.exist?(template)

  content = File.read(template)
  content = content.sub(/^title:.*/, "title: \"#{title}\"")
  content = content.sub(/^category:.*/, "category: \"#{category}\"")

  File.write(filename, content)
  puts "Created: #{filename}"
end

## ── New Rmd draft ───────────────────────────────────────────────────────────────

# Usage: rake new_rmd_draft["Analisi Reti"]
desc "Create a new .Rmd draft in _drafts/"
task :new_rmd_draft, [:title] do |t, args|
  title = args[:title] || abort("Missing title argument")
  slug = title.downcase.strip.gsub(" ", "-").gsub(/[^\w-]/, "")
  filename = File.join(DRAFTS, "#{slug}.Rmd")

  abort "#{filename} already exists." if File.exist?(filename)

  template = File.join(SOURCE, "R", "includes", "template.Rmd")
  abort "Template not found: #{template}" unless File.exist?(template)

  content = File.read(template)
  content = content.sub(/^title:.*/, "title: \"#{title}\"")
  content = content.sub(/^category:.*/, "category: ")
  content = content.sub(/^tags:.*/, "tags: []")

  File.write(filename, content)
  puts "Created: #{filename}"
end

desc "Build the site"
task default: :build
