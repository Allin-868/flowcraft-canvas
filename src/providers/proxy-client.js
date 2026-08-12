// 阶段 0.5 — API 安全代理客户端（占位）
// 阶段 4 实现：浏览器不持有生产 Key，所有模型调用经 Serverless 代理转发。
export const ProxyClient = {
  _ready: false,
  async call() { throw new Error('ProxyClient 尚未实现（阶段 4）'); },
};
