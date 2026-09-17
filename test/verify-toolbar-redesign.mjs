#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** 媒体节点外置标题栏防溢出防回退：工具组右缘不超出标题栏胶囊；工具按钮 22px。 */
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
const s = await page.evaluate(async (png) => {
  clearGraph();
  const n = addNode('aiImage', 300, 200);
  n.outputsData = [{ type: 'image', value: png }];
  if (n.el) buildNodeBody(n.el, n);
  selectNode(n);
  await new Promise(r => setTimeout(r, 300));
  const header = n.el.querySelector('.node-header');
  const tools = n.el.querySelector('.node-tools');
  const btn = tools && tools.querySelector('.node-tool-btn');
  const hr = header.getBoundingClientRect();
  const tr = tools.getBoundingClientRect();
  return { headerRight: hr.right, toolsRight: tr.right, btnW: getComputedStyle(btn).width, headerContainsTools: header.contains(tools) };
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAD2w0F2AAAAEUlEQVR4nGP8z8Dwn4EIwESMol2FKjT/ACuKA9vP1CsAAAAASUVORK5CYII=');
check('工具组不溢出标题栏胶囊', s.toolsRight <= s.headerRight + 1, `tools=${Math.round(s.toolsRight)} header=${Math.round(s.headerRight)}`);
check('工具组在标题栏内', s.headerContainsTools);
check('标题栏工具按钮 22px(computed，不受画布 zoom 影响)', s.btnW === '22px', 'btn=' + s.btnW);

// 非媒体节点（comfyui，内部 header）同样套用美化
const c = await page.evaluate(async () => {
  clearGraph();
  const n = addNode('comfyui', 300, 200);
  if (n.el) buildNodeBody(n.el, n);
  selectNode(n);
  await new Promise(r => setTimeout(r, 300));
  const header = n.el.querySelector('.node-header');
  const tools = n.el.querySelector('.node-tools');
  const btn = tools && tools.querySelector('.node-tool-btn');
  const hr = header.getBoundingClientRect();
  const tr = tools ? tools.getBoundingClientRect() : null;
  const nr = n.el.getBoundingClientRect();
  return { hasTools: !!tools, toolsRight: tr ? tr.right : null, headerRight: hr.right, btnW: btn ? getComputedStyle(btn).width : null, contains: tools ? header.contains(tools) : null, headerBottom: hr.bottom, nodeTop: nr.top };
});
check('comfyui 状态栏外置到节点框上方', c.headerBottom <= c.nodeTop + 1, `headerBottom=${Math.round(c.headerBottom)} nodeTop=${Math.round(c.nodeTop)}`);
if (c.hasTools) {
  check('comfyui 工具组不溢出', c.toolsRight <= c.headerRight + 1, `tools=${Math.round(c.toolsRight)} header=${Math.round(c.headerRight)}`);
  check('comfyui 工具按钮 22px', c.btnW === '22px', 'btn=' + c.btnW);
} else {
  check('comfyui 无工具组(仅状态栏,跳过工具断言)', true);
}

// 非媒体且有悬浮工具条的节点（upscale）：玻璃胶囊生效
const u = await page.evaluate(async () => {
  clearGraph();
  const n = addNode('upscale', 300, 200);
  if (n.el) buildNodeBody(n.el, n);
  selectNode(n);
  await new Promise(r => setTimeout(r, 300));
  const tb = n.el.querySelector('.node-toolbar');
  if (!tb) return { skip: true };
  const cs = getComputedStyle(tb);
  const nw = n.el.getBoundingClientRect().width;
  const tw = tb.getBoundingClientRect().width;
  return { radius: cs.borderRadius, tw, nw };
});
if (u.skip) { check('upscale 悬浮工具条(无,跳过)', true); }
else {
  check('upscale 工具条为玻璃胶囊(radius 999px)', u.radius === '999px', u.radius);
  check('upscale 工具条收拢(宽<节点宽)', u.tw < u.nw, `tb=${Math.round(u.tw)} node=${Math.round(u.nw)}`);
}
await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 标题栏防溢出：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
