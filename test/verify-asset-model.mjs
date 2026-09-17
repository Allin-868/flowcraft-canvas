import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

const required = [
  'function normalizeAssetRecord',
  'function normalizeAssetVariant',
  'function emptyAssetFields',
  'function syncProjectAssets',
  'function updateProjectAssetFields',
  'assets: (workflow.assets || []).map(normalizeAssetRecord)',
  'function buildAssetRefIndex() {\n  // 引用解析前先把当前节点资产',
  'fields: hit.projectAsset && hit.projectAsset.fields',
  'function buildRefAugmentedPrompt',
  'canonicalName',
  'variants',
  'data-role="asset-fields"',
  'data-act="savefields"',
  '后续引用会带入生成提示词',
];
const missing = required.filter(fragment => !source.includes(fragment));
if (missing.length) {
  console.error('[asset-model] 缺少结构化资产契约：\n- ' + missing.join('\n- '));
  process.exit(1);
}

const fieldKeys = ['composition', 'features', 'pose', 'camera', 'lighting', 'background', 'material', 'color', 'negative'];
const fieldCount = fieldKeys.filter(key => source.includes(`'${key}'`)).length;
if (fieldCount !== fieldKeys.length) {
  console.error(`[asset-model] 资产字段不完整：${fieldCount}/${fieldKeys.length}`);
  process.exit(1);
}

console.log(`[asset-model] 结构化资产、项目序列化、引用字段编译检查通过（${fieldCount} 个字段）`);
