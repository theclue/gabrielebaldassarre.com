FROM bretfisher/jekyll-serve:latest

LABEL authors="Gabriele Baldassarre" \
      description="Docker image for Gabriele Baldassarre's personal blog" \
      maintainer="Gabriele Baldassarre"

ENV DEBIAN_FRONTEND=noninteractive

ARG JEKYLL_VERSION
ENV JEKYLL_VERSION=$JEKYLL_VERSION

# create a directory for the jekyll site
RUN mkdir -p /srv/jekyll

COPY Gemfile /srv/jekyll
# COPY Gemfile.lock /srv/jekyll

WORKDIR /srv/jekyll

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential imagemagick inotify-tools locales \
    nodejs rake procps npm \
    ruby-json ruby-bigdecimal ruby-io-console ruby-dev \
    tzdata pkg-config libz-dev  \
    libffi-dev libxml2-dev libxslt-dev \
    libc-dev zlib1g-dev liblzma-dev patch

# clean up
RUN apt-get clean && \
    apt-get autoremove && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*  /tmp/*

RUN npm config set registry https://registry.npmjs.org/ && \
    npm install -g purgecss

# set the locale
RUN sed -i '/it_IT.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen

# set environment variables
ENV EXECJS_RUNTIME=Node \
    JEKYLL_ENV=production \
    LANG=it_IT.UTF-8 \
    LANGUAGE=it_IT:it \
    LC_ALL=it_IT.UTF-8

COPY Gemfile* /app/

RUN gem install --no-document bundler \
    && bundle update

RUN bundle install --no-cache --jobs 20 --retry 5