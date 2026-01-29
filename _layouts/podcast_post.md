---
layout: custom
---

<section>
  <h1>{{ page.title }}</h1>
  <p>
    {{ page.date | date: "%d %B %Y" }}
    {% case page.tags %}
    {% when "", nil, false, 0, empty %}
    {% else %}
      <span id=tags> // {{ page.tags | join: " " }}</span>
    {% endcase %}
  </p>


  {% if page.episode_url %}
  <p>
    <audio controls>
      <source src="{{page.episode_url}}" type="audio/mpeg">
      Your browser does not support the audio element.
    </audio>
  </p>
  {% endif %}

  {{content}}
</section>