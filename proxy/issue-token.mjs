#!/usr/bin/env node
// 邀请令牌签发工具（离线运行，不依赖 Worker）
// 算法必须与 proxy/worker.js 的 hmacSign/verifyToken 完全一致：
//   令牌 = base64url(JSON{ sub, exp(秒), plan?, quota? }) + '.' + base64url(HMAC-SHA256(payloadB64, INVITE_SIGNING_KEY))
//
// 用法：
//   node issue-token.mjs --sub <邀请ID> --days <天数> [--quota <元/日>] [--plan invite-quota] \
//                        [--key <INVITE_SIGNING_KEY>] [--out token.txt]
// 密钥也可通过环境变量传入： INVITE_SIGNING_KEY=xxx node issue-token.mjs --sub alice
//
// 签发的令牌交给用户，用户在前端「设置 → 代理令牌」粘贴即可（或注入 window.__FC_PROXY_TOKEN__）。

import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

function main() {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

  const sub = get('--sub');
  if (!sub) { console.error('缺少 --sub（邀请标识，如邮箱前缀/用户名）'); process.exit(2); }
  const days = Number(get('--days', '30'));
  const quota = Number(get('--quota', '2'));
  const plan = get('--plan', 'invite-quota');
  const key = get('--key') || process.env.INVITE_SIGNING_KEY;
  if (!key) { console.error('缺少签名密钥：传 --key <KEY> 或设置环境变量 INVITE_SIGNING_KEY'); process.exit(2); }

  const payload = { sub, exp: Math.floor(Date.now() / 1000) + days * 86400, plan, quota };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sigB64 = createHmac('sha256', key).update(payloadB64, 'utf8').digest('base64url');
  const token = payloadB64 + '.' + sigB64;

  const out = get('--out');
  if (out) { writeFileSync(out, token); console.log('已写入 ' + out + '（sub=' + sub + ', 有效期=' + days + '天）'); }
  else console.log(token);
}

main();
