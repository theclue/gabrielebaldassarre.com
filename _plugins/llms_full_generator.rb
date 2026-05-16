# frozen_string_literal: true

module Jekyll
  class LLMsFullGenerator < Generator
    safe true
    priority :low

    def generate(site)
      output = String.new
      output << "# Gabriele Baldassarre — Contenuti completi per AI ingestion\n"
      output << "# Generato automaticamente. Ultimo aggiornamento: #{Time.now.utc.iso8601}\n\n"

      site.posts.docs.sort_by { |p| -p.date.to_i }.each do |post|
        title = post.data["title"] || post.name
        date  = post.date.strftime("%Y-%m-%d")
        url   = "#{site.config['url']}#{post.url}"
        excerpt = post.data["excerpt"] || ""

        output << "---\n"
        output << "title: #{title}\n"
        output << "date: #{date}\n"
        output << "url: #{url}\n"
        output << "excerpt: #{excerpt}\n"
        output << "---\n\n"

        # Read the raw source file and strip frontmatter
        source_path = post.path
        if File.exist?(source_path)
          raw = File.read(source_path)
          # Remove YAML frontmatter (between first two ---)
          if raw =~ /\A---\s*\n.*?\n---\s*\n/m
            body_content = raw.sub(/\A---\s*\n.*?\n---\s*\n/m, "")
            output << body_content
          else
            output << post.content
          end
        end

        output << "\n\n"
      end

      # Write the file into _site
      page = PageWithoutAFile.new(site, __dir__, "", "llms-full.txt")
      page.content = output
      page.data["layout"] = nil
      site.pages << page
    end
  end
end
