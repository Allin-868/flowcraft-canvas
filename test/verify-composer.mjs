#!/usr/bin/env node
// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
/**
 * #5 节点下方独立 Composer（Details on Demand）专项回归。
 *
 * 2026-09-19 定性重写（原判 14/21，7 条失败全部在测试侧，不是产品缺陷）：
 *   1) 「比例 select 写回」：比例入口在 d6a9720（提交说明「规格选择改画布内浮动卡片(锚定/视口钳制/点外部关闭)」）
 *      就从 `<select>` 改成触发按钮 + 画布内浮层卡片。旧用例按 `.nc-select` 的**下标 [1]** 取控件，
 *      而现行下标 1 是 `<button class="nc-select nc-spec-select ai-spec-trigger">` → 给它赋 value 恒无效。
 *      现在改成真实点击触发器 → 点浮层里的 16:9 卡片 → 校验写回 + 触发器文案 + 节点按新比例重排。
 *      这条入口此前**全仓库没有任何用例覆盖**（用户改比例的唯一路径），现由本文件钉住。
 *   2) 「生成按钮 → done（FLUX.1 演示出图）」：占位图按 P0-4 真实/演示/未实现语义契约（同一提交 d6a9720）
 *      已移除，aiImage 统一走真实生成 → 没有 Key 时得到 error 才是正确行为。旧用例把「演示出图」写进注释
 *      当成契约，于是把一条正确行为记成失败。现在两条都要：无 Key → error 且**不得**出现占位图；
 *      有 Key + `page.route` 打桩 → done + resultMode=real + 有出图。
 *   3) 拖动/缩放/平移/切换选中「不跟随」：实现是对的（applyTransform 与 applyDragFrame 都会 positionNodeComposer），
 *      错在夹具——旧用例只改 `node.x` 却不改 `node.el.style.left`（元素没动），再拿
 *      `el.style.left`（canvasWrap 相对）去比 `node.x*zoom+cam.x`（视口绝对，且未算 wrap 左偏移 220px）。
 *      现在全部换成真实鼠标/滚轮操作 + 用两个 getBoundingClientRect 相对判据。
 *
 * 写法约定（与 verify-auto-connect / verify-ui-affordance 一致）：
 *   - 一律真实用户动作：page.click / page.fill / page.selectOption / page.mouse，不再用 evaluate 里合成事件；
 *   - 断言只看**渲染后几何**与**用户可见文案**，不接受「DOM 里有这个节点」代替「用户能用」；
 *   - 夹具失败（找不到可点落点等）必须显形为 FAIL，不能被 `[].every()` 之类的恒真掩掉。
 * 不填写真实 Key、不请求真实 AI 服务（AI 域名一律被 route 拦掉）。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PROJECT = resolve(SCRIPT_DIR, '../../..');
const ROOT = join(PROJECT, '输出成果', 'deploy');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const MOCK_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function createServer() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(ROOT, relative));
    if (!file.startsWith(`${ROOT}/`) && file !== join(ROOT, 'index.html')) { res.writeHead(403); res.end('forbidden'); return; }
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    try {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|404|Failed to load resource/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });
  const netSeen = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(`http://127.0.0.1:${port}`)) netSeen.push(request.method() + ' ' + request.url().replace(/^https?:\/\//, '').slice(0, 48));
  });
  // AI 域名一律本地打桩：既不真连，也能确认「确实外发了请求」
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`http://127.0.0.1`)) return route.continue();
    if (/images\/generations|responses|chat\/completions|generateContent|predict/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ b64_json: MOCK_IMG.split(',')[1] }] }) });
    }
    return route.abort();
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => window.FlowCraft && typeof addNode === 'function', { timeout: 10_000 });
  check('当前构建产物加载且无运行时错误', errors.length === 0, errors.join(' | '));

  // ── 页内工具：几何取样 + 可起拖落点查找 ──
  await page.evaluate(() => {
    window.__geo = (id) => {
      const n = workflow.nodes.get(id);
      const nr = n && n.el && n.el.isConnected ? n.el.getBoundingClientRect() : null;
      const el = document.getElementById('nodeComposer');
      const cr = el && !el.hidden ? el.getBoundingClientRect() : null;
      return {
        hidden: !el || el.hidden,
        node: nr && { l: Math.round(nr.left), r: Math.round(nr.right), t: Math.round(nr.top), b: Math.round(nr.bottom), w: Math.round(nr.width), h: Math.round(nr.height) },
        comp: cr && { l: Math.round(cr.left), r: Math.round(cr.right), t: Math.round(cr.top), b: Math.round(cr.bottom), w: Math.round(cr.width), h: Math.round(cr.height) },
        boundTo: __composerNode ? __composerNode.id : null,
      };
    };
    // 节点 mousedown 对 button/input/textarea/select/.node-port 直接 return（legacy.js:8048）
    // → 起拖点必须用 elementFromPoint 挑一个非交互落点，否则会「拖了个寂寞」
    window.__tapPoint = (id, allowInteractive = false) => {
      const el = workflow.nodes.get(id).el;
      const r = el.getBoundingClientRect();
      const bad = 'button, input, textarea, select, .node-port, .node-resize-handle, [contenteditable]';
      for (let dy = 6; dy < r.height - 6; dy += 6) {
        for (let dx = 6; dx < r.width - 6; dx += 6) {
          const x = r.left + dx, y = r.top + dy;
          const hit = document.elementFromPoint(x, y);
          if (!hit || hit.closest('.node') !== el) continue;
          if (!allowInteractive && hit.closest(bad)) continue;
          return { x, y, tag: String(hit.className || hit.tagName) };
        }
      }
      return null;
    };
    window.__seed = () => {
      clearGraph();
      workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform();
      // 摆在 canvasWrap 内、下方留足 Composer 高度（避让/钳制逻辑由 verify-composer-avoid 负责）
      // 注意：addNode 会顺带选中新节点 → 铺完必须把选中权交回 a，否则 Composer 绑错节点，
      // 整批写回断言都打在另一个节点上（本轮首版就这么错了一串）。
      const a = addNode('aiImage', 260, 40);
      const b = addNode('aiImage', 700, 40);
      selectNode(a);
      return { aId: a.id, bId: b.id };
    };
  });

  // ── 场景 1：选中 aiImage → Composer 浮现且结构完整（按 class 取控件，不再按下标） ──
  const ids = await page.evaluate(() => window.__seed());
  const s1 = await page.evaluate(() => {
    const el = document.getElementById('nodeComposer');
    const node = [...workflow.nodes.values()].find((n) => n.type === 'aiImage' && n === __composerNode);
    const selects = [...el.querySelectorAll('select.nc-select')];
    const trigger = el.querySelector('button.nc-spec-select');
    return {
      visible: !el.hidden,
      bound: !!node,
      hasTextarea: !!el.querySelector('textarea.nc-textarea'),
      modelTag: (() => { const m = el.querySelector('.nc-model'); return m ? `${m.tagName}|${m.options.length}` : null; })(),
      selectTitles: selects.map((s) => s.options[0] ? s.options[0].value : ''),
      triggerTag: trigger ? trigger.tagName : null,
      triggerTitle: trigger ? trigger.title : null,
      hasRun: !!el.querySelector('.nc-run'),
      hasAdv: !!el.querySelector('.nc-adv-toggle'),
      bodyControls: !!node.el.querySelector('.model-select, .run-btn, .param-select'),
    };
  });
  check('选中 aiImage 节点后 Composer 浮现并绑定该节点', s1.visible && s1.bound, JSON.stringify({ visible: s1.visible, bound: s1.bound }));
  check('Composer 含提示词输入框（textarea.nc-textarea）', s1.hasTextarea);
  check('模型入口是真 select 且含 5 个候选', s1.modelTag === 'SELECT|5', s1.modelTag);
  check('张数/模式参数各为 select（不再假设「4 个 nc-select」）', s1.selectTitles.length === 3 && s1.selectTitles.includes('1张') && s1.selectTitles.includes('同步'), s1.selectTitles.join(','));
  check('比例/分辨率入口已改为浮层触发按钮（d6a9720 卡片改版）', s1.triggerTag === 'BUTTON' && /比例与分辨率/.test(s1.triggerTitle || ''), s1.triggerTitle);
  check('Composer 含生成按钮与高级折叠', s1.hasRun && s1.hasAdv);
  check('节点 body 不再渲染模型/参数/运行按钮（清爽）', s1.bodyControls === false, String(s1.bodyControls));

  // ── 场景 2：定位在节点正下方（几何相对判据，不再用 node.x*zoom+cam.x 公式） ──
  const g0 = await page.evaluate((id) => window.__geo(id), ids.aId);
  check('空间充足时 Composer 贴在节点正下方（绑对节点 + 左缘对齐 + 顶边在底边之下）',
    g0.boundTo === ids.aId && !!g0.comp && !!g0.node && Math.abs(g0.comp.l - g0.node.l) <= 4 && g0.comp.t >= g0.node.b - 1 && g0.comp.t - g0.node.b <= 24,
    JSON.stringify({ boundTo: g0.boundTo, node: g0.node, comp: g0.comp }));

  // ── 场景 3：真实用户动作写回参数 ──
  await page.fill('#nodeComposer textarea.nc-textarea', '一条红色的龙在云端');
  const w1 = await page.evaluate((id) => {
    const n = workflow.nodes.get(id);
    return { prompt: n.prompt, paramsModel: n.params.model };
  }, ids.aId);
  check('提示框输入写回 node.prompt', w1.prompt === '一条红色的龙在云端', JSON.stringify(w1));

  await page.selectOption('#nodeComposer .nc-model', 'FLUX.1');
  const w2 = await page.evaluate((id) => ({ paramsModel: workflow.nodes.get(id).params.model }), ids.aId);
  check('模型下拉真实选择写回 node.params.model', w2.paramsModel === 'FLUX.1', JSON.stringify(w2));

  // 比例：真实点击触发器 → 浮层 → 点 16:9 卡片
  await page.click('#nodeComposer .nc-spec-select');
  await page.waitForTimeout(200);
  const pop = await page.evaluate(() => {
    const p = document.getElementById('aiSpecPopover');
    const shown = !!(p && p.classList.contains('show'));
    const cs = p ? getComputedStyle(p) : null;
    const cards = p ? [...p.querySelectorAll('.ai-aspect-card')].map((c) => {
      const r = c.getBoundingClientRect();
      return { text: c.textContent.trim(), reachable: cs.display !== 'none' && r.width >= 6 && r.height >= 6 };
    }) : [];
    const target = p ? [...p.querySelectorAll('.ai-aspect-card')].find((c) => c.textContent.trim() === '16:9') : null;
    const tr = target ? target.getBoundingClientRect() : null;
    return { exists: !!p, shown, cards, tap: tr ? { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 } : null };
  });
  check('比例浮层真实弹出且 11 个比例卡片可点', pop.shown === true && pop.cards.length === 11 && pop.cards.every((c) => c.reachable) && !!pop.tap,
    JSON.stringify({ shown: pop.shown, cards: pop.cards.length, bad: pop.cards.filter((c) => !c.reachable).map((c) => c.text) }));
  if (pop.tap) {
    await page.mouse.click(pop.tap.x, pop.tap.y);
    await page.waitForTimeout(250);
  }
  const w3 = await page.evaluate((id) => {
    const n = workflow.nodes.get(id);
    const trig = document.querySelector('#nodeComposer .nc-spec-select');
    return { aspect: n.params.aspect, triggerText: trig ? trig.textContent.trim() : null, w: Math.round(n.el.getBoundingClientRect().width), h: Math.round(n.el.getBoundingClientRect().height) };
  }, ids.aId);
  check('点 16:9 卡片写回 node.params.aspect（不是给按钮赋 value）', w3.aspect === '16:9', JSON.stringify(w3));
  check('触发器文案同步为 16:9（用户能看到当前比例）', /16:9/.test(w3.triggerText || ''), w3.triggerText);
  // 宽容差会造假绿：旧版 0.6 的容差连未重排的 220×160（1.375）都能过
  check('节点框按新比例重排（实测宽高 ≈ 16:9）', Math.abs((w3.w / w3.h) - 16 / 9) <= 0.15, JSON.stringify({ w: w3.w, h: w3.h, ratio: Math.round((w3.w / w3.h) * 100) / 100 }));

  // ── 场景 4：真实拖动 / 滚轮缩放 / 中键平移 → Composer 跟随 ──
  const start = await page.evaluate((id) => window.__tapPoint(id), ids.aId);
  check('夹具能找到节点上的可起拖落点', !!start, JSON.stringify(start));
  const before = await page.evaluate((id) => window.__geo(id), ids.aId);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 130, start.y + 45, { steps: 6 });
  await page.waitForTimeout(120);
  const during = await page.evaluate((id) => window.__geo(id), ids.aId);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterDrag = await page.evaluate((id) => window.__geo(id), ids.aId);
  const glued = (g) => !!g.comp && !!g.node && Math.abs(g.comp.l - g.node.l) <= 2 && g.comp.t >= g.node.b - 1;
  check('拖动中 Composer 实时跟随（未等松手才跳）', glued(during) && Math.abs(during.node.l - before.node.l) > 20,
    JSON.stringify({ before: before.node, during: during.node, comp: during.comp }));
  check('松手后仍贴回节点下方且左缘对齐（含吸附位移）', glued(afterDrag) && Math.abs(afterDrag.node.l - during.node.l) <= 24,
    JSON.stringify({ node: afterDrag.node, comp: afterDrag.comp }));

  const wrapRect = await page.evaluate(() => {
    const r = document.getElementById('canvasWrap').getBoundingClientRect();
    return { x: r.left + r.width * 0.45, y: r.top + 180 };
  });
  await page.mouse.move(wrapRect.x, wrapRect.y);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(200);
  const afterZoom = await page.evaluate((id) => window.__geo(id), ids.aId);
  check('滚轮缩放后仍按渲染几何贴合节点（zoom≠1 时也不脱节）', glued(afterZoom) && afterZoom.comp.w >= afterZoom.node.w - 2,
    JSON.stringify({ node: afterZoom.node, comp: afterZoom.comp }));

  await page.mouse.move(wrapRect.x + 260, wrapRect.y + 260);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(wrapRect.x + 380, wrapRect.y + 320, { steps: 6 });
  await page.waitForTimeout(150);
  await page.mouse.up({ button: 'middle' });
  const afterPan = await page.evaluate((id) => window.__geo(id), ids.aId);
  check('中键平移画布后仍贴合节点（pan 走 applyTransform→positionNodeComposer）', glued(afterPan),
    JSON.stringify({ node: afterPan.node, comp: afterPan.comp }));

  // ── 场景 5：真实点击切换选中另一个 aiImage → Composer 跟到新节点 ──
  // 先把相机复位：上一场景的缩放/平移会把第二个节点推出视口，那时面板走避让/钳制分支（由 avoid 用例负责）
  await page.evaluate(() => { workflow.camera.x = 0; workflow.camera.y = 0; workflow.camera.zoom = 1; applyTransform(); });
  await page.waitForTimeout(150);
  const bPoint = await page.evaluate((id) => window.__tapPoint(id), ids.bId);
  check('夹具能找到第二个节点的可点落点', !!bPoint, JSON.stringify(bPoint));
  await page.mouse.move(bPoint.x, bPoint.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
  const switched = await page.evaluate((id) => window.__geo(id), ids.bId);
  check('切换选中另一个 aiImage → Composer 改绑并跟到新节点', switched.boundTo === ids.bId && glued(switched),
    JSON.stringify({ boundTo: switched.boundTo, node: switched.node, comp: switched.comp }));
  // 新节点也要有提示词，否则「无 Key 报错」会因为空提示词而失去意义
  await page.fill('#nodeComposer textarea.nc-textarea', '一条红色的龙在云端');

  // ── 场景 6：无 Key 点生成 → 按 P0-4 语义报错，不得给占位图 ──
  await page.evaluate(() => localStorage.removeItem('flowcraft-openai-key'));
  await page.click('#nodeComposer .nc-run');
  await page.waitForFunction((id) => workflow.nodes.get(id).status === 'error', ids.bId, { timeout: 8_000 });
  const noKey = await page.evaluate((id) => {
    const n = workflow.nodes.get(id);
    return {
      status: n.status, thumb: !!n.thumb, resultMode: n.resultMode,
      toast: [...document.querySelectorAll('[class*="toast"]')].map((t) => t.textContent.trim()).filter(Boolean).slice(-1)[0] || '',
    };
  }, ids.bId);
  check('无 Key 生成 → status=error 且提示补齐 Key（P0-4 已移除演示占位图）',
    noKey.status === 'error' && /Key/.test(noKey.toast), JSON.stringify({ status: noKey.status, toast: noKey.toast.slice(0, 40) }));
  check('无 Key 时不得伪造出图（thumb=false、resultMode 不是 demo）',
    noKey.thumb === false && noKey.resultMode !== 'demo', JSON.stringify({ thumb: noKey.thumb, resultMode: noKey.resultMode }));

  // ── 场景 7：有 Key + 打桩 → 真实点击生成出图完成 ──
  await page.evaluate(() => localStorage.setItem('flowcraft-openai-key', 'sk-mock-for-regression'));
  const runReach = await page.evaluate(() => {
    const b = document.querySelector('#nodeComposer .nc-run');
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { w: Math.round(r.width), h: Math.round(r.height), self: !!hit && (hit === b || b.contains(hit)), hit: hit ? String(hit.className || hit.tagName) : null };
  });
  check('生成按钮尺寸达标且中心点命中自身（不被遮层抢走）', runReach.w >= 6 && runReach.h >= 6 && runReach.self === true, JSON.stringify(runReach));
  // 用 page.click 而不是先量坐标再 mouse.click：上一场景报错会让节点重排（error 徽标/skeleton）
  // → Composer 跟着位移，拿旧坐标点会落到节点上，静默产出一条「点了但什么都没发生」的假失败。
  // 不能点完直接读终态：上一场景的 error 是个旧终态，runNode 到真实置 running 之间有间隙，
  // 抢先读会拿到「还是 error」的假失败。所以先记下 prev，只认「从 prev 变化后的那个终态」。
  const prevStatus = await page.evaluate((id) => workflow.nodes.get(id).status, ids.bId);
  await page.click('#nodeComposer .nc-run');
  let waited = 0;
  while (waited < 15_000) {
    const st = await page.evaluate((id) => workflow.nodes.get(id).status, ids.bId);
    if (st !== prevStatus && (st === 'done' || st === 'error')) break;
    await page.waitForTimeout(250);
    waited += 250;
  }
  const done = await page.evaluate((id) => {
    const n = workflow.nodes.get(id);
    return {
      status: n.status, resultMode: n.resultMode, thumb: !!n.thumb, genMeta: !!n.genMeta,
      hasRetry: !!document.querySelector('#nodeComposer .nc-retry'),
      lastError: String(n._lastError || n.failureReason || ''),
    };
  }, ids.bId);
  // 失败时把报错文案与外发请求一并打出来，区分「根本没请求（参数/Key 拦截）」与「请求了但处理没跑完」
  check('有 Key + 打桩 → 生成完成 done 且 resultMode=real', done.status === 'done' && done.resultMode === 'real',
    JSON.stringify(done) + ' 外发:' + (netSeen.join(' | ') || '（无）'));
  check('出图落在节点上（thumb 有值）并记录 genMeta', done.thumb === true && done.genMeta === true, JSON.stringify(done));
  check('生成成功后 Composer 长出「同参重试」入口', done.hasRetry === true, String(done.hasRetry));

  // ── 场景 8：选中非生成节点 / 删除节点 → Composer 隐藏 ──
  // addNode 会顺手选中新节点，所以“真实点中”才算数：先点回 b确认可见，再点 text 确认隐藏
  const clickNode = async (id) => {
    const p = await page.evaluate((nid) => window.__tapPoint(nid, true), id);
    if (!p) return null;
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(200);
    return p;
  };
  const backOnB = await clickNode(ids.bId);
  check('夹具能重新点回节点 b（确认 Composer 可见）', !!backOnB, JSON.stringify(backOnB));
  const visibleB = await page.evaluate((id) => window.__geo(id), ids.bId);
  const textId = await page.evaluate(() => addNode('text', 260, 420).id);
  const onText = await clickNode(textId);
  check('夹具能找到 text 节点的可点落点', !!onText, JSON.stringify(onText));
  const hiddenOnText = await page.evaluate(() => ({ hidden: document.getElementById('nodeComposer').hidden, bound: !!__composerNode }));
  check('真实选中 text（非生成）节点 → Composer 隐藏',
    visibleB.boundTo === ids.bId && hiddenOnText.hidden === true && hiddenOnText.bound === false,
    JSON.stringify({ wasBound: visibleB.boundTo, ...hiddenOnText }));

  await clickNode(ids.bId);
  const beforeDelete = await page.evaluate((id) => ({ hidden: document.getElementById('nodeComposer').hidden, bound: __composerNode && __composerNode.id }), ids.bId);
  await page.evaluate((id) => deleteNode(id), ids.bId);
  await page.waitForTimeout(200);
  const afterDelete = await page.evaluate(() => ({ hidden: document.getElementById('nodeComposer').hidden, bound: !!__composerNode }));
  check('删除节点 → Composer 先显示后隐藏（不残留浮层）',
    beforeDelete.hidden === false && afterDelete.hidden === true && afterDelete.bound === false,
    JSON.stringify({ beforeDelete, afterDelete }));

  check('全流程无新增运行时错误', errors.length === 0, errors.join(' | '));

  const failed = checks.filter((c) => !c.passed);
  console.log(`\n[composer] ${checks.length - failed.length}/${checks.length} 通过`);
  if (failed.length) {
    console.log(`[composer] FAIL：${failed.map((f) => f.name).join('；')}`);
    process.exitCode = 1;
  } else {
    console.log('[composer] PASS（AI 域名全部本地打桩，未调用真实 AI 服务）');
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
