#!/usr/bin/env node
/**
 * C 图片/视频按原图比例显示 专项回归（2026-09-05 二版：以 hero 实测比例为准）。
 *
 * 现行规则：fitNodeToImageRatio 先按上限算 contentW/contentH，重建后以 .node-hero
 * 实测尺寸反推节点框（先校宽再校高），保证 hero 比例 == 图片比例（object-fit: contain 不留白）。
 * 因此断言一律测 hero 的宽高比，而不是节点 width/height 的公式值。
 * 不填写真实 Key、不请求真实 AI 服务。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(SCRIPT_DIR, '..');
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
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const server = createServer();
let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|404|Failed to load resource/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && typeof addNode === 'function', { timeout: 10_000 });
  check('当前构建产物加载且无运行时错误', errors.length === 0, errors.join(' | '));

  const measure = `(node) => {
    const hero = node.el.querySelector('.node-hero');
    const r = hero.getBoundingClientRect();
    return { width: node.width, height: node.height, ratio: node.ratio, heroAspect: r.width / r.height };
  }`;

  // —— 场景 1：loadImageFile 载入 400×200 横图 → hero 比例 ≈2 无留白 ——
  const r1 = await page.evaluate(async (mStr) => {
    const measure = eval('(' + mStr + ')');
    const node = addNode('image', 200, 200);
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f09acb'; ctx.fillRect(0, 0, 400, 200);
    const blob = await (await fetch(canvas.toDataURL('image/png'))).blob();
    const file = new File([blob], 'test-landscape.png', { type: 'image/png' });
    loadImageFile(file, node);
    await new Promise((done) => setTimeout(done, 1200));
    const out = measure(node);
    out.heroImg = !!node.el.querySelector('.node-image-input-img');
    out.thumbOk = !!node.thumb;
    return out;
  }, measure);
  check('横图 hero 比例≈2（无留白）', near(r1.heroAspect, 2, 0.05), 'heroAspect=' + r1.heroAspect.toFixed(3));
  check('横图比例记录正确（ratio≈2）', r1.ratio && near(r1.ratio, 2, 0.05), 'ratio=' + r1.ratio);
  check('渲染 hero 卡片预览图', r1.heroImg === true);
  check('缩略图已载入', !!r1.thumbOk);

  // —— 场景 2：fitNodeToImageRatio 直调竖图（800×1200）→ hero 比例 ≈0.667 ——
  const r2 = await page.evaluate((mStr) => {
    const measure = eval('(' + mStr + ')');
    const node = addNode('image', 500, 200);
    node.thumb = 'data:image/png;base64,AAAA';
    fitNodeToImageRatio(node, 800, 1200);
    return measure(node);
  }, measure);
  check('竖图 hero 比例≈0.667（无留白）', near(r2.heroAspect, 0.667, 0.05), 'heroAspect=' + r2.heroAspect.toFixed(3));
  check('竖图比例正确（ratio≈0.667）', r2.ratio && near(r2.ratio, 0.667, 0.03), 'ratio=' + r2.ratio);

  // —— 场景 3：方形图 → hero 比例 ≈1 ——
  const r3 = await page.evaluate((mStr) => {
    const measure = eval('(' + mStr + ')');
    const node = addNode('image', 800, 200);
    node.thumb = 'data:image/png;base64,AAAA';
    fitNodeToImageRatio(node, 600, 600);
    return measure(node);
  }, measure);
  check('方形图 hero 比例≈1（无留白）', near(r3.heroAspect, 1, 0.05), 'heroAspect=' + r3.heroAspect.toFixed(3));
  check('方形图 ratio≈1', r3.ratio && near(r3.ratio, 1, 0.02), 'ratio=' + r3.ratio);

  // —— 场景 4：aiImage 多图画廊 → 跳过比例适配 ——
  const r4 = await page.evaluate(() => {
    const node = addNode('aiImage', 1000, 200);
    node.thumb = 'data:image/png;base64,AAAA';
    node._galleryImages = ['data:image/png;base64,AAAA', 'data:image/png;base64,AAAA'];
    probeFitNode(node);
    return { ratio: node.ratio === undefined ? null : node.ratio };
  });
  check('多图画廊跳过比例适配（ratio 未设置）', r4.ratio === null, JSON.stringify(r4.ratio));

  // —— 场景 5：aiImage 单图 640×360 → hero 比例 ≈1.778 ——
  const r5 = await page.evaluate(async (mStr) => {
    const measure = eval('(' + mStr + ')');
    const node = addNode('aiImage', 1000, 500);
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#336'; ctx.fillRect(0, 0, 640, 360);
    node.thumb = canvas.toDataURL('image/png');
    probeFitNode(node);
    await new Promise((done) => setTimeout(done, 1000));
    return measure(node);
  }, measure);
  check('aiImage 单图 hero 比例≈1.778（无留白）', near(r5.heroAspect, 1.778, 0.05), 'heroAspect=' + r5.heroAspect.toFixed(3));

  // —— 场景 6：懒迁移——已有 thumb 的旧节点首次 buildNodeBody 自动适配 ——
  const r6 = await page.evaluate(async (mStr) => {
    const measure = eval('(' + mStr + ')');
    const node = addNode('image', 1200, 200);
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 640, 360);
    node.thumb = canvas.toDataURL('image/png');
    node.width = 280;
    node._fitProbed = false;
    buildNodeBody(node.el, node);
    await new Promise((done) => setTimeout(done, 1000));
    return measure(node);
  }, measure);
  check('旧节点懒迁移 hero 比例≈1.778（无留白）', near(r6.heroAspect, 1.778, 0.05), 'heroAspect=' + r6.heroAspect.toFixed(3));
  check('旧节点比例正确（ratio≈1.778）', r6.ratio && near(r6.ratio, 1.778, 0.05), 'ratio=' + r6.ratio);

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[ratio-fit] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[ratio-fit] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[ratio-fit] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
