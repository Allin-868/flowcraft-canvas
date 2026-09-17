// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
// 性能基线（审计 P1-5 / 计划 item8）：50/100 节点、100 连线、20 大图、刷新恢复、空白可交互、窄屏。
// 以「记录基线 + P50/P95 + 内存 + 限制」为主，阈值断言为辅（留余量避免计时 flaky）；不接入默认回归，单独 npm run verify:perf-baseline。
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const INDEX = decodeURIComponent(new URL('../index.html', import.meta.url).pathname);
const SHOT_DIR = decodeURIComponent(new URL('../../../过程笔记/测试产物', import.meta.url).pathname);
mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};
const stat = (arr) => {
  const a = [...arr].sort((x, y) => x - y); const n = a.length;
  const q = (p) => +a[Math.min(n - 1, Math.floor(n * p))].toFixed(1);
  return { min: +a[0].toFixed(1), p50: q(0.5), p95: q(0.95), max: +a[n - 1].toFixed(1) };
};
const MB = (b) => +(b / 1048576).toFixed(1);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--enable-precise-memory-info'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
const FILE = pathToFileURL(INDEX).href;
await page.goto(FILE, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// ===== 0. 空白可交互基线：清空存储后 reload → editor 就绪 =====
const blank = [];
for (let r = 0; r < 3; r++) {
  await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
  const t0 = Date.now();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 15000 });
  blank.push(Date.now() - t0);
}
await page.waitForTimeout(300);
const blankStat = stat(blank);

// ===== A. 规模操作计时（混合节点类型，代表真实画布）=====
// 返回每项 R 次耗时数组 + 内存
const runScale = (N, E, R) => page.evaluate(({ N, E, R }) => {
  const FC = window.FlowCraft, editor = FC.editor, wf = FC._legacy.workflow;
  const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
  const TYPES = ['aiImage', 'image', 'text', 'aiVideo', 'imageEdit'];
  const out = { build: [], edges: [], arrange: [], zoom: [], drag: [], serialize: [], undo: [], memAfter: [], nodeCount: 0, edgeCount: 0, serBytes: 0 };
  for (let r = 0; r < R; r++) {
    let t;
    t = performance.now(); editor.clear();
    const ids = [];
    for (let i = 0; i < N; i++) { const n = editor.addNode(TYPES[i % TYPES.length], (i % 12) * 150, Math.floor(i / 12) * 130); ids.push(n.id); }
    out.build.push(performance.now() - t);
    // 连线（直接建 Edge，绕过逐条 pushHistory，测「画布上 100 连线」的渲染成本）
    t = performance.now();
    for (let i = 0; i < E && i + 1 < ids.length; i++) {
      const a = wf.nodes.get(ids[i]), b = wf.nodes.get(ids[i + 1]);
      if (a && b && window.Edge) { const e = new window.Edge(a, 0, b, 0); wf.edges.set(e.id, e); }
    }
    window.markEdgesDirty(); window.applyTransform();
    out.edges.push(performance.now() - t);
    out.nodeCount = wf.nodes.size; out.edgeCount = wf.edges.size;
    // 自动布局
    t = performance.now(); try { window.arrangeNodes(); } catch (_) {} out.arrange.push(performance.now() - t);
    // 缩放 20 步
    t = performance.now(); for (let i = 0; i < 20; i++) { wf.camera.zoom = 0.4 + (i % 12) * 0.12; window.applyTransform(); } out.zoom.push(performance.now() - t);
    // 拖拽 20 帧（移动一个节点 + 连线重绘 + transform，不含 history）
    t = performance.now();
    const dn = wf.nodes.get(ids[0]);
    for (let i = 0; i < 20; i++) { if (dn) { dn.x = 100 + i * 6; dn.y = 100 + i * 4; if (dn.el) { dn.el.style.left = dn.x + 'px'; dn.el.style.top = dn.y + 'px'; } } window.markEdgesDirty(); window.applyTransform(); }
    out.drag.push(performance.now() - t);
    // 序列化（自动保存/导出成本）
    t = performance.now(); const s = window.serializeWorkflow(false) || ''; out.serialize.push(performance.now() - t); out.serBytes = s.length;
    out.memAfter.push(mem());
    // 撤销（快照重建全部节点）
    t = performance.now(); try { FC.history.undo(); } catch (_) {} out.undo.push(performance.now() - t);
  }
  return out;
}, { N, E, R });

const s50 = await runScale(50, 49, 5);
const s100 = await runScale(100, 100, 3);

// ===== B. 刷新恢复：build N → doAutosave → reload → 节点恢复 =====
const runRestore = async (N, R) => {
  await page.evaluate((n) => {
    const { editor } = window.FlowCraft; const TYPES = ['aiImage', 'image', 'text', 'aiVideo', 'imageEdit'];
    editor.clear();
    for (let i = 0; i < n; i++) editor.addNode(TYPES[i % TYPES.length], (i % 12) * 150, Math.floor(i / 12) * 130);
    window.doAutosave();
  }, N);
  await page.waitForTimeout(400);
  const times = [];
  for (let r = 0; r < R; r++) {
    const t0 = Date.now();
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction((n) => window.FlowCraft && window.FlowCraft._legacy && window.FlowCraft._legacy.workflow.nodes.size >= n, N, { timeout: 15000 });
    times.push(Date.now() - t0);
  }
  await page.waitForTimeout(200);
  return times;
};
const restore50 = await runRestore(50, 3);
const restore100 = await runRestore(100, 3);

// ===== C. 20 张大图（1280² JPEG，各不同）=====
const large = await page.evaluate(() => {
  const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
  const m0 = mem();
  const t0 = performance.now();
  const imgs = [];
  for (let k = 0; k < 20; k++) {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 1280;
    const cx = cv.getContext('2d');
    cx.fillStyle = 'hsl(' + (k * 18) + ',70%,50%)'; cx.fillRect(0, 0, 1280, 1280);
    for (let j = 0; j < 240; j++) { cx.fillStyle = 'hsl(' + ((k * 18 + j * 7) % 360) + ',80%,' + (25 + (j % 45)) + '%)'; cx.fillRect((j * 137 + k * 53) % 1200, (j * 89 + k * 31) % 1200, 40 + (j % 8) * 12, 40 + (j % 6) * 14); }
    imgs.push(cv.toDataURL('image/jpeg', 0.85));
  }
  const genTime = performance.now() - t0;
  const avgBytes = Math.round(imgs.reduce((s, x) => s + x.length, 0) / imgs.length);
  const { editor } = window.FlowCraft; editor.clear();
  const t1 = performance.now();
  for (let i = 0; i < 20; i++) { const n = editor.addNode('image', (i % 5) * 280, Math.floor(i / 5) * 280); n.thumb = imgs[i]; n.uploadedImage = imgs[i]; window.buildNodeBody(n.el, n); }
  const buildTime = performance.now() - t1;
  const m1 = mem();
  return { genTime: +genTime.toFixed(1), avgKB: Math.round(avgBytes / 1024), buildTime: +buildTime.toFixed(1), memDeltaMB: +((m1 - m0) / 1048576).toFixed(1), nodeCount: window.FlowCraft._legacy.workflow.nodes.size };
});
// 响应性：建 20 大图后页面仍可同步取状态
const responsive = await page.evaluate(() => { const t = performance.now(); const s = window.FlowCraft.editor.state(); return { ms: +(performance.now() - t).toFixed(1), nodeCount: s.nodeCount }; });

// ===== D. 窄屏 1440/1024/390/320：横向溢出 + 核心控件可达 + 截图 =====
const widths = [1440, 1024, 390, 320];
const narrow = [];
for (const w of widths) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(350);
  const info = await page.evaluate((vw) => {
    const chk = (sel) => { const el = document.querySelector(sel); if (!el) return { sel, exists: false }; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { sel, exists: true, visible: cs.display !== 'none' && cs.visibility !== 'hidden', within: r.left >= -2 && r.right <= vw + 2, right: Math.round(r.right) }; };
    return { vw, innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > window.innerWidth + 2, controls: [chk('#btnArrange'), chk('#btnUndo'), chk('#sidebarList')] };
  }, w);
  narrow.push(info);
  try { await page.screenshot({ path: SHOT_DIR + '/perf-' + w + '-2026-09-05.png' }); } catch (_) {}
}
await page.setViewportSize({ width: 1440, height: 900 });

// ===== 报告 =====
const b50 = stat(s50.build), b100 = stat(s100.build);
const e100 = stat(s100.edges), a100 = stat(s100.arrange), z100 = stat(s100.zoom), d100 = stat(s100.drag), ser100 = stat(s100.serialize), u100 = stat(s100.undo);
const a50 = stat(s50.arrange), z50 = stat(s50.zoom), d50 = stat(s50.drag), ser50 = stat(s50.serialize);
const r50 = stat(restore50), r100 = stat(restore100);
const mem50 = MB(Math.max(...s50.memAfter)), mem100 = MB(Math.max(...s100.memAfter));

console.log('\n================ FlowCraft 性能基线（' + new Date().toISOString().slice(0, 10) + '） ================');
console.log('环境：Playwright Chromium headless，viewport 1440x900，--enable-precise-memory-info；混合节点类型 aiImage/image/text/aiVideo/imageEdit');
console.log('\n[空白可交互] reload→editor就绪 ms:', JSON.stringify(blankStat));
console.log('\n[规模操作 ms] 50节点/49连线 (R=5):');
console.log('  build', JSON.stringify(b50), '| arrange', JSON.stringify(a50), '| zoom20', JSON.stringify(z50), '| drag20', JSON.stringify(d50), '| serialize', JSON.stringify(ser50), '| mem峰值MB', mem50, '| serBytes', s50.serBytes);
console.log('[规模操作 ms] 100节点/100连线 (R=3):');
console.log('  build', JSON.stringify(b100), '| edges', JSON.stringify(e100), '| arrange', JSON.stringify(a100), '| zoom20', JSON.stringify(z100), '| drag20', JSON.stringify(d100), '| serialize', JSON.stringify(ser100), '| undo', JSON.stringify(u100), '| mem峰值MB', mem100, '| serBytes', s100.serBytes);
console.log('\n[刷新恢复 ms] 50节点:', JSON.stringify(r50), '| 100节点:', JSON.stringify(r100));
console.log('\n[20张大图 1280² JPEG]', JSON.stringify(large), '| 建后响应', JSON.stringify(responsive));
console.log('\n[窄屏]');
narrow.forEach((n) => console.log('  ' + n.vw + 'px: scrollW=' + n.scrollW + ' innerW=' + n.innerW + ' 横向溢出=' + n.overflow + ' 控件=' + JSON.stringify(n.controls.map((c) => ({ sel: c.sel, vis: c.visible, within: c.within })))));

// ===== 阈值断言（计划 §7 目标，留余量）=====
ok('空白可交互 P50 ≤ 1500ms', blankStat.p50 <= 1500, blankStat);
ok('50 节点打开(刷新恢复) P50 ≤ 2500ms（目标 2s）', r50.p50 <= 2500, r50);
ok('100 节点刷新恢复 P50 ≤ 3500ms（目标 3s）', r100.p50 <= 3500, r100);
ok('100 节点 build P95 ≤ 6000ms', b100.p95 <= 6000, b100);
ok('100 连线 drag20 P95 ≤ 1500ms（拖拽仍可用）', d100.p95 <= 1500, d100);
ok('100 节点 zoom20 P95 ≤ 1500ms', z100.p95 <= 1500, z100);
ok('20 张大图不崩溃（nodeCount=20 且建后仍可响应）', large.nodeCount === 20 && responsive.nodeCount === 20 && responsive.ms < 500, { large, responsive });
ok('窄屏 390/320 页面不崩溃（核心控件存在）', narrow.every((n) => n.controls.every((c) => c.exists)), narrow.map((n) => n.vw));
ok('全程无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log('\n==== 性能基线：PASS=' + pass + ' FAIL=' + fail + '（阈值为参考门禁，实测数值以上方报告为准）====');
process.exit(fail === 0 ? 0 : 1);
