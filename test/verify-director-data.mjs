import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

const required = [
  'function normalizeStoryBeat(raw)',
  "schema: 'flowcraft.director.v1'",
  'director: normalizeDirectorData()',
  'director: normalizeDirectorData(workflow.director)',
  'workflow.director = normalizeDirectorData(snap.director)',
  'workflow.director = normalizeDirectorData(parsed.director)',
  'parsed.director = normalizeDirectorData(parsed.director)',
];
const missing = required.filter(fragment => !source.includes(fragment));
if (missing.length) {
  console.error('[director-data] 缺少编导数据容器接入点：\n- ' + missing.join('\n- '));
  process.exit(1);
}

const fields = ['sceneAssetId', 'sourceText', 'action', 'dialogue', 'emotion', 'cause', 'effect', 'status', 'source', 'updatedAt'];
const missingFields = fields.filter(field => !source.includes(`${field}:`));
if (missingFields.length) {
  console.error('[director-data] story beat 字段不完整：\n- ' + missingFields.join('\n- '));
  process.exit(1);
}

if (!source.includes("['draft', 'validated', 'error']")) {
  console.error('[director-data] 未发现受限的节拍状态枚举');
  process.exit(1);
}

// 防止把节点脚本文本替换成节拍数组：两者必须仍是独立字段。
if (!source.includes("script: '', wordCount: 0") && !source.includes("script: ''")) {
  console.error('[director-data] 未确认脚本原文字段仍独立保留');
  process.exit(1);
}

console.log('[director-data] director.storyBeats 数据契约、快照、序列化、迁移和恢复接入检查通过');
