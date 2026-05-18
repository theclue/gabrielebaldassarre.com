require 'set'

module Jekyll
  class PostLinkTag < Liquid::Tag
    # Deduplicates warnings within a single build (feed plugin re-processes Liquid tags)
    @@warned_refs = Set.new
    Jekyll::Hooks.register :site, :after_reset do
      @@warned_refs.clear
    end

    # Handles all these forms:
    #   {% post_link /url/ "text" %}
    #   {% post_link "/url/" "text" %}
    #   {% post_link '/url/' 'text' %}
    #   {% post_link /url/ %}           (falls back to post title)
    MARKUP_RE = /\A\s*(?:"([^"]+)"|'([^']+)'|(\S+))\s*(?:"([^"]+)"|'([^']+)'|(\S+))?\s*\z/m

    def initialize(tag_name, markup, tokens)
      super
      if markup =~ MARKUP_RE
        @post_ref  = ($1 || $2 || $3)&.strip
        @link_text = ($4 || $5 || $6)&.strip
      else
        @post_ref  = markup.strip
        @link_text = nil
      end
    end

    def render(context)
      site = context.registers[:site]
      post = find_post(site, @post_ref)

      if post
        baseurl = (context.registers[:site].config["baseurl"] || "").chomp("/")
        url = "#{baseurl}#{post.url}"
        "[#{@link_text || post.data['title']}](#{url})"
      else
        unless @@warned_refs.include?(@post_ref)
          @@warned_refs << @post_ref
          Jekyll.logger.warn "post_link:", "post not found: #{@post_ref} — rendering as plain text"
        end
        @link_text || @post_ref
      end
    end

    private

    def normalise_url(url)
      url.to_s.strip.sub(%r{^/+}, '').sub(%r{/+$}, '')
    end

    def find_post(site, ref)
      return nil unless ref

      ref_normalised = normalise_url(ref)
      allow_future   = site.config.fetch('future', false)

      site.posts.docs.find do |doc|
        # honour future: false even when Jekyll runs with --future (e.g. make dev)
        next false if !allow_future && doc.date.to_time > Time.now

        # match by URL slug (e.g. home-assistant/dashboard-astrometria-parte-1)
        next true if normalise_url(doc.url) == ref_normalised

        # match by relative_path without _posts/ prefix and extension
        post_name = doc.relative_path.to_s.sub(%r{^_posts/}, '').sub(%r{\.[^.]+$}, '')
        next true if normalise_url(post_name) == ref_normalised

        # match by bare date+slug (e.g. 2021-05-08-quantita-moto)
        slug = File.basename(doc.relative_path, '.*')
        date_str = doc.date.strftime('%Y-%m-%d')
        next true if "#{date_str}-#{slug}" == ref_normalised

        false
      end
    end
  end
end

Liquid::Template.register_tag('post_link', Jekyll::PostLinkTag)
