#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * A 拖节点靠近自动连线 专项回归。
 * 验证：
 *   1) 拖动中靠近兼容节点 → 候选预览（__autoConn + 目标端口 .compatible）
 *   2) 松手 → 自动创建连线（text 输出 → aiImage text 输入，类型匹配）
 *   3) 类型不匹配（目标无兼容输入）→ 不连线
 *   4) 远离任何节点 → 不连线
 *   5) 再次靠近已连节点 → 不产生重复连线
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

  // 在页面定义拖拽辅助（mousedown 节点 → mousemove 位移 → mouseup；返回拖动中预览状态）
  await page.evaluate(() => {
    window.__dragNode = async (id, dx, dy) => {
      workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform();
      const node = workflow.nodes.get(id);
      if (!node || !node.el) return { ok: false, reason: 'node missing' };
      const rect = node.el.getBoundingClientRect();
      const startX = rect.left + 60, startY = rect.top + 30;
      node.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: startX + dx, clientY: startY + dy }));
      const preview = {
        hasCandidate: !!__autoConn,
        candidateTo: __autoConn ? (__autoConn.toNode ? __autoConn.toNode.id : null) : null,
        toIdx: __autoConn ? __autoConn.toIdx : null,
        targetCompatible: __autoConn ? !!__autoConn.toNode.el.querySelector('.node-port.input.compatible') : false
      };
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      return { ok: true, preview };
    };
  });

  // 建节点：text@(200,200) + aiImage@(600,200)
  const setup = await page.evaluate(() => {
    workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform();
    workflow.edges.clear(); markEdgesDirty();
    const a = addNode('text', 200, 200);
    const b = addNode('aiImage', 600, 200);
    return { aId: a.id, bId: b.id };
  });

  // —— 场景 1：拖动 text 靠近 aiImage → 预览 + 吸附 + 松手自动连线 ——
  const s1 = await page.evaluate(({ id, dx, dy }) => window.__dragNode(id, dx, dy), { id: setup.aId, dx: 60, dy: 0 });
  check('拖动中：出现候选预览', s1.ok && s1.preview.hasCandidate, JSON.stringify(s1.preview));
  check('拖动中：目标为 aiImage 且端口高亮 compatible', s1.preview.candidateTo === setup.bId && s1.preview.targetCompatible, JSON.stringify(s1.preview));
  const s1c = await page.evaluate((id) => {
    const node = workflow.nodes.get(id);
    return { x: node.x, y: node.y, w: node.width };
  }, setup.aId);
  // 吸附后：x = 600 - 280 - 48 = 272；y = 200 + 1*28 = 228（输出端口0 对齐 aiImage text 输入端口1）
  check('靠近时节点被吸附到端口对齐位置（x=272 y=228）', Math.abs(s1c.x - 272) <= 2 && Math.abs(s1c.y - 228) <= 2, `x=${s1c.x} y=${s1c.y}`);
  const s1b = await page.evaluate((id) => {
    let edge = null;
    workflow.edges.forEach(e => { if (e.from.node.id === id) edge = e; });
    return edge ? { from: edge.from.node.type, fromPort: edge.from.port, to: edge.to.node.type, toPort: edge.to.port, count: workflow.edges.size } : { count: workflow.edges.size };
  }, setup.aId);
  check('松手后自动创建连线（text→aiImage text 输入）', s1b.count === 1 && s1b.from === 'text' && s1b.to === 'aiImage' && s1b.toPort === 1, JSON.stringify(s1b));

  // —— 场景 5：再次靠近已连节点 → 不产生重复连线 ——
  await page.evaluate(({ id, dx, dy }) => window.__dragNode(id, dx, dy), { id: setup.aId, dx: 60, dy: 0 });
  const s5b = await page.evaluate(() => workflow.edges.size);
  check('重复靠近已连节点 → 连线数不变（无重复）', s5b === 1, 'edges=' + s5b);

  // —— 场景 3：类型不匹配（text 靠近另一个 text——text 无输入端口）→ 不连线 ——
  const s3 = await page.evaluate(async () => {
    const c = addNode('text', 900, 200);
    addNode('text', 1200, 200);
    const r = await window.__dragNode(c.id, 60, 0);
    return { previewHas: r.preview.hasCandidate, edges: workflow.edges.size };
  });
  check('类型不匹配（目标无输入）→ 无候选且不连线', !s3.previewHas && s3.edges === 1, JSON.stringify(s3));

  // —— 场景 4：远离任何节点 → 不连线 ——
  const s4 = await page.evaluate(async () => {
    const e = addNode('text', 300, 500);
    const r = await window.__dragNode(e.id, 800, 400); // 拖到远处
    return { previewHas: r.preview.hasCandidate, edges: workflow.edges.size };
  });
  check('远离节点 → 无候选且不连线', !s4.previewHas && s4.edges === 1, JSON.stringify(s4));

  // —— 场景 6：远距离（100px+ 间隙）即触发锁定——证明「即将靠近面板就吸附」 ——
  const s6 = await page.evaluate(async () => {
    // 初始间隙 220px（text 输出 x=380，aiImage 输入 x=600）→ 拖 +120 后间隙 100px，仍在 140px 窗口内
    const a = addNode('text', 100, 1000);
    const b = addNode('aiImage', 600, 1000);
    const before = { gap: 600 - (100 + 280) };
    const r = await window.__dragNode(a.id, 120, 0);
    const after = { x: a.x, y: a.y, gap: 600 - (a.x + 280) };
    const edges = workflow.edges.size;
    return { before, after, edges, previewHas: r.preview.hasCandidate };
  });
  check('间隙 100px 即触发吸附（节点被吸到端口对齐）', s6.previewHas && Math.abs(s6.after.x - 272) <= 2 && Math.abs(s6.after.y - 1028) <= 2, JSON.stringify(s6.after));
  check('远距离触发后松手自动连线', s6.edges === 2, 'edges=' + s6.edges);

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
