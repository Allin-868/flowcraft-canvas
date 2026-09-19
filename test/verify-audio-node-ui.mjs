#!/usr/bin/env node
/**
 * D 批 音频节点 UI 重构闸门（2026-09-19 用户拍板：只借鉴竞品 TTS 面板「布局/交互」，参数不虚标）。
 *
 * 断言分两类（反向验证靠这个区分「有鉴别力」vs「护栏」）：
 *   U*（新 UI，回退旧版应红）：voiceover/bgm 的波形预览区+Composer+芯片+可折叠高级设置+波形解码渲染+文本可编辑字数联动+预览播放按钮+高级不虚标。
 *   D*（数据护栏，回退旧版仍绿）：配音无 Key 运行→_voPreview·local·不落地文件；配乐本地合成→真实 data:audio/wav；全程无 pageerror。
 * 说明：本文件所有 DOM 访问都做空值防护，缺元素时干净判 false（红）而非抛异常，保证反向验证可计数。
 *
 * 反向验证记录（已实测）：把 voiceover/bgm 节点体回退到 p86 前旧版（无 fc-audio-* 结构）后，本文件 U 类断言全红、D 类护栏仍绿——红的恰是新布局/波形解码/高级不虚标等 UI 能力，绿的是运行回退与合成的数据真相（执行/合成分支未被本轮触碰）——证明本文件有鉴别力且回退/合成语义未退化。还原重建后 11/11。（沙箱禁写 .git，用备份+回退法替代 git stash。）
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function' && typeof buildNodeBody === 'function' && typeof runBgmGenerateNode === 'function');

// U1 · voiceover 新布局结构
const u1 = await page.evaluate(() => {
  const n = addNode('voiceover', 100, 100); n.params.text = '这是一段测试配音文本'; buildNodeBody(n.el, n);
  const el = n.el, q = (s) => el.querySelector(s);
  const wave = q('canvas.fc-audio-wave');
  return {
    preview: !!q('.fc-audio-preview'),
    wave: !!wave && wave.width > 0,
    textarea: !!q('textarea.fc-audio-text'),
    count: q('.fc-audio-count') ? q('.fc-audio-count').textContent : '',
    voiceChip: Array.from(el.querySelectorAll('.fc-audio-chip')).some((s) => /音色/.test(s.textContent)),
    gen: !!q('.fc-audio-gen'),
    advToggle: !!q('.fc-audio-adv-toggle'),
  };
});
check('[U1] voiceover 预览区+Composer 布局（波形 canvas·可编辑文本·字数·音色芯片·生成·高级折叠）',
  u1.preview && u1.wave && u1.textarea && /\d+ 字/.test(u1.count) && u1.voiceChip && u1.gen && u1.advToggle, JSON.stringify(u1));

// U2 · 文本可编辑 + 字数联动 + 写回 p.text
const u2 = await page.evaluate(() => {
  const n = addNode('voiceover', 100, 300); n.params.text = ''; buildNodeBody(n.el, n);
  const ta = n.el.querySelector('textarea.fc-audio-text');
  if (!ta) return { count: '', ptext: n.params.text };
  ta.value = '一二三四五'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  const c = n.el.querySelector('.fc-audio-count');
  return { count: c ? c.textContent : '', ptext: n.params.text };
});
check('[U2] voiceover 文本可编辑且字数联动（input→p.text·字数=5 字）', u2.count === '5 字' && u2.ptext === '一二三四五', JSON.stringify(u2));

// U3 · 高级设置：语速滑杆真实 + 试听语言 + 来源元信息行 + 不虚标（无声调/音量/采样率假控件）
const u3 = await page.evaluate(() => {
  const n = addNode('voiceover', 100, 500); n.params.text = 'x'; buildNodeBody(n.el, n);
  const tg = n.el.querySelector('.fc-audio-adv-toggle'); if (tg) tg.click();
  const panel = n.el.querySelector('.fc-audio-adv'); if (!panel) return { built: false };
  const ranges = Array.from(panel.querySelectorAll('input[type=range]'));
  const labels = panel.textContent;
  return {
    built: panel.dataset.built === '1',
    hasSpeed: ranges.some((r) => r.min === '0.5' && r.max === '2'),
    hasLang: /试听语言/.test(labels),
    hasMeta: !!panel.querySelector('.fc-audio-meta'),
    noPitch: !/声调|音高|pitch/i.test(labels),
    noVolume: !/音量/.test(labels),
    noSample: !/采样率|Hz/i.test(labels),
  };
});
check('[U3] voiceover 高级设置：语速滑杆真实·且不虚标（无声调/音量/采样率假控件）',
  u3.built && u3.hasSpeed && u3.hasLang && u3.hasMeta && u3.noPitch && u3.noVolume && u3.noSample, JSON.stringify(u3));

// U4 · 有真实音频时解码峰值渲染波形（peaks 计算·播放按钮可用）
const u4 = await page.evaluate(async () => {
  const g = await runBgmGenerateNode(addNode('bgm', 900, 100)); // 产 data:audio/wav
  if (typeof fcComputePeaks === 'function') fcComputePeaks._c = null;
  const n = addNode('voiceover', 100, 700); n.params.text = 'hi'; n.uploadedAudio = g.src; buildNodeBody(n.el, n);
  await new Promise((r) => setTimeout(r, 1500));
  const play = n.el.querySelector('.fc-audio-play');
  return {
    peaksCached: typeof fcComputePeaks === 'function' && !!(fcComputePeaks._c && Array.isArray(fcComputePeaks._c.val) && fcComputePeaks._c.val.length > 0),
    playEnabled: !!play && !play.disabled,
  };
});
check('[U4] voiceover 有真实音频时解码峰值渲染波形（peaks 计算·播放按钮可用）', u4.peaksCached && u4.playEnabled, JSON.stringify(u4));

// U5 · 配音无 Key 时预览区渲染试听播放按钮（UI 类）
const u5 = await page.evaluate(async () => {
  try { localStorage.removeItem(OPENAI_KEY_STORAGE); } catch (e) {}
  const n = addNode('voiceover', 100, 900); n.params.text = '测试语音回退'; buildNodeBody(n.el, n);
  await executeNodeAsync(n, 0);
  const playBtn = n.el.querySelector('.fc-audio-play');
  return { playPreview: !!(playBtn && playBtn.classList.contains('is-preview')) };
});
check('[U5] voiceover 无 Key→预览区试听播放按钮（is-preview）', u5.playPreview, JSON.stringify(u5));

// D1 · 数据护栏：配音无 Key 运行回退如实（local·_voPreview·不落地文件）
const d1 = await page.evaluate(async () => {
  try { localStorage.removeItem(OPENAI_KEY_STORAGE); } catch (e) {}
  const n = addNode('voiceover', 100, 1100); n.params.text = '数据护栏';
  await executeNodeAsync(n, 0);
  return { mode: n.resultMode, isPreview: !!n._voPreview, noFile: !n.uploadedAudio };
});
check('[D1·护栏] voiceover 无 Key 运行→浏览器试听回退（local·_voPreview·不伪装文件）',
  d1.mode === 'local' && d1.isPreview && d1.noFile, JSON.stringify(d1));

// U6 · bgm 新布局结构
const u6 = await page.evaluate(() => {
  const n = addNode('bgm', 500, 100); buildNodeBody(n.el, n);
  const el = n.el;
  return {
    preview: !!el.querySelector('.fc-audio-preview'),
    wave: !!el.querySelector('canvas.fc-audio-wave'),
    moodChip: Array.from(el.querySelectorAll('.fc-audio-chip')).some((s) => /情绪/.test(s.textContent)),
    gen: !!el.querySelector('.fc-audio-gen'),
    upload: Array.from(el.querySelectorAll('.fc-audio-chip.btn')).some((s) => /上传|替换/.test(s.textContent)),
    advToggle: !!el.querySelector('.fc-audio-adv-toggle'),
  };
});
check('[U6] bgm 预览区+Composer 布局（波形·情绪芯片·生成·上传·高级折叠）',
  u6.preview && u6.wave && u6.moodChip && u6.gen && u6.upload && u6.advToggle, JSON.stringify(u6));

// U7 · bgm 点生成按钮 → 落地 uploadedAudio + 波形 canvas（UI 交互）
const u7 = await page.evaluate(async () => {
  const n = addNode('bgm', 500, 300); buildNodeBody(n.el, n);
  if (typeof fcComputePeaks === 'function') fcComputePeaks._c = null;
  const gen = n.el.querySelector('.fc-audio-gen'); if (!gen) return { clicked: false };
  gen.click();
  let t = 0; while (t < 5000 && !String(n.uploadedAudio || '').startsWith('data:audio')) { await new Promise((r) => setTimeout(r, 150)); t += 150; }
  await new Promise((r) => setTimeout(r, 1200));
  return {
    clicked: true, landed: /^data:audio\/wav/.test(n.uploadedAudio || ''), mode: n.resultMode,
    hasWaveCanvas: !!n.el.querySelector('canvas.fc-audio-wave'),
    peaks: typeof fcComputePeaks === 'function' && !!(fcComputePeaks._c && fcComputePeaks._c.val && fcComputePeaks._c.val.length),
  };
});
check('[U7] bgm 点生成→落地真实 WAV+波形 canvas+local', u7.clicked && u7.landed && u7.mode === 'local' && u7.hasWaveCanvas && u7.peaks, JSON.stringify(u7));

// D2 · 数据护栏：配乐本地合成产出真实 data:audio/wav（直接调用，与 UI 无关）
const d2 = await page.evaluate(async () => {
  const n = addNode('bgm', 500, 500); n.params.mood = '抒情'; n.params.loopSeconds = 6;
  const g = await runBgmGenerateNode(n);
  return { wav: !!(g && /^data:audio\/wav/.test(g.src)), sizeOk: !!(g && g.src.length > 5000), dur: !!(g && /:\d\d/.test(String(g.duration))) };
});
check('[D2·护栏] bgm 本地合成→真实 data:audio/wav（非占位）', d2.wav && d2.sizeOk && d2.dur, JSON.stringify(d2));

// U8 · bgm 高级设置：时长(4–12)+音量(0–100)真实滑杆 + WAV 元信息
const u8 = await page.evaluate(() => {
  const n = addNode('bgm', 500, 700); buildNodeBody(n.el, n);
  const tg = n.el.querySelector('.fc-audio-adv-toggle'); if (tg) tg.click();
  const panel = n.el.querySelector('.fc-audio-adv'); if (!panel) return { hasDur: false };
  const ranges = Array.from(panel.querySelectorAll('input[type=range]'));
  return {
    hasDur: ranges.some((r) => r.min === '4' && r.max === '12'),
    hasVol: ranges.some((r) => r.min === '0' && r.max === '100'),
    meta: /WAV/.test(panel.textContent),
  };
});
check('[U8] bgm 高级设置：时长(4–12)+音量(0–100)真实滑杆+WAV 元信息', u8.hasDur && u8.hasVol && u8.meta, JSON.stringify(u8));

// D3 · 数据护栏：全程无 pageerror
check('[D3·护栏] 全程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

const ui = checks.filter((c) => /^(\[U|（U)/.test(c.n) || c.n.indexOf('[U') === 0);
console.log(`\nverify-audio-node-ui: ${checks.filter((c) => c.p).length}/${checks.length} 通过（U 新 UI ${ui.filter((c) => c.p).length}/${ui.length}，D 护栏 ${checks.filter((c) => c.n.indexOf('[D') === 0 && c.p).length}/3）`);
await browser.close(); server.close();
process.exit(checks.every((c) => c.p) ? 0 : 1);
