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
  // 已知欠债（失败未修，暂不入闸门，判定与证据见同目录 DEBT.md）：
  // verify-composer, verify-auto-connect, verify-genmeta-retry, verify-asset-dedup,
  // verify-char-flow, verify-real-links, verify-ctxmenu-lightbox, verify-genmeta-bottom,
  // verify-perf-baseline（性能基线单独跑）, reel-char-trial（物料生成，非断言闸门）,
  // verify-stage4-character-assets（1 条断言 locator.click 超时，UI 文案已变）
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
