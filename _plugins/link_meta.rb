require 'uri'

module Jekyll
  module LinkMeta
    ROLES = %w[citation source definition tool prerequisite deepening related self demo download attribution commercial].freeze
    CONTEXTS = %w[supports-claim provides-context enables-step validates-result credits-author offers-alternative extends-topic].freeze
    TARGETS = %w[internal external-authoritative external-community external-commercial external-ugc].freeze

    # Schema.org mapping: role → property name
    SCHEMA_MAP = {
      'citation'    => 'citation',
      'source'      => 'isBasedOn',
      'definition'  => 'about',
      'tool'        => 'mentions',
      'prerequisite'=> 'isBasedOn',
      'deepening'   => 'relatedLink',
      'related'     => 'relatedLink',
      'self'        => 'mainEntityOfPage',
      'demo'        => 'workExample',
      'download'    => 'downloadUrl',
      'attribution' => 'creator',
      'commercial'  => 'offers'
    }.freeze

    # target → HTML rel attribute
    TARGET_REL = {
      'internal'               => '',
      'external-authoritative' => 'external noopener',
      'external-community'     => 'external ugc noopener',
      'external-commercial'    => 'external sponsored noopener',
      'external-ugc'           => 'external ugc noopener'
    }.freeze

    ICON_FOR = {
      'external-authoritative' => 'open-in-new',
      'external-community'     => 'open-in-new',
      'external-commercial'    => 'open-in-new',
      'external-ugc'           => 'open-in-new',
      'download'               => 'download',
      'commercial'             => 'cart'
    }.freeze

    # SVG paths inlined to avoid {% include %} inside plugin output (not re-processed by Liquid)
    ICON_PATHS = {
      'open-in-new' => 'M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z',
      'download'    => 'M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z',
      'cart'        => 'M17,18C15.89,18 15,18.89 15,20A2,2 0 0,0 17,22A2,2 0 0,0 19,20C19,18.89 18.1,18 17,18M1,2V4H3L6.6,11.59L5.24,14.04C5.09,14.32 5,14.65 5,15A2,2 0 0,0 7,17H19V15H7.42A0.25,0.25 0 0,1 7.17,14.75L7.2,14.63L8.1,13H15.55C16.3,13 16.96,12.59 17.3,11.97L20.88,5.5C20.95,5.34 21,5.17 21,5A1,1 0 0,0 20,4H5.21L4.27,2M7,18C5.89,18 5,18.89 5,20A2,2 0 0,0 7,22A2,2 0 0,0 9,20C9,18.89 8.1,18 7,18Z',
      'github'      => 'M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z'
    }.freeze

    def self.icon_svg(name, css_class = 'link-icon')
      path = ICON_PATHS[name]
      return '' unless path
      %(<svg class="icon #{css_class}" aria-hidden="true" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="#{path}" /></svg>)
    end

    def self.parse(markup)
      params = {}
      params['url']  = extract(markup, 'url', 0)
      params['text'] = extract(markup, 'text', 1)
      params['role']    = extract_kv(markup, 'role')
      params['context'] = extract_kv(markup, 'context')
      params['target']  = extract_kv(markup, 'target')
      params['doi']       = extract_kv(markup, 'doi')
      params['file_type'] = extract_kv(markup, 'file_type')
      params['file_size'] = extract_kv(markup, 'file_size')
      params['disclosure']= extract_kv(markup, 'disclosure')
      params['name']      = extract_kv(markup, 'name')
      params.compact
    end

    def self.extract(markup, key, positional_index = nil)
      # Try key=value first
      val = extract_kv(markup, key)
      return val if val
      # Try positional (first/second quoted string)
      args = Shellwords.shellsplit(markup.strip) rescue []
      args[positional_index] if positional_index
    end

    def self.extract_kv(markup, key)
      escaped = Regexp.escape(key)
      if markup =~ /(?<![a-zA-Z_-])#{escaped}\s*=\s*"([^"]*)"/
        $1
      elsif markup =~ /(?<![a-zA-Z_-])#{escaped}\s*=\s*'([^']*)'/
        $1
      elsif markup =~ /(?<![a-zA-Z_-])#{escaped}\s*=\s*(\S+)/
        $1
      end
    end

    # Validate and normalise link metadata
    def self.validated(params)
      role    = params['role'].to_s.strip
      context = params['context'].to_s.strip
      target  = params['target'].to_s.strip
      url     = params['url'].to_s.strip

      return nil if role.empty? || !ROLES.include?(role)
      context = nil if context.empty? || !CONTEXTS.include?(context)
      target  = nil if target.empty? || !TARGETS.include?(target)

      result = {
        'url'         => url,
        'text'        => params['text'].to_s.strip,
        'role'        => role,
        'context'     => context,
        'target'      => target,
        'name'        => params['name'].to_s.strip,
        'schema_prop' => SCHEMA_MAP[role] || 'relatedLink',
        'doi'         => params['doi'].to_s.strip,
        'file_type'   => params['file_type'].to_s.strip,
        'file_size'   => params['file_size'].to_s.strip,
        'disclosure'  => params['disclosure'].to_s.strip
      }
      result.delete('text') if result['text'].empty?
      result.delete('name') if result['name'].empty?
      result.delete('doi') if result['doi'].empty?
      result.delete('file_type') if result['file_type'].empty?
      result.delete('file_size') if result['file_size'].empty?
      result.delete('disclosure') if result['disclosure'].empty?
      result
    end
  end

  # {% link "url" "text" role="..." context="..." target="..." %}
  class LinkTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @params = LinkMeta.parse(markup)
    end

    def render(context)
      meta = LinkMeta.validated(@params)
      return '' unless meta

      url         = meta['url']
      text        = meta['text'] || url
      target_type = meta['target'] || 'internal'
      role        = meta['role']

      # Canonical name: explicit or domain fallback
      meta['name'] ||= (URI.parse(url).host rescue url)

      # Build rel
      rel_parts = []
      rel = LinkMeta::TARGET_REL[target_type]
      rel_parts << rel unless rel.empty?
      rel_parts << 'nofollow' if %w[external-community external-ugc external-commercial].include?(target_type)
      if target_type == 'external-commercial'
        rel_parts.reject! { |r| r == 'nofollow' }
        rel_parts << 'sponsored'
      end
      rel_str = rel_parts.uniq.join(' ')
      rel_attr = rel_str.empty? ? '' : %( rel="#{rel_str}")

      # Build target
      target_attr = target_type.start_with?('external') ? ' target="_blank"' : ''

      # Icon for visual cue
      icon_name = LinkMeta::ICON_FOR[target_type] || LinkMeta::ICON_FOR[role]
      icon_svg = icon_name ? LinkMeta.icon_svg(icon_name) : ''

      # Disclosure for commercial links
      disc = meta['disclosure'] ? %( <span class="link-disclosure">(#{meta['disclosure']})</span>) : ''

      # File info for downloads
      file_info = ''
      if meta['file_type'] || meta['file_size']
        parts = [meta['file_type'], meta['file_size']].compact
        file_info = %( <span class="link-file-info">(#{parts.join(', ')})</span>)
      end

      # Register metadata for JSON-LD
      page = context.registers[:page]
      page['link_objects'] ||= []
      page['link_objects'] << meta.merge('contentUrl' => url)

      %(<a href="#{url}"#{rel_attr}#{target_attr} class="link-meta link-role-#{role}">#{text}#{icon_svg}</a>#{disc}#{file_info})
    end
  end
end

Liquid::Template.register_tag('xlink', Jekyll::LinkTag)
