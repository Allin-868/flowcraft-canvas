#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** Composer 避让防回退：下方放不下时不放节点本体上（改放右/左侧），与节点框不相交。 */
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
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const intersect = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

// 场景1：节点靠视口底部 → 下方放不下 → 应避让到侧边，不与节点相交
const s1 = await page.evaluate(async (png) => {
  clearGraph();
  workflow.camera.zoom = 1; workflow.camera.x = 0; workflow.camera.y = 0; applyTransform();
  const n = addNode('aiImage', 500, 620); // 靠近 900 高视口底部
  n.outputsData = [{ type: 'image', value: png }];
  if (n.el) buildNodeBody(n.el, n);
  selectNode(n);
  await new Promise(r => setTimeout(r, 400));
  const nr = n.el.getBoundingClientRect();
  const el = document.getElementById('nodeComposer') || document.querySelector('.node-composer');
  const cr = el.getBoundingClientRect();
  return { node: { left: nr.left, right: nr.right, top: nr.top, bottom: nr.bottom }, comp: { left: cr.left, right: cr.right, top: cr.top, bottom: cr.bottom } };
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAD2w0F2AAAAEUlEQVR4nGP8z8Dwn4EIwESMol2FKjT/ACuKA9vP1CsAAAAASUVORK5CYII=');
const ov1 = intersect(s1.node, s1.comp);
check('节点靠底部时 Composer 不压节点框', !ov1, JSON.stringify({ node: s1.node, comp: s1.comp }));

// 场景2：节点在视口中部 → 下方放得下 → 仍在节点正下方
const s2 = await page.evaluate(async () => {
  clearGraph();
  const n = addNode('aiImage', 500, 120);
  if (n.el) buildNodeBody(n.el, n);
  selectNode(n);
  await new Promise(r => setTimeout(r, 400));
  const nr = n.el.getBoundingClientRect();
  const el = document.getElementById('nodeComposer') || document.querySelector('.node-composer');
  const cr = el.getBoundingClientRect();
  return { nodeBottom: nr.bottom, compTop: cr.top, nodeLeft: nr.left, compLeft: cr.left };
});
check('空间充足时 Composer 仍在节点正下方', s2.compTop >= s2.nodeBottom - 1 && Math.abs(s2.compLeft - s2.nodeLeft) < 40, JSON.stringify(s2));

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== Composer 避让：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
