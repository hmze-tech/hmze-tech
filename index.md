---
layout: custom
---

<section>
  {{ page.description }}
  <div class="podcast-player-grid">
    <a class="platform-btn" href="https://open.spotify.com/show/5wgcluRAVV7zEa9Zo4po5B">
      <img src="https://cdn.simpleicons.org/spotify/1ED760" width="22" height="22" alt="">
      <span>Spotify</span>
    </a>
    <a class="platform-btn" href="https://podcasts.apple.com/de/podcast/hmze/id1869935041">
      <img src="https://cdn.simpleicons.org/applepodcasts/872EC4" width="22" height="22" alt="">
      <span>Apple Podcasts</span>
    </a>
    <a class="platform-btn" href="https://www.youtube.com/@HMZE-BeyondVibeCoding" target="_blank" rel="noopener noreferrer">
      <img src="https://cdn.simpleicons.org/youtube/FF0000" width="22" height="22" alt="">
      <span>YouTube</span>
    </a>
    <a class="platform-btn" href="https://anchor.fm/s/10dff5920/podcast/rss">
      <img src="https://cdn.simpleicons.org/rss/FF6600" width="22" height="22" alt="">
      <span>RSS feed</span>
    </a>
    <a class="platform-btn" href="https://www.linkedin.com/company/73990683/" target="_blank" rel="noopener noreferrer">
      <img src="/assets/img/linkedin-icon.svg" width="22" height="22" alt="">
      <span class="platform-btn-multiline"><small>Follow on</small>LinkedIn</span>
    </a>
  </div>
</section>

<section>
  {% assign latest = site.posts | first %}
  <div class="latest-episode-body">
    {% if latest.cover_image %}
    <img class="latest-episode-cover" src="{{ latest.cover_image }}" alt="{{ latest.title }}">
    {% elsif site.logo %}
    <img class="latest-episode-cover" src="{{ site.logo | absolute_url }}" alt="{{ latest.title }}">
    {% endif %}
    <div class="latest-episode-content">
      <h2 class="latest-episode-title"><a href="{{ latest.url }}">{{ latest.title }}</a></h2>
      <p class="latest-episode-meta">{{ latest.date | date: "%-d. %B %Y" }}</p>
      {% if latest.episode_url %}
      <audio class="latest-episode-audio" controls preload="none">
        <source src="{{ latest.episode_url }}" type="audio/mpeg">
      </audio>
      {% endif %}
      <div class="latest-episode-desc">
        <span class="latest-episode-desc-short">{{ latest.content | strip_html | truncatewords: 35, "" }} <a class="latest-episode-mehr" href="#" onclick="this.closest('.latest-episode-desc').classList.add('expanded');return false;">... more</a></span>
        <div class="latest-episode-desc-full">{{ latest.content }}</div>
      </div>
    </div>
  </div>
</section>

<section>
  {% assign latest = site.posts | first %}
  {% for post in site.posts %}
    {% if post.url == latest.url %}{% continue %}{% endif %}
    {% assign currentYear = post.date | date: "%Y" %}
    {% assign currentMonth = post.date | date: "%B" %}
    {% if post.episode >= 47 %}
    
    {% if currentYear != year %}
    <h1 id="{{ currentYear }}" class="section">{{ currentYear }}</h1>
    {% assign year = currentYear %}
    {% endif %}
    
    {% if currentMonth != month %}
    <h2 id="{{ currentMonth }}">{{ currentMonth }}</h2>
    {% assign month = currentMonth %}
    {% endif %}

    <p>
      <a href="{{ post.url }}">{{ post.title }}</a>
    </p>
    {% endif %}
  {% endfor %}
  <a href="/archive/">[Archiv]</a>
</section>