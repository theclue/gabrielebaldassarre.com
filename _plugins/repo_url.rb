require 'shellwords'

module Jekyll
  class RepoUrlTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      args = Shellwords.shellsplit(markup.strip)
      @path = args[0]&.sub(%r{^/}, '')
      @link_text = args[1]
    end

    def render(context)
      site = context.registers[:site]
      repo = site.config['repository']

      unless repo
        Jekyll.logger.warn "repo_url:", "repository not set in _config.yml"
        return @link_text || @path
      end

      source_root = site.source
      full_path = File.join(source_root, @path)

      if File.exist?(full_path)
        url = "https://github.com/#{repo}/blob/main/#{@path}"
        %(<a href="#{url}">#{@link_text || @path}</a>)
      else
        Jekyll.logger.warn "repo_url:", "file not found: #{@path} — rendering as plain text"
        @link_text || @path
      end
    end
  end
end

Liquid::Template.register_tag('repo_url', Jekyll::RepoUrlTag)
