require 'cgi'

Jekyll::Hooks.register :site, :post_read do |site|
  cloud_name = ENV["CLOUDINARY_CLOUD_NAME"]
  if cloud_name && !cloud_name.empty?
    site.config["cloudinary"] ||= {}
    site.config["cloudinary"]["cloud_name"] ||= cloud_name
  end
end

module Jekyll
  module CloudinaryUrl
    def cloudinary_url(path, transforms = "q_auto,f_auto")
      cloud_name = ENV["CLOUDINARY_CLOUD_NAME"] ||
                   @context.registers[:site].config.dig("cloudinary", "cloud_name")
      return path if cloud_name.nil? || cloud_name.empty?
      return path if ENV["JEKYLL_ENV"] == "development"

      site_url = @context.registers[:site].config["url"]
      "https://res.cloudinary.com/#{cloud_name}/image/fetch/#{transforms}/#{site_url}#{path}"
    end
  end

  class CloudinaryTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @path = nil
      @alt = ""
      @caption = nil
      @loading = "lazy"
      @transforms = "q_auto,f_auto"
      @role = nil
      @context = nil
      @step = nil
      @compare_with = nil
      @representative = nil
      @long_desc = nil

      # Parse path (first word before any key=value)
      if markup =~ /\A\s*(\S+)\s+(\/\S+)(.*)\z/m
        @path = $2
        rest = $1 + " " + ($3 || "")
      elsif markup =~ /\A\s*(\S+)(.*)\z/m
        @path = $1
        rest = $2
      end
      if @path
        @alt        = extract_attr(rest, 'alt')
        @caption    = extract_attr(rest, 'caption')
        @loading    = extract_attr(rest, 'loading') || @loading
        @role       = extract_attr(rest, 'role')
        @context    = extract_attr(rest, 'context')
        @step       = extract_attr(rest, 'step')
        @compare_with = extract_attr(rest, 'compare_with')
        @representative = extract_attr(rest, 'representativeOfPage')
        @long_desc  = extract_attr(rest, 'long_description')
        @width      = extract_attr(rest, 'width')
      end
    end

    def render(context)
      return "" if @path.nil? || @path.empty?

      path = @path
      unless path.start_with?("/") || path.start_with?("http")
        path = "/#{path}"
      end

      cloud_name = ENV["CLOUDINARY_CLOUD_NAME"] ||
                   context.registers[:site].config.dig("cloudinary", "cloud_name")

      is_prod = ENV["JEKYLL_ENV"] != "development" && !(cloud_name.nil? || cloud_name.empty?)

      if is_prod
        site_url = context.registers[:site].config["url"]
        src = "https://res.cloudinary.com/#{cloud_name}/image/fetch/#{@transforms}/#{site_url}#{path}"
      else
        src = path
      end

      # Register image metadata for SEO
      if @role
        tag_meta = {
          'src' => path,
          'role' => @role,
          'context' => @context,
          'caption' => @caption,
          'long_description' => @long_desc,
          'step' => @step,
          'compare_with' => @compare_with,
          'representativeOfPage' => @representative
        }.compact
        page = context.registers[:page]
        page['image_meta_body'] ||= []
        page['image_meta_body'] << tag_meta
      end

      # Build HTML based on role
      alt_attr = @role == 'decorative' ? '' : CGI.escapeHTML(@alt.to_s)
      src_attr = CGI.escapeHTML(src.to_s)
      loading_attr = CGI.escapeHTML(@loading.to_s)

      # Additional attributes
      extra_attrs = []
      extra_attrs << %(role="presentation") if @role == 'decorative'
      extra_attrs << %(itemprop="image") if @representative == 'true'

      img_tag = %(<img src="#{src_attr}" alt="#{alt_attr}" loading="#{loading_attr}" decoding="async") + extra_attrs.map { |a| " #{a}" }.join + ">"

      # Decorative: no figure, just img
      return img_tag if @role == 'decorative'

      # Figure attributes
      fig_classes = []
      fig_classes << 'align-center' << 'ambient-image' if @context == 'ambient'
      fig_classes << "img-width-#{@width}" if @width && @width.match?(/\A\d+\z/)
      
      fig_attrs = []
      fig_attrs << %(id="step-#{@step.to_i}-image") if @step && @context == 'step'
      fig_attrs << %(data-compare-with="#{@compare_with}") if @compare_with
      fig_attrs << %(class="#{fig_classes.join(' ')}") unless fig_classes.empty?
      fig_attrs_str = fig_attrs.empty? ? '' : " #{fig_attrs.join(' ')}"

      # Caption
      caption_parts = []
      caption_parts << @caption if @caption && !@caption.empty?

      # Long description for diagram/chart
      if @long_desc && !@long_desc.empty? && %w[diagram chart].include?(@role)
        caption_parts << %(<details class="long-description"><summary>Descrizione estesa</summary>#{@long_desc}</details>)
      end

      if caption_parts.empty?
        %(<figure#{fig_attrs_str}>#{img_tag}</figure>)
      else
        %(<figure#{fig_attrs_str}>#{img_tag}<figcaption>#{caption_parts.join(' ')}</figcaption></figure>)
      end
    end

    private

    def extract_attr(str, key)
      if str =~ /#{Regexp.escape(key)}\s*=\s*"([^"]*)"/
        $1
      elsif str =~ /#{Regexp.escape(key)}\s*=\s*(\S+)/
        $1
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::CloudinaryUrl)
Liquid::Template.register_tag("cloudinary", Jekyll::CloudinaryTag)
