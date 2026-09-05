// FlowCraft 安全代理 · Deno Deploy 版（个人自用模式）
// 浏览器 → Deno（有 CORS）→ 中转站（服务器间转发，不受 CORS 限制）
// 环境变量：PROXY_ALLOWED_ORIGINS（"*" 放行全部）/ PERSONAL_ACCESS_TOKEN（固定口令）
//           OPENAI_UPSTREAM_BASE（上游，如 https://momoai.asia/v1）/ OPENAI_KEY（上游 Key）

const UPSTREAM_DEFAULTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
};
const KEY_ENV: Record<string, string> = {
  openai: "OPENAI_KEY", deepseek: "DEEPSEEK_KEY", anthropic: "ANTHROPIC_KEY", google: "GOOGLE_KEY", xai: "XAI_KEY",
};
function upstreamBase(provider: string): string {
  const fromEnv = Deno.env.get("UPSTREAM_BASE") || Deno.env.get(provider.toUpperCase() + "_UPSTREAM_BASE") || "";
  return fromEnv || UPSTREAM_DEFAULTS[provider] || "";
}
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
function verifyToken(token: string): boolean {
  if (!token) return false;
  const pat = Deno.env.get("PERSONAL_ACCESS_TOKEN");
  if (!pat) return false;
  return timingSafeEqual(new TextEncoder().encode(pat), new TextEncoder().encode(token));
}
function proxyError(code: string, message: string, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: { code, message, status } }), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const allowList = (Deno.env.get("PROXY_ALLOWED_ORIGINS") || "").trim();
  const allowAll = allowList === "*";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": allowAll ? "*" : (allowList.split(",").includes(origin) ? origin : ""),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const pathname = new URL(req.url).pathname;
  if (req.method !== "POST" || !/\/(proxy|api\/proxy)$/.test(pathname)) {
    return proxyError("not_found", "仅支持 POST /proxy", 404, cors);
  }

  let payload: { provider?: string; endpoint?: string; body?: unknown };
  try { payload = await req.json(); } catch { return proxyError("invalid_param", "请求体非 JSON", 400, cors); }

  const auth = req.headers.get("Authorization") || "";
  const token = (auth.replace(/^Bearer\s+/i, "") || "").trim();
  if (!verifyToken(token)) return proxyError("unauthorized", "令牌无效", 401, cors);

  const provider = payload.provider || "openai";
  const base = upstreamBase(provider);
  if (!base) return proxyError("invalid_param", "provider「" + provider + "」未配置上游地址", 400, cors);
  const upstreamKey = Deno.env.get(KEY_ENV[provider]) || "";
  if (!upstreamKey) return proxyError("invalid_param", "provider「" + provider + "」未配置 Key", 400, cors);

  try {
    const upstreamResp = await fetch(base + (payload.endpoint || ""), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + upstreamKey },
      body: JSON.stringify(payload.body || {}),
    });
    const text = await upstreamResp.text();
    if (!upstreamResp.ok) {
      return proxyError("upstream_error", "上游错误 " + upstreamResp.status + (text ? "：" + text.slice(0, 200) : ""), upstreamResp.status, cors);
    }
    return new Response(text, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
  } catch (e) {
    return proxyError("system", "转发失败：" + ((e as Error)?.message || e), 502, cors);
  }
});
