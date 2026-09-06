// 冒烟：生成等待反馈（阶段3）——运行态实时耗时徽章 + 骨架脉冲 + 扫光；失败态原因上节点；状态切换清理；角色状态节点不重复
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

const getN = (id) => `window.FlowCraft._legacy.workflow.nodes.get(${JSON.stringify(id)})`;

// 建普通 aiImage 节点
const gid = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const n = editor.addNode('aiImage', 300, 260);
  window.buildNodeBody(n.el, n);
  window.selectNode(n);
  return n.id;
});
await page.waitForTimeout(200);

// ===== A. 运行态：耗时徽章 + 骨架 + 扫光 =====
await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  window.setNodeStatus(n, 'running');
  window.updateNodeStatus(n);
}, gid);
await page.waitForTimeout(150);
const run1 = await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  const badge = n.el.querySelector('.node-elapsed');
  return {
    badgeText: badge ? badge.textContent : null,
    skeleton: n.el.classList.contains('node-skeleton'),
    veil: !!n.el.querySelector('.node-skeleton-veil'),
    marquee: n.el.classList.contains('node-marquee'),
    pillText: (n.el.querySelector('.node-status-pill') || {}).textContent,
  };
}, gid);
ok('运行态显示耗时徽章「生成中 · 0s」', run1.badgeText === '生成中 · 0s', run1);
ok('运行态媒体节点加骨架类', run1.skeleton === true, run1);
ok('运行态有骨架脉冲 veil', run1.veil === true, run1);
ok('运行态保留扫光边框 marquee', run1.marquee === true, run1);
ok('状态徽标为「生成中」', run1.pillText === '生成中', run1.pillText);

// ===== B. 耗时实时更新（≥1s）=====
await page.waitForTimeout(1400);
const run2 = await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  const badge = n.el.querySelector('.node-elapsed');
  return badge ? badge.textContent : null;
}, gid);
ok('耗时实时更新到 ≥1s', /生成中 · [1-9]\d*s/.test(run2 || ''), run2);

// ===== C. 失败态：原因上节点 + 运行占位清理 =====
await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  window.setNodeStatus(n, 'error', '模型额度不足，请检查中转配置');
  window.updateNodeStatus(n);
}, gid);
await page.waitForTimeout(150);
const err = await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  const box = n.el.querySelector('.node-error-reason');
  const msg = box ? box.querySelector('.node-error-msg') : null;
  const act = box ? box.querySelector('.node-error-action') : null;
  return {
    msgText: msg ? msg.textContent : null,
    msgTitle: msg ? msg.title : null,
    actionText: act ? act.textContent : null,
    badgeGone: !n.el.querySelector('.node-elapsed'),
    skeletonGone: !n.el.classList.contains('node-skeleton'),
    veilGone: !n.el.querySelector('.node-skeleton-veil'),
    pillText: (n.el.querySelector('.node-status-pill') || {}).textContent,
  };
}, gid);
ok('失败原因友好文案上节点', err.msgText === '模型额度不足，请检查中转配置', err.msgText);
ok('原始诊断保留在 title', err.msgTitle === '原始诊断：模型额度不足，请检查中转配置', err.msgTitle);
ok('额度类错误给出「打开设置」恢复动作', err.actionText === '打开设置', err.actionText);
ok('离开运行态耗时徽章移除', err.badgeGone === true, err);
ok('离开运行态骨架/veil 移除', err.skeletonGone === true && err.veilGone === true, err);
ok('状态徽标为「失败」', err.pillText === '失败', err.pillText);

// ===== D. 完成态：失败原因移除 =====
await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  window.setNodeStatus(n, 'done');
  window.updateNodeStatus(n);
}, gid);
await page.waitForTimeout(150);
const done = await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  return { reasonGone: !n.el.querySelector('.node-error-reason'), pillText: (n.el.querySelector('.node-status-pill') || {}).textContent };
}, gid);
ok('完成后失败原因移除', done.reasonGone === true, done);
ok('完成态徽标为「已完成」', done.pillText === '已完成', done.pillText);

// ===== E. 角色状态节点：失败原因不重复（由 renderCharacterStateInfo 负责）=====
const csId = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  const n = editor.addNode('aiImage', 720, 260);
  n.stateMeta = { label: '状态1' };
  window.buildNodeBody(n.el, n);
  window.setNodeStatus(n, 'error', '批量生成失败');
  window.updateNodeStatus(n);
  return n.id;
});
await page.waitForTimeout(200);
const cs = await page.evaluate((id) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(id);
  return { noDupReason: !n.el.querySelector('.node-error-reason') };
}, csId);
ok('角色状态节点不重复加 .node-error-reason', cs.noDupReason === true, cs);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 生成等待反馈冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
