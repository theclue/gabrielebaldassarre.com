require 'shellwords'

module Jekyll
  class RepoUrlTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      args = Shellwords.shellsplit(markup.strip)
      @path = args[0]&.sub(%r{^/}, '')
      @link_text = args[1]
      @role    = Jekyll::LinkMeta.extract_kv(markup.to_s, 'role')
      @context = Jekyll::LinkMeta.extract_kv(markup.to_s, 'context')
      @target  = Jekyll::LinkMeta.extract_kv(markup.to_s, 'target')
    end

    def render(context)
      site = context.registers[:site]
      repo = site.config['repository']
      text = @link_text || @path

      unless repo
        Jekyll.logger.warn "repo_url:", "repository not set in _config.yml"
        return text
      end

      if @path.to_s.empty? || @path.to_s.include?('..')
        Jekyll.logger.warn "repo_url:", "invalid path: #{@path.inspect} — rendering as plain text"
        return text
      end

      source_root = site.source
      full_path = File.expand_path(File.join(source_root, @path))
      unless full_path.start_with?(File.expand_path(source_root) + File::SEPARATOR)
        Jekyll.logger.warn "repo_url:", "path escapes source root: #{@path} — rendering as plain text"
        return text
      end

      if File.exist?(full_path)
        url = "https://github.com/#{repo}/blob/main/#{@path}"

        if @role
          page = context.registers[:page]
          page['link_objects'] ||= []
          meta = Jekyll::LinkMeta.validated({
            'url' => url, 'text' => text,
            'role' => @role, 'context' => @context, 'target' => @target || 'external-authoritative',
            'name' => (@link_text || File.basename(@path.to_s, '.*'))
          })
          page['link_objects'] << meta if meta
        end

        icon_name = 'github'
        icon_svg = Jekyll::LinkMeta.icon_svg(icon_name)
        %(<a href="#{url}">#{text}#{icon_svg}</a>)
      else
        Jekyll.logger.warn "repo_url:", "file not found: #{@path} — rendering as plain text"
        text
      end
    end
  end
end

Liquid::Template.register_tag('repo_url', Jekyll::RepoUrlTag)
