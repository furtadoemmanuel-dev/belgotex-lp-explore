// Captura de cada seção em uma largura: node qa/sections.mjs [url] [largura] [pasta]
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://127.0.0.1:4325/';
const w = Number(process.argv[3] ?? 1440);
const out = process.argv[4] ?? 'qa/screens';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: w, height: w < 768 ? 844 : 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.querySelector('[data-consent="denied"]')?.click());
await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} html{scroll-behavior:auto!important}' });
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < h; y += 600) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(120);
}
const ids = await page.evaluate(() => [...document.querySelectorAll('main > section, footer')].map((s, i) => s.id || s.className.split(' ').pop() || 's' + i));
const secs = await page.$$('main > section, footer');
for (let i = 0; i < secs.length; i++) {
  await secs[i].scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await secs[i].screenshot({ path: `${out}/${w}-${String(i).padStart(2, '0')}-${ids[i]}.png` });
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(`${w}px overflow=${overflow} errors=${errors.length} ${errors.join(' | ')}`);
await browser.close();
