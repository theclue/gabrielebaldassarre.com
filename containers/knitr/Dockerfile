FROM rocker/verse:latest
ENV TZ="Europe/Rome"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    wget \
    curl \
    libraptor2-dev \
    librasqal3-dev \
    libreadline6-dev \
    librdf0-dev \
    ca-certificates \
    apt-utils \
    ssh \
    less \
    emacs \
    tcl-dev \
    git-all \
    coreutils \
    gnutls-bin \
    moreutils \
    autoconf \
    libc6-dev \
    ncurses-dev \
    automake \
    libtool \
    bison \
    cmake

RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas-dev \
    libyaml-dev \
    libarpack2-dev \
    libpcre3 \
    libpcre3-dev \
    liblzma-dev \
    libbz2-dev \
    librsvg2-bin \
    libgmp3-dev \
    gfortran \
    libxml2 \
    libxml2-dev \
    libicu-dev \
    libxslt-dev \
    libssl-dev \
    libpq-dev \
    cargo \
    libgsl-dev \
    libgeos-dev \
    libgdal-dev \
    libproj-dev \
    libudunits2-dev \
    libv8-dev \
    libcairo2-dev \
    libnetcdf-dev \
    libprotobuf-dev \
    protobuf-compiler

RUN install2.r --error -n 4 \
    -r 'http://cran.rstudio.com' \
    futile.logger \
    rprojroot \
    xfun \
    Hmisc \
    knitr \
    blogdown \
    svglite \
    caTools \
    Cairo \
    pacman \
    igraph \
    poweRlaw \
    phaseR \
    && rm -rf /var/lib/apt/lists/*
