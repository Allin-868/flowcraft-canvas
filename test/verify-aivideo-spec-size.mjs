// 冒烟：aiVideo 节点框随所选比例调整（16:9 与 9:16 切换）
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

const measure = `(node) => {
  const hero = node.el.querySelector('.node-hero');
  const r = hero.getBoundingClientRect();
  return { width: node.width, height: node.height, ratio: node.ratio, heroAspect: r.width / r.height };
}`;

const land = await page.evaluate(async (mStr) => {
  const measure = eval('(' + mStr + ')');
  const { editor } = window.FlowCraft;
  editor.clear();
  const node = editor.addNode('aiVideo', 400, 200);
  window.applyAiSpecSelection(node, '16:9', '超清2K');
  await new Promise((done) => setTimeout(done, 300));
  return measure(node);
}, measure);
ok('选 16:9 后 hero 比例≈1.778', Math.abs(land.heroAspect - 16 / 9) < 0.08, { heroAspect: +land.heroAspect.toFixed(3) });
ok('node.ratio 记录 16:9', Math.abs((land.ratio || 0) - 16 / 9) < 0.01, land.ratio);

const port = await page.evaluate(async (mStr) => {
  const measure = eval('(' + mStr + ')');
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  window.applyAiSpecSelection(node, '9:16', '超清2K');
  await new Promise((done) => setTimeout(done, 300));
  return measure(node);
}, measure);
ok('切 9:16 后 hero 比例≈0.5625', Math.abs(port.heroAspect - 9 / 16) < 0.06, { heroAspect: +port.heroAspect.toFixed(3) });
ok('节点框确实变窄（宽随比例变化）', port.width < land.width, { land: land.width, port: port.width });
ok('节点框确实变高（高随比例变化）', port.height > land.height, { land: land.height, port: port.height });

// 方形回切
const sq = await page.evaluate(async (mStr) => {
  const measure = eval('(' + mStr + ')');
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  window.applyAiSpecSelection(node, '1:1', '超清2K');
  await new Promise((done) => setTimeout(done, 300));
  return measure(node);
}, measure);
ok('切 1:1 后 hero 比例≈1', Math.abs(sq.heroAspect - 1) < 0.06, { heroAspect: +sq.heroAspect.toFixed(3) });

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== aiVideo 规格联动冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
