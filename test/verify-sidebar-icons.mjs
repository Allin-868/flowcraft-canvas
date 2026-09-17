// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
// 冒烟：节点库折叠态显示竖直图标条（非空白细栏）——图标可见/文字隐藏/不溢出/可拖拽/可展开还原
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const INDEX = decodeURIComponent(new URL('../index.html', import.meta.url).pathname);
const SHOT = decodeURIComponent(new URL('../../../过程笔记/测试产物/sidebar-collapsed-icons-2026-09-05.png', import.meta.url).pathname);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

const snap = () => page.evaluate(() => {
  const sb = document.querySelector('#sidebar');
  const sbr = sb.getBoundingClientRect();
  const list = document.querySelector('#sidebarList');
  const listCs = getComputedStyle(list);
  const items = [...document.querySelectorAll('.node-library-item')];
  const visItems = items.filter((it) => { const r = it.getBoundingClientRect(); const cs = getComputedStyle(it); return cs.display !== 'none' && r.width > 0 && r.height > 0; });
  const iconVisible = (it) => { const ic = it.querySelector('.lib-icon'); if (!ic) return false; const r = ic.getBoundingClientRect(); const cs = getComputedStyle(ic); return cs.display !== 'none' && r.width > 4 && r.height > 4; };
  const textHidden = (it) => { const tx = it.querySelector('.lib-text'); if (!tx) return true; return getComputedStyle(tx).display === 'none'; };
  const withinSidebar = visItems.every((it) => { const r = it.getBoundingClientRect(); return r.left >= sbr.left - 2 && r.right <= sbr.right + 2; });
  const draggable = visItems.length > 0 && visItems.every((it) => it.draggable === true);
  const labelHidden = [...document.querySelectorAll('.sidebar-section-label')].every((l) => getComputedStyle(l).display === 'none');
  const presetHidden = getComputedStyle(document.querySelector('.preset-tabs')).display === 'none' && getComputedStyle(document.querySelector('.preset-body')).display === 'none';
  const toggle = document.querySelector('#sidebarCollapseBtn');
  const tr = toggle.getBoundingClientRect();
  return {
    collapsed: sb.classList.contains('collapsed'),
    sbWidth: Math.round(sbr.width),
    listOpacity: listCs.opacity, listDisplay: listCs.display,
    itemCount: items.length, visItemCount: visItems.length,
    allIconsVisible: visItems.length > 0 && visItems.every(iconVisible),
    allTextHidden: visItems.every(textHidden),
    withinSidebar, draggable, labelHidden, presetHidden,
    toggleVisible: tr.width > 0 && tr.left >= sbr.left - 2 && tr.right <= sbr.right + 2,
  };
});

// 展开态基线
const exp = await snap();
ok('展开态：侧栏 220px 且文字可见', exp.collapsed === false && exp.sbWidth === 220 && exp.allTextHidden === false, exp);

// 折叠
await page.click('#sidebarCollapseBtn');
await page.waitForTimeout(400);
const col = await snap();
ok('折叠态：侧栏收窄(~44px)', col.collapsed === true && col.sbWidth <= 48, col.sbWidth);
ok('折叠态：节点列表可见(opacity=1)', col.listDisplay !== 'none' && col.listOpacity === '1', { o: col.listOpacity, d: col.listDisplay });
ok('折叠态：显示节点图标(' + col.visItemCount + ' 个)', col.visItemCount > 0 && col.allIconsVisible === true, col);
ok('折叠态：隐藏文字/描述', col.allTextHidden === true, col);
ok('折叠态：隐藏分类头与预设', col.labelHidden === true && col.presetHidden === true, col);
ok('折叠态：图标不溢出侧栏宽度', col.withinSidebar === true, col);
ok('折叠态：图标仍可拖拽添加', col.draggable === true, col);
ok('折叠态：折叠按钮仍可见', col.toggleVisible === true, col);

// 悬停图标 → 提示节点名称
await page.hover('.node-library-item');
await page.waitForTimeout(250);
const tip = await page.evaluate(() => {
  const t = document.getElementById('libIconTip');
  if (!t) return null;
  const cs = getComputedStyle(t);
  return { text: t.textContent, vis: cs.visibility === 'visible' && cs.opacity === '1', left: Math.round(t.getBoundingClientRect().left) };
});
const firstRight = await page.evaluate(() => Math.round(document.querySelector('.node-library-item').getBoundingClientRect().right));
ok('折叠态悬停图标显示名称提示', !!tip && tip.vis === true && (tip.text || '').length > 0, tip);
ok('提示位于图标右侧', !!tip && tip.left >= firstRight, { tipLeft: tip && tip.left, firstRight });
await page.mouse.move(700, 450);
await page.waitForTimeout(250);
const tipHidden = await page.evaluate(() => { const t = document.getElementById('libIconTip'); const cs = getComputedStyle(t); return cs.visibility === 'hidden' || cs.opacity === '0'; });
ok('移开后提示隐藏', tipHidden === true);
await page.screenshot({ path: SHOT, clip: { x: 0, y: 0, width: 120, height: 900 } });

// 展开还原
await page.click('#sidebarCollapseBtn');
await page.waitForTimeout(400);
const back = await snap();
ok('再次展开：恢复 220px 且文字可见', back.collapsed === false && back.sbWidth === 220 && back.allTextHidden === false, back);
await page.hover('.node-library-item');
await page.waitForTimeout(200);
const tipExpHidden = await page.evaluate(() => { const t = document.getElementById('libIconTip'); const cs = getComputedStyle(t); return cs.visibility === 'hidden' || cs.opacity === '0'; });
ok('展开态悬停不显示折叠提示', tipExpHidden === true);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));
await browser.close();
console.log('\n==== 节点库折叠图标条冒烟：PASS=' + pass + ' FAIL=' + fail + ' ====');
process.exit(fail === 0 ? 0 : 1);
