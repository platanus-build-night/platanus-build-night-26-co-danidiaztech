import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
async function readClock(page) {
  return await page.locator('span.font-mono.text-xs.text-text-muted').first().innerText();
}
async function isPlaying(page) {
  return (await page.locator('button[aria-label="Pause"]').count()) > 0;
}
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', (msg) => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));

  await page.goto(`${BASE}/review/1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const smartSkipSwitch = page.locator('button[role="switch"]');
  const isOn = await smartSkipSwitch.getAttribute('aria-checked');
  if (isOn !== 'true') await smartSkipSwitch.click();
  await page.locator('button[aria-label="Play"]').click();
  const t0 = Date.now();
  let last = '';
  for (let i = 0; i < 220; i++) {
    await page.waitForTimeout(200);
    const clock = await readClock(page);
    const playing = await isPlaying(page);
    const wall = ((Date.now() - t0) / 1000).toFixed(1);
    if (clock !== last) { console.log(`wall=${wall}s clock=${clock} playing=${playing}`); last = clock; }
    if (!playing) { console.log(`--> stopped at wall=${wall}s clock=${clock}`); break; }
  }
  await browser.close();
})();
