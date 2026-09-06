#!/usr/bin/env node
/** lineart 离线路由防回退：无 Key/代理时 Sobel 边缘检测真出线稿（白底+黑边）。 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
const ROOT = '/Users/allin/Workspace/项目/project-001-FlowCraft无限画布/输出成果/deploy';
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(readFileSync(join(ROOT, 'index.html'))); });
await new Promise(d => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

const r = await page.evaluate(async () => {
  // 白底 + 中央黑方块 → 应有方块轮廓边缘
  const mk = () => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#000000'; x.fillRect(16, 16, 32, 32);
    return cv.toDataURL('image/png');
  };
  clearGraph();
  const im = addNode('image', 100, 100);
  im.uploadedImage = mk();           // 真实上传路径必有原图
  im.outputsData = [{ type: 'image', value: im.uploadedImage }];
  const la = addNode('lineart', 400, 100);
  connectNodes(im.id, 0, la.id, 0);
  const noKey = !localStorage.getItem('flowcraft-openai-key');
  await runWorkflow({ force: true, skipPreview: true });
  const out = (la.outputsData || [])[0];
  let stats = null;
  if (out && out.value) {
    stats = await new Promise(res => {
      const i = new Image();
      i.onload = () => {
        const cv = document.createElement('canvas'); cv.width = i.naturalWidth; cv.height = i.naturalHeight;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(i, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        let white = 0, dark = 0, total = 0;
        for (let p = 0; p < d.length; p += 4) {
          total++;
          const v = d[p];
          if (v > 240) white++;
          if (v < 60) dark++;
        }
        res({ w: i.naturalWidth, h: i.naturalHeight, white, dark, total });
      };
      i.onerror = () => res(null);
      i.src = out.value;
    });
  }
  return { noKey, status: la.status, resultMode: la.resultMode, hasOut: !!out, stats };
});

check('离线前提：无 Key 且无代理', r.noKey === true);
check('lineart 无 Key 真实出图(done)', r.status === 'done' && r.hasOut === true, JSON.stringify({ status: r.status, hasOut: r.hasOut }));
check('resultMode 标记为 real', r.resultMode === 'real', String(r.resultMode));
check('线稿为白底为主(white>80%)', r.stats && (r.stats.white / r.stats.total) > 0.8, JSON.stringify(r.stats));
check('线稿含黑色边缘像素(dark>0)', r.stats && r.stats.dark > 0, 'dark=' + (r.stats && r.stats.dark));

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== lineart 离线路由：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
