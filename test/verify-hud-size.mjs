#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** 环形连接菜单尺寸防回退：整体 340px、节点按钮 34px、hub 102px（缩小后规格）。 */
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
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function' && typeof showConnectionNodeMenu === 'function');
await page.evaluate(() => { clearGraph(); const n = addNode('aiImage', 300, 200); showConnectionNodeMenu(720, 450, n, 'output', 0, 'image', 300, 200); });
await page.waitForTimeout(900);
const s = await page.evaluate(() => {
  const m = document.querySelector('.connection-node-menu');
  const btn = m.querySelector('.hud-node-btn');
  const hub = m.querySelector('.hud-hub');
  return { menu: m.getBoundingClientRect().width, btn: btn.getBoundingClientRect().width, hub: hub.getBoundingClientRect().width };
});
check('菜单整体 340px（缩小后）', Math.round(s.menu) === 340, 'menu=' + Math.round(s.menu));
check('节点按钮 34px', Math.round(s.btn) === 34, 'btn=' + Math.round(s.btn));
check('中心 hub 102px', Math.round(s.hub) === 102, 'hub=' + Math.round(s.hub));
await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 环形菜单尺寸：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
