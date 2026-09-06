import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const INDEX_URL = pathToFileURL(INDEX).href;
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

if (!fs.existsSync(INDEX)) {
  console.error('[semantic] 缺少构建产物：' + INDEX);
  process.exit(1);
}

async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  };
  const requestedPath = process.env.FLOWCRAFT_BROWSER_PATH;
  const candidates = requestedPath
    ? [{ executablePath: requestedPath }]
    : [{}];
  const errors = [];
  for (const candidate of candidates) {
    try {
      return await chromium.launch({ ...launchOptions, ...candidate });
    } catch (error) {
      const label = candidate.executablePath || candidate.channel || 'Playwright bundled browser';
      errors.push(`${label}: ${error?.message || error}`);
    }
  }
  const hint = requestedPath
    ? `FLOWCRAFT_BROWSER_PATH=${requestedPath}`
    : 'FLOWCRAFT_BROWSER_PATH=/path/to/chrome-or-chromium';
  const error = new Error(`浏览器运行时不可用。已尝试 ${errors.length} 个启动方式。可设置 ${hint} 后重试。\n${errors.join('\n')}`);
  error.code = 'BROWSER_RUNTIME_UNAVAILABLE';
  throw error;
}

(async () => {
  let browser;
  try {
    browser = await launchBrowser();
  } catch (error) {
    console.error('[semantic] 环境阻塞:', error && error.message ? error.message : error);
    process.exit(2);
  }
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const text = m.text();
      if (!/Failed to load resource|favicon|404/i.test(text)) pageErrors.push('CONSOLE: ' + text);
    }
  });

  await page.goto(INDEX_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor && typeof window.FlowCraft.editor.addNode === 'function'), null, { timeout: 30000 });
  await page.waitForTimeout(500);

  // 1) 节点库徽标与新建节点初始语义。
  // 产品现状：aiVideo 已于 2026-08-27 交互调整中从 stub 迁为 demo（带代理真实通道），
  // 因此这里的期望是「演示」；「未实现」语义改由下方合成 stub 用例覆盖。
  const initial = await page.evaluate(() => {
    const badgeText = (type) => document.querySelector(`.node-library-item[data-type="${type}"] .lib-tier-badge`)?.textContent?.trim() || '';
    const { editor } = window.FlowCraft;
    editor.clear();
    const nodes = {
      text: editor.addNode('text', 80, 80),
      aiImage: editor.addNode('aiImage', 320, 80),
      upscale: editor.addNode('upscale', 560, 80),
      aiVideo: editor.addNode('aiVideo', 800, 80),
    };
    const snap = (node) => ({
      tier: node.el.querySelector('.node-tier-pill')?.textContent.trim() || '',
      result: node.el.querySelector('.node-result-pill')?.textContent.trim() || '',
    });
    return {
      lib: {
        text: badgeText('text'),
        aiImage: badgeText('aiImage'),
        upscale: badgeText('upscale'),
        aiVideo: badgeText('aiVideo'),
      },
      nodes: {
        text: snap(nodes.text),
        aiImage: snap(nodes.aiImage),
        upscale: snap(nodes.upscale),
        aiVideo: snap(nodes.aiVideo),
      },
    };
  });

  // 2) 演示回退：upscale 无代理时落 demo
  const demoRun = await page.evaluate(async () => {
    const { editor, _legacy } = window.FlowCraft;
    editor.clear();
    const node = editor.addNode('upscale', 120, 120);
    await _legacy.executeNodeAsync(node, 0);
    return {
      status: node.status,
      resultMode: node.resultMode,
      pill: node.el.querySelector('.node-result-pill')?.textContent.trim() || '',
    };
  });

  // 3) 合成 stub：产品当前无 tier='stub' 节点，临时降级 upscale 验证硬拦截落 unimplemented
  const stubRun = await page.evaluate(async () => {
    const { editor, _legacy, proxy, nodes } = window.FlowCraft;
    const savedTier = nodes.CONTRACT.upscale.tier;
    const oldEnabled = proxy.enabled;
    try {
      proxy.enabled = () => false;
      nodes.CONTRACT.upscale.tier = 'stub';
      editor.clear();
      const node = editor.addNode('upscale', 120, 120);
      await _legacy.executeNodeAsync(node, 0);
      return {
        status: node.status,
        resultMode: node.resultMode,
        pill: node.el.querySelector('.node-result-pill')?.textContent.trim() || '',
      };
    } finally {
      nodes.CONTRACT.upscale.tier = savedTier;
      proxy.enabled = oldEnabled;
    }
  });

  // 4) 参数校验失败（非 stub）：script 节点空参数，落 failed 而非 unimplemented
  const validateRun = await page.evaluate(async () => {
    const { editor, _legacy } = window.FlowCraft;
    editor.clear();
    const node = editor.addNode('script', 120, 120);
    // script 节点自带非空示例文稿（defaultParams），清空后才能触发 validate 失败分支
    node.params = {};
    await _legacy.executeNodeAsync(node, 0);
    return {
      status: node.status,
      resultMode: node.resultMode,
      pill: node.el.querySelector('.node-result-pill')?.textContent.trim() || '',
    };
  });

  // 5) 运行时异常：代理抛错模拟上游 500，落 failed（本次失败）而非 unimplemented
  const failRun = await page.evaluate(async () => {
    const { editor, _legacy, proxy } = window.FlowCraft;
    const oldEnabled = proxy.enabled;
    const oldCall = proxy.call;
    const oldGetTask = proxy.getTask;
    try {
      proxy.enabled = () => true;
      proxy.call = async () => { throw new Error('模拟上游 500'); };
      proxy.getTask = async () => { throw new Error('模拟上游 500'); };
      editor.clear();
      const node = editor.addNode('aiImage', 120, 120);
      node.prompt = '一张测试图片';
      await _legacy.executeNodeAsync(node, 0);
      return {
        status: node.status,
        resultMode: node.resultMode,
        pill: node.el.querySelector('.node-result-pill')?.textContent.trim() || '',
      };
    } finally {
      proxy.enabled = oldEnabled;
      proxy.call = oldCall;
      proxy.getTask = oldGetTask;
    }
  });

  // 6) 真实链路：代理返回图片，落 real
  const realRun = await page.evaluate(async (tinyPng) => {
    const { editor, _legacy, proxy } = window.FlowCraft;
    const oldEnabled = proxy.enabled;
    const oldCall = proxy.call;
    const oldGetTask = proxy.getTask;
    try {
      proxy.enabled = () => true;
      proxy.call = async ({ endpoint }) => {
        if (endpoint === '/images/generations') {
          return { data: [{ b64_json: tinyPng }] };
        }
        if (endpoint === '/videos') {
          return { taskId: 'task_semantic_001' };
        }
        return {};
      };
      proxy.getTask = async () => ({ status: 'success', result: { video_url: 'data:video/mp4;base64,AAAA' } });
      editor.clear();
      const node = editor.addNode('aiImage', 120, 120);
      node.prompt = '一张测试图片';
      await _legacy.executeNodeAsync(node, 0);
      return {
        status: node.status,
        resultMode: node.resultMode,
        pill: node.el.querySelector('.node-result-pill')?.textContent.trim() || '',
        thumbOk: typeof node.thumb === 'string' && node.thumb.startsWith('data:image/png'),
      };
    } finally {
      proxy.enabled = oldEnabled;
      proxy.call = oldCall;
      proxy.getTask = oldGetTask;
    }
  }, TINY_PNG);

  const ok =
    initial.lib.text === '输入' &&
    initial.lib.aiImage === '真实' &&
    initial.lib.upscale === '演示' &&
    initial.lib.aiVideo === '演示' &&
    initial.nodes.text.tier === '输入' && initial.nodes.text.result === '未运行' &&
    initial.nodes.aiImage.tier === '真实' && initial.nodes.aiImage.result === '未运行' &&
    initial.nodes.upscale.tier === '演示' && initial.nodes.upscale.result === '未运行' &&
    initial.nodes.aiVideo.tier === '演示' && initial.nodes.aiVideo.result === '未运行' &&
    demoRun.resultMode === 'demo' && demoRun.pill === '演示' && demoRun.status === 'done' &&
    stubRun.resultMode === 'unimplemented' && stubRun.pill === '未实现' && stubRun.status === 'error' &&
    validateRun.resultMode === 'failed' && validateRun.pill === '失败' && validateRun.status === 'error' &&
    failRun.resultMode === 'failed' && failRun.pill === '失败' && failRun.status === 'error' &&
    realRun.resultMode === 'real' && realRun.pill === '真实' && realRun.status === 'done' && realRun.thumbOk === true &&
    pageErrors.length === 0;

  console.log('[semantic] sidebar badges:', JSON.stringify(initial.lib));
  console.log('[semantic] node tiers:', JSON.stringify(initial.nodes));
  console.log('[semantic] demo run:', JSON.stringify(demoRun));
  console.log('[semantic] stub run (合成):', JSON.stringify(stubRun));
  console.log('[semantic] validate-fail run:', JSON.stringify(validateRun));
  console.log('[semantic] runtime-fail run:', JSON.stringify(failRun));
  console.log('[semantic] real run:', JSON.stringify(realRun));
  if (pageErrors.length) console.log('[semantic] page errors:', pageErrors.join(' | '));
  console.log(ok ? '\n[Semantic] PASS' : '\n[Semantic] FAIL');

  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error('[semantic] 运行失败:', err && err.stack ? err.stack : err);
  process.exit(1);
});
