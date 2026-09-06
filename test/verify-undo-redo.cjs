// 阶段 7 · 撤销/重做验证（T7-5）
// 经 window.FlowCraft.history / editor 本地驱动，覆盖 8 类操作：
//   addNode / deleteNode / move / connect / param / shot / scene / group
// 校验：每类操作 do→undo→redo 往返一致；复合操作(group)合并为单条；容量上限 100；按钮禁用态；连续撤销全复原。
// 纯本地，无需代理/凭证/真实用户。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HTML_PORT = 8163;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.zip': 'application/zip' };

const htmlServer = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  let pass = 0, fail = 0; const failed = [];
  function ok(name, cond, extra) {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; failed.push(name); console.log('  ❌ ' + name + (extra !== undefined ? (' → ' + JSON.stringify(extra)) : '')); }
  }
  const st = (page) => page.evaluate(() => window.FlowCraft.editor.state());
  const undoN = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.FlowCraft.history.undo(); }, n);
  const redoN = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.FlowCraft.history.redo(); }, n);
  // 每组测试前：清空画布 + 清空历史栈，得到确定性空基线
  const reset = (page) => page.evaluate(() => { window.FlowCraft.editor.clear(); window.FlowCraft.history.clear(); });

  await new Promise((r) => htmlServer.listen(HTML_PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|favicon|\b404\b/i.test(t)) return;
    pageErrors.push('console:' + t);
  });

  await page.goto(`http://127.0.0.1:${HTML_PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.history && window.FlowCraft.editor && window.FlowCraft.editor.state, { timeout: 15000 });
  await reset(page); // 清空首次加载自动播种的默认画布

  // —— 1. API 与初始状态 ——
  const ver = await page.evaluate(() => window.FlowCraft.version);
  ok('1.1 版本 = 3.11-comfyui', ver === '3.11-comfyui', ver);
  ok('1.2 history API 存在', await page.evaluate(() => !!(window.FlowCraft.history && window.FlowCraft.history.undo && window.FlowCraft.history.redo)));
  ok('1.3 editor API 存在', await page.evaluate(() => !!(window.FlowCraft.editor && window.FlowCraft.editor.addNode && window.FlowCraft.editor.state)));
  const init = await st(page);
  ok('1.4 初始画布为空（节点/连线/场景/镜头=0）', init.nodeCount === 0 && init.edgeCount === 0 && init.sceneCount === 0 && init.shotCount === 0, init);
  ok('1.5 初始无可撤销', init.canUndo === false && init.canRedo === false);

  // —— 2. 连续撤销全复原（7 类操作混合）——
  const ids = await page.evaluate(() => {
    const E = window.FlowCraft.editor;
    const a = E.addNode('text', 10, 10).id;
    E.moveNode(a, 500, 500);
    const b = E.addNode('text', 300, 300).id;
    E.connectNodes(a, 0, b, 0);
    E.setParam(a, 'prompt', 'hello');
    E.addShot({ name: 'S1', prompt: 'p' });
    E.createScene('sc1');
    return { a, b };
  });
  const afterOps = await st(page);
  ok('2.1 操作后节点=2', afterOps.nodeCount === 2, afterOps.nodeCount);
  ok('2.2 操作后连线=1', afterOps.edgeCount === 1, afterOps.edgeCount);
  ok('2.3 操作后镜头=1', afterOps.shotCount === 1, afterOps.shotCount);
  ok('2.4 操作后场景=1', afterOps.sceneCount === 1, afterOps.sceneCount);
  ok('2.5 操作后参数已写', afterOps.nodes[ids.a].params.prompt === 'hello', afterOps.nodes[ids.a]);
  await undoN(page, 7);
  const restored = await st(page);
  ok('2.6 撤销 7 次全复原（节点）', restored.nodeCount === init.nodeCount, restored.nodeCount);
  ok('2.7 撤销 7 次全复原（连线）', restored.edgeCount === init.edgeCount, restored.edgeCount);
  ok('2.8 撤销 7 次全复原（场景）', restored.sceneCount === init.sceneCount, restored.sceneCount);
  ok('2.9 撤销 7 次全复原（镜头）', restored.shotCount === init.shotCount, restored.shotCount);
  ok('2.10 全复原后不可再撤销', restored.canUndo === false);
  await redoN(page, 7);
  const redone = await st(page);
  ok('2.11 重做 7 次回到操作后状态', redone.nodeCount === 2 && redone.edgeCount === 1 && redone.sceneCount === 1 && redone.shotCount === 1, redone);
  await reset(page);

  // —— 3. addNode / deleteNode + 按钮态 ——
  const aId = await page.evaluate(() => window.FlowCraft.editor.addNode('text', 10, 10).id);
  let s = await st(page);
  ok('3.1 新增节点 → 计数 1', s.nodeCount === 1, s.nodeCount);
  ok('3.2 新增后可撤销', s.canUndo === true);
  ok('3.3 新增后不可重做', s.canRedo === false);
  await undoN(page, 1); s = await st(page);
  ok('3.4 撤销 → 计数 0', s.nodeCount === 0, s.nodeCount);
  ok('3.5 撤销到空 → 不可再撤销', s.canUndo === false);
  await redoN(page, 1); s = await st(page);
  ok('3.6 重做 → 计数 1', s.nodeCount === 1, s.nodeCount);
  await page.evaluate((id) => window.FlowCraft.editor.deleteNode(id), aId); s = await st(page);
  ok('3.7 删除 → 计数 0', s.nodeCount === 0, s.nodeCount);
  await undoN(page, 1); s = await st(page);
  ok('3.8 撤销删除 → 节点复原', s.nodeCount === 1, s.nodeCount);
  await redoN(page, 1); s = await st(page);
  ok('3.9 重做删除 → 计数 0', s.nodeCount === 0, s.nodeCount);
  await reset(page);

  // —— 4. move（拖动合并为单条）——
  const mId = await page.evaluate(() => window.FlowCraft.editor.addNode('text', 0, 0).id);
  await page.evaluate((id) => window.FlowCraft.editor.moveNode(id, 600, 400), mId);
  let p1 = await page.evaluate((id) => window.FlowCraft.editor.state().nodes[id], mId);
  ok('4.1 移动后坐标变化', p1.x === 600 && p1.y === 400, p1);
  await undoN(page, 1); p1 = await page.evaluate((id) => window.FlowCraft.editor.state().nodes[id], mId);
  ok('4.2 撤销移动 → 坐标回原点', p1.x === 0 && p1.y === 0, p1);
  await redoN(page, 1); p1 = await page.evaluate((id) => window.FlowCraft.editor.state().nodes[id], mId);
  ok('4.3 重做移动 → 坐标恢复', p1.x === 600 && p1.y === 400, p1);
  await reset(page);

  // —— 5. connect ——
  const cA = await page.evaluate(() => window.FlowCraft.editor.addNode('text', 0, 0).id);
  const cB = await page.evaluate(() => window.FlowCraft.editor.addNode('text', 50, 50).id);
  await page.evaluate(({ a, b }) => window.FlowCraft.editor.connectNodes(a, 0, b, 0), { a: cA, b: cB });
  s = await st(page); ok('5.1 连线后 edgeCount=1', s.edgeCount === 1, s.edgeCount);
  await undoN(page, 1); s = await st(page); ok('5.2 撤销连线 → edgeCount=0', s.edgeCount === 0, s.edgeCount);
  await redoN(page, 1); s = await st(page); ok('5.3 重做连线 → edgeCount=1', s.edgeCount === 1, s.edgeCount);
  await reset(page);

  // —— 6. param ——
  const pId = await page.evaluate(() => window.FlowCraft.editor.addNode('text', 0, 0).id);
  await page.evaluate((id) => window.FlowCraft.editor.setParam(id, 'prompt', 'world'), pId);
  let pr = await page.evaluate((id) => window.FlowCraft.editor.state().nodes[id].params.prompt, pId);
  ok('6.1 参数已设置', pr === 'world', pr);
  await undoN(page, 1); pr = await page.evaluate((id) => window.FlowCraft.editor.state().nodes[id].params.prompt, pId);
  ok('6.2 撤销参数 → 回退', pr === undefined || pr === '', pr);
  await redoN(page, 1); pr = await page.evaluate((id) => window.FlowCraft.editor.state().nodes[id].params.prompt, pId);
  ok('6.3 重做参数 → 恢复', pr === 'world', pr);
  await reset(page);

  // —— 7. shot（增/删）——
  const sh = await page.evaluate(() => window.FlowCraft.editor.addShot({ name: '镜头A', prompt: 'pp' }));
  s = await st(page); ok('7.1 新增镜头 → shotCount=1', s.shotCount === 1, s.shotCount);
  await undoN(page, 1); s = await st(page); ok('7.2 撤销镜头 → shotCount=0', s.shotCount === 0, s.shotCount);
  await redoN(page, 1); s = await st(page); ok('7.3 重做镜头 → shotCount=1', s.shotCount === 1, s.shotCount);
  await page.evaluate((id) => window.FlowCraft.editor.deleteShot(id), sh.id); s = await st(page);
  ok('7.4 删除镜头 → shotCount=0', s.shotCount === 0, s.shotCount);
  await undoN(page, 1); s = await st(page); ok('7.5 撤销删除 → 镜头复原', s.shotCount === 1, s.shotCount);
  await reset(page);

  // —— 8. scene（增/删）——
  const sc = await page.evaluate(() => window.FlowCraft.editor.createScene('场景A'));
  s = await st(page); ok('8.1 新增场景 → sceneCount=1', s.sceneCount === 1, s.sceneCount);
  await undoN(page, 1); s = await st(page); ok('8.2 撤销场景 → sceneCount=0', s.sceneCount === 0, s.sceneCount);
  await redoN(page, 1); s = await st(page); ok('8.3 重做场景 → sceneCount=1', s.sceneCount === 1, s.sceneCount);
  await page.evaluate((id) => window.FlowCraft.editor.deleteScene(id), sc.id); s = await st(page);
  ok('8.4 删除场景 → sceneCount=0', s.sceneCount === 0, s.sceneCount);
  await undoN(page, 1); s = await st(page); ok('8.5 撤销删除 → 场景复原', s.sceneCount === 1, s.sceneCount);
  await reset(page);

  // —— 9. group（复合操作合并为单条撤销项）——
  const gShot = await page.evaluate(() => window.FlowCraft.editor.addShot({ name: 'G1', prompt: 'gp' }));
  const beforeGroup = await st(page);
  await page.evaluate((id) => window.FlowCraft.editor.createGroup(id), gShot.id);
  const afterGroup = await st(page);
  ok('9.1 生成节点组 → 新增 3 节点', afterGroup.nodeCount === beforeGroup.nodeCount + 3, { before: beforeGroup.nodeCount, after: afterGroup.nodeCount });
  ok('9.2 生成节点组 → 新增 1 场景', afterGroup.sceneCount === beforeGroup.sceneCount + 1, afterGroup.sceneCount);
  ok('9.3 生成节点组 → 仅 1 条历史（合并）', afterGroup.historySize === beforeGroup.historySize + 1, { before: beforeGroup.historySize, after: afterGroup.historySize });
  await undoN(page, 1);
  const afterGroupUndo = await st(page);
  ok('9.4 单条撤销移除整个节点组', afterGroupUndo.nodeCount === beforeGroup.nodeCount && afterGroupUndo.sceneCount === beforeGroup.sceneCount, afterGroupUndo);
  await redoN(page, 1);
  const afterGroupRedo = await st(page);
  ok('9.5 单条重做恢复节点组', afterGroupRedo.nodeCount === afterGroup.nodeCount && afterGroupRedo.sceneCount === afterGroup.sceneCount, afterGroupRedo);
  await reset(page);

  // —— 10. 容量上限 100 ——
  await page.evaluate(() => { for (let i = 0; i < 110; i++) window.FlowCraft.editor.addNode('text', i * 10, i * 10); });
  const cap = await st(page);
  ok('10.1 110 次操作后历史栈 ≤ 100（容量上限生效）', cap.historySize <= 100 && cap.historySize >= 99, cap.historySize);

  // —— R. 无页面异常 ——
  ok('R.1 运行期无页面/控制台错误', pageErrors.length === 0, pageErrors.slice(0, 3));

  console.log(`\n结果：${pass}/${pass + fail} 通过` + (failed.length ? ('；失败：' + failed.join(' | ')) : ''));
  if (pageErrors.length) console.log('页面错误：' + pageErrors.slice(0, 5).join(' || '));
  await browser.close();
  htmlServer.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('运行异常：', e); process.exit(2); });
