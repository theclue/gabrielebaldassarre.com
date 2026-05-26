# frozen_string_literal: true

require 'set'

module Jekyll
  module ValidateFrontmatter
    def self.parse_schema_lines(path)
      lines = File.readlines(path)
      fields = []
      parents = []
      array_parents = Set.new

      lines.each do |line|
        stripped = line.strip
        next if stripped.empty? || stripped.start_with?('#')

        indent = line.index(/\S/) || 0
        dash = stripped.start_with?('-')

        # Section headers reset parents
        if stripped =~ /^#\s*──/
          parents = []
          next
        end

        # Child field (indented >= 2) — skip array items (- field)
        if indent >= 2 && line =~ /^(\s{2,})-?\s?(\w[\w_]*):\s+(.+?)\s+#/
          field_name = $2
          type_spec  = $3.strip
          level = indent / 2

          if dash
            array_parents.add(parents.dup)
            next
          end

          path = parents[0...level] + [field_name]
          unless array_parents.include?(parents[0...level])
            fields << { path: path, type: type_spec }
          end
          next
        end

        # Parent map header (field: with no value)
        if line =~ /^(\w[\w_]*):\s*$/
          name = $1
          parents = if indent == 0
            [name]
          else
            level = indent / 2
            parents.first(level - 1) + [name]
          end
          next
        end

        # Root-level field (field: value)
        if line =~ /^(\w[\w_]*):\s+(.+?)\s+#/
          field_name = $1
          type_spec  = $2.strip
          parents = []
          fields << { path: [field_name], type: type_spec }
        end
      end

      fields
    end

    def self.optional?(type_spec)
      type_spec.end_with?('?')
    end

    def self.array_type?(type_spec)
      type_spec.start_with?('[')
    end

    def self.enum?(type_spec)
      type_spec.include?('"') && type_spec.include?('|')
    end

    def self.enum_values(type_spec)
      type_spec.scan(/"([^"]+)"/).flatten
    end

    def self.image_field?(path)
      last = path.last
      %w[master overlay_image teaser og_image logo].include?(last) ||
        last.end_with?('_image') || last.end_with?('_img')
    end

    def self.integer_type?(type_spec)
      type_spec.include?('integer') || type_spec.include?('0-5') || type_spec.include?('1-5')
    end

    def self.number_type?(type_spec)
      type_spec.include?('number')
    end

    def self.string_type?(type_spec)
      type_spec.include?('string') || enum?(type_spec)
    end

    def self.dig(hash, keys)
      keys.reduce(hash) { |d, k| d.is_a?(Hash) ? d[k] : nil }
    end

    def self.asset_exists?(site, path)
      return true unless path.is_a?(String)
      return true unless path.start_with?('/assets/')
      File.exist?(File.join(site.source, path.delete_prefix('/')))
    end

    Jekyll::Hooks.register :site, :post_read do |site|
      schema_path = File.join(site.source, 'frontmatter-schema.yml')
      fields = parse_schema_lines(schema_path)
      warn_count = 0
      ok = 0

      site.posts.docs.each do |post|
        data = post.data
        src = post.relative_path.to_s
        post_warnings = 0

        fields.each do |field|
          path = field[:path]
          type = field[:type]
          val  = dig(data, path)

          # ── Skip children of array-type or missing parents ──
          if path.size > 1
            parent_keys = path[0...-1]
            parent_val  = dig(data, parent_keys)

            # If parent doesn't exist at all, skip validation (e.g. mermaid.direction)
            next if parent_val.nil?

            # If parent is an array, these are item templates, not fields of the array itself
            # Find the parent field's type
            parent_field = fields.find { |f| f[:path] == parent_keys }
            next if parent_field && array_type?(parent_field[:type])
          end

          # ── Required check (no ? in type, string type) ──
          if !optional?(type) && string_type?(type)
            unless val.is_a?(String) && !val.to_s.strip.empty?
              Jekyll.logger.warn "validate:", "#{src}: required field '#{path.join('.')}' missing or empty"
              post_warnings += 1
            end
          end

          # ── Enum validation ──
          if enum?(type) && val
            allowed = enum_values(type)
            unless allowed.include?(val.to_s)
              Jekyll.logger.warn "validate:", "#{src}: #{path.join('.')} = '#{val}' is not in #{allowed}"
              post_warnings += 1
            end
          end

          # ── Type check (only when field present) ──
          next unless val

          if integer_type?(type) && !val.is_a?(Integer)
            Jekyll.logger.warn "validate:", "#{src}: #{path.join('.')} = #{val.inspect} should be integer (got #{val.class})"
            post_warnings += 1
          end

          if number_type?(type) && !val.is_a?(Numeric) && !val.is_a?(Integer)
            Jekyll.logger.warn "validate:", "#{src}: #{path.join('.')} = #{val.inspect} should be numeric"
            post_warnings += 1
          end

          # ── Range checks ──
          last = path.last
          if %w[conceptual technical mathematical].include?(last) && val.is_a?(Numeric)
            unless val >= 0 && val <= 5
              Jekyll.logger.warn "validate:", "#{src}: #{path.join('.')} = #{val} out of range (0-5)"
              post_warnings += 1
            end
          end

          if last == 'overlay_filter' && val.is_a?(Numeric)
            unless val >= 0 && val <= 1
              Jekyll.logger.warn "validate:", "#{src}: overlay_filter = #{val} out of range (0-1)"
              post_warnings += 1
            end
          end

          # ── Image existence ──
          if image_field?(path) && val.is_a?(String) && val.start_with?('/assets/')
            unless asset_exists?(site, val)
              Jekyll.logger.warn "validate:", "#{src}: image not found: #{path.join('.')} = #{val}"
              post_warnings += 1
            end
          end
        end

        # ── broadcast channels (array of enums) ──
        channels = data.dig('broadcast', 'channels')
        if channels.is_a?(Array)
          allowed = %w[linkedin mastodon bluesky youtube]
          channels.each do |ch|
            next if allowed.include?(ch.to_s)
            Jekyll.logger.warn "validate:", "#{src}: broadcast.channels '#{ch}' not in #{allowed}"
            post_warnings += 1
          end
        end

        # ── series consistency ──
        part  = data.dig('series', 'part')
        total = data.dig('series', 'total_parts')
        if part.is_a?(Integer) && total.is_a?(Integer) && part > total
          Jekyll.logger.warn "validate:", "#{src}: series.part (#{part}) > series.total_parts (#{total})"
          post_warnings += 1
        end

        warn_count += post_warnings
        ok += 1
      end

      Jekyll.logger.info "validate:", "#{ok} posts checked (#{fields.size} schema fields), #{warn_count} warning(s)"
    end
  end
end
