// FlowCraft 安全代理 · Vercel 版（个人自用模式）
// 浏览器 → Vercel（有 CORS）→ 中转站（服务器间转发，不受 CORS 限制）
// 环境变量（在 Vercel 控制台或 vercel env 配置）：
//   PROXY_ALLOWED_ORIGINS  允许的浏览器来源（"*" 放行全部，个人自用）
//   PERSONAL_ACCESS_TOKEN  固定口令（前端「代理令牌」填同一个）
//   OPENAI_UPSTREAM_BASE   上游基址，如 https://momoai.asia/v1
//   OPENAI_KEY             上游 API Key（secret，不写进代码）

const UPSTREAM_DEFAULTS = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
};
const KEY_ENV = {
  openai: "OPENAI_KEY", deepseek: "DEEPSEEK_KEY", anthropic: "ANTHROPIC_KEY", google: "GOOGLE_KEY", xai: "XAI_KEY",
};
function upstreamBase(provider, env) {
  const fromEnv = (env && (env.UPSTREAM_BASE || env[provider.toUpperCase() + "_UPSTREAM_BASE"])) || "";
  return String(fromEnv || UPSTREAM_DEFAULTS[provider] || "");
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
function verifyToken(token, env) {
  if (!token) return false;
  const pat = env.PERSONAL_ACCESS_TOKEN;
  if (!pat) return false;
  return timingSafeEqual(new TextEncoder().encode(pat), new TextEncoder().encode(token));
}
function proxyError(res, code, message, status) {
  return res.status(status).json({ error: { code, message, status } });
}

module.exports = async function handler(req, res) {
  const env = process.env;
  const origin = req.headers.origin || "";
  const allowList = String(env.PROXY_ALLOWED_ORIGINS || "").trim();
  const allowAll = allowList === "*";
  res.setHeader("Access-Control-Allow-Origin", allowAll ? "*" : (allowList.split(",").includes(origin) ? origin : ""));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const pathname = (req.url || "").split("?")[0];
  if (req.method !== "POST" || !/\/(proxy|api\/proxy)$/.test(pathname)) {
    return proxyError(res, "not_found", "仅支持 POST /proxy", 404);
  }

  let payload = req.body;
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { return proxyError(res, "invalid_param", "请求体非 JSON", 400); } }
  if (!payload || typeof payload !== "object") return proxyError(res, "invalid_param", "请求体非 JSON", 400);

  const auth = req.headers.authorization || "";
  const token = (auth.replace(/^Bearer\s+/i, "") || "").trim();
  if (!verifyToken(token, env)) return proxyError(res, "unauthorized", "令牌无效", 401);

  const provider = payload.provider || "openai";
  const base = upstreamBase(provider, env);
  if (!base) return proxyError(res, "invalid_param", "provider「" + provider + "」未配置上游地址（env." + (provider.toUpperCase() + "_UPSTREAM_BASE") + "）", 400);
  const upstreamKey = env[KEY_ENV[provider]] || "";
  if (!upstreamKey) return proxyError(res, "invalid_param", "provider「" + provider + "」未配置 Key（env." + KEY_ENV[provider] + "）", 400);

  try {
    const upstreamResp = await fetch(base + (payload.endpoint || ""), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + upstreamKey },
      body: JSON.stringify(payload.body || {}),
    });
    const text = await upstreamResp.text();
    if (!upstreamResp.ok) {
      return proxyError(res, "upstream_error", "上游错误 " + upstreamResp.status + (text ? "：" + text.slice(0, 200) : ""), upstreamResp.status);
    }
    let json; try { json = JSON.parse(text); } catch { json = { _raw: text }; }
    return res.status(200).json(json);
  } catch (e) {
    return proxyError(res, "system", "转发失败：" + (e && e.message || e), 502);
  }
};
