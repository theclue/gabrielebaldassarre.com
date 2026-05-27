#!/usr/bin/env ruby
# clipboard-image-to-cloudinary.rb
# ==================================
# Trasforma l'ultima immagine incollata via markdown.copyFiles
# da ![alt](path) a {% cloudinary path alt="..." caption="" %}
# e rinomina il file con il pattern <post-slug>-<progressive>.png

require 'fileutils'

POST_FILE = ARGV[0]
abort "Usage: ruby #{$0} <path-to-post.md>" unless POST_FILE && File.exist?(POST_FILE)

WORKSPACE = File.expand_path('..', __dir__)
IMAGES_DIR = File.join(WORKSPACE, 'assets', 'images')

slug = File.basename(POST_FILE, '.md').sub(/^\d{4}-\d{2}-\d{2}-/, '')

# Legge il file e trova l'ultima occorrenza di ![alt](path)
content = File.read(POST_FILE)
match = content.scan(/!\[(.*?)\]\((assets\/images\/[^)]+)\)/).last
abort "Nessuna immagine markdown trovata in #{POST_FILE}" unless match

alt_text, old_path = match
old_full  = File.join(WORKSPACE, old_path)
old_name  = File.basename(old_path)

# Trova il prossimo progressivo
existing = Dir.glob("#{IMAGES_DIR}/#{slug}-*.png")
n = existing.map { |f| f[/#{Regexp.escape(slug)}-(\d+)\.png$/, 1].to_i }.max || 0
n += 1

new_name = "#{slug}-#{n}.png"
new_path = File.join(IMAGES_DIR, new_name)
new_rel  = "assets/images/#{new_name}"

# Rinomina il file
if File.exist?(old_full)
  FileUtils.mv(old_full, new_path)
else
  abort "File immagine non trovato: #{old_full}"
end

# Sostituisci l'ULTIMA occorrenza del tag markdown con il Liquid cloudinary
old_md = "![#{alt_text}](#{old_path})"
new_tag = "{% cloudinary /#{new_rel} alt=\"#{alt_text}\" caption=\"\" %}"
content = content.sub(/(.*)#{Regexp.escape(old_md)}/m) { "#{$1}#{new_tag}" }

File.write(POST_FILE, content)

puts "✅ #{old_name} → #{new_name}"
puts "✅ #{old_md} → #{new_tag}"
