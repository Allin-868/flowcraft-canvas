// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
// 冒烟：画布右下角缩放百分比可点击 → 回到 100%
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const INDEX = decodeURIComponent(new URL('../index.html', import.meta.url).pathname);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// 设为 62%
await page.evaluate(() => {
  const wf = window.FlowCraft._legacy.workflow;
  wf.camera.zoom = 0.62;
  window.applyTransform();
});
await page.waitForTimeout(150);
const before = await page.evaluate(() => ({
  zoom: window.FlowCraft._legacy.workflow.camera.zoom,
  text: document.getElementById('zoomDisplay').textContent,
  title: document.getElementById('zoomDisplay').title,
  cursor: getComputedStyle(document.getElementById('zoomDisplay')).cursor,
}));
ok('初始设为 62% 且显示 62%', Math.abs(before.zoom - 0.62) < 1e-6 && before.text === '62%', before);
ok('百分比有 title 提示', before.title === '点击回到 100%', before.title);
ok('百分比为指针光标', before.cursor === 'pointer', before.cursor);

// 点击百分比 → 回 100%
await page.click('#zoomDisplay');
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({
  zoom: window.FlowCraft._legacy.workflow.camera.zoom,
  text: document.getElementById('zoomDisplay').textContent,
}));
ok('点击百分比后 zoom=1', Math.abs(after.zoom - 1) < 1e-6, after);
ok('点击后显示 100%', after.text === '100%', after.text);

// 已 100% 时再点击不应报错/改变
await page.click('#zoomDisplay');
await page.waitForTimeout(150);
const again = await page.evaluate(() => window.FlowCraft._legacy.workflow.camera.zoom);
ok('100% 时再点击保持 100%', Math.abs(again - 1) < 1e-6, again);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));
await browser.close();
console.log('\n==== 缩放百分比点击回100%冒烟：PASS=' + pass + ' FAIL=' + fail + ' ====');
process.exit(fail === 0 ? 0 : 1);
