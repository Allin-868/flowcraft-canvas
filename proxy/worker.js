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
//
// —— 个人自用模式（零 KV、零签发）——
// 只需配置 3 个变量即可跑通（适合单人使用）：
//   [vars]  PROXY_ALLOWED_ORIGINS = "*"
//   [vars]  PERSONAL_ACCESS_TOKEN = "任意你自己的口令"
//   secrets OPENAI_UPSTREAM_BASE 与 OPENAI_KEY 也可放 [vars]（见下方上游覆盖说明）
// 原理：PERSONAL_ACCESS_TOKEN 命中时跳过 HMAC 令牌校验；未绑定 KV 时自动跳过限流/额度/幂等。

// 上游基址：默认官方地址，可用环境变量覆盖（如中转站 momoai.asia）：
//   OPENAI_UPSTREAM_BASE / DEEPSEEK_UPSTREAM_BASE / KLING_UPSTREAM_BASE / RUNWAY_UPSTREAM_BASE
//   ANTHROPIC_UPSTREAM_BASE / GOOGLE_UPSTREAM_BASE / XAI_UPSTREAM_BASE / RELAY_UPSTREAM_BASE
// 优先级：env.UPSTREAM_BASE（所有 provider 全局覆盖，自用场景最简） > {PROVIDER}_UPSTREAM_BASE > 默认官方地址。
// relay：自定义中转直通 provider——基址取 RELAY_UPSTREAM_BASE，Key 取 RELAY_KEY，
// 请求体原样转发，适合转发到不支持浏览器 CORS 的中转站（服务器间转发不受 CORS 限制）。
const UPSTREAM_DEFAULTS = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  kling: 'https://api.klingai.com/v1',
  runway: 'https://api.runwayml.com/v1',
  // 阶段 9：多模型路由（配齐对应 Key 后启用；未配置 env 时前端路由选中这些 provider 会在代理侧 401/500 失败，分类为不可重试）
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://api.openai.com/v1',        // Gemini 兼容 OpenAI 格式中转时使用 OpenAI 基址；直连改为 https://generativelanguage.googleapis.com/v1beta
  xai: 'https://api.x.ai/v1',
  relay: '',
};
function upstreamBase(provider, env) {
  const fromEnv = (env && (env.UPSTREAM_BASE || env[provider.toUpperCase() + '_UPSTREAM_BASE'])) || '';
  return String(fromEnv || UPSTREAM_DEFAULTS[provider] || '');
}

const KEY_ENV = {
  openai: 'OPENAI_KEY', deepseek: 'DEEPSEEK_KEY', kling: 'KLING_KEY', runway: 'RUNWAY_KEY',
  anthropic: 'ANTHROPIC_KEY', google: 'GOOGLE_KEY', xai: 'XAI_KEY', relay: 'RELAY_KEY',
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
  // 个人自用模式：固定口令直通（无 HMAC/黑名单，仅限单人场景；不要与生产 HMAC 模式混用）
  const pat = env && env.PERSONAL_ACCESS_TOKEN;
  if (pat) {
    if (typeof pat === 'string' && timingSafeEqual(new TextEncoder().encode(pat), new TextEncoder().encode(token))) return true;
    // 配置了口令但未命中 → 若同时配置了 INVITE_SIGNING_KEY 则继续走 HMAC 校验，否则拒绝
    if (!(env && env.INVITE_SIGNING_KEY)) return false;
  }
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

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !/^data:/i.test(dataUrl)) return null;
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  const mime = (/data:(.*?);base64/i.exec(parts[0]) || [])[1] || 'image/png';
  const bin = atob(parts[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    // PROXY_ALLOWED_ORIGINS 逗号分隔白名单；配置为 "*" 时放行所有来源（本地/个人自用；公开部署请用白名单）
    const allowList = String(env.PROXY_ALLOWED_ORIGINS || '').trim();
    const allowAll = allowList === '*';
    const cors = { 'Access-Control-Allow-Origin': allowAll ? '*' : (allowList.split(',').includes(origin) ? origin : ''), 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key, X-Admin-Key', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // 视频异步任务结果轮询（taskId 不可猜测，1h 过期；结果仅含生成物 URL）
    const taskMatch = url.pathname.match(/^\/proxy\/task\/([\w-]+)$/);
    if (request.method === 'GET' && taskMatch) {
      if (!env.KV) return proxyError('not_found', 'param', false, '未绑定 KV，不支持异步任务', 404);
      const task = await env.KV.get('task:' + taskMatch[1], 'json').catch(() => null);
      if (!task) return proxyError('not_found', 'param', false, '任务不存在', 404);
      return new Response(JSON.stringify(task), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // 管理员吊销邀请令牌（写入 KV 黑名单 bl:<sub>）——需 X-Admin-Key
    if (request.method === 'POST' && url.pathname === '/proxy/admin/revoke') {
      if (!env.KV) return proxyError('not_found', 'param', false, '未绑定 KV，不支持令牌吊销', 404);
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
    const base = upstreamBase(provider, env);
    if (base === undefined) return proxyError('invalid_param', 'param', false, '未知 provider', 400);
    if (!base) return proxyError('invalid_param', 'param', false, 'provider「' + provider + '」未配置上游地址（env.' + (provider.toUpperCase() + '_UPSTREAM_BASE') + '）', 400);

    // ② 限流（KV 计数器，窗口 60s；未绑定 KV 时跳过——个人模式）
    if (env.KV) {
      const rlKey = rateLimitKey(token, provider);
      const rl = await env.KV.get(rlKey, 'json').catch(() => null) || { count: 0, start: Date.now() };
      if (Date.now() - rl.start > 60000) { rl.count = 0; rl.start = Date.now(); }
      const limit = Number(env.RATE_LIMIT_PER_MIN || 20);
      if (rl.count >= limit) return proxyError('rate_limited', 'transient', true, '请求过于频繁，请稍后重试', 429);
      rl.count++; await env.KV.put(rlKey, JSON.stringify(rl), { expirationTtl: 120 });
    }

    // ③ 日额度（KV，按自然日；未绑定 KV 时跳过——个人模式）
    if (env.KV) {
      const day = new Date().toISOString().slice(0, 10);
      const qk = quotaKey(token) + ':' + day;
      const used = Number(await env.KV.get(qk).catch(() => 0) || 0);
      const cap = Number(env.DAILY_QUOTA_CNY || 2);
      const cost = provider === 'kling' || provider === 'runway' ? 0.5 : (provider === 'openai' && /image/i.test(payload.endpoint || '')) ? 0.04 : 0.01;
      if (used + cost > cap) return proxyError('quota_exceeded', 'quota', false, '今日额度已用完', 402);
      await env.KV.put(qk, String(used + cost), { expirationTtl: 86400 * 2 });
    }

    // ⑦ 幂等键
    const idem = request.headers.get('X-Idempotency-Key');
    if (idem && env.KV) {
      const cached = await env.KV.get(idemKey(idem), 'json').catch(() => null);
      if (cached) return new Response(JSON.stringify(Object.assign({}, cached, { _cached: true })), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // ⑤ 日志脱敏
    console.log(JSON.stringify({ auth: maskKey(auth), provider, endpoint: payload.endpoint, idem }));

    // ④ 视频异步任务：不阻塞，立即返回 taskId
    if ((provider === 'kling' || provider === 'runway') && /video/i.test(payload.endpoint || '')) {
      if (!env.KV) return proxyError('not_found', 'param', false, '未绑定 KV，不支持异步视频任务', 404);
      const taskId = 'task_' + crypto.randomUUID();
      await env.KV.put('task:' + taskId, JSON.stringify({ status: 'pending', result: null, createdAt: Date.now() }), { expirationTtl: 3600 });
      return new Response(JSON.stringify({ taskId, status: 'pending', poll: '/proxy/task/' + taskId }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // 转发上游（Key 仅在此注入，永不回前端）
    let upstreamResp;
    if (provider === 'openai' && (payload.endpoint || '') === '/images/edits') {
      const body = payload.body || {};
      const fd = new FormData();
      const imgs = Array.isArray(body.imageDataUrls) ? body.imageDataUrls : (body.imageDataUrl ? [body.imageDataUrl] : []);
      const fallbackImg = body.image || body.imageDataUrl || null;
      const useImgs = imgs.length ? imgs : (fallbackImg ? [fallbackImg] : []);
      if (useImgs.length > 1) {
        useImgs.forEach((src, idx) => {
          const blob = dataUrlToBlob(src);
          if (blob) fd.append('image[]', blob, 'ref' + (idx + 1) + '.png');
        });
      } else if (useImgs.length === 1) {
        const blob = dataUrlToBlob(useImgs[0]);
        if (blob) fd.append('image', blob, 'input.png');
      }
      fd.append('prompt', body.prompt || '');
      fd.append('size', body.size || '1024x1024');
      fd.append('n', String(body.n || 1));
      fd.append('model', body.model || 'gpt-image-2');
      upstreamResp = await fetch(base + (payload.endpoint || ''), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env[KEY_ENV[provider]] },
        body: fd,
      });
    } else {
      upstreamResp = await fetch(base + (payload.endpoint || ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env[KEY_ENV[provider]] },
        body: JSON.stringify(payload.body || {}),
      });
    }
    if (!upstreamResp.ok) {
      const t = await upstreamResp.text();
      const status = upstreamResp.status;
      const kind = status === 400 ? 'param' : status === 401 || status === 403 ? 'auth' : status === 429 ? 'transient' : status >= 500 ? 'system' : 'system';
      return proxyError('upstream_error', kind, kind !== 'param' && kind !== 'auth', '上游错误 ' + status, status);
    }
    const out = await upstreamResp.json().catch(() => ({}));
    if (idem && env.KV) await env.KV.put(idemKey(idem), JSON.stringify(out), { expirationTtl: 86400 * 7 });
    return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
  }
};

// 导出供 Node 单测直接调用（proxy/verify-token-scheme.mjs）
export { verifyToken, hmacSign, b64urlEncode, b64urlDecode, timingSafeEqual };
