// assets/js/accordion.js
//
// Progressive enhancement for the home page episode accordion
// (_layouts/home.html, [data-accordion]). Native <details>/<summary>
// already provide open/close behavior with no JS; this script only
// enforces "one row open at a time" by closing siblings when a
// <details> element is opened.

document.addEventListener('DOMContentLoaded', function () {
  var accordion = document.querySelector('[data-accordion]');
  if (!accordion) return;

  var items = accordion.querySelectorAll('details');

  items.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      items.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });
});
