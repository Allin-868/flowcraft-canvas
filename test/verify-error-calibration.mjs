#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 阶段B·B3 真实错误样本校准：实时采集真实错误（代理401 / ComfyUI400 / 拒连），
 * 喂给 classifyNodeError 验证分类命中。无需任何密钥。
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = decodeURIComponent(new URL('../', import.meta.url).pathname);
const PROXY_BASE = (process.env.FLOWCRAFT_PROXY_BASE || 'https://famous-bienenstitch-cb1abc.netlify.app').replace(/\/+$/, '');
const COMFY_ADDR = (process.env.FLOWCRAFT_COMFY_ADDR || 'http://127.0.0.1:8188').replace(/\/+$/, '');

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? '  ✅' : '  ❌'} ${name}${detail ? '：' + detail : ''}`);
}

// 实时采集真实错误样本
async function collectSamples() {
  const s = {};
  // 1) 代理 401（无口令）
  try {
    const r = await fetch(PROXY_BASE + '/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'openai', endpoint: '/chat/completions', body: {} }), signal: AbortSignal.timeout(10000) });
    const b = await r.json().catch(() => ({}));
    s.auth = { status: r.status, msg: (b && b.error && b.error.message) || ('HTTP ' + r.status) };
  } catch (e) { s.auth = { status: 0, msg: e.message }; }
  // 2) ComfyUI 400（缺模型/无输出）
  try {
    const r = await fetch(COMFY_ADDR + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: { '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'no_such.safetensors' } } } }), signal: AbortSignal.timeout(8000) });
    const b = await r.json().catch(() => ({}));
    s.param = { status: r.status, msg: ((b && b.error && b.error.type) || '') + ' ' + ((b && b.node_errors) ? 'node_errors' : '') };
  } catch (e) { s.param = { status: 0, msg: e.message }; }
  // 3) 拒连（死端口）
  try {
    await fetch('http://127.0.0.1:9/x', { signal: AbortSignal.timeout(2000) });
    s.network = { status: 0, msg: 'unexpected ok' };
  } catch (e) { s.network = { status: 0, msg: e.cause && e.cause.code ? e.cause.code : e.message }; }
  return s;
}

const samples = await collectSamples();
console.log('真实样本:', JSON.stringify(samples));

const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(ROOT + '/index.html')); });
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && typeof classifyNodeError === 'function');

const classified = await page.evaluate((samples) => {
  const mk = (st, msg, kind) => ({ _lastErrorStatus: st, _lastError: msg, _lastErrorKind: kind || '', failureReason: msg });
  return {
    auth: classifyNodeError(mk(samples.auth.status, samples.auth.msg, 'auth')),
    param: classifyNodeError(mk(samples.param.status, samples.param.msg, 'param')),
    network: classifyNodeError(mk(samples.network.status, 'Failed to fetch ' + samples.network.msg, '')),
  };
}, samples);

check('真实代理401 → 分类 auth（打开设置）', classified.auth.category === 'auth', JSON.stringify(classified.auth));
check('真实ComfyUI400 → 分类 param（编辑参数）', classified.param.category === 'param', JSON.stringify(classified.param));
check('真实拒连 → 分类 network（重试）', classified.network.category === 'network', JSON.stringify(classified.network));

await browser.close(); server.close();
const failed = checks.filter(c => !c.passed).length;
console.log(`\n==== 真实错误样本校准：PASS=${checks.length - failed} FAIL=${failed} ====`);
process.exit(failed ? 1 : 0);
