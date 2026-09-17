#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** 节点框下方空白防回退：zoom≠1 时 fit 不应把框算大（布局像素下 body≈hero，无空白）。 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
const ROOT = decodeURIComponent(new URL('../', import.meta.url).pathname);
const PNG2x3 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAD2w0F2AAAAEUlEQVR4nGP8z8Dwn4EIwESMol2FKjT/ACuKA9vP1CsAAAAASUVORK5CYII=';
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

async function measureAt(zoom) {
  return page.evaluate(async ({ png, zoom }) => {
    clearGraph();
    workflow.camera.zoom = zoom; applyTransform();
    const n = addNode('aiImage', 100, 60);
    n.outputsData = [{ type: 'image', value: png }];
    if (n.el) buildNodeBody(n.el, n);
    await new Promise(r => setTimeout(r, 200));
    fitNodeToImageRatio(n, 2, 3);
    await new Promise(r => setTimeout(r, 100));
    const body = n.el.querySelector('.node-body');
    const hero = n.el.querySelector('.node-hero');
    return {
      zoom,
      bodyH: body.offsetHeight, heroH: hero.offsetHeight,
      gap: body.offsetHeight - hero.offsetHeight,
      nodeHeight: n.height,
    };
  }, { png: PNG2x3, zoom });
}

const z1 = await measureAt(1);
const z15 = await measureAt(1.5);
const z06 = await measureAt(0.6);

check('zoom=1 无空白(body≈hero)', z1.gap < 20, JSON.stringify(z1));
check('zoom=1.5 无空白(修复前会≈×1.5 撑大)', z15.gap < 20, JSON.stringify(z15));
check('zoom=0.6 无空白', z06.gap < 20, JSON.stringify(z06));
check('zoom=1.5 与 zoom=1 的布局高度一致(不受 zoom 影响)', Math.abs(z15.nodeHeight - z1.nodeHeight) < 24, `z1=${z1.nodeHeight} z1.5=${z15.nodeHeight}`);

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 节点空白(zoom)：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
