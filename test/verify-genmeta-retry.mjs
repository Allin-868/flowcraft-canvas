#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * #8 生成节点完整元数据 + 一键同参重试 专项回归。
 * 通过页内上下文直接调用 captureGenMeta / buildNodeBody / retrySameParams，验证：
 *   1) 成功生成后把「本次实际使用的全部参数」快照到 node.genMeta
 *   2) 节点 body 渲染「生成信息条」：模型/比例/张数/耗时 chips + 「同参重试」按钮
 *   3) 一键同参重试：把快照参数恢复到节点上（提示词/模型/比例/张数），并触发重新运行
 *   4) 无生成记录时重试给出友好提示且不崩
 * 不填写真实 Key、不请求真实 AI 服务（FLUX.1 为演示模型，走占位出图）。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

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

// aiImage 已统一走真实生成（legacy.js:16781），演示占位图按 P0-4 语义契约移除，
// 所以「重试后完成」这条必须打桩 /images/generations 才能验真；不打桩只会得到「未配置 Key」的 error。
const MOCK_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

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

  // —— 场景 1：成功生成后元数据快照 + 信息条渲染 ——
  const meta1 = await page.evaluate(() => {
    const node = addNode('aiImage', 120, 120);
    node.prompt = '测试提示词：穿白色连衣裙的女孩';
    node.params.model = 'FLUX.1';
    node.params.aspect = '1:1';
    node.params.count = '2张';
    node.params.mode = '同步';
    captureGenMeta(node, 3250); // 模拟一次耗时 3250ms 的成功生成
    if (node.el) buildNodeBody(node.el, node);
    const strip = node.el ? node.el.querySelector('.node-gen-meta') : null;
    return {
      genMeta: node.genMeta,
      hasStrip: !!strip,
      chips: strip ? Array.from(strip.querySelectorAll('.ngm-chip')).map((c) => c.textContent) : [],
      hasRetryBtn: !!(strip && strip.querySelector('.ngm-retry')),
      retryTitle: strip && strip.querySelector('.ngm-retry') ? strip.querySelector('.ngm-retry').title : '',
      stripTitle: strip ? (strip.title || '') : ''
    };
  });
  check('genMeta 快照写入（含提示词/模型/比例/张数/耗时/参考图）',
    meta1.genMeta && meta1.genMeta.model === 'FLUX.1' && meta1.genMeta.aspect === '1:1'
      && meta1.genMeta.count === '2张' && meta1.genMeta.durationMs === 3250
      && meta1.genMeta.ownPrompt === '测试提示词：穿白色连衣裙的女孩',
    JSON.stringify(meta1.genMeta && { m: meta1.genMeta.model, a: meta1.genMeta.aspect, c: meta1.genMeta.count, d: meta1.genMeta.durationMs, own: (meta1.genMeta.ownPrompt || '').slice(0, 12) }));
  check('节点渲染「生成信息条」', meta1.hasStrip);
  check('信息条 chips 含 模型/比例/张数/耗时 时间', meta1.hasStrip && meta1.chips.length >= 4
    && meta1.chips.some((c) => c.includes('FLUX.1')) && meta1.chips.some((c) => c === '1:1')
    && meta1.chips.some((c) => c.includes('2张')) && meta1.chips.some((c) => c.includes('3.3s')),
    meta1.chips.join(' | '));
  check('信息条含「同参重试」按钮且带说明', meta1.hasRetryBtn && /同参重试|完全相同/.test(meta1.retryTitle));
  check('信息条 title 携带本次提示词', /白色连衣裙/.test(meta1.stripTitle), meta1.stripTitle.slice(0, 40));

  // —— 场景 2：一键同参重试恢复参数并触发重新运行 ——
  await page.evaluate(() => localStorage.setItem('flowcraft-openai-key', 'sk-mock-for-regression'));
  await page.route('**/images/generations', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ b64_json: MOCK_IMG.split(',')[1] }] }),
  }));
  const meta2 = await page.evaluate(async () => {
    // 找到场景 1 的节点（最后一个 aiImage）
    const nodes = [...workflow.nodes.values()];
    const node = nodes.filter((n) => n.type === 'aiImage').pop();
    // 先改动参数（模拟用户后来改了）→ 再同参重试
    node.prompt = '被改过的提示词';
    node.params.model = 'GPT Image 2';
    node.params.aspect = '16:9';
    node.params.count = '8张';
    const before = { model: node.params.model, aspect: node.params.aspect, count: node.params.count, prompt: node.prompt };
    retrySameParams(node);
    const restored = { model: node.params.model, aspect: node.params.aspect, count: node.params.count, prompt: node.prompt };
    // 等待 mock 出图返回（真实调用路径：generateOpenAIImage → /images/generations）
    await new Promise((done) => setTimeout(done, 2600));
    return { before, restored, status: node.status, resultMode: node.resultMode, genMeta2: node.genMeta };
  });
  check('同参重试：提示词恢复为上次自身输入', meta2.restored.prompt === '测试提示词：穿白色连衣裙的女孩', meta2.restored.prompt);
  check('同参重试：模型恢复 FLUX.1', meta2.restored.model === 'FLUX.1', meta2.restored.model);
  check('同参重试：比例恢复 1:1', meta2.restored.aspect === '1:1', meta2.restored.aspect);
  check('同参重试：张数恢复 2张', meta2.restored.count === '2张', meta2.restored.count);
  check('同参重试后节点被触发重新运行（完成）', meta2.status === 'done', meta2.status);
  check('重试出图为真实链路结果（resultMode=real，非占位）', meta2.resultMode === 'real', JSON.stringify(meta2.resultMode));
  check('重跑后 genMeta 刷新为同参快照', meta2.genMeta2 && meta2.genMeta2.model === 'FLUX.1' && meta2.genMeta2.aspect === '1:1',
    JSON.stringify(meta2.genMeta2 && { m: meta2.genMeta2.model, a: meta2.genMeta2.aspect }));

  // —— 场景 3：无生成记录时重试给出友好提示且不崩 ——
  const meta3 = await page.evaluate(() => {
    const node = addNode('aiImage', 400, 400);
    node.genMeta = null;
    let threw = false;
    let msg = '';
    try {
      retrySameParams(node);
    } catch (e) { threw = true; msg = e.message; }
    return { threw, status: node.status, prompt: node.prompt };
  });
  check('无生成记录时同参重试不崩', !meta3.threw, meta3.threw ? meta3.msg : '');
  check('无生成记录时节点状态不变', meta3.status !== 'running' && meta3.status !== 'done', meta3.status);

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[genmeta-retry] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[genmeta-retry] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[genmeta-retry] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
