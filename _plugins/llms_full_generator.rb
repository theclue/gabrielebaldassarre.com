# frozen_string_literal: true

module Jekyll
  class LLMsFullGenerator < Generator
    safe true
    priority :low

    def generate(site)
      # Defer actual generation to :post_write when post.content is available
      Jekyll::Hooks.register :site, :post_write do |s|
        write_llms_file(s)
      end
    end

    private

    def write_llms_file(site)
      output = String.new
      output << "# Gabriele Baldassarre — Contenuti completi per AI ingestion\n"
      output << "# Generato automaticamente. Ultimo aggiornamento: #{Time.now.utc.iso8601}\n\n"

      site.posts.docs.sort_by { |p| -p.date.to_i }.each do |post|
        title = post.data["title"] || File.basename(post.path, ".*")
        next unless title

        date  = post.date.strftime("%Y-%m-%d")
        url   = "#{site.config['url']}#{post.url}"
        excerpt = post.data["excerpt"] || ""

        output << "---\n"
        output << "title: #{title}\n"
        output << "date: #{date}\n"
        output << "url: #{url}\n"
        output << "excerpt: #{excerpt}\n"

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

        # post.content is the Liquid-rendered output — tags resolved, HTML generated
        # Strip HTML tags to leave plain text suitable for AI ingestion
        plain = post.content
          .gsub(/<[^>]+>/, '')         # strip HTML tags
          .gsub(/\n{3,}/, "\n\n")      # collapse excessive newlines
        output << plain
        output << "\n\n"
      end

      dest = File.join(site.dest, "llms-full.txt")
      FileUtils.mkdir_p(File.dirname(dest))
      File.write(dest, output)
      site.keep_files << "llms-full.txt" unless site.keep_files.include?("llms-full.txt")
    end
  end
end