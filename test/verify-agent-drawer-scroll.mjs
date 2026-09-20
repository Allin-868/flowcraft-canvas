#!/usr/bin/env node
/**
 * 验证：Agent 抽屉（#agentDrawer）内滚轮应滚动消息列表，且不再误触发画布缩放。
 * 真因回顾：canvasWrap 的 wheel 处理器原先只豁免 #aiPanel，未豁免 #agentDrawer，
 * 导致在抽屉内滚轮被 preventDefault（锁死 #agentChatList 滚动）并缩放画布。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = process.env.FLOWCRAFT_ROOT || join(resolve(SCRIPT_DIR, '../../..'), '输出成果', 'deploy');
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p: Boolean(p) }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };

const server = http.createServer((q, r) => {
  if (!existsSync(join(ROOT, 'index.html'))) { r.writeHead(500); r.end('no index'); return; }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(readFileSync(join(ROOT, 'index.html')));
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && document.getElementById('agentDrawer') && typeof agentRenderChat === 'function');

// 展开抽屉 + 切到「对话」+ 灌 60 条消息让列表溢出
await page.evaluate(() => {
  document.getElementById('agentDrawer').hidden = false;
  agentSwitchTab('chat');
  window.__agentMessages = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '第 ' + i + ' 条消息：' + '内容填充'.repeat(12) }));
  agentRenderChat();
});

const box = await page.evaluate(() => {
  const l = document.getElementById('agentChatList');
  const r = l.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, overflows: l.scrollHeight > l.clientHeight + 1, sh: l.scrollHeight, ch: l.clientHeight };
});
check('前置：消息列表已溢出可滚', box.overflows, JSON.stringify(box));

const zoomBefore = await page.evaluate(() => workflow.camera.zoom);
// agentRenderChat 会把列表滚到底，故 st0 已是最大值；向上滚轮应让 scrollTop 减小（preventDefault 时不会变）
const st0 = await page.evaluate(() => document.getElementById('agentChatList').scrollTop);
await page.mouse.move(box.x, box.y);
await page.mouse.wheel(0, -400);
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({ st: document.getElementById('agentChatList').scrollTop, zoom: workflow.camera.zoom }));
check('抽屉内向上滚轮→列表 scrollTop 减小（能往上翻看历史）', after.st < st0 - 1, `st0=${st0} st=${after.st}`);
check('抽屉内滚轮→画布 zoom 不变（不再误缩放）', Math.abs(after.zoom - zoomBefore) < 1e-9, `before=${zoomBefore} after=${after.zoom}`);

// 对照：在画布空白处滚轮仍应缩放（证明没把画布缩放改坏）
await page.mouse.move(500, 600);
const zoomC0 = await page.evaluate(() => workflow.camera.zoom);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(150);
const zoomC1 = await page.evaluate(() => workflow.camera.zoom);
check('对照：画布空白处滚轮仍缩放（能力未退化）', Math.abs(zoomC1 - zoomC0) > 1e-9, `${zoomC0} -> ${zoomC1}`);

check('全程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`\nverify-agent-drawer-scroll: ${checks.filter((c) => c.p).length}/${checks.length} 通过`);
await browser.close(); server.close();
process.exit(checks.every((c) => c.p) ? 0 : 1);
