.PHONY: help build build-knitr knitr dev site clean
.DEFAULT_GOAL := help

ROOT_DIR		:= $(abspath $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST))))))
JEKYLL_VERSION	:= 4.4.1
KNITR_IMAGE		:= gabrielebaldassarre/knitr:latest
LOCALE			:= it_IT
LOCALE_ISO		:= it
LOCALE_LANG		:= it-IT

help:
	@echo Usage: make [TARGET]
	@echo.
	@echo Targets:
	@echo   build        Build the Jekyll Docker image
	@echo   build-knitr  Build the R/knitr Docker image
	@echo   site         Build the site into _site/
	@echo   knitr        Convert .Rmd drafts to .md via R container
	@echo   dev          Start local Jekyll dev server with live-reload
	@echo   clean        Remove _site/ output
	@echo.
	@echo Environment overrides  (defaults shown):
	@echo   LOCALE=$(LOCALE)
	@echo   LOCALE_LANG=$(LOCALE_LANG)
	@echo.
	@echo Examples:
	@echo   make dev
	@echo   make site
	@echo   make LOCALE=en_US LOCALE_LANG=en-US site

build:
	@docker build --tag gabrielebaldassarre/blog:$(JEKYLL_VERSION) --tag gabrielebaldassarre/blog:latest \
		--build-arg JEKYLL_VERSION=$(JEKYLL_VERSION) \
		--build-arg LOCALE=$(LOCALE) \
		--build-arg LOCALE_LANG=$(LOCALE_LANG) .

build-knitr:
	@docker build --tag $(KNITR_IMAGE) containers/knitr/

_site: build
	@docker run --rm -v $(ROOT_DIR):/srv/jekyll \
		-e JEKYLL_ENV=production \
		-e LANG=$(LOCALE).UTF-8 \
		-e LANGUAGE=$(LOCALE):$(LOCALE_ISO) \
		-e LC_ALL=$(LOCALE).UTF-8 \
		gabrielebaldassarre/blog:$(JEKYLL_VERSION) sh -c 'bundle exec jekyll build'

site: _site

knitr: build-knitr
	@docker run --rm -v $(ROOT_DIR):/srv/jekyll \
		-w /srv/jekyll \
		-e TZ=Europe/Rome \
		$(KNITR_IMAGE) Rscript R/build_blog.R

dev: build
	@docker run --rm -v $(ROOT_DIR):/srv/jekyll -p 35729:35729 -p 4000:4000 \
		-e JEKYLL_ENV=development \
		-e LANG=$(LOCALE).UTF-8 \
		-e LANGUAGE=$(LOCALE):$(LOCALE_ISO) \
		-e LC_ALL=$(LOCALE).UTF-8 \
		-it gabrielebaldassarre/blog:$(JEKYLL_VERSION)

clean:
	@rm -rf _site