#!/usr/bin/env node
/**
 * C 批 compose/publish 补齐闸门（2026-09-19 用户拍板：均走浏览器端真实本地能力，零服务端 / 零密钥）。
 *
 * 覆盖：
 *   compose —— 有真实上游视频 → canvas 抽帧重绘 + 字幕烧制 + MediaRecorder 录制 → webm（可解码·时长>0·local）；
 *               带字幕输入仍产出；无任何输入如实回退占位（demo，不伪装 progress:100）
 *   publish —— 有上游视频 → 真实发布包（标题/简介/标签 + 各平台上传深链 + 封面抽帧）·local；
 *               无任何输入如实回退占位（demo，不伪装 status:published）
 *   徽标      —— compose→local、publish→local；footage 仍如实 demo（本轮未做）
 *
 * 反向验证记录（已实测）：禁用 compose/publish 执行分支 + 回退 registry tier 后本文件 4 红 3 绿——红的恰是 4 项新能力（compose 真合成、compose 字幕版、publish 交付包、tier 对齐），绿的是 3 项护栏（compose/publish 无输入如实回退 demo、无 pageerror）——证明回退路径真实存在且本文件有鉴别力。还原重建后 7/7。（沙箱禁写 .git，故用备份+突变法替代 git stash。）
 *   compose/publish 夹具用 canvas+MediaRecorder 现场录制 ~0.6s 的 blob webm（同域不污染，可被抽帧与二次录制）。
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
await page.waitForFunction(() => window.FlowCraft && workflow && typeof addNode === 'function' && typeof runComposeNode === 'function');

// 造一小段 ~0.6s 的 blob webm（canvas+MediaRecorder，同域不污染）
await page.addScriptTag({ content: `window.__mkClip = () => new Promise((res) => {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const x = cv.getContext('2d');
  const rec = new MediaRecorder(cv.captureStream(25), { mimeType: 'video/webm' }); const ch = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) ch.push(e.data); };
  rec.onstop = () => res(URL.createObjectURL(new Blob(ch, { type: 'video/webm' })));
  let f = 0; rec.start();
  const t = setInterval(() => { x.fillStyle = 'hsl(' + (f * 20) + ',75%,50%)'; x.fillRect(0, 0, 320, 240); x.fillStyle = '#fff'; x.fillRect(20 + f * 6, 90, 40, 60); if (++f > 16) { clearInterval(t); rec.stop(); } }, 33);
});` });

// ① compose 真合成（单片段，无字幕）
const cmp1 = await page.evaluate(async () => {
  const url = await window.__mkClip();
  const vi = addNode('videoInput', 100, 120); vi.uploadedVideo = url;
  const co = addNode('compose', 460, 120); co.params.resolution = '720×1280';
  connectNodes(vi.id, 0, co.id, 0);
  await executeNodeAsync(vi, 0);
  await executeNodeAsync(co, 0);
  const out = co.outputsData && co.outputsData[0];
  let dur = -1;
  const cu = co._compositedUrl || '';
  // MediaRecorder 产的 webm 无时长元数据（duration=Infinity）：seek 到尾部令 Chrome 钳出真实时长（p75b 同源）
  if (cu.startsWith('blob:')) { const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; dur = await new Promise((r) => { let done = false; const fin = (x) => { if (!done) { done = true; clearTimeout(t); r(x); } }; const t = setTimeout(() => fin(-2), 9000); v.onloadedmetadata = () => { if (isFinite(v.duration) && v.duration > 0) fin(v.duration); else v.currentTime = 1e101; }; v.ondurationchange = () => { if (isFinite(v.duration) && v.duration > 0) fin(v.duration); }; v.ontimeupdate = () => { if (isFinite(v.duration) && v.duration > 0) fin(v.duration); }; v.onerror = () => fin(-4); v.src = cu; }); }
  return { mode: co.resultMode, status: co.status, blob: cu.startsWith('blob:'), outType: out && out.type, outSrc: out && out.value && typeof out.value.src === 'string' && out.value.src.startsWith('blob:'), poster: typeof co.thumb === 'string' && co.thumb.startsWith('data:image'), durRe: /^\d+s$/.test(String(co.params.duration)), resRe: /\d+×\d+/.test(String(co.params.resolution)), sizeOk: /(KB|MB|B)$/.test(String(co.params.size)), decoded: dur };
});
check('compose 真实合成 webm（blob 声源可解码·时长>0·poster/分辨率/体积真实·local）',
  cmp1.mode === 'local' && cmp1.status === 'done' && cmp1.blob && cmp1.outType === 'video' && cmp1.outSrc && cmp1.poster && cmp1.durRe && cmp1.resRe && cmp1.sizeOk && cmp1.decoded > 0, JSON.stringify(cmp1));

// ② compose 带字幕输入仍产出（抽帧重绘 + 字幕烧制路径不报错）
const cmp2 = await page.evaluate(async () => {
  const url = await window.__mkClip();
  const vi = addNode('videoInput', 100, 360); vi.uploadedVideo = url;
  const tx = addNode('text', 100, 560); tx.params.text = '第一句字幕。第二句字幕。第三句字幕';
  const co = addNode('compose', 460, 360); co.params.resolution = '540×960';
  connectNodes(vi.id, 0, co.id, 0); connectNodes(tx.id, 0, co.id, 2);
  await executeNodeAsync(vi, 0); await executeNodeAsync(tx, 0); await executeNodeAsync(co, 0);
  return { mode: co.resultMode, blob: (co._compositedUrl || '').startsWith('blob:') };
});
check('compose 带字幕输入仍真实合成（字幕烧制路径 local·blob）', cmp2.mode === 'local' && cmp2.blob, JSON.stringify(cmp2));

// ③ compose 无任何输入 → 如实回退占位（demo）
const cmp3 = await page.evaluate(async () => {
  const co = addNode('compose', 460, 760);
  await executeNodeAsync(co, 0);
  return { mode: co.resultMode, noComposited: !co._compositedUrl };
});
check('compose 无输入如实回退占位（demo，不伪装合成产物）', cmp3.mode === 'demo' && cmp3.noComposited, JSON.stringify(cmp3));

// ④ publish 真实交付包（有上游视频）
const pub1 = await page.evaluate(async () => {
  const url = await window.__mkClip();
  const vi = addNode('videoInput', 100, 960); vi.uploadedVideo = url;
  const pu = addNode('publish', 460, 960);
  pu.params.title = '我的成片标题'; pu.params.description = '这是简介'; pu.params.tags = ['干货', '教程'];
  pu.params.platforms = [{ name: 'YouTube' }, { name: '抖音' }, { name: 'B站' }, { name: '小红书' }];
  connectNodes(vi.id, 0, pu.id, 0);
  await executeNodeAsync(vi, 0); await executeNodeAsync(pu, 0);
  const pk = pu.params.publishPack || {};
  const text = buildPublishPackText(pk);
  return {
    mode: pu.resultMode, status: pu.status, hasPack: !!pu.params.publishPack,
    title: pk.title === '我的成片标题', tags: Array.isArray(pk.tags) && pk.tags.length === 2,
    cover: typeof pk.cover === 'string' && pk.cover.startsWith('data:image'),
    allUrls: Array.isArray(pk.platforms) && pk.platforms.length === 4 && pk.platforms.every((p) => /^https:\/\//.test(p.uploadUrl || '')),
    ytOk: !!(pk.platforms && pk.platforms[0] && /youtube\.com/.test(pk.platforms[0].uploadUrl || '')),
    textHasEntry: text.indexOf('上传入口') >= 0 && /youtube\.com/.test(text) && text.indexOf('我的成片标题') >= 0,
  };
});
check('publish 真实交付包（标题/标签/封面抽帧/4 平台上传深链/文案含入口·local）',
  pub1.mode === 'local' && pub1.status === 'done' && pub1.hasPack && pub1.title && pub1.tags && pub1.cover && pub1.allUrls && pub1.ytOk && pub1.textHasEntry, JSON.stringify(pub1));

// ⑤ publish 无任何输入 → 如实回退占位（demo）
const pub2 = await page.evaluate(async () => {
  const pu = addNode('publish', 460, 1200);
  await executeNodeAsync(pu, 0);
  return { mode: pu.resultMode, noPack: !pu.params.publishPack };
});
check('publish 无输入如实回退占位（demo，不伪装已生成交付包）', pub2.mode === 'demo' && pub2.noPack, JSON.stringify(pub2));

// ⑥ registry 徽标：compose→local、publish→local；footage 仍 demo
const tiers = await page.evaluate(() => {
  const g = (t) => window.FlowCraft.nodes.getNodeMeta(t).tier;
  return { compose: g('compose'), publish: g('publish'), footage: g('footage') };
});
check('registry 徽标对齐（compose→local、publish→local；footage 仍如实 demo）',
  tiers.compose === 'local' && tiers.publish === 'local' && tiers.footage === 'demo', JSON.stringify(tiers));

// ⑦ 无 pageerror
check('全程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`\nverify-batch-c-compose-publish: ${checks.filter((c) => c.p).length}/${checks.length} 通过`);
await browser.close(); server.close();
process.exit(checks.every((c) => c.p) ? 0 : 1);
