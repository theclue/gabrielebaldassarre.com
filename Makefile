.PHONY: build knitr dev site

ROOT_DIR		:= $(abspath $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST))))))
JEKYLL_VERSION	:= 4.4.1

build:
	@docker build --tag gabrielebaldassarre/blog:$(JEKYLL_VERSION) --tag gabrielebaldassarre/blog:latest --build-arg JEKYLL_VERSION=$(JEKYLL_VERSION) .

_site: build
	@docker run --rm -v $(ROOT_DIR):/srv/jekyll -e JEKYLL_ENV=production gabrielebaldassarre/blog:$(JEKYLL_VERSION) sh -c 'bundle exec jekyll build'

site: _site

knitr:
	@Rscript R/build_blog.R

dev: build
	@docker run --rm -v $(ROOT_DIR):/srv/jekyll -p 35729:35729 -p 4000:4000 -e JEKYLL_ENV=development -it gabrielebaldassarre/blog:$(JEKYLL_VERSION)

clean:
	@rm -rf _site
	@rm -f Gemfile.lock