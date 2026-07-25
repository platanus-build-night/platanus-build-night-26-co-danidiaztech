import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:5173/solve/12', { waitUntil: 'networkidle' });
await p.evaluate(() => document.documentElement.setAttribute('data-theme','dark'));
// click through the preflight gate
const btn = p.getByRole('button', { name: /without recording/i });
if (await btn.count()) { await btn.click(); await p.waitForTimeout(2500); }
await p.screenshot({ path: '.screenshots/verify-statement-dark.png' });
await b.close();
