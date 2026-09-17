#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/** ComfyUI 提示词放大面板：⤢ 按钮存在、打开面板、编辑同步内联+node.prompt、Esc 关闭。 */
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

// 建 comfyui 节点
await page.evaluate(() => { clearGraph(); const n = addNode('comfyui', 100, 60); n.params.wf = 'txt2img'; if (n.el) buildNodeBody(n.el, n); });
await page.waitForTimeout(300);

const hasBtn = await page.evaluate(() => {
  const n = [...workflow.nodes.values()].find(x => x.type === 'comfyui');
  return !!n.el.querySelector('.comfy-ta-row .prompt-expand-btn');
});
check('提示词框有 ⤢ 放大按钮', hasBtn);

// 点击打开面板
await page.click('.comfy-ta-row .prompt-expand-btn');
await page.waitForTimeout(300);
const opened = await page.evaluate(() => !!document.getElementById('promptExpandOverlay'));
check('点击后打开放大面板', opened);

// 在面板输入 → 同步内联 + node.prompt
await page.fill('.prompt-expand-textarea', '放大面板里编辑的提示词 ABC');
await page.waitForTimeout(200);
const synced = await page.evaluate(() => {
  const n = [...workflow.nodes.values()].find(x => x.type === 'comfyui');
  const inline = n.el.querySelector('.comfy-ta');
  return { inline: inline.value, field: n.params.fields.prompt, prompt: n.prompt };
});
check('面板编辑同步内联框', synced.inline === '放大面板里编辑的提示词 ABC', synced.inline);
check('面板编辑同步 node.prompt', synced.prompt === '放大面板里编辑的提示词 ABC', synced.prompt);

// 字数统计显示
const countTxt = await page.evaluate(() => (document.querySelector('.prompt-expand-count') || {}).textContent || '');
check('面板显示字数统计', /字/.test(countTxt), countTxt);

// Esc 关闭
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const closed = await page.evaluate(() => !document.getElementById('promptExpandOverlay'));
check('Esc 关闭面板', closed);

// 截图：节点 + 重新打开面板
await page.screenshot({ path: '/tmp/comfy-expand-node.png' });
await page.click('.comfy-ta-row .prompt-expand-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/comfy-expand-open.png' });
console.log('截图 /tmp/comfy-expand-node.png /tmp/comfy-expand-open.png');

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== ComfyUI 提示词放大面板：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
