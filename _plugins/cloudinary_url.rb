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

      # Parse path (first word before any key=value)
      # If first word is not a path but second is, skip the first (legacy preset)
      if markup =~ /\A\s*(\S+)\s+(\/\S+)(.*)\z/m
        # Second word starts with / → it's the real path
        @path = $2
        rest = $1 + " " + ($3 || "")
      elsif markup =~ /\A\s*(\S+)(.*)\z/m
        @path = $1
        rest = $2
      end
      if @path
        if rest =~ /alt\s*=\s*"(.*?)"/
          @alt = $1
        end
        if rest =~ /caption\s*=\s*"(.*?)"/
          @caption = $1
        end
        if rest =~ /loading\s*=\s*"(.*?)"/
          @loading = $1
        end
      end
    end

    def render(context)
      return "" if @path.nil? || @path.empty?

      path = @path
      # Make relative paths absolute
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

      img_tag = %(<img src="#{src}" alt="#{@alt}" loading="#{@loading}" decoding="async">)

      if @caption
        %(<figure class="align-center">#{img_tag}<figcaption>#{@caption}</figcaption></figure>)
      else
        %(<figure class="align-center">#{img_tag}</figure>)
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::CloudinaryUrl)
Liquid::Template.register_tag("cloudinary", Jekyll::CloudinaryTag)
