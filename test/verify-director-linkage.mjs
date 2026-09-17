import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

const required = [
  'function normalizeShotSkeleton(raw)',
  'function repairDirectorLinks()',
  "skeleton.status = 'canvas-linked'",
  'skeleton.nodeIds = [tNode.id, iNode.id, vNode.id]',
  's.nodeIds = [tNode.id, iNode.id, vNode.id]',
  "role: 'director-prompt'",
  "role: 'image-generation'",
  "role: 'video-generation'",
  'new Edge(tNode, 0, iNode, 1)',
  'new Edge(iNode, 0, vNode, 0)',
  'repairDirectorLinks();',
  'function getShotLinkedNodes(shot)',
  'function pickShotResult(nodes)',
  "s.resultPreview = result.preview",
  "s.resultType = result.type",
  "s.nodeId = iNode.id",
];
const missing = required.filter(fragment => !source.includes(fragment));
if (missing.length) {
  console.error('[director-linkage] 缺少分镜骨架—镜头—节点组链路：\n- ' + missing.join('\n- '));
  process.exit(1);
}

if (!source.includes("if (skeleton.status === 'canvas-linked' && nodeIdsForSkeleton.length < 3)")) {
  console.error('[director-linkage] 未发现节点组删除后的骨架降级修复');
  process.exit(1);
}
if (!source.includes("status: shot.status === 'grouped' ? 'idle' : shot.status")) {
  console.error('[director-linkage] 未发现镜头节点组引用清理');
  process.exit(1);
}
if (!source.includes('groupSceneId: s.groupSceneId || \'\'')) {
  console.error('[director-linkage] 镜头导入/恢复未保留节点组场景引用');
  process.exit(1);
}

if (!source.includes('shot.groupSceneId !== id')) {
  console.error('[director-linkage] 删除场景时未解除镜头节点组关联');
  process.exit(1);
}

console.log('[director-linkage] 节拍→分镜骨架→镜头→节点组来源、连线、恢复与孤立引用修复检查通过');
