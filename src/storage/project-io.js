// 阶段 1 — 项目文件容器（.flowcraft = ZIP）
// 结构：manifest.json + project.json（含完整节点/边/镜头/场景，dataURL 完整）+ assets/（二进制 Blob 冗余，便于分享校验）
// 导入即完整还原，大图像素级恢复。
// 注：本批 project.json 仍内联 dataURL（保持与现有运行时一致）；后续 T1-8 可优化为「project.json 仅引用 assetId + assets/ 二进制」以彻底避免 Base64 膨胀。
import JSZip from 'jszip';
import { validateProject, formatProjectValidationError } from './project-schema.js';

export const FLOWCRAFT_FORMAT = 'flowcraft';
export const FLOWCRAFT_FORMAT_VERSION = 1;

function _mimeToExt(mime) {
  if (!mime) return 'bin';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return 'bin';
}

export function dataUrlToBlob(dataUrl) {
  try {
    const [head, body] = String(dataUrl).split(',');
    const mime = (head.match(/:(.*?);/) || [, 'application/octet-stream'])[1] || 'application/octet-stream';
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch (e) {
    return null;
  }
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('Blob 读取失败'));
    r.readAsDataURL(blob);
  });
}

// project: 完整项目对象（含 dataURL）；assets: [{ id, dataUrl }] 大图/视频资产（可选，用于二进制冗余写入）
export async function exportProjectZip(project, assets, meta = {}) {
  const zip = new JSZip();
  const manifest = {
    format: FLOWCRAFT_FORMAT,
    formatVersion: FLOWCRAFT_FORMAT_VERSION,
    appVersion: meta.appVersion || (typeof window !== 'undefined' && window.FlowCraft && window.FlowCraft.version) || 'unknown',
    projectName: meta.projectName || (project && project.name) || '未命名项目',
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    nodeCount: project && Array.isArray(project.nodes) ? project.nodes.length : 0,
    assetCount: assets ? assets.length : 0,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(project, null, 2));

  const assetsFolder = zip.folder('assets');
  if (Array.isArray(assets)) {
    const used = new Set();
    for (const a of assets) {
      if (!a || !a.dataUrl || typeof a.dataUrl !== 'string' || !a.dataUrl.startsWith('data:')) continue;
      const ext = _mimeToExt((a.dataUrl.match(/:(.*?);/) || [, 'bin'])[1]);
      let name = (a.id || 'asset') + '.' + ext;
      let base = name;
      let i = 1;
      while (used.has(name)) { name = base.replace(/\.([^.]+)$/, '_' + (++i) + '.$1'); }
      used.add(name);
      const blob = dataUrlToBlob(a.dataUrl);
      if (blob) assetsFolder.file(name, blob);
    }
  }
  // 浏览器用 blob，Node 环境（若存在）回退 arraybuffer
  const type = typeof Blob !== 'undefined' ? 'blob' : 'arraybuffer';
  const out = await zip.generateAsync({ type, compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return out;
}

// 输入：File / Blob / ArrayBuffer；返回 { manifest, project, assets:[{name, dataUrl}] }
export async function importProjectZip(fileOrBlob) {
  const zip = await JSZip.loadAsync(fileOrBlob);
  const manifestFile = zip.file('manifest.json');
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('.flowcraft 缺少 project.json，文件损坏');
  const manifest = manifestFile ? JSON.parse(await manifestFile.async('string')) : { format: FLOWCRAFT_FORMAT };
  if (manifest.format && manifest.format !== FLOWCRAFT_FORMAT) {
    // 非致命：仅警告格式未知，仍可尝试
    console.warn('[FlowCraft] 项目文件格式标记为', manifest.format, '（预期', FLOWCRAFT_FORMAT, '）');
  }
  const project = JSON.parse(await projectFile.async('string'));
  const validation = validateProject(project);
  if (!validation.ok) throw new Error(formatProjectValidationError(validation));

  // 解析 assets/ 目录，转回 dataURL（用于校验/补充 project.json 中的引用式资产）
  const assets = [];
  const assetFiles = [];
  zip.folder('assets').forEach((relativePath, file) => { assetFiles.push({ relativePath, file }); });
  for (const { relativePath, file } of assetFiles) {
    const blob = await file.async('blob');
    const dataUrl = await blobToDataUrl(blob);
    assets.push({ name: relativePath, dataUrl });
  }
  return { manifest, project, assets };
}
