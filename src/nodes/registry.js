// 阶段 0.5 — 节点注册 + 数据契约（占位）
// 阶段 2 实现：节点类型注册、输入/输出端口契约、连线合法性校验。
export const NodeRegistry = {
  _ready: false,
  register() { return false; },
  get() { return null; },
  list() { return []; },
  validate() { return { ok: true }; },
};
