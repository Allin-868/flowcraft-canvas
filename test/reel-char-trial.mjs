#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 阶段C·C3 演示 reel：mock 走完角色资产五幕剧本并逐幕截图，产出招募/试用演示素材。
 * 不调真实 AI；截图存 过程笔记/测试产物/char-trial-reel/。
 */
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const OUT = join(PROJECT, '过程笔记', '测试产物', 'char-trial-reel');
mkdirSync(OUT, { recursive: true });

const PNG = {
  red: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIBgNVBgAAPwAF/wAjKgTGAAAAAElFTkSuQmCC',
  green: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIBgMKAwkAAPwAF/4B/mcYDQAAAABJRU5ErkJggg==',
  blue: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIGWMYGPQAAABGAQEA/wCp+/8SAAAAAElFTkSuQmCC',
};

const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(join(ROOT, 'index.html'))); });
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');
const shot = (n) => page.screenshot({ path: join(OUT, n) });

// 幕一 设定角色
await page.evaluate((red) => {
  clearGraph();
  const sl = addNode('stateList', 60, 60);
  sl.charDesc = '测试角色：短黑发、白色连衣裙、红色蝴蝶结';
  sl.refImages = [red];
  sl.params.states = '日常着装\n华丽晚礼服\n雨中撑伞街头';
  if (sl.el) buildNodeBody(sl.el, sl);
  generateStateNodes(sl);
}, PNG.red);
await page.waitForTimeout(400);
await shot('act1-setup.png');
console.log('act1-setup.png');

// 幕二 批量生产（mock 出图）
await page.evaluate((pngs) => {
  [...workflow.nodes.values()].filter(n => n.stateMeta).forEach((n, i) => {
    n.outputsData = [{ type: 'image', value: pngs[i % 3] }];
    n.status = 'done'; updateNodeStatus(n);
  });
}, [PNG.red, PNG.green, PNG.blue]);
await page.waitForTimeout(400);
await shot('act2-produced.png');
console.log('act2-produced.png');

// 幕三 一键归档
await page.evaluate(() => {
  const sl = [...workflow.nodes.values()].find(n => n.type === 'stateList');
  saveAllCharacterStatesAsAsset(sl);
});
await page.waitForTimeout(400);
await shot('act3-archived.png');
console.log('act3-archived.png');

// 幕四 新画布复用（Composer 引用）
await page.evaluate(() => {
  clearGraph();
  const ai = addNode('aiImage', 200, 120);
  selectNode(ai);
  const adv = [...document.querySelectorAll('button')].find(b => /高级/.test((b.textContent || '') + (b.title || '')));
  if (adv) adv.click();
});
await page.waitForTimeout(300);
await shot('act4-reuse.png');
console.log('act4-reuse.png');

// 幕五 素材库检索
await page.evaluate(() => { toggleAssetPanel(true); updateAssetPanel(); });
await page.waitForTimeout(300);
await page.evaluate(() => { const i = document.getElementById('assetSearch'); if (i) { i.value = '晚礼服'; i.oninput && i.oninput(); } });
await page.waitForTimeout(300);
await shot('act5-search.png');
console.log('act5-search.png');

await browser.close(); server.close();
console.log('reel 完成 →', OUT);
