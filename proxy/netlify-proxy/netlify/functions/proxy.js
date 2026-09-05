// FlowCraft 安全代理 · Netlify Functions 版（个人自用模式）
// 环境变量：PROXY_ALLOWED_ORIGINS / PERSONAL_ACCESS_TOKEN / OPENAI_UPSTREAM_BASE / OPENAI_KEY
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
function upstreamBase(provider) {
  const fromEnv = process.env.UPSTREAM_BASE || process.env[provider.toUpperCase() + "_UPSTREAM_BASE"] || "";
  return fromEnv || UPSTREAM_DEFAULTS[provider] || "";
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
function verifyToken(token) {
  if (!token) return false;
  const pat = process.env.PERSONAL_ACCESS_TOKEN;
  if (!pat) return false;
  return timingSafeEqual(new TextEncoder().encode(pat), new TextEncoder().encode(token));
}
function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string" || !/^data:/i.test(dataUrl)) return null;
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const mime = (/data:(.*?);base64/i.exec(parts[0]) || [])[1] || "image/png";
  const bin = atob(parts[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function jsonOut(status, obj, cors) {
  return { statusCode: status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors }, body: JSON.stringify(obj) };
}

// 免费档函数超时上限 26s：生图单张可达 20~45s，尽量给满
exports.config = { maxDuration: 26 };

exports.handler = async (event) => {
  const env = process.env;
  const origin = (event.headers.origin || event.headers.Origin || "");
  const allowList = String(env.PROXY_ALLOWED_ORIGINS || "").trim();
  const allowAll = allowList === "*";
  const cors = {
    "Access-Control-Allow-Origin": allowAll ? "*" : (allowList.split(",").includes(origin) ? origin : ""),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return jsonOut(404, { error: { code: "not_found", message: "仅支持 POST /proxy" } }, cors);

  let payload;
  try { payload = JSON.parse(event.body || "{}"); } catch { return jsonOut(400, { error: { code: "invalid_param", message: "请求体非 JSON" } }, cors); }

  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = (auth.replace(/^Bearer\s+/i, "") || "").trim();
  if (!verifyToken(token)) return jsonOut(401, { error: { code: "unauthorized", message: "令牌无效" } }, cors);

  const provider = payload.provider || "openai";
  const base = upstreamBase(provider);
  if (!base) return jsonOut(400, { error: { code: "invalid_param", message: "provider 未配置上游地址" } }, cors);
  const upstreamKey = env[KEY_ENV[provider]] || "";
  if (!upstreamKey) return jsonOut(400, { error: { code: "invalid_param", message: "provider 未配置 Key" } }, cors);

  try {
    let upstreamResp;
    if ((payload.endpoint || "") === "/images/edits") {
      // 参考图编辑：前端传 base64 dataURL，服务端组装 multipart 转发上游
      const body = payload.body || {};
      const fd = new FormData();
      const imgs = Array.isArray(body.imageDataUrls) ? body.imageDataUrls : [];
      if (imgs.length > 1) {
        imgs.forEach((src, idx) => {
          const blob = dataUrlToBlob(src);
          if (blob) fd.append("image[]", blob, "ref" + (idx + 1) + ".png");
        });
      } else if (imgs.length === 1) {
        const blob = dataUrlToBlob(imgs[0]);
        if (blob) fd.append("image", blob, "input.png");
      }
      fd.append("prompt", body.prompt || "");
      fd.append("size", body.size || "1024x1024");
      fd.append("n", String(body.n || 1));
      fd.append("model", body.model || "gpt-image-2");
      upstreamResp = await fetch(base + "/images/edits", {
        method: "POST",
        headers: { "Authorization": "Bearer " + upstreamKey },
        body: fd,
      });
    } else {
      upstreamResp = await fetch(base + (payload.endpoint || ""), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + upstreamKey },
        body: JSON.stringify(payload.body || {}),
      });
    }
    const text = await upstreamResp.text();
    if (!upstreamResp.ok) {
      return jsonOut(upstreamResp.status, { error: { code: "upstream_error", message: "上游错误 " + upstreamResp.status + (text ? "：" + text.slice(0, 200) : "") } }, cors);
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...cors }, body: text };
  } catch (e) {
    return jsonOut(502, { error: { code: "system", message: "转发失败：" + (e && e.message || e) } }, cors);
  }
};
