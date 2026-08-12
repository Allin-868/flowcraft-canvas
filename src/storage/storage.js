// 阶段 0.5 — 存储接口兼容层
// 当前委托旧实现（localStorage 自动保存 / 启动时 restoreFromStorage）。
// 阶段 1 将在此接口后替换实现为 IndexedDB，调用方无需改动。
export const StorageAdapter = {
  _mode: 'localStorage-legacy',

  // 自动保存：委托旧 doAutosave(project)
  autosave(project) {
    if (typeof doAutosave === 'function') return doAutosave(project);
    return null;
  },

  // 显式保存（等价自动保存的别名，预留给阶段 1 的「保存 / 另存为」）
  save(project) {
    return this.autosave(project);
  },

  // 加载当前项目：委托旧 restoreFromStorage()
  load() {
    if (typeof restoreFromStorage === 'function') {
      try { return restoreFromStorage(); } catch (e) { return null; }
    }
    return null;
  },

  // 项目列表：旧实现无多项目管理，阶段 1 补 IndexedDB 后返回真实列表
  list() {
    return [];
  },

  getMode() {
    return this._mode;
  },
};
