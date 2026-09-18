#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * A 拖节点靠近自动连线 专项回归。
 *
 * 现行契约（2026-09-19 校正，代码位置见下）：
 *   1) 拖动中**每帧**检测候选（legacy.js applyDragFrame 内的 updateAutoConnect），命中即给两处反馈：
 *      画布候选虚线（drawEdges 的 __autoConn 分支）+ 目标端口 .compatible 高亮（styles.css:3190）；
 *   2) 松手时先 snapNodePosition（与其它节点边/中心对齐，否则吸 24px 网格，阈值 12px），
 *      再按最终位置重算候选并 commitAutoConnect 落库；
 *   3) **不搬动节点去对齐端口**：旧版「吸附到端口对齐位置」已不在实现里（死常量 AUTOCONN_PORT_GAP
 *      本轮已删），所以本文件用相对判据（位移 ≤ 吸附阈值 + 网格/边对齐成立）取代写死坐标 x=272 y=228，
 *      符合 DEBT.md 处理原则 4。
 *
 * 该用例此前 7/11 的真相：updateAutoConnect 只在 onUp 里调用、紧接着 commitAutoConnect 同步清空
 * __autoConn → 预览与高亮一帧都渲染不出来；断言 1/2 判的不是「旧契约」而是「反馈丢失」。实测
 * 100 节点图单次检测 0.012ms，注释里的性能顾虑不成立，故产品侧把检测挂进 rAF 拖拽帧（见 DEBT.md）。
 *
 * 写法约定（本轮返工换来的）：
 *   - 一律真实鼠标 page.mouse，不再用 evaluate 里 el.click()/合成事件；
 *   - 每个场景重新播种且节点必须落在视口内（y>1000 会让 elementFromPoint 全空 → 起拖点找不到 →
 *     曾经把 `[].every()` 的恒真当成通过，又是一条假绿）；
 *   - 每条断言都带 `ok === true` 前置，夹具失败必须显形为 FAIL；
 *   - 高亮比 computed style（scale/光晕），不接受「有 class 就算通过」；且允许首帧还在 CSS 过渡爬坡。
 * 不填写真实 Key、不请求真实 AI 服务。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const GRID = 24, SNAP = 12;   // 与 legacy.js snapNodePosition 一致
const GAP_MAX = 140, GAP_MIN = -30;   // 与 legacy.js AUTOCONN_GAP_X_MAX / MIN 一致

function createServer() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(ROOT, relative));
    if (!file.startsWith(`${ROOT}/`) && file !== join(ROOT, 'index.html')) { res.writeHead(403); res.end('forbidden'); return; }
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    try {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
}

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? '  ✅' : '  ❌'} ${name}${detail ? `：${detail}` : ''}`);
}

const server = createServer();
let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|404|Failed to load resource/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && typeof addNode === 'function', { timeout: 10_000 });
  check('当前构建产物加载且无运行时错误', errors.length === 0, errors.join(' | '));

  // ── 页内工具 ──
  await page.evaluate(() => {
    workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform();
    // 起拖点：legacy.js:8048 对 button/input/textarea/select/.node-port 直接 return 不起拖，
    // 而文本节点框内大面积是 textarea → 必须用 elementFromPoint 挑一个非交互控件的落点。
    window.__dragPoint = (id) => {
      const el = workflow.nodes.get(id).el;
      const r = el.getBoundingClientRect();
      const bad = 'button, input, textarea, select, .node-port, .node-resize-handle';
      for (let dy = 6; dy < r.height - 6; dy += 6) {
        for (let dx = 6; dx < r.width - 6; dx += 6) {
          const x = r.left + dx, y = r.top + dy;
          const hit = document.elementFromPoint(x, y);
          if (hit && !hit.closest(bad) && hit.closest('.node') === el) return { x, y };
        }
      }
      return null;
    };
    // 拖动中取样：候选状态 + 目标端口高亮的**实际计算样式**（只查 class 已经骗过我们一次了）
    window.__sampleConn = (targetId, idx) => {
      const t = workflow.nodes.get(targetId);
      const p = t ? t.el.querySelector(`.node-port.input[data-port-idx="${idx}"]`) : null;
      const sib = t ? [...t.el.querySelectorAll('.node-port.input')].find((x) => x !== p) : null;
      const cs = p ? getComputedStyle(p) : null;
      const scale = cs && cs.transform.startsWith('matrix') ? parseFloat(cs.transform.split('(')[1]) : 1;
      return {
        autoConn: !!__autoConn,
        toTarget: !!(__autoConn && __autoConn.toNode.id === targetId),
        toIdx: __autoConn ? __autoConn.toIdx : null,
        hasCls: !!(p && p.classList.contains('compatible')),
        scale: Math.round((Number.isFinite(scale) ? scale : 1) * 100) / 100,
        haloDistinct: !!(cs && sib && cs.boxShadow !== 'none' && cs.boxShadow !== getComputedStyle(sib).boxShadow),
      };
    };
    // 端口间隙用应用自己的 portWorldPos 实算，不拿 node.width 猜
    window.__gap = (dragId, targetId, idx) => {
      const a = workflow.nodes.get(dragId), b = workflow.nodes.get(targetId);
      return Math.round(portWorldPos(b, 'input', idx).x - portWorldPos(a, 'output', 0).x);
    };
    window.__pos = (id) => { const n = workflow.nodes.get(id); return { x: Math.round(n.x), y: Math.round(n.y) }; };
    // 播种：两个节点放在视口内，并按 portWorldPos 精确摆出初始端口间隙
    window.__seed = (dragType, targetType, gap0, dy = 0) => {
      clearGraph();
      workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform();
      const a = addNode(dragType, 120, 140);
      const b = addNode(targetType, 700, 140 + dy);
      b.x = portWorldPos(a, 'output', 0).x + gap0;
      b.el.style.left = b.x + 'px';
      const r = { aId: a.id, bId: b.id, gap0: window.__gap(a.id, b.id, 1) };
      applyTransform();
      return r;
    };
  });

  // ── 真实鼠标拖拽：按下 → 逐段移动并取样 → 记松手前落点 → 松手 → 复查落库 ──
  const drag = async ({ id, target = null, idx = 1, moves }) => {
    const post0 = async () => page.evaluate((nid) => ({
      ...window.__pos(nid),
      edges: workflow.edges.size,
      leaked: !!document.querySelector('.node-port.compatible'),
      connLeft: !!__autoConn,
    }), id);
    const start = await page.evaluate((nid) => window.__dragPoint(nid), id);
    if (!start) return { ok: false, reason: '找不到可起拖的点（节点是否在视口内？控件是否铺满？）', samples: [], preRelease: null, post: await post0() };
    const t = target || id;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const samples = [];
    for (const dx of moves) {
      await page.mouse.move(start.x + dx, start.y);
      await page.waitForTimeout(80);             // 每段之间留足一帧（检测挂在 applyDragFrame 里）
      samples.push(await page.evaluate(({ tk, k, did }) => ({
        ...window.__sampleConn(tk, k), gap: window.__gap(did, tk, k),
      }), { tk: t, k: idx, did: id }));
    }
    const preRelease = await page.evaluate((nid) => window.__pos(nid), id);
    await page.mouse.up();
    await page.waitForTimeout(240);
    return { ok: true, samples, preRelease, post: await post0() };
  };
  const flag = (s) => `${s.autoConn ? 'Y' : 'n'}@gap${s.gap}${s.hasCls ? '/★' : ''}`;

  // ── 场景 1：视口内播种，间隙 120px 起步，拖动靠近 → 每帧候选反馈 ──
  const s1ids = await page.evaluate(() => window.__seed('text', 'aiImage', 120));
  const s1 = await drag({ id: s1ids.aId, target: s1ids.bId, idx: 1, moves: [30, 60, 90, 120] });
  check('夹具可起拖（节点在视口内且有非交互落点）', s1.ok === true, s1.reason || JSON.stringify({ gap0: s1ids.gap0 }));
  check('拖动中每帧都有候选（命中 aiImage 输入端口1）', s1.ok && s1.samples.length === 4 && s1.samples.every((s) => s.autoConn && s.toTarget && s.toIdx === 1), JSON.stringify(s1.samples.map(flag)));
  // 高亮有 CSS 过渡（--transition-fast），首帧可能还在 1.0→1.3 爬坡，故要求「命中帧都带 class 且至少 3 帧已展开到 ≥1.25」
  const settled = s1.samples.filter((s) => s.autoConn && s.hasCls && s.scale >= 1.25 && s.haloDistinct);
  check('候选端口高亮对用户真实显形（scale≥1.25 + 光晕区别于兄弟端口）', s1.ok && s1.samples.every((s) => !s.autoConn || s.hasCls) && settled.length >= 3, JSON.stringify(s1.samples.map((s) => `${s.hasCls ? 'Y' : 'n'}/${s.scale}/${s.haloDistinct ? '异' : '同'}`)));
  check('松手后自动创建连线（text→aiImage text 输入）', s1.ok && s1.post.edges === 1, JSON.stringify(s1.post));
  check('松手后不残留高亮 class 与候选态', s1.ok && s1.post.leaked === false && s1.post.connLeft === false, JSON.stringify({ leaked: s1.post.leaked, connLeft: s1.post.connLeft }));

  // ── 场景 2：落点吸附 = 边/中心对齐或网格，而非端口搬移（旧「吸到 x=272 y=228」已废弃） ──
  const s2 = await page.evaluate(({ id, bId, pre, GRID, SNAP }) => {
    const a = workflow.nodes.get(id), b = workflow.nodes.get(bId);
    const w = a.width || 280, h = a.height || a.el.offsetHeight || 160;
    const bw = b.width || 280, bh = b.height || b.el.offsetHeight || 160;
    const near = (v, list) => list.some((p) => Math.abs(v - p) <= 1);
    const xs = [b.x, b.x + bw / 2, b.x + bw], ys = [b.y, b.y + bh / 2, b.y + bh];
    const alignedX = near(a.x, xs) || near(a.x + w / 2, xs) || near(a.x + w, xs);
    const alignedY = near(a.y, ys) || near(a.y + h / 2, ys) || near(a.y + h, ys);
    const onGridX = Math.abs(a.x - Math.round(a.x / GRID) * GRID) <= 1;
    const onGridY = Math.abs(a.y - Math.round(a.y / GRID) * GRID) <= 1;
    const portAlignedY = Math.abs(a.y - (b.y - 28)) <= 2;   // 旧契约：输出端口0 被搬到与输入端口1 同高
    return { moved: { dx: a.x - pre.x, dy: a.y - pre.y }, alignedX, alignedY, onGridX, onGridY, portAlignedY, at: { x: Math.round(a.x), y: Math.round(a.y) } };
  }, { id: s1ids.aId, bId: s1ids.bId, pre: s1.preRelease, GRID, SNAP });
  check('松手位移不超过吸附阈值（≤12px，未被大幅搬移）', Math.abs(s2.moved.dx) <= SNAP + 1 && Math.abs(s2.moved.dy) <= SNAP + 1, JSON.stringify(s2.moved));
  check('落点满足边/中心对齐或 24px 网格吸附', s2.alignedX || s2.alignedY || s2.onGridX || s2.onGridY, JSON.stringify(s2));
  check('不再把节点搬去对齐端口（钉住旧 x=272 y=228 契约不复活）', s2.portAlignedY === false, JSON.stringify(s2));

  // ── 场景 3：压过目标面板（间隙 < -30）→ 候选撤销；靠近已连节点不产生重复连线 ──
  const s3 = await drag({ id: s1ids.aId, target: s1ids.bId, idx: 1, moves: [20, 140, 260] });
  check('间隙压过 -30px 下限 → 候选撤销；已连节点不产生重复连线', s3.ok && s3.samples.some((s) => s.autoConn && s.gap > GAP_MIN) && s3.samples.some((s) => !s.autoConn && s.gap < GAP_MIN) && s3.post.edges === 1, JSON.stringify(s3.samples.map(flag)) + ' edges=' + s3.post.edges);

  // ── 场景 4：类型不匹配（附近只有无输入端口的 text）→ 全程无候选 ──
  const s4ids = await page.evaluate(() => window.__seed('text', 'text', 120));
  const s4 = await drag({ id: s4ids.aId, target: s4ids.bId, idx: 0, moves: [60, 120, 180] });
  check('类型不匹配（目标无输入端口）→ 无候选不连线', s4.ok && s4.samples.length === 3 && s4.samples.every((s) => !s.autoConn) && s4.post.edges === 0 && s4.post.connLeft === false && s4.post.leaked === false, JSON.stringify(s4.samples.map(flag)) + ' ' + JSON.stringify(s4.post));

  // ── 场景 5：间隙远超 140px（目标在窗口外）→ 无候选 ──
  const s5ids = await page.evaluate(() => window.__seed('text', 'aiImage', 420));
  const s5 = await drag({ id: s5ids.aId, target: s5ids.bId, idx: 1, moves: [24, 48] });
  check('目标远在 140px 窗口外 → 无候选不连线', s5.ok && s5.samples.every((s) => !s.autoConn && s.gap >= GAP_MAX) && s5.post.edges === 0, JSON.stringify(s5.samples.map(flag)));

  // ── 场景 6：窗口边界 —— ≥140px 不触发、进 140px 内即触发、松手落库（不再要求吸到端口对齐） ──
  const s6ids = await page.evaluate(() => window.__seed('text', 'aiImage', 220));
  const s6 = await drag({ id: s6ids.aId, target: s6ids.bId, idx: 1, moves: [40, 80, 110, 140] });
  const beyond = s6.samples.filter((s) => s.gap >= GAP_MAX);
  const inside = s6.samples.filter((s) => s.gap < GAP_MAX && s.gap > GAP_MIN);
  check('夹具可起拖（边界场景）', s6.ok === true, s6.reason || '');
  check('间隙 ≥140px 不触发候选（窗口上限成立）', beyond.length >= 1 && beyond.every((s) => !s.autoConn), JSON.stringify(s6.samples.map(flag)));
  check('间隙进 140px 内（含约 100px 处）即触发候选，无需先吸到端口对齐', inside.length >= 2 && inside.every((s) => s.autoConn && s.toTarget), JSON.stringify(inside.map(flag)));
  check('窗口内松手即落库（远距离候选同样生效）', s6.ok && s6.post.edges === 1 && Math.abs(s6.post.x - s6.preRelease.x) <= SNAP + 1, JSON.stringify({ edges: s6.post.edges, pre: s6.preRelease && s6.preRelease.x, post: s6.post.x }));

  // ── 场景 7：性能护栏 —— 当年砍掉拖动中检测的理由，用实测钉住，别再拿它当挡箭牌 ──
  const perf = await page.evaluate(() => {
    clearGraph();
    const a = addNode('text', 100, 100);
    for (let i = 0; i < 99; i++) addNode('aiImage', 600 + (i % 10) * 320, 100 + Math.floor(i / 10) * 400);
    const b = [...workflow.nodes.values()].find((n) => n.type === 'aiImage');
    a.x = b.x - 320; a.y = b.y; a.el.style.left = a.x + 'px'; a.el.style.top = a.y + 'px';
    const t0 = performance.now();
    let hits = 0;
    for (let i = 0; i < 300; i++) { if (updateAutoConnect(a)) hits++; }
    const perCallMs = (performance.now() - t0) / 300;
    clearGraph();
    return { nodes: 100, hits, perCallMs: Math.round(perCallMs * 1000) / 1000 };
  });
  check('100 节点图里单帧候选检测 < 2ms（实测约 0.01ms，性能理由不成立）', perf.perCallMs < 2 && perf.hits === 300, JSON.stringify(perf));

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[auto-connect] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[auto-connect] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[auto-connect] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
