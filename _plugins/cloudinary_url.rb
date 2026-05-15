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
end

Liquid::Template.register_filter(Jekyll::CloudinaryUrl)
