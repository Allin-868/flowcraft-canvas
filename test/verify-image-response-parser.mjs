#!/usr/bin/env node
/**
 * image2 返回解析回归：不访问网络、不启动浏览器，只验证多种中转响应格式。
 * 通过读取源码中的三个纯函数执行，避免为测试暴露生产内部 API。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(`${ROOT}/src/core/legacy.js`, 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`找不到函数：${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`函数未闭合：${name}`);
}

const sandbox = {};
vm.runInNewContext([
  extractFunction('normalizeImageSrc'),
  extractFunction('responseImageSrc'),
  extractFunction('extractResponseImages'),
  'globalThis.parseImages = extractResponseImages;'
].join('\n'), sandbox, { filename: 'legacy-image-parser.js' });

const parseImages = sandbox.parseImages;
const b64A = 'A'.repeat(48);
const b64B = 'B'.repeat(48);
const dataA = `data:image/png;base64,${b64A}`;
const dataB = `data:image/png;base64,${b64B}`;
const checks = [];
const check = (name, pass, detail = '') => {
  checks.push(pass);
  console.log(`${pass ? '  ✅' : '  ❌'} ${name}${detail ? `：${detail}` : ''}`);
};

check('{data:[{b64_json}]} 可解析', parseImages({ data: [{ b64_json: b64A }] })[0] === dataA);
check('{data:[{url}]} 可解析', parseImages({ data: [{ url: 'https://img.example/a.png' }] })[0] === 'https://img.example/a.png');
check('{output:[{image:{url}}]} 可解析', parseImages({ output: [{ image: { url: 'https://img.example/b.png' } }] })[0] === 'https://img.example/b.png');
check('{result:"data:image/..."} 可解析', parseImages({ result: dataA })[0] === dataA);
check('{image_url:"data:image/..."} 可解析', parseImages({ image_url: dataB })[0] === dataB);
check('直接 base64 字符串可解析', parseImages(b64A)[0] === dataA);

const empty = parseImages({
  data: [{ b64_json: '' }, { url: '' }, { url: 'data:image/png;base64,' }],
  result: 'data:image/png;base64,',
  image_url: 'not-an-image'
});
check('空字段和空 data URL 不会被当成图片', empty.length === 0, JSON.stringify(empty));

const ordered = parseImages({
  data: [{ url: 'https://img.example/a.png' }, { b64_json: b64A }],
  output: [{ image: { url: 'https://img.example/a.png' } }, { image: { b64_json: b64B } }]
});
check('多张图片去重并保持顺序',
  ordered.length === 3 && ordered[0] === 'https://img.example/a.png' && ordered[1] === dataA && ordered[2] === dataB,
  JSON.stringify(ordered));

const failed = checks.filter((pass) => !pass).length;
console.log(`\n==== image2 返回解析：PASS=${checks.length - failed} FAIL=${failed} ====`);
process.exit(failed ? 1 : 0);
