module Jekyll
  module Difficulty
    AUDIENCES = %w[general curious student practitioner specialist].freeze
    PROFICIENCIES = %w[beginner intermediate advanced expert].freeze
    IMPORTANCES = %w[required recommended helpful].freeze

    # ── Composite difficulty indicator ──────────────────────────────────
    # Usa: declared (autore/LLM) + lexical (Gulpease) + semantic (LLM deep)
    def self.composite_index(post)
      data = post.data
      readability = data['readability'] || {}
      decl = data['difficulty_declared'] || {}
      sem = (data['difficulty_computed'] || {})['semantic'] || {}

      # Declared average
      declared_avg = 0
      count = 0
      %w[conceptual technical mathematical].each do |axis|
        val = decl[axis].to_i
        next if val <= 0
        declared_avg += val
        count += 1
      end
      declared_avg = count > 0 ? declared_avg.to_f / count : 0

      # Lexical score from Gulpease (0=trivial, 5=extremely hard)
      gulpease = readability['gulpease'].to_f
      lexical_score = gulpease > 0 ? ((100 - gulpease) / 20.0).clamp(0, 5) : 0

      # Semantic score from LLM-injected metrics
      concept_density = sem['concept_density'].to_f
      prerequisite_depth = sem['prerequisite_depth'].to_f
      def_cov = sem['definition_coverage'].to_f
      ext_knowledge = sem['external_knowledge_demand'].to_i
      blocking = sem['blocking_prerequisite_count'].to_i
      math_density = sem['math_density'].to_f
      code_density = sem['code_density'].to_f

      # Inverse definition coverage: low coverage → harder
      inv_def_cov = def_cov > 0 ? (1.0 - def_cov) * 5 : 2.5

      # Knowledge gap: unlinked undefended concepts per paragraph
      knowledge_gap = concept_density > 0 ? (ext_knowledge.to_f / [concept_density, 0.1].max).clamp(0, 5) : 0

      # Blocking prerequisite pressure
      blocking_pressure = [blocking * 0.6, 3.0].min

      # Technical density bonus from math + code
      technical_density = ((math_density + code_density) / 2.0).clamp(0, 5)

      semantic_score = (
        (concept_density.clamp(0, 5) * 0.20) +
        (prerequisite_depth.clamp(0, 5) * 0.25) +
        (inv_def_cov.clamp(0, 5) * 0.15) +
        (knowledge_gap * 0.15) +
        (blocking_pressure * 0.15) +
        (technical_density * 0.10)
      ).clamp(0, 5)

      # Weighted composite: 40% declared, 30% lexical, 30% semantic
      declared_weight = declared_avg > 0 ? 0.4 : 0
      lexical_weight = lexical_score > 0 ? 0.3 : 0
      semantic_weight = semantic_score > 0 ? 0.3 : 0
      total_weight = declared_weight + lexical_weight + semantic_weight

      if total_weight > 0
        composite = (declared_avg * declared_weight + lexical_score * lexical_weight + semantic_score * semantic_weight) / total_weight
      else
        composite = 0
      end

      composite.round(1)
    end

    def self.difficulty_label(composite)
      case composite
      when 0..2   then 'difficulty_accessible'
      when 2..3   then 'difficulty_intermediate'
      when 3..4   then 'difficulty_advanced'
      else             'difficulty_expert'
      end
    end

    # ── Inject computed layer at build time ─────────────────────────────
    # LLM has already populated:
    #   - difficulty_computed.semantic (qualitative metrics)
    #   - knowledge_prerequisites (concept list with grounding)
    # This method:
    #   1. Merges lexical data from readability plugin
    #   2. Recomputes composite score
    #   3. Generates display strings
    def self.inject_computed(post)
      data = post.data

      # Guard: skip if already fully computed (incremental builds)
      # We still run if difficulty_label is missing (LLM did semantic, we need to finish)
      return if data['difficulty_computed'] && data['difficulty_label'] && data['difficulty_composite']

      readability = data['readability'] || {}

      # Build lexical block from readability data
      lexical = {
        'flesch_reading_ease' => readability['flesch_vacca'],
        'gulpease' => readability['gulpease'],
        'avg_sentence_length' => readability['avg_sentence_length'],
        'word_count' => readability['word_count'],
        'reading_time_minutes' => [((readability['word_count'].to_f / 150.0).ceil), 1].max
      }

      # Merge: preserve LLM semantic, add/overwrite lexical
      existing = data['difficulty_computed'] || {}
      semantic = existing['semantic'] || {}

      data['difficulty_computed'] = {
        'lexical' => lexical,
        'semantic' => semantic
      }

      # Compute composite and label
      composite = composite_index(post)
      data['difficulty_composite'] = composite
      data['difficulty_label'] = difficulty_label(composite)
      data['difficulty_audience_key'] = data['intended_audience']

      # Display strings for template
      decl = data['difficulty_declared'] || {}
      if decl['conceptual'].to_i > 0 || decl['technical'].to_i > 0 || decl['mathematical'].to_i > 0
        loc = (post.site.data.dig('ui-text', post.site.config['locale']) || {})
        c_label = loc['difficulty_axis_conceptual'] || 'Conceptual'
        t_label = loc['difficulty_axis_technical'] || 'Technical'
        m_label = loc['difficulty_axis_mathematical'] || 'Mathematical'
        data['difficulty_declared_display'] = "#{c_label} #{decl['conceptual']}, #{t_label} #{decl['technical']}, #{m_label} #{decl['mathematical']}"
      end

      gulpease_val = (readability['gulpease'] || 0).to_f
      if gulpease_val > 0
        data['difficulty_gulpease_display'] = gulpease_val.round(1).to_s
      end

      if composite > 0
        data['difficulty_composite_display'] = "#{composite.round(1)}/5"
      end

      # Post-meta enrichment from knowledge_prerequisites
      prereqs = data['knowledge_prerequisites'] || []
      if prereqs.any?
        required = prereqs.select { |p| p['importance'] == 'required' }.map { |p| p['label'] || p['concept'] }
        data['difficulty_prereqs_required'] = required.join(', ') unless required.empty?
      end

      # ── Validation warnings ───────────────────────────────────────────
      audience = data['intended_audience'].to_s
      proficiency = data['proficiency_level'].to_s
      gulpease = (readability['gulpease'] || 100).to_f
      required_prereqs = prereqs.count { |p| p['importance'] == 'required' }
      concept_density = semantic['concept_density'].to_f
      def_coverage = semantic['definition_coverage'].to_f
      ext_knowledge = semantic['external_knowledge_demand'].to_i
      reading_time = lexical['reading_time_minutes'].to_i
      blocking = semantic['blocking_prerequisite_count'].to_i
      declared_vals = [decl['conceptual'].to_i, decl['technical'].to_i, decl['mathematical'].to_i].select(&:positive?)
      declared_avg = declared_vals.empty? ? 0 : declared_vals.sum.to_f / declared_vals.size
      math_density = semantic['math_density'].to_f
      code_density = semantic['code_density'].to_f

      if proficiency == 'beginner' && gulpease < 50
        Jekyll.logger.warn "difficulty:", "#{post.url}: proficiency=beginner ma Gulpease=#{gulpease.round(1)} (difficile da leggere)"
      end
      if proficiency == 'beginner' && required_prereqs > 2
        Jekyll.logger.warn "difficulty:", "#{post.url}: proficiency=beginner ma #{required_prereqs} prerequisiti required"
      end
      if audience == 'general' && concept_density > 3
        Jekyll.logger.warn "difficulty:", "#{post.url}: audience=general ma concept_density=#{concept_density}"
      end
      if def_coverage > 0 && def_coverage < 0.5
        Jekyll.logger.warn "difficulty:", "#{post.url}: bassa definition_coverage=#{def_coverage}"
      end
      if %w[general curious].include?(audience) && ext_knowledge > 3
        Jekyll.logger.warn "difficulty:", "#{post.url}: audience=#{audience} ma external_knowledge=#{ext_knowledge}"
      end
      if reading_time > 15
        Jekyll.logger.info "difficulty:", "#{post.url}: reading_time=#{reading_time}min (>15)"
      end
      if declared_avg > 0 && composite > 0 && (declared_avg - composite).abs > 1.5
        Jekyll.logger.warn "difficulty:", "#{post.url}: declared_avg=#{declared_avg.round(1)} ma computed_composite=#{composite.round(1)}"
      end
      if blocking > 0 && proficiency == 'beginner'
        Jekyll.logger.warn "difficulty:", "#{post.url}: proficiency=beginner ma #{blocking} prerequisiti bloccanti"
      end
      if math_density > 2.0 && proficiency == 'beginner'
        Jekyll.logger.warn "difficulty:", "#{post.url}: proficiency=beginner ma math_density=#{math_density} (alta)"
      end
      if code_density > 5.0 && proficiency == 'beginner'
        Jekyll.logger.warn "difficulty:", "#{post.url}: proficiency=beginner ma code_density=#{code_density} (alta)"
      end
    end

    # ── Terms Dictionary: auto-populated at build time ──────────────────
    # Scans all posts' knowledge_prerequisites, deduplicates by `concept`,
    # and builds a canonical dictionary. Stored in site.data['termsdictionary'].
    def self.build_termsdictionary(site)
      dict = {}
      site.posts.docs.each do |post|
        prereqs = post.data['knowledge_prerequisites'] || []
        prereqs.each do |p|
          concept = p['concept'].to_s.strip.downcase
          next if concept.empty?

          dict[concept] ||= {
            'concept' => concept,
            'label' => p['label'] || concept,
            'url' => p['url'],
            'sameAs' => p['sameAs'],
            'depth' => p['depth'],
            'post_count' => 0,
            'posts' => []
          }

          dict[concept]['post_count'] += 1
          dict[concept]['posts'] << post.url unless dict[concept]['posts'].include?(post.url)

          # Merge: if a later post has url/sameAs where earlier didn't, adopt it
          dict[concept]['url'] ||= p['url']
          dict[concept]['sameAs'] ||= p['sameAs']
          dict[concept]['depth'] = [dict[concept]['depth'].to_i, p['depth'].to_i].max
        end
      end

      # Also merge in the hardcoded glossary for backward compatibility
      glossary = site.data['glossary'] || []
      glossary.each do |entry|
        concept = entry['term'].to_s.strip.downcase.gsub(/\s+/, '-').gsub(/[^a-z0-9\-]/, '')
        next if concept.empty?

        dict[concept] ||= {
          'concept' => concept,
          'label' => entry['term'],
          'url' => entry['url'],
          'sameAs' => nil,
          'depth' => 2,
          'post_count' => 0,
          'posts' => []
        }
        # Don't overwrite if already exists from posts
        dict[concept]['label'] ||= entry['term']
        dict[concept]['url'] ||= entry['url']
      end

      # Store sorted by post_count descending
      sorted = dict.values.sort_by { |e| -e['post_count'].to_i }
      site.data['termsdictionary'] = sorted
      Jekyll.logger.info "difficulty:", "termsdictionary built with #{sorted.size} terms from #{site.posts.docs.size} posts"
    end
  end
end

Jekyll::Hooks.register :site, :pre_render do |site, payload|
  Jekyll::Difficulty.build_termsdictionary(site)
  site.posts.docs.each do |post|
    Jekyll::Difficulty.inject_computed(post)
  end
end
