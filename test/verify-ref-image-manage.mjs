// 冒烟：参考图管理（P1-1）——校验/去重/结构化/迁移/替换/排序/失效引用/导出往返
// 用 Playwright 捆绑 Chromium（非 channel:'chrome'，规避 SIGABRT）；file:// 加载当前构建产物。
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const INDEX = fileURLToPath(new URL('../index.html', import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  实际=' + JSON.stringify(extra) : '')); }
};

// ---- 最小 PNG 编码器：生成纯色 RGBA PNG（用于真实上传/去重测试）----
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function makePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 4); raw[off] = 0;
    for (let x = 0; x < w; x++) { const p = off + 1 + x * 4; raw[p] = rgba[0]; raw[p + 1] = rgba[1]; raw[p + 2] = rgba[2]; raw[p + 3] = rgba[3]; }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}
const redPng = makePng(4, 4, [255, 0, 0, 255]);
const bluePng = makePng(4, 4, [0, 0, 255, 255]);
const greenPng = makePng(4, 4, [0, 255, 0, 255]);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// ===== A. 纯函数：格式/大小校验 =====
const val = await page.evaluate(() => ({
  png: validateRefImageFile({ type: 'image/png', name: 'a.png', size: 1000 }),
  jpeg: validateRefImageFile({ type: 'image/jpeg', name: 'a.jpg', size: 1000 }),
  gif: validateRefImageFile({ type: 'image/gif', name: 'a.gif', size: 1000 }),
  big: validateRefImageFile({ type: 'image/png', name: 'a.png', size: 11 * 1024 * 1024 }),
  webpExt: validateRefImageFile({ type: '', name: 'a.webp', size: 1000 }),
}));
ok('PNG 通过校验', val.png.ok === true, val.png);
ok('JPEG 通过校验', val.jpeg.ok === true, val.jpeg);
ok('GIF 被拒（格式不支持）', val.gif.ok === false && /格式/.test(val.gif.reason || ''), val.gif);
ok('超 10MB 被拒', val.big.ok === false && /10MB/.test(val.big.reason || ''), val.big);
ok('webp 扩展名兜底通过', val.webpExt.ok === true, val.webpExt);

// ===== B. 纯函数：失效引用判定 =====
const inv = await page.evaluate(() => ({
  valid: isRefInvalid({ src: 'data:image/png;base64,QUJD' }),
  stripped: isRefInvalid({ src: '(stripped)' }),
  empty: isRefInvalid({ src: '' }),
  nul: isRefInvalid(null),
  http: isRefInvalid({ src: 'https://example.com/a.png' }),
}));
ok('有效 dataURL 非失效', inv.valid === false, inv);
ok('https 图非失效', inv.http === false, inv);
ok('(stripped) 判失效', inv.stripped === true, inv);
ok('空 src 判失效', inv.empty === true, inv);
ok('null 判失效', inv.nul === true, inv);

// ===== C. 旧数据迁移：裸字符串 / {name,src} → 结构化 =====
const mig = await page.evaluate(() => {
  const legacy = ['data:image/png;base64,QUJD', { name: 'old', src: 'data:image/jpeg;base64,REVG' }];
  const norm = normalizeRefImages(legacy);
  return norm.map((r) => ({ hasId: !!r.id, name: r.name, mime: r.mime, order: r.order, hasHash: !!r.hash, size: r.size, w: r.width, h: r.height }));
});
ok('裸字符串→结构化(id/mime/order/hash/size)',
  mig[0].hasId && mig[0].mime === 'image/png' && mig[0].order === 0 && mig[0].hasHash && mig[0].size > 0, mig[0]);
ok('旧{name,src}→结构化并保留 name', mig[1].name === 'old' && mig[1].mime === 'image/jpeg' && mig[1].order === 1, mig[1]);
ok('迁移补 width/height 字段(默认0)', mig[0].w === 0 && mig[0].h === 0, mig[0]);

// ===== D. 渲染：有效图(替换/删除/拖拽) + 失效图(失效标/重新定位/移除) =====
const render = await page.evaluate(() => {
  const node = { type: 'aiImage', refImages: [
    normalizeRefImage({ name: 'a', src: 'data:image/png;base64,QUJD' }, 0),
    normalizeRefImage({ name: 'bad', src: '(stripped)' }, 1),
  ] };
  const c = document.createElement('div');
  renderRefThumbsManaged(node, c, {});
  return {
    thumbs: c.querySelectorAll('.node-ref-thumb').length,
    invalid: c.querySelectorAll('.node-ref-thumb-invalid').length,
    warn: c.querySelectorAll('.node-ref-invalid-warn').length,
    relocate: c.querySelectorAll('.node-ref-thumb-relocate').length,
    replace: c.querySelectorAll('.node-ref-thumb-replace').length,
    rm: c.querySelectorAll('.node-ref-thumb-rm').length,
    draggable: c.querySelectorAll('.node-ref-thumb[draggable="true"]').length,
    warnText: (c.querySelector('.node-ref-invalid-warn') || {}).textContent,
  };
});
ok('渲染 2 个缩略图', render.thumbs === 2, render);
ok('失效图标记 1 个', render.invalid === 1 && render.warn === 1, render);
ok('失效标文案为「失效」', render.warnText === '失效', render.warnText);
ok('失效图有重新定位按钮', render.relocate === 1, render);
ok('有效图有替换按钮', render.replace === 1, render);
ok('两图均有移除按钮', render.rm === 2, render);
ok('两图均可拖拽排序', render.draggable === 2, render);

// ===== E. 渲染按 order 排序 + normalize 后 order 连续 =====
const orderRender = await page.evaluate(() => {
  const node = { type: 'aiImage', refImages: [
    { name: 'c', src: 'data:image/png;base64,Qw==', order: 2 },
    { name: 'a', src: 'data:image/png;base64,YQ==', order: 0 },
    { name: 'b', src: 'data:image/png;base64,Yg==', order: 1 },
  ] };
  const c = document.createElement('div');
  renderRefThumbsManaged(node, c, {});
  return { names: [...c.querySelectorAll('.node-ref-thumb img')].map((i) => i.alt), orders: node.refImages.map((r) => r.order) };
});
ok('渲染按 order 升序(a,b,c)', orderRender.names.join(',') === 'a,b,c', orderRender.names);
ok('normalize 后 order 连续 0,1,2', orderRender.orders.join(',') === '0,1,2', orderRender.orders);

// ===== F. collectInlineRefs：过滤失效 + 按 order 排序 =====
const cir = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const n = editor.addNode('aiImage', 100, 100);
  n.refImages = [
    { name: 'b', src: 'data:image/png;base64,Yg==', order: 1 },
    { name: 'bad', src: '(stripped)', order: 0 },
    { name: 'a', src: 'data:image/png;base64,YQ==', order: 2 },
  ];
  const out = collectInlineRefs(n);
  return { names: out.map((r) => r.name), len: out.length };
});
ok('collectInlineRefs 过滤失效图', cir.len === 2, cir.names);
ok('collectInlineRefs 按 order 排序(b,a)', cir.names.join(',') === 'b,a', cir.names);

// ===== G. 导出导入往返稳定 =====
const rt = await page.evaluate(() => {
  const refs = normalizeRefImages([{ name: 'x', src: 'data:image/png;base64,QUJD' }]);
  const s = JSON.stringify(refs);
  const re = normalizeRefImages(JSON.parse(s));
  return { stable: s === JSON.stringify(re), idSame: refs[0].id === re[0].id };
});
ok('导出导入往返字段稳定', rt.stable === true, rt);
ok('往返后 id 不变', rt.idSame === true, rt);

// ===== H. 真实上传：filechooser + 3 文件(含1重复) → 去重为 2，结构化 =====
await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  window.__t = editor.addNode('aiImage', 300, 260);
  window.__t.refImages = [];
});
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 8000 }),
  page.evaluate(() => openReferenceImagePicker(window.__t)),
]);
await chooser.setFiles([
  { name: 'red.png', mimeType: 'image/png', buffer: redPng },
  { name: 'blue.png', mimeType: 'image/png', buffer: bluePng },
  { name: 'red2.png', mimeType: 'image/png', buffer: redPng },
]);
await page.waitForTimeout(800);
const uploaded = await page.evaluate(() => window.__t.refImages.map((r) => ({ name: r.name, mime: r.mime, order: r.order, hasId: !!r.id, hasHash: !!r.hash, size: r.size })));
ok('上传去重：3 文件(1重复)→2 张', uploaded.length === 2, uploaded.map((u) => u.name));
ok('上传结果结构化字段齐全', uploaded.every((r) => r.hasId && r.hasHash && r.mime === 'image/png' && r.size > 0 && typeof r.order === 'number'), uploaded[0]);
ok('上传后 order 连续 0,1', uploaded.map((r) => r.order).join(',') === '0,1', uploaded.map((r) => r.order));

// ===== I. 真实替换：保持 id / order，更新 src/hash =====
const before = await page.evaluate(() => ({ id: window.__t.refImages[0].id, order: window.__t.refImages[0].order, hash: window.__t.refImages[0].hash }));
const [chooser2] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 8000 }),
  page.evaluate((id) => openRefReplacePicker(window.__t, id), before.id),
]);
await chooser2.setFiles([{ name: 'green.png', mimeType: 'image/png', buffer: greenPng }]);
await page.waitForTimeout(700);
const after = await page.evaluate(() => window.__t.refImages);
const replaced = after.find((r) => r.id === before.id);
ok('替换后数量不变(2)', after.length === 2, after.length);
ok('替换保持 id 不变', !!replaced, before.id);
ok('替换保持 order 不变', replaced && replaced.order === before.order, replaced && replaced.order);
ok('替换更新 hash(指向新图)', replaced && replaced.hash !== before.hash, replaced && replaced.hash);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 参考图管理冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
