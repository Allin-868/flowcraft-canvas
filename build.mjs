// 阶段 0.5 — 构建脚本
// 输入：src/template.html + src/styles.css + src/core/legacy.js（verbatim 经典脚本）+ src/compat（esbuild 打包）
// 输出：index.html（单文件，内联 CSS/JS，行为等价于冻结 v3.2 单文件）
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const template = readFileSync(join(ROOT, 'src/template.html'), 'utf8');
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
const legacy = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

// 把兼容层（ES 模块）打包成 IIFE 经典脚本，注入为第二个 <script>
const result = await build({
  entryPoints: [join(ROOT, 'src/compat/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2019',
  write: false,
  logLevel: 'silent',
});
const compat = result.outputFiles[0].text;

const out = template
  .replace('<!--BUILD_STYLE-->', () => css)
  .replace('<!--BUILD_APP-->', () => legacy)
  .replace('<!--BUILD_COMPAT-->', () => compat);

writeFileSync(join(ROOT, 'index.html'), out);
console.log('[build] index.html bytes =', out.length);
