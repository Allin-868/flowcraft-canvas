// 刷新恢复专项：验证 IndexedDB 当前项目回灌不会回到示例画布，也不会丢节点/连线/编辑数据。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
let pass = 0, fail = 0;
function ok(name, condition, extra) {
  if (condition) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' :: ' + extra : '')); }
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(FILE));
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = 'http://127.0.0.1:' + port + '/index.html';
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // 清理测试数据库后重新打开，确保不受本机历史项目影响。
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('flowcraft-db');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.editor && window.FlowCraft.storage, null, { timeout: 15000 });
  await page.waitForTimeout(400);

  const initial = await page.evaluate(() => {
    const wf = window.FlowCraft._legacy.workflow;
    return {
      nodeCount: wf.nodes.size,
      edgeCount: wf.edges.size,
      titles: [...wf.nodes.values()].map((n) => n.title),
    };
  });
  ok('首次无保存数据时保持空白画布', initial.nodeCount === 0 && initial.edgeCount === 0, JSON.stringify(initial));

  const before = await page.evaluate(async () => {
    const { editor } = window.FlowCraft;
    editor.clear();
    const input = editor.addNode('image', 180, 220);
    input.title = '刷新恢复参考图';
    input.width = 352;
    input.height = 264;
    input.prompt = '不应丢失的提示词';
    input.params.fields = { ...(input.params.fields || {}), resolution: '2K' };
    input.el.style.width = input.width + 'px';
    input.el.style.minHeight = input.height + 'px';
    window.buildNodeBody(input.el, input);

    const output = editor.addNode('aiImage', 620, 220);
    output.title = '刷新恢复生成节点';
    output.prompt = '刷新后仍应保留';
    output.width = 420;
    output.height = 300;
    output.el.style.width = output.width + 'px';
    output.el.style.minHeight = output.height + 'px';
    window.buildNodeBody(output.el, output);
    editor.connectNodes(input.id, 0, output.id, 0);
    window.scheduleAutosave();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const edges = [...window.FlowCraft._legacy.workflow.edges.values()];
    return {
      inputId: input.id,
      outputId: output.id,
      nodeCount: window.FlowCraft._legacy.workflow.nodes.size,
      edgeCount: edges.length,
      input: { x: input.x, y: input.y, width: input.width, height: input.height, title: input.title, prompt: input.prompt },
      output: { x: output.x, y: output.y, width: output.width, height: output.height, title: output.title, prompt: output.prompt },
      edge: edges[0] ? { from: edges[0].from.node.id, to: edges[0].to.node.id, fromPort: edges[0].from.port, toPort: edges[0].to.port } : null,
    };
  });

  ok('刷新前写入 2 个测试节点', before.nodeCount === 2, JSON.stringify(before));
  ok('刷新前写入 1 条连线', before.edgeCount === 1, JSON.stringify(before));
  ok('刷新前节点数据完整', before.input.title === '刷新恢复参考图' && before.output.prompt === '刷新后仍应保留');

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft._legacy && window.FlowCraft._legacy.workflow, null, { timeout: 15000 });
  await page.waitForTimeout(1200);

  const after = await page.evaluate((ids) => {
    const wf = window.FlowCraft._legacy.workflow;
    const input = wf.nodes.get(ids.inputId);
    const output = wf.nodes.get(ids.outputId);
    const edges = [...wf.edges.values()];
    return {
      nodeCount: wf.nodes.size,
      edgeCount: edges.length,
      input: input && { x: input.x, y: input.y, width: input.width, height: input.height, title: input.title, prompt: input.prompt },
      output: output && { x: output.x, y: output.y, width: output.width, height: output.height, title: output.title, prompt: output.prompt },
      edge: edges[0] && { from: edges[0].from.node.id, to: edges[0].to.node.id, fromPort: edges[0].from.port, toPort: edges[0].to.port },
    };
  }, { inputId: before.inputId, outputId: before.outputId });

  ok('刷新后仍为 2 个节点', after.nodeCount === 2, JSON.stringify(after));
  ok('刷新后仍为 1 条连线', after.edgeCount === 1, JSON.stringify(after));
  ok('刷新后节点位置与尺寸一致', JSON.stringify(after.input) === JSON.stringify(before.input) && JSON.stringify(after.output) === JSON.stringify(before.output));
  ok('刷新后标题与提示词一致', after.input && after.input.title === before.input.title && after.output && after.output.prompt === before.output.prompt);
  ok('刷新后连线端点一致', JSON.stringify(after.edge) === JSON.stringify(before.edge), JSON.stringify(after.edge));
  ok('刷新后没有回到示例画布', !(after.input && after.input.title === '参考图') && !(after.nodeCount === 0));
  ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log('\n==== 刷新恢复专项：' + pass + ' 通过, ' + fail + ' 失败 ====');
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error('FATAL', error);
  try { server.close(); } catch (e) {}
  process.exit(2);
});
