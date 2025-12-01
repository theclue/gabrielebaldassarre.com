FROM bretfisher/jekyll-serve:latest

WORKDIR /srv/jekyll
COPY Gemfile ./
# COPY Gemfile.lock ./

RUN apt-get update && apt-get install -y ruby ruby-irb nodejs ruby-json rake \
   ruby-bigdecimal ruby-io-console tzdata pkg-config libz-dev  \
   libffi-dev libxml2-dev libxslt-dev \
   ruby-dev libc-dev zlib1g-dev liblzma-dev patch

COPY Gemfile* /app/

RUN gem install bundler \
   && bundle update

RUN bundle install --jobs 20 --retry 5