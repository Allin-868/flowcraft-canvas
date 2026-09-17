#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * #5 节点下方独立 Composer（Details on Demand）专项回归。
 * 验证：
 *   1) 选中 aiImage 节点 → Composer 浮现（含提示词/模型/参数/生成键/高级折叠）
 *   2) Composer 定位在节点正下方（按世界坐标 × zoom + cam 换算）
 *   3) 选中非生成节点（text）→ Composer 隐藏；空白清除选择 → 隐藏
 *   4) Composer 内 prompt 输入写回 node.prompt；模型/比例 select 写回 node.params
 *   5) 生成按钮 → runNode 触发（FLUX.1 演示出图 → done）
 *   6) 节点拖动 / 画布 pan / zoom → Composer 跟随
 *   7) 切换选中另一个生成节点 → Composer 跟随新节点
 *   8) 删除节点 → Composer 隐藏
 *   9) aiImage 节点 body 不再渲染模型/参数/运行按钮（清爽）
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

  // —— 场景 1：选中 aiImage → Composer 浮现 + 结构完整（节点放视口内上方，避免定位被兜底钳制）——
  const s1 = await page.evaluate(() => {
    workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform();
    const node = addNode('aiImage', 260, 40);
    const el = document.getElementById('nodeComposer');
    return {
      visible: !!el && !el.hidden,
      hasTextarea: !!el && !!el.querySelector('.nc-textarea'),
      hasModel: !!el && !!el.querySelector('.nc-model'),
      hasParams: !!el && el.querySelectorAll('.nc-select').length >= 4,
      hasRun: !!el && !!el.querySelector('.nc-run'),
      hasAdv: !!el && !!el.querySelector('.nc-adv-toggle'),
      bodyControls: !!node.el.querySelector('.model-select, .run-btn, .param-select'),
      nodeId: node.id
    };
  });
  check('选中 aiImage 节点后 Composer 浮现', s1.visible);
  check('Composer 含提示词输入框', s1.hasTextarea);
  check('Composer 含模型下拉', s1.hasModel);
  check('Composer 含比例/分辨率/张数/模式参数', s1.hasParams, 'nc-select 数=' + s1.hasParams);
  check('Composer 含生成按钮与高级折叠', s1.hasRun && s1.hasAdv);
  check('节点 body 不再渲染模型/参数/运行按钮（清爽）', !s1.bodyControls);

  // —— 场景 2：Composer 定位在节点正下方 ——
  const s2 = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.type === 'aiImage');
    const el = document.getElementById('nodeComposer');
    const cam = workflow.camera;
    const expectedLeft = node.x * cam.zoom + cam.x;
    const expectedTop = (node.y + node.height) * cam.zoom + cam.y + 12;
    return {
      left: parseFloat(el.style.left), top: parseFloat(el.style.top),
      expLeft: expectedLeft, expTop: expectedTop,
      nodeX: node.x, nodeY: node.y, nodeH: node.height, zoom: cam.zoom, camX: cam.x, camY: cam.y
    };
  });
  check('Composer left 对齐节点左缘', Math.abs(s2.left - s2.expLeft) <= 1, `left=${s2.left} exp=${s2.expLeft}`);
  check('Composer top 位于节点正下方', Math.abs(s2.top - s2.expTop) <= 2, `top=${s2.top} exp=${s2.expTop}`);

  // —— 场景 3：prompt 输入写回 node.prompt；模型/比例 select 写回 params ——
  const s3 = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.type === 'aiImage');
    const el = document.getElementById('nodeComposer');
    const ta = el.querySelector('.nc-textarea');
    ta.value = '一条红色的龙在云端';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const modelSel = el.querySelector('.nc-model');
    modelSel.value = 'FLUX.1';
    modelSel.dispatchEvent(new Event('change', { bubbles: true }));
    const aspectSel = el.querySelectorAll('.nc-select')[1];
    aspectSel.value = '16:9';
    aspectSel.dispatchEvent(new Event('change', { bubbles: true }));
    return { prompt: node.prompt, model: node.params.model, aspect: node.params.aspect };
  });
  check('prompt 输入写回 node.prompt', s3.prompt === '一条红色的龙在云端', s3.prompt);
  check('模型 select 写回 node.params.model', s3.model === 'FLUX.1', s3.model);
  check('比例 select 写回 node.params.aspect', s3.aspect === '16:9', s3.aspect);

  // —— 场景 4：生成按钮触发运行（FLUX.1 演示出图 → done）——
  const s4 = await page.evaluate(async () => {
    const node = [...workflow.nodes.values()].find((n) => n.type === 'aiImage');
    const el = document.getElementById('nodeComposer');
    el.querySelector('.nc-run').dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((done) => setTimeout(done, 2200));
    return { status: node.status, thumb: !!node.thumb };
  });
  check('生成按钮触发运行并完成（done）', s4.status === 'done', s4.status);
  check('生成后节点有出图', s4.thumb);

  // —— 场景 5：拖动/pan/zoom 跟随（把节点放到视口内避免钳制干扰）——
  const s5 = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.type === 'aiImage');
    const el = document.getElementById('nodeComposer');
    workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1;
    applyTransform();
    node.x = 100; positionNodeComposer();
    const left0 = parseFloat(el.style.left);
    node.x += 120;            // 模拟拖动 +120
    positionNodeComposer();
    const afterDrag = parseFloat(el.style.left);
    workflow.camera.zoom = 1.5; // 模拟缩放
    applyTransform();
    const afterZoom = parseFloat(el.style.left);
    const expZoom = (node.x * 1.5 + 0);
    workflow.camera.x += 80;  // 模拟平移 +80
    applyTransform();
    const afterPan = parseFloat(el.style.left);
    const expPan = expZoom + 80;
    // 还原相机
    workflow.camera.zoom = 1; workflow.camera.x = 0; workflow.camera.y = 0;
    applyTransform();
    return { left0, afterDrag, afterZoom, afterPan, expZoom, expPan };
  });
  check('节点拖动 120px → Composer 跟随（left+120）', Math.abs(s5.afterDrag - (s5.left0 + 120)) <= 1, `left0=${s5.left0} afterDrag=${s5.afterDrag}`);
  check('缩放后 Composer 按 zoom 换算跟随', Math.abs(s5.afterZoom - s5.expZoom) <= 2, `afterZoom=${s5.afterZoom} exp=${s5.expZoom}`);
  check('平移后 Composer 跟随（left+80）', Math.abs(s5.afterPan - s5.expPan) <= 2, `afterPan=${s5.afterPan} exp=${s5.expPan}`);

  // —— 场景 6：切换选中另一个生成节点 → Composer 跟随 ——
  const s6 = await page.evaluate(() => {
    workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1;
    applyTransform();
    const nodes = [...workflow.nodes.values()].filter((n) => n.type === 'aiImage');
    const n2 = addNode('aiImage', 200, 500);
    const el = document.getElementById('nodeComposer');
    return {
      visible: !el.hidden,
      left: parseFloat(el.style.left),
      expLeft: n2.x * workflow.camera.zoom + workflow.camera.x,
      nodeCount: nodes.length + 1
    };
  });
  check('切换选中新 aiImage → Composer 跟随新节点', s6.visible && Math.abs(s6.left - s6.expLeft) <= 1, `left=${s6.left} exp=${s6.expLeft}`);

  // —— 场景 7：选中 text 节点 → Composer 隐藏 ——
  const s7 = await page.evaluate(() => {
    const t = addNode('text', 600, 900);
    const el = document.getElementById('nodeComposer');
    return { hidden: el.hidden };
  });
  check('选中 text 节点 → Composer 隐藏', s7.hidden);

  // —— 场景 8：删除节点 → Composer 隐藏 ——
  const s8 = await page.evaluate(() => {
    const n = addNode('aiImage', 200, 1000);
    const el = document.getElementById('nodeComposer');
    const visibleBefore = !el.hidden;
    deleteNode(n.id);
    return { visibleBefore, hiddenAfter: el.hidden };
  });
  check('删除节点 → Composer 隐藏', s8.visibleBefore && s8.hiddenAfter);

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[composer] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[composer] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[composer] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
