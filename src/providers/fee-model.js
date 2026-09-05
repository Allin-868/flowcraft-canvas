// 阶段 4 — 费用模式（浏览器侧：展示/预估/用量回显）
// 真实额度强约束在代理服务端（日额度熔断，见 proxy/worker.js + proxy/mock-server.mjs）。
// 此处仅做：模式标识、单节点费用预估、当日用量回显，不承担鉴权与计费权威。

export const FeeModel = {
  _plan: 'invite-quota',          // 首轮决策：邀请制测试账号 + 每日固定额度
  _dailyCap: 2.0,                 // 首轮默认 ¥2/账号/日（代理侧可调，权威值以代理为准）
  _used: 0,                       // 当日已用（由代理回传 / 本地累加估算）
  _currency: 'CNY',

  plan() { return this._plan; },
  isInviteQuota() { return this._plan === 'invite-quota'; },

  // 单节点费用预估（粗略，仅用于展示，非计费）
  estimate(nodeType, params) {
    const p = params || {};
    switch (nodeType) {
      case 'aiImage': {
        const n = Math.max(1, Number(p.count) || 1);
        const res = p.resolution === '超清2K' || p.resolution === '原画4K' ? 0.12 : 0.04;
        return +(n * res).toFixed(4);
      }
      case 'imageEdit': {
        const n = Math.max(1, Number(p.count) || 1);
        const res = p.resolution === '超清2K' || p.resolution === '原画4K' ? 0.12 : 0.04;
        return +(n * res).toFixed(4);
      }
      case 'aiVideo': {
        const dur = Math.max(4, Number(p.duration) || 5);
        return +(dur * 0.5).toFixed(4); // 视频按秒估算
      }
      case 'comfyui': return 0.02;
      case 'aiText': return 0.005;
      default: return 0;
    }
  },

  // 每日额度（代理侧为权威；此处为默认值，可被 setDailyCap 覆盖）
  dailyCap() { return this._dailyCap; },
  setDailyCap(v) { this._dailyCap = Math.max(0, Number(v) || 0); return this._dailyCap; },

  // 用量回显
  used() { return this._used; },
  setUsage(v) { this._used = Math.max(0, Number(v) || 0); return this._used; },
  addUsage(cost) { this._used = +(this._used + (Number(cost) || 0)).toFixed(4); return this._used; },
  remaining() { return +(this._dailyCap - this._used).toFixed(4); },
  overQuota() { return this._used >= this._dailyCap; },

  // 把代理返回的统一错误中的配额信息回写到本地展示
  applyQuotaPayload(payload) {
    if (!payload) return;
    if (typeof payload.dailyCap === 'number') this._dailyCap = payload.dailyCap;
    if (typeof payload.used === 'number') this._used = payload.used;
  }
};
