#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 阶段B · 真实链路联调 harness。
 * 密钥纪律：任何 Key/口令只从环境变量读取（FLOWCRAFT_PROXY_BASE / FLOWCRAFT_PROXY_TOKEN / FLOWCRAFT_COMFY_ADDR），
 *           绝不写入仓库、绝不打印明文。无密钥时仅跑「真实连通性 + 错误契约」探针并优雅跳过真实生成。
 * 探针：
 *   A1 ComfyUI 连通性 + 版本 + checkpoint 数量（真实，无密钥）
 *   A2 代理可达性 + 无口令 401 错误契约（真实，无密钥）
 *   B  （需 FLOWCRAFT_PROXY_TOKEN）经代理真实 chat completion（最省模型），校验契约与内容非空
 *   C  （需 ComfyUI 有 checkpoint）应用层 comfyui 节点真实出图（playwright 驱动 executeNodeAsync）
 */
const COMFY_ADDR = (process.env.FLOWCRAFT_COMFY_ADDR || 'http://127.0.0.1:8188').replace(/\/+$/, '');
const PROXY_BASE = (process.env.FLOWCRAFT_PROXY_BASE || 'https://famous-bienenstitch-cb1abc.netlify.app').replace(/\/+$/, '');
const PROXY_TOKEN = process.env.FLOWCRAFT_PROXY_TOKEN || '';

const results = [];
function rec(name, status, detail = '') {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'SKIP' ? '⏭️' : status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`${icon} [${status}] ${name}${detail ? '：' + detail : ''}`);
}

// ---------- A1 ComfyUI 连通性 ----------
async function probeComfy() {
  try {
    const r = await fetch(COMFY_ADDR + '/system_stats', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) { rec('ComfyUI 连通性', 'FAIL', 'HTTP ' + r.status); return { ok: false, ckpts: 0 }; }
    const s = await r.json();
    const ver = s && s.system && s.system.comfyui_version;
    const oi = await fetch(COMFY_ADDR + '/object_info/CheckpointLoaderSimple', { signal: AbortSignal.timeout(8000) });
    let ckpts = 0;
    if (oi.ok) {
      const o = await oi.json();
      ckpts = (o && o.CheckpointLoaderSimple && o.CheckpointLoaderSimple.input.required.ckpt_name[0] || []).length;
    }
    rec('ComfyUI 连通性', 'PASS', `v${ver} @ ${COMFY_ADDR}`);
    rec('ComfyUI checkpoint 数量', ckpts > 0 ? 'PASS' : 'INFO', `${ckpts} 个${ckpts === 0 ? '（未装模型→真实出图跳过）' : ''}`);
    return { ok: true, ckpts, ver };
  } catch (e) {
    rec('ComfyUI 连通性', 'FAIL', e.message);
    return { ok: false, ckpts: 0 };
  }
}

// ---------- A2 代理可达 + 无口令 401 契约 ----------
async function probeProxy() {
  try {
    const r = await fetch(PROXY_BASE + '/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', endpoint: '/chat/completions', body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ping' }] } }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json().catch(() => ({}));
    const contract = r.status === 401 && body && body.error && body.error.code === 'unauthorized';
    rec('代理可达性（无口令）', 'PASS', `HTTP ${r.status} @ ${PROXY_BASE}`);
    rec('代理无口令 401 错误契约', contract ? 'PASS' : 'FAIL', JSON.stringify(body).slice(0, 80));
    return { reachable: true };
  } catch (e) {
    rec('代理可达性（无口令）', 'FAIL', e.message);
    return { reachable: false };
  }
}

// ---------- B 经代理真实 chat（需 token） ----------
async function realProxyChat() {
  if (!PROXY_TOKEN) { rec('经代理真实 chat', 'SKIP', '未提供 FLOWCRAFT_PROXY_TOKEN（口令存于 Netlify 环境变量）'); return; }
  try {
    const r = await fetch(PROXY_BASE + '/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + PROXY_TOKEN },
      body: JSON.stringify({ provider: 'openai', endpoint: '/chat/completions', body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: '回复两个字：连通' }], stream: false, temperature: 0 } }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json().catch(() => ({}));
    const txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (r.ok && txt) rec('经代理真实 chat', 'PASS', `模型返回 ${JSON.stringify(txt.slice(0, 20))}`);
    else rec('经代理真实 chat', 'FAIL', `HTTP ${r.status} ${JSON.stringify(data).slice(0, 120)}`);
  } catch (e) { rec('经代理真实 chat', 'FAIL', e.message); }
}

// ---------- C 应用层 ComfyUI 真实出图（需 checkpoint） ----------
async function realComfyGen(ckpts) {
  if (!ckpts) { rec('应用层 ComfyUI 真实出图', 'SKIP', 'ComfyUI 无 checkpoint，真实出图跳过（装模型后可跑）'); return; }
  const { chromium } = await import('playwright');
  const http = await import('node:http');
  const { readFileSync } = await import('node:fs');
  const ROOT = decodeURIComponent(new URL('../', import.meta.url).pathname);
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(ROOT + '/index.html')); });
  await new Promise(d => server.listen(0, '127.0.0.1', d));
  const { port } = server.address();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');
    const out = await page.evaluate(async (addr) => {
      const n = addNode('comfyui', 0, 0);
      n.params.addr = addr; n.params.wf = 'txt2img';
      n.params.fields = Object.assign({}, n.params.fields, { prompt: 'a red apple on white background', width: 512, height: 512, steps: 4 });
      try { await executeNodeAsync(n); } catch (e) { return { err: String(e && e.message || e) }; }
      const img = (n.outputsData || []).find(p => p && p.type === 'image' && p.value);
      return { hasImg: !!img, len: img ? img.value.length : 0 };
    }, COMFY_ADDR);
    if (out.hasImg) rec('应用层 ComfyUI 真实出图', 'PASS', `产出 dataURL ${out.len} 字节`);
    else rec('应用层 ComfyUI 真实出图', 'FAIL', JSON.stringify(out).slice(0, 160));
  } finally { await browser.close(); server.close(); }
}

console.log('==== 阶段B 真实链路联调 ====');
const comfy = await probeComfy();
await probeProxy();
await realProxyChat();
await realComfyGen(comfy.ckpts);
const fail = results.filter(r => r.status === 'FAIL').length;
const skip = results.filter(r => r.status === 'SKIP').length;
console.log(`\n汇总：PASS=${results.filter(r => r.status === 'PASS').length} FAIL=${fail} SKIP=${skip}`);
process.exit(fail ? 1 : 0);
