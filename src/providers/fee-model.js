// 阶段 0.5 — 费用模式（占位）
// 阶段 4 费用模式决策门之后实现：额度 / 账单 / 滥用防护。
export const FeeModel = {
  _ready: false,
  plan() { return 'undecided'; },
  estimate() { return 0; },
};
