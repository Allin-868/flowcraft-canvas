#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * #1 Agent 全站助手抽屉（连接/对话/历史/日志）专项回归。
 * 验证：
 *   1) 开关按钮打开抽屉（4 Tab 齐全）
 *   2) Tab 切换正确
 *   3) 方式一连接：mock 提供方 + 拦截 /models → 连接成功、状态点变绿、连接状态持久化
 *   4) 方式二临时连接：填临时端点 → 测试成功
 *   5) 对话：拦截 chat/completions 返回 SSE → 用户消息渲染 + 流式回复 + 会话落库 + 请求含画布上下文
 *   6) 历史：会话出现在历史列表，点击可载入
 *   7) 日志：操作被记录
 *   8) 新对话清空消息；工具确认镜像开关与 #2 同源
 * 不填写真实 Key、不请求真实 AI 服务（全程 mock）。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function createServer() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(ROOT, relative));
    if (!file.startsWith(`${ROOT}/`) && file !== join(ROOT, 'index.html')) { res.writeHead(403); res.end('forbidden'); return; }
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    try {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
}

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? '  ✅' : '  ❌'} ${name}${detail ? `：${detail}` : ''}`);
}

const server = createServer();
let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|404|Failed to load resource/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });

  // 拦截 /models 与 /chat/completions
  await page.route('**/models', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'list', data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }, { id: 'gpt-5.6-sol' }] }) });
  });
  let chatBody = null;
  await page.route('**/chat/completions', (route) => {
    const req = route.request();
    chatBody = req.postDataJSON ? req.postDataJSON() : null;
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"你好，"}}]}\n\ndata: {"choices":[{"delta":{"content":"我能看到画布。"}}]}\n\ndata: [DONE]\n\n'
    });
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && typeof agentSwitchTab === 'function', { timeout: 10_000 });
  check('当前构建产物加载且无运行时错误', errors.length === 0, errors.join(' | '));

  // 预置一个 mock 提供方
  await page.evaluate(() => {
    setProviders([{ id: 'prov-test', name: 'TestProvider', base: 'http://mock.local/v1', key: 'sk-test', model: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o'] }]);
  });

  // —— 场景 1：打开抽屉 + 4 Tab ——
  const s1 = await page.evaluate(() => {
    document.getElementById('agentToggleBtn').click();
    const drawer = document.getElementById('agentDrawer');
    return {
      visible: !drawer.hidden,
      tabs: [...document.querySelectorAll('.agent-tab')].map(b => b.getAttribute('data-agent-tab')),
      connPaneVisible: !document.querySelector('[data-agent-pane="conn"]').hidden
    };
  });
  check('点击开关打开 Agent 抽屉', s1.visible);
  check('4 Tab 齐全（连接/对话/历史/日志）', JSON.stringify(s1.tabs) === JSON.stringify(['conn', 'chat', 'hist', 'log']), s1.tabs.join(','));
  check('默认显示「连接」页', s1.connPaneVisible);

  // —— 场景 2：Tab 切换 ——
  const s2 = await page.evaluate(() => {
    document.querySelector('[data-agent-tab="chat"]').click();
    const chatVisible = !document.querySelector('[data-agent-pane="chat"]').hidden;
    const connHidden = document.querySelector('[data-agent-pane="conn"]').hidden;
    document.querySelector('[data-agent-tab="hist"]').click();
    const histVisible = !document.querySelector('[data-agent-pane="hist"]').hidden;
    document.querySelector('[data-agent-tab="log"]').click();
    const logVisible = !document.querySelector('[data-agent-pane="log"]').hidden;
    document.querySelector('[data-agent-tab="conn"]').click();
    return { chatVisible, connHidden, histVisible, logVisible };
  });
  check('Tab 切换：对话/历史/日志页正确显示', s2.chatVisible && s2.connHidden && s2.histVisible && s2.logVisible);

  // —— 场景 3：方式一连接（mock /models）——
  const s3 = await page.evaluate(async () => {
    document.getElementById('agentProviderSelect').value = 'prov-test';
    document.getElementById('agentConnectBtn').click();
    await new Promise((r) => setTimeout(r, 600));
    const conn = agentConnState();
    const dot = document.getElementById('agentConnDot');
    return { conn, dotClass: dot.className, connText: document.getElementById('agentConnText').textContent };
  });
  check('方式一连接成功：连接状态持久化', !!s3.conn && s3.conn.base === 'http://mock.local/v1' && s3.conn.model === 'gpt-4o-mini', JSON.stringify(s3.conn && { base: s3.conn.base, model: s3.conn.model }));
  check('状态点变绿（ok）且文案为已连接', /ok/.test(s3.dotClass) && s3.connText === '已连接', `${s3.dotClass}/${s3.connText}`);

  // —— 场景 4：方式二临时连接 ——
  const s4 = await page.evaluate(async () => {
    document.getElementById('agentTempBase').value = 'http://temp.local';
    document.getElementById('agentTempKey').value = 'sk-temp';
    document.getElementById('agentTempModel').value = 'temp-model-1';
    document.getElementById('agentTempTestBtn').click();
    await new Promise((r) => setTimeout(r, 600));
    const conn = agentConnState();
    return { base: conn && conn.base, model: conn && conn.model, text: document.getElementById('agentConnText').textContent };
  });
  check('方式二临时连接成功', s4.base === 'http://temp.local/v1' && s4.model === 'temp-model-1', JSON.stringify(s4));

  // —— 场景 5：对话（mock SSE）——
  const s5 = await page.evaluate(async () => {
    document.querySelector('[data-agent-tab="chat"]').click();
    const ta = document.getElementById('agentChatInput');
    ta.value = '分析一下当前画布';
    document.getElementById('agentChatSend').click();
    await new Promise((r) => setTimeout(r, 1200));
    const msgs = window.__agentMessages || [];
    const listText = document.getElementById('agentChatList').textContent;
    return {
      userShown: listText.includes('分析一下当前画布'),
      aiShown: listText.includes('我能看到画布'),
      msgCount: msgs.length,
      sessions: (JSON.parse(localStorage.getItem('fc_agent_sessions') || '[]') || []).length
    };
  });
  check('对话：用户消息渲染', s5.userShown);
  check('对话：流式回复渲染（含 Agent 文本）', s5.aiShown);
  check('对话：消息落库（user+assistant）', s5.msgCount >= 2, 'count=' + s5.msgCount);
  check('对话：请求体含画布上下文 system prompt',
    !!chatBody && Array.isArray(chatBody.messages) && /当前画布状态/.test(chatBody.messages[0].content || ''),
    chatBody ? (chatBody.messages && chatBody.messages[0].content || '').slice(0, 40) : 'no body');
  check('对话：会话已保存到历史', s5.sessions >= 1, 'sessions=' + s5.sessions);

  // —— 场景 6：历史列表 + 载入 ——
  const s6 = await page.evaluate(async () => {
    document.querySelector('[data-agent-tab="hist"]').click();
    const items = document.querySelectorAll('.agent-hist-item');
    const firstTitle = items[0] ? items[0].querySelector('.agent-hist-title').textContent : '';
    if (items[0]) items[0].click();
    const chatVisible = !document.querySelector('[data-agent-pane="chat"]').hidden;
    const msgs = window.__agentMessages || [];
    return { itemCount: items.length, firstTitle, chatVisible, msgsAfterLoad: msgs.length };
  });
  check('历史列表显示会话', s6.itemCount >= 1, 'items=' + s6.itemCount);
  check('历史标题为首条用户消息', /分析一下当前画布/.test(s6.firstTitle), s6.firstTitle);
  check('点击历史载入会话并切回对话页', s6.chatVisible && s6.msgsAfterLoad >= 2);

  // —— 场景 7：日志 ——
  const s7 = await page.evaluate(() => {
    document.querySelector('[data-agent-tab="log"]').click();
    const text = document.getElementById('agentLogList').textContent;
    return { hasConn: /连接成功/.test(text), hasUser: /用户：/.test(text), hasAgent: /Agent：/.test(text) };
  });
  check('日志记录连接/用户/Agent 事件', s7.hasConn && s7.hasUser && s7.hasAgent);

  // —— 场景 8：新对话 + 工具确认镜像开关 ——
  const s8 = await page.evaluate(() => {
    document.getElementById('agentNewBtn').click();
    const msgs = window.__agentMessages || [];
    const chatEmpty = document.getElementById('agentChatEmpty');
    const emptyVisible = chatEmpty ? chatEmpty.style.display !== 'none' : false;
    const tc = document.getElementById('agentToolConfirmToggle');
    const before = getToolConfirm();
    tc.click();
    const after = getToolConfirm();
    const btnText = tc.textContent;
    return { msgCount: msgs.length, emptyVisible, before, after, btnText };
  });
  check('新对话清空消息并回到对话页', s8.msgCount === 0 && s8.emptyVisible,
    JSON.stringify({ msgCount: s8.msgCount, emptyVisible: s8.emptyVisible }));
  check('工具确认镜像开关与 #2 同源（点击翻转）', s8.before === true && s8.after === false && s8.btnText === '关', JSON.stringify({ before: s8.before, after: s8.after, btn: s8.btnText }));

  // —— 场景 9：CORS 探测失败时仍信任配置（黄色 已连接(探测受限)）——
  await page.unroute('**/models');
  await page.route('**/models', (route) => route.abort('failed'));
  const s9 = await page.evaluate(async () => {
    setProviders([{ id: 'prov-cors', name: 'CORSProvider', base: 'http://cors.local', key: 'sk-cors', model: 'gpt-cors-1' }]);
    setToolConfirm(true);
    // 🤖 现在是显隐切换：仅在隐藏时点击打开；打开时刷新提供方下拉
    if (document.getElementById('agentDrawer').hidden) document.getElementById('agentToggleBtn').click();
    agentFillProviders();
    await new Promise((r) => setTimeout(r, 200));
    document.getElementById('agentProviderSelect').value = 'prov-cors';
    document.getElementById('agentConnectBtn').click();
    await new Promise((r) => setTimeout(r, 600));
    const conn = agentConnState();
    const dot = document.getElementById('agentConnDot');
    return {
      connected: !!conn && conn.base === 'http://cors.local/v1' && conn.corsWarning === true,
      dotClass: dot.className,
      connText: document.getElementById('agentConnText').textContent
    };
  });
  check('CORS 阻断时仍信任配置并标记为「已连接(探测受限)」', s9.connected, JSON.stringify(s9));
  check('状态点为黄色 warn（不是红 err）', /warn/.test(s9.dotClass), s9.dotClass);

  // —— 场景 10：无代理 + chat fetch CORS 阻断 → 给出明确引导 ——
  await page.unroute('**/chat/completions');
  await page.route('**/chat/completions', (route) => route.abort('failed'));
  const s10 = await page.evaluate(async () => {
    document.querySelector('[data-agent-tab="chat"]').click();
    await new Promise((r) => setTimeout(r, 150));
    const ta = document.getElementById('agentChatInput');
    ta.value = '试探';
    document.getElementById('agentChatSend').click();
    await new Promise((r) => setTimeout(r, 700));
    const bubbleText = (document.querySelector('.agent-msg.ai .agent-msg-bubble') || {}).textContent || '';
    const proxyOn = !!window.FlowCraft && window.FlowCraft.proxy && typeof window.FlowCraft.proxy.enabled === 'function' && window.FlowCraft.proxy.enabled();
    return { bubbleText, proxyOn };
  });
  check('无代理时对话 CORS 阻断 → 错误提示含「CORS」和「代理」', /CORS/.test(s10.bubbleText) && /代理/.test(s10.bubbleText), s10.bubbleText.slice(0, 80));

  // —— 场景 11：与 AI 设计助手互斥打开 ——
  const s11 = await page.evaluate(() => {
    const ensureOpen = () => { if (document.getElementById('agentDrawer').hidden) document.getElementById('agentToggleBtn').click(); };
    // 打开 Agent 抽屉
    ensureOpen();
    const drawerVisible = !document.getElementById('agentDrawer').hidden;
    // 打开 AI 面板 → Agent 抽屉应收起
    document.getElementById('aiToggleBtn').click();
    const drawerHiddenAfterAI = document.getElementById('agentDrawer').hidden;
    const aiOpen = !document.getElementById('aiPanel').classList.contains('collapsed');
    // 再开 Agent 抽屉 → AI 面板应收起
    ensureOpen();
    const drawerVisibleAgain = !document.getElementById('agentDrawer').hidden;
    const aiCollapsed = document.getElementById('aiPanel').classList.contains('collapsed');
    return { drawerVisible, drawerHiddenAfterAI, aiOpen, drawerVisibleAgain, aiCollapsed };
  });
  check('互斥：Agent 抽屉可打开', s11.drawerVisible);
  check('互斥：打开 AI 面板 → Agent 抽屉收起', s11.drawerHiddenAfterAI && s11.aiOpen);
  check('互斥：再开 Agent 抽屉 → AI 面板收起', s11.drawerVisibleAgain && s11.aiCollapsed);

  // —— 场景 12：与 AI 助手同尺寸同默认位置 + 可拖拽 + 可缩放 ——
  const s12 = await page.evaluate(async () => {
    if (document.getElementById('agentDrawer').hidden) document.getElementById('agentToggleBtn').click();
    await new Promise((r) => setTimeout(r, 150));
    const drawer = document.getElementById('agentDrawer');
    const rect0 = drawer.getBoundingClientRect();
    const defaultMatch = Math.abs(rect0.top - 92) <= 2
      && Math.abs(window.innerWidth - rect0.right - 8) <= 2
      && Math.abs(rect0.width - 380) <= 2
      && Math.abs(rect0.height - 540) <= 2;
    // 拖拽：header mousedown → document mousemove → mouseup
    const header = drawer.querySelector('.agent-drawer-head');
    const hx = rect0.left + 100, hy = rect0.top + 10;
    header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: hx, clientY: hy, button: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: hx + 60, clientY: hy + 40 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    const moved = drawer.style.left !== '' && drawer.style.top !== '';
    // 缩放：resizer mousedown → mousemove → mouseup（期望 380→440）
    const resizer = document.getElementById('agentResizer');
    const rr = resizer.getBoundingClientRect();
    resizer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rr.left + 5, clientY: rr.top + 5, button: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: rr.left + 65, clientY: rr.top + 65 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    const resizedW = parseFloat(drawer.style.width) || 0;
    return { defaultMatch, moved, resizedOk: Math.abs(resizedW - 440) <= 2, width: resizedW };
  });
  check('默认位置与尺寸与 AI 助手一致（top92/right8/380×540）', s12.defaultMatch, JSON.stringify({ t: s12.top, w: s12.width }));
  check('拖拽 header 可移动面板', s12.moved);
  check('右下角把手可缩放（380→440）', s12.resizedOk, 'width=' + s12.width);

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[agent-drawer] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[agent-drawer] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[agent-drawer] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
