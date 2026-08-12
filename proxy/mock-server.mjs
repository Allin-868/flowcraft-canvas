// 阶段 4 — 本地 Mock 代理（用于 verify-proxy.js 驱动，无外部依赖）
// 实现与 Cloudflare Worker（proxy/worker.js）相同的契约：
//   ① 校验短期用户令牌  ② 限流  ③ 日额度熔断  ④ 日志脱敏
//   ⑤ 统一错误格式  ⑥ 视频异步任务（不阻塞）  ⑦ 幂等键映射
// 不持有生产 Key（模拟上游，不真正打外部 API）。
//
// 启动：node proxy/mock-server.mjs [port]   默认 8787
// 调试接口：POST /__debug/config {ratelimit, quota, token} ；GET /__debug/state

import http from 'node:http';

const PORT = Number(process.argv[2] || process.env.PORT || 8787);

const state = {
  config: { ratelimit: 1000, quota: 1e9, windowMs: 60000 },
  rate: new Map(),         // token -> {count, start}
  quotaUsed: new Map(),    // token -> used
  idem: new Map(),         // key -> {result, hits}
  tokens: new Set(),       // 已签发令牌（mock 接受任意非空，登记用于演示）
  upstreamCount: 0,        // 实际"上游"模拟次数（幂等命中不计）
  logs: [],                // 脱敏日志（最近 50 条）
  tasks: new Map(),        // taskId -> {status, result, readyAt}
};

function maskKey(auth) {
  if (!auth) return '(none)';
  const m = /^(Bearer\s+)(sk-[A-Za-z0-9]{4})[A-Za-z0-9._-]*$/.exec(auth);
  if (m) return m[1] + m[2] + '***';
  return auth.slice(0, 12) + '***';
}
function logReq(req, body) {
  const line = {
    t: Date.now(),
    method: req.method,
    path: req.url,
    auth: maskKey(req.headers['authorization'] || ''),
    provider: body && body.provider,
    endpoint: body && body.endpoint,
    idem: req.headers['x-idempotency-key'] || null,
  };
  state.logs.push(line);
  if (state.logs.length > 50) state.logs.shift();
}
function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
}
function sendJSON(res, status, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders()));
  res.end(buf);
}
function errPayload(code, kind, retryable, message, status) {
  return { error: { code, kind, retryable, message, status } };
}

function checkRate(token) {
  const c = state.config.ratelimit;
  if (c >= 1e9) return null;
  const now = Date.now();
  let b = state.rate.get(token);
  if (!b || now - b.start > state.config.windowMs) { b = { count: 0, start: now }; state.rate.set(token, b); }
  b.count++;
  if (b.count > c) return errPayload('rate_limited', 'transient', true, '请求过于频繁，请稍后重试', 429);
  return null;
}
function checkQuota(token, cost) {
  const cap = state.config.quota;
  if (cap >= 1e9) return null;
  const used = (state.quotaUsed.get(token) || 0) + cost;
  state.quotaUsed.set(token, used);
  if (used > cap) {
    return errPayload('quota_exceeded', 'quota', false, `今日额度已用完（${used.toFixed(4)} > ${cap}）`, 402);
  }
  return null;
}

// 模拟上游返回（不真正调用外部 API）
function fakeUpstream(provider, endpoint, body, stream) {
  state.upstreamCount++;
  if (stream) {
    // 深搜 SSE
    return { sse: true, text: 'data: {"choices":[{"delta":{"content":"你好，这是代理转发的流。"}}]}\n\ndata: [DONE]\n' };
  }
  if (provider === 'openai' && (endpoint === '/images/generations')) {
    return { json: { data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }] } };
  }
  if (provider === 'openai' && endpoint === '/responses') {
    return { json: { output: [{ type: 'image', image: { url: 'https://example.com/fake.png' } }] } };
  }
  if (provider === 'openai' && endpoint === '/chat/completions') {
    return { json: { choices: [{ message: { role: 'assistant', content: '你好，这是代理转发的回复。' } }] } };
  }
  if (provider === 'deepseek' && endpoint === '/chat/completions') {
    return { json: { choices: [{ message: { role: 'assistant', content: '你好，这是代理转发的回复。' } }] } };
  }
  if ((provider === 'kling' || provider === 'runway') && /video/i.test(endpoint)) {
    // 异步任务：立即返回 taskId，不阻塞
    const taskId = 'task_' + Math.random().toString(36).slice(2, 10);
    state.tasks.set(taskId, { status: 'pending', result: { video_url: 'https://example.com/fake.mp4' }, readyAt: Date.now() + 800 });
    return { json: { taskId, status: 'pending', poll: '/proxy/task/' + taskId } };
  }
  return { json: { ok: true, echo: { provider, endpoint } } };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e7) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/__debug/config') {
    const b = await readBody(req);
    if (typeof b.ratelimit === 'number') { state.config.ratelimit = b.ratelimit; state.rate.clear(); }
    if (typeof b.quota === 'number') { state.config.quota = b.quota; state.quotaUsed.clear(); }
    if (typeof b.token === 'string') state.tokens.add(b.token);
    return sendJSON(res, 200, { ok: true, config: state.config });
  }
  if (req.method === 'GET' && url.pathname === '/__debug/state') {
    return sendJSON(res, 200, {
      upstreamCount: state.upstreamCount,
      quotaUsed: Object.fromEntries(state.quotaUsed),
      idemHits: Object.fromEntries([...state.idem].map(([k, v]) => [k, v.hits])),
      logs: state.logs,
      tasks: Object.fromEntries(state.tasks),
    });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/proxy/task/')) {
    const id = url.pathname.split('/').pop();
    const t = state.tasks.get(id);
    if (!t) return sendJSON(res, 404, errPayload('task_not_found', 'param', false, '任务不存在', 404));
    if (t.status === 'pending' && Date.now() >= t.readyAt) { t.status = 'success'; }
    return sendJSON(res, 200, t.status === 'success' ? { taskId: id, status: 'success', result: t.result } : { taskId: id, status: t.status });
  }

  if (req.method === 'POST' && url.pathname === '/proxy') {
    const body = await readBody(req);
    logReq(req, body);
    const auth = req.headers['authorization'] || '';
    const token = (auth.replace(/^Bearer\s+/i, '') || '').trim();
    if (!token) return sendJSON(res, 401, errPayload('unauthorized', 'auth', false, '缺少用户令牌', 401));

    // ② 限流
    const rl = checkRate(token);
    if (rl) return sendJSON(res, 429, rl);

    // ③ 日额度（按调用粗略计费：image 0.04 / video 0.5 / 其他 0.01）
    const cost = body.provider === 'kling' || body.provider === 'runway' ? 0.5
      : (body.provider === 'openai' && /image/i.test(body.endpoint || '')) ? 0.04 : 0.01;
    const q = checkQuota(token, cost);
    if (q) return sendJSON(res, 402, q);

    // ⑦ 幂等键
    const idemKey = req.headers['x-idempotency-key'];
    if (idemKey) {
      const hit = state.idem.get(idemKey);
      if (hit) { hit.hits++; return sendJSON(res, 200, Object.assign({}, hit.result, { _cached: true })); }
    }

    const upstream = fakeUpstream(body.provider, body.endpoint, body.body, !!body.stream);
    if (idemKey) state.idem.set(idemKey, { result: upstream.json || { sse: true }, hits: 1 });

    if (upstream.sse) {
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' }, corsHeaders()));
      res.end(upstream.text);
      return;
    }
    // ⑤ 统一成功格式：直接返回上游 JSON（与直连同形）
    return sendJSON(res, 200, upstream.json);
  }

  sendJSON(res, 404, errPayload('not_found', 'param', false, '路径不存在', 404));
});

server.listen(PORT, () => {
  console.log('[mock-proxy] listening on http://localhost:' + PORT);
});
