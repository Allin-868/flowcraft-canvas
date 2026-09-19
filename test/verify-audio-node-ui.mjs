#!/usr/bin/env node
/**
 * E 批 音频整合节点闸门（2026-09-19 用户拍板：配音与配乐直接做成 1 个整合节点）。
 * 设计契约（AskUserQuestion 三项全选推荐）：
 *   1) 模式切换：单一 audio 节点，节点体内「🎤 配音 / 🎵 配乐」tab 互斥切换，单音频输出；
 *   2) 自动迁移：存档 v5 的 voiceover/bgm 实例在 migrateAutosave 统一转为 audio + audioMode，params 无损；
 *   3) 旧类型保留为兼容类型（validateWorkflowData 先于迁移运行，删类型会导致旧档整体拒绝恢复=数据丢失；
 *      batch-b 测试也直接 addNode('voiceover'/'bgm')），节点库/HUD/分组/演示模板只暴露 audio。
 *
 * 断言分两类（反向验证靠这个区分「有鉴别力」vs「护栏」）：
 *   U*（整合节点+迁移，回退 p89/p90 应红）：audio 类型注册、tab 切换互换、模式内新 UI 全套、
 *     生成落 WAV+波形、迁移语义（type/audioMode/params 无损/version=6）、旧类型仍渲染跑兼容分支。
 *   D*（数据护栏，回退旧版仍绿）：配音无 Key 运行→_voPreview·local·不落地文件；配乐本地合成→真实
 *     data:audio/wav；全程无 pageerror。
 * 说明：本文件所有 DOM 访问都做空值防护，缺元素时干净判 false（红）而非抛异常，保证反向验证可计数。
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
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function' && typeof buildNodeBody === 'function' && typeof runBgmGenerateNode === 'function' && typeof migrateAutosave === 'function');

// U1 · 整合节点默认配音模式：tab 存在且选中配音 + 配音 Composer 全套
const u1 = await page.evaluate(() => {
  const n = addNode('audio', 100, 100); n.params.text = '这是一段整合节点测试文本'; buildNodeBody(n.el, n);
  const el = n.el, q = (s) => el.querySelector(s);
  const tabs = Array.from(el.querySelectorAll('.fc-audio-tab'));
  const wave = q('canvas.fc-audio-wave');
  return {
    tabCount: tabs.length,
    voActive: !!q('.fc-audio-tab.active') && /配音/.test(q('.fc-audio-tab.active').textContent),
    preview: !!q('.fc-audio-preview'),
    waveform: !!wave && wave.width > 0,
    textarea: !!q('textarea.fc-audio-text'),
    count: q('.fc-audio-count') ? q('.fc-audio-count').textContent : '',
    gen: !!q('.fc-audio-gen'),
    advToggle: !!q('.fc-audio-adv-toggle'),
  };
});
check('[U1] audio 节点默认配音模式（两 tab·配音选中·预览区·波形·文本·字数·生成·高级折叠）',
  u1.tabCount === 2 && u1.voActive && u1.preview && u1.waveform && u1.textarea && /\d+ 字/.test(u1.count) && u1.gen && u1.advToggle, JSON.stringify(u1));

// U2 · 模式切换：点「配乐」tab → Composer 互换为配乐形态（情绪芯片/上传），点回配音还原
const u2 = await page.evaluate(async () => {
  const n = addNode('audio', 100, 300); n.params.text = 'x'; buildNodeBody(n.el, n);
  const tabOf = (re) => Array.from(n.el.querySelectorAll('.fc-audio-tab')).find((b) => re.test(b.textContent));
  const bgmTab = tabOf(/配乐/); if (bgmTab) bgmTab.click();
  await new Promise((r) => setTimeout(r, 100));
  const inBgm = {
    bgmActive: !!(n.el.querySelector('.fc-audio-tab.active') && /配乐/.test(n.el.querySelector('.fc-audio-tab.active').textContent)),
    moodChip: Array.from(n.el.querySelectorAll('.fc-audio-chip')).some((s) => /情绪/.test(s.textContent)),
    upload: Array.from(n.el.querySelectorAll('.fc-audio-chip.btn')).some((s) => /上传|替换/.test(s.textContent)),
    noVoTextarea: !n.el.querySelector('textarea.fc-audio-text'),
    mode: n.params.audioMode,
  };
  const voTab = tabOf(/配音/); if (voTab) voTab.click();
  await new Promise((r) => setTimeout(r, 100));
  const backVo = { voActive: !!n.el.querySelector('textarea.fc-audio-text'), mode: n.params.audioMode };
  return { inBgm, backVo };
});
check('[U2] tab 模式切换互换 Composer（配音↔配乐·audioMode 落参·配音文本框不残留）',
  u2.inBgm.bgmActive && u2.inBgm.moodChip && u2.inBgm.upload && u2.inBgm.noVoTextarea && u2.inBgm.mode === 'bgm' && u2.backVo.voActive && u2.backVo.mode === 'voiceover', JSON.stringify(u2));

// U3 · 配音模式高级设置：语速滑杆真实 + 不虚标（无声调/音量/采样率假控件）
const u3 = await page.evaluate(() => {
  const n = addNode('audio', 100, 500); n.params.text = 'x'; buildNodeBody(n.el, n);
  const tg = n.el.querySelector('.fc-audio-adv-toggle'); if (tg) tg.click();
  const panel = n.el.querySelector('.fc-audio-adv'); if (!panel) return { built: false };
  const ranges = Array.from(panel.querySelectorAll('input[type=range]'));
  const labels = panel.textContent;
  return {
    built: panel.dataset.built === '1',
    hasSpeed: ranges.some((r) => r.min === '0.5' && r.max === '2'),
    hasLang: /试听语言/.test(labels),
    noPitch: !/声调|音高|pitch/i.test(labels),
    noVolume: !/音量/.test(labels),
    noSample: !/采样率|Hz/i.test(labels),
  };
});
check('[U3] audio 配音模式高级设置：语速滑杆真实·且不虚标（无声调/音量/采样率假控件）',
  u3.built && u3.hasSpeed && u3.hasLang && u3.noPitch && u3.noVolume && u3.noSample, JSON.stringify(u3));

// U4 · 配乐模式点生成 → 落地真实 WAV + 波形解码渲染（单节点内闭环）
const u4 = await page.evaluate(async () => {
  const n = addNode('audio', 100, 700); buildNodeBody(n.el, n);
  const bgmTab = Array.from(n.el.querySelectorAll('.fc-audio-tab')).find((b) => /配乐/.test(b.textContent));
  if (bgmTab) bgmTab.click();
  await new Promise((r) => setTimeout(r, 100));
  if (typeof fcComputePeaks === 'function') fcComputePeaks._c = null;
  const gen = n.el.querySelector('.fc-audio-gen'); if (!gen) return { clicked: false };
  gen.click();
  let t = 0; while (t < 6000 && !String(n.uploadedAudio || '').startsWith('data:audio')) { await new Promise((r) => setTimeout(r, 150)); t += 150; }
  await new Promise((r) => setTimeout(r, 1200));
  return {
    clicked: true, landed: /^data:audio\/wav/.test(n.uploadedAudio || ''), mode: n.resultMode,
    hasWaveCanvas: !!n.el.querySelector('canvas.fc-audio-wave'),
    playEnabled: (() => { const p = n.el.querySelector('.fc-audio-play'); return !!p && !p.disabled; })(),
    peaks: typeof fcComputePeaks === 'function' && !!(fcComputePeaks._c && fcComputePeaks._c.val && fcComputePeaks._c.val.length),
  };
});
check('[U4] audio 配乐模式点生成→真实 WAV 落地+波形解码渲染+local',
  u4.clicked && u4.landed && u4.mode === 'local' && u4.hasWaveCanvas && u4.playEnabled && u4.peaks, JSON.stringify(u4));

// U4b · 整合节点配音模式无 Key 运行 → 预览区 is-preview 试听按钮（UI 类，回退 E 批应红）
const u4b = await page.evaluate(async () => {
  try { localStorage.removeItem(OPENAI_KEY_STORAGE); } catch (e) {}
  const n = addNode('audio', 500, 300); n.params.audioMode = 'voiceover'; n.params.text = '测试语音回退'; buildNodeBody(n.el, n);
  await executeNodeAsync(n, 0);
  const playBtn = n.el.querySelector('.fc-audio-play');
  return { playPreview: !!(playBtn && playBtn.classList.contains('is-preview')) };
});
check('[U4b] audio 配音模式无 Key→预览区试听播放按钮（is-preview）', u4b.playPreview, JSON.stringify(u4b));

// U5 · 自动迁移：v5 存档 voiceover/bgm → audio+audioMode，params 无损，version=6，且迁移后节点体可渲染
const u5 = await page.evaluate(() => {
  const parsed = {
    version: 5,
    nodes: [
      { id: 'a', type: 'voiceover', params: { text: '保留文本', speed: '1.2', voice: '晓晓' } },
      { id: 'b', type: 'bgm', params: { mood: '抒情', loopSeconds: 6 } },
    ],
    edges: [],
  };
  const out = migrateAutosave(parsed, 5);
  const vo = out.nodes[0], bg = out.nodes[1];
  const n = addNode('audio', 100, 900);
  n.params.text = vo.params.text; n.params.audioMode = vo.params.audioMode; buildNodeBody(n.el, n);
  return {
    version: out.version,
    voType: vo.type, voMode: vo.params && vo.params.audioMode, voTextKept: vo.params && vo.params.text === '保留文本',
    bgType: bg.type, bgMode: bg.params && bg.params.audioMode, bgMoodKept: bg.params && bg.params.mood === '抒情',
    renders: !!n.el.querySelector('.fc-audio-tabs'),
  };
});
check('[U5] v5→v6 自动迁移：voiceover/bgm→audio+audioMode·params 无损·version=6·迁移后渲染 tab',
  u5.version === 6 && u5.voType === 'audio' && u5.voMode === 'voiceover' && u5.voTextKept && u5.bgType === 'audio' && u5.bgMode === 'bgm' && u5.bgMoodKept && u5.renders, JSON.stringify(u5));

// U6 · 兼容路径：旧类型 addNode('voiceover') 仍渲染 Composer 跑兼容分支（batch-b 依赖此语义）
const u6 = await page.evaluate(() => {
  const n = addNode('voiceover', 500, 100); n.params.text = '旧类型仍可用'; buildNodeBody(n.el, n);
  const el = n.el;
  return { textarea: !!el.querySelector('textarea.fc-audio-text'), gen: !!el.querySelector('.fc-audio-gen'), noTabs: !el.querySelector('.fc-audio-tabs') };
});
check('[U6] 兼容类型：旧 voiceover 节点仍可渲染（Composer 在·无 tab·不强制升级单节点）',
  u6.textarea && u6.gen && u6.noTabs, JSON.stringify(u6));

// D1 · 数据护栏：配音无 Key 运行回退如实（local·_voPreview·不落地文件）。走旧兼容类型路径，
// 与 audio 整合节点解耦——回退 E 批后本断言仍应绿（护栏语义：回退分支本身未被触碰）。
const d1 = await page.evaluate(async () => {
  try { localStorage.removeItem(OPENAI_KEY_STORAGE); } catch (e) {}
  const n = addNode('voiceover', 500, 300); n.params.text = '数据护栏';
  await executeNodeAsync(n, 0);
  return { mode: n.resultMode, isPreview: !!n._voPreview, noFile: !n.uploadedAudio };
});
check('[D1·护栏] 配音无 Key 运行→浏览器试听回退（local·_voPreview·不伪装文件）',
  d1.mode === 'local' && d1.isPreview && d1.noFile, JSON.stringify(d1));

// D2 · 数据护栏：配乐本地合成产出真实 data:audio/wav（直接调用，与 UI 无关）
const d2 = await page.evaluate(async () => {
  const n = addNode('audio', 500, 500); n.params.audioMode = 'bgm'; n.params.mood = '抒情'; n.params.loopSeconds = 6;
  const g = await runBgmGenerateNode(n);
  return { wav: !!(g && /^data:audio\/wav/.test(g.src)), sizeOk: !!(g && g.src.length > 5000), dur: !!(g && /:\d\d/.test(String(g.duration))) };
});
check('[D2·护栏] 配乐本地合成→真实 data:audio/wav（非占位）', d2.wav && d2.sizeOk && d2.dur, JSON.stringify(d2));

// D3 · 数据护栏：全程无 pageerror
check('[D3·护栏] 全程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

const ui = checks.filter((c) => c.n.indexOf('[U') === 0);
const guard = checks.filter((c) => c.n.indexOf('[D') === 0);
console.log(`\nverify-audio-node-ui: ${checks.filter((c) => c.p).length}/${checks.length} 通过（U 整合节点+迁移 ${ui.filter((c) => c.p).length}/${ui.length}，D 护栏 ${guard.filter((c) => c.p).length}/${guard.length}）`);
await browser.close(); server.close();
process.exit(checks.every((c) => c.p) ? 0 : 1);
