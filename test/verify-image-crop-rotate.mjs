// 冒烟：图片节点裁剪(修复 probe.src 致模态打不开的 bug) + 旋转(90°步进/自由角度/烘焙/方向/撤销/序列化)
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
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// 生成 100x50 测试图：左 20px 蓝、其余红（用于验证旋转方向）
const setFreshImage = () => page.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = 100; cv.height = 50;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#ff0000'; cx.fillRect(0, 0, 100, 50);
  cx.fillStyle = '#0000ff'; cx.fillRect(0, 0, 20, 50);
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  n.croppedImage = ''; n.cropMeta = null; n.thumb = cv.toDataURL('image/png'); n.uploadedImage = n.thumb;
  window.buildNodeBody(n.el, n);
});
const dims = (handle) => page.evaluate((h) => new Promise((res) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  const src = window.getNodeDisplayImageSource(n);
  if (!src) { res(null); return; }
  const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => res(null); img.src = src;
}), handle);

// 建 image 节点
await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const cv = document.createElement('canvas'); cv.width = 100; cv.height = 50;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#ff0000'; cx.fillRect(0, 0, 100, 50);
  cx.fillStyle = '#0000ff'; cx.fillRect(0, 0, 20, 50);
  const n = editor.addNode('image', 300, 260);
  n.thumb = cv.toDataURL('image/png'); n.uploadedImage = n.thumb;
  window.buildNodeBody(n.el, n);
  window.selectNode(n);
  window.__imgId = n.id;
});
await page.waitForTimeout(300);

// ===== A. 工具栏按钮 =====
const tools = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  return [...n.el.querySelectorAll('.node-tools .node-tool-btn')].map((b) => b.title.replace(/（.*$/, ''));
});
ok('image 工具栏含裁剪图片', tools.includes('裁剪图片'), tools);
ok('image 工具栏含旋转图片', tools.includes('旋转图片'), tools);

// ===== B. 裁剪模态打开（bug 修复：原缺 probe.src 致永不打开）=====
await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  [...n.el.querySelectorAll('.node-tool-btn')].find((b) => b.title.startsWith('裁剪图片')).click();
});
await page.waitForTimeout(600);
const cropOpen = await page.evaluate(() => {
  const o = document.getElementById('imageCropOverlay');
  return !!o && o.classList.contains('show') && !!o.querySelector('#imageCropAspect') && !!o.querySelector('#imageCropApply');
});
ok('裁剪模态打开(bug 修复)', cropOpen === true, cropOpen);

// ===== C. 裁剪 1:1 应用 → 方形输出 =====
await page.evaluate(() => {
  const s = document.getElementById('imageCropAspect');
  s.value = '1:1';
  s.onchange({ target: s });
});
await page.waitForTimeout(300);
await page.evaluate(() => { window.FlowCraft.history.clear(); document.getElementById('imageCropApply').click(); });
await page.waitForTimeout(700);
const cropDims = await dims();
ok('裁剪 1:1 输出方形', cropDims && Math.abs(cropDims.w - cropDims.h) <= 1, cropDims);
const cropMeta = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  return { aspect: n.cropMeta && n.cropMeta.aspect, hasCropped: !!(n.croppedImage && n.croppedImage.startsWith('data:image')), histSize: window.FlowCraft.history.size() };
});
ok('裁剪写入 croppedImage', cropMeta.hasCropped === true, cropMeta);
ok('裁剪写入 cropMeta.aspect=1:1', cropMeta.aspect === '1:1', cropMeta);
ok('裁剪 pushHistory(可撤销)', cropMeta.histSize >= 1, cropMeta.histSize);
ok('裁剪后模态关闭', await page.evaluate(() => { const o = document.getElementById('imageCropOverlay'); return !o || !o.classList.contains('show'); }));

// ===== D. 旋转模态打开 + 控件齐全 =====
await setFreshImage();
await page.waitForTimeout(300);
await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  [...n.el.querySelectorAll('.node-tool-btn')].find((b) => b.title.startsWith('旋转图片')).click();
});
await page.waitForTimeout(600);
const rotOpen = await page.evaluate(() => {
  const o = document.getElementById('imageRotateOverlay');
  return !!o && o.classList.contains('show') && !!o.querySelector('#imageRotateCCW') && !!o.querySelector('#imageRotateCW') && !!o.querySelector('#imageRotateSlider') && !!o.querySelector('#imageRotateApply');
});
ok('旋转模态打开', rotOpen === true, rotOpen);

// ===== E. 90° 步进 + 读数 + 预览 transform =====
await page.evaluate(() => document.getElementById('imageRotateCW').click());
await page.waitForTimeout(200);
const cw = await page.evaluate(() => ({
  text: document.getElementById('imageRotateAngle').textContent,
  slider: document.getElementById('imageRotateSlider').value,
  transform: document.querySelector('.image-rotate-img').style.transform,
}));
ok('顺时针 90° 读数', cw.text === '90°', cw);
ok('滑块同步 90', cw.slider === '90', cw);
ok('预览 transform=rotate(90deg)', cw.transform === 'rotate(90deg)', cw);
await page.evaluate(() => document.getElementById('imageRotateCCW').click());
await page.waitForTimeout(200);
const ccw = await page.evaluate(() => document.getElementById('imageRotateAngle').textContent);
ok('逆时针 90° 回到 0°', ccw === '0°', ccw);

// ===== F. 自由角度滑块 =====
await page.evaluate(() => {
  const s = document.getElementById('imageRotateSlider');
  s.value = '30'; s.oninput({ target: s });
});
await page.waitForTimeout(200);
const free = await page.evaluate(() => ({ text: document.getElementById('imageRotateAngle').textContent, transform: document.querySelector('.image-rotate-img').style.transform }));
ok('自由角度滑块 30°', free.text === '30°' && free.transform === 'rotate(30deg)', free);

// ===== G. 旋转 90°CW 应用 → 烘焙 50x100 + 方向 + 元数据 =====
await page.evaluate(() => { document.getElementById('imageRotateReset').click(); });
await page.waitForTimeout(150);
await page.evaluate(() => { document.getElementById('imageRotateCW').click(); window.FlowCraft.history.clear(); });
await page.waitForTimeout(150);
await page.evaluate(() => { document.getElementById('imageRotateApply').click(); });
await page.waitForTimeout(800); // bake 异步(Image onload + canvas)
const rotDims = await dims();
ok('旋转 90° 后宽高互换(100x50→50x100)', rotDims && rotDims.w === 50 && rotDims.h === 100, rotDims);
const dirCheck = await page.evaluate(() => new Promise((res) => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const top = cx.getImageData(Math.floor(cv.width / 2), 2, 1, 1).data;
    const bottom = cx.getImageData(Math.floor(cv.width / 2), cv.height - 3, 1, 1).data;
    res({ top: [top[0], top[2]], bottom: [bottom[0], bottom[2]] });
  };
  img.onerror = () => res(null); img.src = window.getNodeDisplayImageSource(n);
}));
ok('旋转方向正确(原左蓝→顶蓝、原右红→底红)',
  dirCheck && dirCheck.top[1] > dirCheck.top[0] && dirCheck.bottom[0] > dirCheck.bottom[1], dirCheck);
const rotMeta = await page.evaluate(() => {
  const n = window.FlowCraft._legacy.workflow.nodes.get(window.__imgId);
  const snap = JSON.parse(JSON.stringify({ cropMeta: n.cropMeta })); // 复刻 snapshotWorkflow 的 cropMeta 序列化
  return { angle: n.cropMeta && n.cropMeta.angle, serAngle: snap.cropMeta && snap.cropMeta.angle, histSize: window.FlowCraft.history.size() };
});
ok('旋转写入 cropMeta.angle=90', rotMeta.angle === 90, rotMeta);
ok('cropMeta.angle 可序列化往返', rotMeta.serAngle === 90, rotMeta);
ok('旋转 pushHistory(可撤销)', rotMeta.histSize >= 1, rotMeta.histSize);
ok('旋转后模态关闭', await page.evaluate(() => { const o = document.getElementById('imageRotateOverlay'); return !o || !o.classList.contains('show'); }));

// ===== H. 撤销恢复旋转前(100x50) =====
await page.evaluate(() => window.FlowCraft.history.undo());
await page.waitForTimeout(500);
const undoDims = await dims();
ok('撤销后恢复旋转前(100x50)', undoDims && undoDims.w === 100 && undoDims.h === 50, undoDims);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 图片裁剪/旋转冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
