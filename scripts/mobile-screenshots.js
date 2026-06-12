// Mobile visual QA captures with true device emulation (iPhone 13: 390x844, DPR 3, touch).
// Usage: node mobile-screenshots.js [--desktop] [--width N [--height N]] [--suffix name]
const { chromium, devices } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:4568';
const PAGES = [
  { name: 'home', url: `${BASE}/` },
  { name: 'post', url: `${BASE}/2026/06/11/001/` },
];

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

(async () => {
  const browser = await chromium.launch();

  let contextOptions;
  let prefix;
  if (args.includes('--desktop')) {
    contextOptions = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
    prefix = 'desktop';
  } else if (getArg('--width')) {
    const width = parseInt(getArg('--width'), 10);
    const height = parseInt(getArg('--height') || '812', 10);
    contextOptions = {
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: width < 768,
      hasTouch: width < 1024,
    };
    prefix = `w${width}`;
  } else {
    contextOptions = { ...devices['iPhone 13'] };
    prefix = 'mobile-impl';
  }
  const suffix = getArg('--suffix');
  if (suffix) prefix = `${prefix}-${suffix}`;

  const context = await browser.newContext(contextOptions);

  for (const { name, url } of PAGES) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Freeze animations/transitions for deterministic captures
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });
    await page.waitForTimeout(300);
    const file = path.join(__dirname, 'screenshots', `${prefix}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    console.log(
      `${file}  viewport=${contextOptions.viewport.width}px  scrollWidth=${overflow.scrollWidth}` +
        (overflow.scrollWidth > overflow.clientWidth ? '  ⚠ HORIZONTAL OVERFLOW' : '')
    );
    await page.close();
  }

  await browser.close();
})();
