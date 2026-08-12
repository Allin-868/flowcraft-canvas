// 阶段 1 — IndexedDB 封装层
// schemaVersion = 1；stores: projects / assets / snapshots / tasks / kv
// 设计目标：解除 localStorage 5MB 上限，作为「项目 / 图片 / 视频 / 历史」真源。
// 浏览器原生 API；Node 环境无 indexedDB，verify 在 Playwright(浏览器) 中运行。

const DB_NAME = 'flowcraft-db';
const DB_VERSION = 1;

let _dbPromise = null;
let _availabilityChecked = false;
let _available = true;

// 版本迁移框架：未来 schemaVersion 变更在此追加分支
const MIGRATIONS = {
  // 1: 初始 schema（已在 onupgradeneeded 建好）
};

function _ensureStores(db) {
  if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
}

export function isIDBAvailable() {
  if (_availabilityChecked) return _available;
  _availabilityChecked = true;
  try {
    _available = typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
  } catch (e) {
    _available = false;
  }
  return _available;
}

export function openDB() {
  if (_dbPromise) return _dbPromise;
  if (!isIDBAvailable()) {
    _dbPromise = Promise.reject(new Error('IndexedDB 不可用（当前环境不支持）'));
    return _dbPromise;
  }
  _dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion || 0;
      _ensureStores(db);
      // 未来迁移：for (let v = oldVersion + 1; v <= DB_VERSION; v++) { if (MIGRATIONS[v]) MIGRATIONS[v](db); }
      void oldVersion;
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open 失败'));
    req.onblocked = () => reject(new Error('IndexedDB 被其他标签页占用'));
  });
  return _dbPromise;
}

function _store(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

function _reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB 请求失败'));
  });
}

// 单条写入（readwrite 事务，原子）
export async function idbPut(store, value) {
  const db = await openDB();
  return _reqToPromise(_store(db, store, 'readwrite').put(value));
}

export async function idbGet(store, key) {
  const db = await openDB();
  return _reqToPromise(_store(db, store, 'readonly').get(key));
}

export async function idbDelete(store, key) {
  const db = await openDB();
  return _reqToPromise(_store(db, store, 'readwrite').delete(key));
}

export async function idbGetAll(store) {
  const db = await openDB();
  return _reqToPromise(_store(db, store, 'readonly').getAll());
}

export async function idbCount(store) {
  const db = await openDB();
  return _reqToPromise(_store(db, store, 'readonly').count());
}

// 批量写入（单事务，全部成功或全部不生效 -> 事务回滚）
export async function idbBulkPut(store, values) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    t.oncomplete = () => resolve(values.length);
    t.onerror = () => reject(t.error || new Error('批量写入失败（已回滚）'));
    t.onabort = () => reject(t.error || new Error('批量写入被中止（已回滚）'));
    for (const v of values) os.put(v);
  });
}

export async function idbClear(store) {
  const db = await openDB();
  return _reqToPromise(_store(db, store, 'readwrite').clear());
}

// 容量：navigator.storage.estimate() -> { usage, quota }
export async function estimate() {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const e = await navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    } catch (e) {
      /* ignore */
    }
  }
  return { usage: 0, quota: 0 };
}

export async function persist() {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      return await navigator.storage.persist();
    } catch (e) {
      return false;
    }
  }
  return false;
}

export async function isPersisted() {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persisted === 'function') {
    try {
      return await navigator.storage.persisted();
    } catch (e) {
      return null;
    }
  }
  return null;
}

// kv 小设置读写（schemaVersion / 最近使用 / 容量偏好等）
export async function kvGet(key, fallback) {
  try {
    const row = await idbGet('kv', key);
    return row ? row.value : fallback;
  } catch (e) {
    return fallback;
  }
}

export async function kvSet(key, value) {
  return idbPut('kv', { key, value });
}
