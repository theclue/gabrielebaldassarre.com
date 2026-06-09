# Register `openscad` as a syntax-highlighting alias for Rouge.
# OpenSCAD syntax is C-like (curly braces, same operators, C-style comments).
# Using the C lexer gives reasonable highlighting for keywords, strings,
# numbers, and comments in OpenSCAD code blocks.
#
# Usage in posts:
#   ```openscad
#   module my_part() {
#       cylinder(h = 10, d = 20);
#   }
#   ```

require 'rouge'

module Rouge
  module Lexers
    # Register 'openscad' as an alias for the C lexer.
    # OpenSCAD's syntax is close enough to C that this produces
    # acceptable highlighting without a custom lexer.
    class OpenSCAD < C
      tag 'openscad'
      aliases 'scad'
      filenames '*.scad'
    end
  end
end
