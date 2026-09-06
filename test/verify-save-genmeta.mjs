#!/usr/bin/env node
/** save 跨域/http 下载 + genMeta 条防重复 防回退。 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
const ROOT = '/Users/allin/Workspace/项目/project-001-FlowCraft无限画布/输出成果/deploy';
// 1x1 png
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIBgNVBgAAPwAF/wAjKgTGAAAAAElFTkSuQmCC', 'base64');
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };
const server = http.createServer((req, res) => {
  if (req.url === '/img.png') { res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' }); res.end(PNG); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(join(ROOT, 'index.html')));
});
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

// 1) save 节点接受 http(s) 图片输入（真实生成返回 URL 的场景）
const s = await page.evaluate(async (url) => {
  clearGraph();
  const im = addNode('image', 100, 100);
  im.outputsData = [{ type: 'image', value: url }];
  const sv = addNode('save', 400, 100);
  connectNodes(im.id, 0, sv.id, 0);
  await runWorkflow({ force: true, skipPreview: true });
  return { status: sv.status, err: sv._lastError || '' };
}, `http://127.0.0.1:${port}/img.png`);
check('save 接受 http(s) 图片输入并成功', s.status === 'done', JSON.stringify(s));

// 2) genMeta 条不重复（多次 buildNodeBody 只留一条）
const g = await page.evaluate(() => {
  clearGraph();
  const n = addNode('aiImage', 200, 200);
  n.genMeta = { model: 'nanoBananaPro', aspect: '1:1', t: Date.now(), durationMs: 1200 };
  if (n.el) buildNodeBody(n.el, n);
  if (n.el) buildNodeBody(n.el, n);
  if (n.el) buildNodeBody(n.el, n);
  return n.el.querySelectorAll('.node-gen-meta').length;
});
check('genMeta 条多次重建仅一条', g === 1, 'count=' + g);

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== save/genMeta：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
