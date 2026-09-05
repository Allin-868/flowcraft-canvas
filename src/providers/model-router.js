// 阶段 9 — 多模型路由（浏览器侧）
// 安全约束：模型生产 Key 不进前端，由代理环境变量统一管理（见 proxy/worker.js）。
// 前端只维护「模型清单」（provider + model id + 能力 + 评分），不保存任何 Key。
// 路由引擎按 capability（text/image/video）+ strategy（cost/speed/quality）从已启用模型中选最优，
// 返回 { model, provider, reason }，供 legacy 调用点经代理转发到对应上游。
//
// 设计：纯前端、零外部依赖，可被 verify-model-router.js 直接驱动（不依赖真实 API）。

// ---------- 工具 ----------
function num(v, d) { const n = Number(v); return isFinite(n) ? n : d; }
function clamp01(v) { const n = Number(v); if (!isFinite(n)) return 0.5; return n < 0 ? 0 : n > 1 ? 1 : n; }

const LS = {
  models: 'fc_multimodel_models_v1',
  strategy: 'fc_multimodel_strategy_v1',
  enabled: 'fc_multimodel_enabled_v1',
  health: 'fc_multimodel_health_v1',
};
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (_) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

// ---------- 默认模型清单（与现网行为一致：OpenAI 生文/生图 + DeepSeek 流式默认启用）----------
// 其余厂商默认 disabled：需代理侧配置对应 Key 后才启用（前端只选模型，不碰 Key）。
export const SEED_MODELS = [
  { id: 'openai/gpt-5.4', provider: 'openai', model: 'gpt-5.4', label: 'GPT-5.4', capabilities: ['text'], tier: 'production', cost: 0.8, speed: 0.7, quality: 0.95, enabled: true },
  { id: 'openai/gpt-5.4-mini', provider: 'openai', model: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', capabilities: ['text'], tier: 'production', cost: 0.5, speed: 0.85, quality: 0.9, enabled: true },
  { id: 'openai/gpt-image-2', provider: 'openai', model: 'gpt-image-2', label: 'GPT Image 2', capabilities: ['image'], tier: 'production', cost: 0.9, speed: 0.6, quality: 0.95, enabled: true },
  { id: 'deepseek/deepseek-v4-flash', provider: 'deepseek', model: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', capabilities: ['text'], tier: 'production', cost: 0.1, speed: 0.8, quality: 0.85, enabled: true },
  { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', capabilities: ['text'], tier: 'production', cost: 0.85, speed: 0.72, quality: 0.96, enabled: true },
  { id: 'google/gemini-3-flash-preview', provider: 'google', model: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', capabilities: ['text'], tier: 'production', cost: 0.25, speed: 0.95, quality: 0.9, enabled: true },
];

// capability 无可用模型时的回退（保持现网默认行为）
const DEFAULT_BY_CAP = {
  text: { model: 'gpt-5.4', provider: 'openai' },
  image: { model: 'gpt-image-2', provider: 'openai' },
  video: { model: '', provider: 'kling' },
};

// ---------- 模型注册表（CRUD + 持久化）----------
export const ModelRegistry = {
  _models: [],
  _init: false,
  _seed() { return SEED_MODELS.map((m) => Object.assign({}, m)); },

  init() {
    if (this._init) return this;
    const saved = lsGet(LS.models, null);
    if (Array.isArray(saved) && saved.length) this._models = saved;
    else this._models = this._seed();
    this._init = true;
    return this;
  },
  list() { return this._models.map((m) => Object.assign({}, m)); },
  get(id) { const m = this._models.find((x) => x.id === id); return m ? Object.assign({}, m) : null; },

  add(entry) {
    if (!entry || !entry.model) throw new Error('model required');
    const rec = {
      provider: entry.provider || 'openai',
      model: entry.model,
      label: entry.label || entry.model,
      capabilities: Array.isArray(entry.capabilities) && entry.capabilities.length ? entry.capabilities : ['text'],
      tier: entry.tier || 'production',
      cost: clamp01(num(entry.cost, 0.5)),
      speed: clamp01(num(entry.speed, 0.5)),
      quality: clamp01(num(entry.quality, 0.5)),
      enabled: entry.enabled !== false,
    };
    rec.id = entry.id || (rec.provider + '/' + rec.model);
    // 避免重复 id
    if (this._models.some((x) => x.id === rec.id)) rec.id = rec.id + '#' + Date.now().toString(36);
    this._models.push(rec);
    this._persist();
    return Object.assign({}, rec);
  },
  update(id, patch) {
    const m = this._models.find((x) => x.id === id);
    if (!m) return null;
    Object.assign(m, patch || {});
    if (patch && patch.model && !patch.id) m.id = m.provider + '/' + m.model;
    this._persist();
    return Object.assign({}, m);
  },
  remove(id) {
    const i = this._models.findIndex((x) => x.id === id);
    if (i < 0) return false;
    this._models.splice(i, 1);
    this._persist();
    return true;
  },
  setEnabled(id, on) {
    const m = this._models.find((x) => x.id === id);
    if (!m) return false;
    m.enabled = !!on;
    this._persist();
    return true;
  },
  reset() { this._models = this._seed(); this._persist(); return this.list(); },
  _persist() { lsSet(LS.models, this._models); },
};

// ---------- 路由引擎（capability + strategy → 最优模型）----------
export const ModelRouter = {
  _strategy: 'quality',
  _enabled: false,
  init() {
    const s = lsGet(LS.strategy, 'quality');
    this._strategy = (s === 'cost' || s === 'speed' || s === 'quality') ? s : 'quality';
    this._enabled = !!lsGet(LS.enabled, false);
    return this;
  },
  enabled() { return this._enabled; },
  setEnabled(on) { this._enabled = !!on; lsSet(LS.enabled, this._enabled); return this._enabled; },
  strategy() { return this._strategy; },
  setStrategy(s) {
    if (s === 'cost' || s === 'speed' || s === 'quality') { this._strategy = s; lsSet(LS.strategy, this._strategy); }
    return this._strategy;
  },
  _score(m) {
    const s = this._strategy;
    if (s === 'cost') return 1 - clamp01(m.cost);     // 越便宜越好
    if (s === 'speed') return clamp01(m.speed);        // 越快越好
    return clamp01(m.quality);                          // quality：质量优先
  },
  // opts: { capability: 'text'|'image'|'video', strategy?: override }
  select(opts) {
    opts = opts || {};
    const cap = opts.capability || 'text';
    const strat = (opts.strategy === 'cost' || opts.strategy === 'speed' || opts.strategy === 'quality') ? opts.strategy : this._strategy;
    const list = ModelRegistry.init().list().filter((m) => m.enabled && (m.capabilities || []).indexOf(cap) >= 0);
    if (!list.length) {
      const fb = DEFAULT_BY_CAP[cap] || DEFAULT_BY_CAP.text;
      return { model: fb.model, provider: fb.provider, reason: 'no-enabled-model:fallback', fallback: true, capability: cap, strategy: strat };
    }
    let best = list[0];
    let bs = this._scoreFor(best, strat);
    for (let i = 1; i < list.length; i++) {
      const s = this._scoreFor(list[i], strat);
      if (s > bs) { bs = s; best = list[i]; }
    }
    return { model: best.model, provider: best.provider, reason: strat + '-best:' + best.id, fallback: false, capability: cap, strategy: strat, id: best.id };
  },
  _scoreFor(m, strat) {
    if (strat === 'cost') return 1 - clamp01(m.cost);
    if (strat === 'speed') return clamp01(m.speed);
    return clamp01(m.quality);
  },
};

// ---------- 模型健康监控（成功率 / 平均耗时 / 状态）----------
export const ModelHealth = {
  _stats: {},
  init() { this._stats = lsGet(LS.health, {}) || {}; return this; },
  // e: { modelId, ok, ms }
  record(e) {
    e = e || {};
    const id = e.modelId;
    if (!id) return null;
    const st = this._stats[id] || { success: 0, fail: 0, totalMs: 0, count: 0, lastStatus: 'unknown', lastAt: 0 };
    st.count++;
    if (e.ok) st.success++; else st.fail++;
    st.totalMs += (Number(e.ms) || 0);
    st.lastStatus = e.ok ? 'ok' : 'down';
    st.lastAt = Date.now();
    this._stats[id] = st;
    this._persist();
    return this.summary(id);
  },
  summary(id) {
    const st = this._stats[id];
    if (!st || !st.count) return { modelId: id, successRate: null, avgMs: null, status: 'unknown', count: 0 };
    const rate = st.success / st.count;
    const avg = st.totalMs / st.count;
    let status = 'ok';
    if (st.fail > 0 && rate < 0.5) status = 'down';
    else if (st.fail > 0) status = 'degraded';
    return { modelId: id, successRate: +rate.toFixed(3), avgMs: +avg.toFixed(1), status, count: st.count, success: st.success, fail: st.fail };
  },
  all() {
    const out = {};
    Object.keys(this._stats).forEach((id) => { out[id] = this.summary(id); });
    return out;
  },
  reset() { this._stats = {}; this._persist(); return this.all(); },
  _persist() { lsSet(LS.health, this._stats); },
};

// 供 Node 单测 / 调试直接引用
if (typeof window !== 'undefined') {
  window.__FlowCraftModelRouter = { ModelRegistry, ModelRouter, ModelHealth, SEED_MODELS };
}
