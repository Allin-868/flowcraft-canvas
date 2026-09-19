#!/usr/bin/env node
/**
 * 场景分组「应用内对话框」闸门：新建场景（输入型）与右键「加入场景」（选择型）必须走
 * 应用内居中浮层对话框，不得再用浏览器原生 prompt。
 *
 * 由来（2026-09-19 用户截图报告）：点场景面板「新建」弹出的是原生 prompt()——Chrome 把它
 * 钉在窗口左上角（太靠近画布顶部、够不到画面中心），样式完全不受应用控制（白框与深色主题
 * 割裂），且「加入场景」还要求用户「输入序号」这种反直觉交互。原生对话框无法移位，
 * 唯一解是换成应用内浮层（登记为第 7 处产品缺陷）。
 *
 * 断言形态：真实点击/键盘；page.on('dialog') 监听器兜住并计数任何原生弹窗（修复前必红在
 * 「零原生弹窗」上）；对话框居中用 getBoundingClientRect 对视口中心求偏差。
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
// 原生弹窗一旦出现：记下类型+文案并 dismiss，防止阻塞后续动作
const nativeDialogs = [];
page.on('dialog', async (d) => { nativeDialogs.push(d.type() + ':' + (d.message() || '').slice(0, 16)); await d.dismiss().catch(() => {}); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
// workflow/addNode/createScene 是经典脚本顶层绑定：裸标识符可访问但不在 window 上
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const dlgShown = () => page.evaluate(() => !!document.querySelector('.app-dialog-overlay .app-dialog'));
const dlgGone = async () => { await page.waitForFunction(() => !document.querySelector('.app-dialog-overlay'), null, { timeout: 1500 }).catch(() => {}); return page.evaluate(() => !document.querySelector('.app-dialog-overlay')); };
const sceneCount = () => page.evaluate(() => workflow.scenes.length);

await page.click('#btnScenes');
await page.waitForTimeout(300);

// ① 「新建」开应用内对话框
await page.click('#sceneNew');
await page.waitForTimeout(300);
check('「新建」打开应用内对话框（非原生 prompt）', await dlgShown());

// ② 对话框画面居中（用户原话「尽量在画面中心」；修复前原生框在窗口左上角）
const geo = await page.evaluate(() => {
  const el = document.querySelector('.app-dialog');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { dx: Math.abs((r.left + r.right) / 2 - innerWidth / 2), dy: Math.abs((r.top + r.bottom) / 2 - innerHeight / 2), t: r.top };
});
check('对话框居中于画面（横纵偏差 ≤60px、不贴顶）', !!geo && geo.dx <= 60 && geo.dy <= 60 && geo.t > 60, geo ? `dx=${Math.round(geo.dx)} dy=${Math.round(geo.dy)} top=${Math.round(geo.t)}` : '无对话框');

// ③ 输入 + Enter 提交 → 场景创建、对话框关闭
let created = false;
if (geo) {
  await page.fill('.app-dialog-input', '首发场景');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  created = (await sceneCount()) === 1 && await page.evaluate(() => workflow.scenes[0].name === '首发场景') && (await dlgGone());
}
check('输入名称后 Enter 提交：场景创建且对话框关闭', created, `场景数=${await sceneCount()}`);

// ④ Esc 只关对话框，不误关后面的场景面板（Esc 捕获链须被对话框吃掉）
await page.click('#sceneNew');
await page.waitForTimeout(300);
let escOk = false;
if (await dlgShown()) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  escOk = (await dlgGone()) && (await sceneCount()) === 1 && await page.evaluate(() => document.getElementById('scenePanel').classList.contains('show'));
}
check('Esc 关对话框且场景面板不被连带关闭', escOk);

// ⑤ 点遮罩（对话框外区域）关闭
await page.click('#sceneNew');
await page.waitForTimeout(300);
let maskOk = false;
if (await dlgShown()) {
  await page.mouse.click(120, 120);
  await page.waitForTimeout(300);
  maskOk = await dlgGone();
}
check('点遮罩关闭对话框', maskOk);

// ⑥⑦ 右键「加入场景」→ 应用内选择对话框（点选场景卡，不再「输入序号」）→ 成员入场景
await page.evaluate(() => { const n = addNode('text', 320, 320); workflow.selection.clear(); window.__nid = n.id; createScene('B 场景'); fitToContent(); });
await page.waitForTimeout(400);
// 真实路径：左键选中节点 → 右键开菜单 → 点「加入场景」
const npt = await page.evaluate(() => {
  const n = workflow.nodes.get(window.__nid);
  const r = n.el.getBoundingClientRect();
  const x = r.x + r.width / 2, y = r.y + 20;
  const hit = document.elementFromPoint(x, y);
  return { x, y, ok: !!(hit && hit.closest('.node') === n.el) };
});
check('夹具：节点落在视图可点处', npt.ok);
await page.mouse.click(npt.x, npt.y);
await page.waitForTimeout(200);
await page.mouse.click(npt.x, npt.y, { button: 'right' });
await page.waitForTimeout(300);
const menuHit = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.context-menu-item')];
  const it = items.find((b) => b.textContent.includes('加入场景'));
  if (!it) return false;
  const r = it.getBoundingClientRect();
  window.__menu = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  return true;
});
let pickerOk = false, addedOk = false;
if (menuHit) {
  const mp = await page.evaluate(() => window.__menu);
  await page.mouse.click(mp.x, mp.y);
  await page.waitForTimeout(300);
  pickerOk = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('.app-dialog-choice')];
    return !!document.querySelector('.app-dialog') && cs.length === workflow.scenes.length && cs.some((b) => b.textContent.includes('首发场景'));
  });
  // 点「首发场景」卡 → 节点入场景
  if (pickerOk) {
    const cp = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.app-dialog-choice')].find((x) => x.textContent.includes('首发场景'));
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(cp.x, cp.y);
    await page.waitForTimeout(300);
    addedOk = await page.evaluate(() => !document.querySelector('.app-dialog-overlay') && workflow.scenes[0].nodeIds.includes(window.__nid));
  }
}
check('右键「加入场景」→ 应用内选择对话框（场景渲染成可点卡片）', pickerOk, menuHit ? '' : '菜单项未命中');
check('点场景卡即完成加入（成员入场景、对话框关闭）', addedOk);

// ⑧ 全程零原生弹窗 + 零 pageerror
check('全程零原生 prompt/alert', nativeDialogs.length === 0, nativeDialogs.join(' | '));
check('全程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`\nverify-scene-dialogs: ${checks.filter((c) => c.p).length}/${checks.length} 通过`);
await browser.close(); server.close();
process.exit(checks.every((c) => c.p) ? 0 : 1);
