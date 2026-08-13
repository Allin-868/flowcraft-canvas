// 阶段 0.5 / 1 — 兼容层入口
// 挂载存储 / 执行 / 节点 / 代理 / 费用 接口到 window.FlowCraft。
// 阶段 1：把全局存储函数重绑到 IndexedDB 实现（保留原函数行为 + 额外 IndexedDB 真源）；
//        并注入多项目面板 UI（T1-3）与恢复点 UI（T1-5）。
import { StorageAdapter } from '../storage/storage.js';
import { Runner } from '../execution/runner.js';
import { NodeContract } from '../nodes/registry.js';
import { ProxyClient } from '../providers/proxy-client.js';
import { FeeModel } from '../providers/fee-model.js';
import { ModelRegistry, ModelRouter, ModelHealth } from '../providers/model-router.js';
import { COMFY_TEMPLATES, listTemplates, getTemplate, parseWorkflow, applyFormValues, importWorkflow, exportWorkflow } from '../providers/comfyui-workflow.js';

window.FlowCraft = window.FlowCraft || {};
window.FlowCraft.storage = StorageAdapter;
window.FlowCraft.runner = Runner;
window.FlowCraft.nodes = NodeContract;
window.FlowCraft.proxy = ProxyClient;
window.FlowCraft.fee = FeeModel;
window.FlowCraft.models = ModelRegistry.init();
window.FlowCraft.router = ModelRouter.init();
window.FlowCraft.health = ModelHealth.init();
window.FlowCraft.version = '3.11-comfyui';

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
    '#fcMrToggle{position:fixed;left:14px;bottom:14px;z-index:60;background:var(--accent,#4f8cff);color:#fff;' +
    'border:none;border-radius:8px;padding:7px 12px;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}' +
    '#fcMrPanel{position:fixed;left:14px;bottom:54px;z-index:61;width:320px;max-height:72vh;overflow:auto;' +
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
  toggle.textContent = '🧭 模型路由';
  document.body.appendChild(toggle);

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
    '#fcCwToggle{position:fixed;left:14px;bottom:54px;z-index:60;background:#6C5CE7;color:#fff;' +
    'border:none;border-radius:8px;padding:7px 12px;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}' +
    '#fcCwPanel{position:fixed;left:14px;bottom:94px;z-index:61;width:360px;max-height:78vh;overflow:auto;' +
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
  toggle.textContent = '🎛 ComfyUI 工作流';
  document.body.appendChild(toggle);

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
  function renderForm() {
    formBox.innerHTML = '';
    let parsed;
    try { parsed = parseWorkflow(currentJson); }
    catch (e) { errBox.textContent = 'JSON 解析失败：' + e.message; return; }
    parsed.nodes.forEach((nd) => {
      const box = document.createElement('div'); box.className = 'fcw-node';
      const title = document.createElement('div'); title.className = 'fcw-title';
      title.textContent = nd.id + ' · ' + nd.class_type; box.appendChild(title);
      nd.fields.forEach((f) => {
        const row = document.createElement('div'); row.className = 'fcw-f';
        const lab = document.createElement('label'); lab.textContent = f.name; row.appendChild(lab);
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

