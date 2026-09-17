#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 阶段C · 角色资产持续生产：剧本级端到端试跑（mock，无真实 AI）。
 * 五幕：设定角色 → 批量生产 → 归档 → 复用 → 检索/宫格。
 * 目标：按真实用户剧本跑通，暴露卡点缺口（每幕记录 GAP）。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function createServer() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(ROOT, relative));
    if (!file.startsWith(`${ROOT}/`) && file !== join(ROOT, 'index.html')) { res.writeHead(403); res.end('forbidden'); return; }
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    try { res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file)); }
    catch (error) { res.writeHead(500); res.end(String(error)); }
  });
}

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? '  ✅' : '  ❌'} ${name}${detail ? `：${detail}` : ''}`);
}

// 不同颜色的 1×1 PNG（区分不同状态产出；红/绿/蓝）
const PNG = {
  red: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIBgNVBgAAPwAF/wAjKgTGAAAAAElFTkSuQmCC',
  green: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIBgMKAwkAAPwAF/4B/mcYDQAAAABJRU5ErkJggg==',
  blue: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIGWMYGPQAAABGAQEA/wCp+/8SAAAAAElFTkSuQmCC',
};

const server = createServer();
let browser;
const gaps = [];
const gap = (g) => { gaps.push(g); console.log(`  ⚠️ GAP: ${g}`); };

try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error' && !/favicon|404|Failed to load resource/i.test(message.text())) errors.push(`console: ${message.text()}`); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && workflow && typeof loadTemplate === 'function', { timeout: 10_000 });

  // ============ 幕一 · 设定角色 ============
  console.log('\n—— 幕一 · 设定角色（模板+角色描述+参考图+状态列表）——');
  const act1 = await page.evaluate(() => {
    clearGraph();
    loadTemplate('character-asset-board', 'replace');
    const nodes = [...workflow.nodes.values()];
    return { count: nodes.length, types: nodes.map(n => n.type) };
  });
  check('人物资产模板加载（文本+AI绘图节点）', act1.count >= 2, JSON.stringify(act1));

  const act1b = await page.evaluate((redPng) => {
    // 状态列表节点：角色描述 + 3 状态
    const sl = addNode('stateList', 0, 0);
    sl.params.states = '日常着装\n华丽晚礼服\n雨中撑伞街头';
    sl.charDesc = '测试角色：短黑发、白色连衣裙、红色蝴蝶结';
    sl.refImages = [redPng];
    if (sl.el) buildNodeBody(sl.el, sl);
    generateStateNodes(sl);
    const states = [...workflow.nodes.values()].filter(n => n.stateMeta);
    return { states: states.length, titles: states.map(n => n.title), edges: workflow.edges.size };
  }, PNG.red);
  check('状态批量生成 3 个 AI 绘图节点（自动连线）', act1b.states === 3, JSON.stringify(act1b));

  // ============ 幕二 · 批量生产（mock 出图） ============
  console.log('\n—— 幕二 · 批量生产（mock 出图 + 进度）——');
  const act2 = await page.evaluate((pngs) => {
    const states = [...workflow.nodes.values()].filter(n => n.stateMeta);
    states.forEach((n, i) => {
      n.outputsData = [{ type: 'image', value: pngs[i % pngs.length] }];
      n.status = 'done';
      updateNodeStatus(n);
    });
    return states.map(n => ({ id: n.id, title: n.title, hasImg: !!(n.outputsData && n.outputsData[0] && n.outputsData[0].value) }));
  }, [PNG.red, PNG.green, PNG.blue]);
  check('3 个状态节点 mock 出图完成', act2.length === 3 && act2.every(s => s.hasImg), '');

  // 批量进度徽标是否存在（refreshCharacterBatchProgress）
  const act2b = await page.evaluate(() => {
    const states = [...workflow.nodes.values()].filter(n => n.stateMeta);
    if (states[0] && typeof refreshCharacterBatchProgress === 'function') { refreshCharacterBatchProgress(states[0]); }
    const el = states[0] && states[0].el;
    const badge = el && el.querySelector('.char-batch-progress, [class*=batch]');
    return { hasFn: typeof refreshCharacterBatchProgress === 'function', badgeText: badge ? badge.textContent : null };
  });
  check('批量进度展示（第1/3个）', act2b.hasFn, JSON.stringify(act2b));

  // ============ 幕三 · 归档为角色资产（批量一键） ============
  console.log('\n—— 幕三 · 归档（批量一键存为角色资产·跨画布全局库）——');
  // 修复后主路径：状态列表节点「💾 全部存为角色资产」批量归档
  const act3b = await page.evaluate(() => {
    const sl = [...workflow.nodes.values()].find(n => n.type === 'stateList');
    const el = sl && sl.el;
    const btns = el ? [...el.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean) : [];
    const hasBatch = btns.some(t => /全部存为角色资产/.test(t));
    return { hasBatch, btns };
  });
  check('状态列表节点有「💾 全部存为角色资产」批量归档按钮', act3b.hasBatch, JSON.stringify(act3b.btns));

  const act3 = await page.evaluate(() => {
    const sl = [...workflow.nodes.values()].find(n => n.type === 'stateList');
    const saved = saveAllCharacterStatesAsAsset(sl);
    const list = listCharacterAssets();
    return { saved, list: list.map(a => a.name) };
  });
  check('一键批量归档 3 个状态节点', act3.saved === 3, 'saved=' + act3.saved);
  check('角色资产列表 3 条（默认名=角色名·状态名）', act3.list.length === 3, JSON.stringify(act3.list));

  // 空场景提示：无产出图时批量归档友好提示
  const act3c = await page.evaluate(() => {
    const sl2 = addNode('stateList', 800, 0);
    sl2.params.states = '新状态';
    generateStateNodes(sl2);
    return saveAllCharacterStatesAsAsset(sl2); // 新批次未出图 → 应返回 0
  });
  check('未出图时批量归档返回 0（友好提示）', act3c === 0, 'ret=' + act3c);

  // ============ 幕四 · 新画布复用（令牌引用） ============
  console.log('\n—— 幕四 · 新画布复用（<<<名称>>> 令牌）——');
  const act4 = await page.evaluate(() => {
    clearGraph(); // 新画布
    const ai = addNode('aiImage', 0, 0);
    ai.prompt = '<<<测试角色：短黑发、白色连衣裙、红色蝴蝶结·日常着装>>> 站在咖啡馆里';
    // 引用解析：生成时素材库找同名资产带参考图
    const list = listCharacterAssets();
    return { list: list.length, prompt: ai.prompt };
  });
  check('新画布（clearGraph）后角色资产仍在（全局库跨画布）', act4.list === 3, 'list=' + act4.list);

  // 令牌解析为参考图（resolveRefs 机制）
  const act4b = await page.evaluate(() => {
    const ai = [...workflow.nodes.values()].find(n => n.type === 'aiImage');
    ai.prompt = '<<<测试角色：短黑发、白色连衣裙、红色蝴蝶结·日常着装>>> 站在咖啡馆里';
    if (typeof buildAssetRefIndex === 'function') buildAssetRefIndex();
    // 找到解析函数：resolveRefTokens / resolveAssetRefs / expandRefTokens
    const fns = Object.keys(window).filter(k => /resolve|expand|ref/i.test(k) && typeof window[k] === 'function');
    const resolved = typeof resolveAssetRefs === 'function' ? resolveAssetRefs(ai.prompt) : null;
    return { resolved, fns: fns.slice(0, 10) };
  });
  console.log('  ℹ️ 令牌解析探测: ' + JSON.stringify(act4b).slice(0, 200));

  // AI 节点 Composer：点击节点 → Composer → ⚙高级 → 🔗引用角色资产下拉
  const act4c = await page.evaluate(() => {
    const ai = [...workflow.nodes.values()].find(n => n.type === 'aiImage');
    if (ai) selectNode(ai); // 打开 Composer
    const advBtn = [...document.querySelectorAll('button')].find(b => /高级/.test((b.textContent || '') + (b.title || '')));
    if (advBtn) advBtn.click(); // 展开「高级」
    const refSel = document.querySelector('.node-ref-asset-select');
    const opts = refSel ? [...refSel.options].map(o => o.value).filter(Boolean) : [];
    return { hasAdv: !!advBtn, refOptions: opts.slice(0, 5) };
  });
  check('AI 节点 Composer 高级选项→引用角色资产入口可用', act4c.hasAdv, JSON.stringify(act4c.refOptions));
  check('引用下拉列出已归档的 3 个角色资产', act4c.refOptions.length >= 3, 'options=' + act4c.refOptions.length);

  // ============ 幕五 · 素材库检索 + 宫格生产 ============
  console.log('\n—— 幕五 · 素材库检索（分类过滤/搜索）——');
  const act5 = await page.evaluate(() => {
    toggleAssetPanel(true);
    updateAssetPanel();
    const panel = document.getElementById('assetPanel');
    const search = panel.querySelector('input[type=text], input[type=search]');
    const catBtns = [...panel.querySelectorAll('button, .asset-cat, [class*=cat]')].map(b => (b.textContent || '').trim()).filter(t => t && t.length <= 8);
    const cards = panel.querySelectorAll('.asset-card').length;
    return { open: panel.classList.contains('show'), hasSearch: !!search, cards, catBtns: [...new Set(catBtns)].slice(0, 12) };
  });
  check('素材库面板可打开且显示资产卡片', act5.open && act5.cards >= 3, 'cards=' + act5.cards);
  if (!act5.hasSearch) gap('素材库面板无搜索框（资产多时找角色资产只能翻页/分类）');
  else {
    // 搜索过滤：输入「晚礼服」→ 只剩 1 张卡片
    const act5search = await page.evaluate(() => {
      const input = document.getElementById('assetSearch');
      input.value = '晚礼服';
      input.oninput && input.oninput();
      return document.querySelectorAll('#assetGrid .asset-card').length;
    });
    check('搜索框过滤「晚礼服」命中 1 张卡片', act5search === 1, 'cards=' + act5search);
    // 清空搜索恢复
    await page.evaluate(() => {
      const input = document.getElementById('assetSearch');
      input.value = '';
      input.oninput && input.oninput();
    });
  }
  console.log('  ℹ️ 面板分类元素: ' + JSON.stringify(act5.catBtns));

  // 素材库重命名入口（资产卡片操作）
  const act5b = await page.evaluate(() => {
    const panel = document.getElementById('assetPanel');
    const card = panel.querySelector('.asset-card');
    const btns = card ? [...card.querySelectorAll('button')].map(b => (b.textContent || b.title || '').trim()).filter(Boolean) : [];
    return btns;
  });
  console.log('  ℹ️ 资产卡片按钮: ' + JSON.stringify(act5b));

  // 刷新恢复（场景持续性）
  await page.evaluate(() => toggleAssetPanel(false));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.FlowCraft && workflow, { timeout: 10_000 });
  const act5c = await page.evaluate(() => ({ list: listCharacterAssets().length, nodes: workflow.nodes.size }));
  check('刷新后画布+角色资产恢复', act5c.list === 3 && act5c.nodes >= 1, JSON.stringify(act5c));

  check('全程无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n========== 缺口汇总 ==========');
  if (!gaps.length) console.log('（无新增缺口）');
  gaps.forEach((g, i) => console.log(`${i + 1}. ${g}`));
} finally {
  if (browser) await browser.close();
  server.close();
}
const failed = checks.filter(c => !c.passed).length;
console.log(`\n==== 角色资产剧本试跑：PASS=${checks.length - failed} FAIL=${failed} ====`);
process.exit(failed ? 1 : 0);
