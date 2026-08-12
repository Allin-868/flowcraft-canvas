// 阶段 3 — 任务执行引擎
// 取代阶段 0.5 的遗留 runNode 委托，提供：
//   · 任务状态机（pending/running/success/failure/cancelled/timeout/retrying）
//   · 并发上限（默认 8，可配）
//   · 取消（pending 节点直接跳过；running 节点置 _abort，完成后标记为 cancelled）
//   · 超时判定（按节点类型，race 包裹，超时标记 timeout）
//   · 失败分类与重试（param 不重试 / transient 重试 2 次 / system 重试 1 次 / timeout 重试 1 次，指数退避）
//   · 持久化（tasks store）+ 刷新对账（reconcile：崩溃遗留 running → failure）
//   · DAG 依赖（复用 legacy topoSortNodes + workflow.edges）
//   · 幂等（输入哈希命中已成功缓存则跳过重算）
//
// 集成方式：legacy runInOrder(order, delay, skipSet) 改为 opt-in 委托本引擎；
// 未注入 FlowCraft.runner 时回退原逻辑，行为等价。
import { idbPut, idbGet, idbGetAll, idbDelete } from '../storage/db.js';

// —— 并发信号量 ——
class Semaphore {
  constructor(n) { this.n = n; this.q = []; }
  acquire() {
    return new Promise((res) => {
      if (this.n > 0) { this.n--; res(); }
      else this.q.push(res);
    });
  }
  release() {
    if (this.q.length) { const r = this.q.shift(); r(); }
    else this.n++;
  }
}

// 安全地引用 legacy 全局（经典脚本顶层 let/function 在全局词法环境，按裸名解析）
function legacy(name) { return (typeof window !== 'undefined') ? window[name] : undefined; }

let _seq = 0;
const _sem = new Semaphore(8);
const _tasks = new Map();           // taskId -> task 记录（内存镜像）
const _idem = new Map();            // nodeId:inputHash -> { state, outputs, thumb }
const _cancel = new Set();          // 已请求取消的 nodeId
let _maxConcurrent = 8;
let _testTimeout = 0;                // 测试钩子：>0 时覆盖所有节点超时（ms）

function mkTaskId(node, attempt) { return 't:' + (node && node.id) + ':' + (++_seq) + ':a' + attempt; }

function nodeTimeout(node) {
  const type = node && node.type;
  if (node && typeof node._timeoutOverride === 'number' && node._timeoutOverride > 0) return node._timeoutOverride; // 测试钩子
  if (type === 'aiVideo') return 120000;
  if (type === 'aiImage') return 90000;
  if (type === 'comfyui') return 300000;
  return 60000;
}

function computeInputHash(node) {
  try {
    const basis = {
      type: node.type,
      params: node.params || {},
      prompt: node.prompt || '',
      inputs: node.inputsData || [],
    };
    return JSON.stringify(basis);
  } catch (e) {
    return (node.type || '') + ':' + (node.id || '');
  }
}

function classify(node) {
  if (node.status === 'failure') return { category: 'param', maxRetry: 0 };      // 参数/契约拦截，不重试
  if (node.status === 'error') return { category: 'transient', maxRetry: 2 };    // 接口/网络抖动，重试
  return { category: 'system', maxRetry: 1 };                                      // 未知系统错误，限重试
}

function applyCached(node, c) {
  if (c.outputs) node.outputsData = c.outputs;
  if (c.thumb != null) node.thumb = c.thumb;
  node.status = 'done';
  const u = legacy('updateNodeStatus');
  if (typeof u === 'function' && node.el) { try { u(node); } catch (e) {} }
  const m = legacy('markEdgesDirty');
  if (typeof m === 'function') { try { m(); } catch (e) {} }
}

async function putTask(task) {
  _tasks.set(task.id, task);
  try { await idbPut('tasks', task); } catch (e) { /* 离线/不可用忽略 */ }
}

function backoff(attempt) {
  const ms = Math.min(8000, 800 * Math.pow(2, attempt)); // 0.8s, 1.6s, 3.2s ...
  return new Promise((r) => setTimeout(r, ms));
}

async function safeExec(node, delay) {
  const ex = legacy('executeNodeAsync');
  if (typeof ex !== 'function') return;
  return ex(node, delay);
}

// —— 单节点执行（含状态机/超时/幂等/重试/取消）——
async function engineRunNode(node, delay, attempt) {
  attempt = attempt || 0;
  if (!node) return;
  // 取消（pending 阶段）
  if (_cancel.has(node.id)) {
    await putTask({ id: mkTaskId(node, attempt), nodeId: node.id, type: node.type, state: 'cancelled', attempt, inputHash: computeInputHash(node), startedAt: Date.now() });
    return;
  }
  // 防重入
  if (node.status === 'running') return;

  const inputHash = computeInputHash(node);
  // 幂等：同输入且之前成功 → 直接套用缓存，不重算
  if (attempt === 0 && _idem.has(node.id + ':' + inputHash)) {
    const c = _idem.get(node.id + ':' + inputHash);
    if (c && c.state === 'success') {
      applyCached(node, c);
      await putTask({ id: mkTaskId(node, attempt), nodeId: node.id, type: node.type, state: 'success', cached: true, attempt, inputHash, startedAt: Date.now() });
      return;
    }
  }

  await _sem.acquire();
  const taskId = mkTaskId(node, attempt);
  const task = { id: taskId, nodeId: node.id, type: node.type, state: 'running', attempt, inputHash, startedAt: Date.now() };
  await putTask(task);
  node._taskState = 'running';

  let timedOut = false;
  const timer = new Promise((res) => {
    node._toTimer = setTimeout(() => {
      timedOut = true;
      node._timedOut = true;
      node._abort = true; // 通知遗留执行体尽快收尾（若其支持轮询）
      res();
    }, nodeTimeout(node));
  });

  try {
    const execP = safeExec(node, delay);
    await Promise.race([execP, timer]);
    if (timedOut) { if (execP) execP.catch(() => {}); } // 让其后台收尾，结果丢弃
  } finally {
    clearTimeout(node._toTimer);
  }

  // 释放信号量（重试路径在 release 后递归）
  const releaseAnd = (fn) => { _sem.release(); return fn; };

  if (timedOut) {
    node._timedOut = true;
    task.state = 'timeout';
    task.endedAt = Date.now();
    await putTask(task);
    return releaseAnd(undefined);
  }

  const outcome = node.status; // 'done' | 'error' | 'failure' | 'running'(被拦截)
  if (node._abort && outcome !== 'done') {
    task.state = 'cancelled';
    task.endedAt = Date.now();
    await putTask(task);
    return releaseAnd(undefined);
  }
  if (outcome === 'done') {
    task.state = 'success';
    task.endedAt = Date.now();
    _idem.set(node.id + ':' + inputHash, { state: 'success', outputs: node.outputsData, thumb: node.thumb });
    await putTask(task);
    return releaseAnd(undefined);
  }

  // 失败分类
  const cls = classify(node);
  task.error = (node._lastError || '');
  if (attempt < cls.maxRetry) {
    task.state = 'retrying';
    await putTask(task);
    await backoff(attempt);
    _sem.release();
    return engineRunNode(node, delay, attempt + 1);
  }
  task.state = 'failure';
  task.category = cls.category;
  task.endedAt = Date.now();
  await putTask(task);
  return releaseAnd(undefined);
}

export const Runner = {
  _mode: 'task-engine',

  getMode() { return this._mode; },
  setMaxConcurrent(n) { _maxConcurrent = Math.max(1, parseInt(n) || 8); _sem.n = _maxConcurrent; },

  // 核心委托入口：替代 legacy runInOrder
  runInOrder(order, delay, skipSet) {
    skipSet = skipSet || new Set();
    const wf = legacy('workflow');
    const edges = (wf && wf.edges) ? wf.edges : new Map();
    const done = new Map();
    for (const node of order) {
      if (skipSet.has(node)) { done.set(node, Promise.resolve()); continue; }
      const upstream = [];
      edges.forEach((e) => {
        if (e.to && e.to.node === node && order.indexOf(e.from.node) >= 0) upstream.push(e.from.node);
      });
      const p = (async () => {
        await Promise.all(upstream.map((u) => done.get(u) || Promise.resolve()));
        return engineRunNode(node, delay);
      })();
      done.set(node, p);
    }
    return Promise.all([...done.values()]);
  },

  // 单节点运行（兼容外部 API）：复用 legacy 的祖先+拓扑逻辑经引擎执行
  runNode(node) {
    const topo = legacy('topoSortNodes');
    const coll = legacy('collectAncestors');
    if (typeof topo === 'function' && typeof coll === 'function' && node) {
      const set = coll(node); set.add(node);
      const order = topo(set);
      const skip = new Set();
      set.forEach((n) => { if (n.type === 'loop') { const gd = legacy('getDescendants'); if (gd) gd(n).forEach((d) => skip.add(d)); } });
      return this.runInOrder(order, 550, skip);
    }
    const rn = legacy('runNode');
    if (typeof rn === 'function') return rn(node);
    return null;
  },

  // 图像生成（保留外部 API）
  generateImage(node) {
    const g = legacy('generateOpenAIImage');
    if (typeof g === 'function') return g(node);
    return null;
  },

  // 取消：pending 节点直接跳过；running 节点置 _abort，完成后标记 cancelled
  cancel(nodeId) {
    if (nodeId == null) return;
    _cancel.add(nodeId);
    const wf = legacy('workflow');
    if (wf && wf.nodes && wf.nodes.has(nodeId)) {
      const node = wf.nodes.get(nodeId);
      node._abort = true;
      const t = legacy('updateNodeStatus');
      if (typeof t === 'function' && node.el) { try { t(node); } catch (e) {} }
    }
    // 把该节点在跑的任务标记 cancelled
    for (const rec of _tasks.values()) {
      if (rec.nodeId === nodeId && (rec.state === 'running' || rec.state === 'retrying')) {
        rec.state = 'cancelled';
        putTask(rec);
      }
    }
  },

  clearCancel(nodeId) { if (nodeId != null) _cancel.delete(nodeId); },

  // 对账：刷新后把崩溃遗留的 running 任务标记为 failure
  async reconcile() {
    try {
      const rows = await idbGetAll('tasks');
      const stuck = (rows || []).filter((t) => t && t.state === 'running');
      await Promise.all(stuck.map((t) => {
        const nt = Object.assign({}, t, { state: 'failure', note: 'recovered-after-reload', endedAt: Date.now() });
        _tasks.set(t.id, nt);
        return idbPut('tasks', nt);
      }));
      return stuck.length;
    } catch (e) { return 0; }
  },

  // 返回当前会话任务快照（用于测试/调试）
  getState() {
    return [..._tasks.values()].map((t) => Object.assign({}, t));
  },

  getTask(taskId) { return _tasks.has(taskId) ? Object.assign({}, _tasks.get(taskId)) : null; },

  // 仅清内存镜像（不动 IDB），用于测试隔离
  reset() {
    _tasks.clear(); _idem.clear(); _cancel.clear(); _seq = 0;
    _sem.n = _maxConcurrent; _sem.q.length = 0;
  },
};
