// 阶段 4 — Cloudflare Worker 代理（生产目标，经 wrangler 部署）
// 浏览器不持有生产 Key；Key 仅存 Worker 环境变量（secrets）。
// 契约与 proxy/mock-server.mjs 一致，差异：① 真上游 fetch ② KV 持久化限流/额度/幂等 ③ 真实令牌校验
//
// wrangler.toml 需声明：
//   [vars]  PROXY_ALLOWED_ORIGINS = "https://your-domain.pages.dev"
//   [[kv_namespaces]] id = <KV_ID> binding = "KV"
// 密钥（secrets）：
//   OPENAI_KEY / DEEPSEEK_KEY / KLING_KEY / RUNWAY_KEY
//   INVITE_SIGNING_KEY（HMAC 校验短期用户邀请令牌，必须与 issue-token.mjs 所用密钥一致）
//   ADMIN_KEY（管理员吊销令牌用，POST /proxy/admin/revoke 的 X-Admin-Key）

const UPSTREAM = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  kling: 'https://api.klingai.com/v1',
  runway: 'https://api.runwayml.com/v1',
  // 阶段 9：多模型路由（配齐对应 Key 后启用；未配置 env 时前端路由选中这些 provider 会在代理侧 401/500 失败，分类为不可重试）
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://api.openai.com/v1',        // Gemini 兼容 OpenAI 格式中转时使用 OpenAI 基址；直连改为 https://generativelanguage.googleapis.com/v1beta
  xai: 'https://api.x.ai/v1',
};

const KEY_ENV = {
  openai: 'OPENAI_KEY', deepseek: 'DEEPSEEK_KEY', kling: 'KLING_KEY', runway: 'RUNWAY_KEY',
  anthropic: 'ANTHROPIC_KEY', google: 'GOOGLE_KEY', xai: 'XAI_KEY',
};

function maskKey(auth) {
  if (!auth) return '(none)';
  const m = /^(Bearer\s+)(sk-[A-Za-z0-9]{4})[A-Za-z0-9._-]*$/.exec(auth);
  return m ? m[1] + m[2] + '***' : auth.slice(0, 12) + '***';
}

function proxyError(code, kind, retryable, message, status) {
  return new Response(JSON.stringify({ error: { code, kind, retryable, message, status } }),
    { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

// ---- 邀请令牌：HMAC 签名 + 可吊销黑名单 ----
// 令牌格式： <payloadB64>.<sigB64>
//   payloadB64 = base64url( JSON{ sub, exp(秒), plan?, quota? } )
//   sigB64    = base64url( HMAC-SHA256( payloadB64, env.INVITE_SIGNING_KEY ) )
// 校验：① 签名正确 ② 未过期 ③ 不在 KV 黑名单 bl:<sub>
// 吊销：管理员经 POST /proxy/admin/revoke 写入 bl:<sub>（见下方 fetch 分支）。
// ⚠️ 与 proxy/issue-token.mjs 的签发算法必须保持一致（HMAC-SHA256 over payloadB64，base64url 无填充）。

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
async function hmacSign(messageUtf8, keyStr) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyStr),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(messageUtf8));
  return b64urlEncode(new Uint8Array(sig));
}
async function verifyToken(token, env) {
  if (!token) return false;
  const key = env && env.INVITE_SIGNING_KEY;
  if (!key) { console.error('[auth] INVITE_SIGNING_KEY 未配置，拒绝所有令牌'); return false; }
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  const expected = await hmacSign(payloadB64, key);
  if (!timingSafeEqual(b64urlDecode(expected), b64urlDecode(sigB64))) return false; // 签名不符
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))); }
  catch { return false; }
  if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string') return false;
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) return false; // 已过期
  try {
    const bl = env.KV && await env.KV.get('bl:' + payload.sub);
    if (bl) return false; // 已吊销
  } catch (_) { /* KV 不可用：签名已校验，放行 */ }
  return true;
}

function rateLimitKey(token, provider) { return 'rl:' + token + ':' + provider; }
function quotaKey(token) { return 'quota:' + token; }
function idemKey(k) { return 'idem:' + k; }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': (env.PROXY_ALLOWED_ORIGINS || '').split(',').includes(origin) ? origin : '', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key, X-Admin-Key', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // 视频异步任务结果轮询（taskId 不可猜测，1h 过期；结果仅含生成物 URL）
    const taskMatch = url.pathname.match(/^\/proxy\/task\/([\w-]+)$/);
    if (request.method === 'GET' && taskMatch) {
      const task = await env.KV.get('task:' + taskMatch[1], 'json').catch(() => null);
      if (!task) return proxyError('not_found', 'param', false, '任务不存在', 404);
      return new Response(JSON.stringify(task), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // 管理员吊销邀请令牌（写入 KV 黑名单 bl:<sub>）——需 X-Admin-Key
    if (request.method === 'POST' && url.pathname === '/proxy/admin/revoke') {
      const adminKey = request.headers.get('X-Admin-Key') || '';
      if (adminKey !== (env.ADMIN_KEY || '')) return proxyError('unauthorized', 'auth', false, '管理员密钥错误', 401);
      let body; try { body = await request.json(); } catch { return proxyError('invalid_param', 'param', false, '请求体非 JSON', 400); }
      const sub = body && body.sub;
      if (typeof sub !== 'string' || !sub) return proxyError('invalid_param', 'param', false, '缺少 sub', 400);
      const ttl = Number(body.ttl || 86400 * 30);
      await env.KV.put('bl:' + sub, String(Date.now()), { expirationTtl: ttl });
      return new Response(JSON.stringify({ ok: true, revoked: sub }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    if (request.method !== 'POST' || url.pathname !== '/proxy') {
      return proxyError('not_found', 'param', false, '仅支持 POST /proxy', 404);
    }

    let payload;
    try { payload = await request.json(); } catch { return proxyError('invalid_param', 'param', false, '请求体非 JSON', 400); }
    const auth = request.headers.get('Authorization') || '';
    const token = (auth.replace(/^Bearer\s+/i, '') || '').trim();

    // ① 令牌校验
    if (!(await verifyToken(token, env))) return proxyError('unauthorized', 'auth', false, '令牌无效或已吊销', 401);

    const provider = payload.provider || 'openai';
    const upstreamBase = UPSTREAM[provider];
    if (!upstreamBase) return proxyError('invalid_param', 'param', false, '未知 provider', 400);

    // ② 限流（KV 计数器，窗口 60s）
    const rlKey = rateLimitKey(token, provider);
    const rl = await env.KV.get(rlKey, 'json').catch(() => null) || { count: 0, start: Date.now() };
    if (Date.now() - rl.start > 60000) { rl.count = 0; rl.start = Date.now(); }
    const limit = Number(env.RATE_LIMIT_PER_MIN || 20);
    if (rl.count >= limit) return proxyError('rate_limited', 'transient', true, '请求过于频繁，请稍后重试', 429);
    rl.count++; await env.KV.put(rlKey, JSON.stringify(rl), { expirationTtl: 120 });

    // ③ 日额度（KV，按自然日）
    const day = new Date().toISOString().slice(0, 10);
    const qk = quotaKey(token) + ':' + day;
    const used = Number(await env.KV.get(qk).catch(() => 0) || 0);
    const cap = Number(env.DAILY_QUOTA_CNY || 2);
    const cost = provider === 'kling' || provider === 'runway' ? 0.5 : (provider === 'openai' && /image/i.test(payload.endpoint || '')) ? 0.04 : 0.01;
    if (used + cost > cap) return proxyError('quota_exceeded', 'quota', false, '今日额度已用完', 402);
    await env.KV.put(qk, String(used + cost), { expirationTtl: 86400 * 2 });

    // ⑦ 幂等键
    const idem = request.headers.get('X-Idempotency-Key');
    if (idem) {
      const cached = await env.KV.get(idemKey(idem), 'json').catch(() => null);
      if (cached) return new Response(JSON.stringify(Object.assign({}, cached, { _cached: true })), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // ⑤ 日志脱敏
    console.log(JSON.stringify({ auth: maskKey(auth), provider, endpoint: payload.endpoint, idem }));

    // ④ 视频异步任务：不阻塞，立即返回 taskId
    if ((provider === 'kling' || provider === 'runway') && /video/i.test(payload.endpoint || '')) {
      const taskId = 'task_' + crypto.randomUUID();
      await env.KV.put('task:' + taskId, JSON.stringify({ status: 'pending', result: null, createdAt: Date.now() }), { expirationTtl: 3600 });
      return new Response(JSON.stringify({ taskId, status: 'pending', poll: '/proxy/task/' + taskId }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // 转发上游（Key 仅在此注入，永不回前端）
    const upstreamResp = await fetch(upstreamBase + (payload.endpoint || ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env[KEY_ENV[provider]] },
      body: JSON.stringify(payload.body || {}),
    });
    if (!upstreamResp.ok) {
      const t = await upstreamResp.text();
      const status = upstreamResp.status;
      const kind = status === 400 ? 'param' : status === 401 || status === 403 ? 'auth' : status === 429 ? 'transient' : status >= 500 ? 'system' : 'system';
      return proxyError('upstream_error', kind, kind !== 'param' && kind !== 'auth', '上游错误 ' + status, status);
    }
    const out = await upstreamResp.json().catch(() => ({}));
    if (idem) await env.KV.put(idemKey(idem), JSON.stringify(out), { expirationTtl: 86400 * 7 });
    return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
  }
};

// 导出供 Node 单测直接调用（proxy/verify-token-scheme.mjs）
export { verifyToken, hmacSign, b64urlEncode, b64urlDecode, timingSafeEqual };
