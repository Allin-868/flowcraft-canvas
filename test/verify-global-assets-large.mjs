// 回归：超过 localStorage 3.5MB 软上限的图片资产必须通过 IndexedDB 成功入库。
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
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));

await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const canvas = document.createElement('canvas');
  canvas.width = 9000; canvas.height = 9000;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#204080'; ctx.fillRect(0, 0, 9000, 9000);
  ctx.fillStyle = '#ffdd66'; ctx.fillRect(1200, 1200, 6600, 6600);
  for (let y = 0; y < 9000; y += 10) {
    ctx.fillStyle = 'rgba(' + (y % 256) + ',128,255,0.5)';
    ctx.fillRect(0, y, 9000, 6);
  }
  for (let x = 0; x < 9000; x += 10) {
    ctx.fillStyle = 'rgba(255,' + (x % 256) + ',128,0.5)';
    ctx.fillRect(x, 0, 6, 9000);
  }
  const src = canvas.toDataURL('image/png');
  if (src.length <= 3.5 * 1024 * 1024) throw new Error('测试图未超过 localStorage 软上限: ' + src.length);
  const n = editor.addNode('aiImage', 300, 240);
  n.thumb = src;
  n.outputsData = [{ type: 'image', value: src, label: '产出·1' }];
  window.buildNodeBody(n.el, n);
  window.selectNode(n);
});

await page.evaluate(() => document.getElementById('btnAssets').click());
await page.waitForFunction(() => document.getElementById('assetPanel')?.classList.contains('show'), null, { timeout: 5000 });
await page.waitForFunction(() => document.querySelectorAll('#assetGrid .asset-card').length > 0, null, { timeout: 5000 });
await page.fill('.asset-card .asset-name-input', '大图资产');
await page.click('.asset-card [data-act="setasset"]');
await page.waitForFunction(() => document.querySelector('[data-asset-view="saved"]')?.classList.contains('active'), null, { timeout: 5000 });
await page.waitForTimeout(500);
const sizes = await page.evaluate(() => {
  const legacy = JSON.parse(localStorage.getItem('flowcraft:assetImages:v1') || '{}');
  const titles = [...document.querySelectorAll('#assetGrid .asset-title')].map(x => x.textContent || '');
  return { legacyCount: Object.keys(legacy).length, titles };
});
ok('大图不再写入 localStorage 旧副本', sizes.legacyCount === 0, sizes.legacyCount);
ok('大图资产显示在界面', sizes.titles.some(t => t.includes('大图资产')), sizes.titles);

ok('无页面错误', pageErrors.length === 0, pageErrors);
await browser.close();
console.log(`[verify-global-assets-large] ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
