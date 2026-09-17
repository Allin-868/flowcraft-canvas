// 迁移说明：本文件由仓库外 脚本/ 目录迁入（2026-09-17），改为相对仓库定位，随 deploy 仓库一起版本化。
// 冒烟：图片输入节点上传后保持原图质量——显示/hero 用原图 uploadedImage，thumb 仅作轻量缩略(≤720)
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

// 真实上传链路：2000x1500 原图 → loadImageFile → 断言显示用原图
const res = await page.evaluate(async () => {
  // 生成 2000x1500 细节图（渐变+噪点块），确保 >720 触发 downscale 分支
  const cv = document.createElement('canvas'); cv.width = 2000; cv.height = 1500;
  const cx = cv.getContext('2d');
  const g = cx.createLinearGradient(0, 0, 2000, 1500);
  g.addColorStop(0, '#123456'); g.addColorStop(0.5, '#654321'); g.addColorStop(1, '#0a5c3c');
  cx.fillStyle = g; cx.fillRect(0, 0, 2000, 1500);
  for (let i = 0; i < 400; i++) { cx.fillStyle = 'hsl(' + (i * 7 % 360) + ',70%,50%)'; cx.fillRect((i * 137) % 1960, (i * 89) % 1460, 24, 24); }
  const original = cv.toDataURL('image/png');

  const { editor } = window.FlowCraft;
  editor.clear();
  const node = editor.addNode('image', 300, 260);

  const blob = await (await fetch(original)).blob();
  const file = new File([blob], 'orig-2000x1500.png', { type: 'image/png' });
  window.loadImageFile(file, node);
  await new Promise((r) => setTimeout(r, 900));

  const disp = window.getNodeDisplayImageSource(node);
  const heroImg = node.el && node.el.querySelector('.node-image-input-img');
  const thumbDim = await new Promise((r) => {
    const im = new Image();
    im.onload = () => r({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => r(null);
    im.src = node.thumb || '';
  });
  return {
    originalLen: original.length,
    uploadedIsOriginal: node.uploadedImage === original,
    dispIsOriginal: disp === original,
    heroSrcIsOriginal: !!heroImg && heroImg.src === original,
    thumbIsDownscaled: !!thumbDim && thumbDim.w <= 720 && thumbDim.h <= 720,
    thumbNotOriginal: node.thumb !== original,
    thumbDim,
  };
});

ok('原图完整保留在 uploadedImage', res.uploadedIsOriginal === true, { len: res.originalLen });
ok('显示源 = 原图（非 720 缩略）', res.dispIsOriginal === true, res);
ok('节点 hero 图 = 原图', res.heroSrcIsOriginal === true, res);
ok('thumb 仍为轻量缩略(≤720)，不增存储', res.thumbIsDownscaled === true && res.thumbNotOriginal === true, res.thumbDim);
ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log('\n==== 图片上传原图质量冒烟：PASS=' + pass + ' FAIL=' + fail + ' ====');
process.exit(fail === 0 ? 0 : 1);
