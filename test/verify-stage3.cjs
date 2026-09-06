// 阶段 3 · 任务执行引擎验证（T3-8）
// 经本地 HTTP 服务加载构建产物，用可控的 executeNodeAsync 替身 + 合成节点，
// 校验：状态机 / DAG 依赖 / 超时 / 取消 / 幂等 / 重试 / 对账。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8139;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.zip': 'application/zip' };

const server = http.createServer((req, res) => {
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
  let pass = 0, fail = 0;
  const failed = [];
  function ok(name, cond, extra) {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; failed.push(name); console.log('  ❌ ' + name + (extra !== undefined ? (' → ' + JSON.stringify(extra)) : '')); }
  }

  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|favicon|\b404\b/i.test(t)) return; // 资源 404 噪声
    pageErrors.push('console:' + t);
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.runner && typeof window.FlowCraft.runner.getMode === 'function', { timeout: 10000 });

  // —— S. 引擎挂载与版本 ——
  const ver = await page.evaluate(() => window.FlowCraft.version);
  const mode = await page.evaluate(() => window.FlowCraft.runner.getMode());
  ok('S1 版本号 = 3.11-comfyui', ver === '3.11-comfyui', ver);
  ok('S2 引擎模式 = task-engine', mode === 'task-engine', mode);

  // —— 引擎行为测试（合成节点 + 可控 executor）——
  const r = await page.evaluate(async () => {
    const out = {};
    const R = window.FlowCraft.runner;
    const _wf = window.workflow, _ex = window.executeNodeAsync;
    function setFakeExec() {
      window.executeNodeAsync = async (node, delay) => {
        node.status = 'running';
        const plan = node.__plan || { result: 'done' };
        if (plan.delay) await new Promise((res) => setTimeout(res, plan.delay));
        if (plan.result === 'done') { node.status = 'done'; node.outputsData = [{ type: 'image', value: 'data:img' }]; }
        else if (plan.result === 'error') { node.status = 'error'; node._lastError = 'net'; }
        else if (plan.result === 'failure') { node.status = 'failure'; }
        else if (plan.result === 'hang') { await new Promise((res) => setTimeout(res, 60000)); }
      };
    }
    function fakeWF() { const w = { edges: new Map(), nodes: new Map() }; window.workflow = w; return w; }

    // 2. DAG + 成功 + 失败重试（error → transient → 重试 2 次 → failure）
    R.reset(); let w = fakeWF(); setFakeExec();
    const n1 = { id: 'n1', type: 'text', status: 'idle', __plan: { result: 'done' } };
    // aiImage/imageEdit 按产品策略不自动重试（单张 20~45s），重试用例改用可重试类型，策略本身见 2.5
    const n2 = { id: 'n2', type: 'upscale', status: 'idle', __plan: { result: 'error' } };
    w.nodes.set('n1', n1); w.nodes.set('n2', n2);
    w.edges.set('e1', { from: { node: 'n1' }, to: { node: 'n2' } });
    await R.runInOrder([n1, n2], 0, new Set());
    out.n1 = n1.status; out.n2 = n2.status;
    out.n2states = R.getState().filter((t) => t.nodeId === 'n2').map((t) => t.state);

    // 2.5 产品策略：aiImage 生图失败不自动重试，立即 failure 由用户手动重试
    R.reset(); w = fakeWF(); setFakeExec();
    const n3 = { id: 'n3', type: 'aiImage', status: 'idle', __plan: { result: 'error' } };
    w.nodes.set('n3', n3);
    await R.runInOrder([n3], 0, new Set());
    out.n3states = R.getState().filter((t) => t.nodeId === 'n3').map((t) => t.state);

    // 3. 超时（_timeoutOverride 加速）
    R.reset(); w = fakeWF(); setFakeExec();
    const t1 = { id: 't1', type: 'aiImage', status: 'idle', __plan: { result: 'hang', delay: 2000 } };
    t1._timeoutOverride = 500;
    w.nodes.set('t1', t1);
    await R.runInOrder([t1], 0, new Set());
    out.t1task = (R.getState().find((t) => t.nodeId === 't1') || {}).state;

    // 4. 取消（pending 节点直接跳过）
    R.reset(); w = fakeWF(); setFakeExec();
    const c1 = { id: 'c1', type: 'text', status: 'idle', __plan: { result: 'done' } };
    const c2 = { id: 'c2', type: 'aiImage', status: 'idle', __plan: { result: 'done' } };
    w.nodes.set('c1', c1); w.nodes.set('c2', c2);
    w.edges.set('ce', { from: { node: 'c1' }, to: { node: 'c2' } });
    await R.cancel('c2');
    await R.runInOrder([c1, c2], 0, new Set());
    out.c1 = c1.status; out.c2 = c2.status;
    out.c2task = (R.getState().find((t) => t.nodeId === 'c2') || {}).state;
    R.clearCancel('c2');

    // 5. 幂等（相同输入第二次命中缓存，不重算）
    R.reset(); w = fakeWF(); setFakeExec();
    const i1 = { id: 'i1', type: 'text', status: 'idle', __plan: { result: 'done' } };
    w.nodes.set('i1', i1);
    await R.runInOrder([i1], 0, new Set());
    const first = R.getState().find((t) => t.nodeId === 'i1') || {};
    await R.runInOrder([i1], 0, new Set());
    const allI = R.getState().filter((t) => t.nodeId === 'i1');
    out.idemFirstCached = !!first.cached;
    out.idemSecondCached = !!(allI[allI.length - 1] && allI[allI.length - 1].cached);
    out.idemCount = allI.length;

    // 6. 对账（崩溃遗留 running → failure）
    R.reset(); w = fakeWF(); setFakeExec();
    const h1 = { id: 'h1', type: 'text', status: 'idle', __plan: { result: 'hang' } };
    w.nodes.set('h1', h1);
    R.runInOrder([h1], 0, new Set()); // 不 await，保持 running
    await new Promise((res) => setTimeout(res, 300));
    out.reconciled = await R.reconcile();

    // 还原
    window.workflow = _wf; window.executeNodeAsync = _ex;
    return out;
  });

  ok('2.1 n1 成功 (done)', r.n1 === 'done', r.n1);
  ok('2.2 n2 节点状态保持 legacy error（行为等价）', r.n2 === 'error', r.n2);
  ok('2.3 n2 经历重试 (含 retrying)', r.n2states.includes('retrying'), r.n2states);
  ok('2.4 n2 任务最终 failure（含重试）', r.n2states[r.n2states.length - 1] === 'failure', r.n2states);
  ok('2.5 aiImage 失败不自动重试（产品策略）', !r.n3states.includes('retrying') && r.n3states[r.n3states.length - 1] === 'failure', r.n3states);

  ok('3.1 超时标记 timeout', r.t1task === 'timeout', r.t1task);

  ok('4.1 c1 正常执行 (done)', r.c1 === 'done', r.c1);
  ok('4.2 c2 被取消 (cancelled)', r.c2task === 'cancelled', r.c2task);

  ok('5.1 首次执行非缓存', r.idemFirstCached === false, r.idemFirstCached);
  ok('5.2 二次执行命中缓存', r.idemSecondCached === true, r.idemSecondCached);
  ok('5.3 幂等两次共 2 条任务', r.idemCount === 2, r.idemCount);

  ok('6.1 对账修复 ≥1 个 running 任务', r.reconciled >= 1, r.reconciled);

  // 回归门：页面无真实错误
  ok('R1 加载无真实页面错误', pageErrors.length === 0, pageErrors);

  await browser.close();
  server.close();

  console.log('\n阶段 3 验证：' + pass + ' 通过 / ' + fail + ' 失败');
  if (fail > 0) { console.log('失败项：' + failed.join('、')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error('运行异常：', e); process.exit(2); });
