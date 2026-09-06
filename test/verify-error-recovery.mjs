// 冒烟：错误分类与恢复引导（P1-4）——classifyNodeError 分类矩阵 + localizeError 友好文案 + 恢复动作按钮 + 设置引导
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const INDEX = fileURLToPath(new URL('../index.html', import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// ===== A. classifyNodeError 分类矩阵（纯逻辑，无副作用）=====
const cats = await page.evaluate(() => {
  const mk = (reason) => ({ failureReason: reason, _lastError: reason });
  return {
    nokey: classifyNodeError(mk('尚未配置 OpenAI API Key：请打开 AI 助手面板')),
    auth: classifyNodeError(mk('HTTP 401: invalid api key')),
    quota: classifyNodeError(mk('HTTP 429: rate limit exceeded')),
    param: classifyNodeError(mk('HTTP 400: 当前模型不支持此比例')),
    network: classifyNodeError(mk('Failed to fetch')),
    timeout: classifyNodeError(mk('request timeout')),
    content: classifyNodeError(mk('content policy violation')),
    unknown: classifyNodeError(mk('weird unclassified thing')),
  };
});
ok('未配置→no-key/打开设置/settings', cats.nokey.category === 'no-key' && cats.nokey.actionKind === 'settings' && cats.nokey.actionLabel === '打开设置', cats.nokey);
ok('401→auth/打开设置/settings', cats.auth.category === 'auth' && cats.auth.actionKind === 'settings', cats.auth);
ok('429→quota/打开设置/settings', cats.quota.category === 'quota' && cats.quota.actionKind === 'settings', cats.quota);
ok('400→param/编辑参数/composer', cats.param.category === 'param' && cats.param.actionKind === 'composer' && cats.param.actionLabel === '编辑参数', cats.param);
ok('Failed to fetch→network/重试/retry', cats.network.category === 'network' && cats.network.actionKind === 'retry', cats.network);
ok('timeout→timeout/重试/retry', cats.timeout.category === 'timeout' && cats.timeout.actionKind === 'retry', cats.timeout);
ok('content policy→content/编辑提示词/composer', cats.content.category === 'content' && cats.content.actionKind === 'composer', cats.content);
ok('未识别→unknown/重试/retry', cats.unknown.category === 'unknown' && cats.unknown.actionKind === 'retry', cats.unknown);

// ===== B. 渲染：英文报错经 localizeError 翻译成中文友好文案 + 动作按钮 =====
const gid = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const n = editor.addNode('aiImage', 300, 260);
  window.buildNodeBody(n.el, n);
  return n.id;
});
await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  window.setNodeStatus(n, 'error', 'HTTP 401: invalid api key');
  window.updateNodeStatus(n);
}, gid);
await page.waitForTimeout(150);
const rend = await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  const box = n.el.querySelector('.node-error-reason');
  const msg = box && box.querySelector('.node-error-msg');
  const act = box && box.querySelector('.node-error-action');
  return { msgText: msg && msg.textContent, msgTitle: msg && msg.title, actionText: act && act.textContent };
}, gid);
ok('英文 401 被 localizeError 翻译成中文友好文案', /鉴权失败/.test(rend.msgText || ''), rend.msgText);
ok('原始诊断保留在 msg.title', (rend.msgTitle || '').indexOf('HTTP 401: invalid api key') >= 0, rend.msgTitle);
ok('auth 类给出「打开设置」恢复按钮', rend.actionText === '打开设置', rend.actionText);

// ===== C. 恢复动作：点击「打开设置」触发设置引导（toggleAIPanel + toast）=====
await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  const btn = n.el.querySelector('.node-error-action');
  if (btn) btn.click();
}, gid);
await page.waitForTimeout(250);
const toast = await page.evaluate(() => {
  const c = document.getElementById('toastContainer');
  return c ? c.textContent : '';
});
ok('点击「打开设置」触发设置引导 toast', /API Key|⚙/.test(toast), toast.slice(0, 80));

// ===== D. 完成态清除失败卡片 =====
await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  window.setNodeStatus(n, 'done');
  window.updateNodeStatus(n);
}, gid);
await page.waitForTimeout(150);
const cleared = await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  return { gone: !n.el.querySelector('.node-error-reason') };
}, gid);
ok('完成后失败卡片移除', cleared.gone === true, cleared);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 错误分类与恢复引导冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
