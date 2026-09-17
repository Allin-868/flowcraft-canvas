// 阶段 1 — 存储接口兼容层（IndexedDB 真源实现）
// 替换阶段 0.5 的 localStorage 委托：项目 / 图片 / 视频 / 历史 入库 IndexedDB。
// 大图策略：autosave 写 IndexedDB 完整（不剥离）；localStorage 桥由 compat 层负责（保留原行为）。
import * as db from './db.js';
import { exportProjectZip, importProjectZip } from './project-io.js';
import { validateProject, formatProjectValidationError } from './project-schema.js';

const CURRENT_PROJECT_ID = 'current';
const LEGACY_AUTOSAVE_KEY = 'flowcraft:autosave:v1';
const WORKBENCHES_KEY = 'flowcraft:workbenches:v1';
const ACTIVE_WB_KEY = 'flowcraft:activeWorkbench:v1';
const SAFE_AUTOSAVE_LIMIT = 4_500_000;

function _errorCode(error, fallback = 'STORAGE_FAILED') {
  const name = error && (error.name || error.code);
  if (name === 'QuotaExceededError' || name === 22 || name === 1014) return 'QUOTA_EXCEEDED';
  if (name === 'InvalidStateError' || name === 'NotFoundError') return 'IDB_UNAVAILABLE';
  return fallback;
}

function _errorMessage(error, fallback) {
  return (error && error.message) || fallback || '本地存储操作失败';
}

function _saveResult(ok, fields = {}) {
  return {
    ok: !!ok,
    mode: fields.mode || (ok ? 'indexeddb' : 'failed'),
    projectId: fields.projectId || null,
    savedAt: fields.savedAt || null,
    size: fields.size || 0,
    errorCode: fields.errorCode || null,
    errorMessage: fields.errorMessage || null,
  };
}

// 从全局 workflow 序列化当前项目（完整不剥离）。依赖 legacy 全局函数 serializeWorkflow。
function _readWorkflowJSON() {
  try {
    if (typeof serializeWorkflow === 'function') {
      const s = serializeWorkflow(false);
      return s ? JSON.parse(s) : null;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// 收集节点内大图/视频 dataURL（用于 ZIP 冗余写入）
function _collectHeavyAssets(project) {
  const out = [];
  if (!project || !Array.isArray(project.nodes)) return out;
  for (const n of project.nodes) {
    const scan = (v) => {
      if (typeof v === 'string' && v.startsWith('data:') && v.length > 60000) out.push({ id: n.id, dataUrl: v });
    };
    if (n.thumb) scan(n.thumb);
    if (n.params) Object.keys(n.params).forEach((k) => scan(n.params[k]));
    if (Array.isArray(n.inputsData)) n.inputsData.forEach((d) => d && scan(d.value));
    if (Array.isArray(n.outputsData)) n.outputsData.forEach((d) => d && scan(d.value));
  }
  return out;
}

function _hasStrippedAssets(project) {
  if (!project || !Array.isArray(project.nodes)) return false;
  const scan = (value) => value === '(stripped)';
  return project.nodes.some((n) => {
    if (!n) return false;
    if (scan(n.thumb)) return true;
    if (n.params && Object.values(n.params).some(scan)) return true;
    if (Array.isArray(n.inputsData) && n.inputsData.some((d) => d && scan(d.value))) return true;
    if (Array.isArray(n.outputsData) && n.outputsData.some((d) => d && scan(d.value))) return true;
    return false;
  });
}

async function _sha256(str) {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* ignore */ }
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return 'fallback-' + h;
}

export const StorageAdapter = {
  _mode: 'indexeddb',
  _idbReady: false,
  _lastSaveResult: _saveResult(false, { mode: 'idle' }),
  _saveListeners: new Set(),

  onSaveStatus(listener) {
    if (typeof listener !== 'function') return () => {};
    this._saveListeners.add(listener);
    return () => this._saveListeners.delete(listener);
  },
  _publishSaveStatus(result) {
    this._lastSaveResult = result;
    this._saveListeners.forEach((listener) => {
      try { listener(result); } catch (e) { /* UI listener must not break saving */ }
    });
    return result;
  },

  async _ensureIDB() {
    if (this._idbReady) return true;
    if (typeof window !== 'undefined' && window.__FC_TEST_STORAGE_FAILURE__ === 'open') {
      this._mode = 'localStorage-legacy';
      return false;
    }
    try {
      await db.openDB();
      this._idbReady = true;
      return true;
    } catch (e) {
      this._mode = 'localStorage-legacy';
      if (typeof db.resetDBConnection === 'function') db.resetDBConnection();
      return false;
    }
  },

  // —— 自动保存真源（兼容层调用，不阻塞 UI）——
  async autosaveToIDB() {
    const proj = _readWorkflowJSON();
    if (!proj) {
      return this._publishSaveStatus(_saveResult(false, {
        mode: 'failed', errorCode: 'NO_PROJECT', errorMessage: '当前画布没有可保存的数据',
      }));
    }
    const ok = await this._ensureIDB();
    if (!ok) {
      return this._publishSaveStatus(_saveResult(false, {
        mode: 'unavailable', errorCode: 'IDB_UNAVAILABLE', errorMessage: 'IndexedDB 不可用或打开失败',
      }));
    }
    try {
      const text = JSON.stringify(proj);
      const savedAt = new Date().toISOString();
      if (typeof window !== 'undefined' && window.__FC_TEST_STORAGE_FAILURE__ === 'write') {
        const error = new Error('测试注入：IndexedDB 写入失败');
        error.name = 'QuotaExceededError';
        throw error;
      }

      // P0-3: 根据 activeProjectId 决定写入位置
      const activeId = await db.kvGet('activeProjectId', CURRENT_PROJECT_ID);
      const targetId = activeId || CURRENT_PROJECT_ID;

      await db.idbPut('projects', {
        id: targetId,
        data: proj,
        name: proj.name,
        savedAt,
        size: text.length,
      });
      this._mode = 'indexeddb';
      return this._publishSaveStatus(_saveResult(true, {
        mode: 'indexeddb', projectId: targetId, savedAt, size: text.length,
      }));
    } catch (e) {
      const code = _errorCode(e, 'IDB_WRITE_FAILED');
      this._mode = code === 'QUOTA_EXCEEDED' ? 'indexeddb' : 'localStorage-legacy';
      return this._publishSaveStatus(_saveResult(false, {
        mode: code === 'QUOTA_EXCEEDED' ? 'failed' : 'unavailable',
        errorCode: code, errorMessage: _errorMessage(e, 'IndexedDB 写入失败'),
      }));
    }
  },
  autosave() { return this.autosaveToIDB(); },
  save() { return this.autosaveToIDB(); },

  // 旧 load()：返回 IndexedDB 真源（compat 重绑会先尝试真源，失败降级 legacy）
  async load() { return this.loadFromIDB(); },

  async loadFromIDB() {
    const ok = await this._ensureIDB();
    if (!ok) return null;
    try {
      // P0-3: 根据 activeProjectId 决定读取位置
      const activeId = await db.kvGet('activeProjectId', CURRENT_PROJECT_ID);
      const targetId = activeId || CURRENT_PROJECT_ID;

      const row = await db.idbGet('projects', targetId);
      return row ? row.data : null;
    } catch (e) { return null; }
  },
  // —— 多项目：保存 / 打开 / 列表 / 新建 ——
  async saveAs(name) {
    const proj = _readWorkflowJSON();
    if (!proj) return null;
    const ok = await this._ensureIDB();
    if (!ok) return null;
    const id = 'proj-' + Date.now();
    proj.name = name || '未命名项目';
    await db.idbPut('projects', { id, name, data: proj, savedAt: new Date().toISOString(), size: JSON.stringify(proj).length });

    // P0-3: 切换到新项目
    await db.kvSet('activeProjectId', id);
    await db.kvSet('lastProjectId', id);

    // 清空 current（避免混淆）
    await db.idbDelete('projects', CURRENT_PROJECT_ID);

    return id;
  },
  async list() {
    const ok = await this._ensureIDB();
    if (!ok) return [];
    try {
      const all = await db.idbGetAll('projects');
      return all
        .filter((r) => r.id !== CURRENT_PROJECT_ID)
        .map((r) => ({ id: r.id, name: r.name || (r.data && r.data.name) || r.id, savedAt: r.savedAt, size: r.size }));
    } catch (e) { return []; }
  },
  async open(id) {
    const ok = await this._ensureIDB();
    if (!ok) return null;
    const row = await db.idbGet('projects', id);
    if (!row) return null;

    // P0-3: 设置 activeProjectId 为原项目 ID，直接编辑原项目
    await db.kvSet('activeProjectId', id);
    await db.kvSet('lastProjectId', id);

    // 不再复制到 current，直接返回原项目数据
    return row.data;
  },
  async newProject() {
    const ok = await this._ensureIDB();
    if (!ok) return false;
    await db.idbDelete('projects', CURRENT_PROJECT_ID);

    // P0-3: 清空 activeProjectId
    await db.kvSet('activeProjectId', null);

    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(LEGACY_AUTOSAVE_KEY); } catch (e) { /* ignore */ }
    }
    return true;
  },
  async renameProject(id, name) {
    const ok = await this._ensureIDB();
    if (!ok) return false;
    const row = await db.idbGet('projects', id);
    if (!row) return false;
    row.name = name;
    await db.idbPut('projects', row);
    return true;
  },
  async deleteProject(id) {
    const ok = await this._ensureIDB();
    if (!ok) return false;
    if (id === CURRENT_PROJECT_ID) return false; // 当前项目不可删，用 newProject 清空
    await db.idbDelete('projects', id);
    return true;
  },

  // —— 项目文件 ZIP ——
  async exportProject(meta) {
    let proj = _readWorkflowJSON();
    if (!proj) return null;
    // 刷新后的快速启动可能暂时仍是剥离版；导出必须优先取 IndexedDB 完整真源，
    // 否则会把“(stripped)”占位符误打包成用户备份。
    if (_hasStrippedAssets(proj)) {
      const complete = await this.loadFromIDB();
      if (complete && !_hasStrippedAssets(complete)) proj = complete;
    }
    if (meta && meta.projectName) proj.name = meta.projectName; // 导出名落到项目对象，保证往返一致
    const assets = _collectHeavyAssets(proj);
    const blob = await exportProjectZip(proj, assets, meta || {});
    return blob;
  },
  async importProject(fileOrBlob) {
    const { manifest, project, assets } = await importProjectZip(fileOrBlob);
    const validation = validateProject(project);
    if (!validation.ok) throw new Error(formatProjectValidationError(validation));
    const ok = await this._ensureIDB();
    if (!ok) throw new Error('IndexedDB 不可用，无法导入');
    // 导入前容量检查（不足明确提示）
    const est = await db.estimate();
    const needed = JSON.stringify(project).length + assets.reduce((s, a) => s + (a.dataUrl ? a.dataUrl.length * 0.75 : 0), 0);
    if (est.quota && needed > est.quota - est.usage) {
      throw new Error('可用容量不足：需约 ' + Math.round(needed / 1048576) + 'MB，剩余约 ' + Math.round((est.quota - est.usage) / 1048576) + 'MB');
    }
    await db.idbPut('projects', {
      id: CURRENT_PROJECT_ID,
      data: project,
      name: manifest.projectName,
      savedAt: new Date().toISOString(),
      size: JSON.stringify(project).length,
      importedFrom: 'flowcraft',
    });
    // 资产入库（sha256 去重）
    for (const a of assets) {
      if (!a.dataUrl) continue;
      const sha = await _sha256(a.dataUrl);
      await db.idbPut('assets', { id: sha, dataUrl: a.dataUrl, kind: 'imported', createdAt: new Date().toISOString(), sha256: sha });
    }
    return project;
  },

  // —— 容量与持久化 ——
  async getCapacity() { return db.estimate(); },
  async requestPersist() { return db.persist(); },
  async isPersisted() { return db.isPersisted(); },

  // —— 迁移：localStorage -> IndexedDB（首次打开）——
  async migrateFromLocalStorage() {
    const ok = await this._ensureIDB();
    if (!ok) return { migrated: false, reason: 'idb-unavailable' };
    if (typeof localStorage === 'undefined') return { migrated: false, reason: 'no-localStorage' };
    const existing = await db.idbGet('projects', CURRENT_PROJECT_ID);
    if (existing) return { migrated: false, reason: 'already-has-idb' };
    const raw = localStorage.getItem(LEGACY_AUTOSAVE_KEY);
    if (!raw) return { migrated: false, reason: 'no-legacy' };
    try {
      const proj = JSON.parse(raw);
      await db.idbPut('projects', { id: CURRENT_PROJECT_ID, data: proj, savedAt: new Date().toISOString(), size: raw.length, migratedFrom: 'localStorage' });
      return { migrated: true, size: raw.length };
    } catch (e) { return { migrated: false, reason: 'parse-error' }; }
  },

  // —— 去重（相同 sha256 资产只留一份）——
  async dedupeAssets() {
    const ok = await this._ensureIDB();
    if (!ok) return 0;
    const all = await db.idbGetAll('assets');
    const seen = new Set();
    let dup = 0;
    for (const a of all) {
      const key = a.sha256 || (a.dataUrl ? await _sha256(a.dataUrl) : null);
      if (!key) continue;
      if (seen.has(key)) { await db.idbDelete('assets', a.id); dup++; } else seen.add(key);
    }
    return dup;
  },

  // —— 孤儿清理：删除无引用的资产 ——
  // 只读预览：与 pruneOrphans 使用同一套引用判定，但绝不删除数据。
  // 返回值只含资产元数据，不返回 dataUrl，避免把大图带入 UI / 日志。
  async previewOrphans() {
    const ok = await this._ensureIDB();
    if (!ok) return { ok: false, candidates: [], total: 0, errorCode: 'IDB_UNAVAILABLE' };
    const proj = await this.loadFromIDB();
    const referenced = new Set();
    if (proj && Array.isArray(proj.nodes)) {
      for (const n of proj.nodes) {
        const scan = (v) => { if (typeof v === 'string' && v.startsWith('data:')) referenced.add(v); };
        if (n.thumb) scan(n.thumb);
        if (n.uploadedImage) scan(n.uploadedImage);
        if (n.params) Object.keys(n.params).forEach((k) => scan(n.params[k]));
        if (Array.isArray(n.refImages)) n.refImages.forEach((r) => r && scan(r.src));
        if (Array.isArray(n.inputsData)) n.inputsData.forEach((d) => d && scan(d.value));
        if (Array.isArray(n.outputsData)) n.outputsData.forEach((d) => d && scan(d.value));
      }
    }
    const all = await db.idbGetAll('assets');
    const candidates = all.filter(a => !(a.dataUrl && referenced.has(a.dataUrl))).map(a => ({
      id: String(a.id || ''),
      kind: String(a.kind || 'unknown'),
      size: Number(a.dataUrl && a.dataUrl.length || 0),
      createdAt: a.createdAt || null,
    }));
    return { ok: true, candidates, total: candidates.length };
  },

  // 用户确认后的安全清理：重新计算候选，避免使用过期预览；清理前将项目和资产本体一起快照。
  async cleanupOrphans(ids) {
    const preview = await this.previewOrphans();
    if (!preview.ok) return { ok: false, removed: 0, errorCode: preview.errorCode || 'IDB_UNAVAILABLE' };
    const requested = new Set(Array.isArray(ids) ? ids.map(String) : []);
    const candidates = preview.candidates.filter(a => requested.has(String(a.id)));
    if (!candidates.length) return { ok: true, removed: 0, snapshotId: null };
    const ok = await this._ensureIDB();
    if (!ok) return { ok: false, removed: 0, errorCode: 'IDB_UNAVAILABLE' };
    const project = await this.loadFromIDB();
    const all = await db.idbGetAll('assets');
    const candidateIds = new Set(candidates.map(a => String(a.id)));
    const backupAssets = all.filter(a => candidateIds.has(String(a.id)));
    const snapshotId = 'snap-cleanup-' + Date.now();
    const snapshotData = {
      kind: 'asset-cleanup',
      project,
      assets: backupAssets,
      assetIds: backupAssets.map(a => String(a.id)),
    };
    await db.idbPut('snapshots', {
      id: snapshotId,
      label: '[资产清理] ' + backupAssets.length + ' 项',
      data: snapshotData,
      createdAt: new Date().toISOString(),
      size: JSON.stringify(snapshotData).length,
    });
    await this._enforceSnapshotPolicy();
    await db.idbBulkDeleteMulti([{ store: 'assets', keys: backupAssets.map(a => a.id) }]);
    return { ok: true, removed: backupAssets.length, snapshotId };
  },

  async pruneOrphans() {
    const ok = await this._ensureIDB();
    if (!ok) return 0;
    const proj = await this.loadFromIDB();
    const referenced = new Set();
    if (proj && Array.isArray(proj.nodes)) {
      for (const n of proj.nodes) {
        const scan = (v) => { if (typeof v === 'string' && v.startsWith('data:')) referenced.add(v); };
        if (n.thumb) scan(n.thumb);
        if (n.params) Object.keys(n.params).forEach((k) => scan(n.params[k]));
        if (Array.isArray(n.inputsData)) n.inputsData.forEach((d) => d && scan(d.value));
        if (Array.isArray(n.outputsData)) n.outputsData.forEach((d) => d && scan(d.value));
      }
    }
    const all = await db.idbGetAll('assets');
    let removed = 0;
    for (const a of all) {
      if (!(a.dataUrl && referenced.has(a.dataUrl))) { await db.idbDelete('assets', a.id); removed++; }
    }
    return removed;
  },

  // —— 快照（恢复点）——
  async snapshot(label) {
    const proj = _readWorkflowJSON();
    if (!proj) return null;
    const ok = await this._ensureIDB();
    if (!ok) return null;
    const id = 'snap-' + Date.now();
    await db.idbPut('snapshots', { id, label: label || '', data: proj, createdAt: new Date().toISOString(), size: JSON.stringify(proj).length });
    await this._enforceSnapshotPolicy();
    return id;
  },
  async listSnapshots() {
    const ok = await this._ensureIDB();
    if (!ok) return [];
    const all = await db.idbGetAll('snapshots');
    return all
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((s) => ({ id: s.id, label: s.label, createdAt: s.createdAt, size: s.size }));
  },
  async restoreSnapshot(id) {
    const ok = await this._ensureIDB();
    if (!ok) return null;
    const row = await db.idbGet('snapshots', id);
    if (!row) return null;
    if (row.data && row.data.kind === 'asset-cleanup') {
      const project = row.data.project || null;
      const assets = Array.isArray(row.data.assets) ? row.data.assets : [];
      if (project) {
        await db.idbBulkPutMulti([
          { store: 'projects', values: [{ id: CURRENT_PROJECT_ID, data: project, savedAt: new Date().toISOString(), size: JSON.stringify(project).length, restoredFrom: id }] },
          { store: 'assets', values: assets },
        ]);
      } else if (assets.length) await db.idbBulkPut('assets', assets);
      return project;
    }
    await db.idbPut('projects', { id: CURRENT_PROJECT_ID, data: row.data, savedAt: new Date().toISOString(), size: JSON.stringify(row.data).length, restoredFrom: id });
    return row.data;
  },
  async renameSnapshot(id, label) {
    const ok = await this._ensureIDB();
    if (!ok) return false;
    const row = await db.idbGet('snapshots', id);
    if (!row) return false;
    row.label = label;
    await db.idbPut('snapshots', row);
    return true;
  },
  async deleteSnapshot(id) {
    const ok = await this._ensureIDB();
    if (!ok) return false;
    await db.idbDelete('snapshots', id);
    return true;
  },
  async _enforceSnapshotPolicy() {
    // 保留策略（本批）：最近 20 个；标记 [永久] 的不删。每日 1 个的长期策略留待 UI 细化。
    const all = await db.idbGetAll('snapshots');
    all.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const MAX = 20;
    if (all.length > MAX) {
      const toDelete = all.slice(0, all.length - MAX).filter((s) => !(s.label && String(s.label).includes('[永久]')));
      for (const s of toDelete) await db.idbDelete('snapshots', s.id);
    }
  },

  // —— 事务回滚：批量写入失败整体不生效（db.idbBulkPut 保证）——
  async transactionalPut(store, values) {
    return db.idbBulkPut(store, values);
  },

  // 资产元数据 upsert（供 persistAssetMeta 重绑调用）
  async upsertAsset(rec) {
    const ok = await this._ensureIDB();
    if (!ok) return null;
    return db.idbPut('assets', rec);
  },

  // —— restoreWithIDB：优先 IndexedDB 真源刷新 localStorage 桥，再调 legacy 重建 ——
  async restoreWithIDB(legacyRestoreFn) {
    let proj = await this.loadFromIDB();
    // 旧版本首次启动会把 6 节点演示工作流写入 IndexedDB。升级后它不再是
    // 用户内容：先转为空项目，再回写当前项目，避免每次刷新又把默认组合拉回来。
    const isLegacyExample = typeof window !== 'undefined' && window.__FC_IS_LEGACY_EXAMPLE_PROJECT__;
    const legacyExample = !!(proj && isLegacyExample && isLegacyExample(proj));
    if (legacyExample) {
      proj = { ...proj, nodes: [], edges: [], order: [], recycleBin: [], shots: [], scenes: [], assets: [] };
    }
    if (proj && typeof localStorage !== 'undefined') {
      try {
        const full = JSON.stringify(proj);
        localStorage.setItem(LEGACY_AUTOSAVE_KEY, full);
        // legacy 恢复优先读取当前工作台，而不是旧 AUTOSAVE_KEY。
        // 只更新当前工作台的元数据，避免把完整项目重复塞回工作台列表。
        const activeId = localStorage.getItem(ACTIVE_WB_KEY);
        const raw = localStorage.getItem(WORKBENCHES_KEY);
        if (activeId && raw) {
          const workbenches = JSON.parse(raw);
          if (workbenches && workbenches[activeId]) {
            workbenches[activeId].savedAt = new Date().toISOString();
            localStorage.setItem(WORKBENCHES_KEY, JSON.stringify(workbenches));
          }
        }
      } catch (e) {
        // 大项目超 5MB：桥写失败，降级 legacy 读旧桥；完整项目仍保留在 IndexedDB。
      }
    }
    if (typeof legacyRestoreFn === 'function') {
      const restored = legacyRestoreFn();
      if (legacyExample) {
        try { await this.autosaveToIDB(); } catch (_) {}
      }
      return restored;
    }
    return proj;
  },


  // P0-3: 获取当前活动项目 ID
  async getActiveProjectId() {
    const ok = await this._ensureIDB();
    if (!ok) return null;
    return await db.kvGet('activeProjectId');
  },
  getMode() { return this._mode; },
};
