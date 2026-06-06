include Makefile.common

help:
	@echo "Usage: make [TARGET]"
	@echo
	@echo Targets:
	@echo "  configure     detect native toolchains (R, OpenSCAD)"
	@echo "  build        Build the Jekyll Docker image"
	@echo "  build-knitr  Build the R/knitr Docker image"
	@echo "  build-seo    Build the SEO monitor Docker image"
	@echo "  build-cad    Build the OpenSCAD Docker image"
	@echo "  site         Build the site into _site/"
	@echo "  knitr        Convert .Rmd drafts to .md (native or Docker)"
	@echo "  cad          Compile .scad → .stl, .3mf, .png (native or Docker)"
	@echo "  seo          Run SEO monitor pipeline"
	@echo "  dev          Start local Jekyll dev server with live-reload"
	@echo "  clean        Remove _site/ output"
	@echo
	@echo "Environment overrides  (defaults shown):"
	@echo "  LOCALE=$(LOCALE)"
	@echo "  LOCALE_LANG=$(LOCALE_LANG)"
	@echo
	@echo Examples:
	@echo "  make dev"
	@echo "  make site"
	@echo '  make seo SEO_ARGS="--dry-run --force-report"'
	@echo "  make cad CAD_ARGS=\"--slug cable-grommet-60mm\""
	@echo '  make assets/3d/cable-grommet-60mm/cable-grommet-60mm.stl'
	@echo "  make LOCALE=en_US LOCALE_LANG=en-US site"

clean:
	@rm -rf _site
