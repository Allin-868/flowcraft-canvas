// 冒烟：图片输入节点 背景随主题 / 无上传按钮 / 上沿圆角 / 空态可点击上传
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const INDEX = fileURLToPath(new URL('../index.html', import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

const probe = (theme) => page.evaluate((t) => {
  document.body.dataset.theme = t;
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  const hero = node.el.querySelector('.node-image-input-hero');
  const cs = getComputedStyle(hero);
  return {
    bg: cs.backgroundColor,
    radiusTop: cs.borderTopLeftRadius,
    radiusBottom: cs.borderBottomLeftRadius,
    buttons: node.el.querySelectorAll('.node-empty-action').length,
    emptyClickable: typeof node.el.querySelector('.node-empty-state').onclick === 'function',
  };
}, theme);

// 有图节点：letterbox 背景与 img 圆角（.node-hero > img 特异性高于 .node-image-input-img，须单独断言）
const imgProbe = (theme) => page.evaluate((t) => {
  document.body.dataset.theme = t;
  const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
  node.thumb = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  window.buildNodeBody(node.el, node);
  const img = node.el.querySelector('.node-image-input-img');
  const cs = getComputedStyle(img);
  return { bg: cs.backgroundColor, radiusTop: cs.borderTopLeftRadius };
}, theme);

await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  editor.addNode('image', 400, 240);
});

const light = await probe('light');
const dark = await probe('');
ok('浅色主题下背景非写死深色', light.bg !== 'rgb(10, 11, 16)' && light.bg !== 'rgb(0, 0, 0)', light.bg);
ok('深色主题下背景仍为深色', dark.bg !== light.bg, { dark: dark.bg, light: light.bg });
ok('上沿为圆角', parseFloat(light.radiusTop) > 0, light.radiusTop);
ok('下沿保持圆角', parseFloat(light.radiusBottom) > 0, light.radiusBottom);
ok('不再渲染上传按钮', light.buttons === 0 && dark.buttons === 0, { light: light.buttons, dark: dark.buttons });
ok('空态整块可点击上传', light.emptyClickable === true);

// 点击空态应触发文件选择器
{
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 4000 }).then(() => true).catch(() => false);
  await page.evaluate(() => {
    const node = window.FlowCraft._legacy.getNode([...window.FlowCraft._legacy.workflow.nodes.keys()][0]);
    node.el.querySelector('.node-empty-state').click();
  });
  const got = await chooserPromise;
  ok('点击空态触发文件选择器', got === true);
}

// 有图断言放最后：imgProbe 会写入 thumb 使空态消失
const imgLight = await imgProbe('light');
ok('有图节点 letterbox 随主题（非写死深色）', imgLight.bg !== 'rgb(10, 11, 16)' && imgLight.bg !== 'rgb(0, 0, 0)', imgLight.bg);
ok('有图节点 img 上沿圆角', parseFloat(imgLight.radiusTop) > 0, imgLight.radiusTop);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 图片节点外观冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
