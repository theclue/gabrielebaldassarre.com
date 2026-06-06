# configure.ac — toolchain probes for gabrielebaldassarre.com
# ============================================================
# This is a standard Autoconf input file (M4 macro language).
# Run `autoreconf -i` to generate the `configure` shell script.
# Then run `./configure` to probe the host and produce .build_config.
#
# Architecture:
#   configure.ac          (this file, M4)
#   .build_config.in      (template, @VAR@ placeholders)
#   ↓ autoreconf -i
#   configure             (generated, portable shell)
#   ↓ ./configure
#   .build_config         (Makefile -include'd, gitignored)
#
# Each AC_CHECK_PROG sets a shell variable and a corresponding
# substitution (@HAS_KNITR@) used in .build_config.in.
#
# When a tool is found the Makefile uses it natively.
# When absent the Makefile falls back to Docker containers.

AC_INIT([gabrielebaldassarre.com], [4.0], [https://github.com/theclue/gabrielebaldassarre.com/issues])
AC_PREREQ([2.71])

# ── Toolchain probes ────────────────────────────────────────────

# R/knitr — Rmd → md conversion (fallback: Docker knitr image)
AC_CHECK_PROG([HAS_KNITR], [Rscript], [1], [0])

# OpenSCAD — .scad → .stl / .3mf / .png (fallback: Docker cad image)
AC_CHECK_PROG([HAS_OPENSCAD], [openscad], [1], [0])

# Python 3 — CAD build orchestrator (fallback: inside Docker cad image)
# AC_PATH_PROG resolves the full binary path, not just "python3"
AC_PATH_PROG([PYTHON3_BIN], [python3], [python3])

# ImageMagick — PNG post-processing (fallback: inside Docker cad image)
AC_CHECK_PROG([HAS_IMAGEMAGICK], [convert], [1], [0])

# ── Output ──────────────────────────────────────────────────────

# Substitute @VAR@ placeholders in .build_config.in → .build_config
AC_CONFIG_FILES([.build_config])

# Do NOT generate a Makefile — we hand-craft Makefile.common
AC_CONFIG_COMMANDS([summary], [
    echo ""
    echo "───────────────────────────────────────────"
    echo "  Configuration saved to .build_config"
    echo "  Re-run ./configure after installing/removing tools."
    echo "  See .build_config for detected values."
])

AC_OUTPUT
