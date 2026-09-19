#!/usr/bin/env node
/**
 * 部署仓库自包含的浏览器回归入口。
 * 仅运行不依赖真实 AI 凭据的本地 smoke test，结果写到被 Git 忽略的 test-results/。
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TEST_DIR = join(ROOT, 'test');
const RESULTS_DIR = join(ROOT, 'test-results');
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const candidates = requested.length ? requested : [
  'verify-stage3.cjs', 'verify-model-router.cjs', 'verify-project-panel.cjs', 'verify-undo-redo.cjs', 'verify-comfyui-full.cjs',
  'verify-node-semantics.mjs', 'verify-ratio-fit.mjs', 'verify-image-ctxmenu.mjs',
  'verify-image-node-look.mjs', 'verify-aiimage-fit-lightbox.mjs', 'verify-prompt-expand.mjs',
  'verify-aivideo-spec-size.mjs', 'verify-text-header-above.mjs', 'verify-node-tools.mjs',
  'verify-ref-image-manage.mjs', 'verify-image-crop-rotate.mjs', 'verify-gen-feedback.mjs',
  'verify-error-recovery.mjs', 'verify-pipeline-ui.mjs', 'verify-run-mechanism.mjs',
  'verify-image-response-parser.mjs',
  'verify-refresh-recovery.cjs',
  'verify-director-data.mjs', 'verify-story-beats.mjs', 'verify-director-linkage.mjs', 'verify-director-quality.mjs', 'verify-director-first-success.mjs', 'verify-director-path-hint.mjs', 'verify-storage-faults.mjs',
  'verify-global-assets.mjs',
  'verify-global-assets-large.mjs',
  'verify-design-agent.mjs',
  // 2026-09-17 接线：以下此前散落在 test/ 或仓库外 脚本/，从未进闸门
  'verify-asset-model.mjs', 'verify-asset-reference-governance.mjs',
  'verify-lineart-local.mjs', 'verify-save-genmeta.mjs',
  'verify-provider-models.mjs',
  'verify-edge-delete.mjs', 'verify-tool-confirm.mjs', 'verify-agent-drawer.mjs',
  'verify-provenance-cancel.mjs', 'verify-data-boundaries.mjs', 'verify-responsive.mjs',
  'verify-sidebar-icons.mjs', 'verify-image-quality.mjs', 'verify-zoom-reset.mjs',
  'verify-reverse-prompt-structured.mjs', 'verify-error-calibration.mjs',
  'verify-comfy-panel.mjs', 'verify-comfy-expand.mjs', 'verify-comfy-editor-cn.mjs',
  'verify-node-blank.mjs', 'verify-hud-size.mjs', 'verify-toolbar-redesign.mjs',
  'verify-panel-shadow.mjs', 'verify-preset-collapse.mjs', 'verify-composer-avoid.mjs',
  'verify-upscale-local.mjs',
  // 2026-09-18 修好并入：资产异步写入需 await / 素材库页签 async 处理器需等待切换完成 /
  // aiImage 已统一真实生成 → 用 page.route 打桩出图接口验真链路
  'verify-asset-dedup.mjs', 'verify-char-flow.mjs', 'verify-genmeta-retry.mjs',
  // 2026-09-18 换承载节点后并入：信息条只对 aiImage/comfyui/imageEdit 渲染（legacy.js:10875），
  // 原先挂在 upscale 上属用例过期；大图/右键断言仍留在高清节点
  'verify-ctxmenu-lightbox.mjs', 'verify-genmeta-bottom.mjs',
  // 2026-09-18 转真实交互后并入：该脚本此前卡在一次超时上，后半段 19 条断言从未执行；
  // 转真后顺带查出 2 处产品缺陷（见 DEBT.md「本轮查出的产品缺陷」），现 34/34
  'verify-stage4-character-assets.mjs',
  // 2026-09-18 新增闸门：可点性体检。它钉住的是同一类盲区——控件在 DOM 里、函数能跑通，但
  // 用户鼠标点不到（样式隐藏/被遮罩盖住/坐标落在视口外）。三处产品缺陷都源于只用 querySelector
  // 存在性 + 程序内 click 做断言，故把判据（window.__reach）固化成常规闸门，见 DEBT.md。
  'verify-ui-affordance.mjs',
  // 2026-09-19 修好并入：原判「用例过期、与性能决策冲突」实为产品把拖动中反馈弄丢了（见 DEBT.md 第 4 处）；
  // 恢复检测进 rAF 帧后，用例改成真实鼠标拖拽 + computed style 判高亮，18/18
  'verify-auto-connect.mjs',
  // 2026-09-19 最后一条 A 类欠债结案（7 条失败全在测试侧，0 处产品缺陷）：改成真实鼠标动作 +
  // 渲染几何相对判据 + route 打桩出图，33/33；比例/分辨率浮层入口此前全仓库 0 覆盖，现由它钉住
  'verify-composer.mjs',
  // 2026-09-19 第 5 处产品缺陷（用户真机报告）：开箱模板面板没有点外部/Esc 关闭路径，契约缺口
  'verify-template-panel-close.mjs',
  // 2026-09-19 第 6 处产品缺陷（用户真机报告）：场景分组面板点画布不关；补点外部/Esc 关，
  // 但点节点不关——「选节点→加入选中」主流程必须保住
  'verify-scene-panel-close.mjs',
  'verify-scene-dialogs.mjs',
  'verify-batch-a-nodes.mjs',
  'verify-batch-b-audio.mjs',
  // 已知欠债（失败未修，暂不入闸门，判定与证据见同目录 DEBT.md）：
  // verify-composer, verify-auto-connect,
  // verify-real-links（需真实 Key）, verify-perf-baseline（性能基线单独跑）,
  // reel-char-trial（物料生成，非断言闸门）
];
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const resultLines = [
  `# 回归测试记录（${localDate}）`,
  '',
  `- Node：${process.execPath} ${process.version}`,
  `- 仓库：${ROOT}`,
  '- 运行范围：本地构建产物与 mock/浏览器 smoke test；不调用真实 AI 服务。',
  '',
];
let failed = 0;
let blocked = 0;

function isEnvironmentBlocked(result, output) {
  return [
    /code:\s*['"]EPERM['"][\s\S]{0,240}syscall:\s*['"]listen['"]/i,
    /syscall:\s*['"]listen['"][\s\S]{0,240}code:\s*['"]EPERM['"]/i,
    /bootstrap_check_in[\s\S]{0,160}Permission denied/i,
    /exception while trying to kill process:\s*Error:\s*kill EPERM/i,
    /browserType\.launch:[\s\S]{0,180}(Target page, context or browser has been closed|Permission denied)/i,
  ].some((pattern) => pattern.test(output));
}

function writeLog() {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, `regression-${localDate}.md`), resultLines.join('\n'), 'utf8');
}

try {
  createRequire(import.meta.url).resolve('playwright');
} catch {
  console.error('[regression] 未找到 Playwright。请先运行 npm ci，然后执行 npx playwright install chromium。');
  resultLines.push('- ⏸️ 总回归：环境阻塞（未找到 Playwright）', '', '- 汇总：0 通过，0 失败，1 环境阻塞。', '');
  writeLog();
  process.exit(2);
}

for (const name of candidates) {
  const file = join(TEST_DIR, name);
  if (!existsSync(file)) {
    failed++;
    resultLines.push(`- ❌ ${name}：文件不存在`);
    continue;
  }
  console.log(`[regression] ${name}`);
  const result = spawnSync(process.execPath, [file], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  const tail = output.split(/\r?\n/).slice(-8).join(' | ');
  const ok = result.status === 0;
  const environmentBlocked = !ok && isEnvironmentBlocked(result, output);
  if (!ok && !environmentBlocked) failed++;
  if (environmentBlocked) blocked++;
  console.log(ok ? `  ✅ ${name}` : environmentBlocked ? `  ⏸️ ${name} 环境阻塞` : `  ❌ ${name} exit=${result.status}`);
  if (!ok && tail) console.log(`  ${tail}`);
  resultLines.push(`- ${ok ? '✅' : environmentBlocked ? '⏸️' : '❌'} ${name}${ok ? '' : environmentBlocked ? '（环境阻塞）' : `（exit=${result.status}）`}`);
  if (!ok && tail) resultLines.push(`  - 摘要：${tail.slice(0, 500)}`);
}

resultLines.push('', `- 汇总：${candidates.length - failed - blocked} 通过，${failed} 失败，${blocked} 环境阻塞。`, '');
writeLog();
console.log(`[regression] log=${join(RESULTS_DIR, `regression-${localDate}.md`)}`);
if (failed) process.exit(1);
if (blocked) process.exit(2);
console.log('[regression] PASS');
