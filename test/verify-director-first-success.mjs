import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');
const required = [
  'function getDirectorFirstSuccessPathState()',
  "script: [...workflow.nodes.values()].some(n => n.type === 'script'",
  'beats: beats.length > 0',
  'skeleton: skeleton.length > 0',
  'nodeGroup: grouped.length > 0',
  'result: succeeded.length > 0',
  'complete: Object.values(steps).every(Boolean)',
  'getDirectorFirstSuccessPathState,',
];
const missing = required.filter(fragment => !source.includes(fragment));
if (missing.length) {
  console.error('[director-first-success] 首次成功路径契约不完整：\n- ' + missing.join('\n- '));
  process.exit(1);
}

const fnStart = source.indexOf('function getDirectorFirstSuccessPathState()');
const fnEnd = source.indexOf('(function wireShots()', fnStart);
const block = source.slice(fnStart, fnEnd);
if (!block.includes("next: !steps.script ? 'script'")) {
  console.error('[director-first-success] 未提供可执行的下一步指引');
  process.exit(1);
}
console.log('[director-first-success] 脚本→节拍→分镜→镜头→节点组→结果的首次成功路径检查通过');
