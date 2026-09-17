// 冒烟：设计智能体节点（方案生成 → 结果卡 → 本地队列 → 建图节点 → 状态回传 → 类型色变量）
// 只验证本地能力与状态机，不调用真实模型，也不允许出现伪造的图片结果。
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

// 1. 建节点并生成方案
const plan = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const n = editor.addNode('designAgent', 260, 200);
  window.__da = n.id;
  n.params.brief = '橙色跑鞋街头广告片，霓虹夜景';
  const result = window.generateDesignAgentPlan(n);
  return {
    created: !!n && n.type === 'designAgent',
    hasSubject: result.indexOf('【设计主题】') >= 0 && result.indexOf('橙色跑鞋') >= 0,
    status: n.params.agentStatus,
    cards: n.params.resultCards.length,
    outType: n.outputsData && n.outputsData[0] ? n.outputsData[0].type : '',
    mode: n.resultMode,
  };
});
ok('设计智能体可建节点并产出结构化方案', plan.created && plan.hasSubject, plan);
ok('方案生成后状态为 done', plan.status === 'done', plan.status);
ok('默认任务产出 1 张结果卡', plan.cards === 1, plan.cards);
ok('输出端口为文本（可连下游提示词）', plan.outType === 'text', plan.outType);
ok('结果标注为本地能力，不冒充真实模型', plan.mode === 'local', plan.mode);

// 2. 25 宫格任务
const grid = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  n.params.task = '25 宫格分镜方案';
  window.generateDesignAgentPlan(n);
  return { cards: n.params.resultCards.length, first: n.params.resultCards[0].title, last: n.params.resultCards[24].title };
});
ok('25 宫格任务生成 25 张分镜卡', grid.cards === 25, grid.cards);
ok('分镜卡按镜号命名', grid.first === '镜头 01' && grid.last === '镜头 25', grid);

// 3. 入队与去重
const enq = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  const cards = n.params.resultCards.slice(0, 2);
  const added1 = window.enqueueDesignAgentCards(n, cards);
  const added2 = window.enqueueDesignAgentCards(n, cards);
  return { added1, added2, len: n.params.agentQueue.length };
});
ok('结果卡可入队', enq.added1 === 2, enq);
ok('重复入队被去重', enq.added2 === 0 && enq.len === 2, enq);

// 4. 本地队列执行
const started = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  window.startDesignAgentQueue(n);
  return { status: n.params.agentStatus, running: n.params.agentQueue.filter((i) => i.status === 'running').length };
});
ok('启动队列后进入 running 且单条在跑', started.status === 'running' && started.running === 1, started);
await page.waitForFunction(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  return n.params.agentStatus === 'done';
}, null, { timeout: 8000 });
const drained = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  return { done: n.params.agentQueue.filter((i) => i.status === 'done').length, queued: n.params.agentQueue.filter((i) => i.status === 'queued').length };
});
ok('队列逐条跑完且不残留 queued', drained.done === 2 && drained.queued === 0, drained);

// 5. 已完成任务落成图片节点
const made = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  const items = n.params.agentQueue.filter((i) => i.status === 'done' && !i.createdNodeId);
  const edgeBefore = window.FlowCraft._legacy.workflow.edges.size;
  const count = window.createDesignAgentImageNodes(n, items);
  const nodes = window.getDesignAgentCreatedImageNodes(n);
  const rects = nodes.map((x) => ({ x: x.x, y: x.y, width: x.width || 220, height: x.height || 160 }));
  let overlap = false;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    if (window.designAgentRectsOverlap(rects[i], rects[j])) overlap = true;
  }
  return {
    count,
    nodes: nodes.length,
    withPrompt: nodes.filter((x) => !!x.prompt).length,
    tagged: nodes.filter((x) => x.params.agentTaskId && x.params.agentResultGroup === n.id).length,
    connected: n.params.agentQueue.filter((i) => i.edgeCreated).length,
    edgeDelta: window.FlowCraft._legacy.workflow.edges.size - edgeBefore,
    overlap,
    fakeThumb: nodes.filter((x) => !!x.thumb).length,
  };
});
ok('已完成任务创建对应 AI 绘图节点', made.count === 2 && made.nodes === 2, made);
ok('任务提示词写入下游节点', made.withPrompt === 2, made);
ok('下游节点回写归属与任务 ID', made.tagged === 2, made);
ok('设计输出到图片节点建立连线', made.edgeDelta === 2 && made.connected === 2, made);
ok('新建节点互不重叠', made.overlap === false, made);
ok('未生成图片时不伪造缩略图', made.fakeThumb === 0, made);

// 6. 状态标签与节点被删的追溯
const labels = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  const items = n.params.agentQueue.filter((i) => i.createdNodeId);
  const before = window.getDesignAgentCreatedTaskStatus(items[0]);
  window.FlowCraft.editor.deleteNode(items[0].createdNodeId);
  const after = window.getDesignAgentCreatedTaskStatus(items[0]);
  return {
    before, after,
    labelBefore: window.getDesignAgentTaskStatusLabel(before),
    labelAfter: window.getDesignAgentTaskStatusLabel(after),
  };
});
ok('已建节点显示「已创建节点」', labels.before === 'node-created' && labels.labelBefore === '已创建节点', labels);
ok('下游节点删除后显示「节点已删除」', labels.after === 'node-missing' && labels.labelAfter === '节点已删除', labels);

// 7. 暂停与取消
const paused = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  window.enqueueDesignAgentCards(n, n.params.resultCards.slice(2, 6));
  window.startDesignAgentQueue(n);
  const runningNow = n.params.agentQueue.filter((i) => i.status === 'running').length;
  window.pauseDesignAgentQueue(n);
  return {
    runningNow,
    status: n.params.agentStatus,
    running: n.params.agentQueue.filter((i) => i.status === 'running').length,
    queued: n.params.agentQueue.filter((i) => i.status === 'queued').length,
  };
});
ok('暂停后无 running 项且回到 queued', paused.status === 'paused' && paused.running === 0 && paused.runningNow === 1, paused);

const cancelled = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  window.cancelDesignAgentQueue(n);
  const active = window.getDesignAgentQueueItems(n).filter((i) => i.status === 'queued' || i.status === 'running').length;
  return { status: n.params.agentStatus, active, cancelled: n.params.agentQueue.filter((i) => i.status === 'cancelled').length };
});
ok('取消清空待执行任务并回到 idle', cancelled.status === 'idle' && cancelled.active === 0 && cancelled.cancelled >= 1, cancelled);

// 8. 清理已完成时保留结果归属
const cleared = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  const createdBefore = n.params.agentQueue.filter((i) => i.createdNodeId).length;
  window.clearCompletedDesignAgentQueue(n);
  return { createdBefore, createdAfter: n.params.agentQueue.filter((i) => i.createdNodeId).length };
});
ok('清理已完成任务不丢已建节点归属', cleared.createdBefore > 0 && cleared.createdAfter === cleared.createdBefore, cleared);

// 9. 节点类型色变量守卫（设计智能体曾因缺定义而走空）
const css = await page.evaluate(() => {
  const rootStyle = getComputedStyle(document.documentElement);
  const missing = [];
  Object.keys(NODE_TYPES).forEach((k) => {
    const color = (NODE_TYPES[k] && NODE_TYPES[k].color) || '';
    const m = color.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (m && !rootStyle.getPropertyValue(m[1]).trim()) missing.push(k + ' -> ' + m[1]);
  });
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__da);
  return { missing, typeColor: n.el ? getComputedStyle(n.el).getPropertyValue('--type-color').trim() : '' };
});
ok('全部节点类型色变量均有定义', css.missing.length === 0, css.missing);
ok('设计智能体节点 --type-color 生效', /^#[0-9a-f]{3,8}$/i.test(css.typeColor), css.typeColor);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors);
await browser.close();
console.log(`\n==== 设计智能体冒烟：PASS=${pass} FAIL=${fail} ====`);
if (fail) process.exit(1);
