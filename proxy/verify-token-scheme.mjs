#!/usr/bin/env node
// 邀请令牌方案验证（Node 单测）
// 直接 import proxy/worker.js 的 verifyToken / hmacSign，并用真实 issue-token.mjs 签发，
// 覆盖：跨模块一致 / 篡改签名 / 过期 / KV 黑名单 / 缺签名密钥 / 格式错误。
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyToken } from './worker.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const KEY = 'test-signing-key-123';
const results = [];
function ok(name, cond, extra) { results.push([cond, name, extra]); }

function fakeKV(initial = {}) {
  const store = { ...initial };
  return { get: async (k) => (k in store ? store[k] : null), put: async (k, v) => { store[k] = v; } };
}
function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

const env = { INVITE_SIGNING_KEY: KEY, KV: fakeKV() };

// 1) 跨模块一致：issue-token.mjs 签发的令牌能被 worker.verifyToken 通过
const issued = execSync(`node ${join(__dir, 'issue-token.mjs')} --sub alice --days 1 --key ${KEY}`, { encoding: 'utf8' }).trim();
ok('① issue-token 签发 → worker 验签通过', await verifyToken(issued, env) === true, issued.slice(0, 24) + '…');

// 2) 篡改签名 → 拒绝
const tampered = issued.slice(0, -2) + (issued.slice(-1) === 'a' ? 'b' : 'a');
ok('② 篡改签名 → 拒绝', await verifyToken(tampered, env) === false);

// 3) 过期令牌 → 拒绝
const expPayload = b64url(Buffer.from(JSON.stringify({ sub: 'bob', exp: Math.floor(Date.now() / 1000) - 10, plan: 'invite-quota', quota: 2 }), 'utf8'));
const expSig = createHmac('sha256', KEY).update(expPayload, 'utf8').digest('base64url');
ok('③ 已过期 → 拒绝', await verifyToken(expPayload + '.' + expSig, env) === false);

// 4) KV 黑名单 → 拒绝
const envBL = { INVITE_SIGNING_KEY: KEY, KV: fakeKV({ 'bl:alice': '1' }) };
ok('④ 黑名单 bl:alice → 拒绝', await verifyToken(issued, envBL) === false);

// 5) 缺签名密钥 → 拒绝（配置错误保护）
ok('⑤ 缺 INVITE_SIGNING_KEY → 拒绝', await verifyToken(issued, { KV: fakeKV() }) === false);

// 6) 格式错误 → 拒绝
ok('⑥ 格式错误（无点） → 拒绝', await verifyToken('not-a-token', env) === false);
ok('⑦ 空令牌 → 拒绝', await verifyToken('', env) === false);

// 8) 跨密钥 → 拒绝（用另一把密钥签发）
const other = execSync(`node ${join(__dir, 'issue-token.mjs')} --sub alice --days 1 --key WRONG-KEY`, { encoding: 'utf8' }).trim();
ok('⑧ 异密钥签发 → 拒绝', await verifyToken(other, env) === false);

let pass = 0;
for (const [c, n, e] of results) { console.log((c ? '  ✅' : '  ❌') + ' ' + n + (e ? '  [' + e + ']' : '')); if (c) pass++; }
console.log(`\n结果：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
