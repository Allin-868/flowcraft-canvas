// 阶段 1 下批验证：多项目面板 (T1-3) + 恢复点 UI (T1-5)
// 经本地 HTTP 服务加载（IndexedDB 可用），覆盖存储 API + 面板 UI 接线。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name + (extra ? ' :: ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' :: ' + extra : '')); }
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(FILE));
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = 'http://localhost:' + port + '/index.html';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  // 全新数据库，避免历史数据干扰
  await page.goto(base);
  await page.evaluate(() => new Promise((res) => { try { indexedDB.deleteDatabase('flowcraft-db'); } catch (e) {} setTimeout(res, 200); }));
  await page.reload();
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.storage && window.FlowCraft.storage.getMode, { timeout: 10000 });
  await page.waitForTimeout(300);

  console.log('\n[1] 存储接口与覆盖');
  const mode = await page.evaluate(() => window.FlowCraft.storage.getMode());
  ok('storage 模式为 indexeddb', mode === 'indexeddb', mode);
  const hasOverride = await page.evaluate(() => typeof window.updateWorkflowPanel === 'function');
  ok('updateWorkflowPanel 已覆盖', hasOverride);

  console.log('\n[2] 多项目：保存 / 列表 / 改名 / 删除');
  const p1 = await page.evaluate(() => window.FlowCraft.storage.saveAs('项目甲'));
  const p2 = await page.evaluate(() => window.FlowCraft.storage.saveAs('项目乙'));
  ok('saveAs 返回 id (甲)', typeof p1 === 'string' && p1.length > 0, p1);
  ok('saveAs 返回 id (乙)', typeof p2 === 'string' && p2.length > 0, p2);
  const list1 = await page.evaluate(() => window.FlowCraft.storage.list());
  ok('列表含两个项目', list1.length >= 2, 'len=' + list1.length);
  ok('列表含 项目甲', list1.some((x) => x.name === '项目甲'));
  const renamed = await page.evaluate((id) => window.FlowCraft.storage.renameProject(id, '项目乙改'), p2);
  ok('renameProject 成功', renamed === true);
  const list2 = await page.evaluate(() => window.FlowCraft.storage.list());
  ok('改名生效', list2.some((x) => x.name === '项目乙改'));
  const del = await page.evaluate((id) => window.FlowCraft.storage.deleteProject(id), p1);
  ok('deleteProject 成功', del === true);
  const list3 = await page.evaluate(() => window.FlowCraft.storage.list());
  ok('删除后列表不含 项目甲', !list3.some((x) => x.name === '项目甲'));

  console.log('\n[3] 打开项目 (open → applyWorkflowData)');
  // 先建一个带节点的项目
  await page.evaluate(() => {
    if (typeof workflow !== 'undefined' && workflow.nodes) {
      workflow.nodes.set('pn1', { id: 'pn1', type: 'image', title: 'PN1', x: 0, y: 0, width: 280, height: 200, prompt: '', params: {}, status: 'idle', inputsData: [], outputsData: [] });
    }
  });
  const p3 = await page.evaluate(() => window.FlowCraft.storage.saveAs('项目丙'));
  const opened = await page.evaluate((id) => window.FlowCraft.storage.open(id), p3);
  ok('open 返回项目对象', opened && typeof opened === 'object');
  ok('open 返回含 nodes', opened && Array.isArray(opened.nodes));
  // 通过面板「打开」按钮接线验证（卡片渲染 + 点击）
  await page.evaluate(() => window.updateWorkflowPanel());
  await page.waitForSelector('#workflowList .wf-card', { timeout: 5000 });
  const cardCount = await page.$$eval('#workflowList .wf-card', (els) => els.length);
  ok('面板渲染出项目卡片', cardCount >= 1, 'cards=' + cardCount);
  const acts = await page.$$eval('#workflowList .wf-card button', (els) => els.map((b) => b.dataset.act));
  ok('卡片含 open/export/rename/del 动作', ['open', 'export', 'rename', 'del'].every((a) => acts.includes(a)), acts.join(','));

  console.log('\n[4] 导出 .flowcraft (ZIP)');
  const zipInfo = await page.evaluate(async () => {
    const blob = await window.FlowCraft.storage.exportProject({ projectName: '项目丙' });
    return blob ? { size: blob.size, type: blob.type } : null;
  });
  ok('exportProject 返回 Blob', zipInfo && zipInfo.size > 0, JSON.stringify(zipInfo));
  ok('Blob 类型为 zip', zipInfo && /zip/.test(zipInfo.type), zipInfo && zipInfo.type);

  console.log('\n[5] 导入 .flowcraft 往返');
  const imported = await page.evaluate(async () => {
    const blob = await window.FlowCraft.storage.exportProject({ projectName: '往返' });
    const file = new File([blob], 'roundtrip.flowcraft', { type: 'application/zip' });
    const proj = await window.FlowCraft.storage.importProject(file);
    return proj ? { ok: true, name: proj.name, nodes: Array.isArray(proj.nodes) ? proj.nodes.length : -1 } : { ok: false };
  });
  ok('importProject 往返成功', imported.ok === true, JSON.stringify(imported));
  ok('往返后项目名保留', imported.ok && imported.name === '往返', imported.name);

  console.log('\n[6] 恢复点 UI (T1-5)');
  const snap = await page.evaluate(() => window.FlowCraft.storage.snapshot('里程碑A'));
  ok('snapshot 返回 id', typeof snap === 'string' && snap.length > 0, snap);
  const snaps = await page.evaluate(() => window.FlowCraft.storage.listSnapshots());
  ok('listSnapshots 含 里程碑A', snaps.some((s) => (s.label || '').indexOf('里程碑A') >= 0));
  const restored = await page.evaluate((id) => window.FlowCraft.storage.restoreSnapshot(id), snap);
  ok('restoreSnapshot 返回项目', restored && typeof restored === 'object');
  const kept = await page.evaluate((id) => window.FlowCraft.storage.renameSnapshot(id, '[永久] 里程碑A'), snap);
  ok('renameSnapshot 成功', kept === true);
  const snaps2 = await page.evaluate(() => window.FlowCraft.storage.listSnapshots());
  ok('永久标记生效', snaps2.some((s) => (s.label || '').indexOf('[永久]') >= 0));
  const delSnap = await page.evaluate((id) => window.FlowCraft.storage.deleteSnapshot(id), snap);
  ok('deleteSnapshot 成功', delSnap === true);

  console.log('\n[7] 面板 UI 接线');
  await page.click('#btnWorkflow');
  await page.waitForTimeout(300);
  const snapBlock = await page.$('#snapshotBlock');
  ok('工作流面板内注入 snapshotBlock', !!snapBlock);
  const snapBtn = await page.$('#btnSnapshotSave');
  ok('保存恢复点按钮存在', !!snapBtn);
  const snapListRendered = await page.$('#snapshotList');
  ok('恢复点列表容器存在', !!snapListRendered);

  console.log('\n[8] 控制台错误');
  ok('无页面控制台错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  console.log('\n==== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ====');
  if (fail > 0) { console.log('失败项:'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
