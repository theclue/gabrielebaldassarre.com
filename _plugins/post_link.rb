module Jekyll
  class PostLinkTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      args = markup.strip.split(/\s+/, 2)
      @post_ref = args[0]&.strip
      @link_text = args[1]&.gsub(/^["']|["']$/, '')&.strip
    end

    def render(context)
      site = context.registers[:site]
      post = find_post(site, @post_ref)

      if post
        url = post.url
        "[#{@link_text || post.data['title']}](#{url})"
      else
        Jekyll.logger.warn "post_link:", "post not found: #{@post_ref} — rendering as plain text"
        @link_text || @post_ref
      end
    end

    private

    def find_post(site, ref)
      return nil unless ref

      ref_normalised = ref.sub(%r{^/}, '').sub(%r{/$}, '')

      site.posts.docs.find do |doc|
        doc_url = doc.url.sub(%r{^/}, '').sub(%r{/$}, '')

        # match by URL (e.g. /home-assistant/slug-a/)
        next true if doc_url == ref_normalised

        # match by post name (e.g. fisica/2021-05-08-quantita-moto)
        slug = File.basename(doc.relative_path, '.*')
        date_str = doc.date.strftime('%Y-%m-%d')
        post_name = doc.relative_path.to_s.sub(%r{^_posts/}, '').sub(%r{\.[^.]+$}, '')
        next true if post_name == ref_normalised
        next true if "#{date_str}-#{slug}" == ref_normalised

        false
      end
    end
  end
end

Liquid::Template.register_tag('post_link', Jekyll::PostLinkTag)
