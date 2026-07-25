import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const OUT = '/home/daniel/repos/platanus-build-night-26-co-danidiaztech/frontend/.screenshots';

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(150);
}
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
}
async function readClock(page) {
  return await page.locator('span.font-mono.text-xs.text-text-muted').first().innerText();
}
async function isPlaying(page) {
  return (await page.locator('button[aria-label="Pause"]').count()) > 0;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });

  for (const sessionId of [1, 22, 21]) {
    console.log(`\n=== session ${sessionId} ===`);
    await page.goto(`${BASE}/review/${sessionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await setTheme(page, 'light');
    await shot(page, `player-s${sessionId}-light-rest`);
    await setTheme(page, 'dark');
    await shot(page, `player-s${sessionId}-dark-rest`);
    await setTheme(page, 'light');

    const hasPlayer = await page.locator('button[aria-label="Pause"], button[aria-label="Play"]').count();
    if (!hasPlayer) {
      console.log('degenerate/empty state — no player controls, as expected for session 21.');
      continue;
    }

    // Ensure smart-skip ON, play, screenshot mid-flight, measure full completion time.
    const smartSkipSwitch = page.locator('button[role="switch"]');
    if ((await smartSkipSwitch.getAttribute('aria-checked')) !== 'true') await smartSkipSwitch.click();
    await page.locator('button[aria-label="Play"]').click();
    const t0 = Date.now();
    await page.waitForTimeout(1500);
    await shot(page, `player-s${sessionId}-light-smartskip-on-mid`);
    await setTheme(page, 'dark');
    await shot(page, `player-s${sessionId}-dark-smartskip-on-mid`);
    await setTheme(page, 'light');

    let doneMs = null;
    for (let i = 0; i < 250; i++) {
      await page.waitForTimeout(200);
      if (!(await isPlaying(page))) { doneMs = Date.now() - t0; break; }
    }
    const finalClock = await readClock(page);
    console.log(`smart-skip ON: session ${sessionId} played to completion in ${doneMs ? (doneMs/1000).toFixed(1) : '>50'}s wall time (clock: ${finalClock})`);

    // Reset to start, turn smart-skip OFF, play for a fixed 4s window to show 1:1 real-time pacing.
    await page.locator('div[role="slider"]').click({ position: { x: 2, y: 8 } });
    await page.waitForTimeout(150);
    await smartSkipSwitch.click(); // OFF
    const c0 = await readClock(page);
    await page.locator('button[aria-label="Play"]').click();
    const w0 = Date.now();
    await page.waitForTimeout(4000);
    const c1 = await readClock(page);
    const wallElapsed = ((Date.now() - w0) / 1000).toFixed(2);
    console.log(`smart-skip OFF: over ${wallElapsed}s wall time, player clock went ${c0} -> ${c1} (should track ~1:1)`);
    await shot(page, `player-s${sessionId}-light-smartskip-off-mid`);
    await setTheme(page, 'dark');
    await shot(page, `player-s${sessionId}-dark-smartskip-off-mid`);
    await setTheme(page, 'light');

    // Verify toggling mid-playback takes effect immediately: still playing (OFF), turn ON, observe jump.
    const beforeToggleOn = await readClock(page);
    await smartSkipSwitch.click(); // back ON while playing
    await page.waitForTimeout(1200);
    const afterToggleOn = await readClock(page);
    console.log(`toggle OFF->ON mid-playback: ${beforeToggleOn} -> (1.2s later) ${afterToggleOn} [expect a visible jump if smart-skip engaged immediately]`);

    await page.locator('button[aria-label="Pause"]').click().catch(() => {});
  }

  await browser.close();
})();
