require "time"
require "fileutils"

SOURCE = "."
POSTS  = File.join(SOURCE, "_posts")
DRAFTS = File.join(SOURCE, "_drafts")
CONFIG = File.join(SOURCE, "_config.yml")

## ── New post ──────────────────────────────────────────────────────────────────
# Usage: rake post["My Title","DevOps","my-slug"]
# slug is kebab-case (a-z, 0-9, -). Derived from title if not explicit.
desc "Create a new post in _posts/<category>/"
task :post, [:title, :category, :slug] do |t, args|
  title    = args[:title]    || abort("Missing title argument. Usage: rake post['Title','Category','slug']")
  category = args[:category] || abort("Missing category argument")
  slug     = args[:slug]     || abort("Missing slug argument (kebab-case)")

  date = ENV["date"] ? Time.parse(ENV["date"]).strftime("%Y-%m-%d") : Time.now.strftime("%Y-%m-%d")

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
# Usage: rake draft["My Draft","DevOps","my-draft-slug"]
desc "Create a new draft in _drafts/"
task :draft, [:title, :category, :slug] do |t, args|
  title    = args[:title]    || abort("Missing title argument. Usage: rake draft['Title','Category','slug']")
  category = args[:category] || abort("Missing category argument")
  slug     = args[:slug]     || abort("Missing slug argument (kebab-case)")

  filename = File.join(DRAFTS, "#{slug}.md")

  if File.exist?(filename)
    abort "#{filename} already exists."
  end

  puts "Creating draft: #{filename}"
  File.open(filename, "w") do |f|
    f.puts "---"
    f.puts "category: #{category}"
    f.puts "title: \"#{title}\""
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

## ── Publish draft ─────────────────────────────────────────────────────────────
# Usage: rake publish["_drafts/my-draft.md"]
# Category is read from the draft frontmatter (already set at creation time).
desc "Publish a draft to _posts/<category>/"
task :publish, [:draft] do |t, args|
  draft = args[:draft] || abort("Missing draft argument. Usage: rake publish['_drafts/my-draft.md']")
  abort "#{draft} not found." unless File.exist?(draft)

  content = File.read(draft)
  category = content.match(/^category:\s*(.+)$/)&.captures&.first&.strip
  abort "Draft has no category in frontmatter." unless category

  base = File.basename(draft, ".md")
  date = Time.now.strftime("%Y-%m-%d")

  dir = File.join(POSTS, category.downcase.strip.gsub(" ", "-"))
  dest = File.join(dir, "#{date}-#{base}.md")

  FileUtils.mkdir_p(dir)

  abort "#{dest} already exists." if File.exist?(dest)

  File.write(dest, content)
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

  sh "docker run --rm -v #{Dir.pwd}:/srv/jekyll -w /srv/jekyll " \
     "-e TZ=Europe/Rome " \
     "gabrielebaldassarre/knitr:latest " \
     "Rscript R/build_one.R '#{rmd}' '#{md}'"
end

## ── New Rmd post ────────────────────────────────────────────────────────────────

# Usage: rake new_rmd["Reti Smallworld - Analisi Quantitativa","Reti Sociali","reti-smallworld-analisi-quantitativa"]
desc "Create a new .Rmd post from template"
task :new_rmd, [:title, :category, :slug] do |t, args|
  title    = args[:title]    || abort("Missing title argument. Usage: rake new_rmd['Title','Category','slug']")
  category = args[:category] || abort("Missing category argument")
  slug     = args[:slug]     || abort("Missing slug argument (kebab-case)")

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

# Usage: rake new_rmd_draft["Analisi Reti","Reti Sociali","analisi-reti"]
desc "Create a new .Rmd draft in _drafts/"
task :new_rmd_draft, [:title, :category, :slug] do |t, args|
  title    = args[:title]    || abort("Missing title argument. Usage: rake new_rmd_draft['Title','Category','slug']")
  category = args[:category] || abort("Missing category argument")
  slug     = args[:slug]     || abort("Missing slug argument (kebab-case)")

  filename = File.join(DRAFTS, "#{slug}.Rmd")

  abort "#{filename} already exists." if File.exist?(filename)

  template = File.join(SOURCE, "R", "includes", "template.Rmd")
  abort "Template not found: #{template}" unless File.exist?(template)

  content = File.read(template)
  content = content.sub(/^title:.*/, "title: \"#{title}\"")
  content = content.sub(/^category:.*/, "category: \"#{category}\"")
  content = content.sub(/^tags:.*/, "tags: []")

  File.write(filename, content)
  puts "Created: #{filename}"
end

desc "Build the site"
task default: :build

## ── New 3D Asset ────────────────────────────────────────────────────────────────

# Usage: rake new_3d["Cable Grommet","customizable-cable-grommet"]
desc "Create a new 3D asset project under _cad/ from the archetype template"
task :new_3d, [:title, :slug] do |t, args|
  title = args[:title] || abort("Missing title argument. Usage: rake new_3d['Title','slug']")
  slug  = args[:slug]  || abort("Missing slug argument (kebab-case)")

  cad_dir  = File.join(SOURCE, "_cad", slug)
  scad_file = File.join(cad_dir, "#{slug}.scad")

  abort "#{cad_dir} already exists." if Dir.exist?(cad_dir)

  FileUtils.mkdir_p(cad_dir)

  # ── .scad from archetype ─────────────────────────────────────────
  puts "Creating SCAD project: #{scad_file}"
  File.open(scad_file, "w") do |f|
    f.puts "// ============================================================================="
    f.puts "// #{title}"
    f.puts "// ============================================================================="
    f.puts "// Author  : Gabriele Baldassarre"
    f.puts "// Website : https://gabrielebaldassarre.com"
    f.puts "// Source  : https://github.com/theclue/gabrielebaldassarre.com/_cad/#{slug}/#{slug}.scad"
    f.puts "//"
    f.puts "// License : MIT License"
    f.puts "// Copyright (c) #{Time.now.year} Gabriele Baldassarre"
    f.puts "//"
    f.puts "// Permission is hereby granted, free of charge, to any person obtaining a copy"
    f.puts "// of this design and associated documentation files, to deal in the design"
    f.puts "// without restriction, including without limitation the rights to use, copy,"
    f.puts "// modify, merge, publish, distribute, sublicense, and/or sell copies of the"
    f.puts "// design, and to permit persons to whom the design is furnished to do so,"
    f.puts "// subject to the following conditions:"
    f.puts "//"
    f.puts "// The above copyright notice and this permission notice shall be included in"
    f.puts "// all copies or substantial portions of the design."
    f.puts "// ============================================================================="
    f.puts ""
    f.puts "// ─── See .opencode/agents/cad-author.md for conventions ──────────────────"
    f.puts ""
    f.puts "/* [Parameters] */"
    f.puts ""
    f.puts "// Main dimension (mm)"
    f.puts "size = 50; // [10:1:200]"
    f.puts ""
    f.puts "/* [Quality] */"
    f.puts '$fn = 128;'
    f.puts ""
    f.puts "// ─── Geometry helpers ────────────────────────────────────────────────"
    f.puts ""
    f.puts "// ─── Modules ─────────────────────────────────────────────────────────"
    f.puts ""
    f.puts "module main_part() {"
    f.puts "    cube([size, size, size], center = true);"
    f.puts "}"
    f.puts ""
    f.puts "// ─── Assembly ────────────────────────────────────────────────────────"
    f.puts ""
    f.puts "module assembly(explode = 0, explode_distance = 25) {"
    f.puts "    main_part();"
    f.puts "}"
    f.puts ""
    f.puts "// ─── Export ───────────────────────────────────────────────────────────"
    f.puts ""
    f.puts "/* [View] */"
    f.puts ""
    f.puts 'mode = "print"; // [assembly:Assembly, exploded:Exploded, print:Print layout]'
    f.puts ""
    f.puts "if (mode == \"assembly\") {"
    f.puts "    assembly(explode = 0);"
    f.puts "} else if (mode == \"exploded\") {"
    f.puts "    assembly(explode = 1);"
    f.puts "} else if (mode == \"print\") {"
    f.puts "    main_part();"
    f.puts "}"
  end

  puts "Created: #{cad_dir}/"
  puts "  #{slug}.scad"
  puts ""
  puts "Next: make cad CAD_ARGS=\"--slug #{slug}\""
end
