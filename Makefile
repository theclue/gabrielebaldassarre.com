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
	@echo "  knitr        Convert .Rmd → .md (dependency-driven)"
	@echo "  cad          Compile .scad → .stl, .3mf, .png"
	@echo "  diagrams     Render R/diagrams/*.R → assets/images/diagrams/*.svg"
	@echo "  seo          Run SEO monitor pipeline"
	@echo "  dev          Start local Jekyll dev server"
	@echo "  clean        Remove _site/, caches, and temporary build artifacts"
	@echo
	@echo "Environment overrides  (defaults shown):"
	@echo "  LOCALE=$(LOCALE)"
	@echo "  LOCALE_LANG=$(LOCALE_LANG)"
	@echo
	@echo Examples:
	@echo "  make dev"
	@echo "  make site"
	@echo '  make assets/3d/customizable-cable-grommet/customizable-cable-grommet.stl'
	@echo '  make assets/3d/customizable-cable-grommet/customizable-cable-grommet.3mf'
	@echo "  make LOCALE=en_US LOCALE_LANG=en-US site"

clean:
	@rm -rf _site .jekyll-cache .sass-cache _dbt/target _dbt/logs .opencode/authoring-revisions docs/authoring-runs
	@find _scripts -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
