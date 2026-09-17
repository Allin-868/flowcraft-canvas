import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacy = readFileSync(join(ROOT, 'src/core/legacy.js'), 'utf8');
const template = readFileSync(join(ROOT, 'src/template.html'), 'utf8');
const styles = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
const all = legacy + template + styles;
const required = [
  'id="directorPathHint"',
  'getDirectorFirstSuccessPathState()',
  "className = 'director-path-hint '",
  '下一步：',
  '.director-path-hint',
  '.director-path-hint.complete',
];
const missing = required.filter(fragment => !all.includes(fragment));
if (missing.length) {
  console.error('[director-path-hint] 首次成功路径轻量提示缺少：\n- ' + missing.join('\n- '));
  process.exit(1);
}
if (!legacy.includes('pathHint.innerHTML = path.complete')) {
  console.error('[director-path-hint] 提示没有区分完成态与进行态');
  process.exit(1);
}
console.log('[director-path-hint] 镜头面板内轻量首次成功路径提示检查通过');
