// 阶段 0.5 / 1 — 兼容层入口
// 挂载存储 / 执行 / 节点 / 代理 / 费用 接口到 window.FlowCraft。
// 阶段 1：把全局存储函数重绑到 IndexedDB 实现（保留原函数行为 + 额外 IndexedDB 真源）；
//        并注入多项目面板 UI（T1-3）与恢复点 UI（T1-5）。
import { StorageAdapter } from '../storage/storage.js';
import { Runner } from '../execution/runner.js';
import { NodeContract } from '../nodes/registry.js';
import { ProxyClient, ProxyError } from '../providers/proxy-client.js';
import { FeeModel } from '../providers/fee-model.js';
import { ModelRegistry, ModelRouter, ModelHealth } from '../providers/model-router.js';
import { COMFY_TEMPLATES, listTemplates, getTemplate, parseWorkflow, applyFormValues, importWorkflow, exportWorkflow } from '../providers/comfyui-workflow.js';

window.FlowCraft = window.FlowCraft || {};
window.FlowCraft.storage = StorageAdapter;
window.FlowCraft.runner = Runner;
window.FlowCraft.nodes = NodeContract;
window.FlowCraft.proxy = ProxyClient;
window.ProxyError = ProxyError;
window.FlowCraft.fee = FeeModel;
window.FlowCraft.models = ModelRegistry.init();
window.FlowCraft.router = ModelRouter.init();
window.FlowCraft.health = ModelHealth.init();
// 版本单一真源 = package.json，由 build.mjs 经 esbuild define 注入 __FLOWCRAFT_VERSION__。
// typeof 守卫保证本文件脱离打包（如 node --check / 直接 import）时也不抛 ReferenceError。
window.FlowCraft.version = (typeof __FLOWCRAFT_VERSION__ !== 'undefined') ? __FLOWCRAFT_VERSION__ : '3.11-comfyui';

/**
 * 在左侧 sidebar 底部创建一个可折叠的「高级设置」分组，并返回其 body 容器。
 * 两个高级功能入口（模型路由 / ComfyUI 工作流）作为条目追加到该 body 中，
 * 从而不再以固定定位悬浮在左下角、遮挡主节点列表；sidebar 折叠时仍以图标模式可见。
 * 幂等：已存在则直接返回现有 body。
 */
function ensureFcAdvancedFooter() {
  const existing = document.getElementById('fcAdvancedBody');
  if (existing) return existing;
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return null;
  const group = document.createElement('div');
  group.id = 'fcAdvanced';
  group.className = 'fc-advanced';
  group.innerHTML =
    '<button type="button" id="fcAdvancedToggle" title="高级设置">' +
    '<span class="fc-adv-ico">⚙</span>' +
    '<span class="fc-adv-label">高级设置</span>' +
    '<span class="fc-adv-caret">▾</span></button>' +
    '<div class="fc-advanced-body" id="fcAdvancedBody"></div>';
  sidebar.appendChild(group);
  const header = group.querySelector('#fcAdvancedToggle');
  header.addEventListener('click', () => {
    const collapsed = group.classList.toggle('collapsed');
    const body = group.querySelector('#fcAdvancedBody');
    if (body) body.hidden = collapsed;
  });
  return group.querySelector('#fcAdvancedBody');
}

// 阶段 4：代理启用（opt-in）。默认不启用 → legacy 回退直连（本地开发兼容）。
// 部署时由启动脚本注入 window.__FC_PROXY_BASE__ / window.__FC_PROXY_TOKEN__（短期用户令牌，非生产 Key）。
(function configureProxy() {
  var base = (typeof window !== 'undefined') && (window.__FC_PROXY_BASE__ || '');
  var token = (typeof window !== 'undefined') && (window.__FC_PROXY_TOKEN__ || '');
  if (!base && typeof localStorage !== 'undefined') {
    try {
      base = localStorage.getItem('flowcraft-proxy-base') || '';
      token = token || localStorage.getItem('flowcraft-proxy-token') || '';
    } catch (_) {}
  }
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

function setStorageSaveStatus(text, kind, detail) {
  const el = typeof document !== 'undefined' && document.getElementById('statSave');
  if (!el) return;
  el.textContent = text;
  el.title = detail || text;
  el.dataset.saveKind = kind || '';
  el.style.color = kind === 'err' ? 'var(--color-danger)' : kind === 'warn' ? 'var(--color-warn)' : kind === 'pending' ? 'var(--accent, #8B5CF6)' : 'var(--text-2)';
}

function installSaveBackupButton() {
  if (typeof document === 'undefined' || document.getElementById('fcSaveBackup')) return;
  const status = document.getElementById('statSave');
  if (!status || !status.parentNode) return;
  const btn = document.createElement('button');
  btn.id = 'fcSaveBackup';
  btn.type = 'button';
  btn.textContent = '导出备份';
  btn.title = '导出当前画布 .flowcraft 备份';
  btn.hidden = true;
  btn.className = 'wf-btn';
  btn.style.marginLeft = '6px';
  btn.onclick = () => {
    btn.disabled = true;
    StorageAdapter.exportProject({ projectName: 'FlowCraft-自动备份' })
      .then((blob) => {
        if (!blob) throw new Error('当前画布没有可导出的内容');
        downloadBlob(blob, 'FlowCraft-自动备份.flowcraft');
        window.showToast && window.showToast('已导出当前画布备份', 'success');
      })
      .catch((e) => window.showToast && window.showToast('备份导出失败：' + (e.message || e), 'danger'))
      .finally(() => { btn.disabled = false; });
  };
  status.parentNode.appendChild(btn);
  const retry = document.createElement('button');
  retry.id = 'fcSaveRetry';
  retry.type = 'button';
  retry.textContent = '重试保存';
  retry.title = '重新写入本地项目库';
  retry.hidden = true;
  retry.className = 'wf-btn';
  retry.style.marginLeft = '4px';
  retry.onclick = () => {
    retry.disabled = true;
    setStorageSaveStatus('保存中', 'pending');
    StorageAdapter.autosaveToIDB()
      .then((result) => applyStorageSaveResult(result, { liteSaved: true, stripped: false }))
      .finally(() => { retry.disabled = false; });
  };
  status.parentNode.appendChild(retry);
}

function applyStorageSaveResult(result, legacyResult) {
  const lite = !!(legacyResult && legacyResult.liteSaved);
  if (result && result.ok) {
    const suffix = result.mode === 'indexeddb' && legacyResult && legacyResult.stripped ? '（大图已入本地库）' : '';
    const liteWarning = legacyResult && legacyResult.liteSaved === false;
    const warning = liteWarning ? '（本地轻量兜底失败）' : suffix;
    setStorageSaveStatus('已保存' + warning, (warning ? 'warn' : 'ok'), '完整版已写入 IndexedDB：' + result.savedAt + (liteWarning ? '；localStorage 兜底不可用' : ''));
    const backup = document.getElementById('fcSaveBackup'); if (backup) backup.hidden = !liteWarning;
    const retry = document.getElementById('fcSaveRetry'); if (retry) retry.hidden = !liteWarning;
    return;
  }
  const message = (result && result.errorMessage) || '本地存储不可用';
  setStorageSaveStatus(lite ? '轻量备份已保存 · 完整版失败' : '保存失败', lite ? 'warn' : 'err', message);
  const backup = document.getElementById('fcSaveBackup'); if (backup) backup.hidden = false;
  const retry = document.getElementById('fcSaveRetry'); if (retry) retry.hidden = false;
  if (window.showToast) window.showToast((lite ? '完整项目保存失败：' : '自动保存失败：') + message + '。可导出备份或重试。', lite ? 'warn' : 'danger', 6000);
}

// —— 阶段 1：重绑全局存储函数 + 容量 UI + 启动迁移 + 多项目/恢复点 UI ——
(function bootstrapStorage() {
  const S = StorageAdapter;
  if (typeof console !== 'undefined') console.log('[FlowCraft] 存储层：IndexedDB 模式启用');

  // 启动：localStorage -> IndexedDB 迁移（首次）
  // 兼容层在 legacy 初始化之后才挂载；因此不能只重绑 restoreFromStorage，
  // 否则首次启动已经走完 legacy 的“示例节点”分支，刷新时不会主动读取 projects 真源。
  // 先完成迁移，再用当前 activeProjectId 从 IndexedDB 回灌一次，避免刷新后回到初始画布。
  const startupCanvasSignature = () => {
    const wf = window.FlowCraft && window.FlowCraft._legacy && window.FlowCraft._legacy.workflow;
    if (!wf || !wf.nodes || !wf.edges) return '';
    // 不把完整图片 dataURL 放入签名；但要覆盖位置、尺寸、标题、提示词、
    // 参数和媒体长度，避免用户只改参数时仍被延迟恢复覆盖。
    const compact = [...wf.nodes.values()].map(n => ({
      id: n.id, type: n.type, x: n.x, y: n.y, width: n.width, height: n.height,
      title: n.title, prompt: n.prompt, status: n.status,
      params: n.params || {}, thumb: typeof n.thumb === 'string' ? n.thumb.length : 0,
    })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return JSON.stringify({ nodes: compact, edges: [...wf.edges.values()].map(e => [e.id, e.fromNodeId, e.toNodeId, e.fromPort, e.toPort]).sort() });
  };
  const initialCanvasSignature = startupCanvasSignature();
  S.migrateFromLocalStorage()
    .then((r) => {
      if (r && r.migrated) console.log('[FlowCraft] 已从 localStorage 迁移项目到 IndexedDB');
      // 异步恢复期间若用户已经编辑，保留当前现场，避免旧结果覆盖新操作。
      if (startupCanvasSignature() !== initialCanvasSignature) {
        console.warn('[FlowCraft] 启动恢复跳过：画布已在恢复完成前被改动');
        return null;
      }
      return S.restoreWithIDB(() => {
        // loadFromIDB 仍是异步的，必须在真正 apply 前再次检查，防止测试或用户
        // 在读取期间已经清空/编辑画布。
        if (startupCanvasSignature() !== initialCanvasSignature) {
          console.warn('[FlowCraft] 启动恢复跳过：数据读取期间画布已被改动');
          return false;
        }
        return _legacyRestore();
      });
    })
    .then((restoredProject) => {
      if (!restoredProject) return;
      // restoreWithIDB 已完成数据回灌；这里仅补齐启动后的视图状态，不改任何节点视觉。
      if (typeof window.updateStatusbar === 'function') window.updateStatusbar();
      if (typeof window.updateRecycleUI === 'function') window.updateRecycleUI();
      if (typeof window.updateUndoRedoButtons === 'function') window.updateUndoRedoButtons();
      if (typeof window.applyTransform === 'function') window.applyTransform();
      if (typeof window.markEdgesDirty === 'function') window.markEdgesDirty();
      console.log('[FlowCraft] 已从 IndexedDB 恢复当前画布');
    })
    .catch((error) => console.warn('[FlowCraft] 启动恢复失败：', error && error.message || error));
  // 申请持久化存储（降低浏览器自动清理概率）
  S.requestPersist().catch(() => {});

  _installCapacityUI();
  installSaveBackupButton();
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
      setStorageSaveStatus('保存中', 'pending');
      let legacyResult = null;
      try { legacyResult = _legacyDoAutosave && _legacyDoAutosave(); } catch (e) { legacyResult = { liteSaved: false, error: e }; }
      S.autosaveToIDB()
        .then((result) => applyStorageSaveResult(result, legacyResult))
        .catch((e) => applyStorageSaveResult({ ok: false, errorCode: 'STORAGE_FAILED', errorMessage: e.message || String(e) }, legacyResult));
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

// —— 阶段 9：多模型路由设置面板（浮动，opt-in，默认隐藏）——
// 仅维护模型清单（provider + model id + 能力 + 评分），不含任何 Key；
// 真实 Key 由代理环境变量统一管理。文本/生图经 FlowCraft.router 选模型后透传给代理。
(function bootstrapMultiModel() {
  if (typeof document === 'undefined') return;
  const Reg = window.FlowCraft.models;
  const Router = window.FlowCraft.router;
  const Health = window.FlowCraft.health;

  const style = document.createElement('style');
  style.textContent =
    /* 高级设置分组：置于左侧 sidebar 底部、可折叠，不遮挡主节点列表 */
    '#fcAdvanced{position:relative;flex-shrink:0;display:flex;flex-direction:column;' +
    'border-top:1px solid var(--border-default,#2a2f3a);background:var(--bg-panel,#1b1f27);' +
    'padding:6px 8px;gap:4px;z-index:6}' +
    '#fcAdvancedToggle{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;' +
    'background:transparent;border:none;color:var(--text-2,#9aa3b2);cursor:pointer;' +
    'font-size:12px;padding:6px;border-radius:8px;text-align:left}' +
    '#fcAdvancedToggle:hover{background:var(--bg-button,#23272f);color:var(--text-1,#e8ebf0)}' +
    '#fcAdvancedToggle .fc-adv-ico{font-size:14px;line-height:1}' +
    '#fcAdvancedToggle .fc-adv-label{flex:1;font-weight:600;letter-spacing:.3px}' +
    '#fcAdvancedToggle .fc-adv-caret{transition:transform .2s ease}' +
    '#fcAdvanced.collapsed .fc-adv-caret{transform:rotate(-90deg)}' +
    '#fcAdvancedBody{display:flex;flex-direction:column;gap:4px}' +
    '#fcAdvancedBody[hidden]{display:none}' +
    /* 两个高级入口：作为 sidebar 底部条目（替代原先固定在左下角的浮动按钮）*/
    '#fcMrToggle,#fcCwToggle{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;' +
    'border:none;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;text-align:left;' +
    'color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}' +
    '#fcMrToggle{background:var(--color-primary,#4f8cff)}' +
    '#fcMrToggle:hover{filter:brightness(1.08)}' +
    '#fcCwToggle{background:var(--accent,#8B5CF6)}' +
    '#fcCwToggle:hover{filter:brightness(1.08)}' +
    '.sidebar.collapsed #fcAdvancedToggle .fc-adv-label,' +
    '.sidebar.collapsed #fcAdvancedToggle .fc-adv-caret{display:none}' +
    '.sidebar.collapsed #fcAdvancedToggle{justify-content:center;padding:6px}' +
    '.sidebar.collapsed #fcMrToggle .fc-label,' +
    '.sidebar.collapsed #fcCwToggle .fc-label{display:none}' +
    '.sidebar.collapsed #fcMrToggle,' +
    '.sidebar.collapsed #fcCwToggle{justify-content:center;padding:7px 0}' +
    /* 面板：弹出在 sidebar 右侧、状态栏上方，不再遮挡左侧列表 */
    '#fcMrPanel{position:fixed;left:232px;bottom:36px;z-index:61;width:320px;max-height:72vh;overflow:auto;' +
    'background:var(--panel,#1b1f27);color:var(--text,#e8ebf0);border:1px solid var(--border,#2a2f3a);border-radius:12px;' +
    'padding:14px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);display:none}' +
    '#fcMrPanel h3{margin:0 0 8px;font-size:13px;display:flex;justify-content:space-between;align-items:center}' +
    '#fcMrPanel .fc-row{display:flex;align-items:center;gap:8px;margin:6px 0}' +
    '#fcMrPanel .fc-muted{color:var(--text-2,#9aa3b2);font-size:11px;margin:4px 0 10px}' +
    '#fcMrList .fc-m{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;border:1px solid var(--border,#2a2f3a);border-radius:8px;margin:5px 0}' +
    '#fcMrList .fc-m .fc-meta{display:flex;flex-direction:column}' +
    '#fcMrList .fc-m .fc-name{font-weight:600}' +
    '#fcMrList .fc-m .fc-cap{font-size:10px;color:var(--text-2,#9aa3b2)}' +
    '#fcMrList .fc-m button{font-size:11px;padding:2px 7px;cursor:pointer}' +
    '#fcMrHealth .fc-h{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border,#2a2f3a)}' +
    '.fc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}' +
    '.fc-dot.ok{background:#3ec97a}.fc-dot.degraded{background:#e0a93e}.fc-dot.down{background:#e15353}.fc-dot.unknown{background:#888}';
  document.head.appendChild(style);

  const toggle = document.createElement('button');
  toggle.id = 'fcMrToggle';
  toggle.innerHTML = '<span class="fc-ico">🧭</span><span class="fc-label">模型路由</span>';
  const advBody = ensureFcAdvancedFooter();
  if (advBody) advBody.appendChild(toggle);

  const panel = document.createElement('div');
  panel.id = 'fcMrPanel';
  panel.innerHTML =
    '<h3>模型路由 <span style="font-size:11px;cursor:pointer" id="fcMrClose">✕</span></h3>' +
    '<div class="fc-row"><label><input type="checkbox" id="fcMrEnabled"> 启用智能路由（覆盖 AI 助手模型选择）</label></div>' +
    '<div class="fc-row">策略：' +
    '<label><input type="radio" name="fcMrStrat" value="quality" checked> 质量</label>' +
    '<label><input type="radio" name="fcMrStrat" value="cost"> 成本</label>' +
    '<label><input type="radio" name="fcMrStrat" value="speed"> 速度</label></div>' +
    '<div class="fc-muted">前端仅选模型，不持有任何 Key；真实 Key 由代理环境变量管理。</div>' +
    '<div id="fcMrList"></div>' +
    '<div class="fc-row"><button class="ra-btn" id="fcMrAdd">+ 添加模型</button>' +
    '<button class="ra-btn" id="fcMrReset">恢复默认</button></div>' +
    '<h3 style="margin-top:12px">健康监控</h3><div id="fcMrHealth"></div>';

  document.body.appendChild(panel);

  function render() {
    const enabled = Router.enabled();
    document.getElementById('fcMrEnabled').checked = enabled;
    const strat = Router.strategy();
    panel.querySelectorAll('input[name=fcMrStrat]').forEach((r) => { r.checked = (r.value === strat); });
    const list = document.getElementById('fcMrList');
    list.innerHTML = '';
    Reg.list().forEach((m) => {
      const row = document.createElement('div');
      row.className = 'fc-m';
      row.innerHTML =
        '<div class="fc-meta"><span class="fc-name">' + escapeHtml(m.label) + '</span>' +
        '<span class="fc-cap">' + escapeHtml(m.provider + ' / ' + m.model) + ' · ' + (m.capabilities || []).join(',') + '</span></div>';
      const ctl = document.createElement('div');
      const en = document.createElement('input');
      en.type = 'checkbox'; en.checked = m.enabled; en.title = '启用';
      en.onchange = () => { Reg.setEnabled(m.id, en.checked); render(); };
      const del = document.createElement('button'); del.textContent = '删';
      del.onclick = () => { if (window.confirm && window.confirm('删除模型 ' + m.label + '？')) { Reg.remove(m.id); render(); } };
      ctl.appendChild(en); ctl.appendChild(del);
      row.appendChild(ctl);
      list.appendChild(row);
    });
    const h = document.getElementById('fcMrHealth');
    const all = Health.all();
    const ids = Object.keys(all);
    if (!ids.length) { h.innerHTML = '<div class="fc-muted">暂无调用记录</div>'; return; }
    h.innerHTML = '';
    ids.forEach((id) => {
      const s = all[id];
      const row = document.createElement('div');
      row.className = 'fc-h';
      const rate = s.successRate == null ? '—' : (s.successRate * 100).toFixed(0) + '%';
      const avg = s.avgMs == null ? '—' : s.avgMs + 'ms';
      row.innerHTML = '<span><span class="fc-dot ' + s.status + '"></span>' + escapeHtml(id) + '</span>' +
        '<span>成功率 ' + rate + ' · 均耗时 ' + avg + '</span>';
      h.appendChild(row);
    });
  }

  toggle.onclick = () => { panel.style.display = (panel.style.display === 'block') ? 'none' : 'block'; if (panel.style.display === 'block') render(); };
  document.getElementById('fcMrClose').onclick = () => { panel.style.display = 'none'; };
  document.getElementById('fcMrEnabled').onchange = (e) => { Router.setEnabled(e.target.checked); render(); };
  panel.querySelectorAll('input[name=fcMrStrat]').forEach((r) => { r.onchange = () => { if (r.checked) { Router.setStrategy(r.value); render(); } }; });
  document.getElementById('fcMrAdd').onclick = () => {
    const provider = window.prompt ? window.prompt('Provider（openai/deepseek/anthropic/google/xai）', 'openai') : 'openai';
    if (!provider) return;
    const model = window.prompt ? window.prompt('模型 ID（如 gpt-4o、claude-3-5-sonnet-20241022）', '') : '';
    if (!model) return;
    const label = window.prompt ? window.prompt('显示名（可选）', model) : model;
    const cap = window.prompt ? window.prompt('能力（逗号分隔：text/image/video）', 'text') : 'text';
    Reg.add({ provider: provider.trim(), model: model.trim(), label: (label || model).trim(), capabilities: String(cap || 'text').split(',').map((s) => s.trim()).filter(Boolean), enabled: true });
    render();
  };
  document.getElementById('fcMrReset').onclick = () => { if (window.confirm && window.confirm('恢复默认模型清单？当前改动将丢失。')) { Reg.reset(); render(); } };

  if (typeof console !== 'undefined') console.log('[FlowCraft] 多模型路由 UI 已挂载（opt-in）');
})();

// 阶段 9.2 — ComfyUI 工作流编辑器面板（opt-in，浮动）
(function mountComfyUIWorkflowEditor() {
  if (!window.FlowCraft.comfyui) return;
  const Cw = window.FlowCraft.comfyui;

  let currentNode = null;
  let currentJson = '';

  const style = document.createElement('style');
  style.textContent =
    /* 面板：弹出在 sidebar 右侧、状态栏上方（入口已移入左侧 sidebar 高级分组）*/
    '#fcCwPanel{position:fixed;left:232px;bottom:36px;z-index:61;width:360px;max-height:78vh;overflow:auto;' +
    'background:var(--panel,#1b1f27);color:var(--text,#e8ebf0);border:1px solid var(--border,#2a2f3a);border-radius:12px;' +
    'padding:14px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);display:none}' +
    '#fcCwPanel h3{margin:0 0 8px;font-size:13px;display:flex;justify-content:space-between;align-items:center}' +
    '#fcCwPanel textarea{width:100%;box-sizing:border-box;min-height:120px;font-family:monospace;font-size:11px;' +
    'background:#11141a;color:#cfe3ff;border:1px solid var(--border,#2a2f3a);border-radius:8px;padding:8px}' +
    '#fcCwForm .fcw-f{display:flex;align-items:center;gap:8px;margin:5px 0}' +
    '#fcCwForm .fcw-f label{flex:1;font-size:11px;color:var(--text-2,#9aa3b2)}' +
    '#fcCwForm .fcw-f input{flex:1;max-width:170px;background:#11141a;color:#e8ebf0;border:1px solid var(--border,#2a2f3a);border-radius:6px;padding:4px 6px}' +
    '#fcCwForm .fcw-node{margin:8px 0;padding:6px 8px;border:1px dashed var(--border,#2a2f3a);border-radius:8px}' +
    '#fcCwForm .fcw-node .fcw-title{font-weight:600;font-size:11px;margin-bottom:4px}' +
    '.fcw-err{color:#e15353;font-size:11px;margin:6px 0}' +
    '.fcw-muted{color:var(--text-2,#9aa3b2);font-size:11px;margin:4px 0}';
  document.head.appendChild(style);

  const toggle = document.createElement('button');
  toggle.id = 'fcCwToggle';
  toggle.innerHTML = '<span class="fc-ico">🎛</span><span class="fc-label">ComfyUI 工作流</span>';
  const advBody = ensureFcAdvancedFooter();
  if (advBody) advBody.appendChild(toggle);

  const panel = document.createElement('div');
  panel.id = 'fcCwPanel';
  panel.innerHTML =
    '<h3>ComfyUI 工作流 <span style="font-size:11px;cursor:pointer" id="fcCwClose">✕</span></h3>' +
    '<div class="fc-row"><label>模板：<select id="fcCwTpl"></select></label></div>' +
    '<div id="fcCwForm"></div>' +
    '<div class="fc-row" style="margin-top:8px"><button class="ra-btn" id="fcCwImport">导入文件</button>' +
    '<button class="ra-btn" id="fcCwExport">导出 JSON</button>' +
    '<button class="ra-btn" id="fcCwApply">应用到节点</button></div>' +
    '<div id="fcCwErr" class="fcw-err"></div>' +
    '<textarea id="fcCwJson" placeholder="标准 ComfyUI API 格式 JSON"></textarea>' +
    '<div class="fcw-muted">编辑模板/表单/JSON 任一处即同步；应用后写入节点 customJson（runComfyUINode 优先使用）。</div>';
  document.body.appendChild(panel);

  const tplSel = panel.querySelector('#fcCwTpl');
  const formBox = panel.querySelector('#fcCwForm');
  const jsonTa = panel.querySelector('#fcCwJson');
  const errBox = panel.querySelector('#fcCwErr');
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = '.json,application/json'; fileInput.style.display = 'none';
  panel.appendChild(fileInput);

  listTemplates().forEach((t) => {
    const o = document.createElement('option'); o.value = t.id; o.textContent = t.label; tplSel.appendChild(o);
  });

  function setJson(str) { currentJson = str; jsonTa.value = str; errBox.textContent = ''; renderForm(); }
  // 中文化：ComfyUI 类名 / 输入字段名 → 中文（未命中回退原文；原文保留在 title 提示供高级用户对照）
  const FCW_CLASS_CN = {
    KSampler: '采样器', CheckpointLoaderSimple: '载入模型', EmptyLatentImage: '空白潜空间',
    CLIPTextEncode: '提示词编码', VAEDecode: 'VAE 解码', VAEEncode: 'VAE 编码', VAELoader: '载入 VAE',
    SaveImage: '保存图像', LoadImage: '载入图像', ImageScaleBy: '按比例放大',
    ControlNetLoader: '载入 ControlNet', ControlNetApply: '应用 ControlNet', LoraLoader: '载入 LoRA',
  };
  const FCW_FIELD_CN = {
    seed: '种子', steps: '采样步数', cfg: 'CFG 权重', sampler_name: '采样器', scheduler: '调度器',
    denoise: '降噪强度', ckpt_name: '模型文件', width: '宽', height: '高', batch_size: '批量',
    text: '提示词', image: '图像', vae_name: 'VAE 文件', scale_by: '放大倍数', method: '插值方法',
    control_net_name: 'ControlNet 文件', strength: '强度', lora_name: 'LoRA 文件',
    strength_model: '模型强度', strength_clip: 'CLIP 强度',
  };
  function renderForm() {
    formBox.innerHTML = '';
    let parsed;
    try { parsed = parseWorkflow(currentJson); }
    catch (e) { errBox.textContent = 'JSON 解析失败：' + e.message; return; }
    parsed.nodes.forEach((nd) => {
      const box = document.createElement('div'); box.className = 'fcw-node';
      const title = document.createElement('div'); title.className = 'fcw-title';
      title.textContent = nd.id + ' · ' + (FCW_CLASS_CN[nd.class_type] || nd.class_type);
      title.title = nd.class_type; box.appendChild(title);
      nd.fields.forEach((f) => {
        const row = document.createElement('div'); row.className = 'fcw-f';
        const lab = document.createElement('label'); lab.textContent = FCW_FIELD_CN[f.name] || f.name; lab.title = f.name; row.appendChild(lab);
        const inp = document.createElement('input');
        inp.type = (f.type === 'number') ? 'number' : 'text';
        inp.value = (f.value == null) ? '' : f.value;
        inp.oninput = (ev) => {
          let v = ev.target.value;
          if (f.type === 'number') v = (v === '' ? 0 : Number(v));
          try {
            currentJson = exportWorkflow(applyFormValues(currentJson, { [nd.id]: { [f.name]: v } }));
            jsonTa.value = currentJson; errBox.textContent = '';
          } catch (e2) { errBox.textContent = e2.message; }
        };
        inp.onmousedown = (ev) => ev.stopPropagation();
        row.appendChild(inp); box.appendChild(row);
      });
      formBox.appendChild(box);
    });
  }

  tplSel.onchange = () => { const wf = getTemplate(tplSel.value); if (wf) setJson(exportWorkflow(wf)); };
  jsonTa.oninput = () => { currentJson = jsonTa.value; renderForm(); };
  jsonTa.onmousedown = (e) => e.stopPropagation();
  panel.querySelector('#fcCwClose').onclick = () => { panel.style.display = 'none'; };
  toggle.onclick = () => { panel.style.display = (panel.style.display === 'block') ? 'none' : 'block'; };

  panel.querySelector('#fcCwImport').onclick = () => { fileInput.click(); };
  fileInput.onchange = () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { setJson(exportWorkflow(importWorkflow(String(reader.result)))); }
      catch (e) { errBox.textContent = '导入失败：' + e.message; }
    };
    reader.readAsText(file);
    fileInput.value = '';
  };
  panel.querySelector('#fcCwExport').onclick = () => {
    try {
      const text = exportWorkflow(importWorkflow(currentJson));
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'comfyui-workflow.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { errBox.textContent = '导出失败：' + e.message; }
  };
  panel.querySelector('#fcCwApply').onclick = () => {
    try {
      const obj = importWorkflow(currentJson);
      if (!currentNode) { errBox.textContent = '未选中节点：请点击画布上 ComfyUI 节点的「工作流编辑器」按钮打开。'; return; }
      currentNode.params = currentNode.params || {};
      currentNode.params.customJson = exportWorkflow(obj);
      if (currentNode.el && typeof buildNodeBody === 'function') buildNodeBody(currentNode.el, currentNode);
      if (typeof scheduleAutosave === 'function') scheduleAutosave();
      if (typeof showToast === 'function') showToast('已应用工作流到节点', 'success');
    } catch (e) { errBox.textContent = '应用失败：' + e.message; }
  };

  // 由 comfyui 节点体「工作流编辑器」按钮调用
  window.FlowCraft._openComfyEditor = function (node) {
    currentNode = node || null;
    const wfKey = (node && node.params && node.params.wf && COMFY_TEMPLATES[node.params.wf]) ? node.params.wf : 'txt2img';
    let initial = (node && node.params && node.params.customJson) ? node.params.customJson : getTemplate(wfKey);
    if (typeof initial === 'object') initial = exportWorkflow(initial);
    tplSel.value = wfKey;
    setJson(initial || exportWorkflow(getTemplate('txt2img')));
    panel.style.display = 'block';
  };

  if (typeof console !== 'undefined') console.log('[FlowCraft] ComfyUI 工作流编辑器已挂载（opt-in）');
})();
