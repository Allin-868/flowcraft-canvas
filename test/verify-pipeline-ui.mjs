#!/usr/bin/env node
/** AI 绘图流水线节点界面防回退：image 显示原图；lineart/upscale 仅输出清爽预览。 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(join(ROOT, 'index.html'))); });
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const r = await page.evaluate(async () => {
  const mk = (w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
  const out = {};
  clearGraph();

  // 1) image 节点：uploadedImage=4x4 原图 + thumb=1x1 缩略 → hero 应显示原图(4)
  const im = addNode('image', 100, 100);
  im.uploadedImage = mk(4, 4, '#cc3333');
  im.thumb = mk(1, 1, '#cc3333');
  if (im.el) buildNodeBody(im.el, im);
  await new Promise(res => setTimeout(res, 200));
  const imImg = im.el.querySelector('.node-image-input-img');
  out.imageHeroW = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(null); i.src = imImg ? imImg.src : ''; });

  // 2) lineart：_galleryImages 两张 → clean-output 网格 2 张、无 label
  const la = addNode('lineart', 400, 100);
  la._galleryImages = [mk(3, 3, '#33cc33'), mk(3, 3, '#3333cc')];
  la.outputsData = [{ type: 'image', value: la._galleryImages[0] }];
  if (la.el) buildNodeBody(la.el, la);
  await new Promise(res => setTimeout(res, 200));
  const laArea = la.el.querySelector('.node-preview-area.clean-output');
  out.lineartClean = !!laArea;
  out.lineartImgs = laArea ? laArea.querySelectorAll('img').length : 0;
  out.lineartLabel = la.el.querySelector('.node-preview-label') ? la.el.querySelector('.node-preview-label').textContent : null;

  // 3) upscale 未运行 → 仅 clean-empty，无占位文案/上传按钮
  const up0 = addNode('upscale', 700, 100);
  if (up0.el) buildNodeBody(up0.el, up0);
  await new Promise(res => setTimeout(res, 200));
  out.upEmpty = !!up0.el.querySelector('.node-clean-empty');
  out.upText = up0.el.textContent.includes('运行后生成图片预览');
  out.upUploadBtn = !!up0.el.querySelector('.node-empty-action');

  // 4) upscale 运行后单图 → 仅 1 张 preview-img、无 label
  const up1 = addNode('upscale', 1000, 100);
  up1.outputsData = [{ type: 'image', value: mk(5, 5, '#cc9933') }];
  up1._galleryImages = [mk(5, 5, '#cc9933')];
  if (up1.el) buildNodeBody(up1.el, up1);
  await new Promise(res => setTimeout(res, 200));
  const upArea = up1.el.querySelector('.node-preview-area.clean-output');
  out.upClean = !!upArea;
  out.upImgs = upArea ? upArea.querySelectorAll('img').length : 0;
  out.upLabel = up1.el.querySelector('.node-preview-label') ? up1.el.querySelector('.node-preview-label').textContent : null;
  const refUp = up1.el.querySelector('.node-ref-uploader');
  out.upRefHidden = !refUp || getComputedStyle(refUp).display === 'none';
  const thumbRow = up1.el.querySelector('.node-thumb-row');
  out.upThumbRowHidden = !thumbRow || getComputedStyle(thumbRow).display === 'none';
  out.upToolbarInHeader = !!up1.el.querySelector('.node-header-row .node-toolbar');
  return out;
});

check('image 节点 hero 显示原图(4px 而非 1px 缩略)', r.imageHeroW === 4, 'naturalWidth=' + r.imageHeroW);
check('lineart 为 clean-output 且显示全部 2 张生成图', r.lineartClean && r.lineartImgs === 2, JSON.stringify({ clean: r.lineartClean, imgs: r.lineartImgs }));
check('lineart 无「图片预览」标签', r.lineartLabel === null, String(r.lineartLabel));
check('upscale 未运行仅淡色图标占位', r.upEmpty && !r.upText && !r.upUploadBtn, JSON.stringify({ empty: r.upEmpty, text: r.upText, upload: r.upUploadBtn }));
check('upscale 运行后仅 1 张生成图且无标签', r.upClean && r.upImgs === 1 && r.upLabel === null, JSON.stringify({ clean: r.upClean, imgs: r.upImgs, label: r.upLabel }));
check('upscale 参考图上传行隐藏(无 [+] 多余信息)', r.upRefHidden === true, 'refHidden=' + r.upRefHidden);
check('upscale 节点框内 [+] 缩略行已取消', r.upThumbRowHidden === true, 'thumbRowHidden=' + r.upThumbRowHidden);
check('工具条并入顶部状态栏(.node-header-row 内)', r.upToolbarInHeader === true, 'inHeader=' + r.upToolbarInHeader);

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 流水线节点界面：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
