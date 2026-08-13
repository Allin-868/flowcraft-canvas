// 阶段 0.5 / 1 — 兼容层入口
// 挂载存储 / 执行 / 节点 / 代理 / 费用 接口到 window.FlowCraft。
// 阶段 1：把全局存储函数重绑到 IndexedDB 实现（保留原函数行为 + 额外 IndexedDB 真源）；
//        并注入多项目面板 UI（T1-3）与恢复点 UI（T1-5）。
import { StorageAdapter } from '../storage/storage.js';
import { Runner } from '../execution/runner.js';
import { NodeContract } from '../nodes/registry.js';
import { ProxyClient } from '../providers/proxy-client.js';
import { FeeModel } from '../providers/fee-model.js';

window.FlowCraft = window.FlowCraft || {};
window.FlowCraft.storage = StorageAdapter;
window.FlowCraft.runner = Runner;
window.FlowCraft.nodes = NodeContract;
window.FlowCraft.proxy = ProxyClient;
window.FlowCraft.fee = FeeModel;
window.FlowCraft.version = '3.7-e2e-sample';

// 阶段 4：代理启用（opt-in）。默认不启用 → legacy 回退直连（本地开发兼容）。
// 部署时由启动脚本注入 window.__FC_PROXY_BASE__ / window.__FC_PROXY_TOKEN__（短期用户令牌，非生产 Key）。
(function configureProxy() {
  var base = (typeof window !== 'undefined') && (window.__FC_PROXY_BASE__ || '');
  var token = (typeof window !== 'undefined') && (window.__FC_PROXY_TOKEN__ || '');
  if (base) {
    ProxyClient.configure({ base: base, token: token });
    window.FlowCraft.__userToken = token;
    console.log('[FlowCraft] API 代理已启用：' + base + '（浏览器不持有生产 Key）');
  } else {
    console.log('[FlowCraft] API 代理未启用（legacy 直连模式）');
  }
})();

if (typeof console !== 'undefined') {
  console.log('[FlowCraft] 兼容层已挂载：storage=IndexedDB runner=' + Runner.getMode());
}

// —— 小工具 ——
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { /* ignore */ }
}

// —— 阶段 1：重绑全局存储函数 + 容量 UI + 启动迁移 + 多项目/恢复点 UI ——
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
  const _origUpdateWorkflowPanel = window.updateWorkflowPanel;

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
      S.deleteProject(id).catch(() => {});
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

  // —— 阶段 3：启动对账（崩溃遗留 running 任务 → failure）——
  if (Runner && typeof Runner.reconcile === 'function') Runner.reconcile().catch(() => {});

  // —— T1-3：多项目面板（IndexedDB 驱动）——
  _installProjectPanelUI();
  // —— T1-5：恢复点 UI ——
  _installSnapshotUI();

  // ============ 内部函数 ============

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

  const EMPTY_WORKFLOW_HTML =
    '<div class="recycle-empty"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<path d="M2 4a2 2 0 012-2h3l2 2h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/></svg>' +
    '<div class="empty-text">暂无保存的项目<br>点击「保存当前为…」创建</div></div>';

  // 覆盖全局 updateWorkflowPanel：渲染 IndexedDB 多项目列表
  window.updateWorkflowPanel = function () {
    const list = document.getElementById('workflowList');
    const count = document.getElementById('workflowCount');
    if (!list) return;
    S.list().then((items) => {
      if (!items || items.length === 0) {
        if (S.getMode() === 'localStorage-legacy' && typeof _origUpdateWorkflowPanel === 'function') {
          _origUpdateWorkflowPanel(); // file:// 下降级 legacy localStorage 列表
        } else {
          list.innerHTML = EMPTY_WORKFLOW_HTML;
          if (count) count.textContent = '0';
        }
        return;
      }
      if (count) count.textContent = items.length;
      list.innerHTML = '';
      items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'wf-card';
        const date = new Date(item.savedAt).toLocaleString();
        card.innerHTML =
          '<div class="wf-card-main"><div class="wf-card-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</div>' +
          '<div class="wf-card-meta">' + escapeHtml(date) + '</div></div>' +
          '<div class="wf-card-actions">' +
          '<button class="wf-btn" data-act="open">打开</button>' +
          '<button class="wf-btn" data-act="export">导出</button>' +
          '<button class="wf-btn" data-act="rename">改名</button>' +
          '<button class="wf-btn danger" data-act="del">删除</button>' +
          '</div>';
        card.querySelectorAll('button').forEach((btn) => {
          btn.onclick = () => {
            const act = btn.dataset.act;
            if (act === 'open') {
              S.open(item.id).then((proj) => {
                if (proj && window.applyWorkflowData) {
                  window.applyWorkflowData(proj);
                  setTimeout(() => window.fitToContent && window.fitToContent(), 100);
                  window.refreshAssetPanelIfOpen && window.refreshAssetPanelIfOpen();
                  window.toggleWorkflowPanel && window.toggleWorkflowPanel(false);
                  window.showToast && window.showToast('已打开：' + item.name, 'success');
                } else if (window.showToast) window.showToast('打开失败', 'danger');
              }).catch(() => window.showToast && window.showToast('打开失败', 'danger'));
            } else if (act === 'export') {
              S.exportProject({ projectName: item.name }).then((blob) => {
                if (blob) downloadBlob(blob, (item.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + '.flowcraft');
                else window.showToast && window.showToast('导出失败（IndexedDB 不可用）', 'danger');
              }).catch(() => window.showToast && window.showToast('导出失败', 'danger'));
            } else if (act === 'rename') {
              const nn = window.prompt ? window.prompt('重命名项目', item.name) : null;
              if (nn && nn.trim()) S.renameProject(item.id, nn.trim()).then(() => window.updateWorkflowPanel());
            } else if (act === 'del') {
              if (window.confirm && window.confirm('确定删除项目「' + item.name + '」？此操作不可撤销。')) {
                S.deleteProject(item.id).then((ok) => { if (ok) window.updateWorkflowPanel(); });
              }
            }
          };
        });
        list.appendChild(card);
      });
    }).catch(() => { if (typeof _origUpdateWorkflowPanel === 'function') _origUpdateWorkflowPanel(); });
  };

  function _installProjectPanelUI() {
    if (typeof document === 'undefined') return;
    // 保存当前为…
    const saveBtn = document.getElementById('btnSaveWorkflow');
    if (saveBtn) saveBtn.onclick = () => {
      const n = window.prompt ? window.prompt('保存当前画布为项目：', '') : null;
      if (!n || !n.trim()) return;
      S.saveAs(n.trim()).then((id) => {
        if (id) { window.showToast && window.showToast('已保存项目：' + n.trim(), 'success'); window.updateWorkflowPanel(); }
        else window.showToast && window.showToast('保存失败（IndexedDB 不可用）', 'danger');
      }).catch(() => window.showToast && window.showToast('保存失败', 'danger'));
    };
    // 新建空白
    const newBtn = document.getElementById('btnNewWorkflow');
    if (newBtn) newBtn.onclick = () => {
      if (window.confirm && window.confirm('新建空白项目？当前画布未保存的内容将清空（建议先「保存当前为…」）。')) {
        S.newProject().then(() => {
          if (window.newWorkflow) window.newWorkflow();
          window.showToast && window.showToast('已新建空白项目', 'success');
          window.updateWorkflowPanel();
        });
      }
    };
    // 导入 .flowcraft（覆盖 legacy JSON 导入入口）
    const importInput = document.getElementById('importFileInput');
    if (importInput) {
      importInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const name = file.name || '';
        if (name.endsWith('.flowcraft') || name.endsWith('.zip')) {
          S.importProject(file).then((proj) => {
            if (proj && window.applyWorkflowData) {
              window.applyWorkflowData(proj);
              setTimeout(() => window.fitToContent && window.fitToContent(), 100);
              window.refreshAssetPanelIfOpen && window.refreshAssetPanelIfOpen();
              window.toggleWorkflowPanel && window.toggleWorkflowPanel(false);
              window.showToast && window.showToast('已导入项目：' + name, 'success');
            } else window.showToast && window.showToast('导入失败', 'danger');
          }).catch((err) => window.showToast && window.showToast('导入失败：' + (err && err.message || err), 'danger'));
        } else if (typeof window.importJSON === 'function') {
          window.importJSON(file);
        }
      };
    }
    // 打开面板时刷新恢复点列表
    const wfBtn = document.getElementById('btnWorkflow');
    if (wfBtn) wfBtn.addEventListener('click', () => setTimeout(_renderSnapshots, 0));
  }

  function _installSnapshotUI() {
    if (typeof document === 'undefined') return;
    const list = document.getElementById('workflowList');
    if (!list || document.getElementById('snapshotBlock')) return;
    // 注入少量样式
    const style = document.createElement('style');
    style.textContent =
      '.wf-snapshot-block{margin:10px 0 4px;border-top:1px solid var(--border,#2a2f3a);padding-top:10px}' +
      '.wf-snapshot-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}' +
      '.wf-snapshot-title{font-size:12px;color:var(--text-2,#9aa3b2);font-weight:600}';
    document.head.appendChild(style);
    const block = document.createElement('div');
    block.id = 'snapshotBlock';
    block.className = 'wf-snapshot-block';
    block.innerHTML =
      '<div class="wf-snapshot-head"><span class="wf-snapshot-title">恢复点（自动保留最近 20 个）</span>' +
      '<button class="ra-btn" id="btnSnapshotSave" title="保存当前画布为恢复点">💾 保存恢复点</button></div>' +
      '<div class="recycle-list" id="snapshotList"></div>';
    list.parentNode.insertBefore(block, list);
    const saveSnap = document.getElementById('btnSnapshotSave');
    if (saveSnap) saveSnap.onclick = () => {
      const label = window.prompt ? window.prompt('恢复点备注（可选）：', '') : '';
      S.snapshot(label || '').then((id) => {
        if (id) { window.showToast && window.showToast('已保存恢复点', 'success'); _renderSnapshots(); }
        else window.showToast && window.showToast('恢复点保存失败（IndexedDB 不可用）', 'danger');
      }).catch(() => window.showToast && window.showToast('保存恢复点失败', 'danger'));
    };
    _renderSnapshots();
  }

  function _renderSnapshots() {
    const el = document.getElementById('snapshotList');
    if (!el) return;
    S.listSnapshots().then((rows) => {
      if (!rows || rows.length === 0) {
        el.innerHTML = '<div class="recycle-empty"><div class="empty-text">暂无恢复点<br>点击「保存恢复点」可随时回退</div></div>';
        return;
      }
      el.innerHTML = '';
      rows.forEach((s) => {
        const card = document.createElement('div');
        card.className = 'wf-card';
        const date = new Date(s.createdAt).toLocaleString();
        const label = s.label ? escapeHtml(s.label) : '';
        card.innerHTML =
          '<div class="wf-card-main"><div class="wf-card-name" title="' + label + '">' + (label || '恢复点') + '</div>' +
          '<div class="wf-card-meta">' + escapeHtml(date) + '</div></div>' +
          '<div class="wf-card-actions">' +
          '<button class="wf-btn" data-act="restore">还原</button>' +
          '<button class="wf-btn" data-act="keep">永久</button>' +
          '<button class="wf-btn danger" data-act="del">删除</button>' +
          '</div>';
        card.querySelectorAll('button').forEach((btn) => {
          btn.onclick = () => {
            const act = btn.dataset.act;
            if (act === 'restore') {
              S.restoreSnapshot(s.id).then((proj) => {
                if (proj && window.applyWorkflowData) {
                  window.applyWorkflowData(proj);
                  setTimeout(() => window.fitToContent && window.fitToContent(), 100);
                  window.toggleWorkflowPanel && window.toggleWorkflowPanel(false);
                  window.showToast && window.showToast('已还原恢复点', 'success');
                } else window.showToast && window.showToast('还原失败', 'danger');
              }).catch(() => window.showToast && window.showToast('还原失败', 'danger'));
            } else if (act === 'keep') {
              const cur = (s.label || '').indexOf('[永久]') >= 0
                ? (s.label || '').replace('[永久]', '').replace(/\s+/g, ' ').trim()
                : '[永久] ' + (s.label || '恢复点');
              S.renameSnapshot(s.id, cur).then(() => _renderSnapshots());
            } else if (act === 'del') {
              if (window.confirm && window.confirm('删除该恢复点？')) {
                S.deleteSnapshot(s.id).then(() => _renderSnapshots());
              }
            }
          };
        });
        el.appendChild(card);
      });
    }).catch(() => { el.innerHTML = ''; });
  }
})();

// —— 阶段 2：T2-5 节点数据规范 UI ——
// 为 tier='stub'（未实现）节点显式加「未实现」徽标，提示用户该节点尚不可运行。
(function bootstrapNodeContractUI() {
  if (typeof document === 'undefined') return;
  // 注入徽标样式
  const style = document.createElement('style');
  style.textContent =
    '.node-stub-badge{position:absolute;top:6px;right:6px;background:#7a1f1f;color:#ffd9d9;' +
    'font-size:10px;line-height:1.4;padding:2px 7px;border-radius:7px;z-index:6;pointer-events:none;' +
    'box-shadow:0 1px 3px rgba(0,0,0,.4);max-width:70%;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  document.head.appendChild(style);

  if (typeof window.buildNodeBody === 'function') {
    const _origBuildNodeBody = window.buildNodeBody;
    window.buildNodeBody = function (el, node) {
      _origBuildNodeBody(el, node);
      const meta = (window.FlowCraft && window.FlowCraft.nodes && window.FlowCraft.nodes.getNodeMeta)
        ? window.FlowCraft.nodes.getNodeMeta(node && node.type) : null;
      if (meta && meta.tier === 'stub' && el) {
        if (!el.querySelector('.node-stub-badge')) {
          const b = document.createElement('div');
          b.className = 'node-stub-badge';
          b.textContent = '⚠ 未实现 · ' + (meta.note || '演示态');
          el.appendChild(b);
        }
      }
    };
  }
  if (typeof console !== 'undefined') console.log('[FlowCraft] 节点数据规范 UI 已挂载（stub 徽标）');
})();
