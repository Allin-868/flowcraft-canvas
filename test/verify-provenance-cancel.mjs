#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 当前部署产物的 P0 专项：结果可追溯性与取消终态。
 * 不填写真实 Key、不请求真实 AI；生成和延迟均使用页内 mock。
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
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(`${ROOT}/`) && file !== join(ROOT, 'index.html')) { res.writeHead(403); return res.end('forbidden'); }
  if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? '  ✅' : '  ❌'} ${name}${detail ? `：${detail}` : ''}`);
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|404|Failed to load resource/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.runner && typeof serializeWorkflow === 'function', { timeout: 10_000 });
  check('当前构建产物可加载', errors.length === 0, errors.join(' | '));

  const provenance = await page.evaluate(() => {
    const text = addNode('text', 100, 100);
    text.refImages = [{ name: '角色参考图', src: 'data:image/png;base64,AA==' }];
    const node = addNode('aiImage', 500, 100);
    node.prompt = '镜头：角色站在雨中';
    node.effectivePrompt = '角色描述\n镜头：角色站在雨中';
    node.params.model = '测试模型';
    node.params.aspect = '9:16';
    node.params.resolution = '超清2K';
    node.params.count = '2张';
    node.params.negativePrompt = '低清晰度、文字、水印';
    node.stateMeta = { sourceId: text.id, label: '雨中状态', batchId: 'batch-test', batchIndex: 1, batchTotal: 1 };
    const edge = connectNodes(text.id, 0, node.id, 0);
    captureGenMeta(node, 4321);
    const saved = JSON.parse(serializeWorkflow());
    const savedNode = saved.nodes.find((item) => item.id === node.id);
    applyWorkflowData(saved);
    const restored = workflow.nodes.get(node.id);
    return {
      edge: Boolean(edge),
      saved: savedNode && {
        negativePrompt: savedNode.genMeta && savedNode.genMeta.negativePrompt,
        refs: savedNode.genMeta && savedNode.genMeta.references,
        sourceNodeId: savedNode.genMeta && savedNode.genMeta.sourceNodeId,
        state: savedNode.genMeta && savedNode.genMeta.state,
      },
      restored: restored && {
        negativePrompt: restored.genMeta && restored.genMeta.negativePrompt,
        refs: restored.genMeta && restored.genMeta.references,
        sourceNodeId: restored.genMeta && restored.genMeta.sourceNodeId,
        state: restored.genMeta && restored.genMeta.state,
        refImages: workflow.nodes.get(text.id)?.refImages?.length || 0,
        stateMeta: restored.stateMeta && restored.stateMeta.label,
      },
    };
  });
  check('生成元数据随 JSON 导出保存', Boolean(provenance.saved && provenance.saved.negativePrompt === '低清晰度、文字、水印'), JSON.stringify(provenance.saved));
  check('元数据保存来源节点、状态和参考图摘要', Boolean(provenance.saved && provenance.saved.sourceNodeId && provenance.saved.state === '雨中状态' && provenance.saved.refs && provenance.saved.refs.names.includes('角色参考图')), JSON.stringify(provenance.saved));
  check('导入后恢复负向提示词和生成元数据', Boolean(provenance.restored && provenance.restored.negativePrompt === '低清晰度、文字、水印' && provenance.restored.state === '雨中状态'), JSON.stringify(provenance.restored));
  check('导入后仍恢复参考图和角色状态来源', Boolean(provenance.restored && provenance.restored.refImages === 1 && provenance.restored.stateMeta === '雨中状态'), JSON.stringify(provenance.restored));

  const cancelled = await page.evaluate(async () => {
    const runner = window.FlowCraft.runner;
    runner.reset();
    const node = addNode('aiImage', 900, 100);
    const original = window.executeNodeAsync;
    window.executeNodeAsync = async (target) => {
      target.status = 'running';
      await new Promise((resolve) => setTimeout(resolve, 80));
      target.status = 'done';
      target.outputsData = [{ type: 'image', value: 'data:image/png;base64,AA==' }];
    };
    const run = runner.runInOrder([node], 0, new Set());
    // 等待执行器真正进入 running，确保测试覆盖“运行中请求晚到成功”的竞态。
    for (let i = 0; i < 30 && node.status !== 'running'; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    runner.cancel(node.id);
    await run;
    const task = runner.getState().filter((item) => item.nodeId === node.id).pop();
    window.executeNodeAsync = original;
    return { status: node.status, task: task && task.state, hasOutput: Boolean(node.outputsData && node.outputsData[0] && node.outputsData[0].value) };
  });
  check('运行中取消不会被晚到成功结果覆盖', cancelled.status === 'cancelled', JSON.stringify(cancelled));
  check('取消任务最终记录为 cancelled', cancelled.task === 'cancelled', JSON.stringify(cancelled));
  check('取消后不向节点写入生成结果', cancelled.hasOutput === false, JSON.stringify(cancelled));
  check('专项过程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((item) => !item.passed);
  console.log(`\n[provenance-cancel] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[provenance-cancel] FAIL：${failed.map((item) => item.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[provenance-cancel] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
