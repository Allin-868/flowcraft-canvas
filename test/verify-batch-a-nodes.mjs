#!/usr/bin/env node
/**
 * A 批节点补齐闸门（2026-09-19 用户盘点拍板）：7 个占位节点获得真实能力 + registry 徽标纠正。
 *
 * 覆盖：
 *   compare     —— canvas 真实左右拼接上游两张图（不再是「原/果」占位图）；不足两张如实回退占位
 *   videoBreak  —— 复用反推提示词抽帧管线对真实视频抽 N 帧（关键帧=真帧）；无视频如实回退
 *   subtitle    —— 沿连线回溯上游文本本地切分句读 + 估算时间轴（不再是写死的演示行）
 *   aiSet       —— 有 Key 时批量真实生成 N 张（mock images/generations）
 *   material    —— 接入图生图通道（mock images/edits）；light/layout 同分支不重复测
 *   徽标        —— upscale/lineart/save/reversePrompt 等 8 类 tier 与实际能力对齐
 *
 * 反向验证记录：修复前本文件 6 红 4 绿——红的恰是 6 项新能力/徽标，4 条「如实回退占位」护栏与 pageerror 修复前后都绿（兜底路径未动）。另一夹具教训：下游节点运行前，上游输入节点要先 executeNodeAsync 产出 outputsData，否则 gatherInputs 拿不到上游图。第 ⑩ 条徽标一致性断言的反向验证：抽掉 legacy.js 的 refreshLibraryTierBadges 后该条恰红（lib 徽标回退「演示」），见 verify-node-semantics 同轮验证。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const SCRIPT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = process.env.FLOWCRAFT_ROOT || join(resolve(SCRIPT_DIR, '../../..'), '输出成果', 'deploy');
const checks = [];
const check = (n, p, d = '') => { checks.push({ n, p: Boolean(p) }); console.log(`${p ? '  ✅' : '  ❌'} ${n}${d ? '：' + d : ''}`); };

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const server = http.createServer((q, r) => {
  if (!existsSync(join(ROOT, 'index.html'))) { r.writeHead(500); r.end('no index'); return; }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(readFileSync(join(ROOT, 'index.html')));
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const { port } = server.address();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// mock 生图/图生图端点（直连 Key 路径，base 指向 mock.fc 由 route 兑现，不出真实网络）
await page.route('**/images/generations**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ b64_json: PNG_1X1 }] }) }));
await page.route('**/images/edits**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ b64_json: PNG_1X1 }] }) }));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
// 经典脚本顶层绑定用裸标识符访问（不在 window 上）
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');
await page.evaluate(() => {
  localStorage.setItem('flowcraft-openai-key', 'sk-gate-mock');
  localStorage.setItem('flowcraft-openai-base', 'http://mock.fc/v1');
});

// ① compare 真实拼接
const cmp = await page.evaluate(async () => {
  const mk = (color) => { const c = document.createElement('canvas'); c.width = 100; c.height = 100; const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 100, 100); return c.toDataURL('image/png'); };
  const a = addNode('image', 100, 100); a.uploadedImage = mk('#FF0000');
  const b = addNode('image', 100, 260); b.uploadedImage = mk('#0000FF');
  const c = addNode('compare', 400, 160);
  connectNodes(a.id, 0, c.id, 0); connectNodes(b.id, 0, c.id, 1);
  // 夹具：输入节点先运行产出 outputsData，下游 gatherInputs 才拿得到上游图
  await executeNodeAsync(a, 0); await executeNodeAsync(b, 0);
  await executeNodeAsync(c, 0);
  const out = c.outputsData && c.outputsData[0];
  if (!out || typeof out.value !== 'string' || !out.value.startsWith('data:')) return { fail: '非 dataURL', mode: c.resultMode };
  const im = new Image(); im.src = out.value;
  await new Promise((res, rej) => { im.onload = res; im.onerror = rej; });
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
  const L = ctx.getImageData(10, 50, 1, 1).data, R = ctx.getImageData(im.naturalWidth - 10, 50, 1, 1).data;
  return { w: im.naturalWidth, h: im.naturalHeight, leftRed: L[0] > 200 && L[1] < 60, rightBlue: R[2] > 200 && R[0] < 60, mode: c.resultMode };
});
check('compare 真实拼接上游两图（202×100，左红右蓝，real）', cmp.w === 202 && cmp.h === 100 && cmp.leftRed && cmp.rightBlue && cmp.mode === 'real', JSON.stringify(cmp));

// ② compare 不足两张 → 如实回退占位
const cmpFallback = await page.evaluate(async () => {
  const c = addNode('compare', 400, 400);
  await executeNodeAsync(c, 0);
  return c.resultMode;
});
check('compare 无上游图如实回退占位（demo）', cmpFallback === 'demo', String(cmpFallback));

// ③ videoBreak 真实抽帧（MediaRecorder 现场录制约 1s 的 320×240 webm）
const vb = await page.evaluate(async () => {
  const mkVideo = () => new Promise((resolveVid) => {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240;
    const ctx = cv.getContext('2d');
    const rec = new MediaRecorder(cv.captureStream(25), { mimeType: 'video/webm' });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => resolveVid(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
    let f = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${f * 12},80%,50%)`; ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = '#fff'; ctx.font = '48px sans-serif'; ctx.fillText(String(f), 20, 70);
      if (++f > 30) { clearInterval(timer); rec.stop(); }
    }, 33);
    rec.start();
  });
  const url = await mkVideo();
  const vi = addNode('videoInput', 100, 500); vi.uploadedVideo = url;
  const brk = addNode('videoBreak', 400, 500);
  connectNodes(vi.id, 0, brk.id, 0);
  await executeNodeAsync(vi, 0); // 夹具：先让 videoInput 产出带 src 的输出
  await executeNodeAsync(brk, 0);
  const out = brk.outputsData && brk.outputsData[0];
  if (!out || typeof out.value !== 'string' || !out.value.startsWith('data:')) return { fail: '关键帧非 dataURL', mode: brk.resultMode };
  const im = new Image(); im.src = out.value;
  await new Promise((res, rej) => { im.onload = res; im.onerror = rej; });
  return { w: im.naturalWidth, frames: (brk._breakFrames || []).length, mode: brk.resultMode };
});
check('videoBreak 对真实视频抽出真帧（帧宽=320 视频宽，≥3 帧，real）', vb.w === 320 && vb.frames >= 3 && vb.mode === 'real', JSON.stringify(vb));

// ④ videoBreak 无视频 → 如实回退
const vbFb = await page.evaluate(async () => {
  const b = addNode('videoBreak', 400, 700);
  await executeNodeAsync(b, 0);
  return b.resultMode;
});
check('videoBreak 无真实视频如实回退占位（demo）', vbFb === 'demo', String(vbFb));

// ⑤ subtitle 沿连线回溯切分
const sub = await page.evaluate(async () => {
  const sc = addNode('script', 100, 900);
  const vo = addNode('voiceover', 300, 900); vo.params.text = '测试甲句。测试乙句！测试丙句';
  const su = addNode('subtitle', 500, 900);
  connectNodes(sc.id, 0, vo.id, 0); connectNodes(vo.id, 0, su.id, 0);
  await executeNodeAsync(su, 0);
  const lines = su.params.lines || [];
  return { n: lines.length, t0: lines[0] && lines[0].time, t1: lines[1] && lines[1].time, txt1: lines[1] && lines[1].text, mode: su.resultMode };
});
check('subtitle 本地切分上游文本（3 行、时间轴递增、文本正确，local）',
  sub.n === 3 && sub.t0 === '00:00' && sub.t1 > '00:00' && sub.txt1 === '测试乙句' && sub.mode === 'local', JSON.stringify(sub));

// ⑥ subtitle 无上游 → 如实回退
const subFb = await page.evaluate(async () => {
  const s = addNode('subtitle', 700, 900);
  await executeNodeAsync(s, 0);
  return s.resultMode;
});
check('subtitle 无上游文本如实回退演示（demo）', subFb === 'demo', String(subFb));

// ⑦ aiSet 批量真实生成（mock generations ×2）
const set = await page.evaluate(async () => {
  const g = addNode('aiSet', 400, 1000);
  g.prompt = '图集测试提示词';
  g.params.count = 2;
  await executeNodeAsync(g, 0);
  return { gallery: (g._galleryImages || []).length, mode: g.resultMode, status: g.status };
});
check('aiSet 有 Key 批量真实生成 2 张（real）', set.gallery === 2 && set.mode === 'real' && set.status === 'done', JSON.stringify(set));

// ⑧ material 走图生图通道（mock edits）
const mat = await page.evaluate(async () => {
  const a = addNode('image', 100, 1150);
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#00FF00'; x.fillRect(0, 0, 64, 64);
  a.uploadedImage = c.toDataURL('image/png');
  const m = addNode('material', 400, 1150);
  connectNodes(a.id, 0, m.id, 0);
  await executeNodeAsync(a, 0); // 夹具：上游图先产出
  await executeNodeAsync(m, 0);
  return { mode: m.resultMode, thumbIsMock: typeof m.thumb === 'string' && m.thumb.length < 200 && m.thumb.startsWith('data:') };
});
check('material 接图生图通道出真结果（mock edits，real）', mat.mode === 'real' && mat.thumbIsMock, JSON.stringify(mat));

// ⑨ registry 徽标与实际能力对齐
const tiers = await page.evaluate(() => {
  const g = (t) => window.FlowCraft.nodes.getNodeMeta(t).tier;
  return {
    upscale: g('upscale'), lineart: g('lineart'), save: g('save'), reversePrompt: g('reversePrompt'),
    compare: g('compare'), videoBreak: g('videoBreak'), subtitle: g('subtitle'),
    aiSet: g('aiSet'), material: g('material'), light: g('light'), layout: g('layout'),
    footage: g('footage'), compose: g('compose'), publish: g('publish'),
  };
});
const tierOk = tiers.upscale === 'production' && tiers.lineart === 'production' && tiers.save === 'local' && tiers.reversePrompt === 'production'
  && tiers.compare === 'local' && tiers.videoBreak === 'local' && tiers.subtitle === 'local'
  && tiers.aiSet === 'production' && tiers.material === 'production' && tiers.light === 'production' && tiers.layout === 'production'
  && tiers.footage === 'demo' && tiers.compose === 'local' && tiers.publish === 'local'; // C 批 compose/publish 升 local，仅 footage 保留 demo
check('registry 徽标与能力对齐（11 升档 + compose/publish C 批升 local、footage 如实保留 demo）', tierOk, JSON.stringify(tiers));

// ⑩ sidebar 节点库徽标与 registry tier 一致（钉第 9 处缺陷：lib 徽标曾在 registry 加载前同步渲染，永远吃 fallback）
const libBadges = await page.evaluate(() => {
  const badge = (t) => document.querySelector(`.node-library-item[data-type="${t}"] .lib-tier-badge`)?.textContent?.trim() || '';
  const label = (t) => window.FlowCraft.nodes.getNodeMeta(t).tier === 'production' ? '真实' : window.FlowCraft.nodes.getNodeMeta(t).tier === 'local' ? '本地' : window.FlowCraft.nodes.getNodeMeta(t).tier === 'input' ? '输入' : '演示';
  const types = ['upscale', 'lineart', 'save', 'reversePrompt', 'compare', 'aiSet', 'material', 'subtitle'];
  return types.map((t) => ({ t, badge: badge(t), expect: label(t) }));
});
const libOk = libBadges.every((x) => x.badge === x.expect);
check('sidebar 节点库徽标与 registry tier 一致（第 9 处缺陷钉死）', libOk, JSON.stringify(libBadges));

// ⑪ 无 pageerror
check('全程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`\nverify-batch-a-nodes: ${checks.filter((c) => c.p).length}/${checks.length} 通过`);
await browser.close(); server.close();
process.exit(checks.every((c) => c.p) ? 0 : 1);
