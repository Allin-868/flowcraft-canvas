#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** ComfyUI 节点面板布局防回退：运行按钮图标定尺寸/文字横排；滑块数值与滑杆同行。 */
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
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');
const m = await page.evaluate(() => {
  clearGraph();
  const n = addNode('comfyui', 0, 0); n.params.wf = 'txt2img';
  if (n.el) buildNodeBody(n.el, n);
  const btn = n.el.querySelector('.comfy-run');
  const svg = btn && btn.querySelector('svg');
  const span = btn && btn.querySelector('span');
  const rr = n.el.querySelector('.comfy-range-row');
  const val = n.el.querySelector('.comfy-range-val');
  const bs = btn && getComputedStyle(btn);
  const ss = svg && getComputedStyle(svg);
  return {
    btnH: btn ? btn.getBoundingClientRect().height : 0,
    svgW: svg ? svg.getBoundingClientRect().width : 0,
    svgH: svg ? svg.getBoundingClientRect().height : 0,
    spanText: span ? span.textContent : '',
    spanSameLineAsSvg: !!(svg && span && Math.abs(svg.getBoundingClientRect().top - span.getBoundingClientRect().top) < 20),
    hasRangeRow: !!rr, valInRow: !!(rr && rr.contains(val)),
    display: bs ? bs.display : '',
  };
});
check('运行按钮高度正常(<=40px，非被撑爆)', m.btnH > 0 && m.btnH <= 40, 'h=' + m.btnH);
check('运行图标定尺寸(<=20px，无巨大三角)', m.svgW <= 20 && m.svgH <= 20, `svg=${m.svgW}x${m.svgH}`);
check('运行文字横排(与图标同行)', m.spanText.includes('运行') && m.spanSameLineAsSvg, m.spanText);
check('滑块数值与滑杆同行(.comfy-range-row)', m.hasRangeRow && m.valInRow);
await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== ComfyUI 面板布局：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
