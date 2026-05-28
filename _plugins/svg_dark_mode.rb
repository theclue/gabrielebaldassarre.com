# _plugins/svg_dark_mode.rb
# ===========================
# Post-processes R-generated SVGs in assets/figures/ to support
# dark/light theme toggling via prefers-color-scheme CSS.
#
# Works for SVGs loaded via <img> tags (including Cloudinary CDN)
# because @media (prefers-color-scheme) inside an SVG file is
# evaluated by the browser based on the system/OS theme, not the
# embedding document.

Jekyll::Hooks.register :site, :post_write do |site|
  figures_dir = File.join(site.dest, "assets", "figures")

  next unless Dir.exist?(figures_dir)

  dark_css = <<~CSS
    <style>
      @media (prefers-color-scheme: dark) {
        :root {
          background-color: #0f0f23;
          filter: invert(0.88) hue-rotate(180deg);
        }
      }
    </style>
  CSS

  Dir.glob(File.join(figures_dir, "**", "*.svg")).each do |svg_path|
    content = File.read(svg_path)

    # Only inject if not already present
    next if content.include?("prefers-color-scheme: dark")

    # Insert <style> before closing </svg>
    content.sub!("</svg>", "#{dark_css}\n</svg>")
    File.write(svg_path, content)

    Jekyll.logger.debug "svg_dark_mode:", "Injected dark mode CSS into #{File.basename(svg_path)}"
  end

  Jekyll.logger.info "svg_dark_mode:", "Processed SVGs in assets/figures/"
end
