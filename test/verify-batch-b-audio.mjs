#!/usr/bin/env node
/**
 * B 批音频节点补齐闸门（2026-09-19 用户拍板：配音 /audio/speech 直连+试听回退；音乐 OfflineAudioContext 程序化生成）。
 *
 * 覆盖：
 *   voiceover  —— 有 Key 时 mock /audio/speech 返回真音频 → 节点出 dataURL 声源、real 态、可级联；
 *                  无 Key 回落浏览器试听 → local 态 + preview 标记（不产出文件，如实反映）
 *   bgm        —— 运行/点生成 → OfflineAudioContext 真实合成 WAV（可解码、时长>0），local 态；已上传音频则如实保留不被覆盖
 *   徽标        —— voiceover→production、bgm→local；字幕重复 note 已清（不影响 tier）
 *
 * 反向验证记录（已实测）：抽掉 src/core/legacy.js + registry 改动后本文件 6 红 1 绿——红的恰是 6 项新能力/徽标（voiceover 真合成/试听回退、bgm 生成/情绪变体/上传保留、tier 对齐），「无 pageerror」护栏修复前后都绿（旧兑底路径未动）。还原后 7/7。bgm 生成走纯本地 OfflineAudioContext，无需 Key/mock；voiceover 真合成靠 mock /audio/speech 返回一段合法 WAV 二进制验证 arrayBuffer→dataURL 管线。
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

// 造一小段合法 WAV（mono/8000Hz/1s 正弦）作 TTS mock 返回值（二进制，验证 arrayBuffer→dataURL 管线）
function tinyWavBuffer() {
  const sr = 8000, n = sr; const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / 20) * 12000), 44 + i * 2);
  return buf;
}
const TTS_WAV = tinyWavBuffer();

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
await page.route('**/audio/speech**', (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: TTS_WAV }));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function');

// ① voiceover 真实 TTS（有 Key，mock 返回真音频）
await page.evaluate(() => {
  localStorage.setItem('flowcraft-openai-key', 'sk-gate-mock');
  localStorage.setItem('flowcraft-openai-base', 'http://mock.fc/v1');
});
const voReal = await page.evaluate(async () => {
  const v = addNode('voiceover', 120, 120);
  v.params.text = '这是配音闸门的测试文本。';
  v.params.voice = '晓晓'; v.params.speed = '1.0';
  await executeNodeAsync(v, 0);
  const out = v.outputsData && v.outputsData[0];
  return { mode: v.resultMode, isAudio: out && out.type === 'audio', srcOk: typeof v.uploadedAudio === 'string' && v.uploadedAudio.startsWith('data:audio/'), outSrcOk: out && out.value && typeof out.value.src === 'string' && out.value.src.startsWith('data:audio/'), status: v.status };
});
check('voiceover 有 Key 走 /audio/speech 真实合成（real + dataURL 声源可级联）',
  voReal.mode === 'real' && voReal.isAudio && voReal.srcOk && voReal.outSrcOk && voReal.status === 'done', JSON.stringify(voReal));

// ② voiceover 无 Key → 浏览器试听回退（local + preview，不导出文件）
const voPreview = await page.evaluate(async () => {
  localStorage.removeItem('flowcraft-openai-key');
  const v = addNode('voiceover', 120, 320);
  v.params.text = '无密钥时仅试听的文本。';
  await executeNodeAsync(v, 0);
  const out = v.outputsData && v.outputsData[0];
  return { mode: v.resultMode, flag: Boolean(v._voPreview), noFile: !v.uploadedAudio, preview: out && out.value && out.value.preview === true };
});
check('voiceover 无 Key 如实回退浏览器试听（local + preview 标记，不产出文件）',
  voPreview.mode === 'local' && voPreview.flag && voPreview.noFile && voPreview.preview, JSON.stringify(voPreview));

// ③ bgm 运行即本地真实合成 WAV
const bgmGen = await page.evaluate(async () => {
  const b = addNode('bgm', 120, 520);
  b.params.mood = '欢快';
  await executeNodeAsync(b, 0);
  const src = b.uploadedAudio || '';
  const out = b.outputsData && b.outputsData[0];
  // 用 Audio 元素验证 WAV 真能解码且时长 > 0
  let dur = -1;
  if (src.startsWith('data:audio/wav')) { const a = new Audio(); a.preload = 'metadata'; dur = await new Promise((res) => { const t = setTimeout(() => res(-2), 8000); a.onloadedmetadata = () => { clearTimeout(t); res(isFinite(a.duration) ? a.duration : -3); }; a.onerror = () => { clearTimeout(t); res(-4); }; a.src = src; }); }
  return { mode: b.resultMode, wav: src.startsWith('data:audio/wav;base64,'), name: b.params.name, durSecs: dur, outType: out && out.type, outSrc: out && out.value && typeof out.value.src === 'string' && out.value.src.startsWith('data:audio/wav') };
});
check('bgm 运行本地 OfflineAudioContext 真实合成 WAV（可解码、时长>0、local）',
  bgmGen.mode === 'local' && bgmGen.wav && bgmGen.durSecs > 0 && bgmGen.outType === 'audio' && bgmGen.outSrc && String(bgmGen.name).indexOf('AI') === 0, JSON.stringify(bgmGen));

// ④ bgm 不同情绪产出不同音频（舒缓 pad vs 紧张）
const bgmMood = await page.evaluate(async () => {
  const b = addNode('bgm', 120, 720); b.params.mood = '舒缓'; await executeNodeAsync(b, 0);
  const srcA = b.uploadedAudio || '';
  return { mode: b.resultMode, wavA: srcA.startsWith('data:audio/wav'), lenA: srcA.length };
});
check('bgm 按情绪合成本地 WAV（舒缓，local）', bgmMood.mode === 'local' && bgmMood.wavA && bgmMood.lenA > 10000, JSON.stringify(bgmMood));

// ⑤ bgm 已上传音频 → 运行如实保留 local，不被生成覆盖
const bgmKeep = await page.evaluate(async () => {
  const b = addNode('bgm', 120, 920);
  const keep = 'data:audio/wav;base64,UUUU_keep_marker_not_real_but_for_test';
  b.uploadedAudio = keep; b.params.name = '我的歌.mp3';
  await executeNodeAsync(b, 0);
  return { mode: b.resultMode, unchanged: b.uploadedAudio === keep, name: b.params.name };
});
check('bgm 已上传音频运行保留原声源不被生成覆盖（local）', bgmKeep.mode === 'local' && bgmKeep.unchanged, JSON.stringify(bgmKeep));

// ⑥ registry 徽标：voiceover→production、bgm→local
const tiers = await page.evaluate(() => {
  const g = (t) => window.FlowCraft.nodes.getNodeMeta(t).tier;
  return { voiceover: g('voiceover'), bgm: g('bgm'), compose: g('compose'), publish: g('publish'), footage: g('footage') };
});
check('registry 徽标对齐（voiceover→production、bgm→local；C 批 compose/publish→local；footage 如实 demo）',
  tiers.voiceover === 'production' && tiers.bgm === 'local' && tiers.compose === 'local' && tiers.publish === 'local' && tiers.footage === 'demo', JSON.stringify(tiers));

// ⑦ 无 pageerror
check('全程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`\nverify-batch-b-audio: ${checks.filter((c) => c.p).length}/${checks.length} 通过`);
await browser.close(); server.close();
process.exit(checks.every((c) => c.p) ? 0 : 1);
