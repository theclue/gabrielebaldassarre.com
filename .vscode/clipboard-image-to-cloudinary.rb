#!/usr/bin/env ruby
# clipboard-image-to-cloudinary.rb
# ==================================
# Trasforma l'ultima immagine incollata via markdown.copyFiles
# 1. Sposta il file da <post-dir>/image.png a assets/images/<slug>-<n>.png
# 2. Sostituisce ![alt](path) → {% cloudinary /assets/images/<name>.png %}
#
# Usage: ruby clipboard-image-to-cloudinary.rb <path-to-post.md>

require 'fileutils'

POST_FILE = ARGV[0]
abort "Usage: ruby #{$0} <path-to-post.md>" unless POST_FILE && File.exist?(POST_FILE)

WORKSPACE  = File.expand_path('..', __dir__)
IMAGES_DIR = File.join(WORKSPACE, 'assets', 'images')
FileUtils.mkdir_p(IMAGES_DIR)

post_dir = File.dirname(File.expand_path(POST_FILE))
slug     = File.basename(POST_FILE, '.md').sub(/^\d{4}-\d{2}-\d{2}-/, '')

# ── Trova l'ultima immagine markdown ──────────────────────────────
content = File.read(POST_FILE)
match = content.scan(/!\[(.*?)\]\(([^)]+)\)/).last
abort "Nessuna immagine markdown trovata in #{POST_FILE}" unless match

alt_text, old_path = match
old_ext  = File.extname(old_path)

# VS Code salva l'immagine incollata nella stessa directory del post
src_file = File.join(post_dir, old_path)
abort "File non trovato: #{src_file}" unless File.exist?(src_file)

# ── Calcola progressivo e nuovo nome ──────────────────────────────
existing = Dir.glob(File.join(IMAGES_DIR, "#{slug}-*#{old_ext}"))
             .select { |f| f =~ /#{Regexp.escape(slug)}-\d+/ }
n = existing.map { |f| f[/#{Regexp.escape(slug)}-(\d+)/, 1].to_i }.max || 0
n += 1

new_name = "#{slug}-#{n}#{old_ext}"
new_path = File.join(IMAGES_DIR, new_name)
new_rel  = "/assets/images/#{new_name}"

# ── Sposta il file ────────────────────────────────────────────────
FileUtils.mv(src_file, new_path)
puts "✅ #{File.basename(src_file)} → #{new_name}"

# ── Sostituisci tag markdown → Liquid cloudinary ──────────────────
old_md   = "![#{alt_text}](#{old_path})"
new_tag  = "{% cloudinary #{new_rel} alt=\"#{alt_text}\" caption=\"\" %}"
content  = content.sub(old_md, new_tag)

File.write(POST_FILE, content)
puts "✅ #{old_md}"
puts "   #{new_tag}"
