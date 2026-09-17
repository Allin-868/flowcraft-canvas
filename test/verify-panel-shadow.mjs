#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** 画布右缘黑带防回退：隐藏态右面板(含左向阴影)完全出视口；.show 仍能滑回。 */
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
await page.waitForFunction(() => window.FlowCraft && workflow);

const hidden = await page.evaluate(() => {
  const SHADOW_LEAK = 40; // -8px offset + 32px blur
  const out = {};
  for (const sel of ['.recycle-panel', '.shot-panel']) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = null; continue; }
    const r = el.getBoundingClientRect();
    out[sel] = { left: Math.round(r.left), vw: window.innerWidth, clear: (r.left - SHADOW_LEAK) >= window.innerWidth };
  }
  return out;
});
check('回收站面板隐藏态(含阴影)完全出视口', hidden['.recycle-panel'] && hidden['.recycle-panel'].clear, JSON.stringify(hidden['.recycle-panel']));
check('镜头面板隐藏态(含阴影)完全出视口', hidden['.shot-panel'] && hidden['.shot-panel'].clear, JSON.stringify(hidden['.shot-panel']));

// .show 仍能滑回视口内
const shown = await page.evaluate(async () => {
  const el = document.querySelector('.recycle-panel');
  el.classList.add('show');
  await new Promise(r => setTimeout(r, 350));
  const r = el.getBoundingClientRect();
  const inside = r.right <= window.innerWidth + 1 && r.left < window.innerWidth;
  el.classList.remove('show');
  return inside;
});
check('回收站面板 .show 仍滑回视口内', shown);

await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/right-edge-after.png', clip: { x: 1440 - 120, y: 0, width: 120, height: 500 } });
console.log('截图 /tmp/right-edge-after.png');

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 右缘阴影：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
