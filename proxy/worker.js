// 阶段 4 — Cloudflare Worker 代理（生产目标，经 wrangler 部署）
// 浏览器不持有生产 Key；Key 仅存 Worker 环境变量（secrets）。
// 契约与 proxy/mock-server.mjs 一致，差异：① 真上游 fetch ② KV 持久化限流/额度/幂等 ③ 真实令牌校验
//
// wrangler.toml 需声明：
//   [vars]  PROXY_ALLOWED_ORIGINS = "https://your-domain.pages.dev"
//   [[kv_namespaces]] id = <KV_ID> binding = "KV"
// 密钥（secrets）：
//   OPENAI_KEY / DEEPSEEK_KEY / KLING_KEY / RUNWAY_KEY
//   JWKS / INVITE_SIGNING_KEY（用于校验短期用户令牌）

const UPSTREAM = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  kling: 'https://api.klingai.com/v1',
  runway: 'https://api.runwayml.com/v1',
};

const KEY_ENV = {
  openai: 'OPENAI_KEY', deepseek: 'DEEPSEEK_KEY', kling: 'KLING_KEY', runway: 'RUNWAY_KEY',
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

// 校验短期用户令牌（邀请制最简可用：HMAC 签名邀请码，可吊销）
// 真实实现应验 JWT/JWS + 查黑名单；此处给出骨架。
async function verifyToken(token, env) {
  if (!token) return false;
  // TODO: 用 env.INVITE_SIGNING_KEY 验签 + 查 env.KV 黑名单
  return true; // mock 放行，部署前补全
}

function rateLimitKey(token, provider) { return 'rl:' + token + ':' + provider; }
function quotaKey(token) { return 'quota:' + token; }
function idemKey(k) { return 'idem:' + k; }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/proxy') {
      return proxyError('not_found', 'param', false, '仅支持 POST /proxy', 404);
    }
    // CORS（仅允许站点来源）
    const origin = request.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': (env.PROXY_ALLOWED_ORIGINS || '').split(',').includes(origin) ? origin : '', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

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
