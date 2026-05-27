require 'base64'

module Jekyll
  module CloudinaryTransform
    TRANSFORM_PRESETS = {
      'keystone' => {
        'low'    => 'b_rgb:0f0f23/e_distort:1p:1p:94p:10p:100p:100p:0p:95p',
        'medium' => 'b_rgb:0f0f23/e_distort:2p:2p:88p:15p:100p:100p:0p:95p',
        'high'   => 'b_rgb:0f0f23/e_distort:4p:3p:82p:20p:100p:100p:0p:95p'
      },
      'cinematic' => {
        'low'    => 'b_rgb:0a0a1a/e_distort:1p:1p:94p:10p:100p:100p:0p:95p',
        'medium' => 'b_rgb:0a0a1a/e_distort:2p:2p:88p:15p:100p:100p:0p:95p',
        'high'   => 'b_rgb:0a0a1a/e_distort:4p:3p:82p:20p:100p:100p:0p:95p'
      }
    }.freeze

    # Safe crop after distortion: anchors to top-left (north_west), removes background fill
    CROP_BY_INTENSITY = {
      'low'    => 'c_crop,g_north_west,x_0.01,y_0.12,w_0.93,h_0.52',
      'medium' => 'c_crop,g_north_west,x_0.02,y_0.18,w_0.85,h_0.48',
      'high'   => 'c_crop,g_north_west,x_0.04,y_0.22,w_0.78,h_0.42'
    }.freeze

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

    # Build Cloudinary URL for a circular logo (expects full remote URL)
    def self.logo_circle_url(full_logo_url, size)
      return full_logo_url if dev_bypass?

      name = cloud_name
      return full_logo_url unless name

      "https://res.cloudinary.com/#{name}/image/fetch/" \
        "c_fill,g_face,w_#{size},h_#{size},r_max,f_auto,q_auto,#{CIRCLE_BORDER}/" \
        "#{full_logo_url}"
    end

    # Resolve logo reference: true → site_logo, string → custom, nil/false → none
    def self.resolve_logo(logo_ref, site)
      return nil if logo_ref.nil? || logo_ref == false
      return site.config['site_logo'] if logo_ref == true
      logo_ref.to_s
    end

    # Build Cloudinary URL for hero (overlay_image) with optional transform + logo
    def self.hero_url(image_path, header, site, context = nil, width = 1922, height = 724)
      return image_path if dev_bypass?

      name = cloud_name(context)
      return image_path unless name

      parts = []

      # Transforms (distortion + background)
      transform_name = header['transform'].to_s
      intensity      = header['intensity'].to_s
      has_transform = TRANSFORM_PRESETS[transform_name] && TRANSFORM_PRESETS[transform_name][intensity]
      if has_transform
        parts << has_transform
        parts << CROP_BY_INTENSITY[intensity] || CROP_BY_INTENSITY['medium']
        parts << "c_fill,g_auto,w_#{width},h_#{height},f_auto,q_auto"
      else
        parts << "c_fill,g_auto,w_#{width},h_#{height},f_auto,q_auto"
      end

      # Logo overlay: raw fetch + transforms inline, placement in fl_layer_apply
      logo_ref = header['logo']
      logo_path = resolve_logo(logo_ref, site)
      if logo_path
        logo_full_url = logo_path.start_with?('http') ? logo_path : "#{site.config['url']}#{logo_path}"
        parts << "l_fetch:#{b64_encode(logo_full_url)},c_fill,g_face,w_80,h_80,r_max,bo_2px_solid_white"
        parts << 'fl_layer_apply,g_north_east,o_85,x_96,y_40'
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

      # Transforms (distortion + background)
      transform_name = config_h['transform'].to_s
      intensity      = config_h['intensity'].to_s
      has_transform = TRANSFORM_PRESETS[transform_name] && TRANSFORM_PRESETS[transform_name][intensity]
      if has_transform
        parts << has_transform
        parts << (CROP_BY_INTENSITY[intensity] || CROP_BY_INTENSITY['medium'])
        parts << "c_fill,g_auto,w_#{width},h_#{height},f_auto,q_auto"
      else
        parts << "c_fill,g_auto,w_#{width},h_#{height},f_auto,q_auto"
      end

      # Caption
      caption_raw = config_h['caption']
      if caption_raw
        caption_text = caption_raw == true ? post_title : caption_raw.to_s
        caption_color = config_h['color'] || 'white'

        # Letterbox: semi-transparent black bar behind text+logo (only when caption present)
        bar_url = "#{site.config['url']}/assets/images/1x1-black.png"
        parts << "l_fetch:#{b64_encode(bar_url)},c_scale,w_#{width},h_120,o_80"
        parts << 'fl_layer_apply,g_south'
      end

      # Logo overlay: bigger (w_70), pushes top edge up, more room for 2-line caption
      logo_ref = config_h['logo']
      logo_path = resolve_logo(logo_ref, site)
      if logo_path
        logo_full_url = logo_path.start_with?('http') ? logo_path : "#{site.config['url']}#{logo_path}"
        parts << "l_fetch:#{b64_encode(logo_full_url)},c_fill,g_face,w_70,h_70,r_max,bo_2px_solid_white"
        parts << 'fl_layer_apply,g_south_east,o_80,x_25,y_25'
      end

      # Text width: image width minus logo area (~70px) and margins (~130px)
      text_w = width - 200

      # Text overlay: if caption contains ':', split into 2 lines (1st smaller)
      if caption_text && !caption_text.empty?
        if caption_text.include?(':')
          first, second = caption_text.split(':', 2)
          first = "#{first.strip}:"
          second = second.strip
          # First line: smaller, positioned higher, colon appended
          enc1 = first.gsub('%', '%25').gsub(',', '%252C').gsub(':', '%3A').gsub(' ', '%20').gsub('#', '%23').gsub('?', '%3F').gsub('/', '%2F').gsub('&', '%26').gsub('=', '%3D').gsub('\\', '%5C').gsub('+', '%2B')
          parts << "l_text:Roboto@google_28_700:#{enc1},co_#{caption_color},w_#{text_w},c_fit"
          parts << 'fl_layer_apply,g_south_west,x_25,y_70'
          enc2 = second.gsub('%', '%25').gsub(',', '%252C').gsub(':', '%3A').gsub(' ', '%20').gsub('#', '%23').gsub('?', '%3F').gsub('/', '%2F').gsub('&', '%26').gsub('=', '%3D').gsub('\\', '%5C').gsub('+', '%2B')
          parts << "l_text:Roboto@google_36_700:#{enc2},co_#{caption_color},w_#{text_w},c_fit"
          parts << 'fl_layer_apply,g_south_west,x_25,y_30'
        else
          encoded = caption_text.gsub('%', '%25').gsub(',', '%252C').gsub(':', '%3A').gsub(' ', '%20').gsub('#', '%23').gsub('?', '%3F').gsub('/', '%2F').gsub('&', '%26').gsub('=', '%3D').gsub('\\', '%5C').gsub('+', '%2B')
          parts << "l_text:Roboto@google_38_700:#{encoded},co_#{caption_color},w_#{text_w},c_fit"
          parts << 'fl_layer_apply,g_south_west,x_25,y_30'
        end
      end

      "https://res.cloudinary.com/#{name}/image/fetch/#{parts.join('/')}/#{full_image_url}"
    end

    # Liquid filter: page.master | cloudinary_hero: page.header
    def cloudinary_hero(image_path, header = {})
      return image_path if CloudinaryTransform.dev_bypass?

      site = @context.registers[:site]
      site_url = site.config['url']
      full_url = image_path.start_with?('http') ? image_path : "#{site_url}#{image_path}"
      CloudinaryTransform.hero_url(full_url, header || {}, site, @context)
    end

    # Liquid filter: post.master | cloudinary_card: post.header, 600, 340
    def cloudinary_card(image_path, header = {}, width = 600, height = 340)
      return image_path if CloudinaryTransform.dev_bypass?

      site = @context.registers[:site]
      site_url = site.config['url']
      full_url = image_path.start_with?('http') ? image_path : "#{site_url}#{image_path}"
      CloudinaryTransform.hero_url(full_url, header || {}, site, @context, width, height)
    end

    # Liquid filter: site.site_logo | cloudinary_logo: 80
    def cloudinary_logo(logo_path, size = 80)
      return logo_path if CloudinaryTransform.dev_bypass?
      site = @context.registers[:site]
      site_url = site.config['url']
      cloud_name = CloudinaryTransform.cloud_name(@context)
      full_url = logo_path.start_with?('http') ? logo_path : "#{site_url}#{logo_path}"
      "https://res.cloudinary.com/#{cloud_name}/image/fetch/w_#{size},h_#{size},c_fit,f_auto,q_auto/#{full_url}"
    end
  end
end

Liquid::Template.register_filter(Jekyll::CloudinaryTransform)
