#!/usr/bin/env node
/** 验证当前部署源码、单文件构建产物与 JavaScript 语法，不调用外部 AI。 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const required = [
  'src/template.html', 'src/styles.css', 'src/core/legacy.js', 'src/compat/main.js', 'index.html', 'build.mjs', 'package.json',
];
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  ✅ ${name}${detail ? ` (${detail})` : ''}`);
  else { failed++; console.log(`  ❌ ${name}${detail ? ` (${detail})` : ''}`); }
}

console.log('[build] checking current deploy tree');
for (const file of required) check(`存在 ${file}`, existsSync(join(ROOT, file)));
const output = join(ROOT, 'index.html');
let html = '';
try { html = readFileSync(output, 'utf8'); } catch {}
check('index.html 可读', html.length > 0, `${html.length} bytes`);
check('没有未替换构建标记', !/<!--BUILD_(STYLE|APP|COMPAT)-->/u.test(html));
check('包含 FlowCraft 版本标记', /3\.11-comfyui|FlowCraft\.version/u.test(html));
check('包含代理客户端契约', /FlowCraft\.proxy|ProxyClient/u.test(html));
check('不包含完整 OpenAI 风格 Key', !/(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/u.test(html));

const freshBuild = spawnSync(process.execPath, [join(ROOT, 'build.mjs'), '--check'], { encoding: 'utf8' });
if (freshBuild.stdout) process.stdout.write(freshBuild.stdout);
if (freshBuild.stderr) process.stderr.write(freshBuild.stderr);
check('index.html 与当前 src 源码一致', freshBuild.status === 0);
for (const file of ['src/core/legacy.js', 'src/compat/main.js', 'build.mjs']) {
  const result = spawnSync(process.execPath, ['--check', join(ROOT, file)], { encoding: 'utf8' });
  check(`Node 语法 ${file}`, result.status === 0, result.status === 0 ? '' : (result.stderr || '').trim().split('\n')[0]);
}
const security = spawnSync(process.execPath, [join(ROOT, 'test/verify-security.mjs'), '--production'], { encoding: 'utf8' });
if (security.stdout) process.stdout.write(security.stdout);
if (security.stderr) process.stderr.write(security.stderr);
check('生产范围安全扫描', security.status === 0);
if (failed) process.exit(1);
console.log('[build] PASS');
