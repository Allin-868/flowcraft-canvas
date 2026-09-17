#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * #2 工具确认全局开关（Agent 安全闸门）专项回归。
 * 验证：
 *   1) 默认开启（localStorage 空 → getToolConfirm()=true，按钮显示「开」）
 *   2) 点击开关 → 关闭并持久化（'0'），按钮显示「关」
 *   3) 关闭时 confirmAgentTool 直接放行（不调 window.confirm）
 *   4) 开启时 confirmAgentTool 调用 window.confirm：拒绝→false / 允许→true
 *   5) 持久化状态被正确读写
 * 不填写真实 Key、不请求真实 AI 服务。
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

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && typeof confirmAgentTool === 'function', { timeout: 10_000 });
  check('当前构建产物加载且无运行时错误', errors.length === 0, errors.join(' | '));

  // —— 场景 1：默认开启 ——
  const s1 = await page.evaluate(() => {
    localStorage.removeItem('fc_tool_confirm');
    const btn = document.getElementById('toolConfirmToggle');
    return {
      get: getToolConfirm(),
      btnText: btn.textContent,
      ariaChecked: btn.getAttribute('aria-checked')
    };
  });
  check('默认开启（getToolConfirm=true）', s1.get === true);
  check('按钮显示「开」且 aria-checked=true', s1.btnText === '开' && s1.ariaChecked === 'true', `${s1.btnText}/${s1.ariaChecked}`);

  // —— 场景 2：点击关闭 → 持久化 ——
  const s2 = await page.evaluate(() => {
    document.getElementById('toolConfirmToggle').click();
    const btn = document.getElementById('toolConfirmToggle');
    return {
      get: getToolConfirm(),
      stored: localStorage.getItem('fc_tool_confirm'),
      btnText: btn.textContent,
      ariaChecked: btn.getAttribute('aria-checked')
    };
  });
  check('点击后关闭（getToolConfirm=false）', s2.get === false);
  check('持久化写入 0', s2.stored === '0', 'stored=' + s2.stored);
  check('按钮显示「关」', s2.btnText === '关' && s2.ariaChecked === 'false', `${s2.btnText}/${s2.ariaChecked}`);

  // —— 场景 3：关闭时 confirmAgentTool 直接放行且不调 confirm ——
  const s3 = await page.evaluate(async () => {
    let confirmCalls = 0;
    const orig = window.confirm;
    window.confirm = () => { confirmCalls += 1; return true; };
    const allow = await confirmAgentTool('测试操作（关闭态）');
    window.confirm = orig;
    return { allow, confirmCalls };
  });
  check('关闭态：confirmAgentTool 直接放行（true）', s3.allow === true);
  check('关闭态：未调用 window.confirm', s3.confirmCalls === 0, 'calls=' + s3.confirmCalls);

  // —— 场景 4：开启时 confirmAgentTool 走确认：拒绝 / 允许 ——
  const s4 = await page.evaluate(async () => {
    setToolConfirm(true);
    let confirmCalls = 0;
    let lastDesc = '';
    const orig = window.confirm;
    window.confirm = (msg) => { confirmCalls += 1; lastDesc = msg; return false; };
    const deny = await confirmAgentTool('删除 3 个节点');
    const denyCalls = confirmCalls;
    window.confirm = () => { confirmCalls += 1; return true; };
    const allow = await confirmAgentTool('生成 4 张图');
    const allowCalls = confirmCalls - denyCalls;
    window.confirm = orig;
    return { deny, allow, denyCalls, allowCalls, lastDesc };
  });
  check('开启态：拒绝确认 → 放行结果 false', s4.deny === false);
  check('开启态：允许确认 → 放行结果 true', s4.allow === true);
  check('开启态：每次都调用 confirm（各 1 次）', s4.denyCalls === 1 && s4.allowCalls === 1, `deny=${s4.denyCalls} allow=${s4.allowCalls}`);
  check('确认文案包含操作描述与安全提示', /删除 3 个节点/.test(s4.lastDesc) && /Agent/.test(s4.lastDesc), s4.lastDesc.slice(0, 40));

  // —— 场景 5：持久化状态读写 ——
  const s5 = await page.evaluate(() => {
    localStorage.setItem('fc_tool_confirm', '0');
    const off = getToolConfirm();
    localStorage.setItem('fc_tool_confirm', '1');
    const on = getToolConfirm();
    localStorage.removeItem('fc_tool_confirm');
    const def = getToolConfirm();
    return { off, on, def };
  });
  check('持久化：存 0 → 关；存 1 → 开；空 → 默认开', s5.off === false && s5.on === true && s5.def === true, JSON.stringify(s5));

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[tool-confirm] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[tool-confirm] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[tool-confirm] PASS（未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
