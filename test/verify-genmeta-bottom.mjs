#!/usr/bin/env node
/** 生成信息条入底部参数区防回退：位于预览区之后、详情可编辑参数回写、含重新生成按钮。 */
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
  const mk = () => { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8; const x = cv.getContext('2d'); x.fillStyle = '#cc9933'; x.fillRect(0, 0, 8, 8); return cv.toDataURL('image/png'); };
  clearGraph();
  const im = addNode('image', 100, 100);
  im.uploadedImage = mk(); im.outputsData = [{ type: 'image', value: im.uploadedImage }];
  const up = addNode('upscale', 400, 100);
  connectNodes(im.id, 0, up.id, 0);
  await runWorkflow({ force: true, skipPreview: true });   // 产生 genMeta
  if (up.el) buildNodeBody(up.el, up);
  const strip = up.el.querySelector('.node-gen-meta');
  const preview = up.el.querySelector('.node-preview-area');
  const bottom = strip && preview ? (strip.getBoundingClientRect().top >= preview.getBoundingClientRect().top) : false;
  // 展开详情
  const summary = strip && strip.querySelector('.ngm-summary');
  if (summary) summary.click();
  const inputs = strip ? [...strip.querySelectorAll('.ngm-edit input')] : [];
  const ta = strip ? strip.querySelector('.ngm-edit textarea') : null;
  const regen = strip ? [...strip.querySelectorAll('button')].find(b => /应用参数并重新生成/.test(b.textContent)) : null;
  // 编辑模型参数 → 回写 node.params
  let paramWritten = null;
  if (inputs.length) {
    inputs[0].value = 'test-model-X';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    paramWritten = up.params.model;
  }
  // 横向不溢出节点框
  const nr = up.el.getBoundingClientRect();
  const allInputs = [...strip.querySelectorAll('.ngm-edit input, .ngm-edit textarea')];
  const maxRight = allInputs.length ? Math.max(...allInputs.map(i => i.getBoundingClientRect().right)) : 0;
  return {
    hasStrip: !!strip, bottom, inputCount: inputs.length, hasTa: !!ta, hasRegen: !!regen, paramWritten,
    noCorner: !up.el.querySelector('.ngm-corner-retry'),
    overflow: maxRight > nr.right + 1, maxRight: Math.round(maxRight), nodeRight: Math.round(nr.right),
  };
});

check('生成信息条存在', r.hasStrip === true);
check('信息条位于预览区之后(底部参数区)', r.bottom === true, JSON.stringify({ bottom: r.bottom }));
check('详情含可编辑参数(模型/比例/分辨率/张数)', r.inputCount >= 4, 'inputs=' + r.inputCount);
check('详情含提示词编辑框', r.hasTa === true);
check('含「应用参数并重新生成」按钮', r.hasRegen === true);
check('编辑参数回写 node.params', r.paramWritten === 'test-model-X', String(r.paramWritten));
check('角落重试特例已移除', r.noCorner === true);
check('展开后编辑控件不横向溢出节点框', r.overflow === false, JSON.stringify({ maxRight: r.maxRight, nodeRight: r.nodeRight }));

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 信息条入底部参数区：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
