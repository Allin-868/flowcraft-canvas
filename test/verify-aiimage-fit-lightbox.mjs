// 冒烟：aiImage 节点框按真实图比例重排（无留白）+ 右键菜单「查看大图」开灯箱
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// 竖图 600×900，先给一个更宽的规格框（模拟规格与真实图比例不一致）
const fit = await page.evaluate(async () => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const node = editor.addNode('aiImage', 400, 200);
  node.width = 340; node.height = 360; // 宽于竖图比例的框 → 旧逻辑会留左右白边
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 900;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c48a7a'; ctx.fillRect(0, 0, 600, 900);
  node.thumb = canvas.toDataURL('image/png');
  window.buildNodeBody(node.el, node);
  await new Promise((done) => setTimeout(done, 900)); // 等异步 probe + 重排
  const hr = node.el.querySelector('.node-hero').getBoundingClientRect();
  return { width: node.width, height: node.height, ratio: node.ratio, heroAspect: hr.width / hr.height };
});
ok('hero 比例贴合竖图（≈0.667，无左右留白）', Math.abs(fit.heroAspect - 600 / 900) < 0.05, { heroAspect: +fit.heroAspect.toFixed(3), fit });

// 仅改规格、未出新图：框型保持规格设定，不被旧图重排
const specKeep = await page.evaluate(async () => {
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  window.applySpecSizeToAiImageNode ? window.applySpecSizeToAiImageNode(node) : null;
  const w = node.width, h = node.height;
  window.buildNodeBody(node.el, node);
  await new Promise((done) => setTimeout(done, 500));
  return { before: [w, h], after: [node.width, node.height] };
});
ok('仅改规格未出新图时不被旧图重排', specKeep.before[0] === specKeep.after[0] && specKeep.before[1] === specKeep.after[1], specKeep);

// 右键菜单含「查看大图」且点击开灯箱
// 直接对节点元素派发 contextmenu：避免悬停浮现标签顶移布局导致鼠标取点落空
const rect = await page.evaluate(() => {
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  const r = node.el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  node.el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  return { x, y };
});
await page.waitForTimeout(400);
const menuState = await page.evaluate(() => {
  const menu = document.querySelector('.context-menu');
  const items = [...document.querySelectorAll('.context-menu .context-menu-item')].map((i) => i.textContent.trim());
  return { shown: menu ? menu.classList.contains('show') : null, items };
});
const menuHas = menuState.items.includes('查看大图');
ok('右键菜单含「查看大图」', menuHas === true, menuState);
if (menuHas) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.context-menu .context-menu-item')].find((i) => i.textContent.trim() === '查看大图').click();
  });
  await page.waitForTimeout(300);
  const lbShow = await page.evaluate(() => document.getElementById('imageLightbox').classList.contains('show'));
  ok('点击「查看大图」打开灯箱', lbShow === true);
} else {
  ok('点击「查看大图」打开灯箱', false);
}

// blob:/https: URL 型 thumb 也要重排（真实生成的 thumb 常为 URL，此前闸门只认 data: 导致留白）
const urlFit = await page.evaluate(async () => {
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 400;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8ac47a'; ctx.fillRect(0, 0, 800, 400);
  const blob = await (await fetch(canvas.toDataURL('image/png'))).blob();
  node.thumb = URL.createObjectURL(blob);
  window.buildNodeBody(node.el, node);
  await new Promise((done) => setTimeout(done, 900));
  const hr = node.el.querySelector('.node-hero').getBoundingClientRect();
  return { width: node.width, height: node.height, heroAspect: hr.width / hr.height };
});
ok('URL 型 thumb hero 比例≈2（无留白）', Math.abs(urlFit.heroAspect - 2) < 0.05, { heroAspect: +urlFit.heroAspect.toFixed(3), urlFit });

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== aiImage 适配与大图冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
