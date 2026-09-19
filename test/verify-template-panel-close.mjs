#!/usr/bin/env node
/**
 * 开箱模板面板关闭契约闸门：点面板外（画布区域）与 Esc 必须能关面板。
 *
 * 由来（2026-09-19 用户真机报告 + 探针 probe-p67-tpl-close.mjs 取证）：
 *   应用里其它浮层都有「点外部 / 遮罩 / Esc」关闭契约——比例浮层、批量规格、宫格拆分、
 *   提示词库、提供方模型面板是 document mousedown 点外部关，工作流/工作台抽屉是遮罩点击关，
 *   唯独 #templatePanel 三条路都没有：只能点右上 X 或再点工具栏按钮，点画布区域毫无反应。
 *   定性为契约缺口（非设计如此）后修复：legacy.js 加捕获阶段 mousedown 点外部关
 *   （排除面板自身与 #btnTemplates——否则 mousedown 先关、click 又 toggle 开，按钮永远关不掉），
 *   全局 Esc 链补模板面板一档（与 workflow/asset 抽屉同档）。
 *
 * 断言形态：全部真实鼠标/键盘动作 + .show 类回读；「点面板内部」一条先用 elementFromPoint
 * 确认落点不是 button，避免误点关闭按钮造成假绿。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// 随仓库定位，不绑定个人机器（同 verify-ui-affordance.mjs 的做法）
const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = process.env.FLOWCRAFT_ROOT || join(resolve(SCRIPT_DIR, '../../..'), '输出成果', 'deploy');
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p: Boolean(p) }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };

const server = http.createServer((q, r) => {
  if (!existsSync(join(ROOT, 'index.html'))) { r.writeHead(500); r.end('no index'); return; }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(readFileSync(join(ROOT, 'index.html')));
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
// workflow/addNode 是经典脚本顶层 const/函数：在全局词法域里，裸标识符可访问但不在 window 上
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const shown = () => page.evaluate(() => document.getElementById('templatePanel').classList.contains('show'));
const openPanel = async () => {
  if (!(await shown())) { await page.click('#btnTemplates'); await page.waitForTimeout(300); }
  return shown();
};

// ① 工具栏按钮开面板（入口本身必须先可用）
await page.click('#btnTemplates');
await page.waitForTimeout(300);
check('工具栏按钮打开模板面板', await shown());

// ② 真实鼠标点画布空白区（面板 380px 贴右，左侧全是画布）→ 应关
await page.mouse.click(500, 600);
await page.waitForTimeout(300);
check('点画布空白区关闭模板面板', !(await shown()));

// ③ 面板内部点击不应关：落点先经 elementFromPoint 确认不是 button（防误点 X 假绿）
await openPanel();
const inner = await page.evaluate(() => {
  const r = document.getElementById('templatePanel').getBoundingClientRect();
  const x = r.left + 40, y = r.top + 18; // header 标题区，无按钮
  const hit = document.elementFromPoint(x, y);
  return { x, y, safe: !!hit && !hit.closest('button') && document.getElementById('templatePanel').contains(hit) };
});
await page.mouse.click(inner.x, inner.y);
await page.waitForTimeout(250);
check('点面板内部（非按钮）不关闭', inner.safe && (await shown()), inner.safe ? '' : '落点不安全 ' + JSON.stringify(inner));

// ④ Esc 关（与全局 Esc 链里 workflow/asset 抽屉同档）
await openPanel();
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check('Esc 关闭模板面板', !(await shown()));

// ⑤ 工具栏按钮再点应能关：mousedown 点外部关不得破坏 toggle（按钮自身被排除）
await openPanel();
await page.click('#btnTemplates');
await page.waitForTimeout(300);
check('工具栏按钮 toggle 仍可关闭', !(await shown()));

// ⑥ 关闭后画布交互不受牵连：点节点能选中（addNode 会顺手选中，先 clear 交回选中权）
await page.evaluate(() => {
  const n = addNode('text', 300, 300);
  workflow.selection.clear();
  const r = n.el.getBoundingClientRect();
  window.__npt = { x: r.x + r.width / 2, y: r.y + 20 };
});
await page.waitForTimeout(250);
const pt = await page.evaluate(() => window.__npt);
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(250);
check('关面板后点节点仍可选中', (await page.evaluate(() => workflow.selection.size)) === 1);

// ⑦ 全程无页面异常
check('全程无 pageerror', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
const bad = checks.filter((c) => !c.p);
console.log(`\nverify-template-panel-close: ${checks.length - bad.length}/${checks.length} 通过`);
if (bad.length) { console.log('失败：' + bad.map((c) => c.n).join('；')); process.exit(1); }
