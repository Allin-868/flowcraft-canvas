#!/usr/bin/env node
/** 工作流执行机制六项调整防回退：C断链 / B增量 / D并发签名 / E环路 / A范围 / F预览。 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
const ROOT = '/Users/allin/Workspace/项目/project-001-FlowCraft无限画布/输出成果/deploy';
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(join(ROOT, 'index.html'))); });
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof runWorkflow === 'function');

// 公共：找 dry-run 弹层（排除 SCRIPT/STYLE 源码文本误匹配）
const FIND_OV = `(() => [...document.body.children].find(el => el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && (el.textContent || '').includes('运行前预览')))()`;

// D：引擎 runInOrder 支持第4参 force（并发上限在引擎内 Semaphore(2)）
const dSig = await page.evaluate(() => (window.FlowCraft.runner.runInOrder.length >= 4));
check('D 引擎 runInOrder 支持 force 参数', dSig === true);

// C：上游(comfyui 死地址)失败 → 下游 upscale 跳过不发请求
const c = await page.evaluate(async () => {
  clearGraph();
  const cf = addNode('comfyui', 100, 100);
  cf.params.addr = 'http://127.0.0.1:9'; // 死端口 → 必失败
  const up = addNode('upscale', 400, 100);
  connectNodes(cf.id, 0, up.id, 0);
  await runWorkflow({ force: true, skipPreview: true });
  return { cf: cf.status, up: up.status, reason: up._skipReason || '' };
});
check('C 上游失败→下游跳过(不发真实请求)', c.cf === 'error' && c.up === 'skipped', JSON.stringify(c));

// B：增量运行（离线路径 image→upscale）：二次无变更跳过，force 再跑
const b = await page.evaluate(async () => {
  const mk = (w, h, col) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png'); };
  clearGraph();
  const im = addNode('image', 100, 100);
  im.outputsData = [{ type: 'image', value: mk(4, 4, '#cc3333') }];
  const up = addNode('upscale', 400, 100);
  connectNodes(im.id, 0, up.id, 0);
  await runWorkflow({ force: true, skipPreview: true });   // 第一次全量
  const first = up.status;
  await runWorkflow({ skipPreview: true });                // 第二次增量
  const second = up.status;
  await runWorkflow({ force: true, skipPreview: true });   // 强制全量
  const third = up.status;
  return { first, second, third };
});
check('B 增量：首次 done→二次 skipped→force 再 done', b.first === 'done' && b.second === 'skipped' && b.third === 'done', JSON.stringify(b));

// E：环路节点不运行且给出提示（状态保持 idle）
const e = await page.evaluate(async () => {
  clearGraph();
  const a = addNode('text', 100, 100); a.params.text = 'a';
  const bnode = addNode('text', 400, 100); bnode.params.text = 'b';
  connectNodes(a.id, 0, bnode.id, 0);
  connectNodes(bnode.id, 0, a.id, 0); // 成环
  await runWorkflow({ force: true, skipPreview: true });
  return { a: a.status, b: bnode.status };
});
check('E 环路节点本轮不运行(保持 idle)', e.a === 'idle' && e.b === 'idle', JSON.stringify(e));

// A：仅运行选中子图（离线路径）
const a = await page.evaluate(async () => {
  const mk = (w, h, col) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png'); };
  clearGraph();
  const im1 = addNode('image', 100, 100); im1.outputsData = [{ type: 'image', value: mk(3, 3, '#33cc33') }];
  const up1 = addNode('upscale', 400, 100);
  connectNodes(im1.id, 0, up1.id, 0);
  const im2 = addNode('image', 100, 400); im2.outputsData = [{ type: 'image', value: mk(3, 3, '#3333cc') }];
  const up2 = addNode('upscale', 400, 400);
  connectNodes(im2.id, 0, up2.id, 0);
  workflow.selection.clear();
  workflow.selection.add(im1.id); workflow.selection.add(up1.id);
  await runWorkflow({ scope: 'selection', force: true, skipPreview: true });
  return { up1: up1.status, up2: up2.status, im2: im2.status };
});
check('A 仅选中子图运行(未选中不动)', a.up1 === 'done' && a.up2 === 'idle' && a.im2 === 'idle', JSON.stringify(a));

// F：有真实 Key 时弹 dry-run 预览且可取消
const f = await page.evaluate(async (findOvSrc) => {
  const findOv = () => eval(findOvSrc);
  clearGraph();
  localStorage.setItem('flowcraft-openai-key', 'sk-test-only');
  const ai = addNode('aiImage', 300, 200);
  runWorkflow({}); // 不 skipPreview → 应弹预览
  await new Promise(r => setTimeout(r, 300));
  const ov = findOv();
  const has = !!ov;
  const cancelBtn = ov && [...ov.querySelectorAll('button')].find(b => b.textContent === '取消');
  if (cancelBtn) cancelBtn.click();
  await new Promise(r => setTimeout(r, 150));
  const gone = !findOv();
  localStorage.removeItem('flowcraft-openai-key');
  return { has, gone, status: ai.status };
}, FIND_OV);
check('F 有真实 Key 时弹 dry-run 预览且可取消', f.has && f.gone && f.status !== 'running', JSON.stringify(f));

await browser.close(); server.close();
const fail = checks.filter(x => !x.p).length;
console.log(`\n==== 执行机制六项：PASS=${checks.length - fail} FAIL=${fail} ====`);
process.exit(fail ? 1 : 0);
