import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const storage = readFileSync(join(ROOT, 'src/storage/storage.js'), 'utf8');
const db = readFileSync(join(ROOT, 'src/storage/db.js'), 'utf8');
const legacy = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

const required = [
  "__FC_TEST_STORAGE_FAILURE__ === 'open'",
  "__FC_TEST_STORAGE_FAILURE__ === 'write'",
  "name = 'QuotaExceededError'",
  "errorCode: 'IDB_UNAVAILABLE'",
  "errorCode: code",
  'async transactionalPut(store, values)',
  't.onabort = () => reject',
  "__FC_TEST_STORAGE_FAILURE__ === 'localStorage'",
  "showToast('⚠️ 自动保存失败：",
];
const all = storage + db + legacy;
const missing = required.filter(fragment => !all.includes(fragment));
if (missing.length) {
  console.error('[storage-faults] 存储故障注入/回退契约缺少：\n- ' + missing.join('\n- '));
  process.exit(1);
}

const bulkStart = db.indexOf('export async function idbBulkPut(store, values)');
const bulkEnd = db.indexOf('export async function idbClear', bulkStart);
const bulk = db.slice(bulkStart, bulkEnd > bulkStart ? bulkEnd : undefined);
if (!bulk.includes("db.transaction(store, 'readwrite')") || !bulk.includes('t.oncomplete') || !bulk.includes('t.onabort')) {
  console.error('[storage-faults] 批量写入未形成完整的单事务提交/回滚边界');
  process.exit(1);
}

console.log('[storage-faults] IndexedDB 不可用、写入失败、localStorage 失败与事务回滚检查通过');
