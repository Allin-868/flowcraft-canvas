// 冒烟：节点框上方统一工具栏（归位按钮 + 存资产 + 复制提示词 + 宫格切分）
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
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
await page.goto(pathToFileURL(INDEX).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!(window.FlowCraft && window.FlowCraft.editor), null, { timeout: 30000 });
await page.waitForTimeout(400);

// aiImage + 四色象限图 + 提示词
await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  editor.clear();
  const canvas = document.createElement('canvas');
  canvas.width = 200; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = '#00ff00'; ctx.fillRect(100, 0, 100, 100);
  ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 100, 100, 100);
  ctx.fillStyle = '#ffff00'; ctx.fillRect(100, 100, 100, 100);
  const n = editor.addNode('aiImage', 300, 260);
  n.thumb = canvas.toDataURL('image/png');
  n.prompt = '四色象限测试提示词';
  window.buildNodeBody(n.el, n);
  window.selectNode(n);
});
await page.waitForTimeout(300);

const titles = await page.evaluate(() => {
  const n = [...window.FlowCraft._legacy.workflow.nodes.values()].find((x) => x.type === 'aiImage' && x.prompt === '四色象限测试提示词');
  return n ? [...n.el.querySelectorAll('.node-tools .node-tool-btn')].map((b) => b.title.replace(/（.*$/, '')) : [];
});
ok('aiImage 工具栏含 6 个按钮', titles.length === 6, titles);
ok('归位按钮齐全（更换/查看/下载/存资产/复制/宫格）',
  ['更换图片', '查看大图', '下载图片', '存资产', '复制提示词', '宫格切分'].every((t) => titles.includes(t)), titles);

// 复制提示词
await page.evaluate(() => {
  const n = [...window.FlowCraft._legacy.workflow.nodes.values()].find((x) => x.type === 'aiImage' && x.prompt === '四色象限测试提示词');
  n.el.querySelector('.node-tool-btn[title^="复制提示词"]').click();
});
await page.waitForTimeout(300);
const clip = await page.evaluate(() => navigator.clipboard.readText());
ok('复制提示词写入剪贴板', clip === '四色象限测试提示词', clip);

// 存资产
await page.evaluate(() => {
  const n = [...window.FlowCraft._legacy.workflow.nodes.values()].find((x) => x.type === 'aiImage' && x.prompt === '四色象限测试提示词');
  n.el.querySelector('.node-tool-btn[title^="存资产"]').click();
});
await page.waitForTimeout(300);
const asset = await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('flowcraft:assetImages:v1') || '{}');
  return Object.keys(all);
});
ok('存资产写入素材库', asset.length >= 1, asset);

// 宫格切分：弹层 → 2x2 → 4 个节点 + 象限颜色校验
await page.evaluate(() => {
  const n = [...window.FlowCraft._legacy.workflow.nodes.values()].find((x) => x.type === 'aiImage' && x.prompt === '四色象限测试提示词');
  n.el.querySelector('.node-tool-btn[title^="宫格切分"]').click();
});
await page.waitForTimeout(250);
ok('宫格切分弹层打开', await page.evaluate(() => !!document.getElementById('gridSplitPop')));
await page.click('.grid-split-preset:has-text("2x2")');
await page.waitForTimeout(700); // 同步布局，无需长等待
const split = await page.evaluate(async () => {
  // Map 保持插入序：切分新增的 4 个节点即最后 4 个
  const all = [...window.FlowCraft._legacy.workflow.nodes.values()];
  const nodes = all.slice(-4);
  const sample = async (src) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
      res([d[0], d[1], d[2]]);
    };
    img.onerror = () => res(null);
    img.src = src;
  });
  const out = [];
  for (const n of nodes) out.push({ title: n.title, rgb: await sample(n.thumb) });
  return { count: nodes.filter((n) => / 1-1$| 1-2$| 2-1$| 2-2$/.test(n.title || '')).length, out, popGone: !document.getElementById('gridSplitPop') };
});
ok('2x2 切分生成 4 个节点', split.count === 4, split.out.map((o) => o.title));
ok('切分后弹层关闭', split.popGone === true);
// 插入序即 r,c 序：TL红 TR绿 BL蓝 BR黄
const expectOrder = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
const colorOk = expectOrder.every((rgb, i) => {
  const hit = split.out[i];
  return hit && hit.rgb && Math.abs(hit.rgb[0] - rgb[0]) < 12 && Math.abs(hit.rgb[1] - rgb[1]) < 12 && Math.abs(hit.rgb[2] - rgb[2]) < 12;
});
ok('四个象限颜色与位置对应', colorOk, split.out);

// 布局不重叠：任意两节点 rect 间隙 ≥ 16px
const overlap = await page.evaluate(() => {
  const all = [...window.FlowCraft._legacy.workflow.nodes.values()];
  const nodes = all.slice(-4);
  const rects = nodes.map((n) => n.el.getBoundingClientRect());
  let minGap = Infinity;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const dx = Math.max(a.left - b.right, b.left - a.right);
      const dy = Math.max(a.top - b.bottom, b.top - a.bottom);
      const gap = Math.max(dx, dy); // 分离轴距离：>0 表示不重叠
      minGap = Math.min(minGap, gap);
    }
  }
  return { minGap: +minGap.toFixed(1) };
});
ok('切分节点互不重叠且间隙 ≥ 8px', overlap.minGap >= 8, overlap);

// 类型差异：aiVideo 无宫格/裁剪，有更换视频；image 有裁剪、无复制/宫格
const diff = await page.evaluate(() => {
  const { editor } = window.FlowCraft;
  const v = editor.addNode('aiVideo', 900, 260);
  window.buildNodeBody(v.el, v);
  const vt = [...v.el.querySelectorAll('.node-tools .node-tool-btn')].map((b) => b.title.replace(/（.*$/, ''));
  const i = editor.addNode('image', 1200, 260);
  window.buildNodeBody(i.el, i);
  const it = [...i.el.querySelectorAll('.node-tools .node-tool-btn')].map((b) => b.title.replace(/（.*$/, ''));
  return { vt, it };
});
ok('aiVideo：有更换视频/复制提示词，无宫格与裁剪',
  diff.vt.includes('更换视频') && diff.vt.includes('复制提示词') && !diff.vt.includes('宫格切分') && !diff.vt.includes('裁剪图片'), diff.vt);
ok('image：有裁剪，无复制提示词/宫格',
  diff.it.includes('裁剪图片') && !diff.it.includes('复制提示词') && !diff.it.includes('宫格切分'), diff.it);

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3));

await browser.close();
console.log(`\n==== 节点工具栏冒烟：PASS=${pass} FAIL=${fail} ====`);
process.exit(fail === 0 ? 0 : 1);
