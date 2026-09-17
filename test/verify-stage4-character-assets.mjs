#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 阶段四 · 角色资产持续生产专项回归。
 * 仅加载当前 deploy/index.html，使用本地 HTTP 与内存测试图片；不填写 Key、不请求真实 AI 服务。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6wgAAAABJRU5ErkJggg==', 'base64');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.zip': 'application/zip' };

function createServer() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(ROOT, relative));
    if (!file.startsWith(`${ROOT}/`) && file !== join(ROOT, 'index.html')) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    try {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch (error) {
      res.writeHead(500); res.end(String(error));
    }
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
  await page.waitForFunction(() => window.FlowCraft && workflow && typeof loadTemplate === 'function', { timeout: 10_000 });
  check('当前构建产物加载且无运行时错误', errors.length === 0, errors.join(' | '));

  const template = await page.evaluate(() => {
    clearGraph();
    loadTemplate('character-asset-board', 'replace');
    const nodes = [...workflow.nodes.values()];
    const textNode = nodes.find((node) => node.type === 'text');
    const aiNode = nodes.find((node) => node.type === 'aiImage');
    return {
      count: nodes.length,
      edges: workflow.edges.size,
      textId: textNode && textNode.id,
      aiId: aiNode && aiNode.id,
      charDesc: textNode && textNode.charDesc,
      fixedPrompt: textNode && textNode.prompt,
      hasUi: Boolean(textNode && textNode.el && textNode.el.querySelector('.node-lead-textarea') && textNode.el.querySelector('.node-main-textarea') && textNode.el.querySelector('.node-ref-upload-btn') && textNode.el.querySelector('.node-section-sep')),
    };
  });
  check('人物资产模板创建 1 个文本节点和 1 个 AI 绘图节点', template.count === 2 && template.textId && template.aiId, JSON.stringify(template));
  check('人物资产模板创建 1 条连线', template.edges === 1, String(template.edges));
  check('角色描述与固定提示词字段分离', template.charDesc === '' && typeof template.fixedPrompt === 'string' && template.fixedPrompt.includes('三视图'), `charDesc=${JSON.stringify(template.charDesc)}`);
  check('文本节点显示角色描述、参考图和固定提示词分区', template.hasUi);

  const textNode = page.locator(`.node[data-id="${template.textId}"]`);
  const lead = textNode.locator('.node-lead-textarea');
  const upload = textNode.locator('.node-ref-upload-btn');
  const chooserPromise = page.waitForEvent('filechooser');
  await upload.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'stage4-character-reference.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await textNode.locator('.node-ref-thumb').waitFor({ state: 'visible', timeout: 10_000 });
  let refState = await page.evaluate((id) => {
    const text = workflow.nodes.get(id);
    const ai = [...workflow.nodes.values()].find((node) => node.type === 'aiImage');
    return { refs: text.refImages, inline: collectInlineRefs(ai) };
  }, template.textId);
  check('上传参考图后显示缩略图并进入下游引用集合', refState.refs.length === 1 && refState.refs[0].name === 'stage4-character-reference' && refState.inline.length === 1, JSON.stringify(refState));

  await textNode.locator('.node-ref-thumb-rm').click();
  refState = await page.evaluate((id) => workflow.nodes.get(id).refImages, template.textId);
  check('参考图可从缩略图区域删除', refState.length === 0, JSON.stringify(refState));

  const chooserAgain = page.waitForEvent('filechooser');
  await upload.click();
  await (await chooserAgain).setFiles({ name: 'stage4-character-reference.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await textNode.locator('.node-ref-thumb').waitFor({ state: 'visible', timeout: 10_000 });

  const characterText = '测试角色：短黑发、白色连衣裙、红色蝴蝶结\n状态列表：\n- 日常着装\n- 华丽晚礼服\n- 雨中撑伞';
  await lead.fill(characterText);
  await lead.dispatchEvent('input');
  const promptState = await page.evaluate((id) => {
    const text = workflow.nodes.get(id);
    const rawLines = String(text.charDesc || '').split('\n').map((line) => line.trim()).filter(Boolean);
    return {
      full: nodeFullText(text), fixed: text.prompt, charDesc: text.charDesc,
      rawLines,
      parsedBullets: rawLines.filter((line) => /^[-·•*]\s*(.+)$/u.test(line)).map((line) => line.replace(/^[-·•*]\s*/u, '')),
    };
  }, template.textId);
  check('角色描述前置拼接到固定提示词，且未覆盖固定提示词', promptState.charDesc === characterText && promptState.full.startsWith(characterText) && promptState.full.includes(promptState.fixed), `${promptState.full.slice(0, 70)}…`);

  await textNode.locator('.text-node-statesbtn').click();
  const states = await page.evaluate((id) => {
    const text = workflow.nodes.get(id);
    const images = [...workflow.nodes.values()].filter((node) => node.type === 'aiImage');
    return {
      images: images.map((node) => ({ id: node.id, title: node.title, prompt: node.prompt })),
      stateEdges: [...workflow.edges.values()].filter((edge) => edge.from.node === text && edge.to.node.type === 'aiImage').length,
    };
  }, template.textId);
  const expectedStates = ['日常着装', '华丽晚礼服', '雨中撑伞'];
  const generated = states.images.filter((node) => expectedStates.some((state) => node.title.includes(state)));
  check('状态列表批量生成 3 个 AI 绘图节点', generated.length === 3, JSON.stringify({ titles: states.images.map((node) => node.title), rawLines: promptState.rawLines, parsedBullets: promptState.parsedBullets }));
  check('每个状态节点保留角色一致性约束与状态名称', generated.every((node) => node.prompt.includes('同一角色保持脸型、发型、五官、体型、气质完全一致') && expectedStates.some((state) => node.prompt.includes(state))), JSON.stringify(generated));
  check('状态节点均与角色文本节点连线', states.stateEdges === 4, String(states.stateEdges));

  const stateActions = await page.evaluate((id) => {
    const text = workflow.nodes.get(id);
    const state = [...workflow.nodes.values()].find((node) => node.stateMeta && node.stateMeta.label === '日常着装');
    return {
      stateId: state && state.id,
      meta: state && state.stateMeta,
      hasToolbar: Boolean(state && state.el && state.el.querySelector('.state-node-action[title="单状态重试"]') && state.el.querySelector('.state-node-action[title="复制此状态"]') && state.el.querySelector('.state-node-action[title*="删除此状态"]')),
      sourceConnected: Boolean(state && [...workflow.edges.values()].some((edge) => edge.from.node === text && edge.to.node === state)),
    };
  }, template.textId);
  check('状态节点显示单状态重试、复制和删除操作', stateActions.hasToolbar, JSON.stringify(stateActions));
  check('状态节点保存来源与状态元数据', Boolean(stateActions.meta && stateActions.meta.sourceId === template.textId && stateActions.meta.label === '日常着装'), JSON.stringify(stateActions.meta));

  const copied = await page.evaluate((label) => {
    const state = [...workflow.nodes.values()].find((node) => node.stateMeta && node.stateMeta.label === label);
    const copy = duplicateCharacterStateNode(state);
    return {
      count: [...workflow.nodes.values()].filter((node) => node.stateMeta && node.stateMeta.label === label).length,
      copied: Boolean(copy && copy.stateMeta && copy.stateMeta.copyOf === state.id),
      sourceEdges: [...workflow.edges.values()].filter((edge) => edge.from.node === workflow.nodes.get(state.stateMeta.sourceId) && edge.to.node.stateMeta && edge.to.node.stateMeta.label === label).length,
    };
  }, '日常着装');
  check('状态节点可复制并保持角色来源连线', copied.count === 2 && copied.copied && copied.sourceEdges === 2, JSON.stringify(copied));

  const retryBefore = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.label === '日常着装');
    node.status = 'error';
    node._lastError = '测试失败原因';
    // 重试语义只需要验证“清理旧结果并重新进入执行流程”，不应依赖真实模型。
    window.__stage4RetryOriginal = window.executeNodeAsync;
    window.executeNodeAsync = async (target) => {
      target.status = 'running';
      await new Promise((resolve) => setTimeout(resolve, 80));
      target.status = 'done';
      target.outputsData = [{ type: 'image', value: 'data:image/png;base64,AA==' }];
    };
    return { id: node.id, status: node.status };
  });
  await page.locator(`.node[data-id="${retryBefore.id}"] .state-node-action[title="单状态重试"]`).evaluate((button) => button.click());
  await page.waitForTimeout(1400);
  const retryAfter = await page.evaluate((id) => {
    const node = workflow.nodes.get(id);
    window.executeNodeAsync = window.__stage4RetryOriginal;
    delete window.__stage4RetryOriginal;
    return { status: node.status, error: node._lastError || '' };
  }, retryBefore.id);
  check('单状态重试会清除旧结果并重新进入运行流程', retryAfter.status === 'running' || retryAfter.status === 'done', JSON.stringify(retryAfter));

  const removeTarget = await page.evaluate(() => {
    const nodes = [...workflow.nodes.values()].filter((n) => n.stateMeta && n.stateMeta.label === '日常着装');
    return nodes[nodes.length - 1].id;
  });
  await page.locator(`.node[data-id="${removeTarget}"] .state-node-action[title*="删除此状态"]`).click();
  const removed = await page.evaluate((id) => ({ exists: workflow.nodes.has(id), recycle: recycleBin.some((item) => item.node.id === id) }), removeTarget);
  check('删除状态节点进入统一回收站', !removed.exists && removed.recycle, JSON.stringify(removed));

  await page.waitForTimeout(750);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('flowcraft:autosave:v1');
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      hasRaw: Boolean(raw),
      nodes: parsed && parsed.nodes,
      edges: parsed && parsed.edges,
      serialized: JSON.parse(serializeWorkflow()),
    };
  });
  const storedText = (stored.nodes || []).find((node) => node.id === template.textId);
  check('序列化与自动保存包含角色描述、参考图和连线', Boolean(stored.hasRaw && storedText && storedText.charDesc === characterText && storedText.refImages.length === 1 && stored.edges.length === 4 && stored.serialized.edges.length === 4), storedText ? `refs=${storedText.refImages.length}, edges=${stored.edges.length}` : 'missing text node');

  await page.reload({ waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => workflow && workflow.nodes, { timeout: 10_000 });
  const restored = await page.evaluate((id) => {
    const text = workflow.nodes.get(id);
    return text ? { charDesc: text.charDesc, refs: text.refImages.length, edges: workflow.edges.size } : null;
  }, template.textId);
  check('刷新后可恢复角色描述、参考图和角色状态连线', Boolean(restored && restored.charDesc === characterText && restored.refs === 1 && restored.edges === 4), JSON.stringify(restored));
  check('操作完成后无新增运行时错误', errors.length === 0, errors.join(' | '));
  // —— 阶段四新增：批量进度与失败反馈（第 1–2 步专项，mock 错误，不调用真实 AI）——
  const batchMeta = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.label === '华丽晚礼服');
    return { total: node && node.stateMeta.batchTotal, hasProgress: Boolean(node && node.stateMeta.batchProgress) };
  });
  check('批量任务显示任务总数', batchMeta.total === 3, 'batchTotal=' + batchMeta.total);

  const ran = await page.evaluate(async () => {
    const nodes = [...workflow.nodes.values()].filter((n) => n.stateMeta && n.stateMeta.batchTotal === 3 && n.type === 'aiImage' && !n.stateMeta.copyOf);
    // mock a successful generation pass (no real AI) to exercise the completion-progress path
    const mockRun = async (n) => { n.status = 'done'; if (typeof updateNodeStatus === 'function') updateNodeStatus(n); return true; };
    await Promise.allSettled(nodes.map((n) => mockRun(n)));
    const p = refreshCharacterBatchProgress(nodes[0]);
    return { total: p.total, completed: p.completed, failed: p.failed };
  });
  check('批量任务显示完成进度', ran.total === 3 && ran.completed === 3 && ran.failed === 0, JSON.stringify(ran));

  const runningLabel = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.batchTotal === 3 && !n.stateMeta.copyOf);
    node.status = 'running'; updateNodeStatus(node);
    // P2.6.c：节点极简后状态以 .node-status-dot 的 class 名表达（running/done/error/idle）
    const dot = node.el && node.el.querySelector('.node-status-dot');
    return dot ? (dot.className.match(/(running|done|error|idle)/) || ['idle'])[0] : '';
  });
  check('单个节点进入生成中状态', runningLabel === 'running', runningLabel);

  const doneState = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.batchTotal === 3 && !n.stateMeta.copyOf);
    node.status = 'done'; updateNodeStatus(node);
    const dot = node.el && node.el.querySelector('.node-status-dot');
    const cls = dot ? (dot.className.match(/(running|done|error|idle)/) || ['idle'])[0] : '';
    return { status: node.status, label: cls };
  });
  check('单个节点成功后更新为完成', doneState.status === 'done' && doneState.label === 'done', JSON.stringify(doneState));

  const failInfo = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.batchTotal === 3 && !n.stateMeta.copyOf);
    setNodeStatus(node, 'error', '未配置图像模型 API');
    updateNodeStatus(node);
    const info = node.el && node.el.querySelector('.state-node-info');
    return { status: node.status, reason: node.failureReason, text: info ? info.textContent : '' };
  });
  check('单个节点失败后显示失败原因', failInfo.status === 'error' && /未配置图像模型 API/.test(failInfo.reason) && /失败原因/.test(failInfo.text), JSON.stringify(failInfo));

  const isolation = await page.evaluate(() => {
    const nodes = [...workflow.nodes.values()].filter((n) => n.stateMeta && n.stateMeta.batchTotal === 3 && n.type === 'aiImage' && !n.stateMeta.copyOf);
    nodes[0].status = 'done'; nodes[1].status = 'done';
    setNodeStatus(nodes[2], 'error', '模拟失败');
    const p = refreshCharacterBatchProgress(nodes[2]);
    return { total: p.total, completed: p.completed, failed: p.failed };
  });
  check('某个节点失败不阻断其他节点', isolation.completed === 2 && isolation.failed === 1, JSON.stringify(isolation));

  // 失败原因随刷新恢复：显式触发自动保存，重载后校验
  await page.evaluate(() => { scheduleAutosave(); });
  await page.waitForTimeout(900);
  const beforeReload = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.batchTotal === 3 && n.status === 'error' && !n.stateMeta.copyOf);
    return node ? { id: node.id, reason: node.failureReason } : null;
  });
  await page.reload({ waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => workflow && workflow.nodes, { timeout: 10_000 });
  const afterReload = await page.evaluate((id) => {
    const node = workflow.nodes.get(id);
    return node ? { reason: node.failureReason, status: node.status } : null;
  }, beforeReload && beforeReload.id);
  check('失败原因可随刷新恢复', Boolean(beforeReload && afterReload) && afterReload.reason === beforeReload.reason && afterReload.status === 'error', JSON.stringify(afterReload));

  const retryId = await page.evaluate(() => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.batchTotal === 3 && n.status === 'error' && !n.stateMeta.copyOf);
    return node ? node.id : null;
  });
  if (retryId) {
    await page.evaluate(() => {
      window.__stage4RetryOriginal = window.executeNodeAsync;
      window.executeNodeAsync = async (target) => {
        target.status = 'running';
        await new Promise((resolve) => setTimeout(resolve, 80));
        target.status = 'done';
        target.outputsData = [{ type: 'image', value: 'data:image/png;base64,AA==' }];
      };
    });
    await page.locator(`.node[data-id="${retryId}"] .state-node-action[title="单状态重试"]`).evaluate((b) => b.click());
    await page.waitForTimeout(1400);
    const afterRetry = await page.evaluate((id) => {
      const n = workflow.nodes.get(id);
      window.executeNodeAsync = window.__stage4RetryOriginal;
      delete window.__stage4RetryOriginal;
      return n ? { status: n.status } : null;
    }, retryId);
    check('失败节点可以单独重试', Boolean(afterRetry) && (afterRetry.status === 'running' || afterRetry.status === 'done'), JSON.stringify(afterRetry));
  } else {
    check('失败节点可以单独重试', false, '未找到失败节点');
  }

  // —— 阶段五新增：角色资产库（第 5 步，不调用真实 AI）——
  const pngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6wgAAAABJRU5ErkJggg==';
  const setupAsset = await page.evaluate((png) => {
    const node = [...workflow.nodes.values()].find((n) => n.stateMeta && n.stateMeta.label === '华丽晚礼服' && n.type === 'aiImage' && !n.stateMeta.copyOf);
    if (!node) return { id: null };
    node.outputsData = [{ type: 'image', value: png }];
    node.status = 'done';
    if (typeof updateNodeStatus === 'function') updateNodeStatus(node);
    renderCharacterStateInfo(node);
    const saveBtn = node.el.querySelector('.state-node-save-asset-btn');
    return { id: node.id, hasBtn: Boolean(saveBtn), infoText: node.el.querySelector('.state-node-info') ? node.el.querySelector('.state-node-info').textContent : '' };
  }, pngData);
  check('完成的状态节点显示「存为角色资产」按钮', Boolean(setupAsset.id) && setupAsset.hasBtn, JSON.stringify(setupAsset));

  if (setupAsset.id) {
    await page.locator(`.node[data-id="${setupAsset.id}"] .state-node-save-asset-btn`).evaluate((b) => b.click());
    const afterSave = await page.evaluate((id) => {
      const node = workflow.nodes.get(id);
      const key = characterStateAssetKey(node);
      const meta = key ? getAssetMeta(key) : null;
      const savedTag = node.el.querySelector('.state-node-asset-saved');
      return { meta: meta, hasTag: Boolean(savedTag), tagText: savedTag ? savedTag.textContent : '' };
    }, setupAsset.id);
    check('点击后创建角色类资产元数据（cat=角色 且含默认名称）', Boolean(afterSave.meta && afterSave.meta.cat === '角色' && afterSave.meta.name), JSON.stringify(afterSave.meta));
    check('状态节点显示已存为角色资产标记', afterSave.hasTag && /<<</.test(afterSave.tagText), afterSave.tagText);

    const listRes = await page.evaluate(() => listCharacterAssets().map((a) => ({ name: a.name, hasSrc: typeof a.src === 'string' && a.src.startsWith('data:') })));
    check('角色资产可被其他节点引用列表检索', listRes.length >= 1 && listRes[0].hasSrc, JSON.stringify(listRes));

    const aiRebuild = await page.evaluate(() => {
      const ai = [...workflow.nodes.values()].find((n) => n.type === 'aiImage' && !(n.stateMeta && n.stateMeta.label));
      if (!ai) return { has: false };
      // #5 Details on Demand：引用角色资产下拉已迁移到「节点下方 Composer」，先选中节点使其浮现
      selectNode(ai);
      buildNodeBody(ai.el, ai);
      const composer = document.getElementById('nodeComposer');
      if (!composer || composer.hidden) return { has: false, hidden: composer ? composer.hidden : true };
      const sel = composer.querySelector('.node-ref-asset-select');
      if (!sel) return { has: false };
      const opts = [...sel.options].map((o) => o.value).filter(Boolean);
      return { has: true, options: opts, id: ai.id };
    });
    check('AI 绘图节点 Composer 含「引用角色资产」下拉且列出已存资产', aiRebuild.has && aiRebuild.options.length >= 1, JSON.stringify(aiRebuild));

    if (aiRebuild.has && aiRebuild.options.length) {
      const targetName = aiRebuild.options[0];
      const afterSelect = await page.evaluate((args) => {
        const composer = document.getElementById('nodeComposer');
        const sel = composer && composer.querySelector('.node-ref-asset-select');
        if (sel) {
          sel.value = args.name;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const ai = workflow.nodes.get(args.id);
        const token = '<<<' + args.name + '>>>';
        return { prompt: ai.prompt, hasToken: ai.prompt.indexOf(token) >= 0 };
      }, { id: aiRebuild.id, name: targetName });
      check('选择角色资产后提示词插入引用令牌', afterSelect.hasToken, afterSelect.prompt);
    } else {
      check('选择角色资产后提示词插入引用令牌', false, '无可用 AI 节点或 Composer 下拉');
    }
  } else {
    check('点击后创建角色类资产元数据（cat=角色 且含默认名称）', false, '未找到状态节点');
    check('状态节点显示已存为角色资产标记', false, '未找到状态节点');
    check('角色资产可被其他节点引用列表检索', false, '未找到状态节点');
    check('AI 绘图节点 Composer 含「引用角色资产」下拉且列出已存资产', false, '未找到状态节点');
    check('选择角色资产后提示词插入引用令牌', false, '未找到状态节点');
  }

  check('角色资产库操作后无新增运行时错误', errors.length === 0, errors.join(' | '));

  await context.close();
} catch (error) {
  check('阶段四专项脚本可完整执行', false, error && error.stack ? error.stack : String(error));
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}

const failed = checks.filter((item) => !item.passed);
console.log(`\n[stage4] ${checks.length - failed.length}/${checks.length} 通过`);
if (failed.length) process.exit(1);
console.log('[stage4] PASS（未调用真实 AI 服务）');
