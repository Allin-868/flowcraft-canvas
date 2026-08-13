// 阶段 9.2 — ComfyUI 工作流 UI（浏览器侧）
// 处理「标准 ComfyUI API 格式」工作流的：模板库 / 解析为可编辑表单 / 表单值回填 / JSON 导入导出。
// 安全：ComfyUI 为本地自托管服务，无生产 Key；默认浏览器直连本地（127.0.0.1:8188）。
//       可选经 comfyProxyBase（用户自己的隧道/代理）执行 —— 纯 opt-in，非必须。

// ---------- 5+ 开箱模板（标准 ComfyUI API 格式：{nodeId:{class_type, inputs, _meta}}）----------
export const COMFY_TEMPLATES = {
  txt2img: {
    label: '文生图 (SDXL)',
    desc: 'Checkpoint + 空潜空间 + 正负提示词 + KSampler + VAE 解码 + 保存',
    workflow: {
      '3': { class_type: 'KSampler', inputs: { seed: 0, steps: 25, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] }, _meta: { title: '采样' } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' }, _meta: { title: '载入模型' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 }, _meta: { title: '空白潜空间' } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: '(masterpiece, best quality), 1girl, sunny day', clip: ['4', 1] }, _meta: { title: '正向提示词' } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, worst quality', clip: ['4', 1] }, _meta: { title: '负向提示词' } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] }, _meta: { title: 'VAE 解码' } },
      '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] }, _meta: { title: '保存图像' } },
    },
  },
  img2img: {
    label: '图生图 (SDXL)',
    desc: 'LoadImage + VAEEncode + KSampler(denoise) + 解码，需连接上游图片',
    workflow: {
      '10': { class_type: 'LoadImage', inputs: { image: '__COMFY_INPUT__' }, _meta: { title: '载入图像' } },
      '3': { class_type: 'KSampler', inputs: { seed: 0, steps: 25, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 0.6, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['12', 0] }, _meta: { title: '采样' } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' }, _meta: { title: '载入模型' } },
      '11': { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' }, _meta: { title: '载入 VAE' } },
      '12': { class_type: 'VAEEncode', inputs: { pixels: ['10', 0], vae: ['11', 0] }, _meta: { title: 'VAE 编码' } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: '(masterpiece), 1girl', clip: ['4', 1] }, _meta: { title: '正向提示词' } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres', clip: ['4', 1] }, _meta: { title: '负向提示词' } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['11', 0] }, _meta: { title: 'VAE 解码' } },
      '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] }, _meta: { title: '保存图像' } },
    },
  },
  upscale: {
    label: '超清放大',
    desc: 'LoadImage + ImageScaleBy + 保存，需连接上游图片',
    workflow: {
      '10': { class_type: 'LoadImage', inputs: { image: '__COMFY_INPUT__' }, _meta: { title: '载入图像' } },
      '20': { class_type: 'ImageScaleBy', inputs: { image: ['10', 0], scale_by: 2, method: 'lanczos' }, _meta: { title: '放大' } },
      '9': { class_type: 'SaveImage', inputs: { images: ['20', 0] }, _meta: { title: '保存图像' } },
    },
  },
  sdxl: {
    label: 'SDXL 精炼 (refiner)',
    desc: 'base + refiner 两段采样，质量更高',
    workflow: {
      '3': { class_type: 'KSampler', inputs: { seed: 0, steps: 20, cfg: 6, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] }, _meta: { title: 'base 采样' } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' }, _meta: { title: '载入 base' } },
      '13': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_refiner_1.0.safetensors' }, _meta: { title: '载入 refiner' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 }, _meta: { title: '空白潜空间' } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: '(masterpiece), 1girl', clip: ['4', 1] }, _meta: { title: '正向' } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres', clip: ['4', 1] }, _meta: { title: '负向' } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] }, _meta: { title: 'VAE 解码' } },
      '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] }, _meta: { title: '保存图像' } },
    },
  },
  controlnet: {
    label: 'ControlNet 姿态控制',
    desc: 'LoadImage + ControlNetLoader + 应用控制网，需连接上游图片',
    workflow: {
      '10': { class_type: 'LoadImage', inputs: { image: '__COMFY_INPUT__' }, _meta: { title: '控制图' } },
      '3': { class_type: 'KSampler', inputs: { seed: 0, steps: 25, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['14', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] }, _meta: { title: '采样' } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' }, _meta: { title: '载入模型' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 }, _meta: { title: '空白潜空间' } },
      '14': { class_type: 'ControlNetLoader', inputs: { control_net_name: 'control_v11p_sd15_openpose.pth' }, _meta: { title: '载入 ControlNet' } },
      '15': { class_type: 'ControlNetApply', inputs: { conditioning: ['6', 0], control_net: ['14', 0], image: ['10', 0], strength: 1.0 }, _meta: { title: '应用控制网' } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: '(masterpiece), 1girl', clip: ['4', 1] }, _meta: { title: '正向' } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres', clip: ['4', 1] }, _meta: { title: '负向' } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] }, _meta: { title: 'VAE 解码' } },
      '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] }, _meta: { title: '保存图像' } },
    },
  },
  lora: {
    label: 'LoRA 风格叠加',
    desc: 'Load LoRA 注入模型/CLIP 后采样',
    workflow: {
      '3': { class_type: 'KSampler', inputs: { seed: 0, steps: 25, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['16', 0], positive: ['17', 0], negative: ['7', 0], latent_image: ['5', 0] }, _meta: { title: '采样' } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' }, _meta: { title: '载入模型' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 }, _meta: { title: '空白潜空间' } },
      '16': { class_type: 'LoraLoader', inputs: { model: ['4', 0], clip: ['4', 1], lora_name: 'my_style.safetensors', strength_model: 0.8, strength_clip: 0.8 }, _meta: { title: '载入 LoRA' } },
      '17': { class_type: 'CLIPTextEncode', inputs: { text: '(masterpiece), 1girl', clip: ['16', 1] }, _meta: { title: '正向' } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres', clip: ['4', 1] }, _meta: { title: '负向' } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] }, _meta: { title: 'VAE 解码' } },
      '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] }, _meta: { title: '保存图像' } },
    },
  },
};

// ---------- 校验 ----------
export function isValidWorkflow(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (!keys.length) return false;
  return keys.every((k) => {
    const n = obj[k];
    return n && typeof n === 'object' && typeof n.class_type === 'string' && n.inputs && typeof n.inputs === 'object';
  });
}

// ---------- 解析为可编辑表单（每个节点的原始输入提取为字段；连线引用 [node,slot] 排除）----------
// 返回 { nodes:[{ id, class_type, fields:[{name, value, type}] }] }
export function parseWorkflow(json) {
  const obj = (typeof json === 'string') ? JSON.parse(json) : json;
  if (!isValidWorkflow(obj)) throw new Error('非标准 ComfyUI 工作流：每个节点需含 class_type 与 inputs');
  const nodes = [];
  Object.keys(obj).forEach((id) => {
    const n = obj[id];
    const fields = [];
    Object.keys(n.inputs || {}).forEach((name) => {
      const v = n.inputs[name];
      if (Array.isArray(v)) return; // 连线引用，不可在表单直接编辑
      fields.push({
        name,
        value: v,
        type: typeof v === 'number' ? 'number' : (typeof v === 'boolean' ? 'boolean' : 'string'),
      });
    });
    nodes.push({ id, class_type: n.class_type, fields });
  });
  return { nodes };
}

// buildForm 即 parseWorkflow 的别名（UI 用途）
export const buildForm = parseWorkflow;

// ---------- 表单值回填（edits: { nodeId: { fieldName: value } }，仅覆盖原始输入，不影响连线）----------
export function applyFormValues(json, edits) {
  const obj = (typeof json === 'string') ? JSON.parse(json) : JSON.parse(JSON.stringify(json));
  if (!isValidWorkflow(obj)) throw new Error('工作流非法，无法回填');
  edits = edits || {};
  Object.keys(edits).forEach((nodeId) => {
    const node = obj[nodeId];
    if (!node || !node.inputs) return;
    const vals = edits[nodeId] || {};
    Object.keys(vals).forEach((field) => {
      if (!(field in node.inputs)) return;
      const cur = node.inputs[field];
      if (Array.isArray(cur)) return; // 连线引用不可改
      let nv = vals[field];
      if (typeof cur === 'number') nv = Number(nv);
      else if (typeof cur === 'boolean') nv = !!nv;
      node.inputs[field] = nv;
    });
  });
  return obj;
}

// ---------- 导入 / 导出（标准 ComfyUI API 格式 JSON）----------
export function importWorkflow(text) {
  let obj;
  try { obj = JSON.parse(String(text || '')); }
  catch (e) { throw new Error('JSON 解析失败：' + e.message); }
  if (!isValidWorkflow(obj)) throw new Error('非标准 ComfyUI 工作流格式（需 {节点id:{class_type, inputs}}）');
  return obj;
}

export function exportWorkflow(json) {
  const obj = (typeof json === 'string') ? JSON.parse(json) : json;
  if (!isValidWorkflow(obj)) throw new Error('工作流非法，无法导出');
  return JSON.stringify(obj, null, 2);
}

// ---------- 模板库 ----------
export function listTemplates() {
  return Object.keys(COMFY_TEMPLATES).map((k) => ({ id: k, label: COMFY_TEMPLATES[k].label, desc: COMFY_TEMPLATES[k].desc }));
}
export function getTemplate(id) {
  return COMFY_TEMPLATES[id] ? JSON.parse(JSON.stringify(COMFY_TEMPLATES[id].workflow)) : null;
}

// 供 Node 单测 / 调试引用
if (typeof window !== 'undefined') {
  window.FlowCraft = window.FlowCraft || {};
  window.FlowCraft.comfyui = {
    templates: COMFY_TEMPLATES,
    listTemplates, getTemplate,
    isValidWorkflow, parseWorkflow, buildForm, applyFormValues, importWorkflow, exportWorkflow,
  };
}
