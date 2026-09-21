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
const legacyRaw = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

// —— 版本单一真源：package.json 的 version 字段。——
// build.mjs 把它注入产物三处，今后改版本只需改 package.json，三处自动同步、不再各自漂移：
//   1) legacy.js 的 `const APP_VERSION = '…'`（驱动状态栏 #statVersion 显示，verbatim 内联，用正则替换）
//   2) template.html 的静态 `<span id="statVersion">v…</span>`（JS 执行前的占位，避免闪现旧值）
//   3) compat 打包产物的 `window.FlowCraft.version`（经 esbuild define 注入 __FLOWCRAFT_VERSION__，写入导出元数据 appVersion）
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
if (!VERSION || typeof VERSION !== 'string') {
  console.error('[build] 无法从 package.json 读取 version 字段，版本注入中止。');
  process.exit(1);
}

// 注入点 1：legacy.js 的 APP_VERSION 字面量（用函数式替换避免版本串中的 $ 被当作反向引用）。
let legacyHit = false;
const legacy = legacyRaw.replace(
  /const APP_VERSION = '[^']*';/,
  () => { legacyHit = true; return `const APP_VERSION = ${JSON.stringify(VERSION)};`; },
);
if (!legacyHit) {
  console.error('[build] 未能在 legacy.js 中定位 `const APP_VERSION = …;`，版本注入失败（请检查源码是否改了写法）。');
  process.exit(1);
}

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
        // 注入点 3：把 package.json 版本作为编译期常量替换 __FLOWCRAFT_VERSION__。
        define: { __FLOWCRAFT_VERSION__: JSON.stringify(VERSION) },
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
      const run = spawnSync(binary, [compatEntry, '--bundle', '--format=iife', '--target=es2019', '--outfile=' + tempOut, '--log-level=error', '--define:__FLOWCRAFT_VERSION__=' + JSON.stringify(VERSION)], {
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

// 打包依赖的许可证注释偶尔带行尾空格；清理后保证提交可通过 git diff --check。
const compat = (await bundleCompat()).replace(/[\t ]+(?=\r?\n)/g, '');

// 注入点 2：template.html 的静态 #statVersion 占位（JS 执行前显示，避免闪现旧版本号）。
let spanHit = false;
const templateWithVersion = template.replace(
  /(id="statVersion">)[^<]*(<)/,
  (_m, open, close) => { spanHit = true; return `${open}v${VERSION}${close}`; },
);
if (!spanHit) {
  console.error('[build] 未能在 template.html 中定位 id="statVersion" 占位，版本注入失败。');
  process.exit(1);
}

const out = templateWithVersion
  .replace('<!--BUILD_STYLE-->', () => css)
  .replace('<!--BUILD_APP-->', () => legacy)
  .replace('<!--BUILD_COMPAT-->', () => compat);

const outputPath = join(ROOT, 'index.html');
if (process.argv.includes('--check')) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (current !== out) {
    console.error('[build] index.html 与当前 src 源码不一致。请先运行 node build.mjs。');
    process.exitCode = 1;
  } else {
    console.log('[build] index.html 与当前 src 源码一致，bytes =', out.length);
  }
} else {
  writeFileSync(outputPath, out);
  console.log('[build] index.html bytes =', out.length);
}
