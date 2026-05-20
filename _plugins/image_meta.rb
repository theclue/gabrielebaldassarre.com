module Jekyll
  module ImageMeta
    VALID_ROLES = %w[decorative screenshot diagram chart photo illustration code].freeze
    VALID_CONTEXTS = %w[step result architecture comparison reference evidence ambient].freeze

    # Parse image metadata from frontmatter or tag parameters
    def self.parse(hash)
      return nil unless hash

      role = hash['role'].to_s.strip
      return nil if role.empty? || !VALID_ROLES.include?(role)

      context = hash['context'].to_s.strip
      context = nil if context.empty? || !VALID_CONTEXTS.include?(context)

      meta = {
        'role' => role,
        'context' => context,
        'caption' => hash['caption'].to_s.strip,
        'long_description' => hash['long_description'].to_s.strip,
        'step' => hash['step'].to_i,
        'compare_with' => hash['compare_with'].to_s.strip,
        'representativeOfPage' => hash['representativeOfPage'].to_s == 'true'
      }

      meta.delete('caption') if meta['caption'].empty?
      meta.delete('long_description') if meta['long_description'].empty?
      meta.delete('step') if meta['step'] == 0
      meta.delete('compare_with') if meta['compare_with'].empty?

      # Validation: step requires context=step
      if meta['step'].to_i > 0 && context != 'step'
        Jekyll.logger.warn "image_meta:", "step=#{meta['step']} ignored — context is '#{context}', not 'step'"
        meta.delete('step')
      end

      # Validation: compare_with requires context=comparison
      if meta['compare_with'] && context != 'comparison'
        Jekyll.logger.warn "image_meta:", "compare_with ignored — context is '#{context}', not 'comparison'"
        meta.delete('compare_with')
      end

      # Validation: diagram + chart require long_description
      if %w[diagram chart].include?(role) && !meta['long_description']
        Jekyll.logger.warn "image_meta:", "role '#{role}' requires long_description — missing for #{hash['src'] || 'unknown'}"
      end

      meta
    end
  end
end

Jekyll::Hooks.register :site, :pre_render do |site, payload|
  site.posts.docs.each do |post|
    data = post.data
    next if data['image_objects']

    objects = []

    # Master image
    master = data['master']
    image_meta_raw = data['image_meta']
    if master
      meta = Jekyll::ImageMeta.parse(image_meta_raw.is_a?(Hash) ? image_meta_raw : {})
      if meta && meta['role'] != 'decorative'
        meta['src'] = master
        meta['contentUrl'] = "#{site.config['url']}#{master}"
        objects << meta
      end
    end

    # Body images via {% cloudinary %} — collected by cloudinary_url.rb during render
    # The cloudinary tag populates page.image_meta_body as a side effect
    body_images = data['image_meta_body']
    if body_images.is_a?(Array)
      body_images.each do |entry|
        meta = Jekyll::ImageMeta.parse(entry)
        if meta && meta['role'] != 'decorative'
          meta['src'] = entry['src']
          meta['contentUrl'] = "#{site.config['url']}#{entry['src']}"
          objects << meta
        end
      end
    end

    data['image_objects'] = objects unless objects.empty?
  end
end
