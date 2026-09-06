// 冒烟：提示词放大编辑（composer + text 节点），实时回写与关闭行为
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
const LONG = '一段足够长的提示词，'.repeat(40);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// —— composer 提示词 ——
await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const n = editor.addNode('aiImage', 400, 200);
  window.selectNode(n);
});
await page.waitForTimeout(200);
const composerBtns = await page.evaluate(() => document.querySelectorAll('#nodeComposer .prompt-expand-btn').length);
ok('composer 内有放大按钮', composerBtns === 1, composerBtns);
await page.click('#nodeComposer .prompt-expand-btn');
await page.waitForTimeout(200);
ok('放大模态打开', await page.evaluate(() => !!document.querySelector('.prompt-expand-overlay.show')));
const panelGeo = await page.evaluate(() => {
  const ov = document.querySelector('.prompt-expand-overlay');
  const box = document.querySelector('.prompt-expand-box');
  const btn = document.querySelector('#nodeComposer .prompt-expand-btn');
  const cs = getComputedStyle(ov);
  const br = box.getBoundingClientRect();
  const ar = btn.getBoundingClientRect();
  return {
    bg: cs.backgroundColor,
    pe: cs.pointerEvents,
    boxW: br.width,
    anchored: Math.abs(br.top - (ar.bottom + 8)) < 60 || Math.abs(br.bottom - (ar.top - 8)) < 60,
    vw: window.innerWidth,
  };
});
ok('非全屏遮罩（背景透明 + 不拦截指针）', panelGeo.bg === 'rgba(0, 0, 0, 0)' && panelGeo.pe === 'none', panelGeo);
ok('面板宽度 ≤ 600（非居中大屏）', panelGeo.boxW <= 600, panelGeo.boxW);
ok('面板锚定在触发按钮附近', panelGeo.anchored === true, panelGeo);
await page.fill('.prompt-expand-textarea', LONG);
const live = await page.evaluate(() => {
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  return { prompt: node.prompt, inline: document.querySelector('#nodeComposer .nc-textarea').value, count: document.querySelector('.prompt-expand-count').textContent };
});
ok('输入实时回写 node.prompt', live.prompt === LONG, live.prompt && live.prompt.length);
ok('小框同步刷新', live.inline === LONG);
ok('字数统计显示', /字$/.test(live.count), live.count);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const afterEsc = await page.evaluate(() => ({
  overlay: !!document.querySelector('.prompt-expand-overlay'),
  composerStillOpen: !document.getElementById('nodeComposer').hidden,
}));
ok('Esc 关闭模态', afterEsc.overlay === false);
ok('Esc 不误伤 composer（捕获阶段拦截）', afterEsc.composerStillOpen === true);

// 点外部关闭
await page.click('#nodeComposer .prompt-expand-btn');
await page.waitForTimeout(200);
await page.mouse.click(60, 700);
await page.waitForTimeout(200);
ok('点击面板外部关闭', await page.evaluate(() => !document.querySelector('.prompt-expand-overlay')));

// —— text 节点两个文本区 ——
await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  window.selectNode(editor.addNode('text', 800, 200));
});
await page.waitForTimeout(300);
const textBtns = await page.evaluate(() => document.querySelectorAll('.node-body-text .prompt-expand-btn').length);
ok('text 节点有两个放大按钮（角色描述+固定提示词）', textBtns === 2, textBtns);

// 角色描述（第一个）
await page.evaluate(() => document.querySelectorAll('.node-body-text .prompt-expand-btn')[0].click());
await page.waitForTimeout(200);
await page.fill('.prompt-expand-textarea', '黑发少女、白色连衣裙');
await page.click('.prompt-expand-close');
await page.waitForTimeout(200);
const lead = await page.evaluate(() => {
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()].pop());
  return { charDesc: node.charDesc, overlay: !!document.querySelector('.prompt-expand-overlay') };
});
ok('角色描述回写且关闭按钮生效', lead.charDesc === '黑发少女、白色连衣裙' && lead.overlay === false, lead);

// 固定提示词（第二个）
await page.evaluate(() => document.querySelectorAll('.node-body-text .prompt-expand-btn')[1].click());
await page.waitForTimeout(200);
await page.fill('.prompt-expand-textarea', LONG);
await page.keyboard.press('Control+Enter');
await page.waitForTimeout(200);
const main = await page.evaluate(() => {
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()].pop());
  return { prompt: node.prompt, overlay: !!document.querySelector('.prompt-expand-overlay') };
});
ok('固定提示词回写且 Ctrl+Enter 关闭', main.prompt === LONG && main.overlay === false, main.prompt && main.prompt.length);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 提示词放大编辑冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
