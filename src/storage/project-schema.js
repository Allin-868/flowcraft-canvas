// FlowCraft 项目数据边界：在写入 IndexedDB 或替换当前画布前校验数据。
// 这里不依赖 DOM，便于浏览器回归和未来服务端/脚本复用。

export const CURRENT_PROJECT_SCHEMA_VERSION = 4;

// 与 legacy NODE_TYPES / NodeContract 保持同步。未知类型不能静默降级成图片，
// 否则用户会看到“导入成功”但实际节点语义已经丢失。
export const KNOWN_NODE_TYPES = new Set([
  'image', 'videoInput', 'text', 'stateList', 'aiImage', 'imageEdit', 'aiVideo', 'upscale',
  'compare', 'videoBreak', 'reversePrompt', 'save', 'lineart', 'aiSet', 'material',
  'light', 'layout', 'loop', 'comfyui', 'script', 'footage', 'voiceover', 'subtitle',
  'bgm', 'audio', 'compose', 'publish',
]);

function issue(path, message) { return `${path}：${message}`; }

/**
 * 校验项目对象。返回结构化错误，不抛异常，调用方可以把原因展示给用户。
 * future schema 只给 warning：允许新版本数据尽力读取，但禁止明显结构损坏进入存储。
 */
export function validateProject(project, options = {}) {
  const errors = [];
  const warnings = [];
  const allowUnknownNodeTypes = options.allowUnknownNodeTypes === true;
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    return { ok: false, errors: ['项目数据必须是 JSON 对象'], warnings };
  }
  const version = Number.isFinite(project.version) ? project.version : (Number.isFinite(project.schemaVersion) ? project.schemaVersion : 1);
  if (version > CURRENT_PROJECT_SCHEMA_VERSION) warnings.push(issue('version', `来自更高版本（${version}），将尽力兼容`));
  if (version < 1) errors.push(issue('version', '版本号无效'));
  if (!Array.isArray(project.nodes)) errors.push(issue('nodes', '必须是数组（空项目请使用 nodes: []）'));
  if (project.edges !== undefined && !Array.isArray(project.edges)) errors.push(issue('edges', '必须是数组'));
  if (errors.length) return { ok: false, errors, warnings };

  const nodes = project.nodes;
  const ids = new Set();
  nodes.forEach((node, index) => {
    const path = `nodes[${index}]`;
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(issue(path, '必须是对象')); return;
    }
    if (typeof node.id !== 'string' || !node.id.trim()) errors.push(issue(`${path}.id`, '必须是非空字符串'));
    else if (ids.has(node.id)) errors.push(issue(`${path}.id`, `重复 ID「${node.id}」`));
    else ids.add(node.id);
    if (typeof node.type !== 'string' || !node.type.trim()) errors.push(issue(`${path}.type`, '必须是非空字符串'));
    else if (!KNOWN_NODE_TYPES.has(node.type)) {
      const msg = `未知节点类型「${node.type}」，请使用兼容版本打开或重新导出`;
      if (allowUnknownNodeTypes) warnings.push(issue(`${path}.type`, msg)); else errors.push(issue(`${path}.type`, msg));
    }
    for (const coord of ['x', 'y']) if (node[coord] !== undefined && !Number.isFinite(Number(node[coord]))) errors.push(issue(`${path}.${coord}`, '必须是有限数字'));
    for (const collection of ['inputsData', 'outputsData', 'refImages']) {
      if (node[collection] !== undefined && !Array.isArray(node[collection])) errors.push(issue(`${path}.${collection}`, '必须是数组'));
    }
  });

  const edges = Array.isArray(project.edges) ? project.edges : [];
  const edgeIds = new Set();
  edges.forEach((edge, index) => {
    const path = `edges[${index}]`;
    if (!edge || typeof edge !== 'object' || Array.isArray(edge)) { errors.push(issue(path, '必须是对象')); return; }
    if (typeof edge.id !== 'string' || !edge.id.trim()) errors.push(issue(`${path}.id`, '必须是非空字符串'));
    else if (edgeIds.has(edge.id)) errors.push(issue(`${path}.id`, `重复 ID「${edge.id}」`));
    else edgeIds.add(edge.id);
    for (const key of ['fromNodeId', 'toNodeId']) {
      if (typeof edge[key] !== 'string' || !ids.has(edge[key])) errors.push(issue(`${path}.${key}`, '引用了不存在的节点'));
    }
    for (const key of ['fromPort', 'toPort']) if (!Number.isInteger(edge[key]) || edge[key] < 0) errors.push(issue(`${path}.${key}`, '必须是非负整数'));
  });
  if (project.order !== undefined && !Array.isArray(project.order)) errors.push(issue('order', '必须是数组'));
  return { ok: errors.length === 0, errors, warnings };
}

export function formatProjectValidationError(result) {
  const errors = result && Array.isArray(result.errors) ? result.errors : ['未知项目数据错误'];
  return '项目数据校验失败：' + errors.slice(0, 5).join('；') + (errors.length > 5 ? `（另有 ${errors.length - 5} 项）` : '');
}
