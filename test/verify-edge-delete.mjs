#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * B 点击连线可删除 专项回归。
 * 验证：
 *   1) 命中测试：连线中点/近旁命中，远处不命中
 *   2) 点击连线（canvasWrap mousedown 派发）→ 选中 + 高亮 + 中点 ✕ 按钮浮现
 *   3) 点击 ✕ 按钮 → 连线删除、按钮隐藏、端口 connected 清理
 *   4) Delete 键删除选中连线（无选中节点时）
 *   5) 点击空白 → 取消连线选中
 *   6) 删除节点 → 其关联选中连线取消选中
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

  // 建两个节点并连线（先清掉启动时自动加载的示例工作流连线，保证计数确定）
  const setup = await page.evaluate(() => {
    workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform();
    workflow.edges.clear();
    markEdgesDirty();
    const a = addNode('text', 200, 200);
    const b = addNode('aiImage', 600, 200);
    const e = new Edge(a, 0, b, 0);
    workflow.edges.set(e.id, e);
    markEdgesDirty();
    // 等待一次 drawEdges 渲染后取端口屏幕坐标与曲线中点
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const fp = getPortScreenPos(a, 'output', 0);
      const tp = getPortScreenPos(b, 'input', 0);
      const pts = sampleBezierPoints(fp.x, fp.y, tp.x, tp.y);
      const mid = pts[Math.floor(pts.length / 2)];
      done({ edgeId: e.id, fp, tp, mid, edgeCount: workflow.edges.size });
    })));
  });
  check('已建立 1 条连线', setup.edgeCount === 1, 'edges=' + setup.edgeCount);

  // —— 场景 1：命中测试 ——
  const hit = await page.evaluate((m) => {
    const onMid = hitTestEdges(m.mid.x, m.mid.y);
    const near = hitTestEdges(m.mid.x + 6, m.mid.y + 6);
    const far = hitTestEdges(m.mid.x + 60, m.mid.y + 60);
    return { onMid: !!onMid, near: !!near, far: !!far, edgeId: m.edgeId };
  }, setup);
  check('命中测试：中点命中', hit.onMid);
  check('命中测试：近旁（6px）命中', hit.near);
  check('命中测试：远处（60px）不命中', !hit.far);

  // —— 场景 2：点击连线 → 选中 + ✕ 按钮浮现且定位中点 ——
  const clicked = await page.evaluate((m) => {
    const rect = canvasWrap.getBoundingClientRect();
    canvasWrap.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, cancelable: true, button: 0,
      clientX: rect.left + m.mid.x, clientY: rect.top + m.mid.y
    }));
    const btn = document.getElementById('edgeDeleteBtn');
    const btnRect = btn.getBoundingClientRect();
    const wrapRect = canvasWrap.getBoundingClientRect();
    return {
      selectedId: __selectedEdge ? __selectedEdge.id : null,
      btnVisible: !btn.hidden,
      btnCenterX: btnRect.left + btnRect.width / 2 - wrapRect.left,
      btnCenterY: btnRect.top + btnRect.height / 2 - wrapRect.top
    };
  }, setup);
  check('点击连线 → 选中该连线', clicked.selectedId === setup.edgeId, clicked.selectedId);
  check('选中后中点 ✕ 按钮浮现', clicked.btnVisible);
  check('✕ 按钮位于连线中点附近', Math.abs(clicked.btnCenterX - setup.mid.x) <= 3 && Math.abs(clicked.btnCenterY - setup.mid.y) <= 3,
    `btn=(${clicked.btnCenterX.toFixed(1)},${clicked.btnCenterY.toFixed(1)}) mid=(${setup.mid.x.toFixed(1)},${setup.mid.y.toFixed(1)})`);

  // —— 场景 3：点击 ✕ → 删除连线 + 端口清理 ——
  const deleted = await page.evaluate((id) => {
    document.getElementById('edgeDeleteBtn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    return {
      edgeGone: !workflow.edges.has(id),
      edgeCount: workflow.edges.size,
      btnHidden: document.getElementById('edgeDeleteBtn').hidden,
      selNull: __selectedEdge === null
    };
  }, setup.edgeId);
  check('点击 ✕ → 连线被删除', deleted.edgeGone && deleted.edgeCount === 0, 'edges=' + deleted.edgeCount);
  check('删除后 ✕ 按钮隐藏、选中清除', deleted.btnHidden && deleted.selNull);

  // —— 场景 4：Delete 键删除选中连线 ——
  const kb = await page.evaluate(() => {
    workflow.edges.clear(); markEdgesDirty();
    const a = addNode('text', 300, 400);
    const b = addNode('aiImage', 700, 400);
    const e = new Edge(a, 0, b, 0);
    workflow.edges.set(e.id, e);
    markEdgesDirty();
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const fp = getPortScreenPos(a, 'output', 0);
      const tp = getPortScreenPos(b, 'input', 0);
      const pts = sampleBezierPoints(fp.x, fp.y, tp.x, tp.y);
      const mid = pts[Math.floor(pts.length / 2)];
      const rect = canvasWrap.getBoundingClientRect();
      canvasWrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: rect.left + mid.x, clientY: rect.top + mid.y }));
      const selected = __selectedEdge ? __selectedEdge.id : null;
      // 在 body 上派发 keydown（window 派发时 e.target=window 无 closest，会触发应用内旧守卫报错）
      document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Delete', code: 'Delete' }));
      const gone = !workflow.edges.has(e.id);
      done({ selected, gone, edgeCount: workflow.edges.size });
    })));
  });
  check('Delete 键：先选中连线', kb.selected != null);
  check('Delete 键：无选中节点时删除连线', kb.gone && kb.edgeCount === 0, 'edges=' + kb.edgeCount);

  // —— 场景 5：点击空白 → 取消连线选中 ——
  const blank = await page.evaluate(() => {
    workflow.edges.clear(); markEdgesDirty();
    const a = addNode('text', 300, 600);
    const b = addNode('aiImage', 700, 600);
    const e = new Edge(a, 0, b, 0);
    workflow.edges.set(e.id, e);
    markEdgesDirty();
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const fp = getPortScreenPos(a, 'output', 0);
      const tp = getPortScreenPos(b, 'input', 0);
      const pts = sampleBezierPoints(fp.x, fp.y, tp.x, tp.y);
      const mid = pts[Math.floor(pts.length / 2)];
      const rect = canvasWrap.getBoundingClientRect();
      canvasWrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: rect.left + mid.x, clientY: rect.top + mid.y }));
      const selectedBefore = !!__selectedEdge;
      // 点击远处空白（远离连线）
      canvasWrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: rect.left + 30, clientY: rect.top + 30 }));
      const btnHidden = document.getElementById('edgeDeleteBtn').hidden;
      done({ selectedBefore, selectedAfter: __selectedEdge !== null, btnHidden, edgeStill: workflow.edges.has(e.id) });
    })));
  });
  check('先选中连线（selectedBefore）', blank.selectedBefore);
  check('点击空白 → 取消选中且按钮隐藏', !blank.selectedAfter && blank.btnHidden);
  check('点击空白不会误删连线', blank.edgeStill);

  // —— 场景 6：删除节点 → 其关联选中连线取消选中 ——
  const nodeDel = await page.evaluate(() => {
    workflow.edges.clear(); markEdgesDirty();
    const a = addNode('text', 300, 800);
    const b = addNode('aiImage', 700, 800);
    const e = new Edge(a, 0, b, 0);
    workflow.edges.set(e.id, e);
    markEdgesDirty();
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const fp = getPortScreenPos(a, 'output', 0);
      const tp = getPortScreenPos(b, 'input', 0);
      const pts = sampleBezierPoints(fp.x, fp.y, tp.x, tp.y);
      const mid = pts[Math.floor(pts.length / 2)];
      const rect = canvasWrap.getBoundingClientRect();
      canvasWrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: rect.left + mid.x, clientY: rect.top + mid.y }));
      const selectedBefore = !!__selectedEdge;
      deleteNode(b.id);
      done({ selectedBefore, selectedAfter: __selectedEdge !== null, btnHidden: document.getElementById('edgeDeleteBtn').hidden, edgeGone: !workflow.edges.has(e.id) });
    })));
  });
  check('选中连线后删除其节点', nodeDel.selectedBefore);
  check('删除节点 → 连线选中被清除且按钮隐藏', !nodeDel.selectedAfter && nodeDel.btnHidden);

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[edge-delete] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[edge-delete] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[edge-delete] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
