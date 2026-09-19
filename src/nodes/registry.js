// 阶段 2 · 节点数据规范（节点数据契约 / 权威来源）
// 目标：统一节点间数据契约，杜绝"连得上但跑不通"。
//
// 设计原则：
// 1. CONTRACT 是节点元数据的权威来源（端口类型、必填、可运行性、实现程度）。
// 2. 端口 type 字符串与 legacy NODE_TYPES 保持一致（image/text/video/audio/json/asset-reference），
//    保证连线校验与 legacy 的 fromType===toType 行为等价。
// 3. 运行前校验 beforeRun 默认对 production/demo 节点放行（保证行为等价，不破坏现有 verify 脚本）；
//    仅对 tier='stub'（未实现）节点硬拦截并明确提示，错误归档进 REGEN。

export const NodeContract = {
  // —— T2-1：6 类数据类型契约 ——
  DATA_TYPES: ['text', 'image', 'video', 'audio', 'json', 'asset-reference'],

  // 类型友好名（用于错误提示）
  TYPE_LABEL: {
    text: '文本',
    image: '图片',
    video: '视频',
    audio: '音频',
    json: '结构化数据',
    'asset-reference': '资产引用',
  },

  // —— T2-2：全部节点元数据契约 ——
  // tier: 'input'（输入类，不运行）| 'production'（真实接入）| 'local'（本地能力）| 'demo'（演示/模拟）| 'stub'（未实现）
  // runnable: 是否真正执行（输入节点=false；其余可运行节点=true）
  CONTRACT: {
    image: {
      label: '图片输入', tier: 'input', runnable: false,
      note: '上传或拖入图片，提供 image 数据',
      inputs: [], outputs: [{ type: 'image', label: '图片' }],
    },
    videoInput: {
      label: '视频输入', tier: 'input', runnable: false,
      note: '上传或选择视频，提供 video 数据',
      inputs: [], outputs: [{ type: 'video', label: '视频' }],
    },
    text: {
      label: '文本输入', tier: 'input', runnable: false,
      note: '输入提示词/文本，提供 text 数据',
      inputs: [], outputs: [{ type: 'text', label: '文本' }],
    },
    stateList: {
      label: '状态列表', tier: 'input', runnable: false,
      note: '角色 + 自定义状态列表，一键生成多个状态 AI 绘图节点',
      inputs: [], outputs: [{ type: 'text', label: '文本' }],
    },
    aiImage: {
      label: 'AI 绘图', tier: 'production', runnable: true,
      note: 'GPT Image 2 / 2.5 真实接入（文生图/图生图；2.5 需当前提供方支持）',
      inputs: [
        { type: 'image', label: '图片', required: false },
        { type: 'text', label: '提示词', required: false },
      ],
      outputs: [{ type: 'image', label: '图片' }],
    },
    designAgent: {
      label: '设计智能体', tier: 'local', runnable: true,
      note: '将文本需求和参考素材整理为结构化设计方案，可连接下游提示词/脚本节点',
      inputs: [
        { type: 'image', label: '参考图', required: false },
        { type: 'text', label: '需求', required: false },
      ],
      outputs: [{ type: 'text', label: '设计方案' }],
    },
    imageEdit: {
      label: '图片修正', tier: 'production', runnable: true,
      note: 'GPT Image Edit 真实接入（输入图片 + 修正说明）',
      inputs: [
        { type: 'image', label: '图片', required: true },
        { type: 'text', label: '修正说明', required: false },
      ],
      outputs: [{ type: 'image', label: '图片' }],
    },
    aiVideo: {
      label: 'AI 视频', tier: 'demo', runnable: true,
      note: '图生视频/文生视频，支持代理真实接入；未启用代理时回退演示态',
      inputs: [
        { type: 'image', label: '图片', required: false },
        { type: 'text', label: '提示词', required: false },
      ],
      outputs: [{ type: 'video', label: '视频' }],
    },
    upscale: {
      label: '智能超清', tier: 'production', runnable: true,
      note: '智能超清（有 Key/代理走图生图超清，无 Key 本地 2x 算法超清）',
      inputs: [{ type: 'image', label: '图片', required: false }],
      outputs: [{ type: 'image', label: '图片' }],
    },
    compare: {
      label: '对比', tier: 'local', runnable: true,
      note: '对比（canvas 真实拼接上游两张图）',
      inputs: [
        { type: 'image', label: '原图', required: false },
        { type: 'image', label: '结果', required: false },
      ],
      outputs: [{ type: 'image', label: '对比图' }],
    },
    videoBreak: {
      label: '视频拆解', tier: 'local', runnable: true,
      note: '拆解视频为关键帧/片段（真实抽帧，复用反推管线）',
      inputs: [{ type: 'video', label: '视频', required: false }],
      outputs: [
        { type: 'image', label: '关键帧' },
        { type: 'video', label: '片段' },
      ],
    },
    reversePrompt: {
      label: '反推提示词', tier: 'production', runnable: true,
      note: '视频反推中文电影级提示词（前端真实抽帧 + 视觉模型扩写）',
      inputs: [],
      outputs: [{ type: 'text', label: '提示词' }],
    },
    save: {
      label: '保存', tier: 'local', runnable: true,
      note: '保存（真实触发本地下载）',
      inputs: [
        { type: 'image', label: '图片', required: false },
        { type: 'text', label: '文本', required: false },
      ],
      outputs: [],
    },
    lineart: {
      label: '线稿', tier: 'production', runnable: true,
      note: '线稿（有 Key 模型线稿，无 Key 本地 Sobel 边缘提取）',
      inputs: [{ type: 'image', label: '参考图', required: false }],
      outputs: [{ type: 'image', label: '线稿' }],
    },
    aiSet: {
      label: 'AI 图集', tier: 'production', runnable: true,
      note: 'AI 图集（批量真实生成 N 张，无 Key 回退占位）',
      inputs: [
        { type: 'image', label: '参考图', required: false },
        { type: 'text', label: '提示词', required: false },
      ],
      outputs: [{ type: 'image', label: '图集' }],
    },
    material: {
      label: '材质', tier: 'production', runnable: true,
      note: '材质（图生图换材质，无 Key 透传原图）',
      inputs: [{ type: 'image', label: '参考图', required: false }],
      outputs: [{ type: 'image', label: '材质' }],
    },
    light: {
      label: '灯光', tier: 'production', runnable: true,
      note: '灯光（图生图重打光，无 Key 透传原图）',
      inputs: [{ type: 'image', label: '参考图', required: false }],
      outputs: [{ type: 'image', label: '效果图' }],
    },
    layout: {
      label: '布局方案', tier: 'production', runnable: true,
      note: '布局方案（参考图+需求图生图，无 Key 透传占位）',
      inputs: [
        { type: 'image', label: '参考图', required: false },
        { type: 'text', label: '需求', required: false },
      ],
      outputs: [{ type: 'image', label: '布局' }],
    },
    loop: {
      label: '循环', tier: 'demo', runnable: true,
      note: '批量重复执行下游',
      inputs: [
        { type: 'image', label: '图片', required: false },
        { type: 'text', label: '提示词', required: false },
      ],
      outputs: [{ type: 'image', label: '图集' }],
    },
    comfyui: {
      label: 'ComfyUI', tier: 'production', runnable: true,
      note: '本地 ComfyUI 文生图/图生图（真实调用）',
      inputs: [{ type: 'image', label: '输入图', required: false }],
      outputs: [{ type: 'image', label: '图片' }],
    },
    script: {
      label: '脚本', tier: 'local', runnable: true,
      note: '本地结构化脚本生成，可编辑、可保存、可连接下游（不调用外部 AI）',
      inputs: [{ type: 'text', label: '主题', required: true }],
      outputs: [{ type: 'text', label: '脚本' }],
      validate(params) {
        const s = (params && (params.script || params.subject)) || '';
        if (!String(s).trim()) return { ok: false, errors: ['脚本内容为空：需连接文本输入或填写主题'] };
        return { ok: true };
      },
    },
    footage: {
      label: '素材', tier: 'demo', runnable: true,
      note: 'Pexels 匹配（演示数据）',
      inputs: [{ type: 'text', label: '脚本', required: true }],
      outputs: [{ type: 'video', label: '素材集' }],
      validate() { return { ok: true }; },
    },
    voiceover: {
      label: '配音', tier: 'production', runnable: true,
      note: '配音（有 Key 走 /audio/speech 真实合成 mp3，无 Key 回落浏览器语音试听·不导出文件）',
      inputs: [{ type: 'text', label: '脚本', required: true }],
      outputs: [{ type: 'audio', label: '音频' }],
      validate(params) {
        const t = (params && params.text) || '';
        if (!String(t).trim()) return { ok: false, errors: ['配音文本为空：需连接脚本文本或填写文本'] };
        return { ok: true };
      },
    },
    subtitle: {
      label: '字幕', tier: 'local', runnable: true,
      note: '字幕（本地按上游脚本切分句读 + 估算时间轴）',
      inputs: [{ type: 'audio', label: '音频', required: true }],
      outputs: [{ type: 'text', label: '字幕' }],
    },
    bgm: {
      label: '配乐', tier: 'local', runnable: true,
      note: '配乐（OfflineAudioContext 本地按情绪真实合成 BGM / 上传本地音频，均可播放与级联合成）',
      inputs: [],
      outputs: [{ type: 'audio', label: '音频' }],
    },
    compose: {
      label: '合成', tier: 'demo', runnable: true,
      note: 'MoviePy 合成（演示数据）',
      inputs: [
        { type: 'video', label: '素材', required: true },
        { type: 'audio', label: '配音', required: false },
        { type: 'text', label: '字幕', required: false },
        { type: 'audio', label: '配乐', required: false },
      ],
      outputs: [{ type: 'video', label: '视频' }],
    },
    publish: {
      label: '发布', tier: 'demo', runnable: true,
      note: '多平台发布（演示数据）',
      inputs: [{ type: 'video', label: '视频', required: true }],
      outputs: [],
    },
  },

  // —— T2-3：连线合法性校验（输出端口 ↔ 输入端口，类型必须匹配）——
  validateConnection({ from, to }) {
    // from/to: { nodeType, portIdx, kind: 'output'|'input', portType }
    if (!from || !to) return { ok: false, reason: '缺失端口信息' };
    if (from.kind === to.kind) {
      return { ok: false, reason: '必须连接「输出端口」与「输入端口」（不能同类相连）' };
    }
    const out = from.kind === 'output' ? from : to;
    const inp = from.kind === 'input' ? from : to;
    const outMeta = this.CONTRACT[out.nodeType];
    const inMeta = this.CONTRACT[inp.nodeType];
    if (!outMeta || !inMeta) return { ok: false, reason: '未知节点类型' };
    const outPort = (outMeta.outputs || [])[out.portIdx];
    const inPort = (inMeta.inputs || [])[inp.portIdx];
    if (!outPort) return { ok: false, reason: `「${outMeta.label}」不存在输出端口 #${out.portIdx}` };
    if (!inPort) return { ok: false, reason: `「${inMeta.label}」不存在输入端口 #${inp.portIdx}` };

    if (outPort.type !== inPort.type) {
      const ot = this.TYPE_LABEL[outPort.type] || outPort.type;
      const it = this.TYPE_LABEL[inPort.type] || inPort.type;
      return {
        ok: false,
        reason: `类型不匹配：${ot} → ${it}。「${outMeta.label}」的输出「${outPort.label}」（${ot}）不能连「${inMeta.label}」的输入「${inPort.label}」（${it}）`,
      };
    }
    return { ok: true };
  },

  // —— T2-4：运行前校验。返回 { ok, reason }；stub 硬拦截，其余默认放行 ——
  beforeRun(node) {
    if (!node || !node.type) return { ok: true };
    const meta = this.CONTRACT[node.type];
    if (!meta) return { ok: true };
    if (meta.tier === 'stub') {
      // stub：默认（无代理）不可运行；但依赖服务端能力的节点（如真实视频 API）在启用 API 代理后视为可运行
      const proxyOn = !!(window && window.FlowCraft && window.FlowCraft.proxy && window.FlowCraft.proxy.enabled && window.FlowCraft.proxy.enabled());
      return { ok: false, stub: true, reason: `节点「${meta.label}」当前为「未实现（${meta.tier}）」：${meta.note}${proxyOn ? '（已启用 API 代理，可经代理真实运行）' : '，暂不可运行'}` };
    }
    if (typeof meta.validate === 'function') {
      const r = meta.validate(node.params || {}, node);
      if (r && r.ok === false) {
        return { ok: false, reason: (r.errors || []).join('；') || '参数校验未通过' };
      }
    }
    return { ok: true };
  },

  getNodeMeta(type) {
    return this.CONTRACT[type] || null;
  },

  listTypes() {
    return Object.keys(this.CONTRACT);
  },

  // 契约完整性自检（供测试/启动诊断）
  selfCheck() {
    const issues = [];
    for (const [type, meta] of Object.entries(this.CONTRACT)) {
      if (!Array.isArray(meta.inputs)) issues.push(`${type}: inputs 非数组`);
      if (!Array.isArray(meta.outputs)) issues.push(`${type}: outputs 非数组`);
      if (!['input', 'production', 'local', 'demo', 'stub'].includes(meta.tier)) issues.push(`${type}: 非法 tier=${meta.tier}`);
      if (typeof meta.runnable !== 'boolean') issues.push(`${type}: runnable 非布尔`);
      (meta.inputs || []).forEach((p, i) => {
        if (!this.DATA_TYPES.includes(p.type)) issues.push(`${type}: input#${i} 非法类型 ${p.type}`);
      });
      (meta.outputs || []).forEach((p, i) => {
        if (!this.DATA_TYPES.includes(p.type)) issues.push(`${type}: output#${i} 非法类型 ${p.type}`);
      });
    }
    return { ok: issues.length === 0, issues };
  },
};

// 供非 ESM 环境兜底（防止 tree-shake 移除）
if (typeof window !== 'undefined') {
  window.__NODE_CONTRACT__ = NodeContract;
}
