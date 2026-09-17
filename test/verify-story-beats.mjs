import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');

const required = [
  'function extractStoryBeatCandidates(script, sourceNodeId)',
  'function proposeStoryBeatsForNode(node)',
  'function confirmStoryBeatsForNode(node)',
  'function editStoryBeatForNode(node, beatId, patch)',
  'function deleteStoryBeatForNode(node, beatId)',
  'function generateShotSkeletonForNode(node)',
  'function syncShotSkeletonFromShot(shot)',
  'schema: \'flowcraft.director.node-group.v1\'',
  'function generateShotNodeGroup(id)',
  'skeleton.status = \'canvas-linked\'',
  '该镜头节点组已存在，已定位到现有节点组',
  'function discardStoryBeatCandidates(node)',
  "status: 'draft'",
  "status: 'validated'",
  "node.params.beatResult",
  "workflow.director.storyBeats = workflow.director.storyBeats.concat(confirmed)",
  "textContent = '提取节拍'",
  "textContent = '确认写入节拍'",
  "textContent = '生成分镜骨架'",
  "id=\"smShotType\"",
  "id=\"smCamera\"",
  "id=\"smMovement\"",
  "showToast('节拍已更新', 'success')",
  "showToast('节拍已删除', 'info')",
];
const missing = required.filter(fragment => !source.includes(fragment));
if (missing.length) {
  console.error('[story-beats] 缺少剧情节拍最小闭环：\n- ' + missing.join('\n- '));
  process.exit(1);
}

if (!source.includes("if (result && result.status === 'validated') return false;")) {
  console.error('[story-beats] 缺少重复确认保护');
  process.exit(1);
}

if (!source.includes("source: { nodeId: String(sourceNodeId || ''), kind: 'script-local-template' }")) {
  console.error('[story-beats] 候选节拍缺少来源追溯');
  process.exit(1);
}

if (!source.includes('pushHistory();') || !source.includes('workflow.director.storyBeats = workflow.director.storyBeats.map')) {
  console.error('[story-beats] 编辑节拍未接入撤销历史或项目容器同步');
  process.exit(1);
}

if (!source.includes('workflow.director.storyBeats = workflow.director.storyBeats.filter')) {
  console.error('[story-beats] 删除已确认节拍未同步项目容器');
  process.exit(1);
}

if (!source.includes('workflow.director.shotSkeleton = workflow.director.shotSkeleton.concat(skeleton)') ||
    !source.includes('sourceBeatId: shot.beatId')) {
  console.error('[story-beats] 分镜骨架未与节拍建立来源关联');
  process.exit(1);
}

if (!source.includes('skeleton.shotType = shot.shotType') ||
    !source.includes('skeleton.camera = shot.camera') ||
    !source.includes('skeleton.movement = shot.movement')) {
  console.error('[story-beats] 镜头编辑没有同步景别、机位和运动方式');
  process.exit(1);
}

if (!source.includes('directorMeta') || !source.includes("role: 'image-generation'") || !source.includes("role: 'video-generation'")) {
  console.error('[story-beats] 画布节点组缺少导演来源元数据');
  process.exit(1);
}

console.log('[story-beats] 脚本→候选节拍→确认写入→项目容器闭环检查通过');
