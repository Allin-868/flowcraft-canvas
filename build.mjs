// 阶段 0.5 — 构建脚本
// 输入：src/template.html + src/styles.css + src/core/legacy.js（verbatim 经典脚本）+ src/compat（esbuild 打包）
// 输出：index.html（单文件，内联 CSS/JS，行为等价于冻结 v3.2 单文件）
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const template = readFileSync(join(ROOT, 'src/template.html'), 'utf8');
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
const legacy = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

/**
 * 优先使用 package API；当 node_modules 中的原生二进制来自其他平台时，
 * 自动回退到同平台 CLI。也可用 ESBUILD_BINARY_PATH 显式指定可执行文件。
 */
async function bundleCompat() {
  let apiError;
  const nativePackage = join(ROOT, 'node_modules', '@esbuild', `${process.platform}-${process.arch}`, 'package.json');
  // node_modules 可能是从另一台机器复制来的；没有当前平台包时不要调用 API，
  // 否则 esbuild 会先向 stderr 打出冗长的 host-version mismatch 错误。
  if (existsSync(nativePackage)) {
    try {
      const { build } = await import('esbuild');
      const result = await build({
        entryPoints: [join(ROOT, 'src/compat/main.js')],
        bundle: true,
        format: 'iife',
        target: 'es2019',
        write: false,
        logLevel: 'silent',
      });
      return result.outputFiles[0].text;
    } catch (err) {
      apiError = err;
    }
  }

  const platformBinary = join(ROOT, 'node_modules', '@esbuild', `${process.platform}-${process.arch}`, 'bin', 'esbuild');
  const candidates = [
    process.env.ESBUILD_BINARY_PATH,
    platformBinary,
    ...(existsSync(nativePackage) ? [
      join(ROOT, 'node_modules', '.bin', 'esbuild'),
      join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    ] : []),
  ].filter(Boolean);
  const compatEntry = join(ROOT, 'src/compat/main.js');
  const tempDir = mkdtempSync(join(tmpdir(), 'flowcraft-esbuild-'));
  const tempOut = join(tempDir, 'compat.js');
  const cliErrors = [];
  try {
    for (const binary of candidates) {
      if (!existsSync(binary)) continue;
      const run = spawnSync(binary, [compatEntry, '--bundle', '--format=iife', '--target=es2019', '--outfile=' + tempOut, '--log-level=error'], {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      });
      if (run.status === 0 && existsSync(tempOut)) return readFileSync(tempOut, 'utf8');
      if (run.stderr) cliErrors.push(`${binary}: ${run.stderr.trim()}`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
  const detail = apiError && apiError.message ? ` API error: ${apiError.message}` : '';
  const cliDetail = cliErrors.length ? ` CLI error: ${cliErrors[cliErrors.length - 1]}` : '';
  throw new Error('无法找到当前平台可用的 esbuild。请安装当前平台依赖，或设置 ESBUILD_BINARY_PATH 指向同平台 CLI。' + detail + cliDetail);
}

const compat = await bundleCompat();
const out = template
  .replace('<!--BUILD_STYLE-->', () => css)
  .replace('<!--BUILD_APP-->', () => legacy)
  .replace('<!--BUILD_COMPAT-->', () => compat);

writeFileSync(join(ROOT, 'index.html'), out);
console.log('[build] index.html bytes =', out.length);
