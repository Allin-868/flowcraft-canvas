// 冒烟：text 节点标题/状态徽标外置到节点框上方（与 aiImage 一致），body 顶行不再被叠压
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

const geo = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const node = editor.addNode('text', 500, 300);
  window.selectNode(node);
  const nr = node.el.getBoundingClientRect();
  const header = node.el.querySelector('.node-header');
  const hr = header.getBoundingClientRect();
  const toolbar = node.el.querySelector('.text-node-toolbar');
  const tr = toolbar ? toolbar.getBoundingClientRect() : null;
  const pills = {
    tier: node.el.querySelector('.node-tier-pill'),
    result: node.el.querySelector('.node-result-pill'),
    status: node.el.querySelector('.node-status-pill'),
  };
  return {
    hasImageOnlyClass: node.el.classList.contains('node--image-only'),
    headerAboveBox: hr.bottom <= nr.top + 2,
    headerBottom: +hr.bottom.toFixed(1),
    nodeTop: +nr.top.toFixed(1),
    headerOpacity: getComputedStyle(header).opacity,
    pillsInHeader: header.contains(pills.tier) && header.contains(pills.result) && header.contains(pills.status),
    pillTexts: [pills.tier.textContent, pills.result.textContent, pills.status.textContent],
    pillsVisible: !pills.tier.hidden && !pills.result.hidden && !pills.status.hidden,
    toolbarInsideBox: tr ? tr.top >= nr.top - 1 : false,
    toolbarNotUnderHeader: tr && hr.bottom <= tr.top + 2,
    hasCloseBtn: !!node.el.querySelector('.node-close-btn-mini'),
  };
});
ok('text 节点启用外置标题栏模式', geo.hasImageOnlyClass === true);
ok('标题/徽标栏位于节点框上方', geo.headerAboveBox === true, { headerBottom: geo.headerBottom, nodeTop: geo.nodeTop });
ok('选中时标题栏可见（opacity=1）', geo.headerOpacity === '1', geo.headerOpacity);
ok('三个状态徽标都在标题栏内', geo.pillsInHeader === true);
ok('徽标文案正确（输入/未运行/待运行）', geo.pillTexts.join('/') === '输入/未运行/待运行', geo.pillTexts);
ok('徽标未被隐藏', geo.pillsVisible === true);
ok('模型工具行在节点框内', geo.toolbarInsideBox === true);
ok('工具行不再被标题栏叠压', geo.toolbarNotUnderHeader === true);
ok('外置标题栏无关闭 X（防误触）', geo.hasCloseBtn === false);

// 对照：aiImage 同样是外置标题栏
const aiGeo = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  const node = editor.addNode('aiImage', 900, 300);
  const nr = node.el.getBoundingClientRect();
  const hr = node.el.querySelector('.node-header').getBoundingClientRect();
  return { imageOnly: node.el.classList.contains('node--image-only'), above: hr.bottom <= nr.top + 2 };
});
ok('aiImage 对照：同为外置标题栏', aiGeo.imageOnly === true && aiGeo.above === true, aiGeo);

// 删除能力仍在：Delete 键
const delOk = await page.evaluate(async () => {
  const before = window.FlowCraft._legacy.workflow.nodes.size;
  return before;
});
await page.keyboard.press('Delete');
await page.waitForTimeout(300);
const afterDel = await page.evaluate(() => window.FlowCraft._legacy.workflow.nodes.size);
ok('Delete 键仍可删除节点', afterDel === delOk - 1, { before: delOk, after: afterDel });

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== text 节点外置标题栏冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
