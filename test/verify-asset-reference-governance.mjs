import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');
const styles = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
const template = readFileSync(join(ROOT, 'src/template.html'), 'utf8');
const storage = readFileSync(join(ROOT, 'src/storage/storage.js'), 'utf8');
const db = readFileSync(join(ROOT, 'src/storage/db.js'), 'utf8');
const required = [
  'function buildAssetReferenceIndex()',
  "const governance = buildAssetReferenceIndex()",
  'data-act="refs"',
  'data-role="asset-refs"',
  'buildAssetReferenceIndex,',
  'invalidRefs',
  'missingTokens',
];
const missing = required.filter(fragment => !source.includes(fragment));
if (missing.length) {
  console.error('[asset-reference-governance] 缺少引用治理实现：\n- ' + missing.join('\n- '));
  process.exit(1);
}
for (const fragment of ['.asset-ref-summary', '.asset-ref-details', '.asset-ref-detail-row']) {
  if (!styles.includes(fragment)) {
    console.error('[asset-reference-governance] 缺少轻量引用详情样式：' + fragment);
    process.exit(1);
  }
}
for (const fragment of ['id="assetGovernanceSummary"', 'asset-governance-summary']) {
  if (!template.includes(fragment) && !styles.includes(fragment)) {
    console.error('[asset-reference-governance] 缺少失效引用提示区域：' + fragment);
    process.exit(1);
  }
}
for (const fragment of ['async previewOrphans()', 'btnPreviewOrphans', 'previewOrphanAssets', 'asset-orphan-list']) {
  const haystack = fragment === 'async previewOrphans()' ? storage : (source + styles + template);
  if (!haystack.includes(fragment)) {
    console.error('[asset-reference-governance] 缺少安全清理预览实现：' + fragment);
    process.exit(1);
  }
}
for (const fragment of ['async cleanupOrphans(ids)', "kind: 'asset-cleanup'", 'idbBulkDeleteMulti', 'async restoreSnapshot(id)']) {
  if (!storage.includes(fragment)) {
    console.error('[asset-reference-governance] 缺少清理快照/恢复实现：' + fragment);
    process.exit(1);
  }
}
for (const fragment of ['export async function idbBulkDeleteMulti(storeKeys)', 'usableGroups', 'if (!usableGroups.length) return 0']) {
  if (!db.includes(fragment)) {
    console.error('[asset-reference-governance] 缺少跨 store 安全删除契约：' + fragment);
    process.exit(1);
  }
}
const cleanupStart = storage.indexOf('async cleanupOrphans(ids)');
const cleanupEnd = storage.indexOf('async pruneOrphans()', cleanupStart);
const cleanupBlock = storage.slice(cleanupStart, cleanupEnd);
if (cleanupBlock.indexOf("kind: 'asset-cleanup'") > cleanupBlock.indexOf('idbBulkDeleteMulti')) {
  console.error('[asset-reference-governance] 清理必须先创建快照，再执行删除');
  process.exit(1);
}
const restoreStart = storage.indexOf('async restoreSnapshot(id)');
const restoreEnd = storage.indexOf('async renameSnapshot(', restoreStart);
const restoreBlock = storage.slice(restoreStart, restoreEnd);
for (const fragment of ["row.data.kind === 'asset-cleanup'", 'idbBulkPutMulti', "store: 'assets'"]) {
  if (!restoreBlock.includes(fragment)) {
    console.error('[asset-reference-governance] 缺少清理快照资产恢复契约：' + fragment);
    process.exit(1);
  }
}
if (storage.includes('async previewOrphans()') && storage.slice(storage.indexOf('async previewOrphans()'), storage.indexOf('async pruneOrphans()')).includes('idbDelete')) {
  console.error('[asset-reference-governance] 预览接口不得执行删除');
  process.exit(1);
}
const start = source.indexOf('function buildAssetReferenceIndex()');
const end = source.indexOf('function assetNameMap(', start);
const block = source.slice(start, end);
for (const forbidden of ['Authorization', 'apiKey', 'dataUrl']) {
  if (block.includes(forbidden)) {
    console.error('[asset-reference-governance] 引用索引不应保存敏感字段或完整原始数据：' + forbidden);
    process.exit(1);
  }
}
for (const fragment of ["'thumb'", "'uploadedImage'", "'refImages'", "'params'", "'inputsData'", "'outputsData'", "'提示词引用'"]) {
  if (!block.includes(fragment)) {
    console.error('[asset-reference-governance] 未扫描引用来源：' + fragment);
    process.exit(1);
  }
}
console.log('[asset-reference-governance] 只读引用索引、轻量详情、敏感数据边界检查通过');
