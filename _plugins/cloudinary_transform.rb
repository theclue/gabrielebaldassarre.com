require 'base64'

module Jekyll
  module CloudinaryTransform
    TRANSFORM_PRESETS = {
      'keystone' => {
        'low'    => 'e_distort:4p:2p:96p:0p:0p:100p:100p:98p/e_shadow:25,x_4,y_4/b_rgb:0f0f23',
        'medium' => 'e_distort:8p:5p:92p:0p:0p:100p:100p:95p/e_shadow:40,x_8,y_8/b_rgb:0f0f23',
        'high'   => 'e_distort:12p:8p:88p:0p:0p:100p:100p:90p/e_shadow:50,x_10,y_10/b_rgb:0f0f23'
      },
      'cinematic' => {
        'low'    => 'e_distort:4p:2p:96p:0p:0p:100p:100p:98p/e_shadow:25,x_4,y_4/b_rgb:0a0a1a/e_vignette:30',
        'medium' => 'e_distort:8p:5p:92p:0p:0p:100p:100p:95p/e_shadow:40,x_8,y_8/b_rgb:0a0a1a/e_vignette:60',
        'high'   => 'e_distort:12p:8p:88p:0p:0p:100p:100p:90p/e_shadow:50,x_10,y_10/b_rgb:0a0a1a/e_vignette:90'
      }
    }.freeze

    CIRCLE_BORDER = 'bo_2px_solid_white'.freeze

    # -- helpers --

    def self.cloud_name(context = nil)
      if context
        ENV['CLOUDINARY_CLOUD_NAME'] ||
          context.registers[:site].config.dig('cloudinary', 'cloud_name')
      else
        ENV['CLOUDINARY_CLOUD_NAME']
      end
    end

    def self.dev_bypass?
      ENV['JEKYLL_ENV'] == 'development'
    end

    def self.b64_encode(url)
      Base64.strict_encode64(url)
    end

    # Build Cloudinary URL for a circular logo
    # size: integer (e.g. 80 for nav, 60 for social overlay)
    def self.logo_circle_url(logo_path, size, context = nil)
      return logo_path if dev_bypass?

      name = cloud_name(context)
      return logo_path unless name

      [
        "https://res.cloudinary.com/#{name}/image/fetch",
        "c_fill,g_face,w_#{size},h_#{size},r_max,f_auto,q_auto,#{CIRCLE_BORDER}",
        logo_path
      ].join('/')
    end

    # Resolve logo reference: true → site_logo, string → custom, nil/false → none
    def self.resolve_logo(logo_ref, site)
      return nil if logo_ref.nil? || logo_ref == false
      return site.config['site_logo'] if logo_ref == true
      logo_ref.to_s
    end

    # Build Cloudinary URL for hero (overlay_image) with optional transform + logo
    def self.hero_url(image_path, header, site, context = nil)
      return image_path if dev_bypass?

      name = cloud_name(context)
      return image_path unless name

      parts = []

      # Transforms (before crop, so distortion fills the frame)
      transform_name = header['transform'].to_s
      intensity      = header['intensity'].to_s
      if TRANSFORM_PRESETS[transform_name] && TRANSFORM_PRESETS[transform_name][intensity]
        parts << TRANSFORM_PRESETS[transform_name][intensity]
      end

      # Base crop
      parts << 'c_fill,g_auto,w_1922,h_724,f_auto,q_auto'

      # Logo overlay (l_fetch: requires base64-encoded URL)
      logo_ref = header['logo']
      logo_path = resolve_logo(logo_ref, site)
      if logo_path
        logo_url = logo_circle_url(logo_path, 80, context)
        parts << "l_fetch:#{b64_encode(logo_url)},g_north_east,w_80,o_85,x_96,y_40"
        parts << 'fl_layer_apply'
      end

      "https://res.cloudinary.com/#{name}/image/fetch/#{parts.join('/')}/#{image_path}"
    end

    # Build Cloudinary URL for social image with transform + logo + caption
    def self.social_url(full_image_url, config, site, post_title = nil, width = 1200, height = 630)
      return full_image_url if dev_bypass?

      name = cloud_name
      return full_image_url unless name

      parts = []
      caption_text = nil
      caption_color = 'white'
      config_h = config.is_a?(Hash) ? config : {}

      # Transforms
      transform_name = config_h['transform'].to_s
      intensity      = config_h['intensity'].to_s
      if TRANSFORM_PRESETS[transform_name] && TRANSFORM_PRESETS[transform_name][intensity]
        parts << TRANSFORM_PRESETS[transform_name][intensity]
      end

      # Base crop
      parts << "c_fill,g_auto,w_#{width},h_#{height},f_auto,q_auto"

      # Caption
      caption_raw = config_h['caption']
      if caption_raw
        caption_text = caption_raw == true ? post_title : caption_raw.to_s
        caption_color = config_h['color'] || 'white'
        parts << 'e_gradient_fade:symmetric,50'
      end

      # Logo overlay (l_fetch: requires base64-encoded URL)
      logo_ref = config_h['logo']
      logo_path = resolve_logo(logo_ref, site)
      if logo_path
        logo_url = logo_circle_url(logo_path, 60)
        parts << "l_fetch:#{b64_encode(logo_url)},g_south_east,w_60,o_80,x_30,y_30"
        parts << 'fl_layer_apply'
      end

      # Text overlay
      if caption_text && !caption_text.empty?
        encoded = caption_text.gsub('%', '%25').gsub(',', '%2C').gsub(' ', '%20')
        parts << "l_text:Roboto_36_bold:#{encoded},co_#{caption_color},g_south_west,x_30,y_50,w_800,c_fit"
        parts << 'fl_layer_apply'
      end

      "https://res.cloudinary.com/#{name}/image/fetch/#{parts.join('/')}/#{full_image_url}"
    end

    # Liquid filter: page.master | cloudinary_hero: page.header
    def cloudinary_hero(image_path, header = {})
      site = @context.registers[:site]
      site_url = site.config['url']
      full_url = image_path.start_with?('http') ? image_path : "#{site_url}#{image_path}"
      CloudinaryTransform.hero_url(full_url, header || {}, site, @context)
    end

    # Liquid filter: site.site_logo | cloudinary_logo: 80
    def cloudinary_logo(logo_path, size = 80)
      CloudinaryTransform.logo_circle_url(logo_path, size.to_i, @context)
    end
  end
end

Liquid::Template.register_filter(Jekyll::CloudinaryTransform)
