---
layout: custom
title: Archiv
---

<section>
  <p><a href="/">&larr; Zurück</a></p>

  <h1 class="section">Archiv</h1>

  {% for post in site.posts %}
    {% assign currentYear = post.date | date: "%Y" %}
    {% assign currentMonth = post.date | date: "%B" %}
    {% if post.episode < 47 %}

    {% if currentYear != year %}
    <h2 id="{{ currentYear }}" class="section">{{ currentYear }}</h2>
    {% assign year = currentYear %}
    {% endif %}
    
    {% if currentMonth != month %}
    <h3 id="{{ currentMonth }}">{{ currentMonth }}</h3>
    {% assign month = currentMonth %}
    {% endif %}

    <p>
      <a href="{{ post.url }}">{{ post.title }}</a>
    </p>
    {% endif %}
  {% endfor %}
</section>
