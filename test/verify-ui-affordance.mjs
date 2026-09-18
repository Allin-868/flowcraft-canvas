#!/usr/bin/env node
/**
 * 主入口「点得到」闸门：断言关键 UI 对真实鼠标可用，而不是只存在于 DOM 里。
 *
 * 由来（都是同一类缺陷，靠 querySelector 存在性断言永远发现不了）：
 *   1) 角色状态节点的 4 个操作按钮被 .node--image-only 的规则隐藏（styles.css:947），
 *      线上鼠标完全点不到 —— 已用 :has 例外修复（styles.css:953）；
 *   2) restoreFromStorage 被调两次且不先清场，节点渲染两遍，按钮翻倍、点击命中孤儿元素
 *      —— 已加幂等清场（legacy.js restoreFromStorage）；
 *   3) 「一键同参重试」的两个调用点全在被隐藏的信息条里，aiImage 上无任何入口
 *      —— 已把入口迁到 composer 与右键菜单（B 方案）。
 *
 * 判据（见 window.__reach）：祖先链无 display:none / visibility:hidden、自身 pointer-events 未关、
 * 尺寸够大、中心点在视口内且 elementFromPoint 命中自身或其后代。
 * 注意：opacity:0 的悬停浮现是本应用的既有交互，因此需要先真实悬停再判定；
 *       遮罩型 UI（.image-lightbox）靠 .show 类切换，不能用 display 判，本脚本不直接断言它。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// 随仓库定位，不绑定个人机器（同 verify-genmeta-retry.mjs 的做法）
const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = process.env.FLOWCRAFT_ROOT || join(resolve(SCRIPT_DIR, '../../..'), '输出成果', 'deploy');
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p: Boolean(p) }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };

const server = http.createServer((q, r) => {
  if (!existsSync(join(ROOT, 'index.html'))) { r.writeHead(500); r.end('no index'); return; }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(readFileSync(join(ROOT, 'index.html')));
});
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

// 页内判据工具（一次定义，冷启动与 reload 后各注入一次）
const injectHelpers = () => page.evaluate(() => {
  const key = (n) => (n && n.className ? '.' + String(n.className).trim().split(/\s+/)[0] : (n ? n.tagName : 'null'));
  window.__reach = (el) => {
    if (!el) return { ok: false, why: 'missing' };
    let p = el;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (s.display === 'none') return { ok: false, why: 'display:none@' + key(p) };
      if (s.visibility === 'hidden') return { ok: false, why: 'visibility:hidden@' + key(p) };
      p = p.parentElement;
    }
    if (getComputedStyle(el).pointerEvents === 'none') return { ok: false, why: 'pointer-events:none' };
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return { ok: false, why: 'size ' + (r.width | 0) + 'x' + (r.height | 0) };
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return { ok: false, why: 'offscreen' };
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === el || el.contains(hit))) return { ok: false, why: 'covered by ' + key(hit) };
    return { ok: true, size: (r.width | 0) + 'x' + (r.height | 0) };
  };
  window.__mkImg = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#39c'; x.fillRect(0, 0, 64, 96); return c.toDataURL('image/png'); };
});
await injectHelpers();
// 前面步骤（开面板/选节点）会遗留画布平移，不先「适应内容」则节点可能落在视口外，
// 判据会把视图问题误报成死控件（fitToContent 就是用户菜单里的「适应内容」）
const frame = async () => { await page.evaluate(() => fitToContent()); await page.waitForTimeout(600); };
const reach = (sel) => page.evaluate((s) => window.__reach(document.querySelector(s)), sel);
// 真实点击失败必须记成断言失败，不能让闸门脚本抛异常中断（否则看不到后面还有哪些问题）
const safeClick = async (sel) => {
  try { await page.locator(sel).first().click({ timeout: 5000 }); await page.waitForTimeout(350); return { ok: true }; }
  catch (e) { return { ok: false, why: String(e.message).split('\n')[0].slice(0, 90) }; }
};

// ── ① 冷启动就要能点到的全局入口 ──
// 注意：#aiSettingsBtn 在折叠态的 #aiPanel 里（opacity:0 + pointer-events:none 继承）、
// #btnNewWorkflow 在停出视口的工作台抽屉里，都不属于「冷启动可见」，各按②③的流程先展开再验。
const ENTRIES = [['btnAssets', '素材库'], ['btnArrange', '自动排列'], ['btnExport', '导出项目'], ['btnImport', '导入项目'], ['btnWorkflow', '工作流抽屉'], ['btnTemplates', '模板库']];
for (const [id, name] of ENTRIES) {
  const r = await reach('#' + id);
  check(`全局入口可点：${name}（#${id}）`, r.ok, JSON.stringify(r));
}

// ── ② 展开 AI 面板 → 点开模型设置 → 面板内控件要能点 ──
const toggle = await safeClick('#aiToggleBtn');
check('展开 AI 面板的按钮可点（#aiToggleBtn）', toggle.ok, JSON.stringify(toggle));
const settings = await reach('#aiSettingsBtn');
check(`全局入口可点：模型设置（#aiSettingsBtn）`, settings.ok, JSON.stringify(settings));
const openSettings = settings.ok ? await safeClick('#aiSettingsBtn') : { ok: false, why: '入口不可点，跳过' };
check('真实点击可打开模型设置面板', openSettings.ok, JSON.stringify(openSettings));
await page.waitForTimeout(400);
for (const [id, name] of [['provFetchModelsBtn', '拉取模型列表'], ['provAddBtn', '添加供应商']]) {
  const r = await reach('#' + id);
  check(`设置面板内可点：${name}（#${id}）`, r.ok, JSON.stringify(r));
}
await page.evaluate(() => { const p = document.getElementById('aiSettingsPanel'); if (p) p.classList.remove('open'); document.getElementById('aiPanel')?.classList.add('collapsed'); });

// ── ②b 工作流抽屉内的入口（注意：三个抽屉共用 .recycle-panel/.recycle-overlay 类，
// #btnWorkbench 开的是工作台、#btnWorkflow 才开包含 #btnNewWorkflow 的 #workflowPanel）──
const openWf = await safeClick('#btnWorkflow');
check('真实点击打开工作流抽屉', openWf.ok, JSON.stringify(openWf));
await page.waitForTimeout(700);   // 抽屉是 slide 动画，不等到位会判成 offscreen
const nw = await reach('#btnNewWorkflow');
check('工作流抽屉内可点：新建画布（#btnNewWorkflow）', nw.ok, JSON.stringify(nw));
await page.evaluate(() => toggleWorkflowPanel(false));
await page.waitForTimeout(700);

// ── ③ 真实点开素材库 ──
const openAsset = await safeClick('#btnAssets');
check('真实点击打开素材库', openAsset.ok, JSON.stringify(openAsset));
for (const [id, name] of [['assetSearch', '素材搜索框'], ['assetClose', '素材面板关闭']]) {
  const r = await reach('#' + id);
  check(`素材面板内可点：${name}（#${id}）`, r.ok, JSON.stringify(r));
}
const closeAsset = await safeClick('#assetClose');
check('真实点击可关闭素材库', closeAsset.ok, JSON.stringify(closeAsset));

// ── ④ aiImage 节点：悬停浮现的外置工具按钮 + composer 入口 ──
const seedId = await page.evaluate(() => {
  clearGraph();
  const n = addNode('aiImage', 300, 240);
  n.prompt = '可点性体检'; n.params.model = 'GPT Image 2';
  n.thumb = window.__mkImg(); n.outputsData = [{ type: 'image', value: n.thumb }]; n.status = 'done';
  captureGenMeta(n, 1234);
  buildNodeBody(n.el, n);
  return n.id;
});
await frame();
const seedBox = await page.evaluate((id) => { const r = document.querySelector('.node[data-id="' + id + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, seedId);
await page.mouse.move(seedBox.x, seedBox.y);      // 真实悬停：外置工具按钮靠 :hover 显形
await page.waitForTimeout(400);
const tools = await page.evaluate((id) => {
  const el = document.querySelector('.node[data-id="' + id + '"]');
  const list = [...el.querySelectorAll('.node-tools .node-tool-btn')];
  return { count: list.length, bad: list.map((b) => ({ t: b.title.slice(0, 12), ...window.__reach(b) })).filter((x) => !x.ok) };
}, seedId);
check('aiImage 外置工具按钮数量正常（不翻倍 = 无重复渲染）', tools.count === 6, 'count=' + tools.count);
check('aiImage 外置工具按钮全部可点（悬停态）', tools.bad.length === 0, JSON.stringify(tools.bad));

const ph = await page.evaluate((id) => {
  const el = document.querySelector('.node[data-id="' + id + '"]');
  // 4 个空实现占位按钮（legacy.js tools 数组，onclick 只 stopPropagation）必须保持不可见
  const list = [...el.querySelectorAll('.node-toolbar .tool-btn')].filter((b) => !b.classList.contains('state-node-action') && !b.classList.contains('tool-btn-upload'));
  return { total: list.length, visible: list.filter((b) => window.__reach(b).ok).map((b) => b.title) };
}, seedId);
check('空实现占位按钮保持隐藏（未误补入口前不得显形）', ph.visible.length === 0, JSON.stringify(ph));

// 选中节点才弹 composer（左键语义）；位置由 positionNodeComposer 贴到节点旁
await page.evaluate((id) => selectNode(workflow.nodes.get(id)), seedId);
await page.waitForTimeout(400);
for (const [sel, name] of [['#nodeComposer .nc-run', '生成'], ['#nodeComposer .nc-retry', '同参重试']]) {
  const r = await reach(sel);
  check(`composer 内可点：${name}（${sel}）`, r.ok, JSON.stringify(r));
}

// ── ⑤ 右键菜单项可点（直接派发 contextmenu：真实右键会因悬停位移落空，见 DEBT.md） ──
const menu = await page.evaluate((id) => {
  const el = document.querySelector('.node[data-id="' + id + '"]');
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
  const items = [...document.querySelectorAll('.context-menu .context-menu-item')];
  const pick = (label) => { const it = items.find((x) => x.textContent.trim() === label); return it ? window.__reach(it) : { ok: false, why: 'no such item' }; };
  return { all: items.map((x) => x.textContent.trim().replace(/\s+/g, ' ')), retry: pick('同参重试'), run: pick('运行节点'), zoom: pick('查看大图') };
}, seedId);
check('右键菜单出现「同参重试」且可点', menu.retry.ok, JSON.stringify(menu.retry) + ' 菜单=' + menu.all.join('/'));
check('右键菜单「运行节点」可点', menu.run.ok, JSON.stringify(menu.run));
check('右键菜单「查看大图」可点', menu.zoom.ok, JSON.stringify(menu.zoom));
await page.evaluate(() => hideContextMenu());

// ── ⑥ 角色状态节点：4 个高频操作按钮（本轮缺陷 1 的回归钉） ──
const st = await page.evaluate(() => {
  clearGraph();
  const src = addNode('aiImage', 260, 220);
  const n = addNode('aiImage', 700, 220);
  n.title = '状态一：日常着装';
  n.stateMeta = { sourceId: src.id, label: '日常着装', index: 1, batchId: 'b1', batchIndex: 1, batchTotal: 1, batchProgress: null, failureReason: '' };
  n.thumb = window.__mkImg(); n.outputsData = [{ type: 'image', value: n.thumb }]; n.status = 'done';
  buildNodeBody(n.el, n);
  return { id: n.id, placed: [n.x, n.y] };
});
await frame();
console.log('   （状态节点画布坐标', JSON.stringify(st.placed), '）');
const stBox = await page.evaluate((id) => { const r = document.querySelector('.node[data-id="' + id + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, node: [r.x | 0, r.y | 0, r.width | 0, r.height | 0] }; }, st.id);
console.log('   （状态节点屏幕矩形', JSON.stringify(stBox.node), '视口 1600x1000）');
await page.mouse.move(stBox.x, stBox.y);
await page.waitForTimeout(400);
const stateBtns = await page.evaluate((id) => {
  const el = document.querySelector('.node[data-id="' + id + '"]');
  const list = [...el.querySelectorAll('.state-node-action')];
  const nr = el.getBoundingClientRect(); const q0 = list[0] ? list[0].getBoundingClientRect() : null;
  return { count: list.length, geo: { node: [nr.x | 0, nr.y | 0, nr.width | 0, nr.height | 0], firstBtn: q0 ? [q0.x | 0, q0.y | 0, q0.width | 0, q0.height | 0] : null, vp: [innerWidth, innerHeight] }, bad: list.map((b) => ({ t: b.title.slice(0, 10), ...window.__reach(b) })).filter((x) => !x.ok) };
}, st.id);
check('状态节点 4 个操作按钮数量正常', stateBtns.count === 4, 'count=' + stateBtns.count);
check('状态节点操作按钮全部可点（缺陷 1 回归钉）', stateBtns.bad.length === 0, JSON.stringify(stateBtns.geo) + JSON.stringify(stateBtns.bad));

// ── ⑦ 存档恢复后不留孤儿元素（缺陷 2 的回归钉） ──
await page.evaluate(() => { scheduleAutosave(); });
await page.waitForTimeout(1000);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow, null, { timeout: 15000 });
await page.waitForTimeout(1500);   // 等 compat 层 IndexedDB 恢复这一遍也跑完
// reload 会清掉页内注入的判据工具，必须重新注入
await injectHelpers();
// reload 后 AI 面板会恢复成展开态，它会遮住画布右侧节点（悬浮面板，设计如此），
// 先按真实方式收起面板再判，否则会把「面板遮挡」误报成「死控件」
if (await page.evaluate(() => !document.getElementById('aiPanel').classList.contains('collapsed'))) {
  const t = await safeClick('#aiToggleBtn');
  check('真实点击可收起 AI 面板', t.ok, JSON.stringify(t));
}
await frame();   // 恢复后的视图平移/缩放也需归一，否则同样会把判据误报成 offscreen
const orphan = await page.evaluate(() => {
  const els = [...document.querySelectorAll('#nodeLayer .node')];
  const ids = els.map((e) => e.dataset.id);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  return { domNodes: els.length, modelNodes: workflow.nodes.size, dup: [...new Set(dup)] };
});
check('恢复后节点元素数与数据模型一致（无孤儿，缺陷 2 回归钉）', orphan.domNodes === orphan.modelNodes && orphan.dup.length === 0, JSON.stringify(orphan));
const stAfter = await page.evaluate(() => {
  const n = [...workflow.nodes.values()].find((x) => x.stateMeta);
  if (!n) return { missing: true };
  const r = n.el.getBoundingClientRect();
  return { center: [r.x + r.width / 2, r.y + r.height / 2] };
});
if (stAfter.center) { await page.mouse.move(stAfter.center[0], stAfter.center[1]); await page.waitForTimeout(400); }
const stBtns = await page.evaluate(() => {
  const n = [...workflow.nodes.values()].find((x) => x.stateMeta);
  if (!n) return { missing: true };
  const list = [...n.el.querySelectorAll('.state-node-action')];
  // 工具条基础态是 opacity:0 + pointer-events:none，靠 :hover / .selected 显形（styles.css:3096），
  // 所以本条同样要在悬停态下判
  return { count: list.length, bad: list.map((b) => ({ t: b.title.slice(0, 8), ...window.__reach(b) })).filter((x) => !x.ok) };
});
check('恢复后状态节点按钮仍全部可点（悬停态）', stBtns.missing !== true && stBtns.count === 4 && stBtns.bad.length === 0, JSON.stringify(stBtns));
check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

await browser.close(); server.close();
const f = checks.filter((c) => !c.p).length;
console.log(`\n==== UI 可点性体检：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
