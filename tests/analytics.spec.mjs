import { test, expect, chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:8099';

test('card click pings track once, debounced within 5s', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const hits = [];
  await page.route('**/go.omri-iram.co.il/api/track', async (route) => {
    hits.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 204, body: '' });
  });
  await page.goto(BASE + '/index.html');
  const qr = page.locator('.tool-card[data-tool="qr"]');
  // Prevent real navigation so we can click twice on the same page.
  await page.evaluate(() => document.querySelectorAll('.tool-card').forEach(
    (a) => a.addEventListener('click', (e) => e.preventDefault())));
  await qr.click();
  await qr.click(); // within 5s → debounced
  await page.waitForTimeout(300);
  expect(hits.length).toBe(1);
  expect(hits[0].tool).toBe('qr');
  await browser.close();
});

test('admin panel renders ranked rows from mocked /api/stats', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/go.omri-iram.co.il/api/stats', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      tools: [
        { tool: 'qr', total: 42, me: 5, visitors: 37, daily: [
          { day: '2026-07-13', total: 3, admin: 1 },
          { day: '2026-07-14', total: 8, admin: 0 },
          { day: '2026-07-15', total: 5, admin: 2 } ] },
        { tool: 'randomizer', total: 9, me: 9, visitors: 0, daily: [] },
      ],
    }) });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem('omri_admin', '1'); } catch (_) {}
  });
  await page.goto(BASE + '/index.html');
  const table = page.locator('#statsPanel .stats-table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  // First row is the top tool (qr) with its Hebrew name + totals.
  const first = table.locator('tbody tr').first();
  await expect(first).toContainText('42');
  await expect(first.locator('svg.spark, svg .spark')).toHaveCount(1);
  await browser.close();
});
