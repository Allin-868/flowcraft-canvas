// 阶段 0.5 / 1 — 兼容层入口
// 挂载存储 / 执行 / 节点 / 代理 / 费用 接口到 window.FlowCraft。
// 阶段 1：把全局存储函数重绑到 IndexedDB 实现（保留原函数行为 + 额外 IndexedDB 真源）。
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
window.FlowCraft.version = '3.3-indexeddb';

if (typeof console !== 'undefined') {
  console.log('[FlowCraft] 兼容层已挂载：storage=IndexedDB runner=' + Runner.getMode());
}

// —— 阶段 1：重绑全局存储函数 + 容量 UI + 启动迁移 ——
(function bootstrapStorage() {
  const S = StorageAdapter;
  if (typeof console !== 'undefined') console.log('[FlowCraft] 存储层：IndexedDB 模式启用');

  // 启动：localStorage -> IndexedDB 迁移（首次）
  S.migrateFromLocalStorage()
    .then((r) => { if (r && r.migrated) console.log('[FlowCraft] 已从 localStorage 迁移项目到 IndexedDB'); })
    .catch(() => {});
  // 申请持久化存储（降低浏览器自动清理概率）
  S.requestPersist().catch(() => {});

  _installCapacityUI();
  _updateCapacityUI();

  // 捕获原函数（保留其全部副作用）
  const _legacyDoAutosave = window.doAutosave;
  const _legacyRestore = window.restoreFromStorage;
  const _legacySaveNamed = window.saveNamedWorkflow;
  const _legacyLoadNamed = window.loadNamedWorkflow;
  const _legacyDeleteNamed = window.deleteNamedWorkflow;
  const _legacyPersistAsset = window.persistAssetMeta;

  if (typeof _legacyDoAutosave === 'function') {
    window.doAutosave = function () {
      try { _legacyDoAutosave(); } catch (e) { /* ignore */ }
      S.autosaveToIDB().catch(() => {});
      _updateCapacityUI();
    };
  }
  if (typeof _legacyRestore === 'function') {
    window.restoreFromStorage = function () {
      return S.restoreWithIDB(_legacyRestore);
    };
  }
  if (typeof _legacySaveNamed === 'function') {
    window.saveNamedWorkflow = function (name) {
      const id = S.saveAs(name);
      try { return _legacySaveNamed(name); } catch (e) { /* ignore */ }
      return id;
    };
  }
  if (typeof _legacyLoadNamed === 'function') {
    window.loadNamedWorkflow = function (id) {
      return S.open(id)
        .then((proj) => { if (proj && _legacyRestore) _legacyRestore(); return proj; })
        .catch(() => { try { return _legacyLoadNamed(id); } catch (e) { /* ignore */ } });
    };
  }
  if (typeof _legacyDeleteNamed === 'function') {
    window.deleteNamedWorkflow = function (id) {
      S._ensureIDB().then(() => { /* 多项目删除（本批保持 legacy 桥行为） */ }).catch(() => {});
      try { return _legacyDeleteNamed(id); } catch (e) { /* ignore */ }
    };
  }
  if (typeof _legacyPersistAsset === 'function') {
    window.persistAssetMeta = function (meta) {
      try { _legacyPersistAsset(meta); } catch (e) { /* ignore */ }
      if (meta && typeof meta === 'object') {
        S._ensureIDB().then(async () => {
          for (const k of Object.keys(meta)) {
            const m = meta[k];
            if (!m) continue;
            await S.upsertAsset({ id: k, ...m, updatedAt: new Date().toISOString() });
          }
        }).catch(() => {});
      }
    };
  }

  function _installCapacityUI() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('statCap')) return;
    const saveEl = document.getElementById('statSave');
    if (!saveEl || !saveEl.parentNode) return;
    const cap = document.createElement('span');
    cap.id = 'statCap';
    cap.style.marginLeft = '10px';
    cap.style.fontSize = '11px';
    cap.style.color = 'var(--text-2, #888)';
    cap.textContent = '容量 —';
    saveEl.parentNode.insertBefore(cap, saveEl.nextSibling);
  }

  function _updateCapacityUI() {
    const cap = (typeof document !== 'undefined') && document.getElementById('statCap');
    if (!cap) return;
    S.getCapacity().then((e) => {
      const used = (e.usage || 0) / 1048576;
      const quota = (e.quota || 0) / 1048576;
      if (quota > 0) cap.textContent = '本地库 ' + used.toFixed(1) + ' / ' + quota.toFixed(0) + ' MB';
      else cap.textContent = '本地库 ' + used.toFixed(1) + ' MB';
    }).catch(() => {});
  }
})();
