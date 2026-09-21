#!/usr/bin/env bash
#
# customizer_compat_check.sh — local proxy for the Thingiverse Customizer parser gate.
#
# Thingiverse Customizer compiles .scad files with an ~2015.03 OpenSCAD core.
# Constructs that local OpenSCAD 2021.01 accepts make the 2015.03 parser die
# ("Parser error ... syntax error"), which in turn makes the Customizer show
# "Sorry! No Parameters Found" instead of the widget UI. This script scans a
# .scad file for the constructs known to break that old parser so we can
# reproduce/verify the failure locally, without uploading to Thingiverse.
#
# Usage:  bash customizer_compat_check.sh <file.scad>
# Exit:   0 = clean (no banned constructs found in code)
#         1 = at least one banned construct found (prints file:line:code per hit)
#         2 = usage / file error
#
# Method:
#   1. An awk state machine strips `//` line-comment tails and `/* */` block
#      comments (single- or multi-line) BEFORE pattern matching, because
#      Customizer widget comments such as `/* [Tab] */` and `// [300:10:1200]`
#      contain range syntax that must NOT be treated as code.
#   2. Each banned construct is searched with POSIX ERE (BSD-grep compatible,
#      no GNU-only flags) over the comment-stripped stream.
#
# Documented limitations of the stripper (acceptable for this repo):
#   - It is string-unaware: a literal "//" or "/*" inside a quoted string
#     would confuse it (neither .scad file in this folder has such a string;
#     verify with: grep -n '"[^"]*//' file.scad  and eyeball the matches).
#   - It does not track nesting; OpenSCAD block comments do not nest anyway.
#   - Check (a) "if/else expression" is a line heuristic: a *statement*
#     one-liner `if (c) foo(); else bar();` is excluded via `;`/brace filters,
#     but a brace-less if/else *expression* is exactly what 2015.03 cannot
#     parse anywhere, so flagging is still correct.
#
set -u

SCAD="${1:-}"
if [ -z "$SCAD" ] || [ ! -f "$SCAD" ]; then
    echo "usage: $0 <file.scad>  (file not found: '$SCAD')" >&2
    exit 2
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# --- 1. strip comments, emit "<lineno>\t<code>" ----------------------------
awk '
BEGIN { inblock = 0 }
{
    line = $0; out = ""
    while (1) {
        if (inblock) {
            p = index(line, "*/")
            if (p == 0) { line = ""; break }
            inblock = 0
            line = substr(line, p + 2)
        } else {
            s = index(line, "//")
            b = index(line, "/*")
            if (s > 0 && (b == 0 || s < b)) { line = substr(line, 1, s - 1); break }
            if (b > 0) {
                out = out substr(line, 1, b - 1)
                inblock = 1
                line = substr(line, b + 2)
            } else { break }
        }
    }
    printf "%d\t%s\n", NR, out line
}
' "$SCAD" > "$TMP"

# --- 2. banned-construct checks --------------------------------------------
findings=0

# report <description> <ERE> [exclusion-ERE ...]
# prints "file:line: [category] stripped-code" for every hit, bumps $findings.
report() {
    desc="$1"; re="$2"; shift 2
    lines="$(grep -E "$re" "$TMP" || true)"
    for excl in "$@"; do
        [ -n "$excl" ] || continue
        [ -n "$lines" ] || break
        lines="$(printf '%s\n' "$lines" | grep -vE "$excl" || true)"
    done
    [ -n "$lines" ] || return 0
    while IFS= read -r l; do
        [ -n "$l" ] || continue
        num="${l%%	*}"
        content="${l#*	}"
        echo "$SCAD:$num: [$desc] $content"
        findings=$((findings + 1))
    done <<< "$lines"
    return 0
}

# (a) if/else *expression* (banned inside vector/list comprehensions; 2015.03
#     has no conditional-expression form at all). Heuristic: `if(` and `else`
#     on the same line. Exclusions: brace-block control statements (`[{}]`),
#     and statement one-liners `if (a) b(); else c();` where `;` always
#     precedes `else`; an if/else expression's semicolon can only *terminate*
#     the enclosing statement, i.e. sit after `else`, so it still gets flagged.
report "if/else expression (2015.03 parse error)" \
    '(^|[^[:alnum:]_])if[[:space:]]*\(.*[^[:alnum:]_]else([^[:alnum:]_]|$)' \
    '[{}]' ';.*[^[:alnum:]_]else'

# (b) standalone let(...)expression form
report "let(...) expression form" \
    '(^|[^[:alnum:]_])let[[:space:]]*\('

# (c) assert(...) as a statement
report "assert(...) statement" \
    '(^|[^[:alnum:]_])assert[[:space:]]*\('

# (d) chr() (introduced in 2015.03 itself — borderline, banned for safety)
report "chr() call" \
    '(^|[^[:alnum:]_])chr[[:space:]]*\('

# (e) color("#RRGGBB") hex string (hex color support only arrived in 2019.05)
report 'color("#hex") string' \
    '(^|[^[:alnum:]_])color[[:space:]]*\([[:space:]]*"#[0-9a-fA-F]{3,8}"'

# (f) generically-banned newer syntax — each is expected to count 0
report "each keyword" \
    '(^|[^[:alnum:]_])each([^[:alnum:]_]|$)'
report "^ exponent operator" \
    '\^'
report "anonymous function (x) literal" \
    '(^|[^[:alnum:]_])function[[:space:]]*\('
report "ord() call" \
    '(^|[^[:alnum:]_])ord[[:space:]]*\('
report "regex_match() call" \
    '(^|[^[:alnum:]_])regex_match[[:space:]]*\('
report "\$preview builtin" \
    '[$]preview'
report "C-style for(i=0;i<n;i++) loop" \
    '(^|[^[:alnum:]_])for[[:space:]]*\([^()]*;'

# --- summary ----------------------------------------------------------------
if [ "$findings" -gt 0 ]; then
    echo "FAIL: $findings construct(s) incompatible with the Thingiverse ~2015.03 parser found in $SCAD" >&2
    exit 1
fi
echo "OK: no 2015.03-incompatible constructs found in $SCAD"
exit 0
