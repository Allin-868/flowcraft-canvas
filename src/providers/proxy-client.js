// 阶段 4 — API 安全代理客户端（浏览器侧）
// 设计原则：浏览器不持有任何生产 Key。所有模型调用经代理转发；
// 代理持有生产 Key（环境变量），仅接受短期用户令牌（可吊销、限额度）。
//
// 错误分类（对接执行引擎 8.3）：
//   kind = 'param'  → 参数/契约错误，不可重试（引擎置 node.status='failure'）
//   kind = 'quota'  → 额度超限熔断，不可重试（'failure'）
//   kind = 'auth'   → 令牌失效/未授权，不可重试（'failure'）
//   kind = 'transient' → 限流/网络抖动，可重试（'error'）
//   kind = 'system' → 上游 5xx，可重试 1 次（'error'）
//   kind = 'timeout'→ 上游超时，可重试 1 次（'error'）
//
// 调用约定：proxy.call 返回上游原始 JSON（与直连 fetch().json() 同形），
// 便于 legacy 既有解析逻辑零改动复用。

export class ProxyError extends Error {
  constructor(message, opts) {
    super(message);
    this.name = 'ProxyError';
    opts = opts || {};
    this.kind = opts.kind || 'system';      // param|quota|auth|transient|system|timeout
    this.retryable = typeof opts.retryable === 'boolean' ? opts.retryable : false;
    this.status = opts.status || 0;
    this.code = opts.code || '';
  }
}

function mapCode(code, status) {
  code = String(code || '').toLowerCase();
  if (code === 'quota_exceeded' || status === 402) return 'quota';
  if (code === 'invalid_param' || code === 'param_error' || status === 400) return 'param';
  if (code === 'unauthorized' || code === 'invalid_token' || status === 401) return 'auth';
  if (code === 'forbidden' || status === 403) return 'auth';
  if (code === 'rate_limited' || status === 429) return 'transient';
  if (status === 408) return 'timeout';
  if (code === 'upstream_timeout' || status === 504) return 'timeout';
  if (status >= 500) return 'system';
  if (status >= 429) return 'transient';
  return 'system';
}

function defaultRetryable(kind) {
  return kind === 'transient' || kind === 'timeout' || kind === 'system';
}

export const ProxyClient = {
  _base: '',
  _token: '',
  _enabled: false,

  // 由 compat 启动时调用：base 为空 → 代理未启用（legacy 回退直连，便于本地开发）
  configure(opts) {
    opts = opts || {};
    if (opts.base) this.setBase(opts.base);
    if (opts.token != null) this.setToken(opts.token);
    return this;
  },
  setBase(url) {
    this._base = String(url || '').replace(/\/+$/, '');
    this._enabled = !!this._base;
    return this._enabled;
  },
  setToken(t) { this._token = t || ''; return this; },
  enabled() { return this._enabled; },
  base() { return this._base; },

  _headers(idempotencyKey, token) {
    const h = { 'Content-Type': 'application/json' };
    const tk = (token != null ? token : this._token);
    if (tk) h['Authorization'] = 'Bearer ' + tk;
    if (idempotencyKey) h['X-Idempotency-Key'] = idempotencyKey;
    return h;
  },

  // 将代理/{error} 包装统一格式映射为 ProxyError（兼容代理省略 kind 的情况）
  _raiseFromPayload(json, status) {
    const e = (json && json.error) || {};
    const kind = e.kind || mapCode(e.code, status);
    const retryable = typeof e.retryable === 'boolean' ? e.retryable : defaultRetryable(kind);
    throw new ProxyError(e.message || ('代理返回 ' + status), {
      kind, retryable, status: e.status || status, code: e.code || ''
    });
  },

  // 同步（JSON）调用：返回上游原始 JSON
  async call(opts) {
    opts = opts || {};
    if (!this._enabled) throw new ProxyError('代理未配置', { kind: 'system', retryable: false, code: 'proxy_not_configured' });
    const provider = opts.provider || 'openai';
    const endpoint = opts.endpoint || '/';
    const resp = await fetch(this._base + '/proxy', {
      method: 'POST',
      headers: this._headers(opts.idempotencyKey, opts.token),
      body: JSON.stringify({ provider: provider, endpoint: endpoint, body: opts.body || {}, stream: false })
    });
    const text = await resp.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { _raw: text }; }
    if (!resp.ok) this._raiseFromPayload(json, resp.status);
    if (json && json.error && (json.error.code || json.error.message)) this._raiseFromPayload(json, resp.status);
    return json; // 上游原始响应（unwrapped）
  },

  // 流式（SSE）调用：返回 fetch Response，调用方自行消费流
  async stream(opts) {
    opts = opts || {};
    if (!this._enabled) throw new ProxyError('代理未配置', { kind: 'system', retryable: false, code: 'proxy_not_configured' });
    const provider = opts.provider || 'openai';
    const endpoint = opts.endpoint || '/';
    const resp = await fetch(this._base + '/proxy', {
      method: 'POST',
      headers: this._headers(opts.idempotencyKey, opts.token),
      body: JSON.stringify({ provider: provider, endpoint: endpoint, body: opts.body || {}, stream: true })
    });
    if (!resp.ok) {
      const text = await resp.text();
      let json;
      try { json = text ? JSON.parse(text) : {}; } catch (_) { json = {}; }
      this._raiseFromPayload(json, resp.status);
    }
    return resp; // SSE 流
  },

  // 把 ProxyError 映射为 legacy 节点状态（供执行引擎分类）
  errorToNodeStatus(err) {
    if (err && err.kind && (err.kind === 'param' || err.kind === 'quota' || err.kind === 'auth')) return 'failure';
    return 'error';
  }
};

// 供测试/debug 暴露
if (typeof window !== 'undefined') {
  window.ProxyClient = ProxyClient;
}
