#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 模型提供方「识别当前供方模型 / 获取并选择模型添加」专项回归。
 * 通过 page.route 拦截「/models」端点，按 mode 模拟不同服务端行为，验证：
 *   1) 点「获取模型」后拉到模型并渲染勾选列表（正常）
 *   2) 勾选部分模型后「添加」能把所选模型与默认模型写进提供方
 *   3) 空模型返回 → 友好提示，不崩
 *   4) 路径回退：根 /models 返回 404，但 /v1/models 成功 → 自动回退识别
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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.zip': 'application/zip' };

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
  // mode: 'all' | 'empty' | 'root404'
  let mode = 'all';
  const MOCK = ['gpt-4o-mini', 'gpt-4o', 'text-embedding-3-small', 'davinci-002'];
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

  // 拦截 **/models：按 mode 与具体路径决定返回
  await page.route('**/models', (route) => {
    const url = route.request().url();
    if (mode === 'empty') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'list', data: [] }) });
    }
    if (mode === 'root404') {
      // 根 /models 返回 404，仅 /v1/models 成功（模拟很多中转站只在 /v1/models 暴露）
      if (url.endsWith('/v1/models')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'list', data: MOCK.map((id) => ({ id })) }) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
    }
    // all：所有 /models 路径都返回 4 个
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'list', data: MOCK.map((id) => ({ id })) }) });
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && typeof loadTemplate === 'function', { timeout: 10_000 });
  check('当前构建产物加载且无运行时错误', errors.length === 0, errors.join(' | '));

  // 打开设置面板
  await page.evaluate(() => document.getElementById('aiSettingsBtn').click());
  await page.waitForSelector('#provBaseInput:visible', { timeout: 5_000 });

  // 场景 1：正常获取并选择部分添加
  mode = 'all';
  await page.evaluate(() => { document.getElementById('provNameInput').value = ''; document.getElementById('provBaseInput').value = ''; document.getElementById('provKeyInput').value = ''; });
  await page.fill('#provNameInput', 'MockProvider');
  await page.fill('#provBaseInput', 'http://fake-endpoint.local/v1');
  await page.fill('#provKeyInput', 'sk-test-123');
  await page.evaluate(() => document.getElementById('provFetchModelsBtn').click());
  await page.waitForFunction(() => {
    const box = document.getElementById('provModelsBox');
    const list = document.getElementById('provModelsList');
    return box && !box.hidden && list && list.querySelectorAll('input[type=checkbox]').length > 0;
  }, { timeout: 5_000 });
  check('点「获取模型」后识别并渲染勾选列表', true);

  const listed = await page.$$eval('#provModelsList input[type=checkbox]', (cbs) =>
    cbs.map((cb) => cb.getAttribute('data-model')));
  check('模型列表数量正确（4 个）', listed.length === 4, `实际 ${listed.length}`);
  check('模型 id 与接口返回一致', JSON.stringify(listed) === JSON.stringify(MOCK), listed.join(','));

  // 取消勾选最后一个，验证「选择相应模型添加」
  await page.evaluate(() => {
    const cbs = document.querySelectorAll('#provModelsList input[type=checkbox]');
    if (cbs.length) cbs[cbs.length - 1].checked = false; // 取消 davinci-002
  });
  await page.evaluate(() => document.getElementById('provAddBtn').click());
  await page.waitForTimeout(200);

  const saved = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('flowcraft-providers') || '[]'); } catch (_) { return []; }
  });
  const added = saved[saved.length - 1];
  check('提供方已写入 localStorage', !!added && added.name === 'MockProvider', added && added.name);
  check('所选模型已记录（3 个，排除取消的）', added && Array.isArray(added.models) && added.models.length === 3, added && (added.models || []).join(','));
  check('默认模型取首个所选（gpt-4o-mini）', added && added.model === 'gpt-4o-mini', added && added.model);
  check('base 与 key 正确保存', added && added.base === 'http://fake-endpoint.local/v1' && added.key === 'sk-test-123', added && (added.base + ' / ' + added.key));

  const statusText = await page.$eval('#providerStatus', (el) => el.textContent || '');
  check('状态提示显示成功', /已添加/.test(statusText), statusText);

  // 场景 2：空模型返回 → 友好提示，不崩
  mode = 'empty';
  await page.evaluate(() => { document.getElementById('provNameInput').value = ''; document.getElementById('provBaseInput').value = ''; document.getElementById('provKeyInput').value = ''; });
  await page.fill('#provBaseInput', 'http://empty.local/v1');
  await page.evaluate(() => document.getElementById('provFetchModelsBtn').click());
  await page.waitForTimeout(300);
  const statusEmpty = await page.$eval('#providerStatus', (el) => el.textContent || '');
  check('空模型返回时给出友好提示且不崩', /未识别|手动填写/.test(statusEmpty) && errors.length === 0, statusEmpty);

  // 场景 3：路径回退（根 /models 404，但 /v1/models 成功）
  mode = 'root404';
  await page.evaluate(() => { document.getElementById('provNameInput').value = ''; document.getElementById('provBaseInput').value = ''; document.getElementById('provKeyInput').value = ''; document.getElementById('provModelsList').innerHTML = ''; });
  await page.fill('#provNameInput', 'FallbackProvider');
  await page.fill('#provBaseInput', 'http://fallback.local'); // 不以 /v1 结尾
  await page.fill('#provKeyInput', 'sk-test-456');
  await page.evaluate(() => document.getElementById('provFetchModelsBtn').click());
  await page.waitForFunction(() => {
    const list = document.getElementById('provModelsList');
    return list && list.querySelectorAll('input[type=checkbox]').length > 0;
  }, { timeout: 5_000 });
  const listedFB = await page.$$eval('#provModelsList input[type=checkbox]', (cbs) =>
    cbs.map((cb) => cb.getAttribute('data-model')));
  check('路径回退：根 /models 404 时自动改试 /v1/models 成功', listedFB.length === 4, listedFB.join(','));
  const statusFB = await page.$eval('#providerStatus', (el) => el.textContent || '');
  check('路径回退后提示取自 /v1/models', /\/v1\/models/.test(statusFB), statusFB);

  // 场景 4：浏览器 CORS 阻断（Failed to fetch）→ 明确 CORS 诊断 + 引导手动粘贴
  mode = 'cors'; // 让 route abort 模拟浏览器级失败
  await page.unroute('**/models');
  await page.route('**/models', (route) => route.abort('failed'));
  await page.evaluate(() => { document.getElementById('provNameInput').value = ''; document.getElementById('provBaseInput').value = ''; document.getElementById('provKeyInput').value = ''; document.getElementById('provModelsList').innerHTML = ''; });
  await page.fill('#provNameInput', 'CorsProvider');
  await page.fill('#provBaseInput', 'https://momoai.asia');
  await page.fill('#provKeyInput', 'sk-cors-test');
  await page.evaluate(() => document.getElementById('provFetchModelsBtn').click());
  await page.waitForTimeout(800);
  const statusCors = await page.$eval('#providerStatus', (el) => el.textContent || '');
  check('CORS/网络阻断时识别为浏览器级失败（提示含 CORS）', /CORS|Failed to fetch/.test(statusCors), statusCors);
  check('CORS 阻断时引导手动粘贴模型 id', /手动|粘贴|CORS/.test(statusCors) && /粘贴|手动|模型 id/.test(statusCors), statusCors);

  // 场景 5：手动批量填多模型 id（无勾选列表场景）— 验证 split + 批量入 models
  await page.evaluate(() => { document.getElementById('provNameInput').value = ''; document.getElementById('provBaseInput').value = ''; document.getElementById('provKeyInput').value = ''; document.getElementById('provModelInput').value = ''; });
  await page.route('**/models', (route) => route.abort('failed')); // 保持 CORS 阻断
  await page.fill('#provNameInput', 'ManualProvider');
  await page.fill('#provBaseInput', 'https://momoai.asia');
  await page.fill('#provKeyInput', 'sk-manual-test');
  // 用换行 + 逗号 + 空格 混合分隔
  await page.fill('#provModelInput', 'gpt-5.6-sol\nclaude-sonnet-4.5, gemini-2.5-pro\n  gpt-image-2 ');
  await page.evaluate(() => document.getElementById('provAddBtn').click());
  await page.waitForTimeout(200);
  const savedAll = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('flowcraft-providers') || '[]'); } catch (_) { return []; }
  });
  const manualEntry = savedAll[savedAll.length - 1];
  const manualModels = (manualEntry && manualEntry.models) || [];
  check('手动批量：4 个 id（混合分隔）全部入 models', manualModels.length === 4, manualModels.join('|'));
  check('手动批量：默认模型取第一个（gpt-5.6-sol）', manualEntry && manualEntry.model === 'gpt-5.6-sol', manualEntry && manualEntry.model);
  const expected = ['gpt-5.6-sol', 'claude-sonnet-4.5', 'gemini-2.5-pro', 'gpt-image-2'];
  check('手动批量：去空白 + 保序与预期一致', JSON.stringify(manualModels) === JSON.stringify(expected), manualModels.join(','));

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const passed = checks.filter((c) => c.passed).length;
  console.log(`\n[provider-models] ${passed}/${checks.length} 通过`);
  process.exit(passed === checks.length ? 0 : 1);
} catch (error) {
  console.error('[provider-models] 运行异常：', error);
  process.exit(2);
} finally {
  if (browser) await browser.close();
  server.close();
}
