module Jekyll
  module Difficulty
    AUDIENCES = %w[general curious student practitioner specialist].freeze
    PROFICIENCIES = %w[beginner intermediate advanced expert].freeze
    IMPORTANCES = %w[required recommended helpful].freeze

    # Composite difficulty indicator
    def self.composite_index(post)
      data = post.data
      readability = data['readability'] || {}
      decl = data['difficulty_declared'] || {}
      sem = (data['difficulty_computed'] || {})['semantic'] || {}

      declared_avg = 0
      count = 0
      %w[conceptual technical mathematical].each do |axis|
        val = decl[axis].to_i
        next if val <= 0
        declared_avg += val
        count += 1
      end
      declared_avg = count > 0 ? declared_avg.to_f / count : 0

      gulpease = readability['gulpease'].to_f
      lexical_score = gulpease > 0 ? ((100 - gulpease) / 20.0).clamp(0, 5) : 0

      concept_density = sem['concept_density'].to_f
      prerequisite_depth = sem['prerequisite_depth'].to_f
      def_cov = sem['definition_coverage'].to_f
      inv_def_cov = def_cov > 0 ? (1.0 - def_cov) * 5 : 2.5
      semantic_score = ((concept_density + prerequisite_depth + inv_def_cov) / 3.0).clamp(0, 5)

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

    # Inject computed layer + validation warnings at build time
    def self.inject_computed(post)
      data = post.data
      return if data['difficulty_computed'] && data['difficulty_label']

      readability = data['readability'] || {}
      decl = data['difficulty_declared'] || {}

      lexical = {
        'flesch_reading_ease' => readability['flesch_vacca'],
        'gulpease' => readability['gulpease'],
        'avg_sentence_length' => readability['avg_sentence_length'],
        'word_count' => readability['word_count'],
        'reading_time_minutes' => [((readability['word_count'].to_f / 150.0).ceil), 1].max
      }

      semantic = (data['difficulty_computed'] || {})['semantic'] || {}

      data['difficulty_computed'] = {
        'lexical' => lexical,
        'semantic' => semantic
      } unless data['difficulty_computed']

      composite = composite_index(post)
      data['difficulty_composite'] = composite
      data['difficulty_label'] = difficulty_label(composite)
      data['difficulty_audience_key'] = data['intended_audience']

      # Store raw breakdown for template
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

      # Validation warnings
      data = post.data
      audience = data['intended_audience'].to_s
      proficiency = data['proficiency_level'].to_s
      gulpease = (readability['gulpease'] || 100).to_f
      required_prereqs = (data['knowledge_prerequisites'] || []).count { |p| p['importance'] == 'required' }
      concept_density = semantic['concept_density'].to_f
      def_coverage = semantic['definition_coverage'].to_f
      ext_knowledge = semantic['external_knowledge_demand'].to_i
      reading_time = lexical['reading_time_minutes'].to_i
      decl = data['difficulty_declared'] || {}
      declared_avg = [decl['conceptual'].to_i, decl['technical'].to_i, decl['mathematical'].to_i].select(&:positive?)
        .then { |arr| arr.empty? ? 0 : arr.sum.to_f / arr.size }

      if proficiency == 'beginner' && gulpease < 50
        Jekyll.logger.warn "difficulty:", "#{post.url}: proficiency=beginner ma Gulpease=#{gulpease} (difficile da leggere)"
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
        Jekyll.logger.warn "difficulty:", "#{post.url}: declared_avg=#{declared_avg.round(1)} ma computed_composite=#{composite}"
      end
    end
  end
end

Jekyll::Hooks.register :site, :pre_render do |site, payload|
  site.posts.docs.each do |post|
    Jekyll::Difficulty.inject_computed(post)
  end
end
