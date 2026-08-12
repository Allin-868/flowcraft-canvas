// 阶段 1 — 存储接口兼容层（IndexedDB 真源实现）
// 替换阶段 0.5 的 localStorage 委托：项目 / 图片 / 视频 / 历史 入库 IndexedDB。
// 大图策略：autosave 写 IndexedDB 完整（不剥离）；localStorage 桥由 compat 层负责（保留原行为）。
import * as db from './db.js';
import { exportProjectZip, importProjectZip } from './project-io.js';

const CURRENT_PROJECT_ID = 'current';
const LEGACY_AUTOSAVE_KEY = 'flowcraft:autosave:v1';
const SAFE_AUTOSAVE_LIMIT = 4_500_000;

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

  async _ensureIDB() {
    if (this._idbReady) return true;
    try {
      await db.openDB();
      this._idbReady = true;
      return true;
    } catch (e) {
      this._mode = 'localStorage-legacy';
      return false;
    }
  },

  // —— 自动保存真源（兼容层调用，不阻塞 UI）——
  async autosaveToIDB() {
    const proj = _readWorkflowJSON();
    if (!proj) return null;
    const ok = await this._ensureIDB();
    if (!ok) { this._mode = 'localStorage-legacy'; return null; }
    try {
      const text = JSON.stringify(proj);
      await db.idbPut('projects', {
        id: CURRENT_PROJECT_ID,
        data: proj,
        savedAt: new Date().toISOString(),
        size: text.length,
      });
      this._mode = 'indexeddb';
      return CURRENT_PROJECT_ID;
    } catch (e) {
      this._mode = 'localStorage-legacy';
      return null;
    }
  },

  // 旧兼容接口：autosave(project) / save(project)
  autosave() { return this.autosaveToIDB(); },
  save() { return this.autosaveToIDB(); },

  // 旧 load()：返回 IndexedDB 真源（compat 重绑会先尝试真源，失败降级 legacy）
  async load() { return this.loadFromIDB(); },

  async loadFromIDB() {
    const ok = await this._ensureIDB();
    if (!ok) return null;
    try {
      const row = await db.idbGet('projects', CURRENT_PROJECT_ID);
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
    await db.kvSet('lastProjectId', id);
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
    await db.idbPut('projects', { ...row, id: CURRENT_PROJECT_ID });
    await db.kvSet('lastProjectId', id);
    return row.data;
  },
  async newProject() {
    const ok = await this._ensureIDB();
    if (!ok) return false;
    await db.idbDelete('projects', CURRENT_PROJECT_ID);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(LEGACY_AUTOSAVE_KEY); } catch (e) { /* ignore */ }
    }
    return true;
  },

  // —— 多项目：改名 / 删除 ——
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
    const proj = _readWorkflowJSON();
    if (!proj) return null;
    if (meta && meta.projectName) proj.name = meta.projectName; // 导出名落到项目对象，保证往返一致
    const assets = _collectHeavyAssets(proj);
    const blob = await exportProjectZip(proj, assets, meta || {});
    return blob;
  },
  async importProject(fileOrBlob) {
    const { manifest, project, assets } = await importProjectZip(fileOrBlob);
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
    const proj = await this.loadFromIDB();
    if (proj && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LEGACY_AUTOSAVE_KEY, JSON.stringify(proj));
      } catch (e) {
        // 大项目超 5MB：桥写失败，降级 legacy 读旧桥（现状）。大项目恢复走 .flowcraft 导入。
      }
    }
    if (typeof legacyRestoreFn === 'function') return legacyRestoreFn();
    return proj;
  },

  getMode() { return this._mode; },
};
