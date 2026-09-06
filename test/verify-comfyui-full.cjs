// 阶段 9.2 · ComfyUI 工作流 UI 验证（T9-6~T9-9）
// 覆盖：模板库(≥5)/解析为可编辑表单/表单值回填/JSON 导入导出/浮动编辑器面板/节点体按钮/执行目标决策/旧节点体行为等价。
// 纯本地，无需真实 ComfyUI 服务。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HTML_PORT = 8171;
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
  await page.waitForFunction(() => window.FlowCraft && window.FlowCraft.comfyui && window.FlowCraft._legacy && window.FlowCraft._legacy._comfyExecTarget, { timeout: 15000 });

  // —— 1. API 与版本 ——
  const ver = await page.evaluate(() => window.FlowCraft.version);
  ok('1.1 版本 = 3.11-comfyui', ver === '3.11-comfyui', ver);
  ok('1.2 comfyui 模块 API 存在', await page.evaluate(() => { const c = window.FlowCraft.comfyui; return !!(c && c.templates && c.listTemplates && c.parseWorkflow && c.applyFormValues && c.importWorkflow && c.exportWorkflow); }));
  ok('1.3 _legacy._comfyExecTarget 存在', await page.evaluate(() => typeof window.FlowCraft._legacy._comfyExecTarget === 'function'));
  ok('1.4 _legacy.renderComfyNodeBody 存在', await page.evaluate(() => typeof window.FlowCraft._legacy.renderComfyNodeBody === 'function'));

  // —— 2. 模板库（T9-8）——
  const tpl = await page.evaluate(() => {
    const c = window.FlowCraft.comfyui;
    const list = c.listTemplates();
    const valid = list.every((t) => { try { const wf = c.exportWorkflow(c.getTemplate(t.id)); c.importWorkflow(wf); return true; } catch (e) { return false; } });
    const t2 = c.parseWorkflow(c.getTemplate('txt2img'));
    const types = t2.nodes.map((n) => n.class_type);
    return { count: list.length, valid, types };
  });
  ok('2.1 模板数 ≥ 5', tpl.count >= 5, tpl.count);
  ok('2.2 所有模板均为合法标准格式', tpl.valid === true, tpl.valid);
  ok('2.3 txt2img 含 KSampler/CLIPTextEncode/VAEDecode', ['KSampler', 'CLIPTextEncode', 'VAEDecode'].every((t) => tpl.types.includes(t)), tpl.types);

  // —— 3. 解析为可编辑表单（T9-6）——
  const parse = await page.evaluate(() => {
    const c = window.FlowCraft.comfyui;
    const wf = c.getTemplate('txt2img');
    const r = c.parseWorkflow(wf);
    const ks = r.nodes.find((n) => n.class_type === 'KSampler');
    const fieldNames = ks.fields.map((f) => f.name);
    const steps = ks.fields.find((f) => f.name === 'steps');
    const model = ks.inputs ? null : null;
    // model 是连线引用，应排除
    const hasLinkExcluded = !fieldNames.includes('model');
    return { nodeCount: r.nodes.length, fieldNames, stepsType: steps && steps.type, stepsVal: steps && steps.value, hasLinkExcluded };
  });
  ok('3.1 解析出多节点', parse.nodeCount >= 5, parse.nodeCount);
  ok('3.2 KSampler 字段含 steps/cfg/seed', ['steps', 'cfg', 'seed'].every((f) => parse.fieldNames.includes(f)), parse.fieldNames);
  ok('3.3 steps 为 number 类型', parse.stepsType === 'number', parse.stepsType);
  ok('3.4 连线引用(model)被排除出表单', parse.hasLinkExcluded === true, parse.hasLinkExcluded);

  // —— 4. 表单值回填（T9-6）——
  const apply = await page.evaluate(() => {
    const c = window.FlowCraft.comfyui;
    const wf = c.getTemplate('txt2img');
    const edited = c.applyFormValues(wf, { '3': { steps: 40, cfg: 9 } });
    const r = c.parseWorkflow(edited);
    const ks = r.nodes.find((n) => n.class_type === 'KSampler');
    const steps = ks.fields.find((f) => f.name === 'steps').value;
    const cfg = ks.fields.find((f) => f.name === 'cfg').value;
    const keep = ks.fields.find((f) => f.name === 'sampler_name').value;
    // 错误字段名忽略
    const edited2 = c.applyFormValues(wf, { '3': { nope: 1 } });
    const r2 = c.parseWorkflow(edited2);
    const ks2 = r2.nodes.find((n) => n.class_type === 'KSampler');
    const stillLink = Array.isArray(ks2.inputs ? null : (c.getTemplate('txt2img')['3'].inputs.model));
    return { steps, cfg, keep, unchanged: ks2.fields.find((f) => f.name === 'steps').value };
  });
  ok('4.1 回填 steps=40 生效', apply.steps === 40, apply.steps);
  ok('4.2 回填 cfg=9 生效', apply.cfg === 9, apply.cfg);
  ok('4.3 未填字段保留原值(sampler_name=euler)', apply.keep === 'euler', apply.keep);
  ok('4.4 不存在字段名被忽略', apply.unchanged === 25, apply.unchanged);

  // —— 5. 导入校验（T9-7）——
  const imp = await page.evaluate(() => {
    const c = window.FlowCraft.comfyui;
    let okValid = false, miss = false, bad = false, empty = false;
    try { c.importWorkflow(c.exportWorkflow(c.getTemplate('txt2img'))); okValid = true; } catch (e) {}
    try { c.importWorkflow('{"3":{"inputs":{"x":1}}}'); } catch (e) { miss = true; } // 缺 class_type
    try { c.importWorkflow('not json'); } catch (e) { bad = true; }
    try { c.importWorkflow('{}'); } catch (e) { empty = true; } // 无节点
    return { okValid, miss, bad, empty };
  });
  ok('5.1 合法 JSON 导入成功', imp.okValid === true);
  ok('5.2 缺 class_type → 抛错', imp.miss === true);
  ok('5.3 非 JSON 字符串 → 抛错', imp.bad === true);
  ok('5.4 空对象(无节点) → 抛错', imp.empty === true);

  // —— 6. 导出往返（T9-7）——
  const exp = await page.evaluate(() => {
    const c = window.FlowCraft.comfyui;
    const wf = c.getTemplate('img2img');
    const e1 = c.exportWorkflow(wf);
    const round = c.exportWorkflow(c.importWorkflow(e1));
    let stable = false;
    try { stable = JSON.stringify(c.importWorkflow(e1)) === JSON.stringify(c.importWorkflow(round)); } catch (e) {}
    let invalidThrows = false;
    try { c.exportWorkflow({ not: 'wf' }); } catch (e) { invalidThrows = true; }
    return { stable, invalidThrows, len: e1.length };
  });
  ok('6.1 导出→导入→导出 往返稳定', exp.stable === true, exp.stable);
  ok('6.2 非法工作流导出 → 抛错', exp.invalidThrows === true);

  // —— 7. 浮动编辑器面板（T9-9）——
  const panel = await page.evaluate(() => {
    const c = window.FlowCraft.comfyui;
    const out = {};
    out.toggle = !!document.getElementById('fcCwToggle');
    out.opts = document.querySelectorAll('#fcCwTpl option').length;
    const fakeNode = { params: { wf: 'txt2img' } };
    window.FlowCraft._openComfyEditor(fakeNode);
    const p = document.getElementById('fcCwPanel');
    out.display = p.style.display;
    out.taLen = (document.getElementById('fcCwJson').value || '').length;
    out.formFields = document.querySelectorAll('#fcCwForm .fcw-f').length;
    // 编辑 KSampler.steps = 40
    let stepsInput = null;
    document.querySelectorAll('#fcCwForm .fcw-node').forEach((box) => {
      const _t = box.querySelector('.fcw-title'); if (((_t.title || '') + _t.textContent).indexOf('KSampler') >= 0 || _t.textContent.indexOf('采样器') >= 0) {
        box.querySelectorAll('.fcw-f').forEach((row) => {
          const _lb = row.querySelector('label'); if (_lb && (_lb.title === 'steps' || _lb.textContent === 'steps' || _lb.textContent === '采样步数')) stepsInput = row.querySelector('input');
        });
      }
    });
    if (stepsInput) { stepsInput.value = '40'; stepsInput.dispatchEvent(new Event('input', { bubbles: true })); }
    const afterEdit = c.parseWorkflow(document.getElementById('fcCwJson').value).nodes.find((n) => n.class_type === 'KSampler').fields.find((f) => f.name === 'steps').value;
    out.stepsAfterEdit = afterEdit;
    // 应用到节点
    document.getElementById('fcCwApply').click();
    out.applied = fakeNode.params && fakeNode.params.customJson ? fakeNode.params.customJson.length : 0;
    out.appliedValid = (function () { try { c.importWorkflow(fakeNode.params.customJson); return true; } catch (e) { return false; } })();
    return out;
  });
  ok('7.1 编辑器开关按钮存在', panel.toggle === true);
  ok('7.2 模板下拉 ≥ 5 项', panel.opts >= 5, panel.opts);
  ok('7.3 打开编辑器→面板可见+JSON 非空+表单字段>0', panel.display === 'block' && panel.taLen > 0 && panel.formFields > 0, panel);
  ok('7.4 编辑表单 steps=40 同步回 JSON', panel.stepsAfterEdit === 40, panel.stepsAfterEdit);
  ok('7.5 应用写入节点 customJson(合法)', panel.applied > 0 && panel.appliedValid === true, panel.applied);

  // —— 8. comfyui 节点体按钮（T9-9）——
  const body = await page.evaluate(() => {
    const E = window.FlowCraft.editor;
    const r = E.addNode('comfyui', 10, 10);
    const node = window.FlowCraft._legacy.getNode(r.id);
    const el = window.FlowCraft._legacy.renderComfyNodeBody(node);
    const hasEditBtn = !!el.querySelector('.comfy-edit-btn');
    const hasOldSelect = !!el.querySelector('.comfy-wf');
    const hasOldAddr = !!el.querySelector('.comfy-addr');
    const hasOldRun = !!el.querySelector('.comfy-run');
    // 模拟点击 → 打开面板
    if (hasEditBtn) el.querySelector('.comfy-edit-btn').click();
    const display = document.getElementById('fcCwPanel').style.display;
    return { hasEditBtn, hasOldSelect, hasOldAddr, hasOldRun, display };
  });
  ok('8.1 comfyui 节点体含「工作流编辑器」按钮', body.hasEditBtn === true);
  ok('8.2 点击按钮→编辑器面板打开', body.display === 'block', body.display);
  ok('8.3 旧节点体(工作流选择)仍保留', body.hasOldSelect === true);
  ok('8.4 旧节点体(地址/运行)仍保留', body.hasOldAddr === true && body.hasOldRun === true);

  // —— 9. 执行目标决策（T9-7 代理钩子）——
  const tgt = await page.evaluate(() => {
    const f = window.FlowCraft._legacy._comfyExecTarget;
    const local = f({ params: {} });
    const proxyNode = f({ params: { comfyProxyBase: 'https://tunnel.example.com' } });
    window.FlowCraft.__comfyuiProxyBase__ = 'https://global.example.com';
    const proxyGlobal = f({ params: {} });
    delete window.FlowCraft.__comfyuiProxyBase__;
    return { local, proxyNode, proxyGlobal };
  });
  ok('9.1 默认本地直连 → local', tgt.local === 'local', tgt.local);
  ok('9.2 节点配置 comfyProxyBase → proxy', tgt.proxyNode === 'proxy', tgt.proxyNode);
  ok('9.3 全局 __comfyuiProxyBase__ → proxy', tgt.proxyGlobal === 'proxy', tgt.proxyGlobal);

  // —— R. 无页面异常 ——
  ok('R.1 运行期无页面/控制台错误', pageErrors.length === 0, pageErrors.slice(0, 3));

  console.log(`\n结果：${pass}/${pass + fail} 通过` + (failed.length ? ('；失败：' + failed.join(' | ')) : ''));
  if (pageErrors.length) console.log('页面错误：' + pageErrors.slice(0, 5).join(' || '));
  await browser.close();
  htmlServer.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('运行异常：', e); process.exit(2); });
