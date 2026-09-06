// 冒烟：图片输入节点右键 = 节点上下文菜单；双击 = 查看大图
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
const visible = (el) => {
  if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

const rect = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#7aa0c4'; ctx.fillRect(0, 0, 640, 360);
  const node = editor.addNode('image', 400, 240);
  node.thumb = canvas.toDataURL('image/png');
  window.buildNodeBody(node.el, node);
  const r = node.el.querySelector('.node-image-input-hero').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});

// 右键 → 节点上下文菜单，且不开大图
await page.mouse.click(rect.x, rect.y, { button: 'right' });
await page.waitForTimeout(250);
const afterRight = await page.evaluate(() => ({
  menu: !!document.querySelector('.context-menu') && getComputedStyle(document.querySelector('.context-menu')).display !== 'none',
  // lightbox 基础态为 opacity:0/pointer-events:none，必须以 .show 类判定
  lightbox: document.getElementById('imageLightbox').classList.contains('show'),
}));
ok('右键打开节点上下文菜单', afterRight.menu === true, afterRight);
ok('右键不再打开大图', afterRight.lightbox === false, afterRight);

// 关掉菜单
await page.keyboard.press('Escape');
await page.mouse.click(60, 500);
await page.waitForTimeout(200);

// 双击 → 查看大图
await page.mouse.dblclick(rect.x, rect.y);
await page.waitForTimeout(250);
const afterDbl = await page.evaluate(() => ({
  lightbox: document.getElementById('imageLightbox').classList.contains('show'),
}));
ok('双击打开大图', afterDbl.lightbox === true, afterDbl);

await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 对照：aiImage 节点右键仍为上下文菜单
const rect2 = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  const node = editor.addNode('aiImage', 800, 240);
  const r = node.el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.click(rect2.x, rect2.y, { button: 'right' });
await page.waitForTimeout(250);
const afterRight2 = await page.evaluate((fnStr) => {
  const visible = eval('(' + fnStr + ')');
  return { menu: visible(document.querySelector('.context-menu')) };
}, visible.toString());
ok('aiImage 右键仍为上下文菜单', afterRight2.menu === true, afterRight2);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 图片节点右键冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
