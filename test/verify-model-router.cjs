// 阶段 9 · 多模型路由验证（T9-5）
// 覆盖：模型注册表 CRUD / 路由引擎（capability + cost/speed/quality 策略 / 禁用排除 / 无可用回退）/
//       opt-in 网关 _routeModel / 健康监控 record-summary-all / 跨刷新持久化。
// 纯本地，无需代理/凭证/真实用户；经 window.FlowCraft.{models,router,health,_legacy} 驱动。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HTML_PORT = 8169;
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
  const near = (a, b, tol) => Math.abs(Number(a) - Number(b)) <= (tol == null ? 0.2 : tol);

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
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.models && window.FlowCraft.router && window.FlowCraft.health, { timeout: 15000 });

  // —— 1. API 与版本 ——
  const ver = await page.evaluate(() => window.FlowCraft.version);
  ok('1.1 版本 = 3.11-comfyui', ver === '3.11-comfyui', ver);
  ok('1.2 models 注册表 API 存在', await page.evaluate(() => { const m = window.FlowCraft.models; return !!(m && m.list && m.add && m.update && m.remove && m.setEnabled && m.reset); }));
  ok('1.3 router 路由引擎 API 存在', await page.evaluate(() => { const r = window.FlowCraft.router; return !!(r && r.select && r.setEnabled && r.setStrategy && r.enabled && r.strategy); }));
  ok('1.4 health 健康监控 API 存在', await page.evaluate(() => { const h = window.FlowCraft.health; return !!(h && h.record && h.summary && h.all && h.reset); }));
  ok('1.5 _legacy._routeModel 网关存在', await page.evaluate(() => !!(window.FlowCraft._legacy && typeof window.FlowCraft._legacy._routeModel === 'function')));

  // —— 2. 种子清单 ——
  const seed = await page.evaluate(() => window.FlowCraft.models.list());
  ok('2.1 种子模型数 = 6', seed.length === 6, seed.length);
  ok('2.2 默认启用数 = 6（当前种子全启用）', seed.filter((m) => m.enabled).length === 6, seed.filter((m) => m.enabled).map((m) => m.id));
  ok('2.3 可精确取 gpt-5.4', await page.evaluate(() => { const m = window.FlowCraft.models.get('openai/gpt-5.4'); return !!m && m.model === 'gpt-5.4' && m.provider === 'openai'; }));

  // —— 3. 注册表 CRUD ——
  const crud = await page.evaluate(() => {
    const M = window.FlowCraft.models;
    const before = M.list().length;
    const added = M.add({ provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o-mini', capabilities: ['text'], cost: 0.3, speed: 0.9, quality: 0.8 });
    const mid = M.list().length;
    const got = M.get(added.id);
    M.update(added.id, { label: 'Mini' });
    const upd = M.get(added.id);
    M.setEnabled(added.id, false);
    const dis = M.get(added.id);
    M.setEnabled(added.id, true);
    const rm = M.remove(added.id);
    const after = M.list().length;
    M.reset();
    const resetLen = M.list().length;
    return { before, mid, addedId: added.id, gotId: got && got.id, updLabel: upd && upd.label, disEnabled: dis && dis.enabled, rm, after, resetLen };
  });
  ok('3.1 add 后 +1', crud.mid === crud.before + 1, crud);
  ok('3.2 get 返回新增项', crud.gotId === crud.addedId, crud);
  ok('3.3 update 生效（label=Mini）', crud.updLabel === 'Mini', crud);
  ok('3.4 setEnabled(false) 生效', crud.disEnabled === false, crud);
  ok('3.5 remove 成功', crud.rm === true, crud);
  ok('3.6 remove 后回到原长度', crud.after === crud.before, crud);
  ok('3.7 reset 恢复 6 条种子', crud.resetLen === 6, crud.resetLen);

  // 以下路由测试统一启用智能路由
  await page.evaluate(() => { window.FlowCraft.router.setEnabled(true); window.FlowCraft.router.setStrategy('quality'); });

  // —— 4. 按 capability 选择（默认 quality + 启用项）——
  const cap = await page.evaluate(() => ({
    text: window.FlowCraft.router.select({ capability: 'text' }),
    image: window.FlowCraft.router.select({ capability: 'image' }),
    video: window.FlowCraft.router.select({ capability: 'video' }),
  }));
  ok('4.1 text→claude-sonnet-4-6（quality 最高 0.96）', cap.text.model === 'claude-sonnet-4-6' && cap.text.provider === 'anthropic', cap.text);
  ok('4.2 image→gpt-image-2（唯一启用图像）', cap.image.model === 'gpt-image-2' && cap.image.provider === 'openai', cap.image);
  ok('4.3 video→回退 kling（无启用视频模型）', cap.video.fallback === true && cap.video.provider === 'kling' && /no-enabled-model:fallback/.test(cap.video.reason), cap.video);

  // —— 5. 策略切换（cost/speed/quality）——
  const strat = await page.evaluate(() => {
    const out = {};
    window.FlowCraft.router.setStrategy('cost');
    out.cost = window.FlowCraft.router.select({ capability: 'text' });
    out.costOverride = window.FlowCraft.router.select({ capability: 'text', strategy: 'cost' }); // 显式覆盖
    window.FlowCraft.router.setStrategy('speed');
    out.speed = window.FlowCraft.router.select({ capability: 'text' });
    window.FlowCraft.router.setStrategy('quality');
    out.quality = window.FlowCraft.router.select({ capability: 'text' });
    return out;
  });
  ok('5.1 cost→deepseek-v4-flash（0.1 最低价）', strat.cost.model === 'deepseek-v4-flash' && /cost-best/.test(strat.cost.reason), strat.cost);
  ok('5.2 cost 显式覆盖参数仍选 deepseek-v4-flash', strat.costOverride.model === 'deepseek-v4-flash', strat.costOverride);
  ok('5.3 speed→gemini-3-flash-preview（0.95 最快）', strat.speed.model === 'gemini-3-flash-preview' && /speed-best/.test(strat.speed.reason), strat.speed);
  ok('5.4 quality→claude-sonnet-4-6（0.96 最高质）', strat.quality.model === 'claude-sonnet-4-6' && /quality-best/.test(strat.quality.reason), strat.quality);

  // —— 6. 禁用项排除 → 无可用回退 ——
  const dis = await page.evaluate(() => {
    const textIds = window.FlowCraft.models.list().filter((m) => m.capabilities.includes('text')).map((m) => m.id);
    textIds.forEach((id) => window.FlowCraft.models.setEnabled(id, false));
    const r = window.FlowCraft.router.select({ capability: 'text' });
    textIds.forEach((id) => window.FlowCraft.models.setEnabled(id, true));
    return r;
  });
  ok('6.1 全部文本模型禁用→回退（fallback=true）', dis.fallback === true && /no-enabled-model:fallback/.test(dis.reason), dis);

  // —— 7. 跨厂商胜出（claude 默认启用且 quality 最高；禁用后回落到 gpt-5.4）——
  const cross = await page.evaluate(() => {
    window.FlowCraft.router.setStrategy('quality');
    const withClaude = window.FlowCraft.router.select({ capability: 'text' });
    window.FlowCraft.models.setEnabled('anthropic/claude-sonnet-4-6', false);
    const withoutClaude = window.FlowCraft.router.select({ capability: 'text' });
    window.FlowCraft.models.setEnabled('anthropic/claude-sonnet-4-6', true);
    return { withClaude, withoutClaude };
  });
  ok('7.1 quality→claude（0.96 最高）', cross.withClaude.model === 'claude-sonnet-4-6' && cross.withClaude.provider === 'anthropic', cross.withClaude);
  ok('7.2 禁用 claude 后 quality→gpt-5.4（0.95 次高）', cross.withoutClaude.model === 'gpt-5.4' && cross.withoutClaude.provider === 'openai', cross.withoutClaude);

  // —— 8. opt-in 网关 _routeModel（未启用返回 null，启用返回 select 结果）——
  const gate = await page.evaluate(() => {
    const L = window.FlowCraft._legacy;
    window.FlowCraft.router.setEnabled(false);
    const off = L._routeModel('text');
    window.FlowCraft.router.setEnabled(true);
    const on = L._routeModel('text');
    const exp = window.FlowCraft.router.select({ capability: 'text' });
    return { off, on, exp };
  });
  ok('8.1 路由禁用时网关返回 null（沿用现网模型）', gate.off === null, gate.off);
  ok('8.2 路由启用时网关返回对象', gate.on && typeof gate.on === 'object' && !!gate.on.model, gate.on);
  ok('8.3 网关结果与 router.select 一致', gate.on && gate.exp && gate.on.model === gate.exp.model && gate.on.provider === gate.exp.provider, gate);

  // —— 9. 健康监控 ——
  const h = await page.evaluate(() => {
    const H = window.FlowCraft.health;
    H.reset();
    H.record({ modelId: 'openai/gpt-5.4', ok: true, ms: 100 });
    H.record({ modelId: 'openai/gpt-5.4', ok: true, ms: 100 });
    H.record({ modelId: 'openai/gpt-5.4', ok: false, ms: 200 });
    const s = H.summary('openai/gpt-5.4');
    const unseen = H.summary('openai/nonexistent');
    H.record({ modelId: 'openai/gpt-image-2', ok: true, ms: 80 });
    const all = H.all();
    return { s, unseen, all };
  });
  ok('9.1 summary 计数=3（2成功/1失败）', h.s.count === 3 && h.s.success === 2 && h.s.fail === 1, h.s);
  ok('9.2 成功率=0.667', h.s.successRate === 0.667, h.s.successRate);
  ok('9.3 平均耗时=133.3ms', near(h.s.avgMs, 133.3, 0.2), h.s.avgMs);
  ok('9.4 状态=degraded（有失败且成功率≥0.5）', h.s.status === 'degraded', h.s.status);
  ok('9.5 未记录模型状态=unknown/成功率为null', h.unseen.status === 'unknown' && h.unseen.successRate === null, h.unseen);
  ok('9.6 all() 含两条记录', !!h.all['openai/gpt-5.4'] && !!h.all['openai/gpt-image-2'], Object.keys(h.all));

  // —— 10. 跨刷新持久化（localStorage）——
  await page.evaluate(() => { window.FlowCraft.router.setEnabled(true); window.FlowCraft.router.setStrategy('quality'); window.FlowCraft.models.setEnabled('anthropic/claude-sonnet-4-6', true); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.router, { timeout: 15000 });
  const persist = await page.evaluate(() => ({
    enabled: window.FlowCraft.router.enabled(),
    claudeOn: window.FlowCraft.models.get('anthropic/claude-sonnet-4-6').enabled,
    text: window.FlowCraft.router.select({ capability: 'text' }),
    image: window.FlowCraft.router.select({ capability: 'image' }),
  }));
  ok('10.1 刷新后路由仍启用', persist.enabled === true, persist.enabled);
  ok('10.2 刷新后 claude 启用态持久化', persist.claudeOn === true, persist.claudeOn);
  ok('10.3 刷新后 text→claude（持久化生效）', persist.text.model === 'claude-sonnet-4-6', persist.text);
  ok('10.4 刷新后 image→gpt-image-2', persist.image.model === 'gpt-image-2', persist.image);

  // —— R. 无页面异常 ——
  ok('R.1 运行期无页面/控制台错误', pageErrors.length === 0, pageErrors.slice(0, 3));

  console.log(`\n结果：${pass}/${pass + fail} 通过` + (failed.length ? ('；失败：' + failed.join(' | ')) : ''));
  if (pageErrors.length) console.log('页面错误：' + pageErrors.slice(0, 5).join(' || '));
  await browser.close();
  htmlServer.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('运行异常：', e); process.exit(2); });
