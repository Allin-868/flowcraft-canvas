import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

const required = [
  'function getNodesBounds(nodes)',
  'const bounds = getNodesBounds(nodes)',
  'function getShotLinkedNodes(shot)',
  'function pickShotResult(nodes)',
  'function syncShotStatus(node)',
  "s.resultNodeId = result.nodeId",
  "s.resultPreview = result.preview",
  "s.resultType = result.type",
  "s.nodeId = iNode.id",
  'nodeIds: Array.isArray(s.nodeIds)',
];
const missing = required.filter(fragment => !source.includes(fragment));
if (missing.length) {
  console.error('[director-quality] 缺少镜头链路质量保护：\n- ' + missing.join('\n- '));
  process.exit(1);
}

// 结果预览只从已完成节点回填，避免 running/error 节点污染镜头结果。
const pickStart = source.indexOf('function pickShotResult(nodes)');
const pickEnd = source.indexOf('function syncShotStatus(node)', pickStart);
const pickBlock = source.slice(pickStart, pickEnd);
if (!pickBlock.includes("node.status === 'done'")) {
  console.error('[director-quality] 结果预览未限制为已完成节点');
  process.exit(1);
}

console.log('[director-quality] 节点组定位、旧数据兼容、状态聚合与结果回填检查通过');
