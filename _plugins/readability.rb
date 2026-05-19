module Jekyll
  module Readability
    IT_VOWELS = /[aeiouàèéìòóùáéíóúAEIOUÀÈÉÌÒÓÙÁÉÍÓÚ]/

    EDUCATIONAL_LEVEL = {
      'Very easy — primary school'                => 'Primary school',
      'Easy — lower secondary school'             => 'Lower secondary school',
      'Fairly easy — lower secondary school'      => 'Lower secondary school',
      'Standard — upper secondary school'         => 'Upper secondary school',
      'Fairly difficult — upper secondary school' => 'Upper secondary school',
      'Difficult — university'                    => 'University',
      'Very difficult — post-graduate'            => 'Post-graduate'
    }.freeze

    AGE_RANGE = {
      'Primary school'           => '6-11',
      'Lower secondary school'   => '11-14',
      'Upper secondary school'   => '14-19',
      'University'               => '19-24',
      'Post-graduate'            => '24+'
    }.freeze

    def self.compute(post)
      content = post.content.dup

      # remove SVG elements entirely (path data, coordinates, etc.)
      content.gsub!(%r{<svg\b[^>]*>.*?</svg>}mi, ' ')
      # remove fenced code blocks (``` ... ```) including mermaid
      content.gsub!(/```\w*\n.*?\n```/m, ' ')
      # remove inline code spans
      content.gsub!(/`[^`]+`/, ' ')
      # remove HTML comments
      content.gsub!(/<!--.*?-->/m, ' ')
      # remove Liquid tags
      content.gsub!(/\{%[^%]*%\}/, ' ')
      content.gsub!(/\{\{[^}]*\}\}/, ' ')
      # remove HTML tags
      content.gsub!(%r{</?[^>]+>}, ' ')
      # remove URLs
      content.gsub!(%r{https?://\S+}, ' ')
      # remove markdown link syntax [text](url) but keep text
      content.gsub!(/\[([^\]]*)\]\([^)]+\)/, '\1')
      # strip remaining markdown decorators
      content.gsub!(/[*_~`#>{}\\|-]/, ' ')
      # collapse whitespace
      content.gsub!(/\s+/, ' ')
      content.strip!
      return if content.empty?

      text = content
      words = text.split
      word_count = words.size
      return if word_count < 10

      sentences = text.scan(/[^.!?…;]+[.!?…;]/).size
      sentences = 1 if sentences < 1

      letters = text.scan(/[a-zA-ZàèéìòóùÀÈÉÌÒÓÙ]/).size
      asl = word_count.to_f / sentences
      lp = (letters.to_f / word_count) * 100
      sp = (sentences.to_f / word_count) * 100

      # Flesch-Vacca 1972: F = 206 − (0.65 × S) − P
      # S = sillabe per 100 parole, P = parole medie per frase
      syllables = words.sum { |w| italian_syllable_count(w) }
      s_per_100 = (syllables.to_f / word_count) * 100
      flesch_vacca = 206.0 - (0.65 * s_per_100) - asl

      # GULPEASE: G = 89 − (LP/10) + (3 × SP)
      gulpease = [[89.0 - (lp / 10.0) + (3.0 * sp), 0].max, 100].min

      flesch_vacca_clamped = [[flesch_vacca.round(1), 0].max, 100].min
      fv_label = flesch_label(flesch_vacca_clamped)
      edu_level = EDUCATIONAL_LEVEL[fv_label]

      {
        'flesch_vacca'          => flesch_vacca_clamped,
        'gulpease'              => gulpease.round(1),
        'word_count'            => word_count,
        'sentence_count'        => sentences,
        'syllable_count'        => syllables,
        'avg_sentence_length'   => asl.round(1),
        'flesch_vacca_label'    => fv_label,
        'gulpease_label'        => gulpease_label(gulpease),
        'educational_level'     => edu_level,
        'typical_age_range'     => AGE_RANGE[edu_level]
      }
    end

    def self.italian_syllable_count(word)
      word = word.downcase.gsub(/[^a-zàèéìòóù]/, '')
      return 1 if word.empty?
      [word.scan(IT_VOWELS).size, 1].max
    end

    # Official Flesch-Kincaid scale adapted for Italian (Franchini-Vacca 1972)
    def self.flesch_label(score)
      case score
      when 90..100 then 'Very easy — primary school'
      when 80..89  then 'Easy — lower secondary school'
      when 70..79  then 'Fairly easy — lower secondary school'
      when 60..69  then 'Standard — upper secondary school'
      when 50..59  then 'Fairly difficult — upper secondary school'
      when 30..49  then 'Difficult — university'
      else              'Very difficult — post-graduate'
      end
    end

    def self.gulpease_label(score)
      case score
      when 0..35   then 'Very difficult'
      when 36..50  then 'Difficult'
      when 51..60  then 'Fairly difficult'
      when 61..70  then 'Standard'
      when 71..80  then 'Fairly easy'
      when 81..90  then 'Easy'
      else              'Very easy'
      end
    end
  end
end

Jekyll::Hooks.register :site, :pre_render do |site, payload|
  site.posts.docs.each do |post|
    data = post.data
    unless data['readability']
      begin
        result = Jekyll::Readability.compute(post)
        if result
          result['source'] = 'Flesch-Vacca 1972 + GULPEASE (Wikipedia)'
          data['readability'] = result
        end
      rescue => e
        Jekyll.logger.warn "readability:", "error for #{post.url}: #{e.message}"
      end
    end
  end
end
