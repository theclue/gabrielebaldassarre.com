---
layout: archive
title: "Mappa del Sito"
permalink: /sitemap/
author_profile: false
sitemap:
  exclude: 'yes'
---

<h2>Pagine</h2>
{% for post in site.pages %}
  {% unless post.sitemap.exclude == "yes" or post.layout == nil or post.path contains "assets" %}
    {% include archive-single.html %}
  {% endunless %}
{% endfor %}

<h2>Articoli</h2>
{% for post in site.posts %}
{% unless post.sitemap.exclude == "yes" or post.layout == nil or post.path contains "assets" %}
  {% include archive-single.html %}
{% endunless %}
{% endfor %}

{% capture written_label %}'None'{% endcapture %}

{% for collection in site.collections %}
{% unless collection.output == false or collection.label == "posts" %}
  {% capture label %}{{ collection.label }}{% endcapture %}
  {% if label != written_label %}
  <h2>{{ label }}</h2>
  {% capture written_label %}{{ label }}{% endcapture %}
  {% endif %}
{% endunless %}
{% for post in collection.docs %}
  {% unless collection.output == false or collection.label == "posts" %}
  {% include archive-single.html %}
  {% endunless %}
{% endfor %}
{% endfor %}
