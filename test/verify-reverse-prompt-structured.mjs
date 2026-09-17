#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * 阶段D · 反推提示词节点完善专项：结构化字段 + 一键套用到 AI 绘图节点（mock，不调真实 AI）。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const MIME = { '.html': 'text/html; charset=utf-8' };

function createServer() {
  return http.createServer((req, res) => {
    const file = join(ROOT, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(readFileSync(file));
  });
}

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? '  ✅' : '  ❌'} ${name}${detail ? `：${detail}` : ''}`);
}

// 模拟视觉模型返回（含结构化段）
const MOCK_MODEL_OUTPUT = `#1：黑发女性穿白色连衣裙站在红光舞台上，中景。
#2：镜头推近面部特写，水晶颈链反光。
【电影级提示词】黑发女性、白色抹胸蓬蓬短裙、黑丝带，站于红舞台光中央，中景缓慢推近特写，电影感时装摄影，暗背景高对比。
【结构化】
【主体】黑发女性，白色抹胸蓬蓬短裙，黑丝带，水晶蝴蝶结颈链
【动作】站立，轻微侧身回眸
【镜头】中景缓慢推近至面部特写
【构图】人物居中，三分法留白
【环境】黑色背景红舞台光
【光线】高对比侧逆光，轮廓光
【色彩】黑红金三色，电影感调色
【材质】纱裙轻透，颈链水晶反光
【运动】镜头缓推
【负面】文字，水印，变形，多手`;

const server = createServer();
let browser;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text()}`); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function', { timeout: 10_000 });

  // 1. System Prompt 含结构化要求
  const sysOk = await page.evaluate(() => /【结构化】/.test(RP_VISION_SYSTEM) && /【主体】/.test(RP_VISION_SYSTEM) && /【负面】/.test(RP_VISION_SYSTEM));
  check('System Prompt 已要求结构化输出（10字段）', sysOk);

  // 2. parseRpStructured 解析
  const parsed = await page.evaluate((t) => parseRpStructured(t), MOCK_MODEL_OUTPUT);
  check('parseRpStructured 解析出 10 个字段', Object.keys(parsed).length === 10, JSON.stringify(Object.keys(parsed)));
  check('主体字段值正确', parsed.subject === '黑发女性，白色抹胸蓬蓬短裙，黑丝带，水晶蝴蝶结颈链', parsed.subject);
  check('负面字段值正确', parsed.negative === '文字，水印，变形，多手', parsed.negative);

  // 3. 无结构化段的旧文本 → {}
  const parsedOld = await page.evaluate(() => parseRpStructured('一段普通的老式反推文本，没有结构化标记'));
  check('旧格式文本解析为空（兼容不崩）', Object.keys(parsedOld).length === 0);

  // 4. rpFieldsToPrompt 合成
  const composed = await page.evaluate((f) => rpFieldsToPrompt(f), parsed);
  check('字段合成提示词（含负面约束行）', composed.includes('黑发女性') && composed.includes('负面约束：文字，水印，变形，多手') && !composed.startsWith('负面'), composed.slice(0, 60) + '…');

  // 5. UI：反推节点渲染字段卡片
  const ui = await page.evaluate((modelOut) => {
    clearGraph();
    const rp = addNode('reversePrompt', 0, 0);
    rp.params.prompt = modelOut; // 模拟生成完成
    buildNodeBody(rp.el, rp);
    const sec = rp.el.querySelector('.rp-fields-section');
    const rows = sec ? sec.querySelectorAll('.rp-fields-row') : [];
    const inputs = [...rows].map(r => ({ label: r.querySelector('.rp-fields-label').textContent, value: r.querySelector('.rp-fields-input').value }));
    const sendBtn = sec && [...sec.querySelectorAll('button')].find(b => /送到 AI 绘图节点/.test(b.textContent));
    return { visible: !!sec && sec.style.display !== 'none', rowCount: rows.length, inputs, hasSend: !!sendBtn, storedFields: Object.keys(rp.params.fields || {}).length };
  }, MOCK_MODEL_OUTPUT);
  check('反推节点显示结构化字段卡片（自动从全文解析）', ui.visible && ui.rowCount === 10, `rows=${ui.rowCount}`);
  check('字段值渲染正确（主体）', ui.inputs.some(i => i.label === '主体' && i.value.includes('白色抹胸')), JSON.stringify(ui.inputs.slice(0, 2)));
  check('有「🎨 送到 AI 绘图节点」按钮', ui.hasSend);
  check('解析结果已存 node.params.fields', ui.storedFields === 10, `fields=${ui.storedFields}`);

  // 6. 字段可编辑
  const edited = await page.evaluate(() => {
    const rp = [...workflow.nodes.values()].find(n => n.type === 'reversePrompt');
    const inp = [...rp.el.querySelectorAll('.rp-fields-input')][0];
    inp.value = '编辑后的主体描述';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return rp.params.fields.subject;
  });
  check('字段编辑即时保存到 params.fields', edited === '编辑后的主体描述', edited);

  // 7. 一键套用：新 AI 绘图节点 + 连线 + 负面同步
  const applied = await page.evaluate(() => {
    const rp = [...workflow.nodes.values()].find(n => n.type === 'reversePrompt');
    const before = workflow.nodes.size;
    const ai = applyRpToAiNode(rp);
    if (!ai) return { ok: false };
    return {
      ok: true,
      created: workflow.nodes.size === before + 1,
      type: ai.type,
      title: ai.title,
      prompt: ai.prompt,
      negative: ai.params && ai.params.negativePrompt,
      edges: workflow.edges.size,
      connected: [...workflow.edges.values()].some(e => e.from.node.id === rp.id && e.to.node.id === ai.id),
    };
  });
  check('一键套用新建 AI 绘图节点', applied.ok && applied.created && applied.type === 'aiImage', applied.title);
  check('新节点提示词 = 字段合成（含编辑后的主体）', applied.prompt && applied.prompt.includes('编辑后的主体描述') && applied.prompt.includes('负面约束'), (applied.prompt || '').slice(0, 80));
  check('负面约束同步到负向词', applied.negative === '文字，水印，变形，多手', applied.negative);
  check('反推节点→AI绘图节点自动连线', applied.connected && applied.edges >= 1, `edges=${applied.edges}`);

  // 8. 旧格式全文（无字段）→ 送到 AI 节点用全文兜底
  const fallback = await page.evaluate(() => {
    const rp2 = addNode('reversePrompt', 0, 500);
    rp2.params.prompt = '一段老式反推全文，没有任何结构化字段';
    delete rp2.params.fields;
    buildNodeBody(rp2.el, rp2);
    const ai2 = applyRpToAiNode(rp2);
    return { secHidden: rp2.el.querySelector('.rp-fields-section').style.display === 'none', prompt: ai2 && ai2.prompt };
  });
  check('旧格式：字段卡片隐藏', fallback.secHidden);
  check('旧格式：一键套用兜底用全文', fallback.prompt === '一段老式反推全文，没有任何结构化字段', fallback.prompt);

  // 9. 空提示词友好提示
  const empty = await page.evaluate(() => {
    const rp3 = addNode('reversePrompt', 0, 900);
    rp3.params.prompt = '';
    const r = applyRpToAiNode(rp3);
    return r === null;
  });
  check('无提示词时套用返回 null（友好提示）', empty);

  // 10. 刷新恢复（fields 持久化）
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.FlowCraft && workflow, { timeout: 10_000 });
  const restored = await page.evaluate(() => {
    const rps = [...workflow.nodes.values()].filter(n => n.type === 'reversePrompt');
    const withFields = rps.find(n => n.params.fields && Object.keys(n.params.fields).length);
    return { rpCount: rps.length, fieldsCount: withFields ? Object.keys(withFields.params.fields).length : 0 };
  });
  check('刷新后 params.fields 持久化恢复', restored.rpCount >= 1 && restored.fieldsCount === 10, JSON.stringify(restored));

  check('全程无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  if (browser) await browser.close();
  server.close();
}
const failed = checks.filter(c => !c.passed).length;
console.log(`\n==== 反推提示词结构化专项：PASS=${checks.length - failed} FAIL=${failed} ====`);
process.exit(failed ? 1 : 0);
