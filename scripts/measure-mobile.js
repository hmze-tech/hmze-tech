// Programmatic mobile QA measurements at iPhone 13 (390px).
const { chromium, devices } = require('playwright');

const BASE = 'http://localhost:4568';

const SELECTORS = {
  home: [
    '.site-header', '.site-header__inner', '.site-header__logo img', '.site-nav__pill',
    '.social-icons__link', '.hero-lockup', '.hero-lockup__image',
    '.home-hero__copy--left', '.home-hero__copy--right', '.home-hero__intro',
    '.episode-card--featured', '.episode-card__media', '.episode-card__cover',
    '.episode-card__body', '.btn-cta',
    '.accordion__item', '.accordion__summary', '.accordion__icon',
    '.home-accordion__cta', '.site-footer__card', '.site-footer__nav-link',
    '.site-footer__lockup img', '.site-footer__social .social-icons__link',
  ],
  post: [
    '.site-header__inner', '.post-page', '.post-hero', '.post-hero__cover',
    '.post-hero__title', '.post-player__audio', '.platform-btn',
    '.post-prose', '.post-nav', '.post-nav__link', '.post-nav__home .btn-cta',
  ],
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });

  for (const [name, url] of [['home', `${BASE}/`], ['post', `${BASE}/2026/06/11/001/`]]) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    console.log(`\n===== ${name} (${url}) =====`);
    for (const sel of SELECTORS[name]) {
      const data = await page.evaluate((s) => {
        const els = [...document.querySelectorAll(s)];
        if (!els.length) return null;
        const el = els[0];
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          count: els.length,
          rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
          fontSize: cs.fontSize,
          display: cs.display,
          gridCols: cs.gridTemplateColumns,
          flexDir: cs.flexDirection,
          pad: cs.padding,
          margin: cs.margin,
        };
      }, sel);
      console.log(sel, JSON.stringify(data));
    }
    // Touch target audit: all interactive elements smaller than 44x44
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('a, button, summary, audio')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 44 || r.height < 44) {
          out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
        }
      }
      return [...new Set(out)];
    });
    console.log('TOUCH<44px:', JSON.stringify(small, null, 1));
    // Sub-14px text audit
    const tiny = await page.evaluate(() => {
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 14) out.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${fs}px`);
      }
      return [...out];
    });
    console.log('FONT<14px:', JSON.stringify(tiny, null, 1));
    await page.close();
  }
  await browser.close();
})();
