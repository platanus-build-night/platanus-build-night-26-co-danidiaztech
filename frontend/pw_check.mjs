import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = '/home/daniel/repos/platanus-build-night-26-co-danidiaztech/frontend/.screenshots';

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch {}
  }, theme);
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
}

async function readClock(page) {
  // PlayerControls shows "m:ss / m:ss" in a font-mono span
  const text = await page.locator('span.font-mono.text-xs.text-text-muted').first().innerText();
  return text;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  for (const sessionId of [1, 22, 21]) {
    console.log(`\n=== session ${sessionId} ===`);
    await page.goto(`${BASE}/review/${sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await shot(page, `player-s${sessionId}-light-rest`);
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await shot(page, `player-s${sessionId}-dark-rest`);
    await setTheme(page, 'light');

    const hasPlayer = await page.locator('button[aria-label="Pause"], button[aria-label="Play"]').count();
    if (!hasPlayer) {
      console.log('No player controls (likely degenerate-session empty state) — skipping playback measurement.');
      continue;
    }

    // Ensure smart-skip is ON (default) then play and measure.
    const smartSkipSwitch = page.locator('button[role="switch"]');
    const isOn = await smartSkipSwitch.getAttribute('aria-checked');
    if (isOn !== 'true') await smartSkipSwitch.click();

    await page.locator('button[aria-label="Play"]').click();
    const t0 = Date.now();
    await page.waitForTimeout(500);
    await shot(page, `player-s${sessionId}-light-smartskip-on-mid`);
    // wait for it to finish or timeout after 15s
    let elapsedOnMs = null;
    for (let i = 0; i < 40; i++) {
      const playing = await page.locator('button[aria-label="Play"]').count();
      if (playing > 0) { // button now says "Play" again => finished
        elapsedOnMs = Date.now() - t0;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (elapsedOnMs === null) elapsedOnMs = Date.now() - t0;
    console.log(`smart-skip ON: session ${sessionId} finished playback in ~${(elapsedOnMs/1000).toFixed(1)}s (wall clock)`);
    const clockAfterOn = await readClock(page);
    console.log('clock readout after ON run:', clockAfterOn);

    // reset to start
    await page.locator('div[role="slider"]').click({ position: { x: 2, y: 8 } });
    await page.waitForTimeout(200);

    // Toggle smart-skip OFF mid interaction test: verify toggling takes effect immediately while playing
    await page.locator('button[aria-label="Play"]').click();
    await page.waitForTimeout(1500);
    const clockBeforeToggle = await readClock(page);
    await smartSkipSwitch.click(); // turn OFF mid-playback
    await page.waitForTimeout(1500);
    const clockAfterToggleOff = await readClock(page);
    console.log(`toggle-mid-playback: before OFF=${clockBeforeToggle}, 1.5s after toggling OFF=${clockAfterToggleOff}`);
    await shot(page, `player-s${sessionId}-light-smartskip-off-mid`);
    await page.locator('button[aria-label="Pause"]').click().catch(() => {});

    // Reset & measure OFF-mode full real-time duration is too long generally; just report the readout progress.
  }

  await browser.close();
})();
