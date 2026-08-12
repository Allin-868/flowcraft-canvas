// 阶段 0.5 — 一次性基线抽取：把冻结的单文件 v3.2 拆成 src/ 模块化源
// 输入：dev 单文件 HTML（源基线，505KB）
// 输出：src/styles.css、src/core/legacy.js（verbatim 经典脚本）、src/template.html（含构建占位符）
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname; // deploy 仓库根
const DEV = 'C:/Users/Administrator/WorkBuddy/2026-08-06-00-58-46/flowcraft-v2.html';

const html = readFileSync(DEV, 'utf8');
const styleOpen = html.indexOf('<style>');
const styleClose = html.indexOf('</style>');
const scriptOpen = html.indexOf('<script>');
const scriptClose = html.indexOf('</script>');

if (styleOpen < 0 || styleClose < 0 || scriptOpen < 0 || scriptClose < 0) {
  throw new Error('未能定位 <style>/<script> 标签');
}

const head = html.slice(0, styleOpen);
const css = html.slice(styleOpen + '<style>'.length, styleClose);
const body = html.slice(styleClose + '</style>'.length, scriptOpen);
const js = html.slice(scriptOpen + '<script>'.length, scriptClose);
const tail = html.slice(scriptClose + '</script>'.length);

// template：保留原结构，仅把 CSS/JS 替换为构建占位符，并追加一个兼容层脚本占位符
const template =
  head +
  '<style>\n<!--BUILD_STYLE-->\n</style>\n' +
  body +
  '\n<script>\n<!--BUILD_APP-->\n</script>\n' +
  '<script>\n<!--BUILD_COMPAT-->\n</script>\n' +
  tail;

const dirs = [
  'src/core', 'src/storage', 'src/execution', 'src/nodes',
  'src/providers', 'src/panels', 'src/compat',
];
for (const d of dirs) mkdirSync(join(ROOT, d), { recursive: true });

writeFileSync(join(ROOT, 'src/styles.css'), css);
writeFileSync(join(ROOT, 'src/core/legacy.js'), js);
writeFileSync(join(ROOT, 'src/template.html'), template);

console.log('[extract] css bytes =', css.length);
console.log('[extract] js  bytes =', js.length);
console.log('[extract] template bytes =', template.length);
console.log('[extract] head tail preserved:', head.length > 0 && tail.length > 0);
