#!/usr/bin/env node
/** 查看大图走右键菜单 + 参数点击展开 防回退。 */
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
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const r = await page.evaluate(async () => {
  const mk = () => { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8; const x = cv.getContext('2d'); x.fillStyle = '#cc9933'; x.fillRect(0, 0, 8, 8); return cv.toDataURL('image/png'); };
  clearGraph();
  const im = addNode('image', 100, 100); im.uploadedImage = mk(); im.outputsData = [{ type: 'image', value: im.uploadedImage }];
  const up = addNode('upscale', 400, 100);
  connectNodes(im.id, 0, up.id, 0);
  await runWorkflow({ force: true, skipPreview: true });
  if (up.el) buildNodeBody(up.el, up);
  const strip = up.el.querySelector('.node-gen-meta');
  const details = strip.querySelector('.ngm-details');
  const collapsedBefore = getComputedStyle(details).display === 'none';
  // 单击生成图 → 不应弹大图
  const simg = up.el.querySelector('.node-preview-area.clean-output img');
  simg.click();
  await new Promise(r2 => setTimeout(r2, 200));
  const lightboxAfterClick = !!(document.getElementById('imageLightbox') || {}).classList && document.getElementById('imageLightbox').classList.contains('show');
  // 点击摘要 → 参数展开
  strip.querySelector('.ngm-summary').click();
  const expandedAfterClick = getComputedStyle(details).display !== 'none';
  return { collapsedBefore, lightboxAfterClick, expandedAfterClick };
});
check('参数详情默认收起', r.collapsedBefore === true);
check('点击摘要后参数展开', r.expandedAfterClick === true);
check('单击生成图不弹大图', r.lightboxAfterClick === false, 'lightbox=' + r.lightboxAfterClick);

// 右键节点 → 上下文菜单含「查看大图」
const menu = await page.evaluate(async () => {
  const up = [...workflow.nodes.values()].find(n => n.type === 'upscale');
  const rect = up.el.getBoundingClientRect();
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.x + 40, clientY: rect.y + 40 });
  up.el.dispatchEvent(ev);
  await new Promise(r2 => setTimeout(r2, 200));
  const items = [...document.querySelectorAll('.context-menu-item')].map(i => i.textContent);
  return items.some(t => t.includes('查看大图'));
});
check('右键菜单含「查看大图」', menu === true);

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 右键大图+参数点击：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
