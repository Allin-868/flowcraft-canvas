// 回归：设为资产必须立即进入“我的资产”，并以 IndexedDB 持久化。
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const INDEX = fileURLToPath(new URL('../index.html', import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));

await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const canvas = document.createElement('canvas');
  canvas.width = 120; canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff7a00'; ctx.fillRect(0, 0, 120, 80);
  ctx.fillStyle = '#fff'; ctx.fillRect(46, 28, 28, 24);
  const src = canvas.toDataURL('image/png');
  const n = editor.addNode('aiImage', 300, 240);
  n.thumb = src;
  n.outputsData = [{ type: 'image', value: src, label: '产出·1' }];
  window.buildNodeBody(n.el, n);
  window.selectNode(n);
});

await page.evaluate(() => document.getElementById('btnAssets').click());
await page.waitForFunction(() => document.getElementById('assetPanel')?.classList.contains('show'), null, { timeout: 5000 });
await page.waitForFunction(() => document.querySelector('[data-asset-view="current"]')?.classList.contains('active'), null, { timeout: 5000 });
await page.waitForFunction(() => document.querySelectorAll('#assetGrid .asset-card').length > 0, null, { timeout: 5000 });

await page.fill('.asset-card .asset-name-input', '回归资产');
await page.click('.asset-card [data-act="setasset"]');
await page.waitForFunction(() => document.querySelector('[data-asset-view="saved"]')?.classList.contains('active'), null, { timeout: 5000 });
await page.waitForFunction(() => document.querySelectorAll('#assetGrid .asset-card').length > 0, null, { timeout: 5000 });
const savedVisible = await page.evaluate(() => [...document.querySelectorAll('#assetGrid .asset-title')].map(x => x.textContent || ''));
ok('设为资产后自动切到我的资产', savedVisible.some(t => t.includes('回归资产')), savedVisible);

const idbSaved = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('flowcraft-db', 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const value = await new Promise((resolve, reject) => {
    const req = db.transaction('kv', 'readonly').objectStore('kv').get('globalAssetImages:v1');
    req.onsuccess = () => resolve(req.result && req.result.v);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return Object.keys(value || {});
});
ok('资产图片写入 IndexedDB 真源', idbSaved.length > 0, idbSaved);

await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(600);
await page.evaluate(() => document.getElementById('btnAssets').click());
await page.waitForFunction(() => document.getElementById('assetPanel')?.classList.contains('show'), null, { timeout: 5000 });
await page.click('[data-asset-view="saved"]');
await page.waitForFunction(() => document.querySelector('[data-asset-view="saved"]')?.classList.contains('active'), null, { timeout: 5000 });
await page.waitForTimeout(300);
const afterReload = await page.evaluate(() => [...document.querySelectorAll('#assetGrid .asset-title')].map(x => x.textContent || ''));
ok('刷新后我的资产仍保留', afterReload.some(t => t.includes('回归资产')), afterReload);

ok('无页面错误', pageErrors.length === 0, pageErrors);
await browser.close();
console.log(`[verify-global-assets] ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
