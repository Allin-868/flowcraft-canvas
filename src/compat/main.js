// 阶段 0.5 — 兼容层入口
// 把存储 / 执行 / 节点 / 代理 / 费用 接口挂载到 window.FlowCraft，
// 供后续阶段（IndexedDB / 执行引擎 / API 代理）无感替换实现。
import { StorageAdapter } from '../storage/storage.js';
import { Runner } from '../execution/runner.js';
import { NodeRegistry } from '../nodes/registry.js';
import { ProxyClient } from '../providers/proxy-client.js';
import { FeeModel } from '../providers/fee-model.js';

window.FlowCraft = window.FlowCraft || {};
window.FlowCraft.storage = StorageAdapter;
window.FlowCraft.runner = Runner;
window.FlowCraft.nodes = NodeRegistry;
window.FlowCraft.proxy = ProxyClient;
window.FlowCraft.fee = FeeModel;
window.FlowCraft.version = '3.2-modular-build';

if (typeof console !== 'undefined') {
  console.log(
    '[FlowCraft] 兼容层已挂载：',
    'storage=' + StorageAdapter.getMode(),
    'runner=' + Runner.getMode()
  );
}
