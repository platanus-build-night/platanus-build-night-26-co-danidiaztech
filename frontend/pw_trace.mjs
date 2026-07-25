import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function readClock(page) {
  const text = await page.locator('span.font-mono.text-xs.text-text-muted').first().innerText();
  return text;
}
async function isPlaying(page) {
  return (await page.locator('button[aria-label="Pause"]').count()) > 0;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  for (const sessionId of [1, 22]) {
    console.log(`\n=== session ${sessionId} smart-skip ON trace ===`);
    await page.goto(`${BASE}/review/${sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const smartSkipSwitch = page.locator('button[role="switch"]');
    const isOn = await smartSkipSwitch.getAttribute('aria-checked');
    if (isOn !== 'true') await smartSkipSwitch.click();

    await page.locator('button[aria-label="Play"]').click();
    const t0 = Date.now();
    let last = '';
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      const clock = await readClock(page);
      const playing = await isPlaying(page);
      const wall = ((Date.now() - t0) / 1000).toFixed(1);
      if (clock !== last) {
        console.log(`wall=${wall}s  clock=${clock}  playing=${playing}`);
        last = clock;
      }
      if (!playing) { console.log(`--> stopped playing at wall=${wall}s, clock=${clock}`); break; }
    }
  }
  await browser.close();
})();
