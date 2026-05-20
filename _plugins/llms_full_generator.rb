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

        # Static metadata for LLM retrieval context (generator runs before render)
        audience = post.data['intended_audience']
        output << "audience: #{audience}\n" if audience
        proficiency = post.data['proficiency_level']
        output << "proficiency: #{proficiency}\n" if proficiency
        tags = post.data['tags']
        output << "tags: #{tags.join(', ')}\n" if tags.is_a?(Array) && !tags.empty?
        category = post.data['category']
        output << "category: #{category}\n" if category
        prereqs = post.data['knowledge_prerequisites']
        if prereqs.is_a?(Array) && !prereqs.empty?
          labels = prereqs.map { |p| p['label'] }.compact
          output << "prerequisites: #{labels.join('; ')}\n" unless labels.empty?
        end

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
