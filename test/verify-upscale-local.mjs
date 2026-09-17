#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** 智能超清离线路径防回退：无 Key/代理时本地算法超清真实出图（尺寸 2x、resultMode=real）。 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
const ROOT = decodeURIComponent(new URL('../', import.meta.url).pathname);
// 1x1 红 png（已知有效）
const PNG4x6 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIBgNVBgAAPwAF/wAjKgTGAAAAAElFTkSuQmCC';
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(join(ROOT, 'index.html'))); });
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const r = await page.evaluate(async (png) => {
  clearGraph();
  const inDims = await new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = png; });
  const src = addNode('image', 100, 100);
  src.outputsData = [{ type: 'image', value: png }];
  if (src.el) buildNodeBody(src.el, src);
  const up = addNode('upscale', 400, 100);
  connectNodes(src.id, 0, up.id, 0);
  // 确认无 Key/代理（离线前提）
  const noKey = !localStorage.getItem('flowcraft-openai-key');
  const noProxy = !(window.FlowCraft && window.FlowCraft._fcProxy && window.FlowCraft._fcProxy());
  await executeNodeAsync(up);
  const out = (up.outputsData || [])[0];
  let dims = null;
  if (out && out.value) {
    dims = await new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = out.value; });
  }
  return { noKey, noProxy, hasOut: !!out, dims, inDims, resultMode: up.resultMode, status: up.status };
}, PNG4x6);

check('离线前提：无 Key 且无代理', r.noKey && r.noProxy, JSON.stringify({ noKey: r.noKey, noProxy: r.noProxy }));
check('超清节点真实出图（非占位）', r.hasOut && r.status === 'done', JSON.stringify({ hasOut: r.hasOut, status: r.status }));
check('输出尺寸为输入 2x', r.dims && r.inDims && r.dims.w === r.inDims.w * 2 && r.dims.h === r.inDims.h * 2, `in=${JSON.stringify(r.inDims)} out=${JSON.stringify(r.dims)}`);
check('resultMode 标记为 real', r.resultMode === 'real', r.resultMode);

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 智能超清离线路径：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
