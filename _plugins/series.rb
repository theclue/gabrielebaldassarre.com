# frozen_string_literal: true

module Jekyll
  module Series
    WORDS_PER_MINUTE = 150
    DIFFICULTY_THRESHOLDS = {
      [4.0, 5.0] => 'difficulty_expert',
      [2.5, 4.0] => 'difficulty_advanced',
      [1.2, 2.5] => 'difficulty_intermediate',
      [0.0, 1.2] => 'difficulty_accessible'
    }.freeze

    def self.approx_difficulty_score(post)
      decl = post.data['difficulty_declared'] || {}
      c = decl['conceptual'].to_f
      t = decl['technical'].to_f
      m = decl['mathematical'].to_f
      sum = c + t + m
      sum.positive? ? [sum / 3.0, 5.0].min : nil
    end

    def self.difficulty_label_from_score(score)
      return nil unless score
      DIFFICULTY_THRESHOLDS.each do |(lo, hi), label|
        return label if score >= lo && score < hi
      end
      'difficulty_accessible'
    end

    def self.approx_reading_time(post)
      words = post.content.to_s.scan(/[\w'-]+/).size
      [(words.to_f / WORDS_PER_MINUTE).ceil, 1].max
    end

    Jekyll::Hooks.register :site, :post_read do |site|
      series_map = {}

      site.posts.docs.each do |post|
        sid = post.data.dig('series', 'id')
        next unless sid

        series_map[sid] ||= []
        series_map[sid] << post
      end

      series_map.each do |sid, posts|
        posts.sort_by!(&:date)

        total_reading = posts.sum { |p| approx_reading_time(p) }
        max_score = posts.filter_map { |p| approx_difficulty_score(p) }.max

        posts.each_with_index do |post, idx|
          series_data = post.data['series'] || {}

          series_data['posts'] = posts.map do |p|
            {
              'url'     => p.url,
              'title'   => p.data['title'],
              'date'    => p.date,
              'excerpt' => p.data['excerpt'],
              'part'    => p.data.dig('series', 'part'),
              'reading_time' => approx_reading_time(p)
            }
          end

          series_data['total_reading_time'] = total_reading
          series_data['difficulty_label'] = difficulty_label_from_score(max_score)

          if idx > 0
            prev = posts[idx - 1]
            series_data['previous_post'] = {
              'url'   => prev.url,
              'title' => prev.data['title'],
              'part'  => prev.data.dig('series', 'part')
            }
          end

          if idx < posts.size - 1
            nxt = posts[idx + 1]
            series_data['next_post'] = {
              'url'   => nxt.url,
              'title' => nxt.data['title'],
              'part'  => nxt.data.dig('series', 'part')
            }
          end

          post.data['series'] = series_data
        end
      end
    end
  end
end
