---
layout: default
---

<div class="post-page">

  <!-- ══════════════════════════════════════════════════
       HERO — cover art + episode meta
       cover_image falls back gracefully if not set.
       ══════════════════════════════════════════════════ -->
  <section class="post-hero">
    {% if page.cover_image %}
    <div class="post-hero__artwork">
      <img class="post-hero__cover"
           src="{{ page.cover_image }}"
           alt="{{ page.title }}"
           loading="eager">
    </div>
    {% endif %}
    <div class="post-hero__meta">
      <h1 class="post-hero__title">{% include episode-label.html post=page %}</h1>
      <p class="post-hero__date">{{ page.date | date: "%B %-d, %Y" }}</p>
    </div>
  </section>

  <!-- ══════════════════════════════════════════════════
       PLAYER — native audio + show-level platform links
       episode_url is a direct MP3 link; platform links
       point to the show (no per-episode deep links in FM).
       ══════════════════════════════════════════════════ -->
  {% if page.episode_url %}
  <section class="post-player">
    <audio class="post-player__audio" controls preload="none">
      <source src="{{ page.episode_url }}" type="audio/mpeg">
      Your browser does not support the audio element.
    </audio>
    <nav class="post-player__platforms" aria-label="Listen on">
      {% for platform in site.data.platforms %}
      {% unless platform.id == "rss" %}
      <a class="platform-btn"
         href="{{ platform.url }}"
         aria-label="{{ platform.label }}"
         target="_blank" rel="noopener noreferrer">
        <img src="{{ platform.icon | relative_url }}" alt="" width="22" height="22">
        <span>{{ platform.name }}</span>
      </a>
      {% endunless %}
      {% endfor %}
    </nav>
  </section>
  {% endif %}

  <!-- ══════════════════════════════════════════════════
       PROSE — episode show notes rendered from Markdown
       ══════════════════════════════════════════════════ -->
  <article class="post-prose">
    {{ content }}
  </article>

  <!-- ══════════════════════════════════════════════════
       EPISODE NAV — prev / next + back to home
       Jekyll convention:
         page.previous = chronologically OLDER post
         page.next     = chronologically NEWER post
       ══════════════════════════════════════════════════ -->
  <nav class="post-nav" aria-label="Episode navigation">
    <div class="post-nav__older">
      {% if page.previous %}
      <a class="post-nav__link" href="{{ page.previous.url | relative_url }}">
        <span class="post-nav__arrow" aria-hidden="true">←</span>
        <span class="post-nav__info">
          <span class="post-nav__label">Older episode</span>
          <span class="post-nav__title">{% include episode-label.html post=page.previous %}</span>
        </span>
      </a>
      {% endif %}
    </div>
    <div class="post-nav__home">
      <a class="btn-cta" href="{{ '/' | relative_url }}">All episodes</a>
    </div>
    <div class="post-nav__newer">
      {% if page.next %}
      <a class="post-nav__link post-nav__link--right" href="{{ page.next.url | relative_url }}">
        <span class="post-nav__info">
          <span class="post-nav__label">Newer episode</span>
          <span class="post-nav__title">{% include episode-label.html post=page.next %}</span>
        </span>
        <span class="post-nav__arrow" aria-hidden="true">→</span>
      </a>
      {% endif %}
    </div>
  </nav>

</div>
