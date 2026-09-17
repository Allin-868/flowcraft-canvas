#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** ComfyUI 工作流编辑器中文化防回退：节点标题与字段标签应为中文（原文在 title）。 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
const ROOT = decodeURIComponent(new URL('../', import.meta.url).pathname);
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(join(ROOT, 'index.html'))); });
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && window.FlowCraft._openComfyEditor && typeof addNode === 'function');
await page.evaluate(() => { clearGraph(); const n = addNode('comfyui', 0, 0); n.params.wf = 'txt2img'; window.FlowCraft._openComfyEditor(n); });
await page.waitForTimeout(300);
const info = await page.evaluate(() => ({
  titles: [...document.querySelectorAll('#fcCwForm .fcw-title')].map(e => e.textContent),
  titleRaw: [...document.querySelectorAll('#fcCwForm .fcw-title')].map(e => e.title),
  labs: [...document.querySelectorAll('#fcCwForm .fcw-f label')].map(e => e.textContent),
  labRaw: [...document.querySelectorAll('#fcCwForm .fcw-f label')].map(e => e.title),
}));
const CN = /[\u4e00-\u9fa5]/;
check('节点标题含中文（采样器/载入模型等）', info.titles.length > 0 && info.titles.every(t => CN.test(t)), JSON.stringify(info.titles.slice(0, 3)));
check('节点标题 title 保留英文原类名', info.titleRaw.some(t => /KSampler|CheckpointLoaderSimple/.test(t)), JSON.stringify(info.titleRaw.slice(0, 2)));
check('字段标签含中文（种子/采样步数等）', info.labs.length > 0 && info.labs.every(l => CN.test(l)), JSON.stringify(info.labs.slice(0, 6)));
check('字段标签 title 保留英文原名', info.labRaw.some(l => /seed|steps|ckpt_name/.test(l)), JSON.stringify(info.labRaw.slice(0, 3)));
await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== ComfyUI 编辑器中文化：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
