#!/usr/bin/env node
/**
 * 生成信息条入底部参数区防回退：位于出图区之后、详情可编辑参数回写、含重新生成按钮。
 * 承载节点必须是 aiImage —— 信息条只对生成类节点渲染（legacy.js:10875），
 * 高清/线稿节点走自己的下方面板，不在本用例范围内。
 */
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
  // 生成信息条按类型渲染（legacy.js:10875 只认 aiImage/comfyui/imageEdit）；高清/线稿的参数
  // 入口已移入各自下方面板，因此本用例的承载节点必须是 aiImage，且不需要真出图（信息条只读 genMeta）。
  const up = addNode('aiImage', 400, 100);
  up.prompt = '信息条用例：穿白色连衣裙的女孩';
  up.params.model = 'FLUX.1';
  up.params.aspect = '1:1';
  up.params.resolution = '高清1K';
  up.params.count = '2张';
  up.thumb = mk();
  up.outputsData = [{ type: 'image', value: up.thumb }];
  up.status = 'done';
  captureGenMeta(up, 1234);
  buildNodeBody(up.el, up);
  const strip = up.el.querySelector('.node-gen-meta');
  const preview = up.el.querySelector('.node-preview-area') || up.el.querySelector('.node-hero');
  const bottom = strip && preview ? (strip.getBoundingClientRect().top >= preview.getBoundingClientRect().top) : false;
  // 展开详情
  const summary = strip && strip.querySelector('.ngm-summary');
  if (summary) summary.click();
  const inputs = strip ? [...strip.querySelectorAll('.ngm-edit select')] : [];
  const ta = strip ? strip.querySelector('.ngm-edit textarea') : null;
  const regen = strip ? [...strip.querySelectorAll('button')].find(b => /应用参数并重新生成/.test(b.textContent)) : null;
  // 选择模型 → 回写 node.params
  let paramWritten = null;
  if (inputs.length) {
    inputs[0].value = 'GPT Image 2';
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    paramWritten = up.params.model;
  }
  // 横向不溢出节点框
  const nr = up.el.getBoundingClientRect();
  const allInputs = [...strip.querySelectorAll('.ngm-edit input, .ngm-edit select, .ngm-edit textarea')];
  const maxRight = allInputs.length ? Math.max(...allInputs.map(i => i.getBoundingClientRect().right)) : 0;
  return {
    hasStrip: !!strip, bottom, inputCount: inputs.length, hasTa: !!ta, hasRegen: !!regen, paramWritten,
    noCorner: !up.el.querySelector('.ngm-corner-retry'),
    overflow: maxRight > nr.right + 1, maxRight: Math.round(maxRight), nodeRight: Math.round(nr.right),
  };
});

check('生成信息条存在', r.hasStrip === true);
check('信息条位于预览区之后(底部参数区)', r.bottom === true, JSON.stringify({ bottom: r.bottom }));
check('详情含下拉选择(模型/比例/分辨率/张数)', r.inputCount >= 4, 'selects=' + r.inputCount);
check('详情含提示词编辑框', r.hasTa === true);
check('含「应用参数并重新生成」按钮', r.hasRegen === true);
check('选择参数回写 node.params', r.paramWritten === 'GPT Image 2', String(r.paramWritten));
check('角落重试特例已移除', r.noCorner === true);
check('展开后编辑控件不横向溢出节点框', r.overflow === false, JSON.stringify({ maxRight: r.maxRight, nodeRight: r.nodeRight }));

await browser.close(); server.close();
const f = checks.filter(c => !c.p).length;
console.log(`\n==== 信息条入底部参数区：PASS=${checks.length - f} FAIL=${f} ====`);
process.exit(f ? 1 : 0);
