#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** 风格预设折叠防回退：点击标题收起/展开 tabs+body；状态持久化跨刷新。 */
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
await page.waitForTimeout(300);

const state = () => page.evaluate(() => {
  const label = document.querySelector('.sidebar-section-label.preset-toggle');
  const wrap = document.querySelector('.preset-section');
  const tabs = document.querySelector('.preset-tabs');
  const body = document.querySelector('.preset-body');
  const vis = (el) => el && getComputedStyle(el).display !== 'none';
  return { collapsed: wrap.classList.contains('collapsed'), tabsVisible: vis(tabs), bodyVisible: vis(body), hasCaret: !!label.querySelector('.preset-caret') };
});

const s0 = await state();
check('初始展开：tabs+body 可见', !s0.collapsed && s0.tabsVisible && s0.bodyVisible, JSON.stringify(s0));
check('标题带折叠箭头', s0.hasCaret);

await page.click('.sidebar-section-label.preset-toggle');
await page.waitForTimeout(200);
const s1 = await state();
check('点击后收起：tabs+body 隐藏', s1.collapsed && !s1.tabsVisible && !s1.bodyVisible, JSON.stringify(s1));

// 持久化：刷新后仍收起
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow);
await page.waitForTimeout(300);
const s2 = await state();
check('刷新后保持收起（localStorage 持久化）', s2.collapsed && !s2.tabsVisible && !s2.bodyVisible, JSON.stringify(s2));

// 再点展开
await page.click('.sidebar-section-label.preset-toggle');
await page.waitForTimeout(200);
const s3 = await state();
check('再次点击展开', !s3.collapsed && s3.tabsVisible && s3.bodyVisible, JSON.stringify(s3));

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 风格预设折叠：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
