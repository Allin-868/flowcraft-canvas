#!/usr/bin/env node
/** 发布前凭据扫描：默认扫描部署仓库，绝不输出匹配原文。 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const productionOnly = process.argv.includes('--production');
const patterns = [
  ['openai_style', /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/g],
  ['github_token', /(?<![A-Za-z0-9])(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g],
  ['github_pat', /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g],
  ['google_api_key', /(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{30,}/g],
  ['aws_access_key', /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}/g],
  ['bearer_literal', /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi],
  ['generic_secret_assignment', /(?:api[_ -]?key|secret[_ -]?key|access[_ -]?token|password)\s*[:=]\s*["'][^"'\n]{16,}["']/gi],
];
const ignoredDirs = new Set(['.git', 'node_modules', 'test-results']);
const productionRoots = [join(ROOT, 'src'), join(ROOT, 'index.html')];
const placeholderWords = /(?:test|example|dummy|placeholder|your[_ -]?key|replace|changeme|not[_ -]?secret|fake|demo|sample|xxx|undefined|null)/i;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else files.push(file);
  }
  return files;
}

function isProduction(file) {
  return productionRoots.some((root) => statSync(root).isDirectory() ? file.startsWith(`${root}/`) : file === root);
}

function fixtureLike(file, context, raw) {
  return /test\/|mock|fixture|fake key|测试|示例/i.test(`${relative(ROOT, file)} ${context} ${raw}`) || placeholderWords.test(raw);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

const findings = [];
for (const file of walk(ROOT)) {
  let text;
  try { text = readFileSync(file); } catch { continue; }
  if (text.subarray(0, 8192).includes(0)) continue;
  const lines = text.toString('utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const context = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join(' ');
    for (const [name, regex] of patterns) {
      regex.lastIndex = 0;
      for (const match of line.matchAll(regex)) {
        const raw = match[0];
        findings.push({
          file: relative(ROOT, file).replaceAll('\\', '/'),
          line: index + 1,
          name,
          fixture: fixtureLike(file, context, raw),
          production: isProduction(file),
          digest: digest(raw),
        });
      }
    }
  });
}

const actionable = findings.filter((item) => !item.fixture && (!productionOnly || item.production));
console.log(`[security] scope=${productionOnly ? 'production' : 'deploy'} matches=${findings.length} actionable=${actionable.length}`);
for (const item of findings) console.log(`  ${item.fixture ? 'WARN' : 'FAIL'} ${item.file}:${item.line} ${item.name} sha256=${item.digest}${item.production ? ' production' : ''}`);
if (!findings.length) console.log('  PASS no high-confidence credential pattern found');
if (actionable.length) {
  console.error('[security] FAIL: inspect findings without copying credential values.');
  process.exit(1);
}
console.log('[security] PASS');
