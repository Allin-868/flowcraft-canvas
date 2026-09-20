// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
// 冒烟：响应式窄屏适配 —— 无用户横向滚动 + 窄屏侧栏抽屉(默认收起/可开合) + 核心控件可达 + minimap 收纳 + 截图
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const INDEX = decodeURIComponent(new URL('../index.html', import.meta.url).pathname);
const SHOT_DIR = decodeURIComponent(new URL('../../../过程笔记/测试产物', import.meta.url).pathname);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const pageErrors = [];

const measure = (pg) => pg.evaluate(() => {
  const vw = window.innerWidth;
  const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), display: cs.display, visible: cs.display !== 'none' && cs.visibility !== 'hidden' }; };
  const within = (sel) => { const r = rect(sel); return !!r && r.visible && r.left >= -2 && r.right <= vw + 2; };
  return {
    vw, htmlOX: getComputedStyle(document.documentElement).overflowX,
    sidebar: rect('#sidebar'), sidebarCollapsed: (document.querySelector('#sidebar') || {}).classList ? document.querySelector('#sidebar').classList.contains('collapsed') : null,
    toggle: rect('#sidebarCollapseBtn'), toggleWithin: within('#sidebarCollapseBtn'),
    btnArrangeWithin: within('#btnArrange'), btnUndoWithin: within('#btnUndo'),
    minimap: rect('#minimap'), aiPanel: rect('.ai-panel'), canvasWrap: rect('#canvasWrap'),
  };
});

for (const w of [1440, 1024, 760, 390, 320]) {
  const context = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(w + 'px PAGEERROR: ' + e.message));
  await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const m = await measure(page);
  const narrow = w <= 760;

  ok(w + 'px html overflow-x=hidden（用户无横向滚动）', m.htmlOX === 'hidden', m.htmlOX);
  ok(w + 'px #btnArrange 可达', m.btnArrangeWithin === true, m.btnArrange);
  ok(w + 'px #btnUndo 可达', m.btnUndoWithin === true, m.btnUndo);
  ok(w + 'px 折叠按钮可见可达', m.toggleWithin === true, m.toggle);
  if (narrow) {
    ok(w + 'px 侧栏默认收起为抽屉(屏外)', m.sidebarCollapsed === true && m.sidebar.right <= 4, m.sidebar);
    ok(w + 'px 画布占满宽度(left=0)', m.canvasWrap && m.canvasWrap.left === 0, m.canvasWrap);
    ok(w + 'px minimap 已收纳', m.minimap === null || m.minimap.display === 'none', m.minimap);
  } else {
    ok(w + 'px 侧栏展开(left=0,宽220)', m.sidebarCollapsed === false && m.sidebar.left === 0 && m.sidebar.w === 220, m.sidebar);
  }
  if (w <= 900) ok(w + 'px minimap 隐藏', m.minimap === null || m.minimap.display === 'none', m.minimap);

  // 窄屏抽屉开合交互
  if (narrow) {
    await page.click('#sidebarCollapseBtn');
    await page.waitForTimeout(400);
    const opened = await measure(page);
    ok(w + 'px 点击折叠按钮→抽屉打开(入视口)', opened.sidebarCollapsed === false && opened.sidebar.left === 0, opened.sidebar);
    await page.click('#sidebarCollapseBtn');
    await page.waitForTimeout(400);
    const closed = await measure(page);
    ok(w + 'px 再次点击→抽屉收起', closed.sidebarCollapsed === true && closed.sidebar.right <= 4, closed.sidebar);
  }

  // 窄屏打开态：右侧滑入面板不得超出视口（320px 曾左裁：recycle 系 60px / run-log 36px / agent-drawer 68px）
  // 用 JS 直连 click 打开（避免打开态面板遮挡工具栏导致指针拦截），用移除 .show 确定性关闭
  if (narrow) {
    const OPEN_PANELS = [
      ['#btnWorkflow', '#workflowPanel'], ['#btnAssets', '#assetPanel'], ['#btnRecycle', '#recyclePanel'],
      ['#btnRunLog', '#runLogPanel'], ['#btnRegen', '#regenPanel'], ['#btnWorkbench', '#workbenchPanel'],
    ];
    for (const [btn, sel] of OPEN_PANELS) {
      const m = await page.evaluate(async ([b, s]) => {
        const tb = document.querySelector(b); if (!tb) return null;
        tb.click(); await new Promise((r) => setTimeout(r, 350));
        const el = document.querySelector(s); if (!el) return null;
        const r = el.getBoundingClientRect();
        const fits = r.left >= -2 && r.right <= innerWidth + 2;
        el.classList.remove('show'); await new Promise((rr) => setTimeout(rr, 250));
        return { fits, L: Math.round(r.left), R: Math.round(r.right), W: Math.round(r.width) };
      }, [btn, sel]);
      if (m) ok(w + 'px 打开态 ' + sel + ' 不超出视口', m.fits === true, m);
    }
  }
  try { await page.screenshot({ path: SHOT_DIR + '/resp-' + w + '-2026-09-05.png' }); } catch (_) {}
  await context.close();
}

ok('全程无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));
await browser.close();
console.log('\n==== 响应式窄屏适配冒烟：PASS=' + pass + ' FAIL=' + fail + ' ====');
process.exit(fail === 0 ? 0 : 1);
