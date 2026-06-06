FROM ubuntu:24.04

LABEL authors="Gabriele Baldassarre" \
      description="OpenSCAD build container for CAD model compilation (STL, 3MF, PNG)" \
      maintainer="Gabriele Baldassarre"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    TZ=Europe/Rome

RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    imagemagick \
    python3 \
    python3-pip \
    python3-yaml \
    curl \
    wget \
    && add-apt-repository -y ppa:openscad/releases \
    && apt-get update \
    && apt-get install -y --no-install-recommends openscad-nightly \
    && apt-get clean \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/*

WORKDIR /workspace

ENTRYPOINT ["python3"]
