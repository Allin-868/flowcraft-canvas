#!/usr/bin/env node
/**
 * 场景分组面板关闭契约闸门：点画布空白与 Esc 必须关面板，但点节点不得关（主流程保护）。
 *
 * 由来（2026-09-19 用户真机报告：「场景分组也是需再次点击关闭」）：
 *   与开箱模板面板同类的契约缺口（第 5 处缺陷的姊妹篇，登记为第 6 处）——全局 Esc 链与
 *   点外部关闭都没收 #scenePanel。但场景面板不能照抄模板面板的「任何外部点击都关」：
 *   面板每张场景卡上有「加入选中(N)」按钮（renderScenePanel），主流程是「面板开着 →
 *   画布点选节点 → 回面板点加入」，点节点即关会把这条主流程打断。
 *   修复契约：点面板外关闭，例外两类——工具栏开关按钮自身（保 toggle）与 .node 本体（保选节点）。
 *
 * 断言形态：全部真实鼠标/键盘动作 + .show 类回读；「点面板内部」落点先经 elementFromPoint
 * 确认非按钮，防误点 X 假绿。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
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
// workflow/addNode 是经典脚本顶层 const/函数：裸标识符可访问但不在 window 上
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const shown = () => page.evaluate(() => document.getElementById('scenePanel').classList.contains('show'));
const openPanel = async () => {
  if (!(await shown())) { await page.click('#btnScenes'); await page.waitForTimeout(300); }
  return shown();
};

// ① 工具栏按钮开面板
await page.click('#btnScenes');
await page.waitForTimeout(300);
check('工具栏按钮打开场景面板', await shown());

// ①b 布局契约（2026-09-19 用户反馈「太靠近画布顶部」后改版）：右侧垂直居中浮窗，
// 中心偏差 ≤40px 且不贴顶（top>40px 把旧「贴顶全高抽屉」钉住，修复前必红），完整在视口内
const geo = await page.evaluate(() => {
  const r = document.getElementById('scenePanel').getBoundingClientRect();
  return { t: r.top, b: r.bottom, l: r.left, rt: r.right, vh: innerHeight, vw: innerWidth };
});
const off = Math.abs((geo.t + geo.b) / 2 - geo.vh / 2);
check('场景面板垂直居中浮窗（不贴顶、在视口内）', off <= 40 && geo.t > 40 && geo.b <= geo.vh && geo.l >= 0 && geo.rt <= geo.vw, `中心偏差=${Math.round(off)}px top=${Math.round(geo.t)}`);

// ② 真实鼠标点画布空白区 → 应关
await page.mouse.click(500, 700);
await page.waitForTimeout(300);
check('点画布空白区关闭场景面板', !(await shown()));

// ③ 主流程保护：面板开着点节点 → 不关，且节点被选中（「加入选中」依赖这条）
// 夹具坑（DEBT 坑 7 同源）：addNode 只写数据坐标，冷启动相机可能把节点垫到 minimap 底下 →
// 先 fitToContent 归一视图，再量坐标，点击前用 elementFromPoint 钉住命中节点本体
await page.evaluate(() => { const n = addNode('text', 320, 320); workflow.selection.clear(); window.__nid = n.id; fitToContent(); });
await page.waitForTimeout(400);
await openPanel();
const pt = await page.evaluate(() => {
  const n = workflow.nodes.get(window.__nid);
  const r = n.el.getBoundingClientRect();
  const x = r.x + r.width / 2, y = r.y + 20;
  const hit = document.elementFromPoint(x, y);
  return { x, y, ok: !!(hit && hit.closest('.node') === n.el) };
});
if (!pt.ok) console.log('  · 夹具提醒：点击落点未命中节点本体 ' + JSON.stringify(pt));
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(300);
const selN = await page.evaluate(() => workflow.selection.size);
check('点节点不关场景面板（保「选节点→加入选中」主流程）', pt.ok && (await shown()) && selN === 1, `落点命中=${pt.ok} show=${await shown()} 选中数=${selN}`);

// ④ 面板内部点击不应关：落点先确认不是 button（防误点 X / 新建假绿）
await openPanel();
const inner = await page.evaluate(() => {
  const r = document.getElementById('scenePanel').getBoundingClientRect();
  const x = r.left + 40, y = r.top + 16; // header 标题区
  const hit = document.elementFromPoint(x, y);
  return { x, y, safe: !!hit && !hit.closest('button') && document.getElementById('scenePanel').contains(hit) };
});
await page.mouse.click(inner.x, inner.y);
await page.waitForTimeout(250);
check('点面板内部（非按钮）不关闭', inner.safe && (await shown()), inner.safe ? '' : '落点不安全 ' + JSON.stringify(inner));

// ⑤ Esc 关（并入全局 Esc 链，与 workflow/asset/template 同档）
await openPanel();
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check('Esc 关闭场景面板', !(await shown()));

// ⑥ 工具栏按钮 toggle 仍可关：mousedown 点外部关不得把按钮打成「永远关不掉」
await openPanel();
await page.click('#btnScenes');
await page.waitForTimeout(300);
check('工具栏按钮 toggle 仍可关闭', !(await shown()));

// ⑦ 全程无页面异常
check('全程无 pageerror', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
const bad = checks.filter((c) => !c.p);
console.log(`\nverify-scene-panel-close: ${checks.length - bad.length}/${checks.length} 通过`);
if (bad.length) { console.log('失败：' + bad.map((c) => c.n).join('；')); process.exit(1); }
