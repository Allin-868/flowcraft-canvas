
//=============================================================================
// FlowCraft v2 — AI 工作流编辑器
// 混合渲染：gridCanvas(网点) + edgeCanvas(贝塞尔连线) + nodeLayer(DOM节点)
//=============================================================================

//================ 1. 节点类型定义 (匹配设计系统规范) ================
const APP_VERSION = '3.0';

const NODE_TYPES = {
  image:    { label: '图片输入', desc: '上传或拖入图片',     color: 'var(--node-image)',    colorRaw: '#5B8DEF', inputs: [], outputs: [{type:'image',label:'图片'}] },
  videoInput: { label: '视频输入', desc: '上传或选择视频',   color: 'var(--node-video-input)', colorRaw: '#E0533D', inputs: [], outputs: [{type:'video',label:'视频'}], defaultParams: { name: '示例视频.mp4', duration: '00:12' } },
  text:     { label: '文本输入', desc: '输入提示词文本',     color: 'var(--node-text)',     colorRaw: '#5BC07A', inputs: [], outputs: [{type:'text',label:'文本'}] },
  stateList: { label: '状态列表', desc: '角色 + 自定义状态，一键生成状态节点', color: 'var(--node-text)', colorRaw: '#4ECDC4', inputs: [], outputs: [{type:'text',label:'文本'}], defaultParams: { states: '日常着装\n华丽晚礼服\n东方古风汉服\n雨中撑伞街头' } },
  aiImage:  { label: 'AI 绘图',  desc: '文生图 / 图生图',    color: 'var(--node-ai-image)', colorRaw: '#9B59F0', inputs: [{type:'image',label:'图片'},{type:'text',label:'提示词'}], outputs: [{type:'image',label:'图片'}] },
  imageEdit: { label: '图片修正', desc: '基于图片进行修正',    color: 'var(--node-ai-image)', colorRaw: '#8E4FD8', inputs: [{type:'image',label:'图片'},{type:'text',label:'修正说明'}], outputs: [{type:'image',label:'图片'}], defaultParams: { aspect: '1:1', resolution: '高清1K', model: 'GPT Image 2' } },
  aiVideo:  { label: 'AI 视频',  desc: '图生视频 / 文生视频', color: 'var(--node-ai-video)', colorRaw: '#C76BF7', inputs: [{type:'image',label:'图片'},{type:'text',label:'提示词'}], outputs: [{type:'video',label:'视频'}], defaultParams: { model: '可灵 2.0', aspect: '9:16', duration: '5秒', resolution: '高清1K', mode: '异步' } },
  upscale:  { label: '智能超清', desc: '图片无损放大',       color: 'var(--node-upscale)',  colorRaw: '#F2C66B', inputs: [{type:'image',label:'图片'}], outputs: [{type:'image',label:'图片'}] },
  compare:  { label: '对比',     desc: '左右对比展示',       color: 'var(--node-compare)',  colorRaw: '#E15353', inputs: [{type:'image',label:'原图'},{type:'image',label:'结果'}], outputs: [{type:'image',label:'对比图'}] },
  videoBreak: { label: '视频拆解', desc: '拆解视频为关键帧/片段', color: 'var(--node-video-break)', colorRaw: '#3DA5E0', inputs: [{type:'video',label:'视频'}], outputs: [{type:'image',label:'关键帧'},{type:'video',label:'片段'}], defaultParams: { frames: 6, segments: 3 } },
  reversePrompt: { label: '反推提示词', desc: '视频反推中文电影级提示词', color: 'var(--node-video-break)', colorRaw: '#7C5CFF', inputs: [], outputs: [{type:'text',label:'提示词'}], defaultParams: { frameCount: 5, frameMode: 'content', history: [], visionModel: 'gpt-4o-mini' } },
  save:     { label: '保存',     desc: '下载到本地',         color: 'var(--node-save)',     colorRaw: '#9AA0A8', inputs: [{type:'image',label:'图片'},{type:'text',label:'文本'}], outputs: [], defaultParams: { filename: '' } },
  lineart:  { label: '线稿',     desc: '提取/上传线稿图',    color: 'var(--node-lineart)',  colorRaw: '#F2A0E0', inputs: [{type:'image',label:'参考图'}], outputs: [{type:'image',label:'线稿'}] },
  aiSet:    { label: 'AI 图集',  desc: '批量生成图片集',     color: 'var(--node-ai-set)',   colorRaw: '#FF8A65', inputs: [{type:'image',label:'参考图'},{type:'text',label:'提示词'}], outputs: [{type:'image',label:'图集'}] },
  material: { label: '材质',     desc: '材质贴图与参数',     color: 'var(--node-material)', colorRaw: '#8D6E63', inputs: [{type:'image',label:'参考图'}], outputs: [{type:'image',label:'材质'}] },
  light:    { label: '灯光',     desc: '灯光效果与氛围',     color: 'var(--node-light)',    colorRaw: '#FFD54F', inputs: [{type:'image',label:'参考图'}], outputs: [{type:'image',label:'效果图'}] },
  layout:   { label: '布局方案', desc: '生成平面布局方案',   color: 'var(--node-layout)',   colorRaw: '#26A69A', inputs: [{type:'image',label:'参考图'},{type:'text',label:'需求'}], outputs: [{type:'image',label:'布局'}] },
  loop:     { label: '循环',     desc: '批量重复执行下游',   color: 'var(--node-loop)',     colorRaw: '#3FB8AF', inputs: [{type:'image',label:'图片'},{type:'text',label:'提示词'}], outputs: [{type:'image',label:'图集'}], defaultParams: { count: 4, start: 1, step: 1, mode: 'serial' } },
  comfyui:  { label: 'ComfyUI',  desc: '本地 ComfyUI 文生图 / 图生图', color: 'var(--node-comfyui)', colorRaw: '#6C5CE7', inputs: [{type:'image',label:'输入图'}], outputs: [{type:'image',label:'图片'}], defaultParams: { addr: 'http://127.0.0.1:8188', wf: 'txt2img', fields: {}, customJson: '' } },

  // —— 视频生成管线节点 (MoneyPrinterTurbo 画布化) ——
  script:    { label: '脚本',  desc: 'AI 写稿',        color: 'var(--node-script)',    colorRaw: '#7F77DD', inputs: [{type:'text',label:'主题'}], outputs: [{type:'text',label:'脚本'}], defaultParams: { script: '在这个 AI 改变一切的时代，有一种职业正在悄然消失。它曾是人类最古老的技艺之一，如今正面临着前所未有的挑战。从清晨到日暮，那些熟悉的声音和画面，正在被一行行代码所替代。但也许，这正是重新定义创造力的开始。', wordCount: 234 } },
  footage:   { label: '素材',  desc: 'Pexels 匹配',    color: 'var(--node-footage)',   colorRaw: '#378ADD', inputs: [{type:'text',label:'脚本'}], outputs: [{type:'video',label:'素材集'}], defaultParams: { items: [{ seed: 101, duration: '3s' }, { seed: 102, duration: '5s' }, { seed: 103, duration: '4s' }, { seed: 104, duration: '6s' }] } },
  voiceover: { label: '配音',  desc: 'Edge TTS',       color: 'var(--node-voiceover)', colorRaw: '#1D9E75', inputs: [{type:'text',label:'脚本'}], outputs: [{type:'audio',label:'音频'}], defaultParams: { text: '在这个AI改变一切的时代，有一种职业正在悄然消失...', lang: 'zh-CN', speed: '1.0', voice: '晓晓', duration: '45s' } },
  subtitle:  { label: '字幕',  desc: '自动生成',       color: 'var(--node-subtitle)',  colorRaw: '#888780', inputs: [{type:'audio',label:'音频'}], outputs: [{type:'text',label:'字幕'}], defaultParams: { lines: [{ time: '00:00', text: '在这个AI改变一切的时代...' }, { time: '00:05', text: '改变一切的时代...' }, { time: '00:10', text: '有一种职业...' }, { time: '00:15', text: '正在悄然消失...' }], style: '白色 · 底部居中 · 24px' } },
  bgm:       { label: '配乐',  desc: 'BGM 库',         color: 'var(--node-bgm)',       colorRaw: '#BA7517', inputs: [], outputs: [{type:'audio',label:'音频'}], defaultParams: { name: 'Inspiring Future', duration: '120s', volume: 30, mood: '激励/科技' } },
  compose:   { label: '合成',  desc: 'MoviePy',        color: 'var(--node-compose)',   colorRaw: '#D85A30', inputs: [{type:'video',label:'素材'},{type:'audio',label:'配音'},{type:'text',label:'字幕'},{type:'audio',label:'配乐'}], outputs: [{type:'video',label:'视频'}], defaultParams: { progress: 100, resolution: '1080×1920', duration: '45s', size: '12.3MB' } },
  publish:   { label: '发布',  desc: '多平台',         color: 'var(--node-publish)',   colorRaw: '#639922', inputs: [{type:'video',label:'视频'}], outputs: [], defaultParams: { platforms: [{ name: 'TikTok', status: 'published' }, { name: 'YouTube', status: 'published' }, { name: 'Instagram', status: 'pending' }, { name: '小红书', status: 'pending' }] } }
};

// 节点库图标 (内联 SVG)
const NODE_ICONS = {
  image:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M2 10l3.5-3.5L8 9l2.5-2.5L14 10"/></svg>',
  videoInput: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2"/><path d="M4.5 8v0M6.5 8v0" stroke-linecap="round"/></svg>',
  videoBreak: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M6 3v10M10 3v10" stroke-dasharray="1.5 1.5"/><rect x="2.6" y="3.6" width="2.8" height="8.8" rx="0.5"/><rect x="10.6" y="3.6" width="2.8" height="8.8" rx="0.5"/></svg>',
  reversePrompt: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 5l-2 3 2 3M11 5l2 3-2 3"/><path d="M9 4l-2 8"/></svg>',
  text:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10M3 7h10M3 11h6"/></svg>',
  stateList: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M3 8h10M3 12h10"/><circle cx="2" cy="4" r="0.8" fill="currentColor"/><circle cx="2" cy="8" r="0.8" fill="currentColor"/><circle cx="2" cy="12" r="0.8" fill="currentColor"/></svg>',
  aiImage: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6l1.5 2 1.5-1.5L11 10M6 5.5h.01"/></svg>',
  imageEdit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5.2 11.2l5.8-5.8 1.3 1.3-5.8 5.8H5.2v-1.3z"/><path d="M9.6 4.6l1.8 1.8"/></svg>',
  aiVideo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="9" height="10" rx="1.5"/><path d="M11 7l3-2v6l-3-2"/></svg>',
  upscale: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v5M5.5 4.5L8 2l2.5 2.5M3 11h10M4 14V9M12 14V9M4 9h8"/></svg>',
  compare: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M8 3v10" stroke-dasharray="1.5 1.5"/></svg>',
  save:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h8l2 2v8H3z"/><path d="M5 3v4h5V3M5 14v-4h6v4"/></svg>',
  lineart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M4 12l3-8 2 5 3-3"/></svg>',
  aiSet:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
  material:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12"/></svg>',
  light:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414"/></svg>',
  layout:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 5h12M5 2v12M9 5v9M2 9h3"/></svg>',
  script:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2h6l2 2v10H4z"/><path d="M6 6h4M6 9h4M6 12h2"/></svg>',
  footage:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="4.5" cy="5.5" r="0.5" fill="currentColor"/><circle cx="11.5" cy="5.5" r="0.5" fill="currentColor"/><circle cx="4.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="11.5" cy="10.5" r="0.5" fill="currentColor"/><path d="M6.5 6.5l3 1.5-3 1.5z" fill="currentColor" stroke="none"/></svg>',
  voiceover: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="2" width="4" height="7" rx="2"/><path d="M4 8a4 4 0 008 0M8 12v2"/></svg>',
  subtitle:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M4 10h3M9 10h3M4 7.5h8"/></svg>',
  bgm:       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 11V3l6-1v8"/><circle cx="4.5" cy="11" r="1.5"/><circle cx="10.5" cy="10" r="1.5"/></svg>',
  compose:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="5" height="5" rx="1"/><rect x="9" y="3" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="4" rx="1"/><path d="M9 9h5v4H9z"/><path d="M11 6l2 2M11 11l2-2"/></svg>',
  publish:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12V3M5 6l3-3 3 3M3 12v2h10v-2"/></svg>',
  loop:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8a5 5 0 1 1 1.6 3.7"/><path d="M4 12V8h4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  comfyui:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M8 5v6" stroke-linecap="round"/><circle cx="8" cy="8" r="1.4"/></svg>'
};

// 底部工具栏图标
const TOOLBAR_ICONS = {
  copy:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3h8"/></svg>',
  canvas:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 9l3.5-3.5L8 8l2.5-2.5L14 9"/></svg>',
  chat:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10v7H6l-3 3z"/></svg>',
  storyboard: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="12" height="8" rx="1"/><path d="M6 4v8M10 4v8"/></svg>'
};

//================ 2. CSS 变量读取工具（供 Canvas 绘制使用） ================
function getCSSVar(name) {
  // 主题变量定义在 body[data-theme] 上，必须读 body（含 :root 继承值）
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// 解析 rgba 字符串中的 RGB 分量，用于动态 alpha 重构
function parseRGB(cssVar) {
  const m = cssVar.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? { r: m[1], g: m[2], b: m[3] } : { r: 255, g: 255, b: 255 };
}

const COLORS = {
  bgDeepest:  getCSSVar('--bg-deepest'),
  primary:    getCSSVar('--color-primary'),
  danger:     getCSSVar('--color-danger'),
  success:    getCSSVar('--color-success'),
  gridOrigin: getCSSVar('--grid-origin'),
  gridDotRGB: parseRGB(getCSSVar('--grid-line-minor')),
};

//================ 3. Camera 类 ================
class Camera {
  constructor() {
    this.x = 0; this.y = 0;       // 世界原点的屏幕偏移
    this.zoom = 1;                // 缩放系数
    this.MIN_ZOOM = 0.2;
    this.MAX_ZOOM = 2.0;
  }

  worldToScreen(wx, wy) {
    return { x: wx * this.zoom + this.x, y: wy * this.zoom + this.y };
  }
  screenToWorld(sx, sy) {
    return { x: (sx - this.x) / this.zoom, y: (sy - this.y) / this.zoom };
  }

  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += (after.x - before.x) * this.zoom;
    this.y += (after.y - before.y) * this.zoom;
  }

  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
    if (typeof renderMinimap === 'function') renderMinimap();
  }
}

//================ 3. 数据模型 ================
let nodeIdSeq = 1;

const DEFAULT_NODE_PARAMS = { model: 'nanoBananaPro', aspect: '1:1', count: '1张', resolution: '高清1K', mode: '异步' };

// —— 提示词库（来源：提示词推荐.md，10 大分类沉淀）——
const PROMPT_LIBRARY = {
  '常用': ['大师作品','最好画质','更高质量','高细节','超高分辨率','8k分辨率','景深','全景','长焦镜头','微距镜头','全身镜头','中景镜头','七分身镜头','半身像','写实肖像','第一人称视角','鱼眼镜头','部分水下拍摄','精致的五官','完美的脸','发光皮肤','抽象背景','蒸汽朋克','赛博朋克'],
  '人物': ['单人','多个女孩','双胞胎','三胞胎','兄弟姐妹','女性','男性','女孩','男孩','正太','萝莉','美少女','美少男','辣妹','大小姐','Q版人物','胖子','伪娘','天使','魔鬼','迷你女孩','非人','雌小鬼','怪物','老人','富豪','乞丐','巨人','侏儒','小丑','奴隶','雪女','酋长','女王','女神','公主','王子','新娘','新郎','肌肉男','偶像','兔女郎','怪物女孩','狐狸女孩','狼女孩','猫女孩','木偶','黏土手办'],
  '角色': ['救生员','拳击手','科学家','运动员','职场女性','和尚','杂技演员','修女','护士','空姐','学生','女服务员','老师','赛车手','警察','士兵','啦啦队','男演员','女演员','间谍','特工','刺客','诗人','日本武士','舞女','摩托车手','黑客','魔术师','侦探','人偶','女仆','飞行员','潜水员','酒吧审查员','传教士','消防员','守门员','厨师','宇航员','收银员','邮递员','咖啡师','隐士','牧羊人','宝可梦','泰迪熊','马里奥','皮卡丘','新世纪福音战士','初音未来','哈利波特','哆啦A梦','圣斗士星矢','五条悟','复仇者联盟','神奇女侠','美国队长','蜡笔小新','灌篮高手','孙悟空','女巫','忍者','吸血鬼','骑士','魔法少女','半兽人','德鲁伊','妖精','小精灵','兽人','美人鱼','假面骑士','魔导师','蜘蛛侠','圣诞老人'],
  '五官': ['浓眉','眉毛翘起','短眉毛','V字眉','空洞眼睛','睁大眼睛','闭上一只眼','半闭眼睛','渐变眼','水汪汪大眼','翻白眼','斗鸡眼','猫眼','布满血丝的眼睛','发光眼睛','吊眼角','垂眼角','恶魔眼','收缩的瞳孔','魔瞳','蛇瞳','闪闪发光瞳','花形瞳','爱心瞳','异色瞳','美瞳','长睫毛','彩色睫毛','眼下痣','栗子嘴','厚嘴唇','嘴唇浮肿','口红','心形嘴','嘟嘴','张嘴','闭嘴','鲨鱼嘴','分开嘴唇','嘴下痣','动物耳朵','猫耳朵','狗耳朵','狐狸耳朵','兔子耳朵','熊耳朵','胡须','小胡子','山羊胡','长鬓角','尖牙','虎牙','咬紧牙关'],
  '表情': ['无表情','脸色苍白','2D脸红','脸红','两眼发直','青筋凸起','尴尬','傲慢','郁闷','畏缩','烦恼','阴暗脸','疼痛','尖叫','叹息','紧张','困惑','害怕','喝醉','哭','悲伤','生气','害羞','严肃','鄙夷','疯狂','黑化','得意','思考中','扬眉','轻皱眉','皱眉','调皮脸','做鬼脸','流鼻血','困','眯眼','流口水','微笑','假笑','挑逗笑容','疯狂笑容','邪恶笑容','单侧嘴角上扬','诱人笑容','露齿笑','大笑'],
  '头发': ['短发','中发','长发','头发过肩','白发','金发','银发','灰发','棕发','黑发','紫发','红发','蓝发','绿发','粉发','橙发','挑染','彩发','彩虹发','刘海','交叉刘海','眉间刘海','齐刘海','斜刘海','不对称刘海','编织刘海','短马尾','侧马尾辫','前马尾辫','分裂马尾辫','低马尾辫','侧边辫子','辫子','双辫子','马尾辫','编织马尾','法式辫','麻花辫','高马尾','扎头发','单侧发髻','卷发','直发','波浪头','波波头','侧分','雷鬼头','蓬巴杜发型','莫西干头','锅盖头','呆毛','天线呆毛','心形呆毛','公主卷','翼状发','蓬发','凌乱发','露颈盘发','编织发髻','公主切','妹妹切','刺猬头','盘发','精灵短发','长发绺','爆炸头','秃头','双丸子头','美式寸头','大体积蓬松头发','闪亮的头发','发光的头发','眼睛间的头发','撩到耳后'],
  '装饰': ['发带','头巾','动物头巾','蝴蝶结发饰','新月发饰','洛丽塔发饰','羽毛发饰','头花','发髻','发夹','发箍','发圈','发饰','发棒','心形发饰','手链','项圈','金属项圈','戒指','腕带','吊坠','胸针','圈形耳环','手镯','耳钉','旭日形首饰','珍珠手链','耳坠','木偶戒指','胸花','蓝宝石胸针','珠宝首饰','项链','丝带','丝带饰边','蕾丝饰边','裙撑','护手','领巾','红领巾','肩章','臂带','臂镯','细肩带','般若面具','面纱','新娘面纱','皇冠','迷你皇冠','耳罩','飞行员太阳镜','无边框眼镜','半无框眼镜','太阳镜','风镜','独眼眼罩','黑色眼罩','铁棘','光环','口罩','创口贴','指甲油','玩偶关节','机械义肢','机械腿','沙滩巾','雨披','浓妆'],
  '服装': ['过手袖','背心','白衬衫','水手衬衫','T恤','毛衣','夏日长裙','连帽衫','毛领','兜帽斗篷','夹克','皮夹克','探险家夹克','兜帽','牛仔夹克','高领夹克','消防员夹克','透明夹克','战壕大衣','实验室外套','羽绒服','防弹盔甲','防弹衣','大衣','粗呢大衣','透视装','燕尾服','女仆装','水手服','学生服','职场制服','西装','军装','礼服','汉服','旗袍','和服','运动服','工装服','婚纱','银色连衣裙','长袍','围裙','快餐制服','JK制服','健身服','巫女服','海军陆战队服','无袖连衣裙','雨衣','机甲衣','巫师法袍','刺客装束','牛仔短裤','百褶裙','热裤','铅笔裙','皮裙','黑色紧身裤','和服下的裙子','褶边','花边','哥特风格','洛丽塔风格','西部风格','湿身','露单肩','露双肩','格子花纹','横条花纹','披甲','盔甲','金属盔甲','狂战士铠甲','腰带','围巾','披肩','皮草披肩'],
  '鞋饰': ['棒球帽','针织帽','拿破仑帽','太阳帽','遮阳帽','圆顶礼帽','报童帽','渔夫帽','侦探帽','牛仔帽','厨师帽','军官帽','圣诞帽','派对帽','小丑帽','安全帽','棒头盔','橄榄球头盔','动物头盔','女巫帽','贝雷帽','鸭舌帽','草帽','裸足','靴子','马丁靴','脚踝靴','系带靴','战斗靴','装甲靴','过膝靴','防水橡胶靴','皮靴','雪地靴','圣诞靴','鞋子','厚底鞋','尖头鞋','芭蕾舞鞋','运动鞋','旱冰鞋','溜冰鞋','钉鞋','高跟鞋','玛丽珍鞋','乐福鞋','女式学生鞋','凉鞋','木屐','拖鞋','人字拖','不穿袜子','短袜','日式厚底短袜','丝袜','圣诞袜','暖腿袜','荷叶边袜子','丝带边袜子','闪亮袜子','褶边长筒袜','过膝袜','渔网袜','堆堆袜','裤袜','蕾丝裤袜','罗纹裤袜','湿连裤袜','格子裤袜','透视裤袜','连裤袜','撕裂的连裤袜','单腿连裤袜','荷叶边连裤袜','柳丁吊袜带','吊袜带','大腿系带','包扎腿'],
  '尾&翅&角': ['宝可梦尾巴','皮卡丘尾巴','水獭尾巴','蝎尾','鹿尾','黄鼠狼尾巴','羊驼尾巴','恐龙尾巴','企鹅尾巴','羊尾巴','山羊尾巴','海狸尾巴','小熊猫尾巴','豺尾巴','食蚁兽尾巴','土狼尾巴','猎豹尾巴','熊猫尾巴','天使尾巴','蝴蝶翅膀','昆虫翅膀','蝙蝠翅膀','鸟翼','羽翼','妖精翅膀','龙之翼','恶魔之翼','火焰翅膀','机械翅膀','冰翅','冰火之翼','羚羊角','山羊角','羊角','奶牛角','公牛角','鬼角','断角','机械角','恶魔之角','龙之角']
};

class WorkflowNode {
  constructor(type, x, y) {
    this.id = `n${nodeIdSeq++}`;
    this.type = type;
    this.def = NODE_TYPES[type] || NODE_TYPES.image;
    this.x = x;
    this.y = y;
    this.width = 280;
    this.height = 200;
    if (type === 'aiImage' || type === 'imageEdit') {
      this.width = 220;
      this.height = 160;
    }
    this.title = this.def.label;
    this.thumb = null;
    this.uploadedImage = ''; // 仅 image：完整存档中的原始图片 dataURL，裁剪/缩略不会覆盖
    this.croppedImage = '';  // 仅 image：裁剪后的当前生效图（保留原图 uploadedImage）
    this.cropMeta = null;    // 仅 image：最近一次裁剪元数据（便于恢复/追踪）
    this.uploadedVideo = ''; // 仅 videoInput：完整存档中的原始视频 dataURL，轻量存档会剥离
    this.prompt = '';
    this.params = this.def.defaultParams
      ? JSON.parse(JSON.stringify(this.def.defaultParams))
      : { ...DEFAULT_NODE_PARAMS };
    this.status = 'idle'; // idle | running | done | error
    // 数据流动骨架 (A1)：运行后存储真实数据载荷
    this.inputsData = [];   // 与 def.inputs 对齐，存放上游传入的载荷
    this.outputsData = [];  // 与 def.outputs 对齐，存放本节点产出的载荷
    this.refImages = [];    // 面板内直传的参考图 [{name, src}]，随下游 AI 生图一起发送
    this.refVideos = [];    // AI 视频节点的参考视频 [{name, src}]，双击上传
    this.charDesc = '';      // 文本节点独立「角色描述」输入框（与固定提示词分区），生图时前置拼接到 prompt
    this.stateMeta = null;   // 角色状态节点元数据：{ sourceId, label, index, batchId, batchIndex, batchTotal }
    this.failureReason = ''; // 最近一次可读失败原因（随工作流持久化）
    this.genMeta = null;     // 最近一次成功生成的参数快照（随工作流持久化）
    this._lastError = '';    // 兼容旧执行器的内部错误字段
    this.semanticMode = getNodeSemanticTier(type);
    this.resultMode = 'pending';
    this.previewOnly = false;
    this.previewSourceId = '';
    this.el = null;
  }
}

function copyStateMeta(meta) {
  if (!meta) return null;
  return {
    ...meta,
    batchProgress: meta.batchProgress ? { ...meta.batchProgress } : undefined,
  };
}

// 生成元数据只保存文本、参数和引用摘要，不保存参考图 dataURL。
function copyGenMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  return {
    ...meta,
    references: meta.references ? {
      count: Number(meta.references.count) || 0,
      names: Array.isArray(meta.references.names) ? [...meta.references.names] : [],
      missing: Array.isArray(meta.references.missing) ? [...meta.references.missing] : [],
    } : undefined,
    stateMeta: meta.stateMeta ? copyStateMeta(meta.stateMeta) : undefined,
  };
}

// 统一节点状态写入，避免旧路径使用 failure 或遗漏失败原因。
function setNodeStatus(node, status, reason = '') {
  if (!node) return;
  const normalized = status === 'failure' ? 'error' : status;
  node.status = normalized;
  if (normalized === 'error') {
    node.failureReason = String(reason || node.failureReason || node._lastError || '运行失败');
    node._lastError = node.failureReason;
  } else if (normalized === 'running') {
    node.failureReason = '';
    node._lastError = '';
  } else if (normalized === 'done') {
    node.failureReason = '';
    node._lastError = '';
  }
  if (node.stateMeta) node.stateMeta.failureReason = node.failureReason || '';
  if (typeof refreshCharacterBatchProgress === 'function' && node.stateMeta) {
    refreshCharacterBatchProgress(node);
  }
}

function newCharacterBatchId(sourceId) {
  return 'charbatch_' + String(sourceId || 'node') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function getCharacterBatchNodes(batchId) {
  if (!batchId) return [];
  return [...workflow.nodes.values()].filter(n => isCharacterStateNode(n) && n.stateMeta.batchId === batchId);
}

function refreshCharacterBatchProgress(nodeOrBatch) {
  const meta = nodeOrBatch && nodeOrBatch.stateMeta ? nodeOrBatch.stateMeta : nodeOrBatch;
  const batchId = meta && meta.batchId;
  if (!batchId) return null;
  const nodes = getCharacterBatchNodes(batchId);
  const total = Math.max(Number(meta.batchTotal) || nodes.length || 1, nodes.length);
  const completed = nodes.filter(n => n.status === 'done').length;
  const failed = nodes.filter(n => n.status === 'error').length;
  const running = nodes.filter(n => n.status === 'running').length;
  const pending = Math.max(total - completed - failed - running, 0);
  const progress = { batchId, total, completed, failed, running, pending, updatedAt: new Date().toISOString() };
  nodes.forEach(n => {
    n.stateMeta.batchTotal = total;
    n.stateMeta.batchProgress = { ...progress };
    n.stateMeta.failureReason = n.failureReason || n._lastError || '';
    if (n.el) renderCharacterStateInfo(n);
  });
  return progress;
}

function setCharacterStateFailure(node, reason) {
  setNodeStatus(node, 'error', reason);
  if (node.el) updateNodeStatus(node);
}

function clearCharacterStateFailure(node) {
  setNodeStatus(node, 'idle');
  if (node.stateMeta) node.stateMeta.failureReason = '';
  if (node.el) updateNodeStatus(node);
}

let edgeIdSeq = 1;
class Edge {
  constructor(fromNode, fromPortIdx, toNode, toPortIdx) {
    this.id = `e${edgeIdSeq++}`;
    this.from = { node: fromNode, port: fromPortIdx };
    this.to   = { node: toNode,   port: toPortIdx };
  }
}

//================ 4. 工作流状态 ================
const workflow = {
  camera: new Camera(),
  nodes: new Map(),
  edges: new Map(),
  order: [],
  nextZ: 1,
  selection: new Set(),
  shots: [], // 镜头清单：{ id, name, scene, shotNo, desc, prompt, status, nodeId }
  scenes: [], // 场景分组：{ id, name, color, nodeIds:[] }
  hoveredPort: null,
  pendingConnection: null,
};

// 以节点 ID 创建一条数据连线。模板、风格预设与状态批量生成共用这一入口，
// 避免它们依赖仅供测试 API 使用的 window.FlowCraft.editor.connectNodes。
function connectNodes(fromNodeId, fromPortIdx, toNodeId, toPortIdx) {
  const fromNode = workflow.nodes.get(fromNodeId);
  const toNode = workflow.nodes.get(toNodeId);
  if (!fromNode || !toNode) return null;
  const edge = new Edge(fromNode, fromPortIdx, toNode, toPortIdx);
  workflow.edges.set(edge.id, edge);
  if (typeof resetNodeData === 'function') resetNodeData(toNode);
  markEdgesDirty();
  return edge;
}

//================ 4b. 回收站 ================
const recycleBin = []; // 已删除节点快照数组，每项: { node, edges, deletedAt }

//================ 4c. 撤销/重做 (Undo / Redo) ================
const HISTORY_LIMIT = 100; // 历史栈上限（阶段7 验收：容量 100）
let undoStack = [];       // 撤销栈
let redoStack = [];       // 重做栈
let isRestoringHistory = false; // 标记正在执行 undo/redo，避免重复压栈
let isBatchRestore = false;    // 标记批量还原操作，避免 restoreFromRecycle 内部重复压栈
let _suppressPush = false;     // 复合操作期间抑制内部 pushHistory，使其合并为单条撤销项

// 背景模式（点阵 / 网格 / 纯色）—— 提前声明，避免 drawGrid 在初始化时触发 TDZ
let bgMode = 'dot';

// 深拷贝可序列化的工作流状态（不包含 DOM 引用和 selection）
function snapshotWorkflow() {
  const nodesData = [];
  workflow.nodes.forEach(n => {
    nodesData.push({
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      title: n.title,
      thumb: n.thumb,
      uploadedImage: n.uploadedImage || '',
      croppedImage: n.croppedImage || '',
      cropMeta: n.cropMeta ? JSON.parse(JSON.stringify(n.cropMeta)) : null,
      prompt: n.prompt,
      params: { ...n.params },
      status: n.status,
      refImages: n.refImages ? JSON.parse(JSON.stringify(n.refImages)) : [],
      charDesc: n.charDesc || '',
      stateMeta: copyStateMeta(n.stateMeta),
      failureReason: n.failureReason || n._lastError || '',
      genMeta: copyGenMeta(n.genMeta),
      semanticMode: n.semanticMode || getNodeSemanticTier(n.type),
      resultMode: n.resultMode || 'pending',
      inputsData: n.inputsData ? JSON.parse(JSON.stringify(n.inputsData)) : [],
      outputsData: n.outputsData ? JSON.parse(JSON.stringify(n.outputsData)) : [],
    });
  });
  const edgesData = [];
  workflow.edges.forEach(e => {
    edgesData.push({
      id: e.id,
      fromNodeId: e.from.node.id,
      fromPort: e.from.port,
      toNodeId: e.to.node.id,
      toPort: e.to.port,
    });
  });
  return {
    nodes: nodesData,
    edges: edgesData,
    order: [...workflow.order],
    camera: { x: workflow.camera.x, y: workflow.camera.y, zoom: workflow.camera.zoom },
    nextZ: workflow.nextZ,
    recycleBin: recycleBin.map(item => ({
      node: { ...item.node, params: { ...item.node.params } },
      edges: item.edges.map(e => ({ ...e })),
      deletedAt: item.deletedAt,
    })),
    shots: (workflow.shots || []).map(s => Object.assign({}, s)),
    scenes: (workflow.scenes || []).map(s => Object.assign({}, s)),
  };
}

// 压入历史栈（在状态变更前调用）
function pushHistory() {
  if (isRestoringHistory || _suppressPush) return;
  const snap = snapshotWorkflow();
  undoStack.push(snap);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = []; // 新操作清空重做栈
  updateUndoRedoButtons();
}

// 从快照恢复工作流状态
function restoreFromSnapshot(snap) {
  isRestoringHistory = true;
  try {
    // 清空当前画布 DOM
    workflow.nodes.forEach(n => { if (n.el) n.el.remove(); });
    workflow.nodes.clear();
    workflow.edges.clear();
    workflow.order = [];
    workflow.selection.clear();

    // 恢复节点
    const idMap = {}; // 旧 id → 新对象引用
    snap.nodes.forEach(nd => {
      const node = new WorkflowNode(nd.type, nd.x, nd.y);
      node.id = nd.id;
      node.width = nd.width;
      node.height = nd.height;
      node.title = nd.title;
      node.thumb = nd.thumb;
      node.uploadedImage = typeof nd.uploadedImage === 'string' ? nd.uploadedImage : '';
      node.croppedImage = typeof nd.croppedImage === 'string' ? nd.croppedImage : '';
      node.cropMeta = nd.cropMeta ? JSON.parse(JSON.stringify(nd.cropMeta)) : null;
      node.prompt = nd.prompt;
      node.params = { ...nd.params };
      node.refImages = normalizeRefImages(nd.refImages);
      node.charDesc = typeof nd.charDesc === 'string' ? nd.charDesc : '';
      node.stateMeta = copyStateMeta(nd.stateMeta);
      node.failureReason = nd.failureReason || (node.stateMeta && node.stateMeta.failureReason) || nd._lastError || '';
      node._lastError = node.failureReason;
      node.genMeta = copyGenMeta(nd.genMeta);
      node.semanticMode = nd.semanticMode || getNodeSemanticTier(nd.type);
      node.resultMode = nd.resultMode || 'pending';
      node.status = nd.status;
      node.inputsData = nd.inputsData ? JSON.parse(JSON.stringify(nd.inputsData)) : (node.def.inputs || []).map(() => null);
      node.outputsData = nd.outputsData ? JSON.parse(JSON.stringify(nd.outputsData)) : (node.def.outputs || []).map(() => null);
      const el = createNodeElement(node);
      nodeLayer.appendChild(el);
      workflow.nodes.set(node.id, node);
      workflow.order.push(node.id);
      idMap[nd.id] = node;
    });

    // 恢复连线
    snap.edges.forEach(ed => {
      const fromNode = idMap[ed.fromNodeId];
      const toNode = idMap[ed.toNodeId];
      if (fromNode && toNode) {
        const edge = new Edge(fromNode, ed.fromPort, toNode, ed.toPort);
        edge.id = ed.id;
        workflow.edges.set(edge.id, edge);
      }
    });

    // 恢复相机
    workflow.camera.x = snap.camera.x;
    workflow.camera.y = snap.camera.y;
    workflow.camera.zoom = snap.camera.zoom;
    workflow.nextZ = snap.nextZ;

    // 恢复回收站
    recycleBin.length = 0;
    if (snap.recycleBin) {
      snap.recycleBin.forEach(item => {
        recycleBin.push({
          node: { ...item.node, params: { ...item.node.params } },
          edges: item.edges.map(e => ({ ...e })),
          deletedAt: item.deletedAt,
        });
      });
    }

    // 恢复镜头清单与场景分组（阶段7：撤销/重做须覆盖 shot/scene 两类操作）
    workflow.shots = snap.shots ? snap.shots.map(s => Object.assign({}, s)) : [];
    workflow.scenes = snap.scenes ? snap.scenes.map(s => Object.assign({}, s)) : [];
    if (typeof renderShotPanel === 'function') renderShotPanel();
    if (typeof renderScenePanel === 'function') renderScenePanel();

    applyTransform();
    updateStatusbar();
    updateRecycleUI();
    markEdgesDirty();
  } finally {
    isRestoringHistory = false;
  }
}

// 执行撤销
function undo() {
  if (undoStack.length === 0) return;
  const snap = undoStack.pop();
  redoStack.push(snapshotWorkflow());
  restoreFromSnapshot(snap);
  updateUndoRedoButtons();
  scheduleAutosave();
  showToast('已撤销', 'info');
}

// 执行重做
function redo() {
  if (redoStack.length === 0) return;
  const snap = redoStack.pop();
  undoStack.push(snapshotWorkflow());
  restoreFromSnapshot(snap);
  updateUndoRedoButtons();
  scheduleAutosave();
  showToast('已重做', 'info');
}

// 更新撤销/重做按钮状态
function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.disabled = undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

// 复合操作包装：先压一次「操作前」快照，期间抑制内部 pushHistory，使整段计为单条撤销项
// （例如「生成镜头节点组」内部多次 addNode/connect/createScene 合并为一次可撤销动作）
function withHistory(fn) {
  pushHistory();
  const prev = _suppressPush; _suppressPush = true;
  try { fn(); } finally { _suppressPush = prev; }
}

// 表单编辑历史：聚焦时抓取「编辑前」快照，change（失焦/选择）时入栈，避免逐字符压栈
function bindEditHistory(elm) {
  let pre = null;
  elm.addEventListener('focus', () => { if (pre === null) pre = snapshotWorkflow(); });
  elm.addEventListener('change', () => {
    if (pre !== null) {
      undoStack.push(pre);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack = [];
      pre = null;
      updateUndoRedoButtons();
    }
  });
}

// 阶段7：对外暴露历史栈与编辑器操作（opt-in，供单测/扩展驱动；不改动既有交互）
(function mountHistoryApi() {
  window.FlowCraft = window.FlowCraft || {};
  window.FlowCraft.history = {
    push: pushHistory,
    undo, redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    size: () => undoStack.length,
    redoSize: () => redoStack.length,
    limit: () => HISTORY_LIMIT,
    clear: () => { undoStack = []; redoStack = []; updateUndoRedoButtons(); },
  };
  window.FlowCraft.editor = {
    addNode, deleteNode,
    moveNode: (id, x, y) => { const n = workflow.nodes.get(id); if (!n) return; pushHistory(); n.x = x; n.y = y; if (n.el) { n.el.style.left = x + 'px'; n.el.style.top = y + 'px'; } applyTransform(); },
    connectNodes: (aId, aPort, bId, bPort) => { const a = workflow.nodes.get(aId), b = workflow.nodes.get(bId); if (!a || !b) return; pushHistory(); const e = new Edge(a, aPort, b, bPort); workflow.edges.set(e.id, e); resetNodeData(b); markEdgesDirty(); },
    setParam: (id, key, val) => { const n = workflow.nodes.get(id); if (!n) return; pushHistory(); n.params.fields = n.params.fields || {}; n.params.fields[key] = val; if (key === 'prompt') n.prompt = val; },
    addShot: (data) => { pushHistory(); workflow.shots = workflow.shots || []; const shot = Object.assign({ id: 'shot_' + Date.now().toString(36), status: 'idle', nodeId: null }, data || {}); workflow.shots.push(shot); renderShotPanel(); return shot; },
    deleteShot: (id) => { pushHistory(); workflow.shots = (workflow.shots || []).filter(x => x.id !== id); renderShotPanel(); },
    createScene: (name) => createScene(name),
    deleteScene: (id) => { pushHistory(); deleteScene(id); },
    createGroup: (id) => generateShotNodeGroup(id),
    clear: () => { clearGraph(); workflow.shots = []; workflow.scenes = []; if (typeof renderShotPanel === 'function') renderShotPanel(); if (typeof renderScenePanel === 'function') renderScenePanel(); },
    // 只读快照：供单测断言（节点/连线/场景/镜头计数 + 位置 + 参数 + 历史栈状态）
    state: () => {
      const nodes = {};
      workflow.nodes.forEach((n, id) => { nodes[id] = { x: n.x, y: n.y, type: n.type, params: n.params.fields ? Object.assign({}, n.params.fields) : {} }; });
      return {
        nodeCount: workflow.nodes.size,
        edgeCount: workflow.edges.size,
        sceneCount: (workflow.scenes || []).length,
        shotCount: (workflow.shots || []).length,
        nodes,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        historySize: undoStack.length,
        redoSize: redoStack.length,
      };
    },
  };
})();

// 阶段 9：测试/调试钩子（opt-in，供 verify-model-router.js 在无网络下驱动调用点并断言路由透传）。
// 仅暴露内部函数引用，不改变任何交互行为。
(function mountLegacyTestHook() {
  window.FlowCraft = window.FlowCraft || {};
  window.FlowCraft._legacy = {
    // 模块化执行器不能可靠读取经典脚本的全局词法绑定，
    // 显式暴露运行时引用；window 同名属性仍可覆盖它们，便于测试和扩展注入。
    workflow: workflow,
    executeNodeAsync: executeNodeAsync,
    updateNodeStatus: updateNodeStatus,
    markEdgesDirty: markEdgesDirty,
    // 执行引擎的增量运行缓存钩子：runner 不能直接读取本文件的词法绑定。
    fcRunCacheKey: fcRunCacheKey,
    fcHasOutput: fcHasOutput,
    topoSortNodes: topoSortNodes,
    collectAncestors: collectAncestors,
    getDescendants: getDescendants,
    callRelayChat: callRelayChat,
    generateChatImage: generateChatImage,
    _routeModel: _routeModel,
    _comfyExecTarget: _comfyExecTarget,
    getNode: function (id) { return workflow.nodes.get(id); },
    renderComfyNodeBody: renderComfyNodeBody,
  };
})();

//================ 4d. 自动保存 (localStorage 持久化) ================
const AUTOSAVE_KEY = 'flowcraft:autosave:v1';
// 自动保存数据结构版本。每次改变节点/工作流存储结构时 +1，
// 旧版本数据在 restoreFromStorage 中经 migrateAutosave 平滑迁移，避免整页崩溃或用户数据丢失。
const CURRENT_AUTOSAVE_VERSION = 4;
let autosaveTimer = null;
// 自动保存体积安全上限（localStorage 约 5MB，预留余量在超限前主动剥离大图）
const SAFE_AUTOSAVE_LIMIT = 4_500_000;
let lastSaveStripped = false;

//================ #13 多工作台：多画布独立自动保存 + 切换 ================
// 工作台列表只保存轻量元数据（id / name / savedAt），
// 真正的画布内容放在 AUTOSAVE_KEY（轻量兜底）与 IndexedDB 的 wb:{id}（完整版）里。
// 这样可避免把整份 autosave 反复写进工作台列表，触发 localStorage 配额爆掉。
const WORKBENCHES_KEY = 'flowcraft:workbenches:v1';
const ACTIVE_WB_KEY = 'flowcraft:activeWorkbench:v1';

function sanitizeWorkbenchRecord(wb) {
  if (!wb || typeof wb !== 'object') return null;
  const clean = { ...wb };
  delete clean.autosave;
  delete clean.autosaveLite;
  return clean;
}

function sanitizeWorkbenchStore(store) {
  const out = {};
  Object.keys(store || {}).forEach(id => {
    const clean = sanitizeWorkbenchRecord(store[id]);
    if (clean) out[id] = clean;
  });
  return out;
}

function getWorkbenches() {
  try { const raw = localStorage.getItem(WORKBENCHES_KEY); return sanitizeWorkbenchStore(raw ? JSON.parse(raw) : {}); }
  catch (e) { return {}; }
}
function setWorkbenches(store) {
  try { localStorage.setItem(WORKBENCHES_KEY, JSON.stringify(sanitizeWorkbenchStore(store))); return true; }
  catch (e) { showToast('工作台保存失败：浏览器存储空间不足', 'danger'); return false; }
}
function getActiveWbId() {
  try { return localStorage.getItem(ACTIVE_WB_KEY) || ''; } catch (e) { return ''; }
}
function setActiveWbId(id) {
  try { localStorage.setItem(ACTIVE_WB_KEY, id || ''); } catch (e) {}
}
function getActiveWorkbench() {
  const id = getActiveWbId();
  const store = getWorkbenches();
  return store[id] || null;
}
function getWorkbenchList() {
  const store = getWorkbenches();
  return Object.values(store).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}
// 首次进入 / 无有效工作台时：确保存在活跃工作台（用现有 AUTOSAVE_KEY 内容建「默认工作台」）
function ensureWorkbench() {
  const store = getWorkbenches();
  const active = getActiveWbId();
  if (active && store[active]) return store[active];
  let data = null;
  try { data = localStorage.getItem(AUTOSAVE_KEY); } catch (e) {}
  const id = 'wb_' + Date.now().toString(36);
  const wb = { id, name: '默认工作台', savedAt: new Date().toISOString() };
  store[id] = wb;
  setWorkbenches(store);
  setActiveWbId(id);
  return wb;
}
// 把当前画布状态写入指定工作台（#13b：LS 剥离版 + IDB 完整版）
function saveCurrentToWorkbench(wb) {
  if (!wb) return;
  const full = serializeWorkflow(false);
  const store = getWorkbenches();
  if (store[wb.id]) {
    store[wb.id].savedAt = new Date().toISOString();
    setWorkbenches(store);
  }
  idbPut(wbKey(wb.id), full);
}
function clearCanvasToEmpty() {
  applyWorkflowData({ nodes: [], edges: [], camera: { x: 0, y: 0, zoom: 1 } });
}

//================ #13b. IndexedDB 大图库（自动保存完整版，解除 5MB 触顶）================
// localStorage 仅存「剥离大图的轻量版」（永不触顶、快速兜底）；
// IndexedDB 存「完整版」（含全部大图，无大小限制），key = 'wb:' + 工作台 id。
// 恢复时：同步先显示剥离版快速启动，后台异步拉 IndexedDB 完整版替换。
let _fcIdbPromise = null;
const IDB_NAME = 'flowcraft-db';
const IDB_STORE = 'kv';

function openFlowcraftDB() {
  if (_fcIdbPromise) return _fcIdbPromise;
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  _fcIdbPromise = new Promise(function(resolve) {
    var req;
    // 与模块化存储层共用 v2 schema；旧版 v1 数据会在升级时补齐 projects/assets 等仓库。
    try { req = window.indexedDB.open(IDB_NAME, 2); }
    catch (e) { resolve(null); return; }
    req.onupgradeneeded = function() {
      var db = req.result;
      if (db && !db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'k' });
      // 旧版入口也可能先于模块化存储层打开数据库；必须在这里补齐全部仓库，
      // 否则数据库版本已升到 v2 但 projects/assets 等仓库仍不存在。
      if (db && !db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (db && !db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (db && !db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
      if (db && !db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
    };
    req.onsuccess = function() {
      req.result.onversionchange = function() { req.result.close(); };
      resolve(req.result);
    };
    req.onerror = function() { resolve(null); };
  });
  return _fcIdbPromise;
}
function idbPut(key, value) {
  return openFlowcraftDB().then(function(db) {
    if (!db) return false;
    return new Promise(function(resolve) {
      try {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        // 双字段兼容：模块化存储层用 keyPath 'key' 建过 kv 库，旧版用 'k'；
        // 同时带两个键，两种库都能写入（修复：刷新后生成大图丢失的根因）
        tx.objectStore(IDB_STORE).put({ k: key, key: key, v: value });
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { console.warn('[FlowCraft] IndexedDB 写入失败:', key, tx.error && tx.error.message); resolve(false); };
      } catch (e) { console.warn('[FlowCraft] IndexedDB 写入异常:', key, e && e.message); resolve(false); }
    });
  }).catch(function() { return false; });
}
function idbGet(key) {
  return openFlowcraftDB().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve) {
      try {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var r = tx.objectStore(IDB_STORE).get(key);
        r.onsuccess = function() { resolve(r.result ? r.result.v : null); };
        r.onerror = function() { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }).catch(function() { return null; });
}
function idbDel(key) {
  return openFlowcraftDB().then(function(db) {
    if (!db) return;
    return new Promise(function(resolve) {
      try {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = resolve; tx.onerror = resolve;
      } catch (e) { resolve(); }
    });
  }).catch(function() {});
}
function wbKey(id) { return 'wb:' + id; }

// 画布轻量签名（节点数+边数+节点 id 集合）——用于判断画布是否仍为「初始恢复状态」
let _initCanvasSig = null;
function canvasSignature() {
  const nodes = [...workflow.nodes.values()];
  return nodes.length + ':' + workflow.edges.size + ':' + nodes.map(n => n.id).sort().join(',');
}

// 后台从 IndexedDB 拉取当前工作台完整版，替换剥离版显示（仅当明显更完整时，避免无谓重建）
// onlyIfUntouched=true（init 用）：若画布已被用户/脚本改动（签名变化）则跳过，避免覆盖现场
function restoreFullAutosaveFromIDB(onlyIfUntouched) {
  const activeId = getActiveWbId();
  const liteRaw = (() => { try { return localStorage.getItem(AUTOSAVE_KEY) || ''; } catch (_) { return ''; } })();
  console.log('[FlowCraft] 完整大图恢复：启动, activeId=' + activeId);
  if (!activeId) { console.warn('[FlowCraft] 完整大图恢复：缺少工作台/ID，中止'); return; }
  setTimeout(function() {
    if (onlyIfUntouched && _initCanvasSig !== null && canvasSignature() !== _initCanvasSig) {
      console.warn('[FlowCraft] 完整大图恢复：画布已被改动（签名 ' + _initCanvasSig + ' → ' + canvasSignature() + '），跳过覆盖');
      return;
    }
    idbGet(wbKey(activeId)).then(function(full) {
      if (!full || typeof full !== 'string') { console.warn('[FlowCraft] 完整大图恢复：kv 中没有完整版记录（' + wbKey(activeId) + '）'); return; }
      try {
        const parsed = JSON.parse(full);
        if (!parsed || !parsed.nodes) { console.warn('[FlowCraft] 完整大图恢复：数据无 nodes，跳过'); return; }
        const curLen = liteRaw.length;
        if (curLen > 0 && full.length <= curLen + 1000) { console.log('[FlowCraft] 完整大图恢复：无大图差异（' + full.length + ' vs ' + curLen + '），跳过'); return; }
        console.log('[FlowCraft] 完整大图恢复：载入完整版（' + full.length + ' 字符，' + parsed.nodes.length + ' 个节点）');
        applyWorkflowData(parsed);
        updateStatusbar(); updateRecycleUI(); updateUndoRedoButtons();
        applyTransform(); markEdgesDirty();
        setTimeout(function() { fitToContent(); }, 100);
        showToast('已从本地库载入完整大图版本', 'info', 2500);
      } catch (e) { console.error('[FlowCraft] 完整大图恢复失败:', e && e.message); }
    });
  }, 300);
}

// 剥离节点里的大体积 dataURL（图片预览），保证长项目也能落到 localStorage
function _stripHeavyDataUrls(nodesData) {
  const THRESH = 60000;
  const scrub = (v) => (typeof v === 'string' && v.startsWith('data:') && v.length > THRESH) ? '(stripped)' : v;
  const deepScrub = (v) => {
    if (typeof v === 'string') return scrub(v);
    if (Array.isArray(v)) return v.map(deepScrub);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).forEach(k => { out[k] = deepScrub(v[k]); });
      return out;
    }
    return v;
  };
  nodesData.forEach(nd => {
    if (nd.thumb) nd.thumb = scrub(nd.thumb);
    if (nd.uploadedImage) nd.uploadedImage = scrub(nd.uploadedImage);
    if (nd.croppedImage) nd.croppedImage = scrub(nd.croppedImage);
    if (nd.uploadedVideo) nd.uploadedVideo = scrub(nd.uploadedVideo);
    if (Array.isArray(nd.refVideos)) nd.refVideos = deepScrub(nd.refVideos);
    if (nd.params) nd.params = deepScrub(nd.params);
    if (Array.isArray(nd.inputsData)) nd.inputsData = deepScrub(nd.inputsData);
    if (Array.isArray(nd.outputsData)) nd.outputsData = deepScrub(nd.outputsData);
  });
}

// 序列化当前工作流为 JSON
function serializeWorkflow(stripHeavy = false) {
  const nodesData = [];
  workflow.nodes.forEach(n => {
    nodesData.push({
      id: n.id, type: n.type, x: n.x, y: n.y,
      width: n.width, height: n.height, title: n.title,
      thumb: n.thumb, uploadedImage: n.uploadedImage || '', croppedImage: n.croppedImage || '', cropMeta: n.cropMeta ? JSON.parse(JSON.stringify(n.cropMeta)) : null, prompt: n.prompt,
      uploadedVideo: n.uploadedVideo || '',
      refImages: n.refImages ? JSON.parse(JSON.stringify(n.refImages)) : [],
      refVideos: n.refVideos ? JSON.parse(JSON.stringify(n.refVideos)) : [],
      charDesc: n.charDesc || '',
      stateMeta: copyStateMeta(n.stateMeta),
      failureReason: n.failureReason || n._lastError || '',
      genMeta: copyGenMeta(n.genMeta),
      params: { ...n.params }, status: n.status,
      previewOnly: !!n.previewOnly,
      previewSourceId: n.previewSourceId || '',
      inputsData: n.inputsData ? JSON.parse(JSON.stringify(n.inputsData)) : [],
      outputsData: n.outputsData ? JSON.parse(JSON.stringify(n.outputsData)) : [],
    });
  });
  const edgesData = [];
  workflow.edges.forEach(e => {
    edgesData.push({
      id: e.id, fromNodeId: e.from.node.id, fromPort: e.from.port,
      toNodeId: e.to.node.id, toPort: e.to.port,
    });
  });
  if (stripHeavy) _stripHeavyDataUrls(nodesData);
  return JSON.stringify({
    version: CURRENT_AUTOSAVE_VERSION,
    savedAt: new Date().toISOString(),
    nodes: nodesData,
    edges: edgesData,
    order: [...workflow.order],
    camera: { x: workflow.camera.x, y: workflow.camera.y, zoom: workflow.camera.zoom },
    nextZ: workflow.nextZ,
    nodeIdSeq,
    edgeIdSeq,
    shots: (workflow.shots || []).map(s => ({ ...s })),
    scenes: (workflow.scenes || []).map(s => ({ id: s.id, name: s.name, color: s.color, nodeIds: [...(s.nodeIds || [])] })),
    recycleBin: recycleBin.map(item => ({
      node: { ...item.node, params: { ...item.node.params } },
      edges: item.edges.map(e => ({ ...e })),
      deletedAt: item.deletedAt,
    })),
  });
}

// 防抖保存（500ms）
function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(doAutosave, 500);
}

// 执行保存（#13b）：localStorage 存剥离版（永不触顶、快速兜底）＋ IndexedDB 异步存完整版（含大图）
function doAutosave() {
  setSaveStatus('保存中', 'pending');
  let liteSaved = false;
  try {
    const full = serializeWorkflow(false);
    const stripped = serializeWorkflow(true); // 剥离大图 dataURL → 轻量，localStorage 稳
    try {
      if (typeof window !== 'undefined' && window.__FC_TEST_STORAGE_FAILURE__ === 'localStorage') {
        const error = new Error('测试注入：localStorage 被拒绝');
        error.name = 'QuotaExceededError';
        throw error;
      }
      localStorage.setItem(AUTOSAVE_KEY, stripped); liteSaved = true;
    } catch (e) { /* 极端：交给下方兜底 */ }
    lastSaveStripped = stripped.length < full.length;
    // 工作台元数据只保留轻量信息；真正画布内容写入 IndexedDB。
    try {
      const wb = getActiveWorkbench();
      if (wb) {
        const store = getWorkbenches();
        if (store[wb.id]) {
          store[wb.id].savedAt = new Date().toISOString();
          setWorkbenches(store);
        }
      }
    } catch (_) {}
    // IndexedDB：完整版（含大图），异步不阻塞 UI
    const activeId = getActiveWbId();
    if (activeId) idbPut(wbKey(activeId), full);
    setSaveStatus(liteSaved ? '轻量备份已保存 · 完整版确认中' : '保存失败', liteSaved ? 'pending' : 'err');
    return { liteSaved, stripped: lastSaveStripped };
  } catch (err) {
    // 兜底：即便完整序列化失败，也尝试剥离后保存
    try {
      const stripped = serializeWorkflow(true);
      if (typeof window !== 'undefined' && window.__FC_TEST_STORAGE_FAILURE__ === 'localStorage') {
        const error = new Error('测试注入：localStorage 兜底写入失败');
        error.name = 'QuotaExceededError';
        throw error;
      }
      localStorage.setItem(AUTOSAVE_KEY, stripped);
      liteSaved = true;
      lastSaveStripped = true;
      setSaveStatus('轻量备份已保存 · 完整版失败', 'warn');
      showToast('自动保存仅保留轻量备份，请尽快导出 .flowcraft 备份', 'warn', 5000);
      return { liteSaved, stripped: true, error: err };
    } catch (err2) {
      lastSaveStripped = false;
      setSaveStatus('保存失败', 'err');
      showToast('⚠️ 自动保存失败：' + ((err2 && err2.message) || '浏览器存储不可用') + '，请立即导出备份！', 'danger', 6000);
      return { liteSaved: false, stripped: false, error: err2 };
    }
  }
}

// 状态栏保存指示器
function setSaveStatus(text, kind) {
  const el = document.getElementById('statSave');
  if (!el) return;
  el.textContent = text;
  el.dataset.saveKind = kind || '';
  el.style.color = kind === 'err' ? 'var(--color-danger)' : kind === 'warn' ? 'var(--color-warn)' : kind === 'pending' ? 'var(--accent, #8B5CF6)' : 'var(--text-2)';
}

// 版本迁移：把旧版自动保存数据平滑升级到当前结构，保证「升级不丢数据、旧档不崩页」。
// 旧版本缺失的字段在此补齐；结构性的不兼容改动也在此做转换。
// fromVersion：数据自带的版本号（缺失时按 1 处理）。
function migrateAutosave(parsed, fromVersion) {
  const v = fromVersion || 1;
  // v1 → v2：节点结构归一化（早期版本可能缺少 params / inputsData / outputsData / status）
  if (v < 2) {
    if (!Array.isArray(parsed.nodes)) parsed.nodes = [];
    parsed.nodes.forEach(nd => {
      if (!nd) return;
      nd.type = nd.type || 'image';
      nd.title = nd.title || '';
      nd.thumb = nd.thumb || null;
      nd.prompt = nd.prompt || '';
      nd.width = nd.width || 280;
      nd.height = nd.height || 200;
      nd.status = nd.status || 'idle';
      nd.params = Object.assign({}, DEFAULT_NODE_PARAMS, nd.params || {});
      if (!Array.isArray(nd.inputsData)) nd.inputsData = null; // 重建阶段统一按 def 兜底
      if (!Array.isArray(nd.outputsData)) nd.outputsData = null;
    });
  }
  // v3 → v4：角色状态批次进度与失败原因字段。
  if (v < 4) {
    (parsed.nodes || []).forEach(nd => {
      if (!nd) return;
      nd.failureReason = nd.failureReason || (nd.stateMeta && nd.stateMeta.failureReason) || '';
      if (nd.stateMeta && !nd.stateMeta.batchProgress) nd.stateMeta.batchProgress = null;
    });
  }
  if (!Array.isArray(parsed.scenes)) parsed.scenes = [];
  parsed.version = CURRENT_AUTOSAVE_VERSION;
  return parsed;
}

// 经典脚本入口也做同一份数据边界校验；必须在 pushHistory / 清空当前画布之前执行。
function validateWorkflowData(parsed) {
  const known = new Set(Object.keys(NODE_TYPES));
  const errors = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) errors.push('项目数据必须是 JSON 对象');
  if (!parsed || !Array.isArray(parsed.nodes)) errors.push('nodes 必须是数组（空项目请使用 nodes: []）');
  if (parsed && parsed.edges !== undefined && !Array.isArray(parsed.edges)) errors.push('edges 必须是数组');
  if (errors.length) return { ok: false, errors };
  const ids = new Set();
  parsed.nodes.forEach((nd, i) => {
    if (!nd || typeof nd !== 'object' || Array.isArray(nd)) { errors.push(`nodes[${i}] 必须是对象`); return; }
    if (typeof nd.id !== 'string' || !nd.id.trim()) errors.push(`nodes[${i}].id 必须是非空字符串`);
    else if (ids.has(nd.id)) errors.push(`nodes[${i}].id 重复：${nd.id}`); else ids.add(nd.id);
    if (typeof nd.type !== 'string' || !nd.type.trim()) errors.push(`nodes[${i}].type 必须是非空字符串`);
    else if (!known.has(nd.type)) errors.push(`nodes[${i}].type 未知：${nd.type}`);
  });
  (parsed.edges || []).forEach((ed, i) => {
    if (!ed || typeof ed !== 'object' || Array.isArray(ed)) { errors.push(`edges[${i}] 必须是对象`); return; }
    if (typeof ed.id !== 'string' || !ed.id.trim()) errors.push(`edges[${i}].id 必须是非空字符串`);
    if (typeof ed.fromNodeId !== 'string' || !ids.has(ed.fromNodeId)) errors.push(`edges[${i}] 起点节点不存在`);
    if (typeof ed.toNodeId !== 'string' || !ids.has(ed.toNodeId)) errors.push(`edges[${i}] 终点节点不存在`);
    if (!Number.isInteger(ed.fromPort) || ed.fromPort < 0 || !Number.isInteger(ed.toPort) || ed.toPort < 0) errors.push(`edges[${i}] 端口必须是非负整数`);
  });
  return { ok: errors.length === 0, errors };
}

// 从 localStorage 恢复工作流（#13：优先读活跃工作台的 autosave，无则退回 AUTOSAVE_KEY）
function restoreFromStorage() {
  let data = null;
  try {
    data = localStorage.getItem(AUTOSAVE_KEY);
  } catch (err) {
    console.warn('[FlowCraft] 读取 localStorage 失败:', err.message);
    return false;
  }
  if (!data) return false;
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (err) {
    // 数据损坏（被截断 / 非法 JSON）→ 清除损坏档，干净启动，避免反复崩溃
    console.warn('[FlowCraft] 自动保存数据已损坏，已丢弃并重新初始化:', err.message);
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
    return false;
  }
  const validation = validateWorkflowData(parsed);
  if (!validation.ok) {
    console.warn('[FlowCraft] 自动保存数据结构无效，已跳过恢复:', validation.errors.join('；'));
    return false;
  }

  // 版本判断 + 迁移
  const v = typeof parsed.version === 'number' ? parsed.version : 1;
  if (v < CURRENT_AUTOSAVE_VERSION) {
    console.info('[FlowCraft] 检测到旧版自动保存 (v' + v + ')，正在迁移到 v' + CURRENT_AUTOSAVE_VERSION + '…');
    parsed = migrateAutosave(parsed, v);
  } else if (v > CURRENT_AUTOSAVE_VERSION) {
    // 数据来自更新的版本：尽力兼容，不阻断启动
    console.warn('[FlowCraft] 自动保存版本 (v' + v + ') 高于当前程序 (v' + CURRENT_AUTOSAVE_VERSION + ')，将尽力兼容加载。');
  }

  try {
    if (!parsed.nodes) return false;

    // 恢复 ID 序列号
    if (parsed.nodeIdSeq) nodeIdSeq = parsed.nodeIdSeq;
    if (parsed.edgeIdSeq) edgeIdSeq = parsed.edgeIdSeq;

    // 恢复节点
    const idMap = {};
    parsed.nodes.forEach(nd => {
      const node = new WorkflowNode(nd.type, nd.x, nd.y);
      node.id = nd.id;
      node.width = nd.width || 280;
      node.height = nd.height || 200;
      node.title = nd.title || node.def.label;
      node.thumb = nd.thumb || null;
      node.uploadedVideo = typeof nd.uploadedVideo === 'string' ? nd.uploadedVideo : '';
      node.prompt = nd.prompt || '';
      node.refImages = normalizeRefImages(nd.refImages);
      node.refVideos = Array.isArray(nd.refVideos) ? nd.refVideos : [];
      node.charDesc = typeof nd.charDesc === 'string' ? nd.charDesc : '';
      node.stateMeta = copyStateMeta(nd.stateMeta);
      node.failureReason = nd.failureReason || (node.stateMeta && node.stateMeta.failureReason) || nd._lastError || '';
      node._lastError = node.failureReason;
      node.genMeta = copyGenMeta(nd.genMeta);
      node.params = { ...DEFAULT_NODE_PARAMS, ...(nd.params || {}) };
      node.status = nd.status || 'idle';
      node.previewOnly = !!nd.previewOnly;
      node.previewSourceId = typeof nd.previewSourceId === 'string' ? nd.previewSourceId : '';
      node.inputsData = nd.inputsData ? JSON.parse(JSON.stringify(nd.inputsData)) : (node.def.inputs || []).map(() => null);
      node.outputsData = nd.outputsData ? JSON.parse(JSON.stringify(nd.outputsData)) : (node.def.outputs || []).map(() => null);
      const el = createNodeElement(node);
      nodeLayer.appendChild(el);
      workflow.nodes.set(node.id, node);
      workflow.order.push(node.id);
      idMap[nd.id] = node;
    });

    // 恢复连线
    if (parsed.edges) {
      parsed.edges.forEach(ed => {
        const fromNode = idMap[ed.fromNodeId];
        const toNode = idMap[ed.toNodeId];
        if (fromNode && toNode) {
          const edge = new Edge(fromNode, ed.fromPort, toNode, ed.toPort);
          edge.id = ed.id;
          workflow.edges.set(edge.id, edge);
        }
      });
    }

    // 恢复 order（如果存在）
    if (parsed.order && parsed.order.length > 0) {
      workflow.order = parsed.order.filter(id => workflow.nodes.has(id));
    }

    // 恢复相机
    if (parsed.camera) {
      workflow.camera.x = parsed.camera.x;
      workflow.camera.y = parsed.camera.y;
      workflow.camera.zoom = parsed.camera.zoom;
    }
    if (parsed.nextZ) workflow.nextZ = parsed.nextZ;

    // 恢复回收站
    if (parsed.recycleBin) {
      parsed.recycleBin.forEach(item => {
        recycleBin.push({
          node: { ...item.node, params: { ...item.node.params } },
          edges: item.edges.map(e => ({ ...e })),
          deletedAt: item.deletedAt,
        });
      });
    }

    // 恢复镜头清单（场景表 / 分镜）
    if (Array.isArray(parsed.shots)) {
      workflow.shots = parsed.shots.map(s => ({
        id: s.id || ('shot_' + Math.random().toString(36).slice(2, 9)),
        name: s.name || '',
        scene: s.scene || '',
        shotNo: s.shotNo || '',
        desc: s.desc || '',
        prompt: s.prompt || '',
        status: s.status || 'idle',
        nodeId: s.nodeId || null,
      }));
    }

    // 恢复场景分组
    if (Array.isArray(parsed.scenes)) {
      const validIds = new Set(workflow.nodes.keys());
      workflow.scenes = parsed.scenes.map(s => ({
        id: s.id || ('scene_' + Math.random().toString(36).slice(2, 9)),
        name: s.name || '未命名场景',
        color: s.color || '#5B8DEF',
        nodeIds: Array.isArray(s.nodeIds) ? s.nodeIds.filter(id => validIds.has(id)) : [],
      }));
    } else {
      workflow.scenes = [];
    }

    applySceneTints();
    return parsed.nodes.length;
  } catch (err) {
    console.warn('[FlowCraft] 恢复数据解析失败:', err.message);
    return false;
  }
}

// 清空已保存数据
function clearSavedData() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    showToast('已清空保存数据', 'info');
  } catch (err) {
    showToast('清空失败', 'danger');
  }
}

// 导出 JSON 文件
function exportJSON() {
  const data = serializeWorkflow();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flowcraft-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('已导出 JSON', 'success');
}

// 导入 JSON 文件
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const parsed = JSON.parse(text);
      applyWorkflowData(parsed);
      setTimeout(() => fitToContent(), 100);
      showToast(`已导入 ${parsed.nodes.length} 个节点`, 'success');
      refreshAssetPanelIfOpen();
    } catch (err) {
      showToast('导入失败: ' + err.message, 'danger');
    }
  };
  reader.readAsText(file);
}

//================ 4g2. 整画布 PNG 导出（#10）================
// 计算全部节点世界包围盒，离屏渲染 背景(跟随 bgMode) + 贝塞尔连线 + 节点卡(头部色条+标题+缩略图/文本)，
// 导出高清 PNG。节点缩略图 node.thumb 为 data URL，不会污染 canvas。
function exportRoundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function exportDrawBezier(ctx, x1, y1, x2, y2, color, lw) {
  const dx = Math.max(50, Math.abs(x2 - x1) * 0.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
  ctx.stroke();
}
function exportLoadThumb(src) {
  return new Promise(res => {
    if (!src || typeof src !== 'string' || !src.startsWith('data:image')) { res(null); return; }
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}
function exportDrawImageCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height, r = w / h;
  let dw, dh, dx, dy;
  if (ir > r) { dh = h; dw = h * ir; dx = x - (dw - w) / 2; dy = y; }
  else { dw = w; dh = w / ir; dx = x; dy = y - (dh - h) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}
function exportTruncate(s, n) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function exportPaintBg(ctx, ox, oy, W, H) {
  if (bgMode === 'solid') return;
  const spacing = 24;
  const c = COLORS.gridDotRGB;
  const startX = ((ox % spacing) + spacing) % spacing;
  const startY = ((oy % spacing) + spacing) % spacing;
  if (bgMode === 'grid') {
    ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.05)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < W; x += spacing) { const px = Math.round(x) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H); }
    for (let y = startY; y < H; y += spacing) { const py = Math.round(y) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W, py); }
    ctx.stroke();
  } else {
    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.05)`;
    for (let x = startX; x < W; x += spacing)
      for (let y = startY; y < H; y += spacing)
        ctx.fillRect(Math.round(x), Math.round(y), 1.5, 1.5);
  }
}
async function exportCanvasPNG() {
  // 1. 计算节点包围盒（世界坐标）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hasNode = false;
  workflow.nodes.forEach(n => {
    const el = n.el;
    const w = (el ? el.offsetWidth : (n.width || 280)) || 280;
    const h = (el ? el.offsetHeight : 160) || 160;
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    hasNode = true;
  });
  const pad = 48;
  let W, H;
  if (!hasNode) {
    // 无节点：按当前视口对应世界区域导出
    const rect = canvasWrap.getBoundingClientRect();
    W = rect.width / workflow.camera.zoom;
    H = rect.height / workflow.camera.zoom;
    minX = -workflow.camera.x / workflow.camera.zoom;
    minY = -workflow.camera.y / workflow.camera.zoom;
  } else {
    W = (maxX - minX) + pad * 2;
    H = (maxY - minY) + pad * 2;
  }
  W = Math.max(W, 16); H = Math.max(H, 16);

  const scale = 2; // 高清 2x
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(W * scale));
  cv.height = Math.max(1, Math.round(H * scale));
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  const ox = -minX + pad, oy = -minY + pad;

  // 2. 背景底色 + 图案（跟随 bgMode）
  ctx.fillStyle = COLORS.bgDeepest;
  ctx.fillRect(0, 0, W, H);
  exportPaintBg(ctx, ox, oy, W, H);

  // 3. 连线（贝塞尔，目标节点类型色）
  workflow.edges.forEach(edge => {
    const fn = edge.from.node, tn = edge.to.node;
    if (!fn.el || !tn.el) return;
    const fp = portWorldPos(fn, 'output', edge.from.port);
    const tp = portWorldPos(tn, 'input', edge.to.port);
    const color = (tn.def && tn.def.color) || COLORS.primary;
    exportDrawBezier(ctx, fp.x + ox, fp.y + oy, tp.x + ox, tp.y + oy, color, 2);
  });

  // 4. 节点卡（预载缩略图后绘制）
  const thumbs = await Promise.all([...workflow.nodes.values()].map(n => exportLoadThumb(n.thumb)));
  const panelBg = getCSSVar('--bg-panel');
  const textHi = getCSSVar('--text-1');
  let ti = 0;
  workflow.nodes.forEach(n => {
    const el = n.el;
    const w = (el ? el.offsetWidth : (n.width || 280)) || 280;
    const h = (el ? el.offsetHeight : 160) || 160;
    const x = n.x + ox, y = n.y + oy;
    const color = (n.def && n.def.color) || '#5B8DEF';
    // 卡片底
    exportRoundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = panelBg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.stroke();
    // 头部色条
    ctx.save();
    exportRoundRectPath(ctx, x, y, w, 28, 10);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.20;
    ctx.fillRect(x, y, w, 28);
    ctx.globalAlpha = 1;
    ctx.restore();
    // 标题
    ctx.fillStyle = textHi;
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(exportTruncate(n.title || n.type, Math.max(6, Math.floor(w / 9))), x + 10, y + 14);
    // 缩略图或文本
    const thumb = thumbs[ti++];
    const bodyY = y + 32, bodyH = h - 36;
    if (thumb) {
      ctx.save();
      exportRoundRectPath(ctx, x + 6, bodyY, w - 12, Math.max(8, bodyH - 6), 6);
      ctx.clip();
      exportDrawImageCover(ctx, thumb, x + 6, bodyY, w - 12, Math.max(8, bodyH - 6));
      ctx.restore();
    } else {
      const txt = n.prompt || (n.params && n.params.fields && (n.params.fields.prompt || n.params.fields.script)) || '';
      ctx.fillStyle = textHi;
      ctx.globalAlpha = 0.55;
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'top';
      const lines = exportTruncate(txt, 160).split(/\n/);
      let ty = bodyY + 8;
      for (const ln of lines) {
        if (ty + 14 > y + h - 6) break;
        ctx.fillText(ln, x + 10, ty);
        ty += 15;
      }
      ctx.globalAlpha = 1;
    }
  });

  // 5. 测试钩子 + 下载
  window.__lastExportPng = cv.toDataURL('image/png');
  window.__exportPngInfo = { w: cv.width, h: cv.height, nodes: workflow.nodes.size, edges: workflow.edges.size, bgMode };
  cv.toBlob(blob => {
    if (!blob) { showToast('导出失败：无法生成 PNG', 'danger'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowcraft-canvas-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('已导出整画布 PNG（' + workflow.nodes.size + ' 节点）', 'success');
  }, 'image/png');
}

//================ 4h. 项目交付包导出（借鉴 Hell Grind 场景表 + 每镜提示词 + 资产清单）================
function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function downloadTextFile(text, filename, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 一键导出交付包：场景表 CSV + 每镜提示词 MD + 资产清单 CSV + 完整工作流 JSON + 说明
function exportDeliveryPackage() {
  const shots = (workflow.shots || []);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  // 1) 场景表 CSV（带 BOM，Excel 中文友好）
  const sceneHeader = ['镜头号', '场景', '名称', '描述', '提示词', '状态', '节点ID', '生成结果'];
  const statusLabel = { idle: '待生成', running: '生成中', done: '已完成', error: '失败', grouped: '已建组' };
  const sceneRows = shots.map(s => [
    s.shotNo || '', s.scene || '', s.name || '', s.desc || '', s.prompt || '',
    statusLabel[s.status] || s.status || '', s.nodeId || '', ''
  ]);
  const sceneCsv = '﻿' + [sceneHeader.map(csvCell).join(','), ...sceneRows.map(r => r.map(csvCell).join(','))].join('\n');

  // 2) 每镜提示词 MD
  const promptsMd = ['# 每镜提示词（交付包 ' + stamp + '）', ''].concat(
    shots.map(s => [
      '## ' + (s.shotNo ? s.shotNo + ' ' : '') + (s.name || '未命名镜头'),
      '', '**场景**：' + (s.scene || '—'), '**描述**：' + (s.desc || '—'), '',
      '**Prompt**：', '```', s.prompt || '（未填写）', '```', ''
    ].join('\n')
  )).join('\n');

  // 3) 资产清单 CSV（来自素材库）
  let assetRows = [];
  try {
    const cats = loadAssetCats(); const meta = loadAssetMeta(); const all = collectAssets(); const nameMap = assetNameMap(all);
    all.forEach(a => {
      const k = assetKey(a);
      const c = cats[k] || '通用';
      const nm = nameMap[k] || a.nodeTitle || a.label || '';
      const url = (a.src && /^https?:/.test(a.src)) ? a.src : '';
      assetRows.push([nm, c, '<<<' + nm + '>>>', a.type || '', url]);
    });
  } catch (e) {}
  const assetHeader = ['资产名', '分类', '引用令牌', '类型', '预览URL'];
  const assetCsv = '﻿' + [assetHeader.map(csvCell).join(','), ...assetRows.map(r => r.map(csvCell).join(','))].join('\n');

  // 4) 完整工作流 JSON
  const wfJson = serializeWorkflow(false);

  // 5) 说明
  const readme = [
    'FlowCraft 项目交付包（' + stamp + '）', '',
    '本交付包包含：',
    '- scene-table.csv ：场景表 / 分镜清单（镜头号、场景、名称、描述、提示词、状态、节点ID、生成结果）',
    '- prompts.md ：每镜提示词明细',
    '- assets-manifest.csv ：资产清单（名称、分类、引用令牌、类型、预览URL）',
    '- workflow.json ：完整工作流（节点 + 连线 + 场景分组）', '',
    '共 ' + shots.length + ' 个镜头，' + workflow.nodes.size + ' 个画布节点，' + assetRows.length + ' 个资产。'
  ].join('\n');

  // 依次下载（错开避免浏览器批量下载拦截）
  const files = [
    ['scene-table.csv', sceneCsv, 'text/csv;charset=utf-8'],
    ['prompts.md', promptsMd, 'text/markdown;charset=utf-8'],
    ['assets-manifest.csv', assetCsv, 'text/csv;charset=utf-8'],
    ['workflow.json', wfJson, 'application/json'],
    ['交付包说明.txt', readme, 'text/plain;charset=utf-8']
  ];
  files.forEach((f, i) => setTimeout(() => downloadTextFile(f[1], f[0], f[2]), i * 350));
  showToast('已生成交付包：场景表 + 每镜提示词 + 资产清单 + 工作流（' + files.length + ' 个文件）', 'success', 4500);
}

//================ 4g. 工作流管理 (命名保存 / 加载 / 删除 / 导出) ================
const WORKFLOWS_KEY = 'flowcraft:workflows:v1';

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getWorkflowStore() {
  try {
    const raw = localStorage.getItem(WORKFLOWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function setWorkflowStore(store) {
  try { localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(store)); return true; }
  catch (e) { showToast('保存失败：浏览器存储空间不足', 'danger'); return false; }
}

// 统一加载工作流数据（导入 / 命名加载 复用）
function applyWorkflowData(parsed) {
  const validation = validateWorkflowData(parsed);
  if (!validation.ok) throw new Error('无效的工作流数据：' + validation.errors.slice(0, 5).join('；'));
  pushHistory();
  workflow.nodes.forEach(n => { if (n.el) n.el.remove(); });
  workflow.nodes.clear();
  workflow.edges.clear();
  workflow.order = [];
  workflow.selection.clear();
  recycleBin.length = 0;

  if (parsed.nodeIdSeq) nodeIdSeq = parsed.nodeIdSeq;
  if (parsed.edgeIdSeq) edgeIdSeq = parsed.edgeIdSeq;

  const idMap = {};
  parsed.nodes.forEach(nd => {
    const node = new WorkflowNode(nd.type, nd.x, nd.y);
    node.id = nd.id;
    node.width = nd.width || 280;
    node.height = nd.height || 200;
    node.title = nd.title || node.def.label;
    node.thumb = nd.thumb || null;
    node.uploadedVideo = typeof nd.uploadedVideo === 'string' ? nd.uploadedVideo : '';
    node.prompt = nd.prompt || '';
    node.refImages = normalizeRefImages(nd.refImages);
    node.refVideos = Array.isArray(nd.refVideos) ? JSON.parse(JSON.stringify(nd.refVideos)) : [];
    node.charDesc = typeof nd.charDesc === 'string' ? nd.charDesc : '';
    node.stateMeta = copyStateMeta(nd.stateMeta);
    node.failureReason = nd.failureReason || (node.stateMeta && node.stateMeta.failureReason) || nd._lastError || '';
    node._lastError = node.failureReason;
    node.genMeta = copyGenMeta(nd.genMeta);
    node.params = { ...DEFAULT_NODE_PARAMS, ...(nd.params || {}) };
    node.status = nd.status || 'idle';
    node.previewOnly = !!nd.previewOnly;
    node.previewSourceId = typeof nd.previewSourceId === 'string' ? nd.previewSourceId : '';
    node.inputsData = nd.inputsData ? JSON.parse(JSON.stringify(nd.inputsData)) : (node.def.inputs || []).map(() => null);
    node.outputsData = nd.outputsData ? JSON.parse(JSON.stringify(nd.outputsData)) : (node.def.outputs || []).map(() => null);
    const el = createNodeElement(node);
    nodeLayer.appendChild(el);
    workflow.nodes.set(node.id, node);
    workflow.order.push(node.id);
    idMap[nd.id] = node;
  });

  if (parsed.edges) {
    parsed.edges.forEach(ed => {
      const fromNode = idMap[ed.fromNodeId];
      const toNode = idMap[ed.toNodeId];
      if (fromNode && toNode) {
        const edge = new Edge(fromNode, ed.fromPort, toNode, ed.toPort);
        edge.id = ed.id;
        workflow.edges.set(edge.id, edge);
      }
    });
  }
  if (parsed.camera) {
    workflow.camera.x = parsed.camera.x;
    workflow.camera.y = parsed.camera.y;
    workflow.camera.zoom = parsed.camera.zoom;
  }
  if (parsed.nextZ) workflow.nextZ = parsed.nextZ;
  if (Array.isArray(parsed.order) && parsed.order.length) {
    workflow.order = parsed.order.filter(id => workflow.nodes.has(id));
  }
  if (parsed.recycleBin) {
    parsed.recycleBin.forEach(item => {
      recycleBin.push({
        node: { ...item.node, params: { ...item.node.params } },
        edges: item.edges.map(e => ({ ...e })),
        deletedAt: item.deletedAt,
      });
    });
  }
  if (Array.isArray(parsed.shots)) {
    workflow.shots = parsed.shots.map(s => ({
      id: s.id || ('shot_' + Math.random().toString(36).slice(2, 9)),
      name: s.name || '', scene: s.scene || '', shotNo: s.shotNo || '',
      desc: s.desc || '', prompt: s.prompt || '', status: s.status || 'idle', nodeId: s.nodeId || null,
    }));
  }
  if (Array.isArray(parsed.scenes)) {
    const validIds = new Set(workflow.nodes.keys());
    workflow.scenes = parsed.scenes.map(s => ({
      id: s.id || ('scene_' + Math.random().toString(36).slice(2, 9)),
      name: s.name || '未命名场景', color: s.color || '#5B8DEF',
      nodeIds: Array.isArray(s.nodeIds) ? s.nodeIds.filter(id => validIds.has(id)) : [],
    }));
  } else {
    workflow.scenes = [];
  }
  applySceneTints();
  applyTransform();
  updateStatusbar();
  updateRecycleUI();
  markEdgesDirty();
  scheduleAutosave();
}

function saveNamedWorkflow(name) {
  const store = getWorkflowStore();
  const id = 'wf_' + Date.now().toString(36);
  store[id] = {
    id,
    name: name || ('工作流 ' + new Date().toLocaleString()),
    savedAt: new Date().toISOString(),
    data: serializeWorkflow(),
  };
  if (!setWorkflowStore(store)) return;
  updateWorkflowPanel();
  showToast('已保存工作流：' + store[id].name, 'success');
}

function getWorkflowList() {
  const store = getWorkflowStore();
  return Object.values(store).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

function loadNamedWorkflow(id) {
  const store = getWorkflowStore();
  const item = store[id];
  if (!item) { showToast('工作流不存在', 'danger'); return; }
  try {
    applyWorkflowData(JSON.parse(item.data));
    setTimeout(() => fitToContent(), 100);
    showToast('已加载：' + item.name, 'success');
    toggleWorkflowPanel(false);
    refreshAssetPanelIfOpen();
  } catch (err) {
    showToast('加载失败: ' + err.message, 'danger');
  }
}

function renameNamedWorkflow(id, newName) {
  const store = getWorkflowStore();
  if (!store[id]) return;
  store[id].name = newName;
  setWorkflowStore(store);
  updateWorkflowPanel();
}

function deleteNamedWorkflow(id) {
  const store = getWorkflowStore();
  if (!store[id]) return;
  delete store[id];
  setWorkflowStore(store);
  updateWorkflowPanel();
}

function updateWorkflowPanel() {
  const list = document.getElementById('workflowList');
  const count = document.getElementById('workflowCount');
  if (!list) return;
  const items = getWorkflowList();
  if (count) count.textContent = items.length;
  if (items.length === 0) {
    list.innerHTML = '<div class="recycle-empty"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4a2 2 0 012-2h3l2 2h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/></svg><div class="empty-text">暂无保存的工作流<br>点击「保存当前为…」创建</div></div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'wf-card';
    const date = new Date(item.savedAt).toLocaleString();
    card.innerHTML =
      '<div class="wf-card-main">' +
        '<div class="wf-card-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</div>' +
        '<div class="wf-card-meta">' + escapeHtml(date) + '</div>' +
      '</div>' +
      '<div class="wf-card-actions">' +
        '<button class="wf-btn" data-act="open">打开</button>' +
        '<button class="wf-btn" data-act="rename">改名</button>' +
        '<button class="wf-btn danger" data-act="export">导出</button>' +
        '<button class="wf-btn danger" data-act="delete">删除</button>' +
      '</div>';
    card.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        const act = btn.dataset.act;
        if (act === 'open') {
          loadNamedWorkflow(item.id);
        } else if (act === 'export') {
          const blob = new Blob([item.data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = (item.name || 'workflow').replace(/[\\/:*?"<>|]/g, '_') + '.json';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else if (act === 'rename') {
          const nn = prompt('重命名工作流', item.name);
          if (nn && nn.trim()) renameNamedWorkflow(item.id, nn.trim());
        } else if (act === 'delete') {
          if (confirm('确定删除工作流「' + item.name + '」？此操作不可撤销。')) deleteNamedWorkflow(item.id);
        }
      };
    });
    list.appendChild(card);
  });
}

function toggleWorkflowPanel(show) {
  const panel = document.getElementById('workflowPanel');
  const overlay = document.getElementById('workflowOverlay');
  if (!panel) return;
  const open = show === undefined ? !panel.classList.contains('show') : show;
  panel.classList.toggle('show', open);
  overlay.classList.toggle('show', open);
  if (open) updateWorkflowPanel();
}

function newWorkflow() {
  if (!confirm('新建空白工作流将清空当前画布（自动保存的内容在重新打开时仍可恢复）。确定继续？')) return;
  pushHistory();
  workflow.nodes.forEach(n => { if (n.el) n.el.remove(); });
  workflow.nodes.clear();
  workflow.edges.clear();
  workflow.order = [];
  workflow.selection.clear();
  recycleBin.length = 0;
  applyTransform();
  updateStatusbar();
  updateRecycleUI();
  markEdgesDirty();
  scheduleAutosave();
  showToast('已新建空白工作流', 'info');
  refreshAssetPanelIfOpen();
}

//================ #13 多工作台：切换 / 新建 / 改名 / 删除 + 面板 ================
async function switchWorkbench(id) {
  const store = getWorkbenches();
  const target = store[id];
  if (!target || id === getActiveWbId()) { if (target) toggleWorkbenchPanel(false); return; }
  const cur = getActiveWorkbench();
  if (cur) saveCurrentToWorkbench(cur); // 先落盘当前画布
  setActiveWbId(id);
  clearCanvasToEmpty();
  try {
    const full = await idbGet(wbKey(id));
    if (full && typeof full === 'string') {
      const parsed = JSON.parse(full);
      if (parsed) {
        applyWorkflowData(parsed);
        try { localStorage.setItem(AUTOSAVE_KEY, serializeWorkflow(true)); } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('[FlowCraft] 切换工作台：读取完整版失败，回退轻量恢复', e && e.message);
    clearCanvasToEmpty();
  }
  setTimeout(() => fitToContent(), 100);
  updateWorkbenchPanel();
  renderWorkbenchSelect();
  updateWorkflowPanel();
  toggleWorkbenchPanel(false);
  showToast('已切换到工作台：' + target.name, 'success');
  refreshAssetPanelIfOpen();
  restoreFullAutosaveFromIDB(false); // #13b：切换后后台补全目标工作台完整大图版本（不校验，目标刚加载）
}

async function newWorkbench(name) {
  const cur = getActiveWorkbench();
  if (cur) saveCurrentToWorkbench(cur);
  const id = 'wb_' + Date.now().toString(36);
  const wb = { id, name: (name && String(name).trim()) || ('工作台 ' + (Object.keys(getWorkbenches()).length + 1)), savedAt: new Date().toISOString() };
  const store = getWorkbenches();
  store[id] = wb;
  setWorkbenches(store);
  setActiveWbId(id);
  try { localStorage.setItem(AUTOSAVE_KEY, ''); } catch (e) {}
  clearCanvasToEmpty();
  updateWorkbenchPanel();
  renderWorkbenchSelect();
  showToast('已新建工作台：' + wb.name + '（独立自动保存）', 'success');
}

function renameWorkbench(id, name) {
  const store = getWorkbenches();
  if (!store[id]) return;
  store[id].name = String(name || '').trim() || store[id].name;
  setWorkbenches(store);
  updateWorkbenchPanel();
  renderWorkbenchSelect();
}

function deleteWorkbench(id) {
  const store = getWorkbenches();
  if (!store[id]) return;
  if (!confirm('确定删除工作台「' + store[id].name + '」？其中的画布内容将一并删除，不可恢复。')) return;
  delete store[id];
  setWorkbenches(store);
  idbDel(wbKey(id)); // #13b：清理该工作台的完整版大图
  if (getActiveWbId() === id) {
    const rest = Object.keys(store);
    if (rest.length) {
      setActiveWbId(rest[0]);
      switchWorkbench(rest[0]);
    } else {
      setActiveWbId('');
      newWorkbench('默认工作台');
    }
  } else {
    updateWorkbenchPanel();
    renderWorkbenchSelect();
  }
}

function updateWorkbenchPanel() {
  const list = document.getElementById('workbenchList');
  if (!list) return;
  const count = document.getElementById('workbenchCount');
  const items = getWorkbenchList();
  const activeId = getActiveWbId();
  if (count) count.textContent = items.length;
  if (!items.length) {
    list.innerHTML = '<div class="recycle-empty"><div class="empty-text">暂无工作台<br>点下方「新建工作台」创建</div></div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(wb => {
    const card = document.createElement('div');
    card.className = 'wbf-card' + (wb.id === activeId ? ' active' : '');
    const date = new Date(wb.savedAt).toLocaleString();
    card.innerHTML =
      '<div class="wbf-main">' +
        '<div class="wbf-name" title="' + escapeHtml(wb.name) + '">' + escapeHtml(wb.name) +
          (wb.id === activeId ? '<span class="wbf-badge">当前</span>' : '') + '</div>' +
        '<div class="wbf-meta">' + escapeHtml(date) + '</div>' +
      '</div>' +
      '<div class="wbf-actions">' +
        '<button class="wf-btn" data-act="open">切换</button>' +
        '<button class="wf-btn" data-act="rename">改名</button>' +
        '<button class="wf-btn danger" data-act="delete">删除</button>' +
      '</div>';
    card.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        const act = btn.dataset.act;
        if (act === 'open') {
          if (wb.id !== activeId) switchWorkbench(wb.id);
          else toggleWorkbenchPanel(false);
        } else if (act === 'rename') {
          const nn = prompt('重命名工作台', wb.name);
          if (nn && nn.trim()) renameWorkbench(wb.id, nn.trim());
        } else if (act === 'delete') {
          deleteWorkbench(wb.id);
        }
      };
    });
    list.appendChild(card);
  });
}

// 顶栏「工作台」按钮 title 显示当前工作台名
function renderWorkbenchSelect() {
  const btn = document.getElementById('btnWorkbench');
  const wb = getActiveWorkbench();
  if (btn) btn.title = '工作台（当前：' + ((wb && wb.name) || '—') + '）— 多画布独立切换';
  const lbl = document.getElementById('workbenchCurrentName');
  if (lbl) lbl.textContent = (wb && wb.name) || '—';
}

function toggleWorkbenchPanel(show) {
  const panel = document.getElementById('workbenchPanel');
  const overlay = document.getElementById('workbenchOverlay');
  if (!panel) return;
  const open = show === undefined ? !panel.classList.contains('show') : show;
  panel.classList.toggle('show', open);
  if (overlay) overlay.classList.toggle('show', open);
  if (open) { updateWorkbenchPanel(); renderWorkbenchSelect(); }
}

//================ 4h. 资产管理 (素材库) ================
const ASSET_IMAGE_TYPES = ['image', 'aiImage', 'imageEdit', 'aiVideo', 'upscale', 'compare', 'aiSet', 'material', 'light', 'layout', 'lineart', 'comfyui'];

function collectAssets() {
  const assets = [];
  workflow.nodes.forEach(node => {
    const def = node.def || {};
    // 节点自身缩略图（产出图类型）
    if (ASSET_IMAGE_TYPES.includes(node.type) && normalizeImageSrc(node.thumb)) {
      assets.push({ src: node.thumb, label: '节点图', nodeId: node.id, nodeTitle: node.title, kind: 'thumb' });
    }
    // 输入图片（按端口语义名）
    (node.inputsData || []).forEach((pl, i) => {
      if (pl && pl.type === 'image' && normalizeImageSrc(pl.value)) {
        const portLabel = (def.inputs && def.inputs[i]) ? def.inputs[i].label : ('输入' + (i + 1));
        assets.push({ src: pl.value, label: '输入·' + portLabel, nodeId: node.id, nodeTitle: node.title, kind: 'input' });
      }
    });
    // 产出图片
    (node.outputsData || []).forEach((pl, i) => {
      if (pl && pl.type === 'image' && normalizeImageSrc(pl.value)) {
        assets.push({ src: pl.value, label: '产出·' + (i + 1), nodeId: node.id, nodeTitle: node.title, kind: 'output' });
      }
    });
  });
  // 同图去重（按内容 src）：同一张图在不同身份(节点图/产出/输入/多节点)下只保留一条，避免素材库双份
  let list = [];
  const seenSrc = new Set();
  assets.forEach(a => { if (!seenSrc.has(a.src)) { seenSrc.add(a.src); list.push(a); } });
  // #11 跨画布复用：合并全局资产库。全局库内同 src：保留所有「带自定义名」的（不同命名资产），无名的只留首条（重复保存去重）。
  // 全局 vs 当前同 src：带自定义名的全局条目替换当前条目（保留 <<<名称>>> 令牌），无名的当前已展示则跳过。
  const curKeys = new Set(list.map(a => assetKey(a)));
  const gNamedSrc = new Set();
  const gUnnamedSrc = new Set();
  const gPicked = [];
  globalAssetEntries().forEach(g => {
    if (getAssetMeta(assetKey(g)).name) { gPicked.push(g); gNamedSrc.add(g.src); return; }
    if (gUnnamedSrc.has(g.src) || gNamedSrc.has(g.src)) return;
    gUnnamedSrc.add(g.src);
    gPicked.push(g);
  });
  gPicked.forEach(g => {
    const k = assetKey(g);
    const same = list.find(a => a.src === g.src);
    if (same) {
      if (getAssetMeta(k).name) { const idx = list.indexOf(same); if (idx >= 0) list[idx] = g; }
      return;
    }
    if (!curKeys.has(k)) list.push(g);
  });
  return list;
}

function updateAssetPanel() {
  const grid = document.getElementById('assetGrid');
  const empty = document.getElementById('assetEmpty');
  const count = document.getElementById('assetCount');
  if (!grid) return;
  const metaMap = loadAssetMeta();
  const catsMap = loadAssetCats();
  const all = collectAssets();
  const nameMap = assetNameMap(all);
  // 搜索框：按资产名称（含引用令牌名/节点标题/标签）过滤，与分类过滤叠加
  const searchEl = document.getElementById('assetSearch');
  if (searchEl && !searchEl._fcBound) { searchEl._fcBound = true; searchEl.oninput = () => updateAssetPanel(); }
  const q = String((searchEl && searchEl.value) || '').trim().toLowerCase();
  let assets = _assetCatFilter ? all.filter(a => catsMap[assetKey(a)] === _assetCatFilter) : all;
  if (q) assets = assets.filter(a => String(nameMap[assetKey(a)] || a.nodeTitle || a.label || '').toLowerCase().indexOf(q) >= 0);
  if (count) count.textContent = assets.length + ((_assetCatFilter || q) ? ' / ' + all.length : '');
  grid.innerHTML = '';
  if (assets.length === 0) {
    if (empty) empty.style.display = '';
  } else {
    if (empty) empty.style.display = 'none';
    assets.forEach((a, idx) => {
      const safeTitle = escapeHtml(a.nodeTitle || '节点');
      const safeLabel = escapeHtml(a.label);
      const key = assetKey(a);
      const meta = metaMap[key] || { name: '', cat: '', lock: '' };
      const refName = nameMap[key] || (a.nodeTitle || a.label || '资产');
      const isAsset = !!(meta.name || meta.cat === '角色' || meta.cat === '道具');
      const cell = document.createElement('div');
      cell.className = 'asset-card' + (isAsset ? ' is-asset' : '');
      cell.innerHTML =
        '<div class="asset-thumb" title="' + safeTitle + ' · ' + safeLabel + '">' +
          '<img src="' + a.src + '" alt="' + safeTitle + '" />' +
        '</div>' +
        '<div class="asset-info">' +
          '<div class="asset-title" title="' + safeTitle + '">' + safeTitle +
            (isAsset ? '<span class="asset-badge">资产</span>' : '') + '</div>' +
          '<div class="asset-cap">' + safeLabel + ' · 令牌 &lt;&lt;&lt;' + escapeHtml(refName) + '&gt;&gt;&gt;</div>' +
          '<input class="asset-name-input" type="text" placeholder="资产名称（即引用令牌）" />' +
          '<select class="asset-cat-select" title="分类（角色/道具/场景/通用）">' +
            '<option value="">通用</option>' +
            '<option value="角色">角色</option>' +
            '<option value="道具">道具</option>' +
            '<option value="场景">场景</option>' +
          '</select>' +
          '<textarea class="asset-lock-input" rows="1" placeholder="锁定描述：外观/服装/配色，生成时自动附加"></textarea>' +
        '</div>' +
        '<div class="asset-actions">' +
          '<button class="asset-set-btn" data-act="setasset" title="保存名称 + 分类 + 锁定描述，成为可引用资产">设为资产</button>' +
        '</div>' +
        '<div class="asset-actions">' +
          '<button class="asset-btn" data-act="view">查看</button>' +
          '<button class="asset-btn" data-act="locate">定位</button>' +
          '<button class="asset-btn" data-act="download">下载</button>' +
          '<button class="asset-ref-btn" data-act="ref" title="复制 <<<名称>>> 引用令牌到提示词">引用</button>' +
        '</div>';
      cell.querySelector('.asset-thumb').onclick = () => openImageLightbox(a.src);
      cell.querySelector('[data-act="view"]').onclick = () => openImageLightbox(a.src);
      cell.querySelector('[data-act="locate"]').onclick = () => {
        if (!workflow.nodes.has(a.nodeId)) { showToast('该资产来自其他画布，无法在本画布定位（仍可引用）', 'warn'); return; }
        locateNode(a.nodeId); toggleAssetPanel(false);
      };
      cell.querySelector('[data-act="download"]').onclick = () => downloadDataUrl(a.src, 'asset_' + (idx + 1) + '.png');
      const nameInput = cell.querySelector('.asset-name-input');
      const lockInput = cell.querySelector('.asset-lock-input');
      nameInput.value = meta.name || '';
      lockInput.value = meta.lock || '';
      const sel = cell.querySelector('.asset-cat-select');
      sel.value = catsMap[key] || '';
      sel.onchange = () => { saveAssetCat(key, sel.value); updateAssetPanel(); };
      cell.querySelector('[data-act="setasset"]').onclick = () => {
        const nm = (nameInput.value || '').trim();
        setAssetMeta(key, { name: nm, cat: sel.value, lock: (lockInput.value || '').trim() });
        // #11 跨画布复用：任一资产设为资产时，图片本体也写入全局库
        saveGlobalAssetImage(key, { src: a.src, nodeTitle: a.nodeTitle, label: a.label, kind: a.kind });
        showToast('已设为全局资产 <<<' + (nm || refName) + '>>>' + (sel.value ? ' · ' + sel.value : '') + '（跨画布可复用）', 'success');
        updateAssetPanel();
      };
      cell.querySelector('[data-act="ref"]').onclick = () => copyRefToken((nameInput.value || '').trim() || refName);
      grid.appendChild(cell);
    });
  }
  renderAssetFilterChips();
}

function locateNode(nodeId) {
  const node = workflow.nodes.get(nodeId);
  if (!node || !node.el) { showToast('节点不存在', 'warn'); return; }
  const cx = node.x + (node.width || 280) / 2;
  const cy = node.y + (node.height || 200) / 2;
  const rect = canvasWrap.getBoundingClientRect();
  workflow.camera.x = rect.width / 2 - cx * workflow.camera.zoom;
  workflow.camera.y = rect.height / 2 - cy * workflow.camera.zoom;
  applyTransform();
  selectNode(node);
  node.el.classList.add('flash');
  setTimeout(() => { if (node.el) node.el.classList.remove('flash'); }, 1300);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function toggleAssetPanel(show) {
  const panel = document.getElementById('assetPanel');
  const overlay = document.getElementById('assetOverlay');
  if (!panel) return;
  const open = show === undefined ? !panel.classList.contains('show') : show;
  panel.classList.toggle('show', open);
  overlay.classList.toggle('show', open);
  if (open) updateAssetPanel();
}

function refreshAssetPanelIfOpen() {
  const panel = document.getElementById('assetPanel');
  if (panel && panel.classList.contains('show')) updateAssetPanel();
}

// —— 镜头清单（场景表 / 分镜管理）—— v3.0 第 3 项
let _shotSeq = 0;
let _shotModalOpen = false;

function toggleShotPanel(show) {
  const panel = document.getElementById('shotPanel');
  const overlay = document.getElementById('shotOverlay');
  if (!panel) return;
  const open = show === undefined ? !panel.classList.contains('show') : show;
  panel.classList.toggle('show', open);
  overlay.classList.toggle('show', open);
  if (open) renderShotPanel();
}

function refreshShotPanelIfOpen() {
  const panel = document.getElementById('shotPanel');
  if (panel && panel.classList.contains('show') && !_shotModalOpen) renderShotPanel();
}

//================ 4j. 场景分组 ================
const SCENE_COLORS = ['#5B8DEF', '#9B59F0', '#3FB8AF', '#F2C66B', '#E0533D', '#26A69A', '#FF8A65', '#639922'];

function toggleScenePanel(show) {
  const panel = document.getElementById('scenePanel');
  if (!panel) return;
  const open = show === undefined ? !panel.classList.contains('show') : show;
  panel.classList.toggle('show', open);
  if (open) renderScenePanel();
}

function createScene(name, color) {
  pushHistory();
  const id = 'scene_' + Math.random().toString(36).slice(2, 9);
  const c = color || SCENE_COLORS[workflow.scenes.length % SCENE_COLORS.length];
  const scene = { id: id, name: name || ('场景 ' + (workflow.scenes.length + 1)), color: c, nodeIds: [] };
  workflow.scenes.push(scene);
  scheduleAutosave();
  renderScenePanel();
  applySceneTints();
  return scene;
}

function deleteScene(id) {
  pushHistory();
  workflow.scenes = workflow.scenes.filter(s => s.id !== id);
  scheduleAutosave();
  renderScenePanel();
  applySceneTints();
}

function addNodesToScene(sceneId, ids) {
  const scene = workflow.scenes.find(s => s.id === sceneId);
  if (!scene) return;
  const set = new Set(scene.nodeIds);
  ids.forEach(id => set.add(id));
  scene.nodeIds = [...set];
  scheduleAutosave();
  renderScenePanel();
  applySceneTints();
}

function focusScene(id) {
  const scene = workflow.scenes.find(s => s.id === id);
  if (!scene) return;
  workflow.selection.clear();
  scene.nodeIds.forEach(nid => {
    const n = workflow.nodes.get(nid);
    if (n) {
      workflow.selection.add(n.id);
      if (n.el) { n.el.classList.add('selected'); n.el.style.zIndex = (++workflow.nextZ).toString(); }
    }
  });
  if (scene.nodeIds.length) fitToContent();
  showToast('已聚焦场景「' + scene.name + '」· ' + scene.nodeIds.length + ' 个节点', 'info');
}

// 把选中节点染上所属场景颜色（支持一个节点归属多个场景时取第一个）
function applySceneTints() {
  // 清除旧染色
  workflow.nodes.forEach(n => { if (n.el) { n.el.classList.remove('scene-tint'); n.el.style.removeProperty('--scene-color'); } });
  (workflow.scenes || []).forEach(scene => {
    (scene.nodeIds || []).forEach(nid => {
      const n = workflow.nodes.get(nid);
      if (n && n.el) {
        n.el.classList.add('scene-tint');
        n.el.style.setProperty('--scene-color', scene.color);
      }
    });
  });
}

//================ 场景分组：模板（开箱即用） ================
// 每个模板是一组预置节点 + 连线，支持「追加」到当前画布或「清空并加载」。
const TEMPLATES = [
  {
    id: 'ai-draw',
    name: 'AI 绘图流水线',
    icon: '🎨', color: '#9B59F0',
    desc: '参考图 → 线稿 → 文生图 → 超清放大 → 保存，一条龙出图。',
    nodes: [
      { type: 'image', x: -900, y: -120, title: '参考图', params: {} },
      { type: 'lineart', x: -540, y: -120, title: '提取线稿', params: {} },
      { type: 'aiImage', x: -180, y: -120, title: '文生图', params: { model: 'GPT Image 2', prompt: '基于参考图与线稿，生成一张高质量的商业插画' } },
      { type: 'upscale', x: 180, y: -120, title: '智能超清', params: {} },
      { type: 'save', x: 540, y: -120, title: '保存到本地', params: {} }
    ],
    edges: [[0,1],[1,2],[2,3],[3,4]]
  },
  {
    id: 'video-gen',
    name: '短视频生成',
    icon: '🎬', color: '#C76BF7',
    desc: '脚本 → 素材 → 配音 → 字幕 → 配乐 → 合成 → 发布，全自动产出短视频。',
    nodes: [
      { type: 'script', x: -1080, y: 120, title: '写脚本', params: {} },
      { type: 'footage', x: -780, y: 120, title: '匹配素材', params: {} },
      { type: 'voiceover', x: -480, y: 120, title: 'AI 配音', params: {} },
      { type: 'subtitle', x: -180, y: 120, title: '生成字幕', params: {} },
      { type: 'bgm', x: 120, y: 120, title: '添加配乐', params: {} },
      { type: 'compose', x: 420, y: 120, title: '合成视频', params: {} },
      { type: 'publish', x: 720, y: 120, title: '多平台发布', params: {} }
    ],
    edges: [[0,1],[0,2],[2,3],[4,5],[1,5],[3,5],[5,6]]
  },
  {
    id: 'comfy-txt2img',
    name: 'ComfyUI 文生图',
    icon: '⚙️', color: '#6C5CE7',
    desc: '本地 ComfyUI 直连：文生图工作流，连上 127.0.0.1:8188 即可批量出图。',
    nodes: [
      { type: 'text', x: -540, y: -120, title: '正向提示词', params: { text: 'masterpiece, best quality, 1girl, silver hair, cinematic lighting' } },
      { type: 'comfyui', x: -180, y: -120, title: 'ComfyUI 文生图', params: { addr: 'http://127.0.0.1:8188', wf: 'txt2img', fields: {} } },
      { type: 'upscale', x: 180, y: -120, title: '超清放大', params: {} },
      { type: 'save', x: 540, y: -120, title: '保存', params: {} }
    ],
    edges: [[0,1],[1,2],[2,3]]
  },
  {
    id: 'character-sheet',
    name: '角色设定三视图',
    icon: '👤', color: '#FF8A65',
    desc: '角色参考 → 三视图（正/侧/背）→ 设定集，适合 IP 孵化与立绘设计。',
    nodes: [
      { type: 'image', x: -900, y: 180, title: '角色参考图', params: {} },
      { type: 'aiImage', x: -540, y: 180, title: '正面视图', params: { model: 'GPT Image 2', prompt: '同一角色的严格正面全身视图，平视，双臂自然下垂，纯色背景' } },
      { type: 'aiImage', x: -180, y: 180, title: '侧面视图', params: { model: 'GPT Image 2', prompt: '同一角色的正侧面视图，保持服装与发型一致' } },
      { type: 'aiImage', x: 180, y: 180, title: '背面视图', params: { model: 'GPT Image 2', prompt: '同一角色的正背面视图，保持服装与发型一致' } },
      { type: 'aiSet', x: 540, y: 180, title: '角色设定集', params: {} }
    ],
    edges: [[0,1],[0,2],[0,3],[1,4],[2,4],[3,4]]
  },
    {
    id: 'character-asset-board',
    name: '人物资产设计板',
    icon: '🎭', color: '#4ECDC4',
    desc: '10段式通用提示词模板：基于任意参考角色，自动生成含三视图+4项细节的专业角色设定板。',
    nodes: [
      { type: 'text', x: -360, y: -120, title: '参考角色与10段提示词', params: { charDesc: '', text: '以参考图作为角色外观与视觉风格设定依据，自动识别其中最主要角色，并延续该角色已有的外形轮廓、年龄气质、物种特征、面部或头部结构、发型、毛发、角、耳朵、面具、头盔、身体比例、服装、护甲、配件、纹样、材质、色彩和随身物件。\n\n基于参考图已有设计，自然补全角色未展示的正面、侧面、背面和局部结构。补全内容遵循参考图现有的造型语言、制作工艺、功能逻辑和色彩关系，保持简洁统一。生成一张16:9横版、纯白背景的专业角色视觉设定板。完全延续参考图原有的表现形式：写实角色继续保持真实质感，二次元角色继续保持原有动漫画风，卡通角色保持原有比例和线条，游戏角色保持原有建模与材质，非人角色保持原有物种结构，机械角色保持原有机械设计语言。所有视图采用统一画风、统一色温和统一光线。\n\n画面左侧放置角色的大型头部或核心识别区域特写。人形角色重点展示面部轮廓、五官、发型、妆容、头部配件与衣领；动物或非人角色重点展示眼睛、口鼻、耳朵、角、毛发、鳞片、外壳或其他主要识别结构；机械角色重点展示头部、面罩、传感器、发光核心和机械连接方式。\n\n如果参考角色佩戴面具、头盔、兜帽或其他遮面结构，则保持原有佩戴状态，通过头部造型、眼部区域和材质细节表现角色特征。特写与右侧三视图保持相同的外观、配色和配件。画面右侧并排展示角色的正面、完整侧面、背面全身正交三视图。\n\n三个视图等比例、同高度、同一基线，从角色最高点到最低点完整呈现，间距均匀，轮廓互不重叠。正面、侧面和背面准确展示角色的头部、躯干、四肢、服装、护甲、配件以及参考图中已有的尾巴、翅膀、角、触须、披风或其他特殊结构。人形角色采用自然标准站姿，双臂轻微离开身体，手部自然放松，服装轮廓和腰部结构清楚。四足角色采用稳定自然站姿，四肢落点和身体重心合理。悬浮型或无腿角色保持符合原设定的稳定状态，并为三个视图设置统一的垂直基准。\n\n三视图区域使用平静、清楚的展示状态。长发、衣摆、披风、飘带、尾巴、翅膀和柔性附属结构保持自然舒展，完整显示连接位置、长度、数量和前后层级，同时避免遮住身体主要结构。正面视图准确呈现角色的主要轮廓、配色分区、服装开合、主要配件和正面标志。侧面视图采用标准90度完整侧向角度，清楚呈现头部侧面、躯干厚度、关节关系、服装层级、前后轮廓和附属结构。\n\n背面视图清楚呈现后脑或头部背面、颈部连接、背部结构、服装后片、配件固定方式、尾部、翅膀、披风、衣摆和足部后侧。参考图未展示的背面，根据现有正面设计逻辑自然补全。画面中部或靠近下方的留白区域，自动选择最能帮助后续创作的4项小型补充视图。\n\n4项小型补充视图内容包括：1. 头部、眼睛、面部标记、面具或头饰细节；2. 服装、护甲、毛发、鳞片、外壳或主要材质细节；3. 腰部配件、徽记、扣具、首饰或功能连接结构；4. 手部、足部、爪部、关节、翅膀、尾巴或特殊器官细节；5. 参考图中已有的主要随身物件独立展示；6. 一个符合角色气质和能力特点的小型标志姿态。\n\n从以上内容中选择最有识别价值的4项。参考图中没有的结构或物件不作添加，相应位置改为展示角色真实存在的设计细节。补充视图尺寸明显小于主要特写和三视图，排列清楚，互不遮挡。所有视图保持角色的外形、比例、发型或头部结构、服装、配色、纹样、材质、配件数量和安装位置统一。非对称设计继续保持原有左右关系；重复结构保持相同数量；发光区域保持相同颜色、形状和位置。\n\n整体呈现为高完成度专业角色概念设计板，结构准确，材质清楚，细节精美，轮廓易于辨认，适合作为后续图片、动画、视频、游戏或三维制作的角色参考。16:9横版，纯白无缝背景，布局简洁，留白充足，画面只呈现角色设定需要的视图与细节，无文字、无标签、无边框、无水印。' } },
    { type: 'aiImage', x: 40, y: -120, title: '生成角色资产设计板', params: { model: 'GPT Image 2', prompt: '', negativePrompt: 'low quality, blurry, deformed, extra limbs, bad anatomy, text, watermark, signature, label, border, frame, cropped, multiple inconsistent styles, busy background, dark background', aspect: '16:9', count: '1张', resolution: '超清2K' } },
    ],
    edges: [[0,1]]
  },
  // ===== AUTO:25GRID_TEMPLATE =====
  ,
  {
  "id": "dress-25grid",
  "name": "连衣裙 25 宫格分镜",
  "icon": "👗",
  "color": "#FF4D6D",
  "desc": "基于视频反解的 25 格时尚舞台分镜：统一视觉锚点 × 5 维度（景别/机位/光影/动作/焦点）各 5 档，一键铺出 5×5 生图网格，每格预填英文提示词，运行即出图。",
  "nodes": [
    {
      "type": "text",
      "x": -1140,
      "y": -660,
      "title": "📐 25 宫格 · 统一锚点",
      "params": {
        "text": "连衣裙 25 宫格分镜模板 · 统一锚点：白色抹胸蓬蓬短裙 + 黑丝带 + 水晶蝴蝶结颈链 + 黑色蕾丝袜带 / 黑背景红舞台光 / 电影感时装摄影。\n每个「AI 绘图」节点已预填对应宫格的英文提示词，运行即出该格画面；负向词已内置。5 行 × 5 列 = 5 维度各 5 档组合。"
      }
    },
    {
      "type": "aiImage",
      "x": -760,
      "y": -360,
      "title": "01｜extreme long shot·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, single overhead spotlight, extreme long shot, front view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -380,
      "y": -360,
      "title": "02｜full body·side view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, full body, side view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 0,
      "y": -360,
      "title": "03｜close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, frontal key light, close-up, front view, elegant hand/leg detail, focus on jewelry/accessories, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 380,
      "y": -360,
      "title": "04｜full body·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, single overhead spotlight, full body, front view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 760,
      "y": -360,
      "title": "05｜medium close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, medium close-up, front view, standing still, focus on face, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -760,
      "y": -70,
      "title": "06｜close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, frontal key light, close-up, front view, lifting skirt hem, focus on fabric details, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -380,
      "y": -70,
      "title": "07｜close-up·side view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, frontal key light, close-up, side view, elegant hand/leg detail, focus on jewelry/accessories, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 0,
      "y": -70,
      "title": "08｜medium shot·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, medium shot, front view, turning with hair motion, focus on face, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 380,
      "y": -70,
      "title": "09｜close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, frontal key light, close-up, front view, standing still, focus on face, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 760,
      "y": -70,
      "title": "10｜full body·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, full body, front view, lifting skirt hem, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -760,
      "y": 220,
      "title": "11｜full body·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, full body, front view, dancing with skirt flying, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -380,
      "y": 220,
      "title": "12｜medium shot·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, medium shot, front view, turning with hair motion, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 0,
      "y": 220,
      "title": "13｜close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, close-up, front view, elegant hand/leg detail, focus on body parts, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 380,
      "y": 220,
      "title": "14｜extreme long shot·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, single overhead spotlight, extreme long shot, front view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 760,
      "y": 220,
      "title": "15｜close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, close-up, front view, lifting skirt hem, focus on fabric details, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -760,
      "y": 510,
      "title": "16｜medium shot·back view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, backlight silhouette, medium shot, back view, turning with hair motion, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -380,
      "y": 510,
      "title": "17｜full body·back view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, backlight silhouette, full body, back view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 0,
      "y": 510,
      "title": "18｜close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, close-up, front view, elegant hand/leg detail, focus on body parts, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 380,
      "y": 510,
      "title": "19｜medium close-up·side view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, medium close-up, side view, standing still, focus on face, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 760,
      "y": 510,
      "title": "20｜medium close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, frontal key light, medium close-up, front view, standing still, focus on face, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -760,
      "y": 800,
      "title": "21｜close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, frontal key light, close-up, front view, standing still, focus on jewelry/accessories, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": -380,
      "y": 800,
      "title": "22｜extreme long shot·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, atmospheric mixed red lights, extreme long shot, front view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 0,
      "y": 800,
      "title": "23｜medium close-up·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, medium close-up, front view, turning with hair motion, focus on face, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 380,
      "y": 800,
      "title": "24｜medium shot·side view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, multiple side spotlights, medium shot, side view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    },
    {
      "type": "aiImage",
      "x": 760,
      "y": 800,
      "title": "25｜extreme long shot·front view",
      "params": {
        "model": "GPT Image 2",
        "prompt": "young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings, atmospheric mixed red lights, extreme long shot, front view, standing still, focus on full figure, dark stage, black background, small ceiling light grid, high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial",
        "negativePrompt": "daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime",
        "aspect": "9:16",
        "count": "1张",
        "resolution": "超清2K"
      }
    }
  ],
  "edges": []
}
];

//================ 5b. 风格预设库（一键填充：角色描述 + AI 绘图参数） ================
//  按 category 分组（一级分类）；每组下多个 chip（二级标签），点击应用
const STYLE_PRESETS = [
  // —— 东方美学 ——
  { category: '东方美学', id: 'gufeng-dnv', name: '古风大女主', icon: '🏯', desc: '东方古装 · 名门千金', color: '#D9A441',
    charDesc: '一位出身名门的古风千金大小姐，气质温婉清冷，眉眼如画，云髻高绾配珠钗步摇，身着淡雅襦裙汉服，广袖流仙',
    text: '以参考图与上述描述为准，生成统一风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  { category: '东方美学', id: 'shuimo-guofeng', name: '国风水墨', icon: '🖌️', desc: '水墨丹青 · 留白意境', color: '#3D8B7D',
    charDesc: '一位水墨画风格的古典人物，衣袂飘飘，气质出尘，身姿绰约，眉目间有诗书气',
    text: '以参考图与上述描述为准，生成东方水墨国风风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  { category: '东方美学', id: 'guochao-chahua', name: '国潮插画', icon: '🧧', desc: '传统纹样 · 现代潮玩', color: '#E04F5F',
    charDesc: '一位国潮插画风格的时尚青年，融合传统纹样与街头潮流元素，配色鲜明，姿态自信',
    text: '以参考图与上述描述为准，生成国潮插画风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  // —— 写实风格 ——
  { category: '写实风格', id: 'xieshi-dianying', name: '写实电影人像', icon: '🎬', desc: '真人质感 · 电影光影', color: '#5B8DEF',
    charDesc: '一位东方年轻女性，五官立体，皮肤细腻真实，眼神有故事感，身着简约现代服装，气质清冷高级',
    text: '以参考图与上述描述为准，生成电影级写实风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  { category: '写实风格', id: 'dianying-xiezhen', name: '电影级写真', icon: '📸', desc: '商业摄影 · 大牌质感', color: '#8B5CF6',
    charDesc: '一位高级时尚感的模特，五官精致，气质冷艳，身着设计师款服装，气场强大',
    text: '以参考图与上述描述为准，生成商业时尚大片风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  // —— 动漫插画 ——
  { category: '动漫插画', id: 'erciyuan', name: '二次元动漫', icon: '🎀', desc: '日漫风 · 高完成度', color: '#F06BB0',
    charDesc: '一位元气满满的动漫少女，大眼睛水润，双马尾，身穿水手服，笑容灿烂，充满青春活力',
    text: '以参考图与上述描述为准，生成日系二次元风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  { category: '动漫插画', id: 'qban-katong', name: 'Q版卡通', icon: '🧸', desc: '萌系大头 · 三头身', color: '#FFA94D',
    charDesc: '一位Q版卡通风格的角色，头大身小比例可爱，大眼睛圆润，表情呆萌，穿着可爱服装',
    text: '以参考图与上述描述为准，生成Q版卡通风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  // —— 未来科技 ——
  { category: '未来科技', id: 'saibo-punk', name: '赛博朋克', icon: '🤖', desc: '霓虹都市 · 未来科技', color: '#00B8D9',
    charDesc: '一位赛博朋克风格的未来战士，短发利落，面部有精密机械纹路，身着高领机能风外套，霓虹灯光映照',
    text: '以参考图与上述描述为准，生成赛博朋克霓虹风格的四视角角色设定图（正面/侧面/背面/半身）。' },
  // —— 视频创作（生成图片型：完整 prompt 自描述，无角色依赖）——
  { category: '视频创作', mode: 'scene', id: 'koubo-fengmian', name: '口播封面', icon: '📢', desc: '爆款封面 · 大字标题位', color: '#E0533D',
    prompt: '生成一张高点击率的短视频封面图：主体人物位于左侧三分之二区域，表情有感染力，右侧预留标题文字空间，背景简洁有氛围光，色彩鲜艳对比强，电商广告质感，9:16 竖版',
    aspect: '9:16', count: '1张' },
  { category: '视频创作', mode: 'scene', id: 'dianshang-zhushijue', name: '电商主视觉', icon: '🛍️', desc: '产品展示 · 促销氛围', color: '#FF8A65',
    prompt: '生成一张电商主视觉图：主体商品位于画面中央黄金位置，底部预留价格与文案条幅空间，左右留白，背景为高级渐变+光晕氛围，产品打光专业，质感精致，1:1 方图',
    aspect: '1:1', count: '1张' },
  { category: '视频创作', mode: 'scene', id: 'zhuangchang-jingtou', name: '转场镜头', icon: '🔀', desc: '场景过渡 · 动感衔接', color: '#3DA5E0',
    prompt: '生成一张电影级转场镜头画面：两段场景以动态模糊和光影流动衔接，前景主体与背景场景形成对比，色彩过渡自然，运动感强，电影调色，9:16 竖版',
    aspect: '9:16', count: '1张' },
  { category: '视频创作', mode: 'scene', id: 'gengpai-jingtou', name: '跟拍镜头', icon: '🎥', desc: '第三人称跟随 · 人物动态', color: '#5B8DEF',
    prompt: '生成一张电影级跟拍镜头画面：从人物侧后方跟随视角，人物位于画面三分之一处行走或奔跑，背景街道/自然纵深虚化，速度感与呼吸感，电影调色，9:16 竖版',
    aspect: '9:16', count: '1张' },
  { category: '视频创作', mode: 'scene', id: 'lvpai-kongjing', name: '旅拍空镜', icon: '🏔️', desc: '风景氛围 · 治愈系', color: '#26A69A',
    prompt: '生成一张治愈系旅拍空镜图：绝美自然风光或城市地标，无人物或人物极小，光线柔和（日出/黄昏/蓝调时刻），色彩干净通透，电影感构图，可做短视频转场空镜，9:16 竖版',
    aspect: '9:16', count: '1张' },
  { category: '视频创作', mode: 'scene', id: 'vlog-kaichang', name: 'Vlog开场', icon: '📱', desc: '标题大字 · 氛围开场', color: '#F2C66B',
    prompt: '生成一张 Vlog 开场画面：主体人物或场景居中，四周留出大块纯净空间用于叠加标题大字，整体氛围感强、色调统一，高级简洁，杂志封面质感，9:16 竖版',
    aspect: '9:16', count: '1张' }
];

// 刷新侧边栏预设 chip 的"已应用"样式（会话级标记）
function refreshPresetChipUI() {
  if (!window.__appliedPresets) return;
  document.querySelectorAll('.preset-chip').forEach(function(c) {
    const applied = !!window.__appliedPresets[c.dataset.presetId];
    c.classList.toggle('preset-chip-applied', applied);
    if (applied) {
      const t = c.title || '';
      if (t.indexOf('已应用') < 0) c.title = t + '（已应用过，可再点追加）';
    }
  });
}

// 应用风格预设：创建 text（角色描述）+ aiImage（AI 绘图）并自动连线
function applyStylePreset(preset) {
  // 标记已应用（供侧边栏 chip 显示"已应用"样式），并即时刷新 chip UI
  window.__appliedPresets = window.__appliedPresets || {};
  window.__appliedPresets[preset.id] = true;
  refreshPresetChipUI();
  const cam = workflow.camera;
  const rect = canvasWrap.getBoundingClientRect();
  const cx = (rect.width / 2 - cam.x) / cam.zoom;
  const cy = (rect.height / 2 - cam.y) / cam.zoom;
  const tx = cx - 240, ty = cy - 60;

  const textNode = addNode('text', tx, ty);
  textNode.title = preset.name + (preset.mode === 'scene' ? ' · 提示词' : ' · 角色描述');
  textNode.charDesc = preset.charDesc || '';
  textNode.prompt = preset.text || '';
  if (textNode.el) buildNodeBody(textNode.el, textNode);

  const imgNode = addNode('aiImage', tx + 360, ty);
  imgNode.title = preset.name + ' · AI 绘图';
  // 视频创作/场景类预设用自带完整 prompt；角色类用默认视角指令（会被上游 charDesc+text 前置拼接）
  imgNode.prompt = preset.prompt || '同一角色保持外观一致，纯色背景';
  imgNode.params = Object.assign({}, imgNode.params, {
    model: 'GPT Image 2',
    aspect: preset.aspect || '9:16',
    count: preset.count || '4张',
    resolution: preset.resolution || '超清2K',
    negativePrompt: preset.negativePrompt || 'low quality, blurry, deformed, bad anatomy, text, watermark, signature',
  });
  if (imgNode.el) buildNodeBody(imgNode.el, imgNode);

  // text.out[0] → aiImage.in[0]（image 端口；prompt 经 effectivePrompt 拼接、参考图经 collectInlineRefs 传递）
  connectNodes(textNode.id, 0, imgNode.id, 0);
  // 多选只保留 imgNode（避免影响后续操作）
  workflow.selection.clear();
  workflow.selection.add(imgNode.id);
  markEdgesDirty();
  scheduleAutosave();
  showToast('已应用预设「' + preset.name + '」：提示词 + AI 绘图已创建并连线', 'success');
}

// 状态列表节点：根据「每行一个状态」批量生成 AI 绘图节点（保持角色一致 + 自动连线）
function generateStateNodes(node) {
  const lines = String(node.params && node.params.states || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) { showToast('请先在状态列表填写至少一个状态', 'warn'); return; }
  if (lines.length > 20) { showToast('状态数量过多（最多 20 个）', 'warn'); return; }

  const originX = node.x, originY = node.y;
  const batchId = newCharacterBatchId(node.id);
  const created = [];
  lines.forEach((state, i) => {
    const imgNode = addNode('aiImage', originX + 380, originY + i * 150);
    imgNode.title = '状态' + cnNum(i + 1) + '：' + state;
    imgNode.stateMeta = {
      sourceId: node.id, label: state, index: i + 1,
      batchId, batchIndex: i + 1, batchTotal: lines.length,
      batchProgress: null, failureReason: '',
    };
    imgNode.prompt = '同一角色保持脸型、发型、五官、体型、气质完全一致，仅更换：' + state + '，纯色背景';
    imgNode.params = Object.assign({}, imgNode.params, {
      model: 'GPT Image 2',
      aspect: '9:16',
      count: '1张',
      resolution: '超清2K',
      negativePrompt: 'low quality, blurry, deformed, extra limbs, bad anatomy, different face, different hairstyle, text, watermark, signature',
    });
    if (imgNode.el) buildNodeBody(imgNode.el, imgNode);
    // node.out[0] → imgNode.in[0]（image 端口；参考图经 collectInlineRefs 传递，角色描述经 effectivePrompt 拼接）
    connectNodes(node.id, 0, imgNode.id, 0);
    created.push(imgNode);
  });

  workflow.selection.clear();
  created.forEach(n => workflow.selection.add(n.id));
  if (created[0]) refreshCharacterBatchProgress(created[0]);
  markEdgesDirty();
  scheduleAutosave();
  showToast('已生成 ' + created.length + ' 个状态节点（角色一致 + 自动连线）', 'success');
}

// 从文本节点「角色描述」框解析状态列表并批量生成 AI 绘图节点
// 支持格式：
//   状态列表：
//   - 日常着装 / · 华丽礼服 / * 古风汉服
//   状态：雨中撑伞 / 状态2：xxx
function generateStateNodesFromText(textNode) {
  const raw = String(textNode.charDesc || '').trim();
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  const states = [];
  let inList = false;
  lines.forEach(line => {
    if (/^状态\s*列表/.test(line)) { inList = true; return; }
    const bullet = line.match(/^[-·•*]\s*(.+)$/);
    if (bullet) { states.push(bullet[1]); return; }
    const numbered = line.match(/^状态\s*\d*[:：]\s*(.+)$/);
    if (numbered) { states.push(numbered[1]); return; }
    if (inList && line) states.push(line);
  });
  if (!states.length) {
    showToast('请在「角色描述」框填写状态列表（每行一个：- 华丽礼服 或 状态：雨中撑伞）', 'warn');
    return;
  }
  if (states.length > 20) { showToast('状态数量过多（最多 20 个）', 'warn'); return; }

  const originX = textNode.x, originY = textNode.y;
  const batchId = newCharacterBatchId(textNode.id);
  const created = [];
  states.forEach((state, i) => {
    const imgNode = addNode('aiImage', originX + 420, originY + i * 170);
    imgNode.title = '状态' + cnNum(i + 1) + '：' + state;
    imgNode.stateMeta = {
      sourceId: textNode.id, label: state, index: i + 1,
      batchId, batchIndex: i + 1, batchTotal: states.length,
      batchProgress: null, failureReason: '',
    };
    imgNode.prompt = '同一角色保持脸型、发型、五官、体型、气质完全一致，仅更换：' + state + '，纯色背景';
    imgNode.params = Object.assign({}, imgNode.params, {
      model: 'GPT Image 2',
      aspect: '9:16',
      count: '1张',
      resolution: '超清2K',
      negativePrompt: 'low quality, blurry, deformed, extra limbs, bad anatomy, different face, different hairstyle, text, watermark, signature',
    });
    if (imgNode.el) buildNodeBody(imgNode.el, imgNode);
    // text.out[0] → imgNode.in[0]（参考图经 collectInlineRefs、描述经 effectivePrompt 拼接）
    connectNodes(textNode.id, 0, imgNode.id, 0);
    created.push(imgNode);
  });
  workflow.selection.clear();
  created.forEach(n => workflow.selection.add(n.id));
  if (created[0]) refreshCharacterBatchProgress(created[0]);
  markEdgesDirty();
  scheduleAutosave();
  showToast('已生成 ' + created.length + ' 个状态节点（角色一致 + 自动连线）', 'success');
  setTimeout(function() { fitToContent(); }, 60);
}

// 角色状态节点的最小管理闭环：单节点重试、复制并保持角色来源、删除走统一回收站。
function isCharacterStateNode(node) {
  return !!(node && node.type === 'aiImage' && node.stateMeta && node.stateMeta.label);
}

function retryCharacterStateNode(node) {
  if (!isCharacterStateNode(node)) return;
  if (node.status === 'running') return;
  // 取消是节点级终态意图；点击“重试”必须显式解除该意图，
  // 否则 Runner 会把新一轮执行继续判定为 cancelled。
  if (window.FlowCraft && window.FlowCraft.runner && typeof window.FlowCraft.runner.clearCancel === 'function') {
    window.FlowCraft.runner.clearCancel(node.id);
  }
  clearCharacterStateFailure(node);
  node.thumb = null;
  node._galleryImages = [];
  node.outputsData = (node.def.outputs || []).map(() => null);
  refreshCharacterBatchProgress(node);
  if (node.el) {
    buildNodeBody(node.el, node);
    updateNodeStatus(node);
  }
  scheduleAutosave();
  showToast('正在重试：' + node.title, 'info');
  runNode(node);
}

// 取消单个角色状态节点：进入“已取消”终态（区别于失败）。
// 运行中无法撤回已发出的网络请求，但 Runner 会丢弃晚到结果且不写回节点。
function cancelCharacterStateNode(node) {
  if (!isCharacterStateNode(node)) return;
  if (node.status === 'cancelled') return;
  if (window.FlowCraft && window.FlowCraft.runner && typeof window.FlowCraft.runner.cancel === 'function') {
    window.FlowCraft.runner.cancel(node.id);
  }
  setNodeStatus(node, 'cancelled', '');
  if (node.stateMeta) node.stateMeta.failureReason = '';
  if (node.el) updateNodeStatus(node);
  scheduleAutosave();
  showToast('已取消：' + (node.title || (node.stateMeta && node.stateMeta.label) || '状态节点'), 'info');
}

function duplicateCharacterStateNode(node) {
  if (!isCharacterStateNode(node)) return;
  const source = workflow.nodes.get(node.stateMeta.sourceId);
  const copy = duplicateNode(node);
  copy.title = node.title + ' · 副本';
  copy.stateMeta = {
    ...copyStateMeta(node.stateMeta),
    batchId: newCharacterBatchId(node.stateMeta.sourceId),
    batchIndex: 1,
    batchTotal: 1,
    batchProgress: null,
    failureReason: '',
    copyOf: node.id,
  };
  copy.status = 'idle';
  copy.failureReason = '';
  copy._lastError = '';
  copy.thumb = null;
  copy._galleryImages = [];
  if (copy.el) {
    const titleEl = copy.el.querySelector('.node-title-text');
    if (titleEl) titleEl.textContent = copy.title;
    buildNodeBody(copy.el, copy);
  }
  if (source) connectNodes(source.id, 0, copy.id, 0);
  refreshCharacterBatchProgress(copy);
  selectNode(copy);
  scheduleAutosave();
  showToast('已复制状态节点：' + (node.stateMeta.label || node.title), 'success');
  return copy;
}

function openTemplatePanel() {
  const panel = document.getElementById('templatePanel');
  if (panel) { panel.classList.add('show'); renderTemplateList(); }
}
function closeTemplatePanel() {
  const panel = document.getElementById('templatePanel');
  if (panel) panel.classList.remove('show');
}
function toggleTemplatePanel() {
  const panel = document.getElementById('templatePanel');
  if (!panel) return;
  if (panel.classList.contains('show')) closeTemplatePanel();
  else openTemplatePanel();
}

function renderTemplateList() {
  const list = document.getElementById('templateList');
  if (!list) return;
  list.innerHTML = TEMPLATES.map(t => {
    const chips = t.nodes.map(n => {
      const def = NODE_TYPES[n.type] || NODE_TYPES.image;
      return '<span class="template-chip">' + esc(def.label) + '</span>';
    }).join('');
    return '<div class="template-card">' +
      '<div class="template-card-head">' +
        '<span class="template-badge" style="background:' + t.color + '">' + t.icon + '</span>' +
        '<span class="template-name">' + esc(t.name) + '</span>' +
      '</div>' +
      '<div class="template-desc">' + esc(t.desc) + '</div>' +
      '<div class="template-flow">' + chips + '</div>' +
      '<div class="template-actions">' +
        (t.id === 'dress-25grid' ? '<button class="ai-btn small" data-act="generate25" data-id="' + t.id + '">直接生成</button>' : '') +
        '<button class="ai-btn small" data-act="append" data-id="' + t.id + '">追加</button>' +
        '<button class="ai-btn small" data-act="replace" data-id="' + t.id + '">清空并加载</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function cloneTemplateSpec(t) {
  return JSON.parse(JSON.stringify(t));
}

function loadTemplateSpec(t, mode) {
  if (!t) return;
  if (mode === 'replace') clearGraph();
  pushHistory();
  const created = [];
  // 追加模式：自动错开前一个模板的位置（整体放在现有节点右侧，避免重叠）
  let offX = 0, offY = 0;
  if (mode === 'append') {
    let tMinX = Infinity;
    t.nodes.forEach(s => { if (s.x < tMinX) tMinX = s.x; });
    if (!isFinite(tMinX)) tMinX = 0;
    const bb = getNodesBBox();
    const GAP = 80;
    if (bb) offX = (bb.maxX + GAP) - tMinX;
    else offX = -tMinX;
    offY = 0;
  }
  t.nodes.forEach(spec => {
    const x = spec.x + offX, y = spec.y + offY;
    const node = new WorkflowNode(spec.type, x, y);
    node.title = spec.title || node.def.label;
    if (spec.params) {
      node.params = Object.assign({}, node.params, spec.params);
      if (typeof spec.params.prompt === 'string') node.prompt = spec.params.prompt;
      else if (spec.type === 'text' && typeof spec.params.text === 'string') node.prompt = spec.params.text;
      if (typeof spec.params.script === 'string') node.script = spec.params.script;
      if (typeof spec.params.charDesc === 'string') node.charDesc = spec.params.charDesc;
    }
    const el = createNodeElement(node);
    nodeLayer.appendChild(el);
    workflow.nodes.set(node.id, node);
    workflow.order.push(node.id);
    if (node.el) node.el.classList.add('selected');
    buildNodeBody(node.el, node);
    created.push(node);
  });
  workflow.selection.clear();
  created.forEach(n => workflow.selection.add(n.id));
  (t.edges || []).forEach(([a, b]) => {
    const from = created[a], to = created[b];
    if (from && to) {
      const e = new Edge(from, 0, to, 0);
      workflow.edges.set(e.id, e);
    }
  });
  markEdgesDirty();
  updateStatusbar();
  renderMinimap();
  scheduleAutosave();
  setTimeout(() => fitToContent(), 60);
  showToast('已加载模板「' + t.name + '」· ' + created.length + ' 个节点', 'success');
  closeTemplatePanel();
}

function clearGraph() {
  // 直接清空画布（不压历史，保证模板加载干净）
  [...workflow.nodes.values()].forEach(n => { if (n.el && n.el.parentNode) n.el.parentNode.removeChild(n.el); });
  workflow.nodes.clear();
  workflow.edges.clear();
  workflow.order = [];
  workflow.selection.clear();
  markEdgesDirty();
  updateStatusbar();
}

function loadTemplate(id, mode) {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) return;
  loadTemplateSpec(t, mode);
}

function buildDress25GridTemplate() {
  const anchor = '连衣裙 25 宫格分镜模板 · 统一锚点：白色抹胸蓬蓬短裙 + 黑丝带 + 水晶蝴蝶结颈链 + 黑色蕾丝袜带 / 黑背景红舞台光 / 电影感时装摄影。\n每个「AI 绘图」节点已预填对应宫格的英文提示词，运行即出该格画面；负向词已内置。5 行 × 5 列 = 5 维度各 5 档组合。';
  const style = 'high fashion photography, cinematic, red stage lighting, strong chiaroscuro, 4K, ultra-detailed, film grain, fashion editorial';
  const neg = 'daylight, outdoor, busy background, low quality, blurry, multiple faces, deformed hands, cartoon, anime';
  const rows = [
    { y: -360, name: 'front view', light: 'single overhead spotlight', action: 'standing still', focus: 'focus on full figure' },
    { y: -70,  name: 'side view', light: 'multiple side spotlights', action: 'turning with hair motion', focus: 'focus on face' },
    { y: 220,  name: 'front view', light: 'frontal key light', action: 'lifting skirt hem', focus: 'focus on fabric details' },
    { y: 510,  name: 'back view', light: 'backlight silhouette', action: 'dancing with skirt flying', focus: 'focus on full figure' },
    { y: 800,  name: 'side view', light: 'rim light', action: 'walking pose', focus: 'focus on body parts' },
  ];
  const cols = [
    { x: -760, label: 'extreme long shot' },
    { x: -380, label: 'full body' },
    { x: 0,    label: 'close-up' },
    { x: 380,  label: 'medium shot' },
    { x: 760,  label: 'medium close-up' },
  ];
  const nodes = [{ type: 'text', x: -1140, y: -660, title: '📐 25 宫格 · 统一锚点', params: { text: anchor } }];
  let idx = 1;
  rows.forEach((row, r) => {
    cols.forEach((col, c) => {
      const title = String(idx).padStart(2, '0') + '｜' + col.label + '·' + row.name;
      const prompt = [
        'young female model in white strapless ruffled mini dress with black ribbon, crystal bow choker, black lace garter stockings',
        row.light,
        col.label,
        row.name,
        row.action,
        row.focus,
        'dark stage, black background, small ceiling light grid',
        style,
      ].join(', ');
      nodes.push({
        type: 'aiImage',
        x: col.x,
        y: row.y,
        title,
        params: {
          model: 'GPT Image 2',
          prompt,
          negativePrompt: neg,
          aspect: '9:16',
          count: '1张',
          resolution: '超清2K'
        }
      });
      idx += 1;
    });
  });
  return {
    id: 'dress-25grid-generated',
    name: '连衣裙 25 宫格分镜（生成版）',
    icon: '👗',
    color: '#FF4D6D',
    desc: '一键生成 5×5 25 宫格：按统一锚点自动铺开 25 个 AI 绘图节点，并可继续追加/导出。',
    nodes,
    edges: [[0,1]]
  };
}

// 计算当前所有节点在画布坐标系中的包围盒（用于模板追加时自动错开）
function getNodesBBox() {
  if (workflow.nodes.size === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  workflow.nodes.forEach(n => {
    const w = n.width || 280, h = n.height || 200;
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + w > maxX) maxX = n.x + w;
    if (n.y + h > maxY) maxY = n.y + h;
  });
  return { minX, minY, maxX, maxY };
}

// 模板列表事件委托
function bindTemplateEvents() {
  const list = document.getElementById('templateList');
  if (!list) return;
  list.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act === 'generate25') {
      loadTemplateSpec(cloneTemplateSpec(buildDress25GridTemplate()), 'replace');
      return;
    }
    loadTemplate(btn.getAttribute('data-id'), act);
  });
}

function renderScenePanel() {
  const list = document.getElementById('sceneList');
  const count = document.getElementById('sceneCount');
  const empty = document.getElementById('sceneEmpty');
  if (!list) return;
  const scenes = workflow.scenes || [];
  count.textContent = scenes.length;
  if (empty) empty.style.display = scenes.length ? 'none' : '';
  list.innerHTML = scenes.map(s => {
    const members = (s.nodeIds || []).filter(id => workflow.nodes.has(id)).length;
    const addSel = workflow.selection.size
      ? '<button class="mini-btn" data-act="add" data-id="' + s.id + '">加入选中(' + workflow.selection.size + ')</button>' : '';
    return '<div class="scene-card">' +
      '<div class="scene-card-head">' +
        '<span class="scene-dot" style="background:' + esc(s.color) + '"></span>' +
        '<span class="scene-name" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
      '</div>' +
      '<div class="scene-member">成员：' + members + ' 个节点</div>' +
      '<div class="scene-card-actions">' +
        '<button class="mini-btn primary" data-act="focus" data-id="' + s.id + '">聚焦</button>' +
        addSel +
        '<button class="mini-btn" data-act="del" data-id="' + s.id + '">删除</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function assignSelectedToScenePrompt() {
  if (workflow.scenes.length === 0) { showToast('请先在场景面板新建一个场景', 'info'); return; }
  const sel = [...workflow.selection].map(n => n.id);
  if (sel.length === 0) { showToast('请先选中要归入场景的节点', 'info'); return; }
  const lines = workflow.scenes.map((s, i) => (i + 1) + '. ' + s.name).join('\n');
  const ans = prompt('把这 ' + sel.length + ' 个节点加入哪个场景？\n输入序号：\n' + lines);
  if (!ans) return;
  const idx = parseInt(ans) - 1;
  if (isNaN(idx) || !workflow.scenes[idx]) { showToast('无效的选择', 'danger'); return; }
  addNodesToScene(workflow.scenes[idx].id, sel);
  showToast('已加入场景「' + workflow.scenes[idx].name + '」', 'success');
}

function renderShotPanel() {
  const list = document.getElementById('shotList');
  const count = document.getElementById('shotCount');
  if (!list) return;
  const shots = workflow.shots || [];
  count.textContent = shots.length;
  if (shots.length === 0) {
    list.innerHTML = '<div class="shot-empty">暂无镜头<br>点击「新增镜头」建立你的第一组分镜</div>';
    return;
  }
  const labelMap = { idle: '待生成', running: '生成中', done: '已完成', error: '失败' };
  list.innerHTML = shots.map(s => {
    const canGen = s.status !== 'running';
    const locate = s.nodeId ? '<button class="mini-btn" data-act="locate" data-id="' + s.id + '">定位</button>' : '';
    return '<div class="shot-card">' +
      '<div class="shot-card-head">' +
        '<span class="shot-no">' + esc(s.shotNo || '—') + '</span>' +
        '<span class="shot-name" title="' + esc(s.name) + '">' + esc(s.name || '未命名镜头') + '</span>' +
        '<span class="shot-pill ' + s.status + '">' + (labelMap[s.status] || s.status) + '</span>' +
      '</div>' +
      (s.scene ? '<div class="shot-scene"><span class="tag">场景</span>' + esc(s.scene) + '</div>' : '') +
      (s.desc ? '<div class="shot-desc">' + esc(s.desc) + '</div>' : '') +
      (s.prompt ? '<div class="shot-prompt">' + esc(s.prompt) + '</div>' : '') +
      '<div class="shot-card-actions">' +
        '<button class="mini-btn primary" data-act="gen" data-id="' + s.id + '"' + (canGen ? '' : ' disabled') + '>' + (s.status === 'running' ? '生成中…' : '生成') + '</button>' +
        '<button class="mini-btn" data-act="group" data-id="' + s.id + '">' + (s.groupSceneId ? '定位组' : '🎬 节点组') + '</button>' +
        '<button class="mini-btn" data-act="edit" data-id="' + s.id + '">编辑</button>' +
        '<button class="mini-btn" data-act="del" data-id="' + s.id + '">删除</button>' +
        locate +
      '</div>' +
    '</div>';
  }).join('');
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function addShot() { openShotModal(null); }

function openShotModal(shot) {
  _shotModalOpen = true;
  const isEdit = !!shot;
  const cur = shot || { id: '', name: '', scene: '', shotNo: '', desc: '', prompt: '' };
  let overlay = document.getElementById('shotModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'shot-modal-overlay';
    overlay.id = 'shotModalOverlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML =
    '<div class="shot-modal">' +
      '<h3>' + (isEdit ? '编辑镜头' : '新增镜头') + '</h3>' +
      '<div class="shot-form-row g2">' +
        '<div><label>镜头号</label><input id="smShotNo" value="' + esc(cur.shotNo) + '" placeholder="如 001 / S1-03"></div>' +
        '<div><label>场景</label><input id="smScene" value="' + esc(cur.scene) + '" placeholder="如 室内 / 森林"></div>' +
      '</div>' +
      '<div class="shot-form-row"><label>镜头名称</label><input id="smName" value="' + esc(cur.name) + '" placeholder="镜头标题"></div>' +
      '<div class="shot-form-row"><label>画面描述</label><textarea id="smDesc" placeholder="镜头内容 / 动作 / 构图">' + esc(cur.desc) + '</textarea></div>' +
      '<div class="shot-form-row"><label>生成提示词（Prompt）</label><textarea id="smPrompt" placeholder="送给 AI 生图的完整提示词，支持 <<<资产>> 引用令牌">' + esc(cur.prompt) + '</textarea></div>' +
      '<div class="shot-modal-actions">' +
        '<button class="wf-btn" id="smCancel">取消</button>' +
        '<button class="wf-btn primary" id="smSave">' + (isEdit ? '保存' : '添加') + '</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('show');
  const close = () => { overlay.classList.remove('show'); _shotModalOpen = false; };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  overlay.querySelector('#smCancel').onclick = close;
  overlay.querySelector('#smSave').onclick = () => {
    const data = {
      shotNo: overlay.querySelector('#smShotNo').value.trim(),
      scene: overlay.querySelector('#smScene').value.trim(),
      name: overlay.querySelector('#smName').value.trim(),
      desc: overlay.querySelector('#smDesc').value.trim(),
      prompt: overlay.querySelector('#smPrompt').value.trim(),
    };
    if (!data.name && !data.prompt) { showToast('请至少填写镜头名称或提示词', 'info'); return; }
    if (!data.name) data.name = (data.shotNo ? data.shotNo + ' ' : '') + (data.scene || '镜头');
    pushHistory();
    if (isEdit) {
      Object.assign(shot, data);
    } else {
      workflow.shots.push({ id: 'shot_' + (++_shotSeq) + '_' + Date.now().toString(36), status: 'idle', nodeId: null, ...data });
    }
    scheduleAutosave();
    close();
    renderShotPanel();
    showToast(isEdit ? '镜头已更新' : '镜头已添加', 'success');
  };
}

function editShot(id) {
  const s = (workflow.shots || []).find(x => x.id === id);
  if (s) openShotModal(s);
}

function deleteShot(id) {
  const s = (workflow.shots || []).find(x => x.id === id);
  if (!s) return;
  if (!confirm('确定删除镜头「' + (s.name || s.shotNo || '未命名') + '」？')) return;
  pushHistory();
  workflow.shots = workflow.shots.filter(x => x.id !== id);
  scheduleAutosave();
  renderShotPanel();
}

function generateShot(id) {
  const s = (workflow.shots || []).find(x => x.id === id);
  if (!s) return;
  if (!s.prompt || !s.prompt.trim()) { showToast('请先在「编辑」中填写生成提示词', 'info'); return; }
  let node = s.nodeId ? workflow.nodes.get(s.nodeId) : null;
  if (!node) {
    const idx = workflow.shots.indexOf(s);
    node = addNode('aiImage', 120 + (idx % 5) * 40, 120 + Math.floor(idx / 5) * 40);
  }
  s.nodeId = node.id;
  node.title = s.name || ('镜头 ' + (s.shotNo || ''));
  node.type = 'aiImage';
  node.prompt = s.prompt;
  buildNodeBody(node.el, node);
  s.status = 'running';
  renderShotPanel();
  scheduleAutosave();
  runNode(node);
}

function generateAllShots() {
  const shots = (workflow.shots || []).filter(s => s.status !== 'running');
  if (shots.length === 0) { showToast('没有可生成的镜头', 'info'); return; }
  showToast('开始依次生成 ' + shots.length + ' 个镜头', 'success');
  shots.forEach((s, i) => setTimeout(() => generateShot(s.id), i * 700));
}

// 镜头 → 导演模板提示词 → 画布节点组（联动闭环）
function buildDirectorPromptFromShot(s) {
  const refs = (s.prompt || '').match(/<<<[^>]+>>>/g) || [];
  return buildDirectorPrompt({
    duration: '15 SECONDS', aspect: '21:9', resolution: '8K', fps: '60fps', cuts: 'hard cuts only', shots: 1,
    title: (s.shotNo ? s.shotNo + ' ' : '') + (s.name || '主镜头'),
    style: '',
    summary: s.desc || '',
    rules: '',
    shotsText: 'SHOT 1 — ' + (s.shotNo || '?') + ' — ' + (s.name || '主镜头') + ': ' + (s.desc || '') + (s.prompt ? '\n' + s.prompt : ''),
    anchor: '',
    refs: refs.join(' ')
  });
}

// 选镜头 → 自动生成导演提示词 → 落成画布节点组（导演提示词 + 出图 + 成片，连线并染色为一个场景组）
function generateShotNodeGroup(id) {
  const s = (workflow.shots || []).find(x => x.id === id);
  if (!s) return;
  const basePrompt = (s.prompt && s.prompt.trim()) ? s.prompt.trim() : (s.desc || s.name || '');
  if (!basePrompt) { showToast('请先在「编辑」中填写提示词或画面描述', 'info'); return; }
  withHistory(() => {
  // 落点：排在现有内容右下方，避免重叠
  let maxX = 0, maxY = 0;
  workflow.nodes.forEach(n => { maxX = Math.max(maxX, n.x + (n.width || 280)); maxY = Math.max(maxY, n.y + (n.height || 200)); });
  const ox = maxX > 0 ? maxX + 140 : 120;
  const oy = maxY > 0 ? maxY + 140 : 120;
  const dirPrompt = buildDirectorPromptFromShot(s);
  // 1) 导演提示词节点
  const tNode = addNode('text', ox, oy);
  tNode.title = '🎬 ' + (s.name || s.shotNo || '镜头') + ' · 导演提示词';
  tNode.prompt = dirPrompt;
  buildNodeBody(tNode.el, tNode);
  // 2) 出图节点
  const iNode = addNode('aiImage', ox + 380, oy);
  iNode.title = '出图 · ' + (s.name || s.shotNo || '镜头');
  iNode.prompt = basePrompt;
  buildNodeBody(iNode.el, iNode);
  // 3) 成片节点
  const vNode = addNode('aiVideo', ox + 760, oy + 40);
  vNode.title = '成片 · ' + (s.name || s.shotNo || '镜头');
  vNode.prompt = basePrompt;
  buildNodeBody(vNode.el, vNode);
  // 连线：导演提示词 → 出图 → 成片
  const e1 = new Edge(tNode, 0, iNode, 1); workflow.edges.set(e1.id, e1);
  const e2 = new Edge(iNode, 0, vNode, 0); workflow.edges.set(e2.id, e2);
  markEdgesDirty();
  // 分组为一个“节点组”（场景染色 + 面板可聚焦）
  const sceneName = (s.scene ? s.scene + ' › ' : '') + (s.name || s.shotNo || '镜头');
  const scene = createScene(sceneName);
  addNodesToScene(scene.id, [tNode.id, iNode.id, vNode.id]);
  s.groupSceneId = scene.id;
  s.nodeIds = [tNode.id, iNode.id, vNode.id];
  if (s.status === 'idle') s.status = 'grouped';
  scheduleAutosave();
  renderShotPanel();
  focusScene(scene.id);
  showToast('已为镜头「' + (s.name || s.shotNo || '') + '」生成导演提示词 + 节点组（' + sceneName + '）', 'success');
  });
}

function locateShotNode(id) {
  const s = (workflow.shots || []).find(x => x.id === id);
  if (!s || !s.nodeId) return;
  const n = workflow.nodes.get(s.nodeId);
  if (!n) { showToast('该镜头对应的节点已不存在', 'info'); return; }
  selectNode(n);
  const z = workflow.camera.zoom || 1;
  workflow.camera.x = (window.innerWidth / 2) - (n.x + n.width / 2) * z;
  workflow.camera.y = (window.innerHeight / 2) - (n.y + n.height / 2) * z;
  applyTransform();
}

function syncShotStatus(node) {
  if (!node || !workflow.shots) return;
  let changed = false;
  for (const s of workflow.shots) {
    if (s.nodeId === node.id && s.status !== node.status) { s.status = node.status; changed = true; }
  }
  if (changed) scheduleAutosave();
}

(function wireShots() {
  const list = document.getElementById('shotList');
  if (list) {
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      if (act === 'gen') generateShot(id);
      else if (act === 'group') {
        const sh = (workflow.shots || []).find(x => x.id === id);
        if (sh && sh.groupSceneId) focusScene(sh.groupSceneId);
        else generateShotNodeGroup(id);
      }
      else if (act === 'edit') editShot(id);
      else if (act === 'del') deleteShot(id);
      else if (act === 'locate') locateShotNode(id);
    });
  }
  const add = document.getElementById('btnAddShot'); if (add) add.onclick = addShot;
  const all = document.getElementById('btnGenerateAllShots'); if (all) all.onclick = generateAllShots;
  const closeBtn = document.getElementById('shotClose'); if (closeBtn) closeBtn.onclick = () => toggleShotPanel(false);
  const ov = document.getElementById('shotOverlay'); if (ov) ov.onclick = () => toggleShotPanel(false);
  const tb = document.getElementById('btnShots'); if (tb) tb.onclick = () => toggleShotPanel();
})();


// —— 素材分类（角色/道具/场景/通用）+ 引用令牌（蒸馏自 Hell Grind）——
const ASSET_CATS_KEY = 'flowcraft:assetCats:v1';
// 资产元数据：{ [assetKey]: { name, cat, lock } } —— 名称即引用令牌 <<<name>>>
const ASSET_META_KEY = 'flowcraft:assetMeta:v1';
let _assetCatFilter = '';

function loadAssetMeta() {
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem(ASSET_META_KEY)) || {}; } catch (e) { meta = {}; }
  // 兼容迁移：旧版仅存分类，首次读取时并入元数据
  let cats = {};
  try { cats = JSON.parse(localStorage.getItem(ASSET_CATS_KEY)) || {}; } catch (e) { cats = {}; }
  let changed = false;
  Object.keys(cats).forEach(k => {
    if (!meta[k]) { meta[k] = { name: '', cat: cats[k] || '', lock: '' }; changed = true; }
    else if (!meta[k].cat && cats[k]) { meta[k].cat = cats[k]; changed = true; }
  });
  if (changed) { try { localStorage.setItem(ASSET_META_KEY, JSON.stringify(meta)); } catch (e) {} }
  return meta;
}

function persistAssetMeta(meta) {
  try { localStorage.setItem(ASSET_META_KEY, JSON.stringify(meta)); } catch (e) {}
  // 双写分类表，保持旧数据/旧校验脚本可读
  const cats = {};
  Object.keys(meta).forEach(k => { if (meta[k] && meta[k].cat) cats[k] = meta[k].cat; });
  try { localStorage.setItem(ASSET_CATS_KEY, JSON.stringify(cats)); } catch (e) {}
}

//================ 4i-1b. 全局资产图库（#11 跨画布复用）================
// 资产元数据（名称/分类/锁定描述）本就持久化；但图片本体此前只存在当前画布节点里，
// 换画布即丢失。这里把「显式保存的资产」图片本体独立入库，collectAssets 合并后，
// 新画布仍能看到并引用 <<<名称>>>。软上限 3.5MB，超限只警告不阻塞主流程。
const ASSET_IMAGES_KEY = 'flowcraft:assetImages:v1';
const ASSET_IMAGES_SOFT_LIMIT = 3.5 * 1024 * 1024;

function loadGlobalAssetImages() {
  try {
    const o = JSON.parse(localStorage.getItem(ASSET_IMAGES_KEY));
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  } catch (e) { return {}; }
}
function saveGlobalAssetImage(key, entry) {
  try {
    const all = loadGlobalAssetImages();
    if (!entry || typeof entry.src !== 'string' || !entry.src.startsWith('data:')) return;
    all[key] = { src: entry.src, nodeTitle: entry.nodeTitle || '', label: entry.label || '产出', kind: entry.kind || '' };
    const json = JSON.stringify(all);
    if (json.length > ASSET_IMAGES_SOFT_LIMIT) {
      showToast('全局资产库接近存储上限，建议精简资产图片', 'warn', 4000);
    }
    localStorage.setItem(ASSET_IMAGES_KEY, json);
  } catch (e) {
    showToast('全局资产保存失败（存储已满？）：' + e.message, 'danger', 4000);
  }
}
function removeGlobalAssetImage(key) {
  try {
    const all = loadGlobalAssetImages();
    if (all[key]) { delete all[key]; localStorage.setItem(ASSET_IMAGES_KEY, JSON.stringify(all)); }
  } catch (e) {}
}
// 全局资产条目（与 collectAssets 条目同形；nodeId/kind/label 原样保留 → assetKey 与 assetMeta 保持一致）
function globalAssetEntries() {
  const all = loadGlobalAssetImages();
  const out = [];
  Object.keys(all).forEach(key => {
    const e = all[key] || {};
    if (!e.src || typeof e.src !== 'string' || !e.src.startsWith('data:')) return;
    const parts = key.split('|');
    out.push({ src: e.src, nodeId: parts[0] || 'global', nodeTitle: e.nodeTitle || '', label: e.label || '产出', kind: e.kind || 'output' });
  });
  return out;
}

function getAssetMeta(key) {
  const m = loadAssetMeta()[key];
  return { name: (m && m.name) || '', cat: (m && m.cat) || '', lock: (m && m.lock) || '' };
}

// 写入资产元数据（patch 合并；三项全空则删除该条目）
function setAssetMeta(key, patch) {
  const meta = loadAssetMeta();
  const cur = meta[key] || { name: '', cat: '', lock: '' };
  const next = {
    name: patch.name !== undefined ? String(patch.name || '').trim() : cur.name,
    cat: patch.cat !== undefined ? String(patch.cat || '') : cur.cat,
    lock: patch.lock !== undefined ? String(patch.lock || '').trim() : cur.lock
  };
  if (!next.name && !next.cat && !next.lock) delete meta[key];
  else meta[key] = next;
  persistAssetMeta(meta);
  return next;
}

// 旧接口保留：仅改分类
function loadAssetCats() {
  const meta = loadAssetMeta();
  const out = {};
  Object.keys(meta).forEach(k => { if (meta[k] && meta[k].cat) out[k] = meta[k].cat; });
  return out;
}

function saveAssetCat(key, cat) {
  setAssetMeta(key, { cat: cat });
}

function assetKey(a) {
  return String(a.nodeId || '') + '|' + String(a.kind || '') + '|' + String(a.label || '');
}

// 资产显示名 = 自定义名称 ‖ 节点标题（重名自动编号）——这个名字就是引用令牌
function assetNameMap(assets) {
  const meta = loadAssetMeta();
  const used = new Map();
  const out = {};
  (assets || []).forEach(a => {
    const k = assetKey(a);
    const custom = ((meta[k] && meta[k].name) || '').trim();
    if (custom) { out[k] = custom; return; }
    let base = String(a.nodeTitle || a.label || '资产').trim() || '资产';
    const c = (used.get(base) || 0) + 1;
    used.set(base, c);
    out[k] = c > 1 ? base + ' ' + c : base;
  });
  return out;
}

function assetDisplayName(a) {
  const all = collectAssets();
  const map = assetNameMap(all);
  return map[assetKey(a)] || String(a.nodeTitle || a.label || '资产');
}

function copyRefToken(label) {
  const token = '<<<' + label + '>>>';
  const ok = () => showToast('已复制引用令牌 ' + token + '，粘贴进提示词即可自动带图', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(token).then(ok).catch(() => { fallbackCopyText(token); ok(); });
  } else { fallbackCopyText(token); ok(); }
}

function renderAssetFilterChips() {
  const wrap = document.getElementById('assetFilters');
  if (!wrap) return;
  wrap.querySelectorAll('.asset-filter-chip').forEach(ch => {
    ch.classList.toggle('active', ch.getAttribute('data-cat') === _assetCatFilter);
  });
}

//================ 4i. 引用令牌解析：<<<名称>>> → 真实参考图 ================
// 提示词里写 <<<ROCO>>>，生成时自动在素材库找到同名资产，把它的图片作为参考图随请求发送。
// 令牌本身保留在提示词中（模型据此对应第几张参考图）。

const REF_TOKEN_PATTERN = '<<<\\s*([^<>]{1,60}?)\\s*>>>';

// 提取提示词中的全部令牌名（保序去重，忽略大小写重复）
function parseRefTokens(text) {
  const out = [];
  if (!text) return out;
  const seen = new Set();
  const re = new RegExp(REF_TOKEN_PATTERN, 'g');
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const name = String(m[1] || '').trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}

function refCatEnglish(c) {
  return ({ '角色': 'character', '道具': 'prop', '场景': 'scene' })[c] || 'asset';
}

// 建立"名称 → 资产"索引：资产名优先，节点标题 / 端口标签兜底
function buildAssetRefIndex() {
  const all = collectAssets();
  const nameMap = assetNameMap(all);
  const index = new Map();
  all.forEach(a => {
    const k = assetKey(a);
    const nm = nameMap[k];
    if (nm && !index.has(nm.toLowerCase())) index.set(nm.toLowerCase(), { asset: a, key: k, name: nm });
  });
  all.forEach(a => {
    const k = assetKey(a);
    [a.nodeTitle, a.label].forEach(x => {
      const s = String(x || '').trim();
      if (s && !index.has(s.toLowerCase())) index.set(s.toLowerCase(), { asset: a, key: k, name: s });
    });
  });
  return index;
}

// 解析结果：{ tokens, refs[{token,name,src,cat,lock,nodeId}], missing, images, prompt, augmented }
function resolveRefTokens(prompt) {
  const text = String(prompt || '');
  const result = { tokens: [], refs: [], missing: [], images: [], prompt: text, augmented: text };
  result.tokens = parseRefTokens(text);
  if (!result.tokens.length) return result;
  let index, meta;
  try { index = buildAssetRefIndex(); meta = loadAssetMeta(); } catch (e) { return result; }
  result.tokens.forEach(t => {
    const hit = index.get(t.toLowerCase());
    const src = hit && hit.asset && hit.asset.src;
    if (hit && typeof src === 'string' && src.indexOf('data:') === 0) {
      const m = meta[hit.key] || {};
      result.refs.push({
        token: t, name: hit.name, src: src,
        cat: m.cat || '', lock: m.lock || '', nodeId: hit.asset.nodeId
      });
      result.images.push(src);
    } else {
      result.missing.push(t);
    }
  });
  result.augmented = buildRefAugmentedPrompt(result);
  return result;
}

// 在原提示词后追加"令牌 → 第几张参考图"的映射说明与锁定描述（原令牌原样保留）
function buildRefAugmentedPrompt(r) {
  if (!r || !r.refs || !r.refs.length) return r ? r.prompt : '';
  const lines = [r.prompt, '', 'Reference assets (attached images — keep them strictly consistent):'];
  r.refs.forEach((ref, i) => {
    const bits = ['<<<' + ref.name + '>>> = reference image ' + (i + 1)];
    if (ref.cat) bits.push('role: ' + refCatEnglish(ref.cat));
    if (ref.lock) bits.push('locked description: ' + ref.lock);
    lines.push('- ' + bits.join(' · '));
  });
  lines.push('Match every referenced subject exactly: same identity, outfit, colors and proportions.');
  return lines.join('\n');
}

// 节点当前生效提示词（上游文本优先）里的引用统计，用于卡片徽标
function nodeRefSummary(node) {
  if (!node) return { hit: 0, missing: 0, names: [] };
  const text = (node.effectivePrompt || node.prompt || '');
  if (!text || text.indexOf('<<<') < 0) return { hit: 0, missing: 0, names: [] };
  const r = resolveRefTokens(text);
  return { hit: r.refs.length, missing: r.missing.length, names: r.refs.map(x => x.name), missingNames: r.missing };
}

//================ 4i-2. 角色资产库：状态结果存为可复用角色资产 + 跨节点引用 ================

// 角色状态节点的产出图在 collectAssets 中被标记为 kind='output', label='产出·N'
function characterStateAssetKey(node) {
  const outs = node.outputsData || [];
  const idx = outs.findIndex((pl) => pl && pl.type === 'image' && normalizeImageSrc(pl.value));
  if (idx < 0) return null;
  return assetKey({ nodeId: node.id, kind: 'output', label: '产出·' + (idx + 1) });
}

function nodeHasOutputImage(node) {
  return characterStateAssetKey(node) !== null;
}

// 把已完成角色状态节点的生成结果保存为「角色」类命名资产（默认名 = 角色名·状态名）
function saveCharacterStateAsAsset(node) {
  if (!isCharacterStateNode(node)) return null;
  const key = characterStateAssetKey(node);
  if (!key) { showToast('该状态节点还没有生成结果图，无法存为角色资产', 'warn'); return null; }
  const source = node.stateMeta && node.stateMeta.sourceId ? workflow.nodes.get(node.stateMeta.sourceId) : null;
  const roleLine = (source && source.charDesc ? String(source.charDesc).split('\n').map((s) => s.trim()).filter(Boolean)[0] : '') || (source && source.title) || '角色';
  const stateLabel = (node.stateMeta && node.stateMeta.label) || node.title || '状态';
  const defaultName = roleLine + '·' + stateLabel;
  const lock = String(node.effectivePrompt || node.prompt || '').trim();
  setAssetMeta(key, { name: defaultName, cat: '角色', lock: lock });
  // #11 跨画布复用：图片本体也写入全局资产库（新画布仍可引用该令牌）
  const outIdx = (node.outputsData || []).findIndex(pl => pl && pl.type === 'image' && normalizeImageSrc(pl.value));
  if (outIdx >= 0) {
    saveGlobalAssetImage(key, { src: node.outputsData[outIdx].value, nodeTitle: node.title, label: '产出·' + (outIdx + 1), kind: 'output' });
  }
  showToast('已存为全局角色资产 <<<' + defaultName + '>>>（跨画布可复用），其他 AI 节点可用 <<<' + defaultName + '>>> 引用它', 'success', 5200);
  refreshAssetPanelIfOpen();
  return { key: key, name: defaultName };
}

// 状态列表节点：把本角色所有已出图状态节点一键归档为角色资产（未出图/已归档的跳过）
function saveAllCharacterStatesAsAsset(stateListNode) {
  const states = [];
  workflow.nodes.forEach(n => {
    if (n && n.stateMeta && n.stateMeta.sourceId === stateListNode.id && nodeHasOutputImage(n)) states.push(n);
  });
  if (!states.length) { showToast('没有已出图的状态节点可归档（先运行状态节点生成图片）', 'warn'); return 0; }
  let saved = 0;
  states.forEach(n => { if (saveCharacterStateAsAsset(n)) saved++; });
  showToast('批量归档完成：' + saved + '/' + states.length + ' 个状态已存为角色资产', 'success', 4200);
  refreshAssetPanelIfOpen();
  return saved;
}

// 列出所有「角色」类资产（供其他 AI 节点下拉引用），按资产去重只显示一次（优先自定义名称）
function listCharacterAssets() {
  try {
    const index = buildAssetRefIndex();
    const meta = loadAssetMeta();
    const seen = new Set();
    const out = [];
    index.forEach((entry) => {
      if (seen.has(entry.key)) return;
      const m = meta[entry.key] || {};
      if (m.cat !== '角色') return;
      if (!entry.asset || typeof entry.asset.src !== 'string' || !entry.asset.src.startsWith('data:')) return;
      seen.add(entry.key);
      out.push({ key: entry.key, name: entry.name, src: entry.asset.src });
    });
    return out;
  } catch (e) { return []; }
}

// 在提示词输入框光标处插入 <<<名称>>> 引用令牌（避免重复插入）
function insertRefTokenIntoNodePrompt(textarea, name) {
  const token = '<<<' + name + '>>>';
  if (!textarea) return false;
  const full = textarea.value || '';
  if (full.indexOf(token) >= 0) return false;
  const start = textarea.selectionStart != null ? textarea.selectionStart : full.length;
  const end = textarea.selectionEnd != null ? textarea.selectionEnd : full.length;
  const before = full.slice(0, start);
  const after = full.slice(end);
  const sep = before && !/\s$/.test(before) ? ' ' : '';
  textarea.value = before + sep + token + after;
  return true;
}

// 文本节点「完整生效文本」：角色描述（charDesc，独立输入框）前置拼接到固定提示词（prompt）。
// 非文本节点或 charDesc 为空时，直接返回原 prompt，保持旧行为不变。
function nodeFullText(node) {
  if (!node) return '';
  const body = (node.prompt || '').trim();
  if (node.type !== 'text') return body;
  const lead = (node.charDesc || '').trim();
  return lead ? (lead + '\n\n' + body) : body;
}

// ===== 参考图管理（P1-1）：结构化对象 / 校验 / 去重 / 迁移 / 失效引用 / 排序 =====
const REF_IMAGE_ACCEPT_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const REF_IMAGE_ACCEPT_EXT = /\.(png|jpe?g|webp)$/i;
const REF_MAX_SINGLE_BYTES = 10 * 1024 * 1024;   // 单图 ≤ 10MB
const REF_MAX_TOTAL_BYTES = 50 * 1024 * 1024;    // 单节点参考图总量 ≤ 50MB
// 同步字符串哈希（FNV-1a）——用于重复检测与稳定 identity，不追求密码学强度
function refHashSrc(src) {
  const s = String(src || '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}
function refMimeFromSrc(src) {
  const m = /^data:([^;,]+)/i.exec(String(src || ''));
  return m ? m[1].toLowerCase() : '';
}
function refSizeFromSrc(src) {
  const s = String(src || '');
  const comma = s.indexOf(',');
  if (comma < 0) return s.length;
  const b64 = s.slice(comma + 1);
  if (/;base64/i.test(s.slice(0, comma))) return Math.floor(b64.length * 3 / 4);
  return b64.length;
}
// 失效引用：无 src 或 src 无法解析（含被剥离的 "(stripped)" 占位）
function isRefInvalid(r) { return !r || !normalizeImageSrc(r.src); }
// 把任意旧格式参考图（裸 dataURL 字符串 / {name,src}）归一为结构化对象
function normalizeRefImage(r, idx) {
  let src = '', name = '';
  if (typeof r === 'string') { src = r; }
  else if (r && typeof r === 'object') { src = r.src || ''; name = r.name || ''; }
  const o = (r && typeof r === 'object') ? r : {};
  const mime = refMimeFromSrc(src);
  const hash = src ? refHashSrc(src) : '';
  return {
    id: o.id || ('ref-' + (hash || 'empty') + '-' + idx),
    name: name || ('参考图' + (idx + 1)),
    src: src,
    order: Number.isFinite(o.order) ? o.order : idx,
    width: Number.isFinite(o.width) ? o.width : 0,
    height: Number.isFinite(o.height) ? o.height : 0,
    size: Number.isFinite(o.size) ? o.size : refSizeFromSrc(src),
    mime: mime || o.mime || '',
    hash: hash || o.hash || '',
  };
}
// 归一整个数组并按 order 排序、重排 order 连续（迁移旧数据 + 保证发送编号与 order 一致）
function normalizeRefImages(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const norm = list.map(normalizeRefImage);
  norm.sort(function(a, b) { return a.order - b.order; });
  norm.forEach(function(r, i) { r.order = i; });
  return norm;
}
// 上传前校验单个文件：格式 + 大小
function validateRefImageFile(file) {
  const mime = (file.type || '').toLowerCase();
  const name = file.name || '';
  const okType = REF_IMAGE_ACCEPT_MIME.indexOf(mime) >= 0 || REF_IMAGE_ACCEPT_EXT.test(name);
  if (!okType) return { ok: false, reason: '格式不支持（仅 PNG / JPEG / WebP）' };
  if (file.size > REF_MAX_SINGLE_BYTES) return { ok: false, reason: '单图超过 10MB' };
  return { ok: true };
}
// 异步补全宽高（不阻塞入库）
function probeRefDimensions(ref) {
  const src = normalizeImageSrc(ref.src);
  if (!src) return;
  const img = new Image();
  img.onload = function() { ref.width = img.naturalWidth; ref.height = img.naturalHeight; };
  img.src = src;
}

// 通用参考图上传：校验格式/大小 → 去重 → 读为结构化对象存入 node.refImages
function openReferenceImagePicker(node, onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.multiple = true;
  input.onchange = function() {
    const files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    node.refImages = normalizeRefImages(node.refImages);
    const rejected = [];
    const accepted = [];
    let totalBytes = node.refImages.reduce(function(s, r) { return s + (r.size || 0); }, 0);
    files.forEach(function(f) {
      const v = validateRefImageFile(f);
      if (!v.ok) { rejected.push((f.name || '未命名') + '：' + v.reason); return; }
      if (totalBytes + f.size > REF_MAX_TOTAL_BYTES) { rejected.push((f.name || '未命名') + '：超出参考图总量 50MB'); return; }
      totalBytes += f.size;
      accepted.push(f);
    });
    if (rejected.length) showToast('已跳过 ' + rejected.length + ' 个文件：' + rejected.join('；'), 'danger');
    if (!accepted.length) return;
    let pending = accepted.length;
    let dupSkipped = 0;
    accepted.forEach(function(f) {
      const reader = new FileReader();
      reader.onload = function() {
        const src = String(reader.result);
        const hash = refHashSrc(src);
        // 重复检测：同节点内已存在相同图则跳过，不重复入库
        if (node.refImages.some(function(r) { return r.hash === hash || r.src === src; })) {
          dupSkipped++;
        } else {
          const base = (f.name || '参考图').replace(/\.[^.]+$/, '') || ('参考图' + (node.refImages.length + 1));
          const ref = normalizeRefImage({ name: base, src: src }, node.refImages.length);
          probeRefDimensions(ref);
          node.refImages.push(ref);
        }
        if (--pending === 0) {
          node.refImages = normalizeRefImages(node.refImages);
          if (dupSkipped) showToast('已跳过 ' + dupSkipped + ' 张重复参考图', 'info');
          scheduleAutosave();
          if (typeof onDone === 'function') onDone();
        }
      };
      reader.onerror = function() {
        if (--pending === 0) { scheduleAutosave(); if (typeof onDone === 'function') onDone(); }
      };
      reader.readAsDataURL(f);
    });
  };
  input.click();
}

// 单图替换：保持 id / order 不变，只换 src 与派生字段
function openRefReplacePicker(node, refId, onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.onchange = function() {
    const f = (input.files || [])[0];
    if (!f) return;
    const v = validateRefImageFile(f);
    if (!v.ok) { showToast('替换失败：' + v.reason, 'danger'); return; }
    const reader = new FileReader();
    reader.onload = function() {
      const src = String(reader.result);
      const list = normalizeRefImages(node.refImages);
      const target = list.find(function(r) { return r.id === refId; });
      if (!target) { showToast('替换失败：参考图不存在', 'danger'); return; }
      target.src = src;
      target.hash = refHashSrc(src);
      target.mime = refMimeFromSrc(src);
      target.size = refSizeFromSrc(src);
      target.width = 0; target.height = 0;
      probeRefDimensions(target);
      node.refImages = list;
      scheduleAutosave();
      if (typeof onDone === 'function') onDone();
    };
    reader.readAsDataURL(f);
  };
  input.click();
}

// 共享参考图缩略图渲染：替换 / 拖拽排序 / 失效引用治理 / 删除
// opts: { onChange(), emptyText, onEmpty(container), thumbClass }
function renderRefThumbsManaged(node, container, opts) {
  opts = opts || {};
  container.innerHTML = '';
  const list = normalizeRefImages(node.refImages);
  node.refImages = list;
  if (!list.length) {
    if (typeof opts.onEmpty === 'function') { opts.onEmpty(container); return; }
    const empty = document.createElement('div');
    empty.className = 'node-ai-image-ref-empty';
    empty.textContent = opts.emptyText || '暂无参考图';
    container.appendChild(empty);
    return;
  }
  const commit = function() {
    scheduleAutosave();
    if (typeof opts.onChange === 'function') opts.onChange();
  };
  list.forEach(function(r, i) {
    const invalid = isRefInvalid(r);
    const t = document.createElement('div');
    t.className = 'node-ref-thumb' + (invalid ? ' node-ref-thumb-invalid' : '') + (opts.thumbClass ? ' ' + opts.thumbClass : '');
    t.draggable = true;
    t.dataset.refId = r.id;
    t.title = (r.name || ('参考图' + (i + 1))) + (r.width ? ' · ' + r.width + '×' + r.height : '') + '（拖拽排序）';
    // 拖拽排序：拖动某图放到目标图位置，order 随之重排
    t.ondragstart = function(e) { e.stopPropagation(); t.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed = 'move'; } catch (_) {} };
    t.ondragend = function() { t.classList.remove('dragging'); };
    t.ondragover = function(e) { e.preventDefault(); e.stopPropagation(); t.classList.add('drag-over'); };
    t.ondragleave = function() { t.classList.remove('drag-over'); };
    t.ondrop = function(e) {
      e.preventDefault(); e.stopPropagation();
      t.classList.remove('drag-over');
      let dragId = '';
      try { dragId = e.dataTransfer.getData('text/plain'); } catch (_) {}
      if (!dragId || dragId === r.id) return;
      const arr = normalizeRefImages(node.refImages);
      const from = arr.findIndex(function(x) { return x.id === dragId; });
      const to = arr.findIndex(function(x) { return x.id === r.id; });
      if (from < 0 || to < 0) return;
      const moved = arr.splice(from, 1)[0];
      arr.splice(to, 0, moved);
      arr.forEach(function(x, idx) { x.order = idx; });
      node.refImages = arr;
      commit();
    };
    if (invalid) {
      // 失效引用：提示 + 重新定位（替换为本地图片）/ 移除引用
      const warn = document.createElement('div');
      warn.className = 'node-ref-invalid-warn';
      warn.textContent = '失效';
      warn.title = '此参考图来源已失效（可能被剥离或未保存）';
      t.appendChild(warn);
      const re = document.createElement('span');
      re.className = 'node-ref-thumb-relocate';
      re.textContent = '↻';
      re.title = '重新定位（替换为本地图片）';
      re.onmousedown = function(e) { e.stopPropagation(); };
      re.onclick = function(e) { e.stopPropagation(); openRefReplacePicker(node, r.id, commit); };
      t.appendChild(re);
      const rm2 = document.createElement('span');
      rm2.className = 'node-ref-thumb-rm';
      rm2.textContent = '×';
      rm2.title = '移除失效引用';
      rm2.onmousedown = function(e) { e.stopPropagation(); };
      rm2.onclick = function(e) {
        e.stopPropagation();
        node.refImages = normalizeRefImages(node.refImages).filter(function(x) { return x.id !== r.id; });
        commit();
      };
      t.appendChild(rm2);
    } else {
      const img = document.createElement('img');
      img.src = normalizeImageSrc(r.src) || '';
      img.alt = r.name || ('参考图' + (i + 1));
      img.draggable = false;
      img.onmousedown = function(e) { e.stopPropagation(); };
      img.onclick = function(e) { e.stopPropagation(); openImageLightbox(r.src); };
      t.appendChild(img);
      const rp = document.createElement('span');
      rp.className = 'node-ref-thumb-replace';
      rp.textContent = '↻';
      rp.title = '替换参考图';
      rp.onmousedown = function(e) { e.stopPropagation(); };
      rp.onclick = function(e) { e.stopPropagation(); openRefReplacePicker(node, r.id, commit); };
      t.appendChild(rp);
      const rm = document.createElement('span');
      rm.className = 'node-ref-thumb-rm';
      rm.textContent = '×';
      rm.title = '移除参考图';
      rm.onmousedown = function(e) { e.stopPropagation(); };
      rm.onclick = function(e) {
        e.stopPropagation();
        node.refImages = normalizeRefImages(node.refImages).filter(function(x) { return x.id !== r.id; });
        commit();
      };
      t.appendChild(rm);
    }
    container.appendChild(t);
  });
}

// 通用参考视频上传：读本地视频为 dataURL，存入 node.refVideos
function openReferenceVideoPicker(node, onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.multiple = true;
  input.onchange = function() {
    const files = Array.prototype.slice.call(input.files || []);
    const total = files.length;
    if (!total) return;
    let pending = total;
    files.forEach(function(f) {
      const reader = new FileReader();
      reader.onload = function() {
        node.refVideos = node.refVideos || [];
        const base = (f.name || '参考视频').replace(/\.[^.]+$/, '') || ('参考视频' + (node.refVideos.length + 1));
        node.refVideos.push({ name: base, src: String(reader.result) });
        if (--pending === 0) {
          scheduleAutosave();
          if (typeof onDone === 'function') onDone();
        }
      };
      reader.readAsDataURL(f);
    });
  };
  input.click();
}

// 文本节点面板的旧入口，保留兼容；aiImage 也复用同一参考图上传逻辑
function openTextNodeRefPicker(node, onDone) {
  openReferenceImagePicker(node, onDone);
}

// 收集生图节点可用的「面板内直传参考图」：节点自身（若为文本节点）及其直接上游文本节点
function collectInlineRefs(node) {
  const out = [];
  const push = function(n) {
    if (n && (n.type === 'text' || n.type === 'aiImage') && Array.isArray(n.refImages)) {
      normalizeRefImages(n.refImages).forEach(function(r) { if (!isRefInvalid(r)) out.push(r); });
    }
  };
  push(node);
  if (node && typeof workflow !== 'undefined' && workflow.edges) {
    var _edges = workflow.edges;
    var _iter = _edges.values();
    var _step;
    while (!(_step = _iter.next()).done) {
      var e = _step.value;
      if (e && e.to.node === node) push(e.from.node);
    }
  }
  const seen = new Set();
  return out.filter(function(r) { if (seen.has(r.src)) return false; seen.add(r.src); return true; });
}

function collectInlineVideoRefs(node) {
  const out = [];
  const push = function(n) {
    if (n && n.type === 'aiVideo' && Array.isArray(n.refVideos)) {
      n.refVideos.forEach(function(r) { if (r && r.src) out.push(r); });
    }
  };
  push(node);
  if (node && typeof workflow !== 'undefined' && workflow.edges) {
    var _edges = workflow.edges;
    var _iter = _edges.values();
    var _step;
    while (!(_step = _iter.next()).done) {
      var e = _step.value;
      if (e && e.to.node === node) push(e.from.node);
    }
  }
  const seen = new Set();
  return out.filter(function(r) { if (seen.has(r.src)) return false; seen.add(r.src); return true; });
}

function collectAiVideoRefs(node) {
  const out = [];
  const push = function(n) {
    if (n && n.type === 'aiVideo' && Array.isArray(n.refVideos)) {
      n.refVideos.forEach(function(r) { if (r && r.src) out.push(r); });
    }
  };
  push(node);
  if (node && typeof workflow !== 'undefined' && workflow.edges) {
    var _edges = workflow.edges;
    var _iter = _edges.values();
    var _step;
    while (!(_step = _iter.next()).done) {
      var e = _step.value;
      if (e && e.to.node === node) push(e.from.node);
    }
  }
  const seen = new Set();
  return out.filter(function(r) { if (seen.has(r.src)) return false; seen.add(r.src); return true; });
}

//================ 4e. Toast 轻提示 ================
function showToast(message, type = 'info', duration = 2500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconSvg = {
    success: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l3 3 7-7"/></svg>',
    info:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5h.01"/></svg>',
    warn:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2L2 13h12z"/><path d="M8 7v3M8 11h.01"/></svg>',
    danger:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></svg>',
  };
  toast.innerHTML = `<span class="toast-icon">${iconSvg[type] || iconSvg.info}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

//================ 4g. 运行日志（生成历史） ================
// 记录每次节点运行的模型 / 参数 / 耗时 / 错误，存 localStorage，支持筛选与清空
const RUN_LOG_KEY = 'flowcraft:runlog:v1';
const RUN_LOG_MAX = 200;

function loadRunLog() {
  try {
    const raw = localStorage.getItem(RUN_LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveRunLog(list) {
  try { localStorage.setItem(RUN_LOG_KEY, JSON.stringify(list.slice(0, RUN_LOG_MAX))); }
  catch (e) {}
}
function describeNodeParams(node) {
  const p = node.params || {};
  const parts = [];
  if (p.model) parts.push('模型:' + p.model);
  if (p.aspect) parts.push('比例:' + p.aspect);
  if (p.resolution) parts.push(p.resolution);
  if (p.duration) parts.push('时长:' + p.duration);
  if (p.count) parts.push(p.count);
  const prompt = node.effectivePrompt || node.prompt;
  if (prompt) {
    const s = String(prompt);
    parts.push('提示:' + (s.length > 16 ? s.slice(0, 16) + '…' : s));
  }
  return parts.join(' · ');
}
function logRun(node, success, durationMs, errorMsg) {
  const def = NODE_TYPES[node.type] || {};
    const entry = {
      t: Date.now(),
      nodeId: node.id || '',
      type: node.type,
      title: node.title || def.label || node.type,
      model: (node.params && node.params.model) || '',
      desc: describeNodeParams(node),
      duration: Math.max(0, Math.round(durationMs || 0)),
      status: success ? 'success' : 'error',
      error: success ? '' : (errorMsg || '未知错误'),
      sourceNodeId: node.stateMeta && node.stateMeta.sourceId || '',
      state: node.stateMeta && node.stateMeta.label || '',
      semanticMode: node.semanticMode || getNodeSemanticTier(node.type),
      resultMode: node.resultMode || 'pending',
      referenceCount: node.genMeta && node.genMeta.references ? node.genMeta.references.count : 0,
      // 仅持久化 http(s) 缩略图（ComfyUI 的 /view 链接），避免 localStorage 被大体积 dataURL 撑爆
      thumb: (success && typeof node.thumb === 'string' && node.thumb.startsWith('http')) ? node.thumb : ''
    };
  const list = loadRunLog();
  list.unshift(entry);
  saveRunLog(list);
  if (typeof renderRunLog === 'function') renderRunLog();
}

// ===== #8 生成节点完整元数据 + 一键同参重试 =====
// 成功生成后把「本次实际使用的全部参数」快照到 node.genMeta，供信息展示与一键同参重试。
function captureGenMeta(node, durationMs) {
  try {
    const p = node.params || {};
    let refSummary = { hit: 0, missing: 0, names: [], missingNames: [] };
    try { refSummary = nodeRefSummary(node) || refSummary; } catch (e) {}
    // 直传参考图不一定出现在 <<<token>>> 文本中，也必须进入可追溯摘要。
    let inlineNames = [];
    try { inlineNames = collectInlineRefs(node).map(r => r && r.name).filter(Boolean); } catch (e) {}
    const names = [...new Set([...(refSummary.names || []), ...inlineNames])];
    node.genMeta = {
      nodeId: node.id,
      type: node.type,
      prompt: node.effectivePrompt || node.prompt || '',
      ownPrompt: (node.prompt || '').trim(),
      negativePrompt: p.negativePrompt || '',
      model: p.model || '',
      aspect: p.aspect || '',
      resolution: p.resolution || '',
      count: p.count || '',
      duration: p.duration || '',
      mode: p.mode || '',
      refs: names.length,
      references: {
        count: names.length,
        names: names,
        missing: refSummary.missingNames || [],
      },
      status: node.status || 'done',
      sourceNodeId: node.stateMeta && node.stateMeta.sourceId || null,
      state: node.stateMeta && node.stateMeta.label || null,
      stateMeta: copyStateMeta(node.stateMeta),
      t: Date.now(),
      durationMs: Math.max(0, Math.round(durationMs || 0))
    };
  } catch (e) {}
}

// 一键同参重试：把 node.genMeta 快照恢复到节点参数上，再重新运行。
function retrySameParams(node) {
  const m = node.genMeta;
  if (!m) { showToast('该节点还没有成功生成记录，无法同参重试', 'warn'); return; }
  // 恢复提示词：仅恢复节点自身输入部分（ownPrompt），避免与上游文本重复拼接
  if (typeof m.ownPrompt === 'string') node.prompt = m.ownPrompt;
  else if (typeof m.prompt === 'string') node.prompt = m.prompt;
  // 恢复模型 / 比例 / 分辨率 / 张数或时长 / 模式
  const p = node.params = node.params || {};
  if (typeof m.negativePrompt === 'string') p.negativePrompt = m.negativePrompt;
  if (m.model) p.model = m.model;
  if (m.aspect) p.aspect = m.aspect;
  if (m.resolution) p.resolution = m.resolution;
  if (m.count) p.count = m.count;
  if (m.duration) p.duration = m.duration;
  if (m.mode) p.mode = m.mode;
  node._abort = false;
  node._timedOut = false;
  if (window.FlowCraft && window.FlowCraft.runner && typeof window.FlowCraft.runner.clearCancel === 'function') {
    window.FlowCraft.runner.clearCancel(node.id);
  }
  showToast('已恢复上次生成参数（' + (m.model || '同模型') + '），正在重新生成…', 'info');
  scheduleAutosave();
  if (node.el) buildNodeBody(node.el, node);
  runNode(node);
}

// 在节点 body 里渲染「生成信息」条：默认只显示一行摘要（不干扰图片预览），
// 点击展开完整参数 chips + 一键同参重试（Details on Demand）。
function renderGenMetaStrip(el, node) {
  const m = node.genMeta;
  if (!m) return;
  el.querySelectorAll('.node-gen-meta').forEach(x => x.remove()); // 防 buildNodeBody 多次调用重复追加
  const strip = document.createElement('div');
  strip.className = 'node-gen-meta';
  const chips = [];
  if (m.model) chips.push('模型 ' + m.model);
  if (m.aspect) chips.push(m.aspect);
  if (m.resolution) chips.push(m.resolution);
  if (m.count) chips.push(m.count);
  if (m.duration) chips.push(m.duration);
  if (m.refs) chips.push('参考图 ' + m.refs);
  if (m.durationMs) chips.push((m.durationMs >= 1000 ? (m.durationMs / 1000).toFixed(1) + 's' : m.durationMs + 'ms'));
  const time = new Date(m.t);
  chips.push(String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0'));
  if (m.prompt) strip.title = '本次提示词：' + m.prompt;

  // 角落重试特例已移除：统一在底部信息条提供同参重试与参数编辑

  // 摘要行（默认展示）：一行核心参数，点击展开/收起详情
  const summary = document.createElement('button');
  summary.type = 'button';
  summary.className = 'ngm-summary';
  summary.innerHTML = '';
  summary.appendChild(document.createTextNode('▤ ' + chips.join(' · ') + ' '));
  const caret = document.createElement('span');
  caret.className = 'ngm-caret';
  caret.textContent = '▾';
  summary.appendChild(caret);
  summary.title = '展开/收起生成详情';
  summary.onclick = (e) => { e.stopPropagation(); strip.classList.toggle('open'); };
  summary.onmousedown = (e) => e.stopPropagation();
  strip.appendChild(summary);

  // 摘要行快捷重试（保持同参重试一步可达）
  const quickRetry = document.createElement('button');
  quickRetry.type = 'button';
  quickRetry.className = 'ngm-quick-retry';
  quickRetry.textContent = '↻';
  quickRetry.title = '同参重试：用上次完全相同的参数重新生成';
  quickRetry.onclick = (e) => { e.stopPropagation(); retrySameParams(node); };
  quickRetry.onmousedown = (e) => e.stopPropagation();
  strip.appendChild(quickRetry);

  // 详情区（默认收起）：完整参数 chips + 完整重试按钮
  const details = document.createElement('div');
  details.className = 'ngm-details';
  chips.forEach((c) => {
    const chip = document.createElement('span');
    chip.className = 'ngm-chip';
    chip.textContent = c;
    details.appendChild(chip);
  });
  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'ngm-retry';
  retryBtn.textContent = '↻ 同参重试';
  retryBtn.title = '用上次完全相同的参数（提示词/模型/比例/张数/参考图）重新生成';
  retryBtn.onclick = (e) => { e.stopPropagation(); retrySameParams(node); };
  retryBtn.onmousedown = (e) => e.stopPropagation();
  details.appendChild(retryBtn);

  // 可编辑详细参数：调整后「应用参数并重新生成」
  const edit = document.createElement('div');
  edit.className = 'ngm-edit';
  const mkSelect = (label, key, options) => {
    const row = document.createElement('div');
    row.className = 'ngm-edit-row';
    const lb = document.createElement('span');
    lb.textContent = label;
    const sel = document.createElement('select');
    const cur = (node.params && node.params[key]) || m[key] || '';
    const opts = options.slice();
    if (cur && opts.indexOf(cur) < 0) opts.unshift(cur); // 保留当前非常规值
    opts.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      if (v === cur) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = (e) => { e.stopPropagation(); node.params = node.params || {}; node.params[key] = e.target.value; scheduleAutosave(); };
    sel.onmousedown = (e) => e.stopPropagation();
    row.appendChild(lb); row.appendChild(sel);
    edit.appendChild(row);
  };
  mkSelect('模型', 'model', ['nanoBananaPro', 'Nano Banana Pro', 'FLUX.1', 'Stable Diffusion XL', 'GPT Image 2']);
  mkSelect('比例', 'aspect', AI_SPEC_ASPECTS.filter(a => a !== 'custom'));
  mkSelect('分辨率', 'resolution', AI_SPEC_RESOLUTIONS);
  mkSelect('张数', 'count', ['1张', '2张', '4张', '6张', '8张']);
  const pRow = document.createElement('div');
  pRow.className = 'ngm-edit-row ngm-edit-row-top';
  const pLb = document.createElement('span');
  pLb.textContent = '提示词';
  const pTa = document.createElement('textarea');
  pTa.rows = 2;
  pTa.value = (node.prompt != null && node.prompt !== '') ? node.prompt : (m.ownPrompt || m.prompt || '');
  pTa.oninput = (e) => { e.stopPropagation(); node.prompt = e.target.value; if (node.params) node.params.prompt = e.target.value; scheduleAutosave(); };
  pTa.onmousedown = (e) => e.stopPropagation();
  pRow.appendChild(pLb); pRow.appendChild(pTa);
  edit.appendChild(pRow);
  const regen = document.createElement('button');
  regen.type = 'button';
  regen.className = 'ngm-retry ngm-regen';
  regen.textContent = '⟳ 应用参数并重新生成';
  regen.title = '用上方调整后的参数重新运行本节点';
  regen.onclick = (e) => { e.stopPropagation(); runNode(node); };
  regen.onmousedown = (e) => e.stopPropagation();
  edit.appendChild(regen);
  details.appendChild(edit);

  strip.appendChild(details);

  el.appendChild(strip);
}

// ===== C 图片/视频按原图比例显示 =====
// 单图展示为主的节点类型
// aiImage：单图结果按生成图比例适配节点框（多图网格在 probeFitNode 内单独跳过）
const RATIO_FIT_TYPES = ['image', 'aiVideo', 'upscale', 'lineart', 'videoInput', 'aiImage', 'imageEdit'];
// 根据图片自然尺寸，把节点宽度调整为「贴合原图比例」（带上下限兜底），并记录 node.ratio 供预览图使用
function fitNodeToImageRatio(node, naturalW, naturalH) {
  try {
    if (!node || !naturalW || !naturalH) return;
    // aiImage 是主输出视觉：给更大的预览上限；其余节点保持原紧凑尺寸
    const isHero = node.type === 'aiImage';
    const MAX_W = isHero ? Math.max(260, Math.min(360, Math.round(window.innerWidth * 0.28))) : Math.max(190, Math.min(240, Math.round(window.innerWidth * 0.18)));
    const MAX_H = isHero ? Math.max(170, Math.min(260, Math.round(window.innerHeight * 0.24))) : Math.max(130, Math.min(180, Math.round(window.innerHeight * 0.16)));
    const MIN_W = 160;
    const contentAspect = naturalW / naturalH;
    const scale = Math.min(1, MAX_W / naturalW, MAX_H / naturalH);
    const contentW = Math.max(MIN_W, Math.round(naturalW * scale));
    const contentH = Math.max(96, Math.round(contentW / contentAspect));
    // image-only：标题已移到框外，框高只算图片内容
    const headerH = node.type === 'aiImage' ? 0 : (node.el ? ((node.el.querySelector('.node-header') && node.el.querySelector('.node-header').offsetHeight) || 42) : 42);
    node.width = contentW + 32;
    node.height = contentH + headerH + 8;
    node.ratio = contentAspect;
    if (node.el) node.el.style.width = node.width + 'px';
    if (node.el) node.el.style.minHeight = node.height + 'px';
    // 比例计算在预览图渲染之后才拿到 → 重建节点 body 让预览图按比例呈现
    if (node.el) buildNodeBody(node.el, node);
    // hero 已由 buildNodeBody 按 node.ratio 挂 aspect-ratio；这里只按 hero 实测高度同步节点框高
    const fitHeroEl = node.el && node.el.querySelector('.node-hero');
    if (fitHeroEl) {
      // 先清旧 minHeight 再测量：否则框被旧值撑高时 (框高-hero高) 会把空白误算进 chrome，
      // 空白被固化进 node.height 并写回 minHeight（刷新后因无旧值而自愈）
      node.el.style.minHeight = '';
      // rect 为视口像素（含相机 zoom 缩放），node.width/height 为布局像素 → 除以 zoom 换算，
      // 否则 zoom≠1 时把框算大 ×zoom（图片下方留空白），刷新后 zoom 复位才"自愈"
      const z = (workflow.camera && workflow.camera.zoom) || 1;
      const hr = fitHeroEl.getBoundingClientRect();
      const nr = node.el.getBoundingClientRect();
      if (hr.width > 40) {
        // 高度按 hero 实测宽(布局) / 比例推算（容器偏高时 flex 拉伸后的实测高不可信）
        const wantH = Math.round((hr.width / z) / contentAspect);
        node.height = Math.max(96, wantH + Math.round((nr.height - hr.height) / z));
        node.el.style.minHeight = node.height + 'px';
        buildNodeBody(node.el, node);
      }
    }
    markEdgesDirty();
    renderMinimap();
    scheduleAutosave();
    if (node === __composerNode) positionNodeComposer();
  } catch (e) {}
}

// 规格联动：选择比例/分辨率后立即把 aiImage 节点框调整为对应画幅比例，
// 保证生成的图片（按比例裁剪后）与节点框完全贴合
function applySpecSizeToAiImageNode(node) {
  try {
    if (!node || (node.type !== 'aiImage' && node.type !== 'imageEdit' && node.type !== 'aiVideo') || !node.el) return;
    const ratio = resolveAiSpecRatio(node.params && node.params.aspect, node.params && node.params.customAspect);
    if (!ratio) return;
    const MAX_W = Math.max(260, Math.min(360, Math.round(window.innerWidth * 0.28)));
    const MAX_H = Math.max(170, Math.min(260, Math.round(window.innerHeight * 0.24)));
    let w = MAX_W, h = w / ratio;
    if (h > MAX_H) { h = MAX_H; w = h * ratio; }
    w = Math.max(160, Math.round(w));
    h = Math.max(96, Math.round(h));
    node.width = w + 32;
    node.height = h + 8; // image-only：框内只有图片，无标题栏占位
    node.ratio = ratio;
    node._fitProbed = true; // 规格已定框型：生成后不再按图片重排（上游比例已统一裁剪对齐）
    node.el.style.width = node.width + 'px';
    node.el.style.minHeight = node.height + 'px';
    buildNodeBody(node.el, node);
    // 规格框同样按 hero 实测高度同步节点框高
    const specHero = node.el.querySelector('.node-hero');
    if (specHero) {
      node.el.style.minHeight = ''; // 同 fitNodeToImageRatio：清除旧撑高再测量
      const z2 = (workflow.camera && workflow.camera.zoom) || 1;
      const shr = specHero.getBoundingClientRect();
      const snr = node.el.getBoundingClientRect();
      if (shr.width > 40) {
        const wantH = Math.round((shr.width / z2) / ratio);
        node.height = Math.max(96, wantH + Math.round((snr.height - shr.height) / z2));
        node.el.style.minHeight = node.height + 'px';
        buildNodeBody(node.el, node);
      }
    }
    markEdgesDirty();
    renderMinimap();
    scheduleAutosave();
    if (node === __composerNode) positionNodeComposer();
  } catch (e) {}
}

function fitNodeToVideoRatio(node, naturalW, naturalH) {
  try {
    if (!node || !naturalW || !naturalH) return;
    const MAX_W = Math.max(240, Math.round(window.innerWidth * 0.42));
    const MAX_H = Math.max(180, Math.round(window.innerHeight * 0.42));
    const MIN_W = 200;
    const contentAspect = naturalW / naturalH;
    const scale = Math.min(1, MAX_W / naturalW, MAX_H / naturalH);
    const contentW = Math.max(MIN_W, Math.round(naturalW * scale));
    const contentH = Math.max(120, Math.round(contentW / contentAspect));
    const headerH = node.el ? ((node.el.querySelector('.node-header') && node.el.querySelector('.node-header').offsetHeight) || 42) : 42;
    node.width = contentW + 32;
    node.height = contentH + headerH + 8;
    node.ratio = contentAspect;
    node.videoAspect = contentAspect;
    if (node.el) {
      node.el.style.width = node.width + 'px';
      node.el.style.minHeight = node.height + 'px';
      buildNodeBody(node.el, node);
    }
    markEdgesDirty();
    renderMinimap();
    scheduleAutosave();
    if (node === __composerNode) positionNodeComposer();
  } catch (e) {}
}

function probeVideoNodeSize(node, src) {
  try {
    if (!node || !src || node.__videoMetaProbed) return;
    node.__videoMetaProbed = true;
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.src = src;
    v.onloadedmetadata = () => {
      try {
        const w = v.videoWidth || 0;
        const h = v.videoHeight || 0;
        if (w > 0 && h > 0) fitNodeToVideoRatio(node, w, h);
      } catch (e) {}
      try { v.removeAttribute('src'); v.load(); } catch (_) {}
      try { v.remove(); } catch (_) {}
    };
    v.onerror = () => {
      try { v.removeAttribute('src'); v.load(); } catch (_) {}
      try { v.remove(); } catch (_) {}
    };
  } catch (e) {}
}

// 探测节点缩略图的自然尺寸并按比例适配节点（懒迁移：旧节点首次渲染时也会生效）
function probeFitNode(node) {
  try {
    const src = normalizeImageSrc(node && node.thumb);
    if (!node || !src || typeof src !== 'string') return;
    // 真实生成的 thumb 常为 https:/blob: URL（中转返回 url），只认 data: 会跳过重排留下留白；
    // 这里只取 naturalWidth/Height，不读像素，跨域无 CORS 限制
    if (!/^(data:|https?:|blob:)/i.test(src)) return;
    if (!RATIO_FIT_TYPES.includes(node.type)) return;
    // aiImage 多图画廊：保留网格布局，不做单图比例适配
    if (node.type === 'aiImage' && Array.isArray(node._galleryImages) && node._galleryImages.length > 1) return;
    const img = new Image();
    img.onload = () => node.type === 'videoInput'
      ? fitNodeToVideoRatio(node, img.naturalWidth, img.naturalHeight)
      : fitNodeToImageRatio(node, img.naturalWidth, img.naturalHeight);
    img.onerror = () => {};
    img.src = src;
  } catch (e) {}
}

// ===== 提示词放大编辑（长提示词在模态大框中修改，实时回写小框与节点数据）=====
let _promptExpandEsc = null;
let _promptExpandOutside = null;
function closePromptExpandEditor() {
  const ov = document.getElementById('promptExpandOverlay');
  if (ov) ov.remove();
  if (_promptExpandEsc) { document.removeEventListener('keydown', _promptExpandEsc, true); _promptExpandEsc = null; }
  if (_promptExpandOutside) { document.removeEventListener('mousedown', _promptExpandOutside, true); _promptExpandOutside = null; }
}
function openPromptExpandEditor(opts) {
  closePromptExpandEditor();
  const overlay = document.createElement('div');
  overlay.id = 'promptExpandOverlay';
  overlay.className = 'prompt-expand-overlay';
  const box = document.createElement('div');
  box.className = 'prompt-expand-box';
  const head = document.createElement('div');
  head.className = 'prompt-expand-head';
  const title = document.createElement('div');
  title.className = 'prompt-expand-title';
  title.textContent = opts.title || '放大编辑';
  const count = document.createElement('div');
  count.className = 'prompt-expand-count';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'prompt-expand-close';
  closeBtn.textContent = '×';
  closeBtn.title = '关闭（Esc / Ctrl+Enter）';
  head.appendChild(title);
  head.appendChild(count);
  head.appendChild(closeBtn);
  const ta = document.createElement('textarea');
  ta.className = 'prompt-expand-textarea';
  ta.value = opts.getText() || '';
  const syncCount = () => { count.textContent = ta.value.length + ' 字'; };
  syncCount();
  ta.oninput = () => {
    opts.setText(ta.value);
    if (opts.syncInline) opts.syncInline(ta.value);
    syncCount();
  };
  ta.onmousedown = (e) => e.stopPropagation();
  closeBtn.onclick = (e) => { e.stopPropagation(); closePromptExpandEditor(); };
  // 捕获阶段拦截 Esc / Ctrl+Enter，避免同时触发画布快捷键
  _promptExpandEsc = (e) => {
    if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
      e.stopPropagation();
      e.preventDefault();
      closePromptExpandEditor();
    }
  };
  const onOutside = (e) => {
    if (box.contains(e.target)) return;
    if (opts.anchor && opts.anchor.contains && opts.anchor.contains(e.target)) return;
    closePromptExpandEditor();
  };
  document.addEventListener('keydown', _promptExpandEsc, true);
  document.addEventListener('mousedown', onOutside, true);
  _promptExpandOutside = onOutside;
  box.appendChild(head);
  box.appendChild(ta);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  // 锚定到触发按钮附近（非全屏居中）：下方放不下则翻到上方
  const ar = opts.anchor && opts.anchor.getBoundingClientRect ? opts.anchor.getBoundingClientRect() : null;
  const bw = box.offsetWidth, bh = box.offsetHeight;
  let left = 8, top = 8;
  if (ar) {
    left = Math.max(8, Math.min(window.innerWidth - bw - 8, ar.left - 40));
    top = ar.bottom + 8;
    if (top + bh > window.innerHeight - 8) top = Math.max(8, ar.top - bh - 8);
  }
  box.style.left = left + 'px';
  box.style.top = top + 'px';
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}
function makePromptExpandBtn(getText, setText, syncInline, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'prompt-expand-btn';
  b.title = title || '放大编辑';
  b.textContent = '⤢';
  b.onmousedown = (e) => e.stopPropagation();
  b.onclick = (e) => { e.stopPropagation(); openPromptExpandEditor({ title: title, getText: getText, setText: setText, syncInline: syncInline, anchor: b }); };
  return b;
}

// ===== #5 节点下方独立 Composer（Details on Demand）=====
// 编辑控件从节点体内迁移到「选中时浮现在节点下方的圆角 Composer」：节点默认保持纯净，
// 选中才显示 prompt + 模型 + 参数 + 生成键。不改数据流，纯 UI 重组。
let __composerNode = null;
// 图片/视频输入节点不使用节点下方 Composer，素材直接在节点内预览。
const COMPOSER_TYPES = ['videoInput', 'aiImage', 'imageEdit', 'aiVideo', 'lineart', 'upscale'];

function nodeComposerEl() { return document.getElementById('nodeComposer'); }
function isComposerType(node) { return !!(node && COMPOSER_TYPES.includes(node.type)); }

function isVideoInputSettingsCollapsed(node) {
  return !!(node && node.type === 'videoInput' && node.__settingsCollapsed !== false);
}

function showNodeComposer(node) {
  if (!isComposerType(node)) { hideNodeComposer(); return; }
  __composerNode = node;
  const el = nodeComposerEl();
  if (!el) return;
  el.hidden = false; // 先显示再定位（positionNodeComposer 有 hidden 守卫）
  buildNodeComposerBody(node);
  positionNodeComposer();
}

function hideNodeComposer() {
  __composerNode = null;
  const el = nodeComposerEl();
  if (!el) return;
  el.hidden = true;
  el.innerHTML = '';
}

// 把 Composer 定位到选中节点正下方（屏幕坐标，跟随画布 pan/zoom；节点拖动/缩放/重建时再调）
function positionNodeComposer() {
  const el = nodeComposerEl();
  const node = __composerNode;
  if (!el || el.hidden || !node || !workflow) return;
  // 节点已被删除/画布已重载 → 收起
  if (!workflow.nodes.has(node.id)) { hideNodeComposer(); return; }
  const cam = workflow.camera;
  const h = node.height || (node.el && node.el.offsetHeight) || 160;
  const w = Math.max(240, Math.round((node.width || 280) * cam.zoom));
  el.style.width = Math.round(w) + 'px';
  // 节点四边屏幕坐标
  const nodeTop = node.y * cam.zoom + cam.y;
  const nodeBottom = (node.y + h) * cam.zoom + cam.y;
  const nodeLeft = node.x * cam.zoom + cam.x;
  const nodeRight = (node.x + (node.width || 280)) * cam.zoom + cam.x;
  let left = nodeLeft;
  let top = nodeBottom + 12; // 首选：节点正下方
  // 视口内兜底：下方放不下时依次尝试 右侧 → 左侧 → 最后 clamp，避免面板压住节点本体
  try {
    const wrapRect = canvasWrap.getBoundingClientRect();
    const ch = el.offsetHeight, cw = el.offsetWidth;
    const roomBelow = (top + ch) <= (wrapRect.bottom - 8);
    if (!roomBelow) {
      const rightLeft = nodeRight + 12;
      const leftLeft = nodeLeft - cw - 12;
      if (rightLeft + cw <= wrapRect.right - 8) { left = rightLeft; top = nodeTop; }
      else if (leftLeft >= wrapRect.left + 8) { left = leftLeft; top = nodeTop; }
      else { top = Math.max(8, (wrapRect.bottom - wrapRect.top) - ch - 8); }
    }
    if (left + cw > wrapRect.right - 8) left = Math.max(8, (wrapRect.right - wrapRect.left) - cw - 8);
    if (top + ch > wrapRect.bottom - 8) top = Math.max(8, (wrapRect.bottom - wrapRect.top) - ch - 8);
  } catch (e) {}
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
}

function buildNodeComposerBody(node) {
  const el = nodeComposerEl();
  if (!el) return;
  el.innerHTML = '';
  node.params = node.params || {};

  const isMediaInput = node.type === 'image' || node.type === 'videoInput';
  const isVideoInput = node.type === 'videoInput';
  const isAiImageLike = node.type === 'aiImage' || node.type === 'imageEdit';
  const isProcessingNode = node.type === 'lineart' || node.type === 'upscale';
  const collapsed = isVideoInput && isVideoInputSettingsCollapsed(node);

  // 头部：类型标签 + 上游提示词标记 + 资产引用徽标 + 收起
  const head = document.createElement('div');
  head.className = 'nc-head';
  const title = document.createElement('span');
  title.className = 'nc-title';
  title.textContent = isMediaInput
    ? (node.type === 'videoInput' ? '🎬 视频输入' : '🖼 图片输入') + ' · 详情'
    : (isAiImageLike
      ? (node.type === 'imageEdit' ? '🖌 图片修正' : '🖼 图片') + ' · 生成'
      : isProcessingNode
        ? (node.type === 'lineart' ? '✏️ 提取线稿' : '✨ 智能高清') + ' · 处理'
        : '🎬 视频 · 生成');
  head.appendChild(title);
  if (node.effectivePrompt && node.effectivePrompt !== (node.prompt || '').trim()) {
    const up = document.createElement('span');
    up.className = 'nc-up';
    up.title = '当前使用来自上游文本节点的提示词';
    up.textContent = '↑ 上游提示词';
    head.appendChild(up);
  }
  const refBadge = document.createElement('span');
  refBadge.className = 'nc-ref-badge';
  refBadge.style.display = 'none';
  const refreshRefBadge = () => {
    let rs = { hit: 0, missing: 0, names: [], missingNames: [] };
    try { rs = nodeRefSummary(node); } catch (e) {}
    if (!rs.hit && !rs.missing) { refBadge.style.display = 'none'; return; }
    refBadge.style.display = '';
    refBadge.classList.toggle('has-missing', rs.missing > 0);
    refBadge.textContent = '🔗 已引用 ' + rs.hit + ' 个资产' + (rs.missing ? ' · ' + rs.missing + ' 个未找到' : '');
    refBadge.title = (rs.names && rs.names.length ? '命中：' + rs.names.join('、') : '') + (rs.missingNames && rs.missingNames.length ? '未找到：' + rs.missingNames.join('、') : '');
  };
  refreshRefBadge();
  head.appendChild(refBadge);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'nc-close';
  closeBtn.textContent = '✕';
  closeBtn.title = '收起';
  closeBtn.onmousedown = (e) => e.stopPropagation();
  closeBtn.onclick = (e) => { e.stopPropagation(); hideNodeComposer(); };
  head.appendChild(closeBtn);
  el.appendChild(head);

  // 提示词/说明输入
  const textarea = document.createElement('textarea');
  textarea.className = 'node-textarea nc-textarea';
  textarea.placeholder = isMediaInput
    ? '填写图片 / 视频说明…'
    : isProcessingNode
      ? (node.type === 'lineart' ? '可选：补充线稿处理要求…' : '可选：补充高清处理要求…')
      : '描述要' + (node.type === 'imageEdit' ? '修正' : '生成') + '的' + (isAiImageLike ? '图片' : '视频') + '内容…';
  textarea.value = isMediaInput ? (node.charDesc || '') : (node.prompt || '');
  textarea.rows = 3;
  textarea.onmousedown = (e) => e.stopPropagation();
  textarea.oninput = (e) => {
    if (isMediaInput) node.charDesc = e.target.value;
    else node.prompt = e.target.value;
    scheduleAutosave();
    refreshRefBadge();
  };
  const promptWrap = document.createElement('div');
  promptWrap.className = 'prompt-expand-wrap';
  promptWrap.appendChild(textarea);
  promptWrap.appendChild(makePromptExpandBtn(
    () => (isMediaInput ? node.charDesc : node.prompt) || '',
    (v) => { if (isMediaInput) node.charDesc = v; else node.prompt = v; scheduleAutosave(); refreshRefBadge(); },
    (v) => { textarea.value = v; },
    isMediaInput ? '放大编辑角色描述' : '放大编辑提示词'));
  el.appendChild(promptWrap);

  if (isVideoInput) {
    const toggleRow = document.createElement('div');
    toggleRow.className = 'nc-video-toggle-row';
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'nc-video-toggle';
    toggleBtn.textContent = collapsed ? '展开参数设置' : '收起参数设置';
    toggleBtn.title = collapsed ? '点击展开视频节点参数设置' : '点击收起视频节点参数设置';
    toggleBtn.onmousedown = (e) => e.stopPropagation();
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      node.__settingsCollapsed = !collapsed;
      if (node === __composerNode) showNodeComposer(node);
    };
    toggleRow.appendChild(toggleBtn);
    el.appendChild(toggleRow);
  }

  if (isAiImageLike) {
    if (node.type !== 'imageEdit') {
      const tip = document.createElement('div');
      tip.className = 'nc-media-hint';
      tip.textContent = 'AI 绘图节点：只预览生成结果；双击结果图可继续上传参考图。';
      el.appendChild(tip);
    }

    const refWrap = document.createElement('div');
    refWrap.className = 'node-ref-uploader node-ai-image-ref-uploader' + (node.type === 'imageEdit' ? ' node-image-edit-ref-uploader' : '');
    const refBtn = document.createElement('button');
    refBtn.type = 'button';
    refBtn.className = 'node-ref-upload-btn';
    refBtn.textContent = node.type === 'imageEdit' ? '＋参考' : '📎 上传参考图';
    refBtn.title = node.type === 'imageEdit'
      ? '添加参考图：补充风格、姿态或细节参考'
      : '上传参考图：会显示缩略图，并随生成一起发送';
    refBtn.onmousedown = (e) => e.stopPropagation();
    const refThumbs = document.createElement('div');
    refThumbs.className = 'node-ref-thumbs node-ai-image-ref-thumbs' + (node.type === 'imageEdit' ? ' node-image-edit-ref-thumbs' : '');
    const renderRefThumbs = () => {
      refThumbs.hidden = false;
      renderRefThumbsManaged(node, refThumbs, {
        emptyText: '暂无参考图',
        onEmpty: (c) => {
          if (node.type === 'imageEdit') { refThumbs.hidden = true; return; }
          const empty = document.createElement('div');
          empty.className = 'node-ai-image-ref-empty';
          empty.textContent = '暂无参考图';
          c.appendChild(empty);
        },
        onChange: () => {
          renderRefThumbs();
          if (node === __composerNode) showNodeComposer(node);
          else if (node.el) buildNodeBody(node.el, node);
        },
      });
    };
    refWrap.appendChild(refBtn);

    refBtn.onclick = (e) => {
      e.stopPropagation();
      openReferenceImagePicker(node, () => {
        renderRefThumbs();
        if (node === __composerNode) showNodeComposer(node);
        else if (node.el) buildNodeBody(node.el, node);
      });
    };
    refWrap.appendChild(refThumbs);
    el.appendChild(refWrap);
    renderRefThumbs();
  }

  if (isProcessingNode) {
    const tip = document.createElement('div');
    tip.className = 'nc-media-hint';
    tip.textContent = node.type === 'lineart'
      ? '使用上游图片提取线稿；未连接图片时无法处理。'
      : '使用上游图片进行智能高清；未连接图片时无法处理。';
    el.appendChild(tip);
  }

  if (node.type === 'aiVideo') {
    const refWrap = document.createElement('div');
    refWrap.className = 'node-ref-uploader node-ai-video-ref-uploader';
    const refBtn = document.createElement('button');
    refBtn.type = 'button';
    refBtn.className = 'node-ref-upload-btn';
    refBtn.textContent = '＋参考视频';
    refBtn.title = '上传参考视频：随下游 AI 视频生成一起发送';
    refBtn.onmousedown = (e) => e.stopPropagation();

    const refThumbs = document.createElement('div');
    refThumbs.className = 'node-ref-thumbs node-ai-video-ref-thumbs';
    const renderRefThumbs = () => {
      refThumbs.innerHTML = '';
      const refs = Array.isArray(node.refVideos) ? node.refVideos.filter(r => r && r.src) : [];
      if (!refs.length) {
        refThumbs.hidden = true;
        return;
      }
      refThumbs.hidden = false;
      refs.forEach((r, i) => {
        const t = document.createElement('div');
        t.className = 'node-ref-thumb node-ref-thumb-video';
        const vid = document.createElement('video');
        vid.src = normalizeImageSrc(r.src) || '';
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'metadata';
        vid.draggable = false;
        vid.onmousedown = (e) => e.stopPropagation();
        vid.onclick = (e) => {
          e.stopPropagation();
          if (vid.paused) vid.play().catch(() => {});
          else vid.pause();
        };
        t.appendChild(vid);
        const badge = document.createElement('span');
        badge.className = 'node-ref-video-play';
        badge.textContent = '▶';
        t.appendChild(badge);
        const rm = document.createElement('span');
        rm.className = 'node-ref-thumb-rm';
        rm.textContent = '×';
        rm.title = '移除参考视频';
        rm.onmousedown = (e) => e.stopPropagation();
        rm.onclick = (e) => {
          e.stopPropagation();
          node.refVideos.splice(i, 1);
          scheduleAutosave();
          renderRefThumbs();
          if (node === __composerNode) showNodeComposer(node);
          else if (node.el) buildNodeBody(node.el, node);
        };
        t.appendChild(rm);
        refThumbs.appendChild(t);
      });
    };
    refBtn.onclick = (e) => {
      e.stopPropagation();
      openReferenceVideoPicker(node, () => {
        renderRefThumbs();
        if (node === __composerNode) showNodeComposer(node);
        else if (node.el) buildNodeBody(node.el, node);
      });
    };
    refWrap.appendChild(refBtn);
    refWrap.appendChild(refThumbs);
    el.appendChild(refWrap);
    renderRefThumbs();
  }

  if (isMediaInput) {
    // 旧版本 Composer 曾经把 AI 生图参数混进媒体输入节点；这里顺手清理掉，避免脏数据继续回写。
    ['model', 'aspect', 'resolution', 'count', 'mode'].forEach((k) => {
      if (node.params && Object.prototype.hasOwnProperty.call(node.params, k)) delete node.params[k];
    });
    if (node.type === 'image' && node.params && Object.prototype.hasOwnProperty.call(node.params, 'duration')) delete node.params.duration;

    const mediaHint = document.createElement('div');
    mediaHint.className = 'nc-media-hint';
    mediaHint.textContent = node.type === 'videoInput'
      ? (collapsed ? '视频输入节点：点击可展开参数设置，上传后直接在节点面板内预览。' : '视频输入节点：参数设置已展开，上传后直接在节点面板内预览，点画布可收起详情。')
      : '图片输入节点：上传后以预览优先展示，点画布可收起详情。';
    el.appendChild(mediaHint);

    if (isVideoInput) {
      const mediaMeta = document.createElement('div');
      mediaMeta.className = 'nc-media-meta';
      const fileName = node.params && node.params.name ? String(node.params.name) : '未选择视频';
      const uploadState = (node.uploadedVideo ? '已保留原视频（uploadedVideo） · ' : '') + '时长：' + (node.params && node.params.duration ? node.params.duration : '00:00');
      mediaMeta.innerHTML = '<div class="nc-media-line"><span>文件</span><strong>' + escapeHtml(fileName) + '</strong></div>' +
        '<div class="nc-media-line"><span>状态</span><strong>' + escapeHtml(uploadState) + '</strong></div>';
      mediaMeta.hidden = collapsed;
      el.appendChild(mediaMeta);

      const videoNote = document.createElement('div');
      videoNote.className = 'nc-video-note';
      videoNote.textContent = collapsed ? '点击上方按钮展开更多设置。' : '预览始终显示在节点面板里，这里只保留上传与清空等设置。';
      el.appendChild(videoNote);

      const mediaActions = document.createElement('div');
      mediaActions.className = 'nc-media-actions';
      const replaceBtn = document.createElement('button');
      replaceBtn.type = 'button';
      replaceBtn.className = 'nc-run nc-media-replace';
      replaceBtn.textContent = (node.uploadedVideo || (node.params && node.params.name)) ? '更换视频' : '上传视频';
      replaceBtn.onmousedown = (e) => e.stopPropagation();
      replaceBtn.onclick = (e) => { e.stopPropagation(); openVideoFilePicker(node); };
      mediaActions.appendChild(replaceBtn);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'nc-clear';
      clearBtn.textContent = '清空';
      clearBtn.onmousedown = (e) => e.stopPropagation();
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        node.thumb = '';
        node.uploadedVideo = '';
        node.ratio = null;
        node.params.name = '';
        node.params.duration = '00:00';
        resetNodeData(node);
        if (node === __composerNode) showNodeComposer(node);
        markEdgesDirty();
        scheduleAutosave();
      };
      clearBtn.hidden = collapsed;
      mediaActions.appendChild(clearBtn);

      el.appendChild(mediaActions);

      if (!collapsed) {
        const videoFields = document.createElement('div');
        videoFields.className = 'nc-video-fields';

        const nameRow = document.createElement('label');
        nameRow.className = 'nc-field';
        nameRow.innerHTML = '<span>文件名</span>';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'nc-input';
        nameInput.value = node.params && node.params.name ? String(node.params.name) : '';
        nameInput.placeholder = '未选择视频';
        nameInput.onmousedown = (e) => e.stopPropagation();
        nameInput.oninput = (e) => { node.params.name = e.target.value; scheduleAutosave(); };
        nameRow.appendChild(nameInput);
        videoFields.appendChild(nameRow);

        const durationRow = document.createElement('label');
        durationRow.className = 'nc-field';
        durationRow.innerHTML = '<span>时长</span>';
        const durationInput = document.createElement('input');
        durationInput.type = 'text';
        durationInput.className = 'nc-input';
        durationInput.value = node.params && node.params.duration ? String(node.params.duration) : '00:00';
        durationInput.placeholder = '00:00';
        durationInput.onmousedown = (e) => e.stopPropagation();
        durationInput.oninput = (e) => { node.params.duration = e.target.value; scheduleAutosave(); };
        durationRow.appendChild(durationInput);
        videoFields.appendChild(durationRow);

        el.appendChild(videoFields);
      }
      } else {
      const mediaActions = document.createElement('div');
      mediaActions.className = 'nc-media-actions';
      const replaceBtn = document.createElement('button');
      replaceBtn.type = 'button';
      replaceBtn.className = 'nc-run nc-media-replace';
      replaceBtn.textContent = '更换图片';
      replaceBtn.onmousedown = (e) => e.stopPropagation();
      replaceBtn.onclick = (e) => { e.stopPropagation(); openImageFilePicker(node); };
      mediaActions.appendChild(replaceBtn);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'nc-clear';
      clearBtn.textContent = '清空';
      clearBtn.onmousedown = (e) => e.stopPropagation();
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        node.thumb = '';
        node.uploadedImage = '';
        node.ratio = null;
        if (node.params) node.params.name = '';
        resetNodeData(node);
        if (node === __composerNode) showNodeComposer(node);
        markEdgesDirty();
        scheduleAutosave();
      };
      mediaActions.appendChild(clearBtn);

      el.appendChild(mediaActions);
    }
  }

  if (node.type === 'image') {
    el.classList.toggle('node-image-locked', !!(node.uploadedImage || node.thumb));
  }

  if (!isMediaInput) {
    // 参数行：模型 / 规格 / 张数|时长 / 模式
    const row = document.createElement('div');
    row.className = 'nc-params' + (node.type === 'aiVideo' ? ' nc-params-video' : '');
    const modelSel = document.createElement('select');
    modelSel.className = 'nc-select nc-model';
    const models = isProcessingNode
      ? ['GPT Image 2']
      : node.type === 'imageEdit'
      ? ['GPT Image 2']
      : (node.type === 'aiImage' || node.type === 'image'
        ? ['Nano Banana Pro', 'FLUX.1', 'Stable Diffusion XL', 'GPT Image 2']
        : ['可灵 2.0', 'Runway Gen-4']);
    models.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      modelSel.appendChild(o);
    });
    if (!models.includes(node.params.model)) node.params.model = models[0];
    modelSel.value = node.params.model;
    modelSel.onmousedown = (e) => e.stopPropagation();
    modelSel.onchange = (e) => { node.params.model = e.target.value; scheduleAutosave(); };
    row.appendChild(modelSel);

    const specSel = buildUnifiedAiSpecSelect(node, 'nc-select nc-spec-select');
    row.appendChild(specSel);

    const isVideo = node.type === 'aiVideo';
    const paramDefs = [];
    if (isVideo) paramDefs.push({ key: 'duration', options: ['3秒', '5秒', '10秒', '15秒', '30秒'] });
    else if (!isProcessingNode) paramDefs.push({ key: 'count', options: ['1张', '2张', '4张', '6张', '8张'] });
    if (!isProcessingNode) paramDefs.push({ key: 'mode', options: ['同步', '异步'] });
    paramDefs.forEach(({ key, options }) => {
      const sel = document.createElement('select');
      sel.className = 'nc-select';
      options.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
      const cur = node.params[key];
      if (!options.includes(cur)) node.params[key] = options[0];
      sel.value = node.params[key];
      sel.onmousedown = (e) => e.stopPropagation();
      sel.onchange = (e) => { node.params[key] = e.target.value; scheduleAutosave(); };
      row.appendChild(sel);
    });
    el.appendChild(row);

    // 高级折叠：引用角色资产（图片/视频生成保留；处理节点不显示空的高级区）
    if (!isProcessingNode) {
      const advBtn = document.createElement('button');
      advBtn.type = 'button';
      advBtn.className = 'nc-adv-toggle';
      advBtn.textContent = '⚙ 高级';
      advBtn.title = '高级选项：引用已保存的角色资产';
      advBtn.onmousedown = (e) => e.stopPropagation();
      const advBox = document.createElement('div');
      advBox.className = 'nc-adv';
      advBox.hidden = true;
      if (node.type === 'aiImage' || node.type === 'imageEdit') {
        const refRow = document.createElement('div');
        refRow.className = 'node-ref-asset-row';
        const refBtn = document.createElement('button');
        refBtn.type = 'button';
        refBtn.className = 'node-ref-asset-btn';
        refBtn.textContent = '🔗 引用角色资产';
        refBtn.title = '从已保存的角色资产中选择，自动插入 <<<名称>>> 引用令牌';
        refBtn.onmousedown = (e) => e.stopPropagation();
        refRow.appendChild(refBtn);
        const refSel = document.createElement('select');
        refSel.className = 'node-ref-asset-select';
        refSel.title = '选择已保存的角色资产，插入引用令牌到提示词';
        const refItems = listCharacterAssets();
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = refItems.length ? '选择角色资产…' : '（暂无角色资产）';
        refSel.appendChild(ph);
        refItems.forEach(it => { const o = document.createElement('option'); o.value = it.name; o.textContent = it.name; refSel.appendChild(o); });
        refSel.onmousedown = (e) => e.stopPropagation();
        refSel.onchange = (e) => {
          const nm = e.target.value;
          if (!nm) return;
          insertRefTokenIntoNodePrompt(textarea, nm);
          node.prompt = textarea.value;
          refreshRefBadge();
          scheduleAutosave();
          showToast('已插入引用令牌 <<<' + nm + '>>>', 'success');
          refSel.value = '';
        };
        refRow.appendChild(refSel);
        advBox.appendChild(refRow);
      }
      advBtn.onclick = (e) => { e.stopPropagation(); advBox.hidden = !advBox.hidden; advBtn.classList.toggle('open', !advBox.hidden); };
      el.appendChild(advBtn);
      el.appendChild(advBox);
    }

    // 生成按钮
    const actions = document.createElement('div');
    actions.className = 'nc-actions';
    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'nc-run';
    runBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l9 6-9 6z"/></svg> 生成';
    runBtn.title = '运行此节点';
    runBtn.onmousedown = (e) => e.stopPropagation();
    runBtn.onclick = (e) => { e.stopPropagation(); runNode(node); };
    actions.appendChild(runBtn);
    el.appendChild(actions);
  }

  // Composer 内任何 mousedown 都不冒泡到画布（避免被当作空白点击而取消选中/隐藏）
  // 注：listener 绑在 el 自身，innerHTML 清空不销毁 → 用标志位防重复绑定
  if (!el._ncBound) {
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el._ncBound = true;
  }
}

function renderRunLog() {
  const list = document.getElementById('runLogList');
  const empty = document.getElementById('runLogEmpty');
  if (!list) return;
  const filter = (document.getElementById('runLogFilter') || {}).value || 'all';
  const data = loadRunLog().filter(e => filter === 'all' || e.status === filter);
  if (!data.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = data.map(function(e) {
    const time = new Date(e.t);
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const ss = String(time.getSeconds()).padStart(2, '0');
    const dur = e.duration >= 1000 ? (e.duration / 1000).toFixed(1) + 's' : e.duration + 'ms';
    const errHtml = e.status === 'error' ? '<div class="rl-err">' + escapeHtml(e.error || '失败') + '</div>' : '';
    const thumbHtml = e.thumb ? '<img class="rl-thumb" src="' + escapeHtml(e.thumb) + '" alt="">' : '';
    const saveBtn = (e.status === 'success' && e.thumb) ? '<button class="rl-save" data-thumb="' + escapeHtml(e.thumb) + '">存为素材</button>' : '';
    return '<div class="rl-item ' + e.status + '">' +
      (thumbHtml ? '<div class="rl-thumb-wrap">' + thumbHtml + '</div>' : '') +
      '<div class="rl-row1"><span class="rl-title">' + escapeHtml(e.title) + '</span>' +
      '<span class="rl-status ' + e.status + '">' + (e.status === 'success' ? '成功' : '失败') + '</span></div>' +
      '<div class="rl-row2">' + escapeHtml(e.desc || '') + '</div>' + errHtml +
      '<div class="rl-row3"><span>' + hh + ':' + mm + ':' + ss + '</span><span>' + dur + '</span>' + (saveBtn ? '<span class="rl-save-wrap">' + saveBtn + '</span>' : '') + '</div>' +
      '</div>';
  }).join('');
}
function clearRunLog() {
  try { localStorage.removeItem(RUN_LOG_KEY); } catch (e) {}
  renderRunLog();
  showToast('运行日志已清空', 'info');
}
function toggleRunLogPanel(show) {
  const panel = document.getElementById('runLogPanel');
  if (!panel) return;
  const open = show === undefined ? !panel.classList.contains('show') : show;
  panel.classList.toggle('show', open);
  if (open) renderRunLog();
}

//================ 4e. 重生成归档（Regenerations，借鉴 Hell Grind）================
// 失败 / 重生成记录独立归档，不污染正式运行结果与回收站，可在此集中重试。
const REGEN_KEY = 'flowcraft:regens:v1';
const REGEN_MAX = 300;
function loadRegens() {
  try { const raw = localStorage.getItem(REGEN_KEY); if (!raw) return []; const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function saveRegens(list) {
  try { localStorage.setItem(REGEN_KEY, JSON.stringify(list.slice(0, REGEN_MAX))); } catch (e) { /* 归档单独失败不影响主流程 */ }
}
// kind: 'failed' | 'regenerated'；nodeId 关联到原节点以便重试
function logRegen(entry) {
  const list = loadRegens();
  list.unshift(Object.assign({ t: Date.now(), kind: 'failed' }, entry));
  saveRegens(list);
  updateRegenBadge();
  if (typeof renderRegenPanel === 'function') renderRegenPanel();
}
function updateRegenBadge() {
  const badge = document.getElementById('regenBadge');
  if (!badge) return;
  const n = loadRegens().filter(e => e.kind === 'failed').length;
  if (n > 0) { badge.textContent = n; badge.style.display = ''; }
  else badge.style.display = 'none';
}
function clearRegens() {
  try { localStorage.removeItem(REGEN_KEY); } catch (e) {}
  updateRegenBadge();
  renderRegenPanel();
  showToast('重生成归档已清空', 'info');
}
function toggleRegenPanel(show) {
  const panel = document.getElementById('regenPanel');
  if (!panel) return;
  const open = show === undefined ? !panel.classList.contains('show') : show;
  panel.classList.toggle('show', open);
  if (open) { renderRegenPanel(); updateRegenBadge(); }
}
function retryRegen(id) {
  const item = loadRegens().find(x => x.id === id);
  if (!item || !item.nodeId) { showToast('找不到可重试的节点', 'warn'); return; }
  const node = workflow.nodes.get(item.nodeId);
  if (!node) { showToast('原节点已不存在，无法重试', 'warn'); return; }
  // 记录一次“重生成”归档，关联回原失败记录
  logRegen({
    id: 'regen_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    parentId: id, kind: 'regenerated', type: node.type,
    title: node.title, model: (node.params && node.params.model) || '',
    desc: describeNodeParams(node), error: '', nodeId: node.id, note: '已重新运行'
  });
  showToast('正在重新生成：' + (node.title || node.type), 'info');
  runNode(node);
}
function renderRegenPanel() {
  const list = document.getElementById('regenList');
  const empty = document.getElementById('regenEmpty');
  if (!list) return;
  const filter = (document.getElementById('regenFilter') || {}).value || 'all';
  const data = loadRegens().filter(e => filter === 'all' || e.kind === filter);
  if (!data.length) { list.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  list.innerHTML = data.map(function (e) {
    const time = new Date(e.t);
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const ss = String(time.getSeconds()).padStart(2, '0');
    const kindLabel = e.kind === 'regenerated' ? '已重生成' : '失败';
    const errHtml = (e.kind === 'failed' && e.error) ? '<div class="rl-err">' + escapeHtml(e.error) + '</div>' : '';
    const retryBtn = (e.kind === 'failed' && e.nodeId)
      ? '<button class="rl-save" data-regen="' + escapeHtml(e.id) + '">重试</button>'
      : '<span class="rl-kind-' + (e.kind === 'regenerated' ? 'ok' : 'bad') + '">' + kindLabel + '</span>';
    return '<div class="rl-item ' + (e.kind === 'failed' ? 'error' : 'success') + '">' +
      '<div class="rl-row1"><span class="rl-title">' + escapeHtml(e.title || e.type || '') + '</span>' +
      '<span class="rl-status ' + (e.kind === 'failed' ? 'error' : 'success') + '">' + kindLabel + '</span></div>' +
      '<div class="rl-row2">' + escapeHtml(e.desc || '') + '</div>' + errHtml +
      '<div class="rl-row3"><span>' + hh + ':' + mm + ':' + ss + '</span><span class="rl-save-wrap">' + retryBtn + '</span></div>' +
      '</div>';
  }).join('');
  list.querySelectorAll('[data-regen]').forEach(btn => {
    btn.addEventListener('click', () => retryRegen(btn.getAttribute('data-regen')));
  });
}

//================ 4f. 回收站 UI ================
function updateRecycleUI() {
  const badge = document.getElementById('recycleBadge');
  const count = document.getElementById('recycleCount');
  const btnRestoreAll = document.getElementById('btnRestoreAll');
  const btnEmptyRecycle = document.getElementById('btnEmptyRecycle');
  const list = document.getElementById('recycleList');

  if (badge) {
    if (recycleBin.length > 0) {
      badge.textContent = recycleBin.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
  if (count) count.textContent = recycleBin.length;
  if (btnRestoreAll) btnRestoreAll.disabled = recycleBin.length === 0;
  if (btnEmptyRecycle) btnEmptyRecycle.disabled = recycleBin.length === 0;

  // 重新渲染列表
  if (list) {
    if (recycleBin.length === 0) {
      list.innerHTML = `
        <div class="recycle-empty">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10"/></svg>
          <div class="empty-text">回收站为空</div>
        </div>`;
      return;
    }
    list.innerHTML = '';
    recycleBin.forEach((item, index) => {
      const nd = item.node;
      const def = NODE_TYPES[nd.type] || NODE_TYPES.image;
      const iconHtml = NODE_ICONS[nd.type] || '';
      const time = new Date(item.deletedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const summary = nd.prompt ? (nd.prompt.length > 30 ? nd.prompt.slice(0, 30) + '…' : nd.prompt) : nd.title;

      const el = document.createElement('div');
      el.className = 'recycle-item';
      el.style.setProperty('--type-color', def.color);
      el.innerHTML = `
        <div class="ri-icon">${iconHtml}</div>
        <div class="ri-body">
          <div class="ri-title">${escapeHtml(nd.title)}</div>
          <div class="ri-meta">
            <span class="ri-type">${def.label}</span>
            <span>·</span>
            <span>${time}</span>
            <span>·</span>
            <span>${item.edges.length} 条连线</span>
          </div>
          <div class="ri-meta" style="margin-top:2px;color:var(--text-2)">${escapeHtml(summary)}</div>
        </div>
        <div class="ri-actions">
          <button class="ri-btn" title="还原" data-action="restore" data-idx="${index}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h7a3 3 0 013 3v0a3 3 0 01-3 3H6"/><path d="M3 8l3-3M3 8l3 3"/></svg>
          </button>
          <button class="ri-btn danger" title="彻底删除" data-action="destroy" data-idx="${index}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9M7 8v3M9 8v3"/></svg>
          </button>
        </div>`;
      list.appendChild(el);
    });

    // 绑定还原/删除按钮
    list.querySelectorAll('.ri-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx);
        if (action === 'restore') restoreFromRecycle(idx);
        else if (action === 'destroy') destroyFromRecycle(idx);
      });
    });
  }
}

// HTML 转义工具
//================ 4g. 占位图生成（避免外部图片依赖） ================
const PLACEHOLDER_CACHE = new Map();

function createPlaceholderDataURL(width, height, seed, label) {
  const key = `${width}x${height}-${seed}-${label || ''}`;
  if (PLACEHOLDER_CACHE.has(key)) return PLACEHOLDER_CACHE.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 基于 seed 生成稳定的色相/饱和度
  const hue = (seed * 137.508) % 360;
  const sat = 22 + (seed % 28);
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, `hsl(${hue}, ${sat}%, 14%)`);
  g.addColorStop(0.45, `hsl(${(hue + 28) % 360}, ${sat}%, 18%)`);
  g.addColorStop(1, `hsl(${(hue + 55) % 360}, ${sat}%, 14%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // 噪点纹理
  for (let i = 0; i < 120; i++) {
    const x = ((seed * (i + 1) * 7) % width);
    const y = ((seed * (i + 1) * 13) % height);
    const a = 0.03 + (i % 6) * 0.008;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // 柔和几何装饰
  ctx.strokeStyle = `hsla(${(hue + 90) % 360}, ${sat}%, 70%, 0.08)`;
  ctx.lineWidth = 1;
  const lines = 3 + (seed % 4);
  for (let i = 0; i < lines; i++) {
    const y = ((height / (lines + 1)) * (i + 1)) + (seed % 7);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 标签文字
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = `500 ${Math.max(10, Math.floor(width / 10))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width / 2, height / 2);
  }

  const url = canvas.toDataURL('image/png');
  PLACEHOLDER_CACHE.set(key, url);
  return url;
}

// 打开/关闭回收站面板
function toggleRecyclePanel(show) {
  const panel = document.getElementById('recyclePanel');
  const overlay = document.getElementById('recycleOverlay');
  if (show === undefined) show = !panel.classList.contains('show');
  if (show) {
    updateRecycleUI();
    panel.classList.add('show');
    overlay.classList.add('show');
  } else {
    panel.classList.remove('show');
    overlay.classList.remove('show');
  }
}

// 从回收站还原节点
function restoreFromRecycle(index) {
  const item = recycleBin[index];
  if (!item) return;

  // 压入历史（批量还原时由调用方统一压栈，避免产生多条撤销记录）
  if (!isBatchRestore) pushHistory();

  const nd = item.node;

  // 如果原 id 已被占用，生成新 id
  let nodeId = nd.id;
  if (workflow.nodes.has(nodeId)) {
    nodeId = `n${nodeIdSeq++}`;
  }

  // 创建节点
  const node = new WorkflowNode(nd.type, nd.x, nd.y);
  node.id = nodeId;
  node.width = nd.width;
  node.height = nd.height;
  node.title = nd.title;
  node.thumb = nd.thumb;
  node.uploadedImage = typeof nd.uploadedImage === 'string' ? nd.uploadedImage : '';
  node.croppedImage = typeof nd.croppedImage === 'string' ? nd.croppedImage : '';
  node.cropMeta = nd.cropMeta ? JSON.parse(JSON.stringify(nd.cropMeta)) : null;
  node.uploadedVideo = typeof nd.uploadedVideo === 'string' ? nd.uploadedVideo : '';
  node.prompt = nd.prompt;
  node.params = { ...nd.params };
  node.refImages = normalizeRefImages(nd.refImages);
  node.charDesc = typeof nd.charDesc === 'string' ? nd.charDesc : '';
      node.stateMeta = copyStateMeta(nd.stateMeta);
      node.failureReason = nd.failureReason || (node.stateMeta && node.stateMeta.failureReason) || nd._lastError || '';
      node._lastError = node.failureReason;
  node.status = nd.status;
  node.previewOnly = !!nd.previewOnly;
  node.previewSourceId = typeof nd.previewSourceId === 'string' ? nd.previewSourceId : '';
  if (node.type === 'videoInput' || node.type === 'image') {
    node.outputsData = computeNodeOutput(node);
  }
  const el = createNodeElement(node);
  nodeLayer.appendChild(el);
  workflow.nodes.set(node.id, node);
  workflow.order.push(node.id);

  // 恢复关联连线（只有两端都存在的才恢复）
  let restoredEdges = 0;
  item.edges.forEach(ed => {
    // 确定连线两端节点 id（可能原 id 被替换）
    const fromId = ed.fromNodeId === nd.id ? nodeId : ed.fromNodeId;
    const toId = ed.toNodeId === nd.id ? nodeId : ed.toNodeId;
    const fromNode = workflow.nodes.get(fromId);
    const toNode = workflow.nodes.get(toId);
    if (fromNode && toNode) {
      // 检查是否已存在相同连线
      let exists = false;
      workflow.edges.forEach(e => {
        if (e.from.node.id === fromId && e.from.port === ed.fromPort &&
            e.to.node.id === toId && e.to.port === ed.toPort) {
          exists = true;
        }
      });
      if (!exists) {
        const edge = new Edge(fromNode, ed.fromPort, toNode, ed.toPort);
        edge.id = ed.id;
        // 确保 edge id 不冲突
        if (workflow.edges.has(edge.id)) {
          edge.id = `e${edgeIdSeq++}`;
        }
        workflow.edges.set(edge.id, edge);
        restoredEdges++;
      }
    }
  });

  // 从回收站移除
  recycleBin.splice(index, 1);

  selectNode(node);
  updateStatusbar();
  updateRecycleUI();
  markEdgesDirty();
  scheduleAutosave();
  showToast(`已还原节点${restoredEdges > 0 ? `及 ${restoredEdges} 条连线` : ''}`, 'success');
}

// 从回收站彻底删除
function destroyFromRecycle(index) {
  const item = recycleBin[index];
  if (!item) return;
  const nd = item.node;
  const typeLabel = (NODE_TYPES[nd.type] || {}).label || nd.type;
  // 二次确认，防止误点击导致永久丢失（与 emptyRecycleBin 的 confirm 风格一致）
  if (!confirm(`彻底删除该【${nd.title}】（${typeLabel}）节点？此操作不可恢复。`)) return;
  recycleBin.splice(index, 1);
  updateRecycleUI();
  scheduleAutosave();
  showToast('已彻底删除', 'danger');
}

// 清空回收站
function emptyRecycleBin() {
  if (recycleBin.length === 0) return;
  recycleBin.length = 0;
  updateRecycleUI();
  scheduleAutosave();
  showToast('回收站已清空', 'info');
}

//================ 5. DOM 引用 ================
const canvasWrap = document.getElementById('canvasWrap');
const nodeLayer = document.getElementById('nodeLayer');
const gridCanvas = document.getElementById('gridCanvas');
const edgeCanvas = document.getElementById('edgeCanvas');
const gridCtx = gridCanvas.getContext('2d');
const edgeCtx = edgeCanvas.getContext('2d');

//================ 6. 构建左侧节点库 ================
function buildSidebar() {
  const list = document.getElementById('sidebarList');
  list.innerHTML = '';

  // 风格预设（一键生成角色设计工作流）：tab 切换（常用/收藏） + 按 category 分组 + chip 标签
  const presetLabel = document.createElement('div');
  presetLabel.className = 'sidebar-section-label preset-toggle';
  presetLabel.textContent = '🎨 风格预设';
  presetLabel.title = '点击折叠 / 展开风格预设';
  const presetCaret = document.createElement('span');
  presetCaret.className = 'preset-caret';
  presetCaret.textContent = '▾';
  presetLabel.appendChild(presetCaret);
  list.appendChild(presetLabel);
  // 折叠容器：包住 tabs + 分组 body；状态持久化
  const presetWrap = document.createElement('div');
  presetWrap.className = 'preset-section';
  try { if (localStorage.getItem('flowcraft-preset-collapsed') === '1') presetWrap.classList.add('collapsed'); } catch (e) {}
  if (presetWrap.classList.contains('collapsed')) presetLabel.classList.add('collapsed');
  list.appendChild(presetWrap);

  // 顶部 tab：常用 / 收藏
  const presetTabs = document.createElement('div');
  presetTabs.className = 'preset-tabs';
  const tabCommon = document.createElement('button');
  tabCommon.type = 'button';
  tabCommon.className = 'preset-tab active';
  tabCommon.textContent = '常用';
  const tabFav = document.createElement('button');
  tabFav.type = 'button';
  tabFav.className = 'preset-tab';
  tabFav.textContent = '收藏';
  presetTabs.appendChild(tabCommon);
  presetTabs.appendChild(tabFav);
  presetWrap.appendChild(presetTabs);

  const presetBody = document.createElement('div');
  presetBody.className = 'preset-body';
  presetWrap.appendChild(presetBody);
  presetLabel.onclick = (e) => {
    e.stopPropagation();
    const collapsed = presetWrap.classList.toggle('collapsed');
    presetLabel.classList.toggle('collapsed', collapsed);
    try { localStorage.setItem('flowcraft-preset-collapsed', collapsed ? '1' : '0'); } catch (err) {}
  };

  // 收藏存储：localStorage 'flowcraft-preset-favs'（数组）
  function getFavs() {
    try { const v = JSON.parse(localStorage.getItem('flowcraft-preset-favs') || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function setFavs(arr) {
    try { localStorage.setItem('flowcraft-preset-favs', JSON.stringify(arr)); } catch (e) {}
  }
  function toggleFav(id) {
    const favs = getFavs();
    const idx = favs.indexOf(id);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(id);
    setFavs(favs);
    renderPresetTab(currentPresetTab);
  }
  // 已应用标记（会话级）：applyStylePreset 时写入
  window.__appliedPresets = window.__appliedPresets || {};

  // 渲染单个 chip（含收藏星标 + 已应用标记）
  function renderPresetChip(preset, row) {
    const wrap = document.createElement('span');
    wrap.className = 'preset-chip-wrap';

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip' + (window.__appliedPresets[preset.id] ? ' preset-chip-applied' : '');
    chip.dataset.presetId = preset.id;
    chip.style.background = preset.color;
    chip.textContent = preset.icon + ' ' + preset.name;
    chip.title = preset.desc + ' · 点击一键应用' + (window.__appliedPresets[preset.id] ? '（已应用过，可再点追加）' : '');
    chip.onclick = (e) => { e.stopPropagation(); applyStylePreset(preset); };
    chip.onmousedown = (e) => e.stopPropagation();
    wrap.appendChild(chip);

    // 收藏星标（hover 显示）
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'preset-chip-fav' + (getFavs().indexOf(preset.id) >= 0 ? ' faved' : '');
    favBtn.textContent = getFavs().indexOf(preset.id) >= 0 ? '★' : '☆';
    favBtn.title = getFavs().indexOf(preset.id) >= 0 ? '取消收藏' : '收藏到「收藏」页';
    favBtn.onclick = (e) => { e.stopPropagation(); toggleFav(preset.id); };
    favBtn.onmousedown = (e) => e.stopPropagation();
    wrap.appendChild(favBtn);

    row.appendChild(wrap);
  }

  let currentPresetTab = 'common';
  function renderPresetTab(tab) {
    currentPresetTab = tab;
    tabCommon.classList.toggle('active', tab === 'common');
    tabFav.classList.toggle('active', tab === 'fav');
    presetBody.innerHTML = '';

    if (tab === 'fav') {
      // 收藏页：只展示收藏的预设
      const favs = getFavs();
      const favPresets = STYLE_PRESETS.filter(p => favs.indexOf(p.id) >= 0);
      if (!favPresets.length) {
        const empty = document.createElement('div');
        empty.className = 'preset-fav-empty';
        empty.textContent = '点击预设上的 ☆ 收藏，这里会展示';
        presetBody.appendChild(empty);
        return;
      }
      const row = document.createElement('div');
      row.className = 'preset-chips-row';
      favPresets.forEach(p => renderPresetChip(p, row));
      presetBody.appendChild(row);
      return;
    }

    // 常用页：按 category 分组（保留原顺序）
    const presetGroups = [];
    const presetGroupIdx = {};
    STYLE_PRESETS.forEach(preset => {
      const cat = preset.category || '其他';
      if (!(cat in presetGroupIdx)) {
        presetGroupIdx[cat] = presetGroups.length;
        presetGroups.push({ name: cat, items: [] });
      }
      presetGroups[presetGroupIdx[cat]].items.push(preset);
    });
    presetGroups.forEach(group => {
      const subLabel = document.createElement('div');
      subLabel.className = 'sidebar-section-label sidebar-section-sub';
      subLabel.textContent = group.name;
      presetBody.appendChild(subLabel);

      const chipRow = document.createElement('div');
      chipRow.className = 'preset-chips-row';
      group.items.forEach(preset => renderPresetChip(preset, chipRow));
      presetBody.appendChild(chipRow);
    });
  }
  tabCommon.onclick = () => renderPresetTab('common');
  tabFav.onclick = () => renderPresetTab('fav');
  renderPresetTab('common');

  // 输入类
  const inputLabel = document.createElement('div');
  inputLabel.className = 'sidebar-section-label';
  inputLabel.textContent = '输入';
  list.appendChild(inputLabel);

  ['image', 'videoInput', 'text', 'lineart'].forEach(type => {
    list.appendChild(createLibraryItem(type));
  });

  // AI 生成类
  const aiLabel = document.createElement('div');
  aiLabel.className = 'sidebar-section-label';
  aiLabel.textContent = 'AI 生成';
  list.appendChild(aiLabel);

  ['aiImage', 'imageEdit', 'aiVideo', 'aiSet'].forEach(type => {
    list.appendChild(createLibraryItem(type));
  });

  // 处理类
  const processLabel = document.createElement('div');
  processLabel.className = 'sidebar-section-label';
  processLabel.textContent = '处理';
  list.appendChild(processLabel);

  ['upscale', 'compare', 'videoBreak', 'reversePrompt', 'material', 'light', 'layout', 'loop'].forEach(type => {
    list.appendChild(createLibraryItem(type));
  });

  // 本地部署
  const localLabel = document.createElement('div');
  localLabel.className = 'sidebar-section-label';
  localLabel.textContent = '本地部署';
  list.appendChild(localLabel);
  list.appendChild(createLibraryItem('comfyui'));

  // 输出类
  const outputLabel = document.createElement('div');
  outputLabel.className = 'sidebar-section-label';
  outputLabel.textContent = '输出';
  list.appendChild(outputLabel);

  list.appendChild(createLibraryItem('save'));

  // 视频生成类 (MoneyPrinterTurbo 画布化)
  const videoLabel = document.createElement('div');
  videoLabel.className = 'sidebar-section-label';
  videoLabel.textContent = '视频生成';
  list.appendChild(videoLabel);

  ['script', 'footage', 'voiceover', 'subtitle', 'bgm', 'compose', 'publish'].forEach(type => {
    list.appendChild(createLibraryItem(type));
  });
}

function createLibraryItem(type) {
  const def = NODE_TYPES[type];
  const item = document.createElement('div');
  item.className = 'node-library-item';
  item.dataset.type = type;
  item.draggable = true;
  item.style.setProperty('--type-color', def.color);
  const semantic = getNodeSemantic(type);
  item.innerHTML = `
    <div class="lib-icon">${NODE_ICONS[type] || ''}</div>
    <div class="lib-text">
      <div class="lib-name-row">
        <div class="lib-name">${def.label}</div>
        <span class="lib-tier-badge ${semantic.className}">${semantic.label}</span>
      </div>
      <div class="lib-desc">${def.desc}</div>
    </div>
  `;
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  });
  return item;
}

function getNodeSemanticTier(type) {
  const fallback = {
    image: 'input',
    videoInput: 'input',
    text: 'input',
    stateList: 'input',
    aiImage: 'production',
    aiVideo: 'demo',
    comfyui: 'production',
  };
  const meta = (window.FlowCraft && window.FlowCraft.nodes && typeof window.FlowCraft.nodes.getNodeMeta === 'function')
    ? window.FlowCraft.nodes.getNodeMeta(type)
    : null;
  return (meta && meta.tier) || fallback[type] || 'demo';
}
function getNodeSemanticLabel(tier) {
  return ({ input: '输入', production: '真实', demo: '演示', stub: '未实现' })[tier] || '演示';
}
function getNodeSemanticClass(tier) {
  return ({ input: 'tier-input', production: 'tier-production', demo: 'tier-demo', stub: 'tier-stub' })[tier] || 'tier-demo';
}
function getNodeSemantic(typeOrNode) {
  const type = typeof typeOrNode === 'string' ? typeOrNode : (typeOrNode && typeOrNode.type) || '';
  const tier = getNodeSemanticTier(type);
  return { tier, label: getNodeSemanticLabel(tier), className: getNodeSemanticClass(tier) };
}
function getNodeResultLabel(mode) {
  return ({ pending: '未运行', real: '真实', demo: '演示', failed: '失败', unimplemented: '未实现' })[mode] || '未运行';
}
function getNodeResultClass(mode) {
  return ({ pending: 'result-pending', real: 'result-real', demo: 'result-demo', failed: 'result-failed', unimplemented: 'result-unimplemented' })[mode] || 'result-pending';
}
function setNodeResultMode(node, mode) {
  if (!node) return;
  node.resultMode = mode || 'pending';
  if (node.el) {
    const pill = node.el.querySelector('.node-result-pill');
    if (pill) {
      pill.className = 'node-result-pill ' + getNodeResultClass(node.resultMode);
      pill.textContent = getNodeResultLabel(node.resultMode);
    }
  }
}
function applyNodeSemanticBadge(node, root) {
  if (!node) return;
  const target = root || node.el;
  const semantic = getNodeSemantic(node);
  node.semanticMode = semantic.tier;
  if (!target) return;
  target.dataset.semanticMode = semantic.tier;
  const pill = target.querySelector('.node-tier-pill');
  if (pill) {
    pill.className = 'node-tier-pill ' + semantic.className;
    pill.textContent = semantic.label;
    pill.title = semantic.label + '节点';
  }
}

//================ 7. 节点 DOM 渲染 ================
// 节点快捷工具按钮（header 浮层内）
function makeNodeToolBtn(title, svgHtml, onclick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'node-tool-btn';
  b.title = title;
  b.innerHTML = svgHtml;
  b.onclick = (e) => { e.stopPropagation(); onclick(); };
  b.onmousedown = (e) => e.stopPropagation();
  return b;
}
const NODE_TOOL_SVGS = {
  info: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v.5"/></svg>',
  download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 14h10"/></svg>',
  upload: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 10V3M5 6l3-3 3 3M3 13h10"/></svg>',
  expand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4"/><path d="M10 10l4 4M6.5 6v3M5 7.5h3"/></svg>',
  crop: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 1v3M1 3h3M13 1v3M12 3h3M3 15v-3M1 13h3M13 15v-3M12 13h3"/><path d="M5 5h6v6H5z"/></svg>',
  rotate: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 2.2v3.1h-3.1"/></svg>',
  gen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M7 2h2l-.5 4h2.5l-1 3h-3l-.5-4H7z"/><circle cx="10" cy="12" r="1.6"/><path d="M3 11l2-1 1-2 1.5 3"/></svg>',
  asset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h4l1.5 2H14v8H2z"/><path d="M8 8v4M6 10h4"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>',
  grid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
};
// 节点元数据摘要行 —— 已禁用（用户要求图片节点极致纯净：彻底无 meta 显示）
function buildNodeMetaLine(node) {
  return '';
}
function getNodeHeaderTitle(node) {
  if (!node) return '';
  if (node.type === 'image') {
    const fileName = node.params && node.params.name ? String(node.params.name).trim() : '';
    return fileName ? ('图片输入 · ' + fileName) : '图片输入';
  }
  if (node.type === 'videoInput') {
    const fileName = node.params && node.params.name ? String(node.params.name).trim() : '';
    return fileName ? ('视频输入 · ' + fileName) : '视频输入';
  }
  if (node.type === 'aiImage') return 'AI 绘图';
  if (node.type === 'imageEdit') return '图片修正';
  if (node.type === 'aiVideo') return 'AI 视频';
  return node.title;
}
// 刷新节点 header 工具/元数据 —— 已禁用为 noop（用户要求"全都取消"）
function refreshNodeHeaderMeta(node, el) {
  const root = el || (node && node.el);
  if (!root) return;
  root.querySelectorAll('.node-tools, .node-meta-line').forEach(x => x.remove());
  applyNodeSemanticBadge(node, root);
  const titleEl = root.querySelector('.node-title-text');
  if (titleEl) {
    const title = getNodeHeaderTitle(node);
    titleEl.textContent = title;
    titleEl.title = title;
  }
  if (node && ['image', 'aiImage', 'imageEdit', 'aiVideo'].includes(node.type)) {
    const tools = buildMediaNodeTools(node);
    if (tools) root.querySelector('.node-header-row').appendChild(tools);
  }
}
// 节点信息（ⓘ 按钮）：弹窗展示完整元数据
function showNodeInfo(node) {
  if (!node) return;
  const def = node.def || {};
  const lines = [];
  lines.push('类型：' + (def.label || node.type));
  lines.push('标题：' + (node.title || '—'));
  lines.push('状态：' + (node.status || 'idle'));
  lines.push('语义：' + getNodeSemanticLabel(getNodeSemanticTier(node.type)));
  lines.push('坐标：(' + Math.round(node.x) + ', ' + Math.round(node.y) + ')');
  const prompt = node.prompt || (node.params && node.params.fields && node.params.fields.prompt) || '';
  if (prompt) lines.push('提示词：' + (prompt.length > 150 ? prompt.slice(0, 150) + '…' : prompt));
  if (node.params) {
    const kv = Object.entries(node.params)
      .filter(([k, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'object' && !String(k).startsWith('__'))
      .map(([k, v]) => k + '=' + v);
    if (kv.length) lines.push('参数：' + kv.slice(0, 10).join(' · '));
  }
  window.alert(lines.join('\n'));
}
// 下载节点图片（⬇ 按钮）
function downloadNode(node) {
  const src = normalizeImageSrc(node.thumb);
  if (!src) { showToast('该节点暂无可下载图片', 'warn'); return; }
  downloadDataUrl(src, (node.title || 'flowcraft-node').replace(/[\\/:*?"<>|]/g, '_') + '.png');
}

function createNodeElement(node) {
  const el = document.createElement('div');
  el.className = 'node';
  if (node.previewOnly) el.classList.add('preview-only-node');
  el.classList.add('node-type-' + node.type); // 类型化 CSS 钩子（image 仍得 node-type-image）
  el.dataset.id = node.id;
  el.dataset.type = node.type;
  el.style.left = node.x + 'px';
  el.style.top = node.y + 'px';
  el.style.zIndex = (++workflow.nextZ).toString();
  el.style.setProperty('--type-color', node.def.color);

  // 标题栏：语义徽章 + 状态 + 工具
  const statusDot = document.createElement('div');
  statusDot.className = 'node-status-dot ' + (node.status || 'idle');
  el.appendChild(statusDot);

  const header = document.createElement('div');
  header.className = 'node-header';
  const row = document.createElement('div');
  row.className = 'node-header-row';
  // image-only 模式：节点框内只保留媒体内容；标题/语义/状态徽标浮在框外上方
  // 统一给媒体输入/预览节点采用同一套上方信息栏样式
  if (['aiImage', 'imageEdit', 'aiVideo', 'image', 'videoInput', 'text', 'stateList', 'lineart', 'upscale'].includes(node.type)) el.classList.add('node--image-only');

  const titleText = document.createElement('div');
  titleText.className = 'node-title-text';
  titleText.textContent = getNodeHeaderTitle(node);
  titleText.title = titleText.textContent;

  const semantic = getNodeSemantic(node);
  const tierPill = document.createElement('div');
  tierPill.className = 'node-tier-pill ' + semantic.className;
  tierPill.textContent = semantic.label;
  if (node.type === 'videoInput') tierPill.hidden = true;

  const resultPill = document.createElement('div');
  resultPill.className = 'node-result-pill ' + getNodeResultClass(node.resultMode || 'pending');
  resultPill.textContent = getNodeResultLabel(node.resultMode || 'pending');
  if (node.type === 'videoInput' || node.type === 'image') resultPill.hidden = true;

  const statusPill = document.createElement('div');
  statusPill.className = 'node-status-pill idle';
  statusPill.textContent = '待运行';
  if (node.type === 'videoInput' || node.type === 'image') statusPill.hidden = true;
  if (node.type === 'image') tierPill.hidden = true;

  // 关闭 X 已移除：外置标题栏上极易误触；删除走 Delete 键 / 右键菜单
  row.appendChild(titleText);
  row.appendChild(tierPill);
  row.appendChild(resultPill);
  row.appendChild(statusPill);
  header.appendChild(row);
  el.appendChild(header);

  // 设置宽度与最小高度（可自由调节）
  el.style.width = node.width + 'px';
  el.style.minHeight = (node.height || 120) + 'px';

  // 构建 body
  buildNodeBody(el, node);

  // 底部进度条（运行态显示）
  const progressBar = document.createElement('div');
  progressBar.className = 'node-progress-bar';
  el.appendChild(progressBar);

  // 缩放手柄 (右下角，宽高自由调节)
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'node-resize-handle';
  resizeHandle.title = '拖拽调节节点尺寸';
  resizeHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    startNodeResize(e, node);
  });
  el.appendChild(resizeHandle);

  // 节点拖拽
  el.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, input, textarea, select, .node-port')) return;
    if (e.button !== 0) return;
    // 已处于多选中的节点：保持多选，整体拖动（不再自动收敛为单选）
    if (!workflow.selection.has(node.id)) {
      selectNode(node, { showComposer: false }); // 未选中 → 先单选再拖动；点击完成后再显示参数
      if (node.type === 'videoInput') node.__settingsCollapsed = false;
    }
    startNodeDrag(e, node);
  });

  el.addEventListener('click', (e) => {
    if (e.button && e.button !== 0) return;
    if (e.target.closest('button, input, textarea, select, .node-port, .node-resize-handle')) return;
    // 仅在左键点击完成后打开下方参数面板；拖拽不会触发 click。
    if (isComposerType(node)) {
      e.stopPropagation();
      if (node.type === 'videoInput') node.__settingsCollapsed = false;
      showNodeComposer(node);
    }
  });

  node.el = el;
  return el;
}

// 数字转中文序号（用于多图输入标注：图一、图二…）
function cnNum(n) {
  const map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return n <= 10 ? map[n] : String(n);
}

// 节点底部图片预览：提取节点中可用的图片 URL
function getNodePreviewImage(node) {
  const ownThumb = getNodeDisplayImageSource(node);
  if (ownThumb) return ownThumb;
  const outData = node.outputsData || [];
  for (const payload of outData) {
    const src = payload && payload.type === 'image' ? normalizeImageSrc(payload.value) : null;
    if (src) {
      return src;
    }
  }
  const inData = node.inputsData || [];
  for (const payload of inData) {
    const src = payload && payload.type === 'image' ? normalizeImageSrc(payload.value) : null;
    if (src) {
      return src;
    }
  }
  return null;
}

// 图片节点当前生效图：裁剪图 > 缩略图 > 原图
function getNodeDisplayImageSource(node) {
  if (!node) return null;
  const cropped = normalizeImageSrc(node.croppedImage);
  if (cropped) return cropped;
  // 优先原图 uploadedImage：显示/查看大图/导出/裁剪都用原图，避免 720px 缩略 thumb 造成的质量损失；
  // thumb 仅作轻量占位与素材库缩略。uploadedImage 缺失（生成节点/旧数据）时回退 thumb。
  const uploaded = normalizeImageSrc(node.uploadedImage);
  if (uploaded) return uploaded;
  const thumb = normalizeImageSrc(node.thumb);
  if (thumb) return thumb;
  return null;
}

// 图片裁剪入口：仅 image 节点显示
function buildImageNodeTools(node) {
  if (!node || node.type !== 'image') return null;
  const tools = document.createElement('div');
  tools.className = 'node-tools';
  const src = getNodeDisplayImageSource(node);
  const uploadBtn = makeNodeToolBtn(src ? '更换图片' : '上传图片', NODE_TOOL_SVGS.upload, () => openImageFilePicker(node));
  uploadBtn.title = src ? '更换图片' : '上传图片';
  tools.appendChild(uploadBtn);

  const viewBtn = makeNodeToolBtn('查看大图', NODE_TOOL_SVGS.expand, () => { if (src) openImageLightbox(src); });
  viewBtn.disabled = !src;
  viewBtn.title = src ? '查看大图' : '暂无图片可查看';
  tools.appendChild(viewBtn);

  const cropBtn = makeNodeToolBtn('裁剪图片', NODE_TOOL_SVGS.crop, () => openImageCropModal(node));
  cropBtn.classList.add('node-crop-btn');
  cropBtn.disabled = !src;
  cropBtn.title = src ? '裁剪图片' : '裁剪图片（请先上传图片）';
  tools.appendChild(cropBtn);

  const downloadBtn = makeNodeToolBtn('下载图片', NODE_TOOL_SVGS.download, () => { if (src) downloadNode(node); });
  downloadBtn.disabled = !src;
  downloadBtn.title = src ? '下载图片' : '暂无图片可下载';
  tools.appendChild(downloadBtn);
  return tools;
}

// 统一节点工具栏：image/aiImage/imageEdit/aiVideo 共用，挂在外置标题栏内（悬停/选中浮现）
function buildMediaNodeTools(node) {
  if (!node) return null;
  const t = node.type;
  const isImgLike = t === 'image' || t === 'aiImage' || t === 'imageEdit';
  if (!isImgLike && t !== 'aiVideo') return null;
  const tools = document.createElement('div');
  tools.className = 'node-tools';
  const src = getNodeDisplayImageSource(node);
  if (isImgLike) {
    tools.appendChild(makeNodeToolBtn(src ? '更换图片' : '上传图片', NODE_TOOL_SVGS.upload, () => openImageFilePicker(node)));
  } else {
    tools.appendChild(makeNodeToolBtn('更换视频', NODE_TOOL_SVGS.upload, () => openVideoFilePicker(node)));
  }
  const viewBtn = makeNodeToolBtn('查看大图', NODE_TOOL_SVGS.expand, () => { if (src) openImageLightbox(src); });
  viewBtn.disabled = !src;
  viewBtn.title = src ? '查看大图' : '暂无图片可查看';
  tools.appendChild(viewBtn);
  if (t === 'image') {
    const cropBtn = makeNodeToolBtn('裁剪图片', NODE_TOOL_SVGS.crop, () => openImageCropModal(node));
    cropBtn.disabled = !src;
    cropBtn.title = src ? '裁剪图片' : '裁剪图片（请先上传图片）';
    tools.appendChild(cropBtn);
    const rotBtn = makeNodeToolBtn('旋转图片', NODE_TOOL_SVGS.rotate, () => openImageRotateModal(node));
    rotBtn.disabled = !src;
    rotBtn.title = src ? '旋转图片（90° 步进 + 自由角度）' : '旋转图片（请先上传图片）';
    tools.appendChild(rotBtn);
  }
  const dlBtn = makeNodeToolBtn('下载图片', NODE_TOOL_SVGS.download, () => { if (src) downloadNode(node); });
  dlBtn.disabled = !src;
  dlBtn.title = src ? '下载图片' : '暂无图片可下载';
  tools.appendChild(dlBtn);
  const assetBtn = makeNodeToolBtn('存资产', NODE_TOOL_SVGS.asset, () => saveNodeImageAsAsset(node));
  assetBtn.disabled = !src;
  assetBtn.title = src ? '存资产（存入素材库，可以 <<<名称>>> 引用）' : '存资产（暂无图片可存）';
  tools.appendChild(assetBtn);
  if (t !== 'image') {
    tools.appendChild(makeNodeToolBtn('复制提示词', NODE_TOOL_SVGS.copy, () => copyNodePrompt(node)));
  }
  if (isImgLike && t !== 'image') {
    const gridBtn = makeNodeToolBtn('宫格切分', NODE_TOOL_SVGS.grid, () => openGridSplitPop(node, gridBtn));
    gridBtn.disabled = !src;
    gridBtn.title = src ? '宫格切分（2x2/3x3/4x4/自定义）' : '暂无图片可切分';
    tools.appendChild(gridBtn);
  }
  return tools;
}

function copyTextThen(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { showToast('复制失败', 'danger'); }
  ta.remove();
}
function copyNodePrompt(node) {
  const text = String(node.effectivePrompt || node.prompt || node.charDesc || '');
  if (!text.trim()) { showToast('当前节点没有提示词可复制', 'info'); return; }
  const done = () => showToast('已复制提示词（' + text.length + ' 字）', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => copyTextThen(text, done));
  } else {
    copyTextThen(text, done);
  }
}

function saveNodeImageAsAsset(node) {
  const src = getNodeDisplayImageSource(node);
  if (!src || !/^data:/i.test(src)) { showToast('存资产需要本地图像，当前图源不支持', 'warn'); return; }
  const all = loadGlobalAssetImages();
  const base = String(node.title || getNodeHeaderTitle(node) || '资产').trim().replace(/\s+/g, '-') || '资产';
  let key = base;
  let i = 2;
  while (all[key]) { key = base + '-' + i; i++; }
  saveGlobalAssetImage(key, { src: src, nodeTitle: getNodeHeaderTitle(node), label: '产出', kind: node.type });
  showToast('已存入素材库 <<<' + key + '>>>', 'success');
  try { updateAssetPanel(); } catch (e) {}
}

// —— 宫格切分：把一张宫格图切成 rows×cols 个独立图片节点 ——
let _gridPopClean = null;
function closeGridSplitPop() {
  const p = document.getElementById('gridSplitPop');
  if (p) p.remove();
  if (_gridPopClean) { _gridPopClean(); _gridPopClean = null; }
}
function openGridSplitPop(node, anchor) {
  closeGridSplitPop();
  const pop = document.createElement('div');
  pop.id = 'gridSplitPop';
  pop.className = 'grid-split-pop';
  const title = document.createElement('div');
  title.className = 'grid-split-title';
  title.textContent = '宫格切分';
  pop.appendChild(title);
  const row = document.createElement('div');
  row.className = 'grid-split-presets';
  [[2, 2], [3, 3], [4, 4]].forEach(function(rc) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grid-split-preset';
    b.textContent = rc[0] + 'x' + rc[1];
    b.onclick = (e) => { e.stopPropagation(); closeGridSplitPop(); splitNodeImageToGrid(node, rc[0], rc[1]); };
    b.onmousedown = (e) => e.stopPropagation();
    row.appendChild(b);
  });
  pop.appendChild(row);
  const custom = document.createElement('div');
  custom.className = 'grid-split-custom';
  const ri = document.createElement('input');
  ri.type = 'number'; ri.min = '1'; ri.max = '8'; ri.value = '2'; ri.className = 'grid-split-num';
  const ci = ri.cloneNode(false);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'grid-split-go';
  go.textContent = '切分';
  go.onclick = (e) => {
    e.stopPropagation();
    const r = Math.max(1, Math.min(8, parseInt(ri.value, 10) || 1));
    const c = Math.max(1, Math.min(8, parseInt(ci.value, 10) || 1));
    closeGridSplitPop();
    splitNodeImageToGrid(node, r, c);
  };
  custom.appendChild(ri);
  custom.appendChild(document.createTextNode('×'));
  custom.appendChild(ci);
  custom.appendChild(go);
  pop.appendChild(custom);
  pop.onmousedown = (e) => e.stopPropagation();
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeGridSplitPop(); } };
  const onOutside = (e) => { if (!pop.contains(e.target)) closeGridSplitPop(); };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onOutside, true);
  _gridPopClean = () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onOutside, true);
  };
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(window.innerWidth - 220, r.left - 40)) + 'px';
  pop.style.top = (r.bottom + 6) + 'px';
}
async function splitNodeImageToGrid(node, rows, cols) {
  const src = getNodeDisplayImageSource(node);
  if (!src) { showToast('暂无图片可切分', 'info'); return; }
  let imgSrc = src;
  if (!/^data:/i.test(src)) {
    try {
      const blob = await (await fetch(src)).blob();
      imgSrc = URL.createObjectURL(blob);
    } catch (e) { showToast('切分失败：图源跨域不可读', 'danger'); return; }
  }
  const img = await new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = imgSrc;
  });
  if (!img || !img.naturalWidth) { showToast('切分失败：图片加载失败', 'danger'); return; }
  const W = img.naturalWidth, H = img.naturalHeight;
  const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
  if (cw < 8 || ch < 8) { showToast('切分失败：图片尺寸太小', 'warn'); return; }
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      cv.getContext('2d').drawImage(img, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
      cells.push(cv.toDataURL('image/png'));
    }
  }
  const baseX = Math.round(node.x + (node.width || 280) + 60);
  const baseY = Math.round(node.y);
  // 全同步确定性布局：创建时即定 ratio/宽/高并跳过异步 probe-fit，排布无竞态
  const CARD_W = 240;
  const GAP = 12;
  const madeNodes = [];
  const heights = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r * cols + c];
      const n = addNode('image', baseX, baseY, cell);
      n.title = (node.title || '切分') + ' ' + (r + 1) + '-' + (c + 1);
      n.ratio = cw / ch;
      n._fitProbed = true;
      n._fitThumbSrc = cell; // 标记已 probe，跳过异步重排，保持布局确定
      n.width = CARD_W;
      n.el.style.width = CARD_W + 'px';
      buildNodeBody(n.el, n);
      const nr = n.el.getBoundingClientRect();
      const zoomF = nr.width > 0 ? nr.width / CARD_W : 1;
      const heroEl = n.el.querySelector('.node-hero');
      const heroH = (heroEl ? heroEl.getBoundingClientRect().height : CARD_W * ch / cw) / zoomF;
      n.height = Math.max(96, Math.round(heroH + (nr.height / zoomF - heroH)));
      n.el.style.minHeight = n.height + 'px';
      madeNodes.push(n);
      heights.push(n.height);
    }
  }
  const rowH = [];
  for (let r = 0; r < rows; r++) rowH[r] = Math.max.apply(null, heights.slice(r * cols, r * cols + cols));
  const xs = [];
  let accX = baseX;
  for (let c = 0; c < cols; c++) { xs[c] = Math.round(accX); accX += CARD_W + GAP; }
  const ys = [];
  let accY = baseY;
  for (let r = 0; r < rows; r++) { ys[r] = Math.round(accY); accY += rowH[r] + GAP; }
  madeNodes.forEach(function(n, i) {
    const r = Math.floor(i / cols), c = i % cols;
    n.x = xs[c];
    n.y = ys[r];
    n.el.style.left = n.x + 'px';
    n.el.style.top = n.y + 'px';
  });
  markEdgesDirty();
  renderMinimap();
  showToast('已切分为 ' + madeNodes.length + ' 个图片节点', 'success');
  scheduleAutosave();
}

function renderImagePreviewSection(el, node) {
  const previewTypes = ['image', 'aiVideo', 'upscale', 'compare', 'aiSet', 'material', 'light', 'layout', 'lineart', 'videoBreak'];
  if (!previewTypes.includes(node.type)) return;

  const def = node.def;
  const inData = node.inputsData || [];

  // 仅输出模式（线稿/超清）：只显示运行后生成的图片，清爽无多余信息
  const OUTPUT_ONLY_TYPES = ['lineart', 'upscale'];
  if (OUTPUT_ONLY_TYPES.includes(node.type)) {
    const gen = (Array.isArray(node._galleryImages) && node._galleryImages.length)
      ? node._galleryImages
      : ((node.outputsData || []).filter(p => p && p.type === 'image' && normalizeImageSrc(p.value)).map(p => p.value));
    const cleanArea = document.createElement('div');
    cleanArea.className = 'node-preview-area clean-output';
    if (gen.length) {
      if (gen.length > 1) {
        const grid = document.createElement('div');
        grid.className = 'node-preview-grid';
        gen.forEach((src, i) => {
          const cell = document.createElement('div');
          cell.className = 'node-preview-cell';
          const gimg = document.createElement('img');
          gimg.className = 'node-preview-img ratio-fit';
          gimg.src = normalizeImageSrc(src) || '';
          gimg.alt = '生成 ' + (i + 1);
          // 预览图不能截断节点事件：左键单击由节点统一打开下方 Composer，右键仍由画布菜单处理。
          gimg.draggable = false;
          gimg.ondragstart = (e) => e.preventDefault();
          cell.appendChild(gimg);
          grid.appendChild(cell);
        });
        cleanArea.appendChild(grid);
      } else {
        const simg = document.createElement('img');
        simg.className = 'node-preview-img ratio-fit';
        simg.src = normalizeImageSrc(gen[0]) || '';
        simg.alt = '生成结果';
        // 预览图不能截断节点事件：左键单击由节点统一打开下方 Composer，右键仍由画布菜单处理。
        simg.draggable = false;
        simg.ondragstart = (e) => e.preventDefault();
        cleanArea.appendChild(simg);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'node-clean-empty';
      empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="28" height="28"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M2 10l3.5-3.5L8 9l2.5-2.5L14 10"/></svg>';
      cleanArea.appendChild(empty);
    }
    el.appendChild(cleanArea);
    return;
  }

  // AI 绘图节点优先展示逐张生成的原图（带下载按钮）；单张时走下方单图比例适配
  const gallery = (node.type === 'aiImage' && Array.isArray(node._galleryImages) && node._galleryImages.length > 1)
    ? node._galleryImages
    : null;

  // 收集需要预览的图片：优先所有上游 image 输入，按端口顺序标注 图一/图二…
  const imgs = [];
  (def.inputs || []).forEach((p, i) => {
    const pl = inData[i];
    const src = pl && pl.type === 'image' ? normalizeImageSrc(pl.value) : null;
    if (src) {
      imgs.push({ src: src, cap: '图' + cnNum(imgs.length + 1) });
    }
  });

  const area = document.createElement('div');
  area.className = 'node-preview-area';
  if (node.type === 'image') area.classList.add('image-input-preview');

  // 顶部标签：画廊（多张原图）优先
  const label = document.createElement('div');
  label.className = 'node-preview-label';
  const totalCount = gallery ? gallery.length : imgs.length;
  label.textContent = '图片预览' + (totalCount > 1 ? '（' + totalCount + ' 张）' : '');
  if (node.type === 'image') label.hidden = true;
  area.appendChild(label);

  // AI 绘图多张原图：每张独立可下载
  if (gallery) {
    const grid = document.createElement('div');
    grid.className = 'node-preview-grid';
    gallery.forEach((src, idx) => {
      const cell = document.createElement('div');
      cell.className = 'node-preview-cell';
      const img = document.createElement('img');
      img.className = 'node-preview-img';
      img.src = normalizeImageSrc(src) || '';
      img.alt = '图' + (idx + 1);
      img.onmousedown = (e) => e.stopPropagation();
      img.onclick = (e) => { e.stopPropagation(); }; // 查看大图走右键菜单
      cell.appendChild(img);

      // 下载按钮（hover 显示）+ 编号
      const cap = document.createElement('span');
      cap.className = 'node-preview-cap';
      cap.textContent = '图' + (idx + 1);
      cell.appendChild(cap);

      const dl = document.createElement('button');
      dl.className = 'node-preview-dl';
      dl.type = 'button';
      dl.title = '保存为 PNG';
      dl.textContent = '⤓';
      dl.onmousedown = (e) => e.stopPropagation();
      dl.onclick = function(e) {
        e.stopPropagation();
        var safeTitle = String(node.title || 'flowcraft').replace(/[\\/:*?"<>|]/g, '_');
        downloadDataURL(src, safeTitle + '_图' + (idx + 1) + '.png');
      };
      cell.appendChild(dl);
      grid.appendChild(cell);
    });
    area.appendChild(grid);
    el.appendChild(area);
    return;
  }

  // AI 绘图节点：只展示生成结果，不在底部重复渲染预览区
  if (node.type === 'aiImage' || node.type === 'imageEdit') {
    const src = (Array.isArray(node._galleryImages) && node._galleryImages.length > 0 && normalizeImageSrc(node._galleryImages[0]))
      || normalizeImageSrc(node.thumb);
    if (src) {
      const wrap = document.createElement('div');
      wrap.className = 'node-image-input-hero ai-image-hero';
      const img = document.createElement('img');
      img.className = 'node-image-input-img';
      img.src = normalizeImageSrc(src) || '';
      img.alt = 'AI 绘图结果';
      img.onmousedown = (e) => e.stopPropagation();
      img.ondblclick = (e) => {
        e.stopPropagation();
        openReferenceImagePicker(node);
      };
      wrap.appendChild(img);
      wrap.onmousedown = (e) => e.stopPropagation();
      area.appendChild(wrap);
      el.appendChild(area);
      return;
    }
  }

  // 其它节点（image / 上游参考图）：保留原有逻辑
  // 无上游输入图时，回退显示节点自身缩略图
  // 原图优先（cropped > uploadedImage > thumb），修复 image 节点显示 720 缩略图造成的压缩
  const ownThumb = getNodeDisplayImageSource(node);
  if (imgs.length === 0 && ownThumb) {
    imgs.push({ src: ownThumb, cap: '本图' });
  }

  // 图片输入节点：不再走单独的“图片预览区”大块结构，直接复用视频节点那套 hero 卡片。
  if (node.type === 'image') {
    const wrap = document.createElement('div');
    wrap.className = 'node-image-input-hero';

    if (imgs.length > 0) {
      const img = document.createElement('img');
      img.className = 'node-image-input-img';
      img.src = normalizeImageSrc(imgs[0].src) || '';
      img.alt = imgs[0].cap || '图片输入';
      img.onclick = (e) => { e.stopPropagation(); }; // 查看大图走右键菜单
      wrap.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.className = 'node-empty-state';
      empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="34" height="34"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M2 10l3.5-3.5L8 9l2.5-2.5L14 10"/></svg>';
      const label = document.createElement('span');
      label.textContent = '空图片节点';
      empty.appendChild(label);
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'node-empty-action';
      action.textContent = '上传图片';
      action.onclick = (e) => { e.stopPropagation(); openImageFilePicker(node); };
      empty.appendChild(action);
      wrap.appendChild(empty);
    }

    area.appendChild(wrap);
    el.appendChild(area);
    return;
  }

  if (imgs.length === 1) {
    // 单图预览：完整呈现，可随节点尺寸自适应；有 node.ratio 时按原图比例显示（不留白、不裁切）
    const img = document.createElement('img');
    img.className = 'node-preview-img' + (node.ratio ? ' ratio-fit' : '');
    img.src = imgs[0].src;
    img.alt = imgs[0].cap;
    if (node.ratio) img.style.aspectRatio = '1 / ' + (1 / node.ratio); // aspect-ratio: 宽 / 高
    img.onmousedown = (e) => e.stopPropagation();
    img.onclick = (e) => { e.stopPropagation(); }; // 查看大图走右键菜单
    area.appendChild(img);
  } else if (imgs.length > 1) {
    const grid = document.createElement('div');
    grid.className = 'node-preview-grid';
    imgs.forEach(it => {
      const cell = document.createElement('div');
      cell.className = 'node-preview-cell';
      const img = document.createElement('img');
      img.className = 'node-preview-img';
      img.src = normalizeImageSrc(it.src) || '';
      img.alt = it.cap;
      img.onmousedown = (e) => e.stopPropagation();
      img.onclick = (e) => { e.stopPropagation(); }; // 查看大图走右键菜单
      cell.appendChild(img);
      const cap = document.createElement('span');
      cap.className = 'node-preview-cap';
      cap.textContent = it.cap;
      cell.appendChild(cap);
      grid.appendChild(cell);
    });
    area.appendChild(grid);
  } else {
    const empty = document.createElement('div');
    empty.className = 'node-preview-placeholder';
    empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M2 10l3.5-3.5L8 9l2.5-2.5L14 10"/></svg>运行后生成图片预览';
    area.appendChild(empty);
  }

  el.appendChild(area);
}

// 下载 dataURL 为文件（自动识别 png/jpeg）
function downloadDataURL(dataURL, filename) {
  try {
    var a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    showToast('下载失败：' + (e && e.message || e), 'danger');
  }
}

// 收集保存节点「实时」输入：即使工作流尚未运行，也尝试从已连接的上游节点取值
// （图片类节点取 node.thumb；文本类节点取 node.prompt / params.script 等），
// 避免"连了线但没点运行 → 预览空白、保存无反应"的问题。
const SAVE_IMAGE_SRC = ['image', 'aiImage', 'upscale', 'lineart', 'aiSet', 'material', 'light', 'layout', 'videoBreak'];
const SAVE_TEXT_SRC = ['text', 'script', 'subtitle'];
function collectSaveInputs(node) {
  const def = node.def;
  const inputs = def.inputs || [];
  const result = inputs.map(() => null);
  [...workflow.edges.values()].forEach(e => {
    if (e.to.node === node) {
      const src = e.from.node;
      let payload = (src.outputsData && src.outputsData[e.from.port]) || null;
      if (!payload && src) {
        // 回退：上游尚未运行，取其当前已有产出
        if (SAVE_IMAGE_SRC.includes(src.type) && src.thumb && /^data:image\//.test(src.thumb)) {
          payload = { type: 'image', value: src.thumb };
        } else if (SAVE_TEXT_SRC.includes(src.type)) {
          let t = '';
          if (src.type === 'text') t = nodeFullText(src).trim();
          else if (src.type === 'script') t = (src.params && src.params.script || '').trim();
          else if (src.type === 'subtitle') t = (src.params && src.params.lines || []).map(l => (l && l.text) || '').join(' / ');
          if (t) payload = { type: 'text', value: t };
        }
      }
      result[e.to.port] = payload;
    }
  });
  return result;
}

// 执行保存节点：把输入的图片/文本下载到本地
// 图片下载：data: 直接存；http(s) 先 fetch→blob 再存（跨域失败降级新标签页打开）
function downloadImageAny(src, name) {
  if (/^data:/i.test(src)) {
    try { downloadDataURL(src, name); } catch (e) {}
    return Promise.resolve(true);
  }
  return fetch(src).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.blob();
  }).then(function(b) {
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
    return true;
  }).catch(function() {
    try {
      const a = document.createElement('a');
      a.href = src; a.download = name; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    } catch (e) { return false; }
  });
}

async function runSaveNode(node) {
  // 优先：上游 AI 绘图节点产出多张原图（_galleryImages）→ 逐张分开保存
  let galleryImgs = [];
  [...workflow.edges.values()].forEach(e => {
    if (e.to.node === node) {
      const src = e.from.node;
      if (src && Array.isArray(src._galleryImages) && src._galleryImages.length > 0) {
        galleryImgs = src._galleryImages;
      }
    }
  });

  let filename = String(node.params.filename || node.title || 'flowcraft').trim().replace(/[\\/:*?"<>|]/g, '_');
  if (!filename) filename = 'flowcraft';

  // 多张原图：逐张下载（图1 / 图2 ...），避免把 4 张拼成一张
  if (galleryImgs.length > 1) {
    await Promise.all(galleryImgs.map((src, idx) => downloadImageAny(src, filename + '_' + (idx + 1) + '.png')));
    showToast('已保存 ' + galleryImgs.length + ' 张图片（逐张分开）', 'success');
    node.status = 'done';
    return;
  }

  const inData = collectSaveInputs(node);
  const imgIn = inData.find(d => d && d.type === 'image' && typeof d.value === 'string');
  const textIn = inData.find(d => d && d.type === 'text' && typeof d.value === 'string');
  const videoIn = inData.find(d => d && d.type === 'video' && typeof d.value === 'string');

  if (imgIn && typeof imgIn.value === 'string') {
    const m = String(imgIn.value).match(/data:image\/(\w+);/i);
    const ext = (m && m[1]) ? m[1] : 'png';
    await downloadImageAny(imgIn.value, filename + '.' + ext);
    showToast('已保存图片：' + filename + '.' + ext, 'success');
    node.status = 'done';
  } else if (textIn) {
    const text = String(textIn.value).trim();
    if (!text || text === '(空文本)') {
      showToast('没有可保存的文本内容', 'warn');
      node.status = 'error';
    } else {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename + '.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('已保存文本：' + filename + '.txt', 'success');
      node.status = 'done';
    }
  } else if (videoIn) {
    // 视频保存：远程 URL 或 data URL 均尽力下载（跨域 URL 浏览器可能忽略 download 属性，降级为导航）
    showToast('已保存视频：' + filename + '.mp4', 'success');
    node.status = 'done'; // 先置成功，避免跨域下载导航打断状态
    try {
      const vu = videoIn.value;
      if (/^data:/i.test(vu)) {
        downloadDataURL(vu, filename + '.mp4');
      } else {
        const a = document.createElement('a');
        a.href = vu; a.download = filename + '.mp4';
        a.target = '_blank'; a.rel = 'noopener'; // 跨域 URL 忽略 download 属性，新标签页打开避免导航走画布
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch (e) { /* 下载失败不影响节点成功态（资产已生成）*/ }
  } else {
    showToast('没有可保存的内容，请先连接图片或文本输入', 'warn');
    node.status = 'error';
  }
}

// —— 提示词库弹窗 ——
let _promptLibState = { node: null, el: null, cat: '常用', pop: null, items: [] };

function closePromptLibrary() {
  if (_promptLibState.pop && _promptLibState.pop.parentNode) {
    _promptLibState.pop.parentNode.removeChild(_promptLibState.pop);
  }
  _promptLibState.pop = null;
}

function openPromptLibrary(node, el, btn) {
  closePromptLibrary();
  const FORM_TABS = ['🎬 导演模板', '🧬 角色设定'];
  const cats = FORM_TABS.concat(Object.keys(PROMPT_LIBRARY));
  const pop = document.createElement('div');
  pop.className = 'prompt-lib-pop';
  pop.innerHTML =
    '<div class="prompt-lib-search"><input type="text" placeholder="搜索提示词…" /></div>' +
    '<div class="prompt-lib-tabs"></div>' +
    '<div class="prompt-lib-list"></div>' +
    '<div class="prompt-lib-foot"><span class="prompt-lib-count"></span>' +
    '<button class="prompt-lib-clear" type="button">清空提示词</button></div>';
  document.body.appendChild(pop);

  const searchInput = pop.querySelector('.prompt-lib-search input');
  const tabsEl = pop.querySelector('.prompt-lib-tabs');
  const listEl = pop.querySelector('.prompt-lib-list');
  const countEl = pop.querySelector('.prompt-lib-count');

  _promptLibState = { node: node, el: el, cat: cats[0], pop: pop, items: [] };
  searchInput.style.display = 'none';

  function renderList(q) {
    if (_promptLibState.cat === '🎬 导演模板') { renderDirectorForm(); return; }
    if (_promptLibState.cat === '🧬 角色设定') { renderCharacterForm(); return; }
    listEl.style.display = '';
    const kw = (q || '').trim();
    let words;
    if (kw) {
      words = [];
      // 只在真实词库分类中搜索（跳过表单型标签，否则会取到 undefined）
      Object.keys(PROMPT_LIBRARY).forEach(c => PROMPT_LIBRARY[c].forEach(w => { if (w.includes(kw)) words.push(w); }));
    } else {
      words = PROMPT_LIBRARY[_promptLibState.cat];
    }
    _promptLibState.items = words;
    listEl.innerHTML = '';
    if (!words.length) {
      const e = document.createElement('div');
      e.className = 'prompt-lib-empty';
      e.textContent = '没有匹配的提示词';
      listEl.appendChild(e);
    } else {
      words.forEach(w => {
        const it = document.createElement('div');
        it.className = 'prompt-lib-item';
        it.textContent = w;
        it.onclick = () => insertPromptWord(w);
        listEl.appendChild(it);
      });
    }
    countEl.textContent = '共 ' + words.length + ' 条';
  }

  function insertPromptWord(w) {
    const n = _promptLibState.node;
    n.prompt = (n.prompt ? n.prompt + '，' : '') + w;
    const ta = _promptLibState.el.querySelector('.node-textarea');
    if (ta) ta.value = n.prompt;
    scheduleAutosave();
  }

  cats.forEach(c => {
    const t = document.createElement('div');
    t.className = 'prompt-lib-tab' + (c === _promptLibState.cat ? ' active' : '');
    t.textContent = c;
    t.onclick = () => {
      _promptLibState.cat = c;
      tabsEl.querySelectorAll('.prompt-lib-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      searchInput.style.display = (FORM_TABS.indexOf(c) >= 0) ? 'none' : '';
      renderList(searchInput.value);
    };
    tabsEl.appendChild(t);
  });

  searchInput.oninput = (e) => { renderList(e.target.value); };
  pop.querySelector('.prompt-lib-clear').onclick = () => {
    const n = _promptLibState.node;
    n.prompt = '';
    const ta = _promptLibState.el.querySelector('.node-textarea');
    if (ta) ta.value = '';
    scheduleAutosave();
  };

  // 阻止冒泡，避免触发画布拖拽/缩放
  pop.onmousedown = (e) => e.stopPropagation();

  // 定位（贴着按钮；优先下方，空间不足则翻转到上方；始终保证完整可见不被遮挡）
  const r = btn.getBoundingClientRect();
  const pw = 340, ph = 440;
  const M = 10;
  let left = r.left;
  const spaceBelow = window.innerHeight - r.bottom - M;
  const spaceAbove = r.top - M;
  let top = (spaceBelow >= ph || spaceBelow >= spaceAbove)
    ? r.bottom + 6
    : r.top - ph - 6;
  // 边界钳制：绝不超出视口，确保分类行与列表完整显示
  if (left + pw > window.innerWidth - M) left = window.innerWidth - pw - M;
  if (left < M) left = M;
  if (top < M) top = M;
  if (top + ph > window.innerHeight - M) top = window.innerHeight - ph - M;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';

  renderList('');
  setTimeout(() => searchInput.focus(), 0);
}

// —— 导演模板：多镜头序列提示词生成器（蒸馏自 Hell Grind 方法论）——
function buildDirectorPrompt(v) {
  const dur = (v && v.duration) || '15 SECONDS';
  const aspect = (v && v.aspect) || '21:9';
  const res = (v && v.resolution) || '8K';
  const fps = (v && v.fps) || '60fps';
  const cuts = (v && v.cuts) || 'hard cuts only';
  const n = (v && v.shots) || 6;
  const style = ((v && v.style) || '').trim();
  const title = ((v && v.title) || '').trim();
  const summary = ((v && v.summary) || '').trim();
  const rules = ((v && v.rules) || '').split('\n').map(s => s.trim()).filter(Boolean);
  const shots = ((v && v.shotsText) || '').split('\n').map(s => s.trim()).filter(Boolean);
  const anchor = ((v && v.anchor) || '').trim();
  const refs = ((v && v.refs) || '').trim();
  const L = [];
  L.push('multishot sequence — ' + dur + ' · ' + aspect + ' · ' + res + ' · ' + fps + ' · ' + cuts + ' · exactly ' + n + ' numbered shots');
  if (style) L.push(style);
  if (title) L.push('Title: ' + title);
  if (summary) L.push(summary);
  if (rules.length) {
    L.push('⚠️ KEY RULES:');
    rules.forEach(r => L.push('- ' + r));
  }
  if (shots.length) L.push(shots.join('\n'));
  if (anchor) L.push('HARD CUT — [' + anchor + ']');
  if (refs) {
    L.push('References: ' + refs);
    const locks = refLockLines(refs);
    if (locks.length) {
      L.push('ASSET LOCKS (identical in every shot):');
      locks.forEach(x => L.push('- ' + x));
    }
  }
  return L.join('\n');
}

// 引用令牌 → 资产锁定描述（在素材库「设为资产」时填写）
function refLockLines(refsText) {
  const names = parseRefTokens(refsText);
  if (!names.length) return [];
  let index, meta;
  try { index = buildAssetRefIndex(); meta = loadAssetMeta(); } catch (e) { return []; }
  const out = [];
  names.forEach(n => {
    const hit = index.get(n.toLowerCase());
    const m = hit ? (meta[hit.key] || {}) : null;
    if (m && m.lock) out.push('<<<' + ((hit && hit.name) || n) + '>>> — ' + m.lock);
  });
  return out;
}

// 导演模板引用区：自动带出所有已设为「角色 / 道具」的资产令牌（按资产名称，去重）
function directorRefsFromAssets() {
  const cats = loadAssetCats();
  const all = collectAssets();
  const nameMap = assetNameMap(all);
  const seen = new Set();
  const out = [];
  all.forEach(a => {
    const k = assetKey(a);
    const c = cats[k];
    if (c !== '角色' && c !== '道具') return;
    const nm = nameMap[k] || a.nodeTitle || a.label;
    const low = String(nm).toLowerCase();
    if (seen.has(low)) return;
    seen.add(low);
    out.push('<<<' + nm + '>>>');
  });
  return out;
}

function renderDirectorForm() {
  const listEl = _promptLibState.pop.querySelector('.prompt-lib-list');
  const countEl = _promptLibState.pop.querySelector('.prompt-lib-count');
  listEl.style.display = 'block';
  const refs = directorRefsFromAssets().join(' ');
  listEl.innerHTML =
    '<div class="dir-form">' +
      '<div><div class="df-label">场景标题</div><input class="df-input" id="dir-title" placeholder="例如：THE STUCK CHOP — 终结一击" /></div>' +
      '<div><div class="df-label">风格参考</div><input class="df-input" id="dir-style" placeholder="Photoreal cinematic, anime-final-battle..." /></div>' +
      '<div class="df-row">' +
        '<div><div class="df-label">时长</div><select class="df-select" id="dir-duration"><option>10 SECONDS</option><option selected>15 SECONDS</option><option>20 SECONDS</option><option>30 SECONDS</option></select></div>' +
        '<div><div class="df-label">画幅</div><select class="df-select" id="dir-aspect"><option selected>21:9</option><option>16:9</option><option>9:16</option><option>1:1</option></select></div>' +
      '</div>' +
      '<div class="df-row">' +
        '<div><div class="df-label">清晰度</div><select class="df-select" id="dir-res"><option selected>8K</option><option>4K</option></select></div>' +
        '<div><div class="df-label">帧率</div><select class="df-select" id="dir-fps"><option>24fps</option><option>30fps</option><option selected>60fps</option></select></div>' +
        '<div><div class="df-label">剪辑</div><select class="df-select" id="dir-cuts"><option selected>hard cuts only</option><option>soft transitions</option></select></div>' +
      '</div>' +
      '<div><div class="df-label">镜头数</div><select class="df-select" id="dir-shots"><option>3</option><option>4</option><option selected>6</option><option>8</option><option>10</option></select></div>' +
      '<div><div class="df-label">情节摘要</div><textarea class="df-textarea" id="dir-summary" rows="2" placeholder="整个镜头序列的一句话概括"></textarea></div>' +
      '<div><div class="df-label">⚠️ KEY RULES 铁律（每行一条）</div><textarea class="df-textarea" id="dir-rules" rows="4" placeholder="NO SUN. 每一帧必须有暴风雪。"></textarea></div>' +
      '<div><div class="df-label">逐镜清单（每行一条，格式：SHOT N — 时间 — 节拍: 镜头+动作）</div><textarea class="df-textarea" id="dir-shots-text" rows="6" placeholder="SHOT 1 — 0.0-2.5s — 节拍名: 24mm wide low. 动作...&#10;SHOT 2 — 2.5-5.5s — 节拍名: 35mm tracking. 动作..."></textarea></div>' +
      '<div><div class="df-label">连续性锚点（HARD CUT 后锁定场景观感，留空则不生成）</div><textarea class="df-textarea" id="dir-anchor" rows="2" placeholder="OVERCAST · NO SUN · FOG ≤2-4m · deep shadows"></textarea></div>' +
      '<div><div class="df-label">资产引用（自动填充角色/道具素材，可编辑）</div><textarea class="df-textarea" id="dir-refs" rows="2" placeholder="<<<ROCO>>> <<<crystal_sword>>>"></textarea></div>' +
      '<div class="df-actions">' +
        '<button class="df-btn" id="dir-insert" type="button">生成并插入</button>' +
        '<button class="df-btn ghost" id="dir-copy" type="button">复制</button>' +
      '</div>' +
    '</div>';
  const refsTa = listEl.querySelector('#dir-refs');
  if (refsTa) refsTa.value = refs;
  function val(id) { const el = listEl.querySelector(id); return el ? el.value : ''; }
  const read = () => ({
    duration: val('#dir-duration'), aspect: val('#dir-aspect'), resolution: val('#dir-res'),
    fps: val('#dir-fps'), cuts: val('#dir-cuts'), shots: val('#dir-shots'),
    title: val('#dir-title'), style: val('#dir-style'), summary: val('#dir-summary'),
    rules: val('#dir-rules'), shotsText: val('#dir-shots-text'), anchor: val('#dir-anchor'), refs: val('#dir-refs')
  });
  listEl.querySelector('#dir-insert').onclick = () => insertDirectorPrompt(buildDirectorPrompt(read()));
  listEl.querySelector('#dir-copy').onclick = () => copyDirectorPrompt(buildDirectorPrompt(read()));
  if (countEl) countEl.textContent = '导演模板 · 多镜头序列';
}

function insertDirectorPrompt(text, silent) {
  const n = _promptLibState.node;
  if (!n) return;
  n.prompt = text;
  const ta = _promptLibState.el.querySelector('.node-textarea');
  if (ta) ta.value = text;
  scheduleAutosave();
  // 重建卡片，让「已引用 N 个资产」徽标立即反映新提示词里的令牌
  if (n.el) { try { buildNodeBody(n.el, n); } catch (e) {} }
  if (!silent) showToast('已插入导演模板提示词', 'success');
}

// —— 角色设定表：CHARACTER DESIGN PROMPT（资产先行的第一步）——
function buildCharacterPrompt(v) {
  const name = ((v && v.name) || 'UNNAMED').trim() || 'UNNAMED';
  const style = ((v && v.style) || 'photoreal cinematic character design').trim();
  const views = (v && v.views) || 'front, 3/4, side, back';
  const aspect = (v && v.aspect) || '16:9';
  const res = (v && v.res) || '4K';
  const rows = [
    ['Species / Type', (v && v.species) || ''],
    ['Age & build', (v && v.build) || ''],
    ['Face', (v && v.face) || ''],
    ['Hair', (v && v.hair) || ''],
    ['Outfit', (v && v.outfit) || ''],
    ['Palette', (v && v.palette) || ''],
    ['Signature props', (v && v.props) || ''],
    ['Personality read', (v && v.personality) || '']
  ].filter(r => String(r[1]).trim());
  const locks = String((v && v.locks) || '').split('\n').map(s => s.trim()).filter(Boolean);
  const L = [];
  L.push('CHARACTER DESIGN SHEET — ' + name);
  L.push(style + '. One single consistent character, neutral studio backdrop.');
  L.push('Views in one image: ' + views + ' — same scale, same lighting, feet aligned on one baseline.');
  if (rows.length) {
    L.push('');
    L.push('IDENTITY');
    L.push('- Name: ' + name);
    rows.forEach(r => L.push('- ' + r[0] + ': ' + String(r[1]).trim()));
  }
  L.push('');
  L.push('LOCKED DETAILS (must stay identical in every future shot)');
  if (locks.length) locks.forEach(x => L.push('- ' + x));
  else L.push('- Same face, same outfit, same palette, same props in every shot.');
  L.push('');
  L.push('RENDER SPEC');
  L.push('- ' + aspect + ' · ' + res + ' · soft key + fill light, no harsh shadows, neutral grey background');
  L.push('- No text, no watermark, no logo, no extra characters, no cropped limbs');
  return L.join('\n');
}

function renderCharacterForm() {
  const listEl = _promptLibState.pop.querySelector('.prompt-lib-list');
  const countEl = _promptLibState.pop.querySelector('.prompt-lib-count');
  listEl.style.display = 'block';
  listEl.innerHTML =
    '<div class="dir-form">' +
      '<div><div class="df-label">角色名（出图后用它做资产名，引用令牌就是 &lt;&lt;&lt;角色名&gt;&gt;&gt;）</div><input class="df-input" id="char-name" placeholder="例如：ROCO" /></div>' +
      '<div><div class="df-label">风格</div><input class="df-input" id="char-style" placeholder="photoreal cinematic / anime key visual / 3D stylized..." /></div>' +
      '<div class="df-row">' +
        '<div><div class="df-label">视图</div><select class="df-select" id="char-views">' +
          '<option selected>front, 3/4, side, back</option><option>front, side, back</option>' +
          '<option>front, 3/4, side, back + expression sheet (6 faces)</option>' +
          '<option>front, back + hands close-up + prop close-up</option></select></div>' +
        '<div><div class="df-label">画幅</div><select class="df-select" id="char-aspect"><option selected>16:9</option><option>1:1</option><option>4:3</option><option>9:16</option></select></div>' +
        '<div><div class="df-label">清晰度</div><select class="df-select" id="char-res"><option selected>4K</option><option>8K</option></select></div>' +
      '</div>' +
      '<div class="df-row">' +
        '<div><div class="df-label">物种/类型</div><input class="df-input" id="char-species" placeholder="human / android / beast..." /></div>' +
        '<div><div class="df-label">年龄与体型</div><input class="df-input" id="char-build" placeholder="late 20s, lean athletic" /></div>' +
      '</div>' +
      '<div class="df-row">' +
        '<div><div class="df-label">面部</div><input class="df-input" id="char-face" placeholder="scar over left brow, amber eyes" /></div>' +
        '<div><div class="df-label">发型</div><input class="df-input" id="char-hair" placeholder="silver undercut, tied back" /></div>' +
      '</div>' +
      '<div><div class="df-label">服装</div><textarea class="df-textarea" id="char-outfit" rows="2" placeholder="worn red hooded coat, black tactical pants, leather boots"></textarea></div>' +
      '<div class="df-row">' +
        '<div><div class="df-label">配色</div><input class="df-input" id="char-palette" placeholder="crimson / charcoal / bone white" /></div>' +
        '<div><div class="df-label">标志道具</div><input class="df-input" id="char-props" placeholder="chipped crystal sword" /></div>' +
      '</div>' +
      '<div><div class="df-label">性格气质</div><input class="df-input" id="char-personality" placeholder="quiet, exhausted, unbreakable" /></div>' +
      '<div><div class="df-label">🔒 锁定细节（每行一条，后续所有镜头都必须一致）</div><textarea class="df-textarea" id="char-locks" rows="3" placeholder="Always the red hood up.&#10;Sword always chipped at the tip."></textarea></div>' +
      '<div class="df-actions">' +
        '<button class="df-btn" id="char-insert" type="button">生成并插入</button>' +
        '<button class="df-btn ghost" id="char-copy" type="button">复制</button>' +
        '<button class="df-btn ghost" id="char-token" type="button">复制引用令牌</button>' +
      '</div>' +
    '</div>';
  function val(id) { const el = listEl.querySelector(id); return el ? el.value : ''; }
  const read = () => ({
    name: val('#char-name'), style: val('#char-style'), views: val('#char-views'),
    aspect: val('#char-aspect'), res: val('#char-res'), species: val('#char-species'),
    build: val('#char-build'), face: val('#char-face'), hair: val('#char-hair'),
    outfit: val('#char-outfit'), palette: val('#char-palette'), props: val('#char-props'),
    personality: val('#char-personality'), locks: val('#char-locks')
  });
  listEl.querySelector('#char-insert').onclick = () => {
    insertDirectorPrompt(buildCharacterPrompt(read()), true);
    const nm = (val('#char-name') || '').trim();
    showToast('已插入角色设定提示词' + (nm ? '。出图后到素材库把它「设为资产」，名称填 ' + nm + '，之后写 <<<' + nm + '>>> 就能自动带图' : ''), 'success', 5200);
  };
  listEl.querySelector('#char-copy').onclick = () => copyDirectorPrompt(buildCharacterPrompt(read()));
  listEl.querySelector('#char-token').onclick = () => copyRefToken((val('#char-name') || 'UNNAMED').trim() || 'UNNAMED');
  if (countEl) countEl.textContent = '角色设定 · CHARACTER DESIGN SHEET';
}

function copyDirectorPrompt(text) {
  const ok = () => showToast('已复制导演模板提示词', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok).catch(() => { fallbackCopyText(text); ok(); });
  } else { fallbackCopyText(text); ok(); }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}

// 点击外部 / Esc 关闭
document.addEventListener('mousedown', (e) => {
  if (!_promptLibState.pop) return;
  if (e.target.closest && e.target.closest('.prompt-lib-pop')) return;
  if (e.target.closest && e.target.closest('.node-preset-chip.lib-btn')) return;
  closePromptLibrary();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _promptLibState.pop) closePromptLibrary();
});


// P2：aiImage/aiVideo 极简大图卡片 —— aiImage: 本图占满；aiVideo: 有真实视频 src → <video controls> 原生播放；否则本图占满 + 底部 ▶时长徽标；空状态居中
function buildNodeHero(node) {
  const wrap = document.createElement('div');
  wrap.className = 'node-hero';

  const isVideoNode = node.type === 'aiVideo' || node.type === 'videoInput';
  const isImageInputNode = node.type === 'image';
  const isAiImageNode = node.type === 'aiImage' || node.type === 'imageEdit';
  const isPreviewOnlyNode = !!node.previewOnly;
  // 寻找真实视频 src：优先 outputsData 中 type:'video'，兼容 string / {src}
  const videoPayload = isVideoNode && (node.outputsData || []).find(p => p && p.type === 'video');
  let realVideoSrc = null;
  if (videoPayload) {
    if (typeof videoPayload.value === 'string' && /^(data:video|https?:)/.test(videoPayload.value)) {
      realVideoSrc = videoPayload.value;
    } else if (videoPayload.value && typeof videoPayload.value === 'object' && typeof videoPayload.value.src === 'string' && /^(data:video|https?:)/.test(videoPayload.value.src)) {
      realVideoSrc = videoPayload.value.src;
    }
  }
  if (!realVideoSrc && node.type === 'videoInput' && typeof node.uploadedVideo === 'string' && /^(data:video|https?:)/.test(node.uploadedVideo)) {
    realVideoSrc = node.uploadedVideo;
  }
  const posterPayload = videoPayload && typeof videoPayload.value === 'object' ? videoPayload.value : null;

  // 判断本图缩略图（aiImage 直接用；aiVideo 仅在无视频/poster 时降级）
  // 这里统一走 normalizeImageSrc，避免空 data URL / 非法字符串渲染成黑块。
  const ownThumb = normalizeImageSrc(node.thumb);
  const posterThumb = normalizeImageSrc(posterPayload && posterPayload.poster);
  const galleryThumbs = isAiImageNode && Array.isArray(node._galleryImages)
    ? node._galleryImages.map(function(src) { return normalizeImageSrc(src); }).filter(Boolean)
    : [];
  const hasGallery = isAiImageNode && galleryThumbs.length > 1;

  // 图片输入节点单独走紧凑卡片：避免继续套用通用 node-hero 外壳，导致视觉和视频输入不一致。
  if (isImageInputNode) {
    wrap.className = 'node-hero node-image-input-hero';
    const imageSrc = getNodeDisplayImageSource(node) || ownThumb;
    if (imageSrc) {
      if (node.params && !node.params.name && node.uploadedImage) {
        const fileName = String(node.params.name || '').trim();
        if (fileName) wrap.dataset.filename = fileName;
      }
      // 查看大图统一走右键上下文菜单（不再单击/双击弹层）
      wrap.title = '右键菜单 → 查看大图';
      const img = document.createElement('img');
      img.className = 'node-image-input-img';
      img.src = imageSrc;
      img.alt = '图片输入';
      img.draggable = false;
      img.ondragstart = (e) => e.preventDefault();
      wrap.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.className = 'node-empty-state';
      empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="34" height="34"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M2 10l3.5-3.5L8 9l2.5-2.5L14 10"/></svg>';
      const label = document.createElement('span');
      label.textContent = '空图片节点';
      empty.appendChild(label);

      // 不显示上传按钮：整块空态可点击上传（功能保留，视觉更干净）
      if (!isPreviewOnlyNode) {
        empty.title = '点击上传图片';
        empty.onclick = (e) => {
          e.stopPropagation();
          openImageFilePicker(node);
        };
      }
      wrap.appendChild(empty);
    }
    return wrap;
  }

  const openAiComposer = isAiImageNode ? (e) => {
    if (e) e.stopPropagation();
    selectNode(node);
  } : (node.type === 'aiVideo' ? (e) => {
    if (e) e.stopPropagation();
    selectNode(node);
  } : null);

  if (isAiImageNode || node.type === 'aiVideo') {
    wrap.classList.add('node-ai-image-hero');
    wrap.onclick = openAiComposer;
  }

  if (realVideoSrc && (node.type === 'aiVideo' || node.type === 'videoInput')) {
    if (node.type === 'videoInput' && !node.videoAspect) probeVideoNodeSize(node, realVideoSrc);
    // 有真实视频 → 原生 <video controls> 直接在节点面板内预览
    const v = document.createElement('video');
    v.src = realVideoSrc;
    v.controls = true;
    v.muted = false;
    v.volume = 1;
    v.preload = 'metadata';
    v.className = 'node-hero-video';
    v.playsInline = true;
    if (posterThumb) v.poster = posterThumb;
    else if (ownThumb) v.poster = ownThumb;
    wrap.appendChild(v);
  } else if (isAiImageNode && hasGallery) {
    wrap.classList.add('node-ai-image-gallery');
    const stage = document.createElement('div');
    stage.className = 'node-ai-image-gallery-stage';

    const main = document.createElement('img');
    main.className = 'node-ai-image-gallery-main';
    main.src = galleryThumbs[0] || ownThumb || posterThumb || '';
    main.alt = '';
    main.draggable = false;
    main.title = node.type === 'imageEdit' ? '单击显示参数，双击上传源图' : '单击显示参数，双击添加参考图';
    main.onclick = openAiComposer;
    main.ondblclick = (e) => {
      e.stopPropagation();
      if (node.type === 'imageEdit') {
        openImageFilePicker(node);
      } else {
        openReferenceImagePicker(node, () => {
          if (node === __composerNode) showNodeComposer(node);
          else if (node.el) buildNodeBody(node.el, node);
        });
      }
    };
    stage.appendChild(main);

    const strip = document.createElement('div');
    strip.className = 'node-ai-image-gallery-strip';
    galleryThumbs.forEach((src, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'node-ai-image-gallery-thumb' + (idx === 0 ? ' is-active' : '');
      btn.title = '查看第 ' + (idx + 1) + ' 张';
      btn.innerHTML = '<img src="' + escapeHtml(src) + '" alt="图' + (idx + 1) + '">';
      btn.onmousedown = (e) => e.stopPropagation();
      btn.onclick = (e) => {
        e.stopPropagation();
        openImageLightbox(src, galleryThumbs, idx);
      };
      strip.appendChild(btn);
    });
    stage.appendChild(strip);
    wrap.appendChild(stage);

    const badge = document.createElement('div');
    badge.className = 'node-ai-image-gallery-badge';
    badge.textContent = galleryThumbs.length + ' 张';
    wrap.appendChild(badge);
  } else if (ownThumb) {
    // 图片占满
    const img = document.createElement('img');
    img.src = getNodeDisplayImageSource(node) || ownThumb || posterThumb || '';
    img.alt = '';
    img.draggable = false;
    if (isAiImageNode) {
      img.title = node.type === 'imageEdit' ? '单击显示参数，双击上传源图' : '单击显示参数，双击添加参考图';
      img.style.cursor = 'pointer';
      img.onclick = openAiComposer;
      img.ondblclick = (e) => {
        e.stopPropagation();
        if (node.type === 'imageEdit') {
          openImageFilePicker(node);
        } else {
          openReferenceImagePicker(node, () => {
            if (node === __composerNode) showNodeComposer(node);
            else if (node.el) buildNodeBody(node.el, node);
          });
        }
      };
    } else if (node.type === 'aiVideo') {
      img.title = '单击显示参数，双击添加参考视频';
      img.style.cursor = 'pointer';
      img.onclick = openAiComposer;
      img.ondblclick = (e) => {
        e.stopPropagation();
        openReferenceVideoPicker(node, () => {
          if (node === __composerNode) showNodeComposer(node);
          else if (node.el) buildNodeBody(node.el, node);
        });
      };
    } else {
      img.onmousedown = (e) => e.stopPropagation();
      img.onclick = (e) => { e.stopPropagation(); openImageLightbox(img.src); };
    }
    wrap.appendChild(img);
    if (isVideoNode && posterPayload && posterPayload.duration) {
      const ov = document.createElement('div');
      ov.className = 'node-video-overlay';
      ov.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6z"/></svg><span>' + escapeHtml(String(posterPayload.duration)) + '</span>';
      ov.onclick = (e) => { e.stopPropagation(); if (node.type === 'videoInput') showNodeComposer(node); else showToast('请在节点参数中生成视频', 'info'); };
      wrap.appendChild(ov);
    }
  } else {
    const empty = document.createElement('div');
    empty.className = 'node-empty-state';
    empty.innerHTML = node.type === 'videoInput'
      ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="34" height="34"><rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2"/></svg>'
      : node.type === 'aiVideo'
      ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="34" height="34"><rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2"/></svg>'
      : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="34" height="34"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M2 10l3.5-3.5L8 9l2.5-2.5L14 10"/></svg>';
    const label = document.createElement('span');
    label.textContent = (node.type === 'aiVideo' || node.type === 'videoInput') ? '空视频节点' : (isAiImageNode ? (node.type === 'imageEdit' ? '双击上传源图' : '双击上传参考图') : '空图片节点');
    empty.appendChild(label);

    if ((node.type === 'videoInput' || node.type === 'image') && !isPreviewOnlyNode) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'node-empty-action';
      const isVideoInput = node.type === 'videoInput';
      action.textContent = isVideoInput ? '上传视频' : '上传图片';
      action.onclick = (e) => {
        e.stopPropagation();
        if (isVideoInput) openVideoFilePicker(node);
        else openImageFilePicker(node);
      };
      empty.appendChild(action);
    }

    if (isAiImageNode) {
      empty.style.cursor = 'pointer';
      empty.onclick = openAiComposer;
      empty.ondblclick = (e) => {
        e.stopPropagation();
        if (node.type === 'imageEdit') {
          openImageFilePicker(node);
        } else {
          openReferenceImagePicker(node, () => {
            if (node === __composerNode) showNodeComposer(node);
            else if (node.el) buildNodeBody(node.el, node);
          });
        }
      };
    } else if (node.type === 'aiVideo') {
      empty.style.cursor = 'pointer';
      empty.onclick = openAiComposer;
      empty.ondblclick = (e) => {
        e.stopPropagation();
        openReferenceVideoPicker(node, () => {
          if (node === __composerNode) showNodeComposer(node);
          else if (node.el) buildNodeBody(node.el, node);
        });
      };
    }

    if (node.type !== 'videoInput' && node.type !== 'image' && !isAiImageNode && node.type !== 'aiVideo') {
      empty.onclick = (e) => {
        e.stopPropagation();
        openImageFilePicker(node);
      };
    }
    wrap.appendChild(empty);
  }

  return wrap;
}

// P2.5：文字节点「✨ 生图」—— 用本文字 prompt 快速生成 aiImage 节点并连线
function createImageFromTextNode(textNode) {
  if (!textNode || !workflow.nodes.has(textNode.id)) return null;
  const text = nodeFullText(textNode) || textNode.prompt || '';
  const x = textNode.x + (textNode.width || 280) + 48;
  const y = textNode.y;
  const img = addNode('aiImage', x, y);
  img.title = (textNode.title || '文字').slice(0, 12) + ' → 图';
  img.prompt = text;
  // 自动连线 text.out → aiImage 首个兼容 input
  const outs = textNode.def.outputs || [];
  const ins = img.def.inputs || [];
  let connected = false;
  for (let oi = 0; oi < outs.length && !connected; oi++) {
    for (let ii = 0; ii < ins.length; ii++) {
      const ot = outs[oi].type, it = ins[ii].type;
      const ok = ot === it || (typeof validateConnection === 'function' && validateConnection(textNode, oi, img, ii));
      if (ok) {
        const e = new Edge(textNode, oi, img, ii);
        workflow.edges.set(e.id, e);
        resetNodeData(img);
        markEdgesDirty();
        connected = true;
        break;
      }
    }
  }
  selectNode(img);
  scheduleAutosave();
  showToast(connected ? '已生成图片节点并连线' : '已生成图片节点（未连到兼容端口）', connected ? 'success' : 'warn');
  return img;
}

function ensurePreviewImageNode(sourceNode, imageSrc, anchorX, anchorY) {
  if (!sourceNode || !imageSrc) return null;
  const existing = [...workflow.nodes.values()].find(function(n) {
    return n && n.previewOnly && n.previewSourceId === sourceNode.id;
  });
  const x = Math.round(anchorX != null ? anchorX : (sourceNode.x + (sourceNode.width || 280) + 48));
  const y = Math.round(anchorY != null ? anchorY : sourceNode.y);
  const node = existing || addNode('image', x, y, imageSrc);
  node.previewOnly = true;
  node.previewSourceId = sourceNode.id;
  node.title = '预览';
  node.thumb = imageSrc;
  node.uploadedImage = '';
  node.prompt = '';
  node.refImages = [];
  node.charDesc = '';
  node.outputsData = [{ type: 'image', value: imageSrc }];
  node.inputsData = [];
  node.params = { ...DEFAULT_NODE_PARAMS };
  node.status = 'done';
  node.ratio = null;
  node._fitProbed = false;
  node.width = Math.max(220, node.width || 280);
  if (node.el) {
    node.el.classList.add('preview-only-node');
    buildNodeBody(node.el, node);
  }
  if (!existing && workflow.nodes.has(sourceNode.id) && sourceNode.el) {
    selectNode(sourceNode);
  }
  return node;
}

// 多图结果：出几张图就生成几个独立预览节点
// 排布策略：先探测每张图真实尺寸 → 统一卡片宽度、按原图比例定高（不裁剪不黑边）
//           → 两列「矮列优先」平衡摆放，间距统一，避免固定间距与自动改尺寸打架
async function spawnPreviewNodesForImages(sourceNode, imgs) {
  if (!sourceNode || !Array.isArray(imgs) || !imgs.length) return;
  // 清理旧预览节点（重新生成时避免残留上一批）
  [...workflow.nodes.values()].filter(function(n) {
    return n && n.previewOnly && n.previewSourceId === sourceNode.id;
  }).forEach(function(n) { try { deleteNode(n.id); } catch (e) {} });

  // ① 探测每张图的实际像素尺寸
  const dims = await Promise.all(imgs.map(function(src) {
    return new Promise(function(resolve) {
      const img = new Image();
      img.onload = function() { resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 }); };
      img.onerror = function() { resolve({ w: 1, h: 1 }); };
      img.src = src;
    });
  }));

  // ② 统一卡片宽度，高度严格按原图比例（杜绝黑边/裁剪），上限兜底防巨卡
  const CARD_W = 300, GAP = 28, HEADER_H = 8;
  const heights = dims.map(function(d) {
    return Math.min(460, Math.round(CARD_W / (d.w / d.h)));
  });

  // ③ 两列平衡：每次放进当前较矮的一列
  const baseX = Math.round(sourceNode.x + (sourceNode.width || 280) + 60);
  const baseY = Math.round(sourceNode.y);
  const colH = [0, 0];
  const pos = imgs.map(function(src, i) {
    const c = colH[0] <= colH[1] ? 0 : 1;
    const p = { x: baseX + c * (CARD_W + GAP), y: baseY + colH[c], h: heights[i] };
    colH[c] += heights[i] + GAP;
    return p;
  });

  // ④ 创建节点：尺寸一次性定好（_fitProbed=true 阻止加载后重排）
  imgs.forEach(function(src, i) {
    const p = pos[i];
    const node = addNode('image', p.x, p.y, src);
    node.previewOnly = true;
    node.previewSourceId = sourceNode.id;
    node.title = '预览 ' + (i + 1);
    node.thumb = src;
    node.uploadedImage = '';
    node.prompt = '';
    node.refImages = [];
    node.charDesc = '';
    node.outputsData = [{ type: 'image', value: src }];
    node.inputsData = [];
    node.params = { ...DEFAULT_NODE_PARAMS };
    node.status = 'done';
    node.ratio = dims[i].w / dims[i].h;
    node.width = CARD_W + 32;
    node.height = p.h + HEADER_H + 8;
    node._fitProbed = true;
    if (node.el) {
      node.el.style.width = node.width + 'px';
      node.el.style.minHeight = node.height + 'px';
      node.el.classList.add('preview-only-node');
      buildNodeBody(node.el, node);
    }
  });
  if (sourceNode.el) selectNode(sourceNode);
}

async function splitAiImageGalleryToNodes(sourceNode) {
  const imgs = Array.isArray(sourceNode && sourceNode._galleryImages)
    ? sourceNode._galleryImages.filter(function(src) { return normalizeImageSrc(src); })
    : [];
  if (imgs.length <= 1) {
    showToast('当前没有可拆分的多图结果', 'info');
    return null;
  }
  await spawnPreviewNodesForImages(sourceNode, imgs);
  showToast('已拆分为 ' + imgs.length + ' 个独立图片节点', 'success');
  return true;
}

function buildNodeBody(el, node) {
  // 移除旧的 body / preset-row / controls / toolbar / ports / preview
  el.querySelectorAll('.node-body, .node-preset-row, .node-controls, .node-toolbar, .node-toolbar-hit, .node-port, .node-dataflow, .node-preview-area')
    .forEach(n => n.remove());
  refreshNodeHeaderMeta(node, el); // header 工具区/元数据行随重渲染刷新（thumb/params 变化后）

  const def = node.def;
  // #5 Details on Demand：aiImage/aiVideo 的编辑 UI（提示词/模型/参数/生成）迁移到节点下方 Composer，
  // 节点体保持纯净（仅内容 + 状态）。数据流不变，仍读写 node.prompt / node.params。
  const isComposerManaged = ['aiImage', 'imageEdit', 'aiVideo'].includes(node.type);
  const hasPrompt = false;
  const hasThumb = ['image', 'aiImage', 'imageEdit', 'aiVideo', 'upscale', 'lineart', 'compare', 'videoInput'].includes(node.type);
  const hasControls = false;
  const hasToolbar = ['aiImage', 'aiVideo', 'lineart', 'upscale'].includes(node.type);

  // —— body: 缩略图 + 提示词 ——
  let body = null;
  if (hasThumb || hasPrompt) {
    body = document.createElement('div');
    body.className = 'node-body';
    if (node.type === 'videoInput' || node.type === 'image' || node.type === 'aiImage' || node.type === 'imageEdit') body.classList.add('media-input-body');
    if (node.type === 'aiImage' || node.type === 'imageEdit') body.classList.add('ai-image-body');
    if (node.type === 'aiVideo') body.classList.add('ai-video-body');

    if (hasThumb) {
      // P2：aiImage/aiVideo 极简大图卡片（本图占满 / 空状态居中 / 输入图小条），其余类型保持缩略图行
      if (node.type === 'image' || node.type === 'aiImage' || node.type === 'imageEdit' || node.type === 'aiVideo' || node.type === 'videoInput') {
        body.appendChild(buildNodeHero(node));
        // 单图 hero 用 CSS aspect-ratio 锁定 node.ratio（画廊多图除外），保证 contain 不留白；
        // 宽度被 CSS 最小宽钳制时高度自动跟随，比例仍精确
        const _heroEl = body.querySelector('.node-hero');
        const _isGallery = node.type === 'aiImage' && Array.isArray(node._galleryImages) && node._galleryImages.length > 1;
        if (_heroEl && node.ratio && !_isGallery) {
          _heroEl.style.aspectRatio = String(node.ratio);
          _heroEl.style.flex = '0 0 auto'; // 禁止 flex 拉伸破坏 aspect-ratio（横图矮于容器时会被撑高）
        }
      } else {
      const thumbRow = document.createElement('div');
      thumbRow.className = 'node-thumb-row' + (node.type === 'aiImage' ? ' ai-image-thumb-row' : '');

      // 缩略图行：同时展示上游输入图（图一/图二…）与本节点图
      const inputImages = [];
      (def.inputs || []).forEach((p, i) => {
        const pl = node.inputsData[i];
        if (pl && pl.type === 'image' && normalizeImageSrc(pl.value)) {
          inputImages.push({ src: pl.value, label: '图' + cnNum(inputImages.length + 1), readonly: true });
        }
      });
      const ownThumbSrc = normalizeImageSrc(node.thumb);
      const ownThumb = ownThumbSrc ? { src: ownThumbSrc, label: inputImages.length ? '本图' : '', readonly: false } : null;
      const displayImages = ownThumb ? [...inputImages, ownThumb] : inputImages;

      if (displayImages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'node-thumb-empty';
        empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8h10"/></svg>';
        empty.onmousedown = (e) => e.stopPropagation();
        if (node.type === 'videoInput') {
          empty.classList.add('video');
          empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2"/></svg>';
          empty.onmousedown = (e) => e.stopPropagation();
        }
        thumbRow.appendChild(empty);
      } else {
        displayImages.forEach((imgInfo) => {
          const wrap = document.createElement('div');
          wrap.className = 'node-thumb-wrap';

          const thumb = document.createElement('div');
          thumb.className = 'node-thumb' + (node.type === 'aiImage' ? ' node-thumb-ai' : '');
          thumb.innerHTML = `<img src="${imgInfo.src}" alt="">`;
          thumb.onmousedown = (e) => e.stopPropagation();

          if (!imgInfo.readonly && node.type === 'image') {
            thumb.style.cursor = 'pointer';
            thumb.title = '点击更换图片';
            thumb.onclick = (e) => { e.stopPropagation(); openImageFilePicker(node); };
          } else if (!imgInfo.readonly && node.type === 'videoInput') {
            thumb.style.cursor = 'pointer';
            thumb.title = '点击更换视频';
            thumb.classList.add('video');
            thumb.onclick = (e) => { e.stopPropagation(); openVideoFilePicker(node); };
            const play = document.createElement('div');
            play.className = 'node-thumb-play';
            play.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3l8 5-8 5z"/></svg>';
            thumb.appendChild(play);
          } else if (imgInfo.readonly) {
            thumb.title = imgInfo.label || '输入图片';
          }

          wrap.appendChild(thumb);

          if (imgInfo.label) {
            const label = document.createElement('span');
            label.className = 'node-thumb-label';
            label.textContent = imgInfo.label;
            wrap.appendChild(label);
          }

          thumbRow.appendChild(wrap);
        });
      }

      // 提示词 (AI 类型) —— aiImage 仅保留结果预览，参数与提示词移到下方 Composer
      if (hasPrompt && node.type !== 'aiImage' && node.type !== 'imageEdit') {
        const promptArea = document.createElement('div');
        promptArea.className = 'node-prompt-area';
        if (node.effectivePrompt && node.effectivePrompt !== (node.prompt || '').trim()) {
          const upTag = document.createElement('div');
          upTag.className = 'node-prompt-source';
          upTag.title = '当前使用来自上游文本节点的提示词';
          upTag.textContent = '↑ 上游提示词';
          promptArea.appendChild(upTag);
        }
        // 资产引用徽标：提示词里的 <<<名称>>> 命中素材库资产时显示，生成时会带上参考图
        const refBadge = document.createElement('div');
        refBadge.className = 'node-ref-badge';
        refBadge.style.display = 'none';
        const refreshRefBadge = () => {
          let rs = { hit: 0, missing: 0, names: [], missingNames: [] };
          try { rs = nodeRefSummary(node); } catch (e) {}
          if (!rs.hit && !rs.missing) { refBadge.style.display = 'none'; return; }
          refBadge.style.display = '';
          refBadge.classList.toggle('has-missing', rs.missing > 0);
          refBadge.textContent = '🔗 已引用 ' + rs.hit + ' 个资产' + (rs.missing ? ' · ' + rs.missing + ' 个未找到' : '');
          const tips = [];
          if (rs.names && rs.names.length) tips.push('命中：' + rs.names.join('、'));
          if (rs.missingNames && rs.missingNames.length) tips.push('未找到：' + rs.missingNames.join('、') + '（去素材库「设为资产」并填名称）');
          refBadge.title = tips.join('\n');
        };
        refreshRefBadge();
        promptArea.appendChild(refBadge);
        const textarea = document.createElement('textarea');
        textarea.className = 'node-textarea';
        textarea.placeholder = '输入提示词...';
        textarea.value = node.prompt;
        textarea.rows = 2;
        textarea.oninput = (e) => { node.prompt = e.target.value; scheduleAutosave(); refreshRefBadge(); };
        textarea.onmousedown = (e) => e.stopPropagation();
        promptArea.appendChild(textarea);

        // 角色资产库：在本 AI 节点提示词中引用已保存的「角色」资产
        if (node.type === 'aiImage' || node.type === 'imageEdit') {
          const refRow = document.createElement('div');
          refRow.className = 'node-ref-asset-row';
          const refBtn = document.createElement('button');
          refBtn.type = 'button';
          refBtn.className = 'node-ref-asset-btn';
          refBtn.textContent = '🔗 引用角色资产';
          refBtn.title = '从已保存的角色资产中选择，自动插入 <<<名称>>> 引用令牌';
          refBtn.onmousedown = (e) => e.stopPropagation();
          refRow.appendChild(refBtn);
          const refSel = document.createElement('select');
          refSel.className = 'node-ref-asset-select';
          refSel.title = '选择已保存的角色资产，插入引用令牌到提示词';
          const refItems = listCharacterAssets();
          const ph = document.createElement('option');
          ph.value = '';
          ph.textContent = refItems.length ? '选择角色资产…' : '（暂无角色资产）';
          refSel.appendChild(ph);
          refItems.forEach((it) => {
            const o = document.createElement('option');
            o.value = it.name;
            o.textContent = it.name;
            refSel.appendChild(o);
          });
          refSel.onmousedown = (e) => e.stopPropagation();
          refSel.onchange = (e) => {
            const nm = e.target.value;
            if (!nm) return;
            insertRefTokenIntoNodePrompt(textarea, nm);
            node.prompt = textarea.value;
            refreshRefBadge();
            scheduleAutosave();
            showToast('已插入引用令牌 <<<' + nm + '>>>', 'success');
            refSel.value = '';
          };
          refRow.appendChild(refSel);
          promptArea.appendChild(refRow);
        }

        thumbRow.appendChild(promptArea);
      }

      body.appendChild(thumbRow);
      } // else：非 aiImage/aiVideo 的缩略图行分支
    }
    if (node.type === 'image') {
      body.classList.add('media-input-body');
    }
  } else if (node.type === 'text' || node.type === 'stateList') {
    // 纯文本输入节点 + 模型选择 + API Key（与 AI 设计助手联动）；stateList 额外带状态列表
    const textBody = document.createElement('div');
    textBody.className = 'node-body node-body-text';

    // 顶部工具栏：模型下拉 + Key 按钮
    const toolbar = document.createElement('div');
    toolbar.className = 'text-node-toolbar';

    const modelSel = document.createElement('select');
    modelSel.className = 'text-node-model';
    modelSel.title = '选择模型（与 AI 设计助手联动）';
    AI_MODELS.forEach(function(m) {
      const o = document.createElement('option');
      o.value = m.value;
      o.textContent = m.shortLabel;
      o.title = m.label;
      if (m.value === aiCurrentModel) o.selected = true;
      modelSel.appendChild(o);
    });
    modelSel.onchange = function(e) { setGlobalModel(e.target.value, modelSel); };
    modelSel.onmousedown = function(e) { e.stopPropagation(); };
    toolbar.appendChild(modelSel);

    const enhanceBtn = document.createElement('button');
    enhanceBtn.className = 'text-node-enhance';
    enhanceBtn.type = 'button';
    enhanceBtn.title = '增强提示词（AI 扩写）';
    enhanceBtn.textContent = '✨';
    enhanceBtn.onclick = function(e) { e.stopPropagation(); enhanceTextNodePrompt(node, textBody); };
    enhanceBtn.onmousedown = function(e) { e.stopPropagation(); };
    toolbar.appendChild(enhanceBtn);

    const keyBtn = document.createElement('button');
    keyBtn.className = 'text-node-keybtn';
    keyBtn.type = 'button';
    keyBtn.title = '填写 API Key';
    keyBtn.textContent = '🔑';
    keyBtn.onclick = function(e) { e.stopPropagation(); toggleTextNodeKeyRow(keyRow); };
    keyBtn.onmousedown = function(e) { e.stopPropagation(); };
    toolbar.appendChild(keyBtn);

    const statesBtn = document.createElement('button');
    statesBtn.className = 'text-node-statesbtn';
    statesBtn.type = 'button';
    statesBtn.title = '按「角色描述」中的状态列表生成多个 AI 绘图节点（每行一个状态）';
    statesBtn.textContent = '🔁';
    statesBtn.onclick = function(e) { e.stopPropagation(); generateStateNodesFromText(node); };
    statesBtn.onmousedown = function(e) { e.stopPropagation(); };
    toolbar.appendChild(statesBtn);

    textBody.appendChild(toolbar);

    // Key 输入行（默认隐藏）
    const keyRow = document.createElement('div');
    keyRow.className = 'text-node-keyrow';
    keyRow.style.display = 'none';
    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.className = 'text-node-keyinput';
    keyInput.placeholder = '粘贴 Deepseek API Key';
    keyInput.value = localStorage.getItem(DEEPSEEK_KEY_STORAGE) || '';
    keyInput.onmousedown = function(e) { e.stopPropagation(); };
    const keySave = document.createElement('button');
    keySave.className = 'text-node-keysave';
    keySave.type = 'button';
    keySave.textContent = '保存';
    keySave.onclick = function(e) {
      e.stopPropagation();
      const v = keyInput.value.trim();
      if (!v) localStorage.removeItem(DEEPSEEK_KEY_STORAGE);
      else localStorage.setItem(DEEPSEEK_KEY_STORAGE, v);
      syncApiKeyInputs();
      // 保存后自动收起 KEY 输入行
      keyRow.style.display = 'none';
      showToast('API Key 已保存（与 AI 设计助手共享）', 'success');
    };
    keySave.onmousedown = function(e) { e.stopPropagation(); };
    keyRow.appendChild(keyInput);
    keyRow.appendChild(keySave);
    textBody.appendChild(keyRow);

    // —— 区块一：角色描述（独立输入框：可替换文字 / 上传参考图）——
    const leadLabel = document.createElement('div');
    leadLabel.className = 'node-field-label';
    leadLabel.textContent = '角色描述（在此替换，或上传参考图）';
    textBody.appendChild(leadLabel);

    const leadArea = document.createElement('textarea');
    leadArea.className = 'node-textarea node-lead-textarea';
    leadArea.placeholder = '在此粘贴角色文字描述（例：黑发少女、白色连衣裙）；已上传参考图可留空';
    leadArea.value = node.charDesc || '';
    leadArea.style.minHeight = '48px';
    leadArea.style.maxHeight = '160px';
    leadArea.style.overflowY = 'auto';
    leadArea.style.resize = 'vertical';
    leadArea.oninput = function(e) {
      node.charDesc = e.target.value;
      scheduleAutosave();
    };
    leadArea.onmousedown = function(e) { e.stopPropagation(); };
    const leadWrap = document.createElement('div');
    leadWrap.className = 'prompt-expand-wrap';
    leadWrap.appendChild(leadArea);
    leadWrap.appendChild(makePromptExpandBtn(
      () => node.charDesc || '',
      (v) => { node.charDesc = v; scheduleAutosave(); },
      (v) => { leadArea.value = v; },
      '放大编辑角色描述'));
    textBody.appendChild(leadWrap);

    // 参考图上传（面板内直传，随下游 AI 生图一起发送）—— 归属角色描述区
    const refWrap = document.createElement('div');
    refWrap.className = 'node-ref-uploader';
    const refBtn = document.createElement('button');
    refBtn.type = 'button';
    refBtn.className = 'node-ref-upload-btn';
    refBtn.title = '上传参考图：随下游 AI 生图节点一起发送';
    refBtn.textContent = '📎 上传参考图';
    refBtn.onclick = function(e) { e.stopPropagation(); openTextNodeRefPicker(node, renderRefThumbs); };
    refBtn.onmousedown = function(e) { e.stopPropagation(); };
    refWrap.appendChild(refBtn);
    const refThumbs = document.createElement('div');
    refThumbs.className = 'node-ref-thumbs';
    refWrap.appendChild(refThumbs);
    function renderRefThumbs() {
      renderRefThumbsManaged(node, refThumbs, {
        emptyText: '暂无参考图',
        onChange: function() { buildNodeBody(el, node); },
      });
    }
    textBody.appendChild(refWrap);
    renderRefThumbs();

    // 分隔：下方为固定提示词
    const sep = document.createElement('div');
    sep.className = 'node-section-sep';
    sep.textContent = '固定 10 段提示词（无需修改）';
    textBody.appendChild(sep);

    // —— 区块二：固定提示词（主文本区，随生图前置拼接角色描述）——
    const textarea = document.createElement('textarea');
    textarea.className = 'node-textarea node-main-textarea';
    textarea.placeholder = '固定提示词（一般无需修改）';
    textarea.value = node.prompt;
    textarea.style.minHeight = '60px';
    textarea.style.maxHeight = '320px';
    textarea.style.overflowY = 'auto';
    textarea.style.resize = 'vertical';
    function autoResize() {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 320) + 'px';
    }
    textarea.oninput = function(e) {
      node.prompt = e.target.value;
      scheduleAutosave();
      autoResize();
    };
    textarea.onmousedown = function(e) { e.stopPropagation(); };
    const mainWrap = document.createElement('div');
    mainWrap.className = 'prompt-expand-wrap';
    mainWrap.appendChild(textarea);
    mainWrap.appendChild(makePromptExpandBtn(
      () => node.prompt || '',
      (v) => { node.prompt = v; scheduleAutosave(); },
      (v) => { textarea.value = v; autoResize(); },
      '放大编辑提示词'));
    textBody.appendChild(mainWrap);
    setTimeout(autoResize, 0);

    // —— stateList 专属：状态列表（每行一个状态）+ 一键生成状态节点 ——
    if (node.type === 'stateList') {
      const sep = document.createElement('div');
      sep.className = 'node-section-sep';
      sep.textContent = '——— 状态列表（每行一个状态） ———';
      textBody.appendChild(sep);

      const stateArea = document.createElement('textarea');
      stateArea.className = 'node-textarea state-list-area';
      stateArea.placeholder = '每行一个状态，例如：\n日常着装\n华丽晚礼服\n东方古风汉服\n雨中撑伞街头';
      stateArea.value = (node.params && node.params.states) || '';
      stateArea.style.minHeight = '64px';
      stateArea.style.maxHeight = '200px';
      stateArea.style.overflowY = 'auto';
      stateArea.oninput = function(e) {
        node.params.states = e.target.value;
        scheduleAutosave();
        updateStateCount();
      };
      stateArea.onmousedown = function(e) { e.stopPropagation(); };
      textBody.appendChild(stateArea);

      const stateBtn = document.createElement('button');
      stateBtn.type = 'button';
      stateBtn.className = 'node-ref-upload-btn state-gen-btn';
      stateBtn.textContent = '⚡ 一键生成状态节点（角色保持一致）';
      stateBtn.onclick = function(e) { e.stopPropagation(); generateStateNodes(node); };
      stateBtn.onmousedown = function(e) { e.stopPropagation(); };
      textBody.appendChild(stateBtn);

      const batchSaveBtn = document.createElement('button');
      batchSaveBtn.type = 'button';
      batchSaveBtn.className = 'node-ref-upload-btn state-save-btn';
      batchSaveBtn.textContent = '💾 全部存为角色资产';
      batchSaveBtn.title = '把本角色已完成的状态节点一键归档为角色资产（跨画布可复用，未出图的跳过）';
      batchSaveBtn.onclick = function(e) { e.stopPropagation(); saveAllCharacterStatesAsAsset(node); };
      batchSaveBtn.onmousedown = function(e) { e.stopPropagation(); };
      textBody.appendChild(batchSaveBtn);

      const countTip = document.createElement('div');
      countTip.className = 'node-field-label state-count-tip';
      function updateStateCount() {
        const lines = String(node.params && node.params.states || '').split('\n').filter(s => s.trim()).length;
        countTip.textContent = lines ? '已识别 ' + lines + ' 个状态' : '';
      }
      textBody.appendChild(countTip);
      updateStateCount();
    }

    body = textBody;
  } else if (node.type === 'loop') {
    // 循环节点：批量重复执行下游节点（计数 / 起始 / 步长 / 模式）
    const loopBody = document.createElement('div');
    loopBody.className = 'node-body node-body-loop';

    const mkRow = (label, key, defVal, min, max) => {
      const row = document.createElement('div');
      row.className = 'loop-param-row';
      const lab = document.createElement('span');
      lab.className = 'loop-param-label';
      lab.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'loop-param-input';
      inp.min = String(min);
      if (max != null) inp.max = String(max);
      inp.value = (node.params[key] != null ? node.params[key] : defVal);
      inp.oninput = (e) => {
        let v = parseInt(e.target.value);
        if (isNaN(v)) v = defVal;
        if (min != null) v = Math.max(min, v);
        if (max != null) v = Math.min(max, v);
        node.params[key] = v;
        scheduleAutosave();
      };
      inp.onmousedown = (e) => e.stopPropagation();
      row.appendChild(lab);
      row.appendChild(inp);
      return row;
    };

    loopBody.appendChild(mkRow('次数', 'count', 4, 1, 100));
    loopBody.appendChild(mkRow('起始', 'start', 1, 0, 99999));
    loopBody.appendChild(mkRow('步长', 'step', 1, 1, 99999));

    // 模式：串行 / 并行
    const modeRow = document.createElement('div');
    modeRow.className = 'loop-param-row';
    const modeLab = document.createElement('span');
    modeLab.className = 'loop-param-label';
    modeLab.textContent = '模式';
    const modeSel = document.createElement('select');
    modeSel.className = 'loop-param-select';
    [['serial', '串行'], ['parallel', '并行']].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if ((node.params.mode || 'serial') === v) o.selected = true;
      modeSel.appendChild(o);
    });
    modeSel.onchange = (e) => { node.params.mode = e.target.value; scheduleAutosave(); };
    modeSel.onmousedown = (e) => e.stopPropagation();
    modeRow.appendChild(modeLab);
    modeRow.appendChild(modeSel);
    loopBody.appendChild(modeRow);

    // 进度显示
    const progress = document.createElement('div');
    progress.className = 'loop-progress';
    const lp = node.loopProgress || { iter: 0, total: (node.params.count || 0) };
    if (lp.iter > 0 && lp.total > 0) {
      progress.innerHTML = '已完成 ' + lp.iter + ' / ' + lp.total + ' 轮 · 共 ' + (node._galleryImages ? node._galleryImages.length : 0) + ' 张';
      progress.classList.add('active');
    } else {
      progress.textContent = '将批量执行下游 ' + (node.params.count || 0) + ' 次';
    }
    loopBody.appendChild(progress);

    // 变量提示
    const hint = document.createElement('div');
    hint.className = 'loop-hint';
    hint.textContent = '提示词可用变量： 《计数》 《总数》 《轮次》 《进度》';
    loopBody.appendChild(hint);

    body = loopBody;
  } else if (node.type === 'comfyui') {
    body = renderComfyNodeBody(node);
  } else if (node.type === 'reversePrompt') {
    body = renderReversePromptBody(node);
  } else if (node.type === 'save') {
    // 保存节点：预览输入内容 + 填写文件名 + 触发本地下载
    const saveBody = document.createElement('div');
    saveBody.className = 'node-body node-body-save';

    const inData = collectSaveInputs(node);
    const imgIn = inData.find(d => d && d.type === 'image' && typeof d.value === 'string');
    const textIn = inData.find(d => d && d.type === 'text' && typeof d.value === 'string');

    // 找到连接到本节点图片端口的上游 AI 绘图节点，取其逐张原图（_galleryImages）
    let galleryImgs = [];
    [...workflow.edges.values()].forEach(e => {
      if (e.to.node === node) {
        const src = e.from.node;
        if (src && src.type === 'aiImage' && Array.isArray(src._galleryImages) && src._galleryImages.length > 0) {
          galleryImgs = src._galleryImages;
        }
      }
    });

    // 预览区
    const previewArea = document.createElement('div');
    previewArea.className = 'save-preview-area';

    if (galleryImgs.length > 0) {
      // 多张原图：逐张分开显示，每张可单独下载 / 放大
      const grid = document.createElement('div');
      grid.className = 'node-preview-grid';
      galleryImgs.forEach((src, idx) => {
        const cell = document.createElement('div');
        cell.className = 'node-preview-cell';
        const img = document.createElement('img');
        img.className = 'node-preview-img';
        img.src = src;
        img.onmousedown = (e) => e.stopPropagation();
      img.onclick = (e) => { e.stopPropagation(); openImageLightbox(src, galleryImgs, idx); };
      cell.appendChild(img);
      const cap = document.createElement('span');
      cap.className = 'node-preview-cap';
      cap.textContent = '图' + (idx + 1);
      cell.appendChild(cap);
        const dl = document.createElement('button');
        dl.className = 'node-preview-dl';
        dl.type = 'button';
        dl.title = '保存此张为图片';
        dl.textContent = '⤓';
        dl.onmousedown = (e) => e.stopPropagation();
        dl.onclick = (e) => {
          e.stopPropagation();
          const base = String(node.params.filename || node.title || 'flowcraft').trim().replace(/[\\/:*?"<>|]/g, '_') || 'flowcraft';
          const m = String(src).match(/data:image\/(\w+);/i);
          const ext = (m && m[1]) ? m[1] : 'png';
          downloadDataURL(src, base + '_' + (idx + 1) + '.' + ext);
        };
        cell.appendChild(dl);
        grid.appendChild(cell);
      });
      previewArea.appendChild(grid);
    } else if (imgIn && /^data:image\//i.test(imgIn.value)) {
      const img = document.createElement('img');
      img.className = 'save-preview-img';
      img.src = normalizeImageSrc(imgIn.value) || '';
      img.onmousedown = (e) => e.stopPropagation();
      img.onclick = (e) => { e.stopPropagation(); openImageLightbox(imgIn.value); };
      previewArea.appendChild(img);
    } else if (textIn) {
      const textPreview = document.createElement('div');
      textPreview.className = 'save-preview-text';
      textPreview.textContent = String(textIn.value).trim() || '(空文本)';
      previewArea.appendChild(textPreview);
    } else {
      const empty = document.createElement('div');
      empty.className = 'save-preview-empty';
      empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.5"/><path d="M2 10l3.5-3.5L8 9l2.5-2.5L14 10"/></svg><span>连接图片或文本后预览</span>';
      previewArea.appendChild(empty);
    }
    saveBody.appendChild(previewArea);

    // 文件名 + 保存按钮
    const fileRow = document.createElement('div');
    fileRow.className = 'save-file-row';

    const fileInput = document.createElement('input');
    fileInput.type = 'text';
    fileInput.className = 'save-filename-input';
    fileInput.placeholder = '文件名（不含扩展名）';
    fileInput.value = node.params.filename || '';
    fileInput.oninput = (e) => { node.params.filename = e.target.value; scheduleAutosave(); };
    fileInput.onmousedown = (e) => e.stopPropagation();
    fileRow.appendChild(fileInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-download-btn';
    saveBtn.type = 'button';
    // 多张原图：保存全部（逐张分开）；单张：保存
    if (galleryImgs.length > 1) {
      saveBtn.textContent = '保存全部 (' + galleryImgs.length + ')';
      saveBtn.title = '将 ' + galleryImgs.length + ' 张图逐张下载到本地';
    } else {
      saveBtn.textContent = '保存';
      saveBtn.title = '下载到本地';
    }
    saveBtn.onclick = (e) => { e.stopPropagation(); runSaveNode(node); };
    saveBtn.onmousedown = (e) => e.stopPropagation();
    fileRow.appendChild(saveBtn);

    saveBody.appendChild(fileRow);
    body = saveBody;
  }

  if (body) el.appendChild(body);


  // —— 视频生成节点 body ——
  const videoTypes = ['script', 'footage', 'voiceover', 'subtitle', 'bgm', 'compose', 'publish'];
  if (videoTypes.includes(node.type)) {
    const vbody = document.createElement('div');
    vbody.className = 'node-body node-body-video';

    if (node.type === 'script') {
      // 脚本预览
      const preview = document.createElement('div');
      preview.className = 'vg-script-preview';
      preview.textContent = node.params.script || '';
      vbody.appendChild(preview);
      // 元信息行
      const meta = document.createElement('div');
      meta.className = 'vg-script-meta';
      const count = document.createElement('span');
      count.className = 'vg-script-count';
      count.textContent = (node.params.wordCount || 0) + ' 字';
      meta.appendChild(count);
      const btn = document.createElement('button');
      btn.className = 'vg-regen-btn';
      btn.textContent = '重新生成';
      btn.onclick = (e) => { e.stopPropagation(); };
      btn.onmousedown = (e) => e.stopPropagation();
      meta.appendChild(btn);
      vbody.appendChild(meta);
    }

    else if (node.type === 'footage') {
      // 2x2 素材网格
      const grid = document.createElement('div');
      grid.className = 'vg-footage-grid';
      (node.params.items || []).forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'vg-footage-item';
        const img = document.createElement('img');
        img.src = createPlaceholderDataURL(80, 50, item.seed, '');
        cell.appendChild(img);
        const dur = document.createElement('span');
        dur.className = 'vg-footage-duration';
        dur.textContent = item.duration;
        cell.appendChild(dur);
        grid.appendChild(cell);
      });
      vbody.appendChild(grid);
    }

    else if (node.type === 'voiceover') {
      // 配音文本
      const text = document.createElement('div');
      text.className = 'vg-vo-text';
      text.textContent = node.params.text || '';
      vbody.appendChild(text);
      // 参数行
      const params = document.createElement('div');
      params.className = 'vg-vo-params';
      const p = node.params;
      [p.lang, '语速 ' + p.speed, p.voice, p.duration].forEach(t => {
        const span = document.createElement('span');
        span.className = 'vg-vo-param';
        span.textContent = t;
        params.appendChild(span);
      });
      vbody.appendChild(params);
      // 波形占位
      const wave = document.createElement('div');
      wave.className = 'vg-waveform';
      for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'vg-wave-bar';
        bar.style.height = (20 + Math.random() * 80) + '%';
        wave.appendChild(bar);
      }
      vbody.appendChild(wave);
    }

    else if (node.type === 'subtitle') {
      // 字幕列表
      const slist = document.createElement('div');
      slist.className = 'vg-sub-list';
      (node.params.lines || []).forEach(line => {
        const item = document.createElement('div');
        item.className = 'vg-sub-item';
        const time = document.createElement('span');
        time.className = 'vg-sub-time';
        time.textContent = line.time;
        item.appendChild(time);
        const txt = document.createElement('span');
        txt.className = 'vg-sub-text';
        txt.textContent = line.text;
        item.appendChild(txt);
        slist.appendChild(item);
      });
      vbody.appendChild(slist);
      // 样式信息
      const style = document.createElement('div');
      style.className = 'vg-sub-style';
      style.textContent = node.params.style || '';
      vbody.appendChild(style);
    }

    else if (node.type === 'bgm') {
      const p = node.params;
      // 音乐名
      const name = document.createElement('div');
      name.className = 'vg-bgm-name';
      name.textContent = p.name || '';
      vbody.appendChild(name);
      // 元信息
      const meta = document.createElement('div');
      meta.className = 'vg-bgm-meta';
      const dur = document.createElement('span');
      dur.textContent = p.duration || '';
      meta.appendChild(dur);
      const mood = document.createElement('span');
      mood.className = 'vg-bgm-mood';
      mood.textContent = p.mood || '';
      meta.appendChild(mood);
      vbody.appendChild(meta);
      // 音量
      const vol = document.createElement('div');
      vol.className = 'vg-bgm-volume';
      const volLabel = document.createElement('span');
      volLabel.className = 'vg-bgm-volume-label';
      volLabel.textContent = '音量';
      vol.appendChild(volLabel);
      const slider = document.createElement('div');
      slider.className = 'vg-bgm-slider';
      const fill = document.createElement('div');
      fill.className = 'vg-bgm-slider-fill';
      fill.style.width = (p.volume || 0) + '%';
      slider.appendChild(fill);
      const thumb = document.createElement('div');
      thumb.className = 'vg-bgm-slider-thumb';
      thumb.style.left = (p.volume || 0) + '%';
      slider.appendChild(thumb);
      vol.appendChild(slider);
      vbody.appendChild(vol);
    }

    else if (node.type === 'compose') {
      const p = node.params;
      // 进度条
      const prog = document.createElement('div');
      prog.className = 'vg-compose-progress';
      const track = document.createElement('div');
      track.className = 'vg-progress-track';
      const fill = document.createElement('div');
      fill.className = 'vg-progress-fill';
      fill.style.width = (p.progress || 0) + '%';
      track.appendChild(fill);
      prog.appendChild(track);
      const plabel = document.createElement('span');
      plabel.className = 'vg-progress-label';
      plabel.textContent = (p.progress || 0) + '%';
      prog.appendChild(plabel);
      vbody.appendChild(prog);
      // 缩略图
      const thumb = document.createElement('div');
      thumb.className = 'vg-compose-thumb';
      thumb.innerHTML = '<img src="' + createPlaceholderDataURL(120, 70, 200, '') + '">';
      vbody.appendChild(thumb);
      // 信息
      const info = document.createElement('div');
      info.className = 'vg-compose-info';
      [p.resolution, p.duration, p.size].forEach(t => {
        const item = document.createElement('span');
        item.className = 'vg-compose-info-item';
        item.textContent = t;
        info.appendChild(item);
      });
      vbody.appendChild(info);
      // 合成按钮
      const btn = document.createElement('button');
      btn.className = 'vg-compose-btn';
      btn.textContent = '合成视频';
      btn.onclick = (e) => { e.stopPropagation(); };
      btn.onmousedown = (e) => e.stopPropagation();
      vbody.appendChild(btn);
    }

    else if (node.type === 'publish') {
      // 平台列表
      const plist = document.createElement('div');
      plist.className = 'vg-publish-list';
      (node.params.platforms || []).forEach(pf => {
        const item = document.createElement('div');
        item.className = 'vg-publish-item';
        const dot = document.createElement('span');
        dot.className = 'vg-publish-dot ' + pf.status;
        item.appendChild(dot);
        const nm = document.createElement('span');
        nm.className = 'vg-publish-name';
        nm.textContent = pf.name;
        item.appendChild(nm);
        const st = document.createElement('span');
        st.className = 'vg-publish-status';
        st.textContent = pf.status === 'published' ? '已发布' : (pf.status === 'failed' ? '失败' : '待发布');
        item.appendChild(st);
        plist.appendChild(item);
      });
      vbody.appendChild(plist);
      // 发布按钮
      const btn = document.createElement('button');
      btn.className = 'vg-publish-btn';
      btn.textContent = '一键发布';
      btn.onclick = (e) => { e.stopPropagation(); };
      btn.onmousedown = (e) => e.stopPropagation();
      vbody.appendChild(btn);
    }

    el.appendChild(vbody);
  }

  // —— 常用提示词 chip 行 ——
  if (hasPrompt) {
    const presetRow = document.createElement('div');
    presetRow.className = 'node-preset-row';
    const presets = ['写实风格', '动漫风', '油画质感'];
    presets.forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'node-preset-chip';
      chip.innerHTML = `<span class="preset-arrow">›</span>${text}`;
      chip.onclick = (e) => {
        e.stopPropagation();
        node.prompt = (node.prompt ? node.prompt + '，' : '') + text;
        const ta = el.querySelector('.node-textarea');
        if (ta) ta.value = node.prompt;
        scheduleAutosave();
      };
      chip.onmousedown = (e) => e.stopPropagation();
      presetRow.appendChild(chip);
    });
    const libBtn = document.createElement('button');
    libBtn.className = 'node-preset-chip lib-btn';
    libBtn.innerHTML = '📚 提示词库';
    libBtn.onclick = (e) => { e.stopPropagation(); openPromptLibrary(node, el, libBtn); };
    libBtn.onmousedown = (e) => e.stopPropagation();
    presetRow.appendChild(libBtn);
    el.appendChild(presetRow);
  }

  // —— 控件行 ——
  if (hasControls) {
    const controls = document.createElement('div');
    controls.className = 'node-controls';

    // 模型下拉
    const modelSel = document.createElement('select');
    modelSel.className = 'model-select';
    const models = node.type === 'aiImage'
      ? ['Nano Banana Pro', 'FLUX.1', 'Stable Diffusion XL', 'GPT Image 2']
      : ['可灵 2.0', 'Runway Gen-4'];
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'GPT Image 2' ? m + '（真实出图）' : m + '（演示）';
      modelSel.appendChild(opt);
    });
    node.params.model = normalizeAiImageModelName(node.params.model);
    modelSel.value = node.params.model;
    // 旧存档或默认 model 与当前类型模型列表不匹配时，归正到第一个可用模型
    if (!models.includes(node.params.model)) {
      node.params.model = node.type === 'aiImage' ? 'GPT Image 2' : models[0];
    }
    modelSel.value = node.params.model;
    modelSel.onchange = (e) => { node.params.model = e.target.value; scheduleAutosave(); };
    modelSel.onmousedown = (e) => e.stopPropagation();
    controls.appendChild(modelSel);

    // 参数下拉选择：规格 / (张数 | 时长) / 模式
    const isVideoNode = node.type === 'aiVideo';
    const specSel = buildUnifiedAiSpecSelect(node, 'param-select param-spec-select');
    controls.appendChild(specSel);
    const paramSelects = [
      // 视频节点用「时长」替代图片节点的「张数」
      isVideoNode
        ? { key: 'duration', label: '时长', options: ['3秒', '5秒', '10秒', '15秒', '30秒'] }
        : { key: 'count',    label: '张数', options: ['1张', '2张', '4张', '6张', '8张'] },
      { key: 'mode',       label: '模式',   options: ['同步', '异步'] }
    ];
    paramSelects.forEach(({ key, label, options }) => {
      const sel = document.createElement('select');
      sel.className = 'param-select';
      sel.title = label;
      options.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        sel.appendChild(opt);
      });
      const current = node.params[key];
      sel.value = options.includes(current) ? current : options[0];
      if (!options.includes(current)) node.params[key] = options[0];
      sel.onchange = (e) => { node.params[key] = e.target.value; scheduleAutosave(); };
      sel.onmousedown = (e) => e.stopPropagation();
      controls.appendChild(sel);
    });

    // 执行按钮
    const runBtn = document.createElement('button');
    runBtn.className = 'run-btn';
    runBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l9 6-9 6z"/></svg>';
    runBtn.title = '运行此节点';
    runBtn.onclick = (e) => { e.stopPropagation(); runNode(node); };
    runBtn.onmousedown = (e) => e.stopPropagation();
    controls.appendChild(runBtn);

    el.appendChild(controls);
  }

  // —— 底部工具栏 ——
  if (hasToolbar) {
    const toolbarHit = document.createElement('div');
    toolbarHit.className = 'node-toolbar-hit';
    toolbarHit.onmousedown = (e) => e.stopPropagation();
    toolbarHit.onmouseup = (e) => e.stopPropagation();
    // 工具条已并入顶部状态栏，不再挂载独立悬停热区（避免遮挡状态栏按钮）

    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';

    // 图片输入节点：额外提供"上传图片"按钮
    if (node.type === 'image' || node.type === 'videoInput') {
      const upBtn = document.createElement('button');
      upBtn.className = 'tool-btn tool-btn-upload';
      upBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 10V3M5 6l3-3 3 3M3 13h10"/></svg>';
      upBtn.title = node.type === 'videoInput' ? '上传视频' : '上传图片';
      upBtn.onclick = (e) => { e.stopPropagation(); node.type === 'videoInput' ? openVideoFilePicker(node) : openImageFilePicker(node); };
      upBtn.onmousedown = (e) => e.stopPropagation();
      toolbar.appendChild(upBtn);
    }

    // 角色状态节点：把高频操作放在节点内，避免用户必须打开右键菜单。
    if (isCharacterStateNode(node)) {
      const stateLabel = document.createElement('span');
      stateLabel.className = 'state-node-label';
      stateLabel.textContent = '状态：' + node.stateMeta.label;
      stateLabel.title = '角色状态节点：' + node.stateMeta.label;
      toolbar.appendChild(stateLabel);

      const stateInfo = document.createElement('div');
      stateInfo.className = 'state-node-info';
      toolbar.appendChild(stateInfo);

      const retryBtn = document.createElement('button');
      retryBtn.className = 'tool-btn state-node-action';
      retryBtn.type = 'button';
      retryBtn.textContent = '↻';
      retryBtn.title = '单状态重试';
      retryBtn.onclick = (e) => { e.stopPropagation(); retryCharacterStateNode(node); };
      retryBtn.onmousedown = (e) => e.stopPropagation();
      toolbar.appendChild(retryBtn);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'tool-btn state-node-action';
      copyBtn.type = 'button';
      copyBtn.textContent = '⧉';
      copyBtn.title = '复制此状态';
      copyBtn.onclick = (e) => { e.stopPropagation(); duplicateCharacterStateNode(node); };
      copyBtn.onmousedown = (e) => e.stopPropagation();
      toolbar.appendChild(copyBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'tool-btn state-node-action';
      cancelBtn.type = 'button';
      cancelBtn.textContent = '⨯';
      cancelBtn.title = '取消此状态';
      cancelBtn.onclick = (e) => { e.stopPropagation(); cancelCharacterStateNode(node); };
      cancelBtn.onmousedown = (e) => e.stopPropagation();
      toolbar.appendChild(cancelBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'tool-btn state-node-action state-node-remove';
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.title = '删除此状态（移入回收站）';
      removeBtn.onclick = (e) => { e.stopPropagation(); deleteNode(node.id); };
      removeBtn.onmousedown = (e) => e.stopPropagation();
      toolbar.appendChild(removeBtn);
    }

    const tools = [
      { icon: 'copy', title: '复制链接' },
      { icon: 'canvas', title: '发送到画布' },
      { icon: 'chat', title: '发送到对话' },
      { icon: 'storyboard', title: '发送到分镜' }
    ];
    tools.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.innerHTML = TOOLBAR_ICONS[t.icon] || '';
      btn.title = t.title;
      btn.onclick = (e) => { e.stopPropagation(); };
      btn.onmousedown = (e) => e.stopPropagation();
      toolbar.appendChild(btn);
    });
    // 工具条并入顶部状态工具栏（与标题/状态芯片同排），不再单独黑色悬浮
    const hdrRow = el.querySelector('.node-header-row');
    if (hdrRow) hdrRow.appendChild(toolbar); else el.appendChild(toolbar);
  }

  // —— C 懒迁移：已有缩略图但未做比例适配的节点（含旧存档）首次渲染时自动按原图比例适配 ——
  // 缩略图变化（新生成/新上传）时按真实图比例重排节点框，消除留白；
  // 仅改规格未出新图时不重排，保留 applySpecSize 的框型
  const _fitSrc = normalizeImageSrc(node.thumb);
  if (_fitSrc && node._fitThumbSrc !== _fitSrc) {
    node._fitThumbSrc = _fitSrc;
    node._fitProbed = true;
    probeFitNode(node);
  }

  // —— 底部图片预览区 ——
  if (node.type !== 'image' && node.type !== 'videoInput' && node.type !== 'aiImage' && node.type !== 'aiVideo') {
    renderImagePreviewSection(el, node);
  }

  // —— #8 生成信息条（置于底部参数区：展开后可编辑详细参数并重新生成）——
  if (node.genMeta && ['aiImage', 'comfyui', 'imageEdit'].includes(node.type)) {
    renderGenMetaStrip(el, node);
  }

  // —— 端口 ——
  const inputs = def.inputs || [];
  const outputs = def.outputs || [];

  // 计算端口 Y 位置：从标题栏下方开始均匀分布
  const portStartY = 48; // 标题栏底部附近
  const portSpacing = 28;

  inputs.forEach((portDef, i) => {
    const port = document.createElement('div');
    port.className = 'node-port input';
    port.style.top = (portStartY + i * portSpacing) + 'px';
    port.dataset.node = node.id;
    port.dataset.kind = 'input';
    port.dataset.portIdx = i;
    port.dataset.portType = portDef.type;
    port.title = portDef.label;
    el.appendChild(port);
  });

  outputs.forEach((portDef, i) => {
    const port = document.createElement('div');
    port.className = 'node-port output';
    port.style.top = (portStartY + i * portSpacing) + 'px';
    port.dataset.node = node.id;
    port.dataset.kind = 'output';
    port.dataset.portIdx = i;
    port.dataset.portType = portDef.type;
    port.title = portDef.label;
    el.appendChild(port);
  });

  // 更新状态指示器
  updateNodeStatus(node);

  // 同步节点实际高度（供 fitToContent 使用）
  // 元素未挂载 DOM 时 offsetHeight 为 0，此时保留 node.height 已有值，避免覆盖为 0
  node.height = el.offsetHeight || node.height;

  // #5：节点重建后高度可能变化 → 若 Composer 正跟随该节点则重定位
  if (node === __composerNode) positionNodeComposer();
}

  // —— 反推提示词节点 body（视频 → 抽帧 → 中文电影级提示词）——
function renderReversePromptBody(node) {
  const wrap = document.createElement('div');
  wrap.className = 'node-body node-body-reverse';

  // ===== A. 视频上传 / 预览区 =====
  const videoBox = document.createElement('div');
  videoBox.className = 'rp-video-box';

  const videoMeta = document.createElement('div');
  videoMeta.className = 'rp-video-meta';

  const videoEl = document.createElement('video');
  videoEl.className = 'rp-video';
  videoEl.controls = true;
  videoEl.muted = true;
  videoEl.preload = 'auto';   // auto 确保 seek 抽帧时视频数据已加载（metadata 可能抽不出帧）
  videoEl.playsInline = true;
  if (node.params.videoSrc) videoEl.src = node.params.videoSrc;

  function pickVideo() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'video/*';
    inp.style.display = 'none';
    inp.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      if (node.params.videoSrc && node.params.videoSrc.startsWith('blob:')) URL.revokeObjectURL(node.params.videoSrc);
      const url = URL.createObjectURL(f);
      node.params.videoSrc = url;
      node.params.videoName = f.name;
      videoEl.src = url;
      renderMeta();
      scheduleAutosave();
    };
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => inp.remove(), 100);
  }

  // 拖放支持：直接把视频文件拖到节点上载入（不需要点按钮）
  function handleDropVideo(f) {
    if (!f || !f.type || !f.type.startsWith('video/')) {
      showToast('请拖入视频文件（MP4 / WebM 等）', 'warn');
      return;
    }
    if (node.params.videoSrc && node.params.videoSrc.startsWith('blob:')) URL.revokeObjectURL(node.params.videoSrc);
    const url = URL.createObjectURL(f);
    node.params.videoSrc = url;
    node.params.videoName = f.name;
    videoEl.src = url;
    renderMeta();
    scheduleAutosave();
    showToast('已载入视频：' + f.name, 'success');
  }
  // 暴露给外部（画布拖放创建节点后直接注入视频）
  node.__handleDropVideo = handleDropVideo;
  ['dragenter', 'dragover'].forEach(evtName => {
    videoBox.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      videoBox.classList.add('rp-drop-active');
    });
  });
  videoBox.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    videoBox.classList.remove('rp-drop-active');
  });
  videoBox.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    videoBox.classList.remove('rp-drop-active');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) handleDropVideo(files[0]);
  });

  videoEl.onloadedmetadata = () => { renderMeta(); };

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'rp-btn rp-btn-ghost';
  uploadBtn.innerHTML = '📤 上传视频';
  uploadBtn.onclick = (e) => { e.stopPropagation(); pickVideo(); };
  uploadBtn.onmousedown = (e) => e.stopPropagation();

  const extractBtn = document.createElement('button');
  extractBtn.type = 'button';
  extractBtn.className = 'rp-btn rp-btn-primary';
  extractBtn.innerHTML = '🎬 提取关键帧';
  extractBtn.onclick = (e) => { e.stopPropagation(); runExtractFrames(node, framesBox, pickBtn, videoEl); };
  extractBtn.onmousedown = (e) => e.stopPropagation();
  extractBtn.disabled = !node.params.videoSrc;
  function syncExtractDisabled() { extractBtn.disabled = !node.params.videoSrc; }

  // 抽帧数量配置
  const frameCountWrap = document.createElement('label');
  frameCountWrap.className = 'rp-frame-count rp-video-meta-text';
  frameCountWrap.title = '设置提取关键帧的数量（1-30）';
  frameCountWrap.innerHTML = '<span>抽</span>';
  const frameCountInput = document.createElement('input');
  frameCountInput.type = 'number';
  frameCountInput.min = 1;
  frameCountInput.max = 30;
  frameCountInput.value = node.params.frameCount || 5;
  frameCountInput.onchange = (e) => {
    let v = parseInt(e.target.value, 10);
    if (!isFinite(v) || v < 1) v = 1;
    if (v > 30) v = 30;
    node.params.frameCount = v;
    e.target.value = v;
    scheduleAutosave();
  };
  frameCountInput.onmousedown = (e) => e.stopPropagation();
  frameCountInput.onclick = (e) => e.stopPropagation();
  const frameCountSuffix = document.createElement('span');
  frameCountSuffix.textContent = '帧';
  frameCountWrap.appendChild(frameCountInput);
  frameCountWrap.appendChild(frameCountSuffix);

  // 抽帧模式切换：content（按镜头切换检测）/ uniform（按时间均匀）
  const frameModeWrap = document.createElement('span');
  frameModeWrap.className = 'rp-mode-toggle rp-video-meta-text';
  const MODES = [
    { id: 'content', label: '智能' },
    { id: 'uniform', label: '均匀' }
  ];
  node.params.frameMode = node.params.frameMode || 'content';
  const modeBtns = {};
  function syncModeActive() {
    MODES.forEach(function(m) {
      if (modeBtns[m.id]) modeBtns[m.id].classList.toggle('active', node.params.frameMode === m.id);
    });
  }
  MODES.forEach(function(m) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rp-mode-btn';
    b.textContent = m.label;
    b.onclick = (e) => { e.stopPropagation(); node.params.frameMode = m.id; scheduleAutosave(); syncModeActive(); };
    b.onmousedown = (e) => e.stopPropagation();
    modeBtns[m.id] = b;
    frameModeWrap.appendChild(b);
  });
  syncModeActive();

  const downloadAllBtn = document.createElement('button');
  downloadAllBtn.type = 'button';
  downloadAllBtn.className = 'rp-btn rp-btn-ghost rp-btn-sm';
  downloadAllBtn.innerHTML = '⤓ 全部下载';
  downloadAllBtn.onclick = (e) => { e.stopPropagation(); downloadAllFrames(node); };
  downloadAllBtn.onmousedown = (e) => e.stopPropagation();
  downloadAllBtn.style.display = (node.params.frames && node.params.frames.length) ? '' : 'none';

  function renderMeta() {
    // 仅清除旧的元数据子节点（保留按钮不被误删）
    videoMeta.querySelectorAll('.rp-video-meta-text').forEach(function(el) { el.remove(); });
    const dur = videoEl.duration && isFinite(videoEl.duration) ? formatDuration(videoEl.duration) : '--:--';
    const name = node.params.videoName || '示例视频';
    const metaTitle = document.createElement('span');
    metaTitle.className = 'rp-video-name rp-video-meta-text';
    metaTitle.textContent = '🎞 ' + name;
    const metaDur = document.createElement('span');
    metaDur.className = 'rp-video-dur rp-video-meta-text';
    metaDur.textContent = dur;
    videoMeta.appendChild(metaTitle);
    videoMeta.appendChild(metaDur);
    syncExtractDisabled();
  }
  videoMeta.appendChild(uploadBtn);
  videoMeta.appendChild(frameCountWrap);
  videoMeta.appendChild(frameModeWrap);
  videoMeta.appendChild(extractBtn);
  videoMeta.appendChild(downloadAllBtn);
  videoBox.appendChild(videoMeta);
  videoBox.appendChild(videoEl);
  wrap.appendChild(videoBox);
  renderMeta();

  // ===== B. 抽帧缩略图横排 =====
  const framesBox = document.createElement('div');
  framesBox.className = 'rp-frames-box';
  function renderFrames() {
    framesBox.innerHTML = '';
    const arr = node.params.frames || [];
    if (!arr.length) {
      const empty = document.createElement('div');
      empty.className = 'rp-frames-empty';
      empty.textContent = '尚未提取帧 · 拖入视频或点「📤 上传视频」后点「🎬 提取关键帧」';
      framesBox.appendChild(empty);
      downloadAllBtn.style.display = 'none';
      return;
    }
    arr.forEach((src, i) => {
      const item = document.createElement('div');
      item.className = 'rp-frame';
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.onclick = (e) => { e.stopPropagation(); openRpFrameLightbox(node, i); };
      const idx = document.createElement('span');
      idx.className = 'rp-frame-idx';
      idx.textContent = '#' + (i + 1);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'rp-frame-del';
      del.title = '删除该帧';
      del.innerHTML = '×';
      del.onclick = (e) => { e.stopPropagation(); deleteRpFrame(node, i); };
      del.onmousedown = (e) => e.stopPropagation();
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'rp-frame-view';
      view.title = '查看大图';
      view.innerHTML = '🔍';
      view.onclick = (e) => { e.stopPropagation(); openRpFrameLightbox(node, i); };
      view.onmousedown = (e) => e.stopPropagation();
      item.appendChild(img);
      item.appendChild(idx);
      item.appendChild(del);
      item.appendChild(view);
      item.onmousedown = (e) => e.stopPropagation();
      framesBox.appendChild(item);
    });
    downloadAllBtn.style.display = '';
  }
  renderFrames();
  wrap.appendChild(framesBox);

  // ===== C. 生成的提示词区 =====
  const promptSection = document.createElement('div');
  promptSection.className = 'rp-prompt-section';

  const promptHead = document.createElement('div');
  promptHead.className = 'rp-prompt-head';
  const promptTitle = document.createElement('span');
  promptTitle.className = 'rp-prompt-title';
  promptTitle.textContent = '生成的提示词';
  const saveTxtBtn = document.createElement('button');
  saveTxtBtn.type = 'button';
  saveTxtBtn.className = 'rp-btn rp-btn-ghost rp-btn-sm';
  saveTxtBtn.innerHTML = '💾 保存 TXT';
  saveTxtBtn.onclick = (e) => { e.stopPropagation(); downloadText(node.params.prompt || '', `reverse-prompt-${Date.now()}.txt`); };
  saveTxtBtn.onmousedown = (e) => e.stopPropagation();
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'rp-btn rp-btn-primary rp-btn-sm';
  copyBtn.innerHTML = '📋 复制';
  copyBtn.onclick = (e) => { e.stopPropagation(); copyToClipboard(node.params.prompt || '', '已复制到剪贴板'); };
  copyBtn.onmousedown = (e) => e.stopPropagation();
  promptHead.appendChild(promptTitle);
  promptHead.appendChild(saveTxtBtn);
  promptHead.appendChild(copyBtn);

  const promptTa = document.createElement('textarea');
  promptTa.className = 'rp-prompt-area';
  promptTa.placeholder = '点击下方「✨ 生成中文电影级提示词」自动生成…';
  promptTa.value = node.params.prompt || '';
  promptTa.rows = 6;
  promptTa.oninput = (e) => { node.params.prompt = e.target.value; scheduleAutosave(); };
  promptTa.onmousedown = (e) => e.stopPropagation();

  promptSection.appendChild(promptHead);
  promptSection.appendChild(promptTa);
  wrap.appendChild(promptSection);

  // ===== C1b. 结构化字段卡片（阶段D）：可拆分、可编辑、可一键套用 =====
  const fieldsSection = document.createElement('div');
  fieldsSection.className = 'rp-fields-section';
  function renderRpFields() {
    fieldsSection.innerHTML = '';
    // 旧数据/手动文本：无已存字段时尝试从全文解析（幂等，不覆盖已编辑值）
    if (!node.params.fields || !Object.keys(node.params.fields).length) {
      const parsed = parseRpStructured(node.params.prompt || '');
      if (Object.keys(parsed).length) node.params.fields = parsed;
    }
    const fields = node.params.fields || {};
    const keys = Object.keys(fields);
    if (!keys.length) { fieldsSection.style.display = 'none'; return; }
    fieldsSection.style.display = '';
    const head = document.createElement('div');
    head.className = 'rp-fields-head';
    const title = document.createElement('span');
    title.className = 'rp-fields-title';
    title.textContent = '🧩 结构化字段（可编辑）';
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'rp-btn rp-btn-primary rp-btn-sm';
    sendBtn.innerHTML = '🎨 送到 AI 绘图节点';
    sendBtn.title = '新建 AI 绘图节点：提示词 = 结构化字段合成（含负面约束），并自动连线';
    sendBtn.onclick = (e) => { e.stopPropagation(); applyRpToAiNode(node); };
    sendBtn.onmousedown = (e) => e.stopPropagation();
    head.appendChild(title);
    head.appendChild(sendBtn);
    fieldsSection.appendChild(head);
    RP_FIELD_DEFS.forEach(function(def) {
      if (!(def.key in fields)) return;
      const row = document.createElement('div');
      row.className = 'rp-fields-row';
      const lab = document.createElement('span');
      lab.className = 'rp-fields-label';
      lab.textContent = def.label;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'rp-fields-input';
      inp.value = fields[def.key] || '';
      inp.placeholder = '—';
      inp.oninput = (e) => { e.stopPropagation(); node.params.fields = node.params.fields || {}; node.params.fields[def.key] = e.target.value; scheduleAutosave(); };
      inp.onmousedown = (e) => e.stopPropagation();
      inp.onclick = (e) => e.stopPropagation();
      row.appendChild(lab);
      row.appendChild(inp);
      fieldsSection.appendChild(row);
    });
  }
  renderRpFields();
  wrap.appendChild(fieldsSection);

  // ===== C2. 视觉模型设置（反推需要"能看图"的多模态模型）=====
  node.params.visionModel = node.params.visionModel || 'gpt-4o-mini';
  const settingsSection = document.createElement('div');
  settingsSection.className = 'rp-settings-section';

  const setHead = document.createElement('div');
  setHead.className = 'rp-settings-head';
  setHead.innerHTML = '⚙ 视觉模型 <span class="rp-settings-sub">反推需能看图的模型</span>';
  settingsSection.appendChild(setHead);

  const modelRow = document.createElement('div');
  modelRow.className = 'rp-settings-row';
  const modelLabel = document.createElement('label');
  modelLabel.className = 'rp-settings-label';
  modelLabel.textContent = '模型';
  const modelSel = document.createElement('select');
  modelSel.className = 'rp-settings-select';
  // 兜底：VISION_MODEL_PRESETS 可能因作用域/初始化顺序问题不可用，确保下拉框始终能渲染
  const VISION_PRESETS = (typeof VISION_MODEL_PRESETS !== 'undefined' && VISION_MODEL_PRESETS && VISION_MODEL_PRESETS.length)
    ? VISION_MODEL_PRESETS
    : [
        { id:'gpt-4o-mini', label:'GPT-4o mini（推荐·快·省）' },
        { id:'gpt-4o', label:'GPT-4o（强·准）' },
        { id:'gpt-4.1-mini', label:'GPT-4.1 mini' },
        { id:'gpt-4.1', label:'GPT-4.1' },
        { id:'gpt-4.1-nano', label:'GPT-4.1 nano（最省）' },
        { id:'gemini-2.0-flash', label:'Gemini 2.0 Flash' },
        { id:'custom', label:'自定义模型…' }
      ];
  VISION_PRESETS.forEach(function(p) {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.label;
    modelSel.appendChild(opt);
  });
  // 若当前有激活的提供方，把其模型也加入下拉，方便直接选用（与 AI 助手对话同源 Key / 地址）
  try {
    const _ap = (typeof getActiveProvider === 'function') ? getActiveProvider() : null;
    if (_ap && _ap.model) {
      const _has = Array.prototype.some.call(modelSel.options, function(o) { return o.value === _ap.model; });
      if (!_has) {
        const _opt = document.createElement('option');
        _opt.value = _ap.model; _opt.textContent = (_ap.name || '提供方') + ' · ' + _ap.model;
        modelSel.appendChild(_opt);
      }
    }
  } catch (_) {}
  modelSel.value = node.params.visionModel;
  modelSel.onchange = (e) => { e.stopPropagation(); node.params.visionModel = modelSel.value; scheduleAutosave(); syncCustom(); };
  modelSel.onmousedown = (e) => e.stopPropagation();
  modelRow.appendChild(modelLabel);
  modelRow.appendChild(modelSel);
  settingsSection.appendChild(modelRow);

  const customRow = document.createElement('div');
  customRow.className = 'rp-settings-row';
  const customLabel = document.createElement('label');
  customLabel.className = 'rp-settings-label';
  customLabel.textContent = '自定义';
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.className = 'rp-settings-input';
  customInput.placeholder = '如 gpt-4.1 / 你的端点支持的视觉模型 id';
  customInput.value = node.params.visionCustom || '';
  customInput.oninput = (e) => { e.stopPropagation(); node.params.visionCustom = customInput.value; scheduleAutosave(); };
  customInput.onmousedown = (e) => e.stopPropagation();
  customInput.onclick = (e) => e.stopPropagation();
  customRow.appendChild(customLabel);
  customRow.appendChild(customInput);
  settingsSection.appendChild(customRow);
  function syncCustom() { customRow.style.display = (modelSel.value === 'custom') ? '' : 'none'; }
  syncCustom();

  const hintRow = document.createElement('div');
  hintRow.className = 'rp-settings-row rp-settings-row-col';
  const hintLabel = document.createElement('label');
  hintLabel.className = 'rp-settings-label';
  hintLabel.textContent = '补充说明（可选）';
  const hintInput = document.createElement('textarea');
  hintInput.className = 'rp-settings-hint';
  hintInput.rows = 2;
  hintInput.placeholder = '例如：「这是女性角色受伤特写，偏写实电影质感」——仅作参考，最终以画面为准';
  hintInput.value = node.params.userHint || '';
  hintInput.oninput = (e) => { e.stopPropagation(); node.params.userHint = hintInput.value; scheduleAutosave(); };
  hintInput.onmousedown = (e) => e.stopPropagation();
  hintRow.appendChild(hintLabel);
  hintRow.appendChild(hintInput);
  settingsSection.appendChild(hintRow);

  wrap.appendChild(settingsSection);

  // ===== D. 操作按钮（生成 + 分析另一段） =====
  const actionRow = document.createElement('div');
  actionRow.className = 'rp-action-row';

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'rp-btn rp-btn-primary rp-btn-block';
  genBtn.innerHTML = '✨ 反推电影级提示词（视觉模型）';
  genBtn.onclick = (e) => { e.stopPropagation(); runGeneratePrompt(node, promptTa, genBtn); };
  genBtn.onmousedown = (e) => e.stopPropagation();

  const reanalyzeBtn = document.createElement('button');
  reanalyzeBtn.type = 'button';
  reanalyzeBtn.className = 'rp-btn rp-btn-ghost rp-btn-block';
  reanalyzeBtn.innerHTML = '🔄 分析另一段视频';
  reanalyzeBtn.onclick = (e) => { e.stopPropagation(); clearForReanalyze(node, promptTa, videoEl, framesBox, syncExtractDisabled, renderMeta); };
  reanalyzeBtn.onmousedown = (e) => e.stopPropagation();

  actionRow.appendChild(genBtn);
  actionRow.appendChild(reanalyzeBtn);
  wrap.appendChild(actionRow);

  // ===== E. 历史记录区 =====
  const historySection = document.createElement('div');
  historySection.className = 'rp-history-section';
  const historyHead = document.createElement('div');
  historyHead.className = 'rp-history-head';
  const historyTitle = document.createElement('span');
  historyTitle.className = 'rp-history-title';
  historyTitle.innerHTML = '🕘 历史记录 <span class="rp-history-count">' + (node.params.history ? node.params.history.length : 0) + '</span>';
  const clearHistoryBtn = document.createElement('button');
  clearHistoryBtn.type = 'button';
  clearHistoryBtn.className = 'rp-btn rp-btn-ghost rp-btn-sm';
  clearHistoryBtn.textContent = '清空';
  clearHistoryBtn.onclick = (e) => { e.stopPropagation(); node.params.history = []; scheduleAutosave(); renderHistory(); };
  clearHistoryBtn.onmousedown = (e) => e.stopPropagation();
  historyHead.appendChild(historyTitle);
  historyHead.appendChild(clearHistoryBtn);
  const historyList = document.createElement('div');
  historyList.className = 'rp-history-list';
  function renderHistory() {
    historyTitle.innerHTML = '🕘 历史记录 <span class="rp-history-count">' + (node.params.history ? node.params.history.length : 0) + '</span>';
    historyList.innerHTML = '';
    const arr = (node.params.history || []).slice().reverse();
    if (!arr.length) {
      const empty = document.createElement('div');
      empty.className = 'rp-history-empty';
      empty.textContent = '暂无历史记录';
      historyList.appendChild(empty);
      return;
    }
    arr.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'rp-history-item';
      const meta = document.createElement('div');
      meta.className = 'rp-history-meta';
      const time = document.createElement('span');
      time.textContent = formatTime(item.ts);
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'rp-btn rp-btn-ghost rp-btn-sm';
      useBtn.textContent = '使用';
      useBtn.onclick = (e) => { e.stopPropagation(); node.params.prompt = item.prompt; promptTa.value = item.prompt; scheduleAutosave(); showToast('已加载历史提示词', 'success'); };
      useBtn.onmousedown = (e) => e.stopPropagation();
      meta.appendChild(time);
      meta.appendChild(useBtn);
      const text = document.createElement('div');
      text.className = 'rp-history-text';
      text.textContent = (item.prompt || '').slice(0, 60) + ((item.prompt || '').length > 60 ? '…' : '');
      row.appendChild(meta);
      row.appendChild(text);
      historyList.appendChild(row);
    });
  }
  renderHistory();
  historySection.appendChild(historyHead);
  historySection.appendChild(historyList);
  wrap.appendChild(historySection);

  // pickBtn 占位（兼容旧引用，unused）
  var pickBtn = null;
  return wrap;
}

// 阶段D：反推结果一键套用——新建 AI 绘图节点（字段合成提示词）+ 自动连线；无字段时用全文
function applyRpToAiNode(rpNode) {
  const fields = rpNode.params.fields || {};
  const composed = rpFieldsToPrompt(fields);
  const full = String(rpNode.params.prompt || '').trim();
  const promptText = composed || full;
  if (!promptText) { showToast('还没有可送出的提示词（先点「✨ 反推」生成）', 'warn'); return null; }
  const ai = addNode('aiImage', rpNode.x + 420, rpNode.y);
  ai.title = '反推·生图';
  ai.prompt = promptText;
  // 负面约束同步到负向词（字段模式才有）
  if (composed && fields.negative) ai.params = Object.assign({}, ai.params, { negativePrompt: fields.negative });
  if (ai.el) buildNodeBody(ai.el, ai);
  connectNodes(rpNode.id, 0, ai.id, 0); // 反推 outputs[0](提示词) → aiImage inputs[0]
  markEdgesDirty();
  scheduleAutosave();
  showToast('已新建 AI 绘图节点并套用反推提示词' + (composed ? '（结构化字段合成，负面约束已同步负向词）' : '（全文）'), 'success', 4200);
  return ai;
}

// ===== 反推提示词 · 工具函数 =====

// 从已上传视频中抽取 N 帧（HTML5 video + canvas，dataURL 数组）
// 抽帧模式：内容感知（按镜头切换检测）。
// 思路：先密集抽小指纹 → 比较相邻帧差异 → 取差异最大的若干个切换点作为关键帧；
//       若检测到的切换点不足目标数量，则用均匀采样补足；若视频无变化则整体退化为均匀采样。
function extractVideoFrames(videoEl, count, opts) {
  opts = opts || {};
  count = count || 5;
  const maxDim = opts.maxDim || 480;
  const mode = opts.mode || 'content';
  if (mode === 'uniform') return extractUniformFrames(videoEl, count, maxDim);
  return new Promise(function(resolve, reject) {
    const v = videoEl;
    if (!v || !v.duration || !isFinite(v.duration) || v.duration <= 0) {
      reject(new Error('视频尚未就绪或时长不可读')); return;
    }
    const dur = v.duration;
    const frames = [];
    let done = false;

    function finish(err, fr) {
      if (done) return;
      done = true;
      v.onseeked = null;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(fr || []);
    }

    // 超时保护：内容感知需多次 seek，放宽到 45 秒
    const timer = setTimeout(function() { finish(new Error('抽帧超时（视频数据未加载？）')); }, 45000);

    // —— 阶段一：密集抽灰度指纹，用于镜头切换检测 ——
    const cand = Math.max(30, Math.min(90, Math.round(dur))); // 候选点：每秒约 1 个，30~90
    const candTimes = [];
    for (let k = 0; k < cand; k++) {
      candTimes.push(Math.min(dur * (k + 0.5) / cand, Math.max(dur - 0.05, 0)));
    }
    const FP_W = 32, FP_H = 18;
    const fingerprints = new Array(cand);

    function grabFingerprint() {
      const cv = document.createElement('canvas');
      cv.width = FP_W; cv.height = FP_H;
      const ctx = cv.getContext('2d');
      ctx.drawImage(v, 0, 0, FP_W, FP_H);
      const data = ctx.getImageData(0, 0, FP_W, FP_H).data;
      const arr = new Float32Array(FP_W * FP_H);
      let p = 0;
      for (let i = 0; i < data.length; i += 4) {
        arr[p++] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      }
      return arr;
    }
    function diffFp(a, b) {
      if (!a || !b) return 0;
      let s = 0;
      for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
      return s / a.length; // MSE，范围 0~1
    }

    let ci = 0;
    function phase1() {
      if (done) return;
      if (ci < cand) {
        const t = candTimes[ci];
        v.onseeked = function() {
          if (done) return;
          try { fingerprints[ci] = grabFingerprint(); }
          catch (e) { fingerprints[ci] = null; }
          ci++;
          if (ci < cand) {
            try { v.currentTime = candTimes[ci]; }
            catch (e) { finish(new Error('视频跳转失败')); }
          } else {
            phase2();
          }
        };
        try { v.currentTime = t; }
        catch (e) { finish(new Error('视频跳转失败')); }
      } else {
        phase2();
      }
    }

    // —— 阶段二：差异分析 + 选目标时间点 ——
    function phase2() {
      const diffs = [];
      for (let k = 0; k < cand - 1; k++) diffs.push(diffFp(fingerprints[k], fingerprints[k + 1]));
      const mean = diffs.reduce(function(a, b) { return a + b; }, 0) / (diffs.length || 1);
      const variance = diffs.reduce(function(a, b) { return a + (b - mean) * (b - mean); }, 0) / (diffs.length || 1);
      const std = Math.sqrt(variance);
      const thresh = mean + 0.8 * std;

      const shotPoints = [];
      for (let k = 0; k < diffs.length; k++) {
        if (diffs[k] > thresh) shotPoints.push({ idx: k + 1, score: diffs[k] });
      }
      shotPoints.sort(function(a, b) { return b.score - a.score; });

      const minGap = Math.max(dur / cand, 0.2); // 两帧最小间隔，避免太近
      const targets = [];

      if (shotPoints.length === 0) {
        // 无切换：退化均匀采样
        for (let i = 0; i < count; i++) targets.push(Math.min(dur * (i + 0.5) / count, Math.max(dur - 0.05, 0)));
      } else {
        for (let s = 0; s < shotPoints.length && targets.length < count; s++) {
          const tm = candTimes[shotPoints[s].idx];
          if (targets.every(function(c) { return Math.abs(c - tm) > minGap; })) targets.push(tm);
        }
        // 切换点不足，用均匀采样补足
        if (targets.length < count) {
          for (let i = 0; i < count && targets.length < count; i++) {
            const tm = Math.min(dur * (i + 0.5) / count, Math.max(dur - 0.05, 0));
            if (targets.every(function(c) { return Math.abs(c - tm) > minGap; })) targets.push(tm);
          }
        }
        targets.sort(function(a, b) { return a - b; });
      }

      // —— 阶段三：对目标点抽高清帧 ——
      let fi = 0;
      function phase3() {
        if (done) return;
        if (fi < targets.length) {
          v.onseeked = function() {
            if (done) return;
            try {
              const cv = document.createElement('canvas');
              const ratio = (v.videoWidth || 16) / (v.videoHeight || 9);
              let w = maxDim, h = Math.round(maxDim / ratio);
              if ((v.videoWidth || 0) < maxDim) { w = v.videoWidth; h = v.videoHeight; }
              cv.width = w; cv.height = h;
              const ctx = cv.getContext('2d');
              ctx.drawImage(v, 0, 0, w, h);
              frames.push(cv.toDataURL('image/jpeg', 0.82));
            } catch (err) { /* 单帧失败不阻塞整体 */ }
            fi++;
            if (fi < targets.length) {
              try { v.currentTime = targets[fi]; }
              catch (e) { finish(new Error('视频跳转失败')); }
            } else {
              finish(null, frames);
            }
          };
          try { v.currentTime = targets[fi]; }
          catch (e) { finish(new Error('视频跳转失败')); }
        } else {
          finish(null, frames);
        }
      }
      phase3();
    }

    phase1();
  });
}

// 均匀抽帧（回退模式）：按视频时长等间隔、每段中点取一帧
function extractUniformFrames(videoEl, count, maxDim) {
  count = count || 5;
  maxDim = maxDim || 480;
  return new Promise(function(resolve, reject) {
    const v = videoEl;
    if (!v || !v.duration || !isFinite(v.duration) || v.duration <= 0) {
      reject(new Error('视频尚未就绪或时长不可读')); return;
    }
    const dur = v.duration;
    const frames = [];
    let idx = 0;
    let done = false;
    function finish(err) {
      if (done) return;
      done = true;
      v.onseeked = null;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(frames);
    }
    const timer = setTimeout(function() { finish(new Error('抽帧超时（视频数据未加载？）')); }, 15000);
    v.onseeked = function() {
      if (done) return;
      try {
        const cv = document.createElement('canvas');
        const ratio = (v.videoWidth || 16) / (v.videoHeight || 9);
        let w = maxDim, h = Math.round(maxDim / ratio);
        if ((v.videoWidth || 0) < maxDim) { w = v.videoWidth; h = v.videoHeight; }
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(v, 0, 0, w, h);
        frames.push(cv.toDataURL('image/jpeg', 0.78));
      } catch (err) { /* 单帧失败不阻塞整体 */ }
      idx++;
      if (idx < count) {
        const t = Math.min(dur * (idx + 0.5) / count, Math.max(dur - 0.05, 0));
        try { v.currentTime = t; } catch (e) { finish(new Error('视频跳转失败')); }
      } else {
        finish();
      }
    };
    try { v.currentTime = Math.min(dur * 0.5 / count, Math.max(dur - 0.05, 0)); }
    catch (e) { finish(new Error('视频跳转失败')); }
  });
}

function runExtractFrames(node, framesBox, pickBtn, videoEl) {
  if (!node.params.videoSrc) { showToast('请先上传视频', 'warn'); return; }
  const mode = node.params.frameMode || 'content';
  const modeLabel = mode === 'uniform' ? '均匀' : '智能（镜头切换）';
  showToast('正在抽帧（' + modeLabel + '）…', 'info');
  extractVideoFrames(videoEl, node.params.frameCount || 5, { mode: mode, maxDim: 480 }).then(function(frames) {
    node.params.frames = frames;
    scheduleAutosave();
    // 重渲染：触发 buildNodeBody 即可，简化起见手动刷新当前面板
    if (node.el) buildNodeBody(node.el, node);
    showToast('已提取 ' + frames.length + ' 帧', 'success');
  }).catch(function(err) {
    showToast('抽帧失败：' + err.message, 'danger');
  });
}

// ===== 反推提示词 · 结构化字段（阶段D：反推结果可拆分、可编辑、可一键套用） =====
var RP_FIELD_DEFS = [
  { key: 'subject', label: '主体' },
  { key: 'action', label: '动作' },
  { key: 'shot', label: '镜头' },
  { key: 'composition', label: '构图' },
  { key: 'environment', label: '环境' },
  { key: 'light', label: '光线' },
  { key: 'color', label: '色彩' },
  { key: 'material', label: '材质' },
  { key: 'motion', label: '运动' },
  { key: 'negative', label: '负面' }
];

// 从反推全文中解析【标签】行 → 字段对象；无【结构化】段时返回 {}
function parseRpStructured(text) {
  var out = {};
  if (!text || typeof text !== 'string') return out;
  RP_FIELD_DEFS.forEach(function(def) {
    var re = new RegExp('【' + def.label + '】\\s*([^【\n]+)', 'i');
    var m = re.exec(text);
    if (m) {
      var v = m[1].trim().replace(/[;；,，]$/, '');
      if (v && v !== '—' && v !== '-') out[def.key] = v;
    }
  });
  return out;
}

// 字段对象 → 可直接用于生图的提示词（中文逗号拼接，负面约束单独标注）
function rpFieldsToPrompt(fields) {
  if (!fields) return '';
  var parts = [];
  RP_FIELD_DEFS.forEach(function(def) {
    var v = (fields[def.key] || '').trim();
    if (v && def.key !== 'negative') parts.push(v);
  });
  var neg = (fields.negative || '').trim();
  var s = parts.join('，');
  if (neg) s += '\n（负面约束：' + neg + '）';
  return s;
}

// ===== 反推提示词 · 视觉模型（多模态）管线 =====
// 关键修复：旧版只把"帧数量"当文字发给纯文本模型 → 模型看不到画面只能瞎编。
// 现在把抽帧图片真正发给「能看图」的视觉模型（OpenAI 兼容 /chat/completions，image_url）。
var VISION_MODEL_PRESETS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini（推荐·快·省）' },
  { id: 'gpt-4o', label: 'GPT-4o（强·准）' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano（最省）' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'custom', label: '自定义模型…' }
];

var RP_VISION_SYSTEM = '你是一位专业的影视分镜 / 视觉分析师，擅长把视频关键帧反推成电影级提示词。\n' +
  '用户会给你若干张按时间顺序排列、已编号的视频关键帧图片。请严格遵守：\n' +
  '1. 只描述你在这些图片中【真实看到】的内容：场景环境、人物/主体、服装与外观、动作与姿态、镜头景别与角度、光线与色彩、构图、整体氛围。\n' +
  '2. 严禁编造画面中并不存在的物体、人物、情节或具体数字（例如怀表、码头、船只、特定时间等，除非你确实在画面中看到了）。\n' +
  '3. 若某张帧模糊或看不清，请明确写"看不清"，不要脑补细节。\n' +
  '4. 先逐帧用 1-2 句话点出该帧要点（标注帧号），再综合成一段完整的中文电影级提示词。\n' +
  '5. 电影级提示词需包含：场景、主体动作、镜头运动、构图、光线与色彩、氛围，并显式列出你从帧中捕捉到的关键转折。\n' +
  '6. 只输出逐帧要点 + 电影级提示词正文，不要寒暄、不要解释你的分析过程。\n' +
  '7. 最后另起一行写【结构化】，随后每行一个字段（值看不清或不存在写"—"）：【主体】【动作】【镜头】【构图】【环境】【光线】【色彩】【材质】【运动】【负面】。';

// 从帧列表中均匀抽样最多 max 帧，避免超出模型上下文 / 请求体积过大
function pickFramesEvenly(arr, max) {
  arr = arr || [];
  if (arr.length <= max) return arr.slice();
  var out = [];
  for (var i = 0; i < max; i++) out.push(arr[Math.floor(i * arr.length / max)]);
  return out;
}

// 调用视觉（多模态）模型：OpenAI 兼容 /chat/completions，优先本地 Key/Base，回退中转代理
function callVisionChat(messages, model) {
  return new Promise(function(resolve, reject) {
    var key = localStorage.getItem(OPENAI_KEY_STORAGE);
    var proxy = _fcProxy();
    if (!key && !proxy) {
      reject(new Error('未配置视觉模型：请打开 AI 助手 ⚙ 填入 OpenAI 兼容 Key，或在设置中开启中转代理。'));
      return;
    }
    if (proxy) {
      proxy.call({ provider: 'openai', endpoint: '/chat/completions', body: { model: model, messages: messages, stream: false, temperature: 0.4 }, token: window.FlowCraft.__userToken || undefined })
        .then(function(data) {
          var txt = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
          if (!txt) { reject(new Error('视觉模型返回为空')); return; }
          resolve(txt);
        })
        .catch(function(err) {
          if (err && err.kind) { var m = new Error(err.message || 'proxy error'); m.status = err.status || 0; m.proxyKind = err.kind; reject(m); return; }
          reject(err);
        });
      return;
    }
    var base = normalizeApiBase(localStorage.getItem(OPENAI_BASE_STORAGE));
    fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: model, messages: messages, stream: false, temperature: 0.4 })
    }).then(function(resp) {
      if (!resp.ok) return resp.text().then(function(t) { var e = new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 200) : '')); e.status = resp.status; throw e; });
      return resp.json();
    }).then(function(data) {
      var txt = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      if (!txt) { reject(new Error('视觉模型返回为空')); return; }
      resolve(txt);
    }).catch(reject);
  });
}

function runGeneratePrompt(node, promptTa, genBtn) {
  const frames = node.params.frames || [];
  if (!frames.length) { showToast('请先提取关键帧', 'warn'); return; }
  const key = localStorage.getItem(OPENAI_KEY_STORAGE);
  const proxy = _fcProxy();
  if (!key && !proxy) {
    showToast('反推提示词需要「能看图的视觉模型」。请在 AI 助手 ⚙ 填入 OpenAI 兼容 Key，或开启中转代理。', 'warn');
    return;
  }
  genBtn.disabled = true;
  var oldText = genBtn.innerHTML;
  genBtn.innerHTML = '⏳ 视觉分析中…';

  const model = (node.params.visionModel && node.params.visionModel !== 'custom')
    ? node.params.visionModel
    : ((node.params.visionCustom && node.params.visionCustom.trim()) || 'gpt-4o-mini');
  const picked = pickFramesEvenly(frames, 12);
  const imageParts = picked.map(function(src) {
    return { type: 'image_url', image_url: { url: src, detail: 'auto' } };
  });
  const userHint = (node.params.userHint || '').trim();
  const frameNote = '以下是不同时刻的视频关键帧（共 ' + frames.length + ' 帧，本次请求选取其中 ' + picked.length + ' 帧）。视频名：' + (node.params.videoName || '未命名') + '；时长：' + formatDuration(videoElDuration(node)) + '。' +
    (userHint ? '\n用户补充说明（仅供参考，仍以画面为准）：' + userHint : '');
  const messages = [
    { role: 'system', content: RP_VISION_SYSTEM },
    { role: 'user', content: [{ type: 'text', text: frameNote }].concat(imageParts) }
  ];

  callVisionChat(messages, model)
    .then(function(text) {
      const t = (text || '').trim();
      if (!t) { showToast('生成结果为空', 'warn'); return; }
      node.params.prompt = t;
      node.params.fields = parseRpStructured(t); // 阶段D：拆结构化字段（无结构化段则为 {}）
      promptTa.value = t;
      node.params.history = node.params.history || [];
      node.params.history.push({ ts: Date.now(), prompt: t, videoName: node.params.videoName || '' });
      if (node.params.history.length > 20) node.params.history.splice(0, node.params.history.length - 20);
      scheduleAutosave();
      node.outputsData = [{ type: 'text', value: t }];
      markEdgesDirty();
      if (node.el) buildNodeBody(node.el, node);
      showToast('提示词已生成（已写入历史 + 输出到下游）', 'success');
    })
    .catch(function(err) {
      showToast('生成失败：' + (err && err.message || err), 'danger');
    })
    .finally(function() {
      genBtn.disabled = false;
      genBtn.innerHTML = oldText;
    });
}

function videoElDuration(node) {
  // 从 panel 里的 video 取
  if (!node || !node.el) return 0;
  const v = node.el.querySelector('.rp-video');
  return (v && v.duration && isFinite(v.duration)) ? v.duration : 0;
}

function clearForReanalyze(node, promptTa, videoEl, framesBox, syncExtractDisabled, renderMeta) {
  if (node.params.videoSrc && node.params.videoSrc.startsWith('blob:')) URL.revokeObjectURL(node.params.videoSrc);
  node.params.videoSrc = '';
  node.params.videoName = '';
  node.params.frames = [];
  node.params.prompt = '';
  promptTa.value = '';
  videoEl.removeAttribute('src');
  videoEl.load();
  scheduleAutosave();
  if (node.el) buildNodeBody(node.el, node);
  showToast('已清空，可上传新视频', 'info');
}

function downloadAllFrames(node) {
  const frames = node.params.frames || [];
  if (!frames.length) return;
  // 依次触发下载（浏览器限制并发，依次延迟更稳）
  frames.forEach(function(src, i) {
    setTimeout(function() {
      try {
        const a = document.createElement('a');
        a.href = src;
        a.download = (node.params.videoName || 'video').replace(/\.[^.]+$/, '') + '-frame-' + (i + 1) + '.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {}
    }, i * 120);
  });
  showToast('开始下载 ' + frames.length + ' 帧', 'success');
}

function deleteRpFrame(node, idx) {
  const frames = node.params.frames || [];
  if (idx < 0 || idx >= frames.length) return;
  frames.splice(idx, 1);
  node.params.frames = frames;
  scheduleAutosave();
  if (node.el) buildNodeBody(node.el, node);
  showToast('已删除第 ' + (idx + 1) + ' 帧', 'info');
}

// 轻量图片灯箱：查看抽帧大图，支持左右切换、关闭、下载
function openRpFrameLightbox(node, startIdx) {
  const frames = (node.params.frames || []).slice();
  if (!frames.length) return;
  let idx = Math.max(0, Math.min(startIdx, frames.length - 1));

  const overlay = document.createElement('div');
  overlay.className = 'rp-lightbox-overlay';

  const img = document.createElement('img');
  img.className = 'rp-lightbox-img';
  img.src = frames[idx];

  const topBar = document.createElement('div');
  topBar.className = 'rp-lightbox-bar';
  const counter = document.createElement('span');
  counter.className = 'rp-lightbox-counter';
  function updateCounter() { counter.textContent = (idx + 1) + ' / ' + frames.length; }
  updateCounter();

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'rp-btn rp-btn-ghost rp-btn-sm';
  downloadBtn.innerHTML = '⤓ 下载';
  downloadBtn.onclick = (e) => { e.stopPropagation(); downloadDataUrl(frames[idx], (node.params.videoName || 'video').replace(/\.[^.]+$/, '') + '-frame-' + (idx + 1) + '.jpg'); };

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'rp-btn rp-btn-ghost rp-btn-sm';
  closeBtn.innerHTML = '✕ 关闭';
  closeBtn.onclick = (e) => { e.stopPropagation(); close(); };

  topBar.appendChild(counter);
  topBar.appendChild(downloadBtn);
  topBar.appendChild(closeBtn);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'rp-lightbox-nav rp-lightbox-prev';
  prevBtn.innerHTML = '‹';
  prevBtn.onclick = (e) => { e.stopPropagation(); prev(); };

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'rp-lightbox-nav rp-lightbox-next';
  nextBtn.innerHTML = '›';
  nextBtn.onclick = (e) => { e.stopPropagation(); next(); };

  overlay.appendChild(img);
  overlay.appendChild(topBar);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);
  document.body.appendChild(overlay);

  function refresh() {
    img.src = frames[idx];
    updateCounter();
  }
  function prev() { idx = (idx - 1 + frames.length) % frames.length; refresh(); }
  function next() { idx = (idx + 1) % frames.length; refresh(); }
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
}

function downloadText(text, filename) {
  try {
    const blob = new Blob([text || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'reverse-prompt.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    showToast('下载失败：' + err.message, 'danger');
  }
}

function copyToClipboard(text, successMsg) {
  if (!text) { showToast('无内容可复制', 'warn'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function() { showToast(successMsg || '已复制', 'success'); },
      function() { fallbackCopy(text, successMsg); }
    );
  } else { fallbackCopy(text, successMsg); }
}
function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast(successMsg || '已复制', 'success'); }
  catch (e) { showToast('复制失败', 'danger'); }
  finally { ta.remove(); }
}

function formatDuration(seconds) {
  if (!seconds || !isFinite(seconds)) return '--:--';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
}
function formatTime(ts) {
  const d = new Date(ts);
  const pad = function(n) { return n < 10 ? '0' + n : n; };
  return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ===== 生成等待反馈（阶段3）：运行态实时耗时 + 骨架脉冲；失败态原因上节点 =====
// 运行态：显示「生成中 · Ns」实时耗时徽章 + 媒体节点骨架脉冲；离开运行态清理定时器与占位
function updateNodeRunningFeedback(node) {
  const el = node.el;
  if (!el) return;
  const isMediaGen = node.type === 'aiImage' || node.type === 'imageEdit' || node.type === 'aiVideo';
  if (node.status === 'running') {
    if (!node._runStartedAt) node._runStartedAt = Date.now();
    let badge = el.querySelector('.node-elapsed');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'node-elapsed';
      el.appendChild(badge);
    }
    const tick = () => {
      // 节点元素被移除（删除 / 撤销重建）时自动清理，避免定时器泄漏
      if (!node.el || !node.el.isConnected) {
        if (node._elapsedTimer) { clearInterval(node._elapsedTimer); node._elapsedTimer = null; }
        return;
      }
      const secs = Math.max(0, Math.round((Date.now() - (node._runStartedAt || Date.now())) / 1000));
      badge.textContent = '生成中 · ' + secs + 's';
    };
    tick();
    if (node._elapsedTimer) clearInterval(node._elapsedTimer);
    node._elapsedTimer = setInterval(tick, 1000);
    if (isMediaGen) {
      el.classList.add('node-skeleton');
      const host = el.querySelector('.node-body') || el;
      if (!el.querySelector('.node-skeleton-veil')) {
        const veil = document.createElement('div');
        veil.className = 'node-skeleton-veil';
        host.appendChild(veil);
      }
    }
  } else {
    if (node._elapsedTimer) { clearInterval(node._elapsedTimer); node._elapsedTimer = null; }
    node._runStartedAt = 0;
    const badge = el.querySelector('.node-elapsed');
    if (badge) badge.remove();
    el.classList.remove('node-skeleton');
    const veil = el.querySelector('.node-skeleton-veil');
    if (veil) veil.remove();
  }
}

// ===== P1-4 错误分类与恢复引导：技术报错 → 友好文案 + 下一步恢复动作 =====
// 仅判定类别与动作；用户文案复用 localizeError（已覆盖网络/CORS/超时/HTTP码/auth/quota/model/内容策略/ComfyUI）
function classifyNodeError(node) {
  const raw = String((node && (node.failureReason || node._lastError)) || '');
  const lc = raw.toLowerCase();
  const status = Number(node && node._lastErrorStatus) || Number((raw.match(/HTTP\s*(\d{3})/i) || [])[1]) || 0;
  const kind = String((node && node._lastErrorKind) || '');
  if (kind === 'storage' || /quotaexceeded|存储|保存失败|indexeddb|localstorage|空间不足|导出备份/i.test(raw))
    return { category: 'storage', actionLabel: '导出备份', actionKind: 'backup' };
  if ((node && node._timedOut) || kind === 'timeout' || status === 408 || /timeout|timed out|aborted|deadline|超时|未在限定时间/i.test(lc))
    return { category: 'timeout', actionLabel: '重试', actionKind: 'retry' };
  if (/未配置|尚未配置|请先配置|填入.*key|需要.*key|no.*api.*key/i.test(raw))
    return { category: 'no-key', actionLabel: '打开设置', actionKind: 'settings' };
  if (status === 401 || kind === 'auth' || /invalid.*key|incorrect.*key|authentication|unauthorized|鉴权|key.*无效|无效.*key|已过期/i.test(lc))
    return { category: 'auth', actionLabel: '打开设置', actionKind: 'settings' };
  if (status === 402 || status === 429 || kind === 'quota' || kind === 'rate_limited' || /insufficient|quota|额度|余额|欠费|rate.*limit|too many|频繁|限流/i.test(lc))
    return { category: 'quota', actionLabel: '打开设置', actionKind: 'settings' };
  if (/content.*policy|moderat|unsafe|safety|violat|安全策略|内容.*拦截|敏感词/i.test(lc))
    return { category: 'content', actionLabel: '编辑提示词', actionKind: 'composer' };
  if (status === 400 || status === 404 || kind === 'param' || /model.*not found|does not exist|unknown model|invalid model|不支持|invalid.*param|此比例|此模型|node_errors|node type|参数有误/i.test(lc))
    return { category: 'param', actionLabel: '编辑参数', actionKind: 'composer' };
  if (/failed to fetch|networkerror|load failed|net::err|cors|cross-origin|网络|不可达|连接失败|econnrefused/i.test(lc))
    return { category: 'network', actionLabel: '重试', actionKind: 'retry' };
  return { category: 'unknown', actionLabel: '重试', actionKind: 'retry' };
}

// 恢复动作执行：重试 / 打开设置 / 导出备份 / 编辑参数
function runNodeErrorRecovery(node, actionKind) {
  try {
    if (actionKind === 'retry') {
      if (window.FlowCraft && window.FlowCraft.runner && typeof window.FlowCraft.runner.clearCancel === 'function') window.FlowCraft.runner.clearCancel(node.id);
      setNodeStatus(node, 'idle', '');
      updateNodeStatus(node);
      if (typeof runNode === 'function') runNode(node);
    } else if (actionKind === 'settings') {
      if (typeof toggleAIPanel === 'function') toggleAIPanel(false);
      showToast('请在 AI 面板右上角 ⚙ 检查 API Key 与接口地址', 'info', 4000);
    } else if (actionKind === 'backup') {
      if (typeof exportJSON === 'function') exportJSON();
    } else if (actionKind === 'composer') {
      if (typeof showNodeComposer === 'function') showNodeComposer(node);
      else showToast('请在节点参数中调整提示词/参数后重试', 'info');
    }
  } catch (e) {
    showToast('恢复操作失败：' + ((e && e.message) || e), 'danger');
  }
}

// 失败原因直接显示在节点上：友好文案(localizeError) + 恢复动作按钮；原始诊断保留在 title（不写入日志）
// 角色状态节点已由 renderCharacterStateInfo 展示失败原因，跳过避免重复
function updateNodeErrorReason(node) {
  const el = node.el;
  if (!el) return;
  if (isCharacterStateNode(node)) return;
  const raw = node.status === 'error' ? String(node.failureReason || node._lastError || '').trim() : '';
  let box = el.querySelector('.node-error-reason');
  if (!raw) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'node-error-reason'; el.appendChild(box); }
  box.innerHTML = '';
  box.onmousedown = (e) => e.stopPropagation();
  const cls = classifyNodeError(node);
  let friendly = raw;
  try { friendly = localizeError(raw) || raw; } catch (_) { friendly = raw; }
  const msg = document.createElement('div');
  msg.className = 'node-error-msg';
  msg.textContent = friendly;
  msg.title = '原始诊断：' + raw;
  box.appendChild(msg);
  if (cls.actionLabel && cls.actionKind && cls.actionKind !== 'none') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'node-error-action';
    btn.textContent = cls.actionLabel;
    btn.title = '恢复动作：' + cls.actionLabel;
    btn.onmousedown = (e) => e.stopPropagation();
    btn.onclick = (e) => { e.stopPropagation(); runNodeErrorRecovery(node, cls.actionKind); };
    box.appendChild(btn);
  }
}

function updateNodeStatus(node) {
  if (!node.el) return;
  if (node.status === 'failure') node.status = 'error';
  applyNodeSemanticBadge(node);
  const resultPill = node.el.querySelector('.node-result-pill');
  if (resultPill) {
    resultPill.className = 'node-result-pill ' + getNodeResultClass(node.resultMode || 'pending');
    resultPill.textContent = getNodeResultLabel(node.resultMode || 'pending');
  }
  const dot = node.el.querySelector('.node-status-dot');
  if (dot) dot.className = 'node-status-dot ' + node.status;

  const pill = node.el.querySelector('.node-status-pill');
  if (pill) {
    pill.className = 'node-status-pill ' + node.status;
    const labelMap = { idle: '待运行', queued: '排队中', running: '生成中', done: '已完成', error: '失败', cancelled: '已取消', skipped: '已跳过' };
    pill.textContent = labelMap[node.status] || node.status;
  }

  if (node.status === 'running') {
    node.el.classList.add('running');
  } else {
    node.el.classList.remove('running');
  }
  if ((node.type === 'aiImage' || node.type === 'imageEdit' || node.type === 'aiVideo') && node.status === 'running') {
    node.el.classList.add('node-marquee');
  } else {
    node.el.classList.remove('node-marquee');
  }

  // 生成等待反馈：运行态实时耗时 + 骨架；失败态原因上节点
  updateNodeRunningFeedback(node);
  updateNodeErrorReason(node);

  if (isCharacterStateNode(node)) renderCharacterStateInfo(node);

  // 执行按钮状态
  const runBtn = node.el.querySelector('.run-btn');
  if (runBtn) {
    if (node.status === 'running') {
      runBtn.classList.add('running');
    } else {
      runBtn.classList.remove('running');
    }
  }

  // 镜头清单：同步对应镜头的生成状态并刷新面板
  syncShotStatus(node);
  refreshShotPanelIfOpen();
}

function renderCharacterStateInfo(node) {
  if (!node || !node.el || !isCharacterStateNode(node)) return;
  const info = node.el.querySelector('.state-node-info');
  if (!info) return;
  const meta = node.stateMeta || {};
  const progress = meta.batchProgress || {};
  const total = Number(meta.batchTotal || progress.total || 1);
  const done = Number(progress.completed || 0);
  const failed = Number(progress.failed || 0);
  const running = Number(progress.running || 0);
  const pending = Math.max(total - done - failed - running, 0);
  const statusText =
    node.status === 'error' ? '失败' :
    node.status === 'running' ? '生成中' :
    node.status === 'done' ? '已完成' :
    node.status === 'cancelled' ? '已取消' : '排队中';
  info.innerHTML = '';

  // 总体进度条（批量操作区域）
  const barWrap = document.createElement('div');
  barWrap.className = 'state-batch-progress-bar';
  const barFill = document.createElement('div');
  barFill.className = 'state-batch-progress-fill';
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  barFill.style.width = pct + '%';
  if (failed > 0) barWrap.classList.add('has-failed');
  barWrap.appendChild(barFill);
  info.appendChild(barWrap);

  const progressEl = document.createElement('span');
  progressEl.className = 'state-batch-progress';
  progressEl.textContent = `批量进度：${done} / ${total}`;
  progressEl.title = `总数 ${total}，已完成 ${done}，失败 ${failed}，生成中 ${running}，排队中 ${pending}`;
  info.appendChild(progressEl);
  const statusEl = document.createElement('span');
  statusEl.className = 'state-node-progress-status ' + node.status;
  statusEl.textContent = statusText;
  info.appendChild(statusEl);
  const reason = node.failureReason || meta.failureReason || node._lastError || '';
  if (reason) {
    const errorEl = document.createElement('div');
    errorEl.className = 'state-node-error';
    errorEl.textContent = '失败原因：' + reason;
    errorEl.title = reason;
    info.appendChild(errorEl);
  }

  // 角色资产库：已完成且有产出图的节点，可一键存为「角色」资产
  const _assetKey = characterStateAssetKey(node);
  const _savedMeta = _assetKey ? getAssetMeta(_assetKey) : null;
  if (_savedMeta && _savedMeta.cat === '角色') {
    const saved = document.createElement('div');
    saved.className = 'state-node-asset-saved';
    saved.textContent = '✓ 已存为角色资产：<<<' + (_savedMeta.name || '') + '>>>';
    saved.title = '在其他节点提示词写 <<<' + (_savedMeta.name || '') + '>>> 即可引用该角色';
    info.appendChild(saved);
  } else if (node.status === 'done' && nodeHasOutputImage(node)) {
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'state-node-save-asset-btn';
    saveBtn.textContent = '★ 存为角色资产';
    saveBtn.title = '把本状态成功生成结果保存为可复用角色资产，其他节点可引用';
    saveBtn.onclick = (e) => { e.stopPropagation(); saveCharacterStateAsAsset(node); renderCharacterStateInfo(node); };
    info.appendChild(saveBtn);
  }
}

//================ 8. 节点 CRUD ================
function addNode(type, x, y, thumb = null) {
  pushHistory();
  const node = new WorkflowNode(type, x, y);
  if (thumb) node.thumb = thumb;
  const el = createNodeElement(node);
  nodeLayer.appendChild(el);
  workflow.nodes.set(node.id, node);
  workflow.order.push(node.id);
  selectNode(node);
  updateStatusbar();
  markEdgesDirty();
  scheduleAutosave();
  renderMinimap();
  return node;
}

function deleteNode(id) {
  const node = workflow.nodes.get(id);
  if (!node) return;

  // #5：删除的节点正是 Composer 跟随的节点 → 收起 Composer
  if (node === __composerNode) hideNodeComposer();
  // B：删除的节点挂有选中连线 → 取消连线选中
  if (__selectedEdge && (__selectedEdge.from.node === node || __selectedEdge.to.node === node)) {
    clearEdgeSelection();
  }

  // 压入历史（删除前快照）
  pushHistory();

  // 收集关联连线的快照（用于还原时恢复）
  const relatedEdges = [];
  [...workflow.edges.values()].forEach(e => {
    if (e.from.node.id === id || e.to.node.id === id) {
      relatedEdges.push({
        id: e.id,
        fromNodeId: e.from.node.id,
        fromPort: e.from.port,
        toNodeId: e.to.node.id,
        toPort: e.to.port,
      });
      // 该节点作为上游被删除 → 其下游消费者输入失效，清除旧数据
      if (e.from.node.id === id && e.to.node && e.to.node.el) {
        resetNodeData(e.to.node);
      }
      workflow.edges.delete(e.id);
    }
  });

  // 将节点数据快照移入回收站
  recycleBin.push({
    node: {
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      title: node.title,
      thumb: node.thumb,
      uploadedImage: node.uploadedImage || '',
      croppedImage: node.croppedImage || '',
      cropMeta: node.cropMeta ? JSON.parse(JSON.stringify(node.cropMeta)) : null,
      uploadedVideo: node.uploadedVideo || '',
      prompt: node.prompt,
      refImages: node.refImages ? JSON.parse(JSON.stringify(node.refImages)) : [],
      charDesc: node.charDesc || '',
      stateMeta: node.stateMeta ? { ...node.stateMeta } : null,
      params: { ...node.params },
      status: node.status,
      previewOnly: !!node.previewOnly,
      previewSourceId: node.previewSourceId || '',
    },
    edges: relatedEdges,
    deletedAt: Date.now(),
  });

  // 从画布移除 DOM 和数据
  node.el.remove();
  workflow.nodes.delete(id);
  workflow.order = workflow.order.filter(nid => nid !== id);
  workflow.selection.delete(id);

  updateStatusbar();
  updateRecycleUI();
  markEdgesDirty();
  scheduleAutosave();
  renderMinimap();
  refreshAssetPanelIfOpen();
  showToast('已移入回收站（可还原）', 'warn');
}

function selectNode(node, options = {}) {
  clearEdgeSelection();
  workflow.selection.forEach(id => {
    const n = workflow.nodes.get(id);
    if (n && n.el) n.el.classList.remove('selected');
  });
  workflow.selection.clear();
  workflow.selection.add(node.id);
  node.el.classList.add('selected');
  node.el.style.zIndex = (++workflow.nextZ).toString();
  if (node.type === 'videoInput') node.__settingsCollapsed = false;
  // #5：普通程序选中可不立即打开；左键 click 或调用方显式要求时再显示。
  if (options.showComposer !== false) showNodeComposer(node);
}

//================ 9. 节点拖拽 ================
let dragContext = null;

// ===== A 拖节点靠近自动连线（面板级吸附）=====
// 即将靠近节点面板即触发（横向间隙 -30~140px、纵向对齐窗口 90px），
// 并把拖动的节点「吸附」到端口对齐位置；松手落库。
let __autoConn = null;
const AUTOCONN_GAP_X_MIN = -30;  // 允许轻微重叠
const AUTOCONN_GAP_X_MAX = 140;  // 即将靠近面板的距离阈值
const AUTOCONN_GAP_Y_MAX = 90;   // 纵向对齐窗口
const AUTOCONN_PORT_GAP = 48;    // 吸附后两节点端口之间的间距

// 端口世界坐标（与 buildNodeBody 端口定位一致：portStartY=48, spacing=28；input 在左缘、output 在右缘）
function portWorldPos(node, kind, idx) {
  const w = node.width || 280;
  return {
    x: kind === 'output' ? (node.x + w) : node.x,
    y: node.y + 48 + idx * 28,
  };
}

// 拖动中检测候选自动连线（从拖节点的输出端口0 → 其他节点的兼容输入端口）；返回候选或 null
function updateAutoConnect(dragNode) {
  const outs = (dragNode.def && dragNode.def.outputs) || [];
  if (!outs.length) { clearAutoConnect(); return null; }
  const fromIdx = 0;
  const fromType = outs[0].type;
  const fp = portWorldPos(dragNode, 'output', fromIdx);
  let best = null, bestScore = Infinity;
  workflow.nodes.forEach(n => {
    if (n === dragNode || !n.el) return;
    const ins = (n.def && n.def.inputs) || [];
    ins.forEach((port, idx) => {
      // 类型校验：与端口拖拽规则一致（优先 validateConnection，回退类型相等）
      let ok = false;
      const vres = (window.FlowCraft && window.FlowCraft.nodes && window.FlowCraft.nodes.validateConnection)
        ? window.FlowCraft.nodes.validateConnection({
            from: { nodeType: dragNode.type, portIdx: fromIdx, kind: 'output', portType: fromType },
            to:   { nodeType: n.type, portIdx: idx, kind: 'input', portType: port.type },
          })
        : null;
      ok = vres ? !!vres.ok : (fromType === port.type);
      if (!ok) return;
      const ip = portWorldPos(n, 'input', idx);
      const dx = ip.x - fp.x;          // 目标输入相对拖节点输出的横向间隙
      const dy = Math.abs(fp.y - ip.y); // 纵向错位
      if (dx > AUTOCONN_GAP_X_MIN && dx < AUTOCONN_GAP_X_MAX && dy < AUTOCONN_GAP_Y_MAX) {
        const score = dx + dy * 2;
        if (score < bestScore) { bestScore = score; best = { toNode: n, toIdx: idx, dx, dy }; }
      }
    });
  });
  if (best) {
    if (!(__autoConn && __autoConn.toNode === best.toNode && __autoConn.toIdx === best.toIdx)) {
      clearAutoConnect();
      __autoConn = { fromNode: dragNode, fromIdx, toNode: best.toNode, toIdx: best.toIdx };
      const sel = best.toNode.el.querySelector(`.node-port.input[data-port-idx="${best.toIdx}"]`);
      if (sel) sel.classList.add('compatible');
      markEdgesDirty();
    }
    return best;
  }
  clearAutoConnect();
  return null;
}
function clearAutoConnect() {
  if (!__autoConn) return;
  try {
    const n = __autoConn.toNode;
    if (n && n.el) {
      const p = n.el.querySelector('.node-port.input.compatible');
      if (p) p.classList.remove('compatible');
    }
  } catch (e) {}
  __autoConn = null;
  markEdgesDirty();
}
// 松手时落库自动连线
function commitAutoConnect() {
  if (!__autoConn) return;
  const ac = __autoConn;
  let exists = false;
  workflow.edges.forEach(e => {
    if (e.from.node.id === ac.fromNode.id && e.from.port === ac.fromIdx &&
        e.to.node.id === ac.toNode.id && e.to.port === ac.toIdx) exists = true;
  });
  if (!exists) {
    pushHistory();
    const edge = new Edge(ac.fromNode, ac.fromIdx, ac.toNode, ac.toIdx);
    workflow.edges.set(edge.id, edge);
    resetNodeData(ac.toNode); // 连线变化 → 下游输入已改变，清除旧数据
    updateStatusbar();
    scheduleAutosave();
    showToast('已自动连线', 'success');
  }
  clearAutoConnect();
}

function snapNodePosition(dragNode, x, y) {
  const SNAP = 12;          // 对齐吸附阈值（像素）
  const GRID = 24;          // 网格步进
  const w = dragNode.width || 280;
  const h = dragNode.height || dragNode.el.offsetHeight || 160;
  const others = [...workflow.nodes.values()].filter(n => n !== dragNode);

  let bestX = SNAP + 1, bestY = SNAP + 1;
  let dx = 0, dy = 0;

  // 与其他节点边缘 / 中心对齐
  const dragXs = [x, x + w / 2, x + w];
  const dragYs = [y, y + h / 2, y + h];
  others.forEach(n => {
    const nw = n.width || 280;
    const nh = n.height || n.el.offsetHeight || 160;
    const nx = [n.x, n.x + nw / 2, n.x + nw];
    const ny = [n.y, n.y + nh / 2, n.y + nh];
    dragXs.forEach(dxPos => {
      nx.forEach(nxPos => {
        const dist = Math.abs(dxPos - nxPos);
        if (dist < bestX) { bestX = dist; dx = nxPos - dxPos; }
      });
    });
    dragYs.forEach(dyPos => {
      ny.forEach(nyPos => {
        const dist = Math.abs(dyPos - nyPos);
        if (dist < bestY) { bestY = dist; dy = nyPos - dyPos; }
      });
    });
  });

  // 未吸附到节点时，再尝试吸附网格
  if (bestX > SNAP) {
    const gx = Math.round(x / GRID) * GRID;
    if (Math.abs(x - gx) <= SNAP / 2) dx = gx - x;
  }
  if (bestY > SNAP) {
    const gy = Math.round(y / GRID) * GRID;
    if (Math.abs(y - gy) <= SNAP / 2) dy = gy - y;
  }

  return { x: x + dx, y: y + dy };
}

function startNodeDrag(e, node) {
  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;
  const startY = e.clientY;
  const shouldSnapOnRelease = !e.shiftKey;
  let moved = false;
  let historyPushed = false; // lazy 压栈标志：首次移动时才压栈，捕获拖拽前状态

  // 多选整体拖动：若被拖节点已是多选中的一员，则整组一起移动，保持相对位置
  const group = [];
  if (workflow.selection.size > 1 && workflow.selection.has(node.id)) {
    workflow.selection.forEach(id => {
      const n = workflow.nodes.get(id);
      if (n && n.el) group.push({ n, ox: n.x, oy: n.y });
    });
  } else {
    group.push({ n: node, ox: node.x, oy: node.y });
  }
  group.forEach(g => g.n.el.classList.add('dragging'));
  dragContext = { type: 'node', nodeId: node.id };

  const onMove = (e2) => {
    const dx = (e2.clientX - startX) / workflow.camera.zoom;
    const dy = (e2.clientY - startY) / workflow.camera.zoom;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      if (!historyPushed) {
        pushHistory();       // 首次移动时压栈（此时各节点 x/y 仍是拖拽前值）
        historyPushed = true;
      }
      moved = true;
    }
    // 拖拽过程中只更新位移；吸附和自动连线留到松手时处理，避免每帧全图扫描导致卡顿
    const effDx = dx;
    const effDy = dy;
    group.forEach(g => {
      const nx = g.ox + effDx;
      const ny = g.oy + effDy;
      g.n.x = nx;
      g.n.y = ny;
      g.n.el.style.left = nx + 'px';
      g.n.el.style.top = ny + 'px';
    });
    markEdgesDirty();
    if (__composerNode && group.some(g => g.n === __composerNode)) positionNodeComposer();
  };
  const onUp = () => {
    group.forEach(g => g.n.el && g.n.el.classList.remove('dragging'));
    if (moved && group.length === 1 && shouldSnapOnRelease) {
      const g = group[0];
      const snapped = snapNodePosition(g.n, g.n.x, g.n.y);
      if (snapped && (Math.abs(snapped.x - g.n.x) > 1 || Math.abs(snapped.y - g.n.y) > 1)) {
        g.n.x = snapped.x;
        g.n.y = snapped.y;
        g.n.el.style.left = snapped.x + 'px';
        g.n.el.style.top = snapped.y + 'px';
      }
      updateAutoConnect(g.n);
    }
    markEdgesDirty();
    renderMinimap();
    positionNodeComposer();
    commitAutoConnect();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (moved) {
      node.__dragClickBlocked = true;
      group.forEach(g => { if (g && g.n) g.n.__dragClickBlocked = true; });
      setTimeout(() => {
        node.__dragClickBlocked = false;
        group.forEach(g => { if (g && g.n) g.n.__dragClickBlocked = false; });
      }, 0);
      scheduleAutosave();
    } else if (isComposerType(node)) {
      // mousedown 中为拖拽调用 preventDefault() 时，部分浏览器会吞掉 click；
      // 用未发生位移的左键松开作为可靠单击判定，右键不会进入 startNodeDrag。
      if (node.type === 'videoInput') node.__settingsCollapsed = false;
      showNodeComposer(node);
    }
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

//================ 9b. 节点缩放（宽 + 高自由调节）================
function startNodeResize(e, node) {
  const startX = e.clientX;
  const startY = e.clientY;
  const origW = node.width;
  // 以当前实际 min-height 为基准，确保拖拽连续、可调小也可调大
  const origH = parseInt(node.el.style.minHeight, 10) || node.height || node.el.offsetHeight || 120;
  const minW = 160, maxW = 900;
  const minH = 80,  maxH = 1200;
  let moved = false;
  let historyPushed = false; // lazy 压栈：首次缩放时才压栈，捕获缩放前状态
  node.el.classList.add('resizing');

  const onMove = (e2) => {
    const dw = (e2.clientX - startX) / workflow.camera.zoom;
    const dh = (e2.clientY - startY) / workflow.camera.zoom;
    let newW = Math.max(minW, Math.min(maxW, origW + dw));
    let newH = Math.max(minH, Math.min(maxH, origH + dh));
    const lockAspect = (node.type === 'videoInput' || node.type === 'image') && (node.videoAspect || node.ratio);
    if (lockAspect) {
      const headerH = (node.el && node.el.querySelector('.node-header') && node.el.querySelector('.node-header').offsetHeight) || 42;
      const chromeH = headerH + 8;
      const aspect = node.videoAspect || node.ratio || 1;
      const contentW = Math.max(minW - 32, newW - 32);
      const contentH = Math.max(120, Math.round(contentW / aspect));
      newW = contentW + 32;
      newH = Math.max(minH, Math.min(maxH, contentH + chromeH));
    }
    if (newW !== node.width || newH !== node.height) {
      if (!historyPushed) {
        pushHistory();       // 首次实际变化时压栈（此时尺寸仍是缩放前值）
        historyPushed = true;
      }
      moved = true;
    }
    node.width = newW;
    node.height = newH;
    node.el.style.width = node.width + 'px';
    node.el.style.minHeight = node.height + 'px';
    markEdgesDirty();
    renderMinimap();
    // #5：缩放节点时 Composer 跟随
    positionNodeComposer();
  };
  const onUp = () => {
    node.el.classList.remove('resizing');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (moved) {
      scheduleAutosave();
      markEdgesDirty();
    }
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

//================ 9b. 快捷键配置系统 ================
const DEFAULT_KEYBINDINGS = {
  deleteSelected: { label: '删除选中节点', defaultKey: 'Delete', desc: '删除当前选中的节点', ctrl: false, shift: false, alt: false, key: 'Delete' },
  duplicateSelected: { label: '复制选中节点', defaultKey: 'Ctrl+D', desc: '复制当前选中的节点', ctrl: true, shift: false, alt: false, key: 'd' },
  undo: { label: '撤销', defaultKey: 'Ctrl+Z', desc: '撤销上一步操作', ctrl: true, shift: false, alt: false, key: 'z' },
  redo: { label: '重做', defaultKey: 'Ctrl+Y', desc: '重做上一步操作', ctrl: true, shift: false, alt: false, key: 'y' },
  selectAll: { label: '全选节点', defaultKey: 'Ctrl+A', desc: '选中画布上所有节点', ctrl: true, shift: false, alt: false, key: 'a' },
  fitContent: { label: '适应内容', defaultKey: 'F', desc: '将视口缩放到包含所有节点', ctrl: false, shift: false, alt: false, key: 'f' },
  resetZoom: { label: '重置缩放', defaultKey: '0', desc: '将画布缩放重置为 100%', ctrl: false, shift: false, alt: false, key: '0' },
  runWorkflow: { label: '运行工作流', defaultKey: 'Ctrl+Enter', desc: '运行整个工作流', ctrl: true, shift: false, alt: false, key: 'Enter' },
  arrangeNodes: { label: '自动整理布局', defaultKey: 'Ctrl+L', desc: '按连线分层自动排列节点', ctrl: true, shift: false, alt: false, key: 'l' },
  toggleAIPanel: { label: '打开/关闭 AI 助手', defaultKey: 'Ctrl+/', desc: '切换右侧 AI 助手面板', ctrl: true, shift: false, alt: false, key: '/' },
  toggleTheme: { label: '切换主题', defaultKey: 'Ctrl+T', desc: '在黑底 / 白底 / 护眼主题间切换', ctrl: true, shift: false, alt: false, key: 't' },
  openShortcuts: { label: '打开快捷键设置', defaultKey: 'Ctrl+K', desc: '打开快捷键设置面板', ctrl: true, shift: false, alt: false, key: 'k' }
};

let keybindings = {};
let recordingShortcut = null;

function loadKeybindings() {
  try {
    const saved = localStorage.getItem('flowcraft-keybindings');
    const parsed = saved ? JSON.parse(saved) : {};
    keybindings = {};
    Object.keys(DEFAULT_KEYBINDINGS).forEach(k => {
      keybindings[k] = Object.assign({}, DEFAULT_KEYBINDINGS[k], parsed[k] || {});
    });
  } catch (e) {
    keybindings = JSON.parse(JSON.stringify(DEFAULT_KEYBINDINGS));
  }
}

function saveKeybindings() {
  try {
    localStorage.setItem('flowcraft-keybindings', JSON.stringify(keybindings));
  } catch (e) { /* ignore */ }
  updateToolbarTitles();
}

function resetKeybindings() {
  keybindings = JSON.parse(JSON.stringify(DEFAULT_KEYBINDINGS));
  saveKeybindings();
  renderShortcutsPanel();
  showToast('已恢复默认快捷键', 'info');
}

function getShortcutDisplay(binding) {
  if (!binding || !binding.key) return '未设置';
  const parts = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  let k = binding.key;
  if (k.length === 1) k = k.toUpperCase();
  else if (k === ' ') k = 'Space';
  parts.push(k);
  return parts.join('+');
}

function matchKeyBinding(e, binding) {
  if (!binding || !binding.key) return false;
  if (binding.key !== e.key && binding.key.toLowerCase() !== e.key.toLowerCase()) return false;
  const ctrl = e.ctrlKey || e.metaKey;
  if (!!binding.ctrl !== !!ctrl) return false;
  if (!!binding.shift !== !!e.shiftKey) return false;
  if (!!binding.alt !== !!e.altKey) return false;
  return true;
}

function normalizeRecordedKey(e) {
  e.preventDefault();
  e.stopPropagation();
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt = e.altKey;
  let key = e.key;
  // 忽略单独的修饰键
  if (key === 'Control' || key === 'Meta' || key === 'Shift' || key === 'Alt') return null;
  // 将单字符统一小写存储，展示时转大写
  if (key.length === 1) key = key.toLowerCase();
  return { ctrl, shift, alt, key };
}

function openShortcutsPanel() {
  const overlay = document.getElementById('shortcutsPanelOverlay');
  const panel = document.getElementById('shortcutsPanel');
  if (!overlay || !panel) return;
  renderShortcutsPanel();
  overlay.classList.add('show');
  panel.classList.add('show');
}

function closeShortcutsPanel() {
  const overlay = document.getElementById('shortcutsPanelOverlay');
  const panel = document.getElementById('shortcutsPanel');
  if (!overlay || !panel) return;
  overlay.classList.remove('show');
  panel.classList.remove('show');
  recordingShortcut = null;
}

function renderShortcutsPanel() {
  const list = document.getElementById('shortcutsList');
  if (!list) return;
  list.innerHTML = '';
  Object.keys(keybindings).forEach(actionKey => {
    const binding = keybindings[actionKey];
    const item = document.createElement('div');
    item.className = 'shortcuts-item';

    const info = document.createElement('div');
    info.className = 'shortcuts-item-info';
    info.innerHTML = `<div class="shortcuts-item-name">${escapeHtml(binding.label)}</div><div class="shortcuts-item-desc">${escapeHtml(binding.desc)}</div>`;

    const wrap = document.createElement('div');
    wrap.className = 'shortcuts-item-input-wrap';

    const input = document.createElement('input');
    input.className = 'shortcuts-item-input';
    input.type = 'text';
    input.readOnly = true;
    input.value = getShortcutDisplay(binding);
    input.dataset.action = actionKey;
    input.title = '点击录制新快捷键';
    input.addEventListener('click', () => {
      recordingShortcut = actionKey;
      input.value = '按快捷键…';
      input.classList.add('recording');
      input.focus();
    });
    input.addEventListener('blur', () => {
      if (recordingShortcut === actionKey) {
        input.value = getShortcutDisplay(keybindings[actionKey]);
        input.classList.remove('recording');
        recordingShortcut = null;
      }
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'shortcuts-item-btn';
    resetBtn.title = '恢复默认';
    resetBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8a5 5 0 1 1 5 5"/><path d="M3 8v3h3"/></svg>';
    resetBtn.addEventListener('click', () => {
      keybindings[actionKey] = Object.assign({}, DEFAULT_KEYBINDINGS[actionKey]);
      input.value = getShortcutDisplay(keybindings[actionKey]);
    });

    wrap.appendChild(input);
    wrap.appendChild(resetBtn);
    item.appendChild(info);
    item.appendChild(wrap);
    list.appendChild(item);
  });
}

function updateToolbarTitles() {
  const undoBtn = document.getElementById('btnUndo');
  const redoBtn = document.getElementById('btnRedo');
  const themeBtn = document.getElementById('btnTheme');
  if (undoBtn) undoBtn.title = `撤销 (${getShortcutDisplay(keybindings.undo)})`;
  if (redoBtn) redoBtn.title = `重做 (${getShortcutDisplay(keybindings.redo)})`;
  if (themeBtn) themeBtn.title = `切换主题 (${getShortcutDisplay(keybindings.toggleTheme)})`;
}

function handleShortcutsKeyDown(e) {
  if (recordingShortcut) return;
  if (e.target.closest('input, textarea, select')) return;

  // 先处理需要Ctrl的组合键
  const ctrl = e.ctrlKey || e.metaKey;

  if (matchKeyBinding(e, keybindings.openShortcuts)) {
    e.preventDefault();
    openShortcutsPanel();
    return;
  }
  if (matchKeyBinding(e, keybindings.toggleAIPanel)) {
    e.preventDefault();
    toggleAIPanel();
    return;
  }
  if (matchKeyBinding(e, keybindings.toggleTheme)) {
    e.preventDefault();
    cycleTheme();
    return;
  }
  if (matchKeyBinding(e, keybindings.arrangeNodes)) {
    e.preventDefault();
    arrangeNodes();
    return;
  }
  if (matchKeyBinding(e, keybindings.runWorkflow)) {
    e.preventDefault();
    runWorkflow({ force: e.shiftKey }); // Shift+Ctrl+Enter = 强制全量（绕过增量缓存）
    return;
  }
  if (matchKeyBinding(e, keybindings.fitContent)) {
    e.preventDefault();
    fitToContent();
    return;
  }
  if (matchKeyBinding(e, keybindings.resetZoom)) {
    e.preventDefault();
    resetZoom();
    return;
  }
  if (matchKeyBinding(e, keybindings.selectAll)) {
    e.preventDefault();
    selectAllNodes();
    return;
  }
  if (matchKeyBinding(e, keybindings.deleteSelected)) {
    e.preventDefault();
    // B：仅选中连线（无选中节点）时按 Delete → 删除连线
    if (__selectedEdge && workflow.selection.size === 0) {
      deleteEdgeById(__selectedEdge.id);
      return;
    }
    clearEdgeSelection();
    workflow.selection.forEach(id => deleteNode(id));
    return;
  }
  if (matchKeyBinding(e, keybindings.duplicateSelected)) {
    e.preventDefault();
    workflow.selection.forEach(id => {
      const n = workflow.nodes.get(id);
      if (n) duplicateNode(n);
    });
    return;
  }
  if (matchKeyBinding(e, keybindings.undo)) {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (matchKeyBinding(e, keybindings.redo)) {
    e.preventDefault();
    redo();
    return;
  }
}

function handleShortcutsRecording(e) {
  if (!recordingShortcut) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    recordingShortcut = null;
    renderShortcutsPanel();
    return;
  }
  const combo = normalizeRecordedKey(e);
  if (!combo) return;
  // 至少需要包含一个非单字符修饰键或者普通键
  keybindings[recordingShortcut] = Object.assign({}, keybindings[recordingShortcut], combo);
  recordingShortcut = null;
  renderShortcutsPanel();
}

//================ 10. 画布平移与缩放 ================
let panning = false;
let panStart = null;
let isSpacePressed = false;
let selDragStart = null;     // 框选起点（视口坐标）
let isBoxSelecting = false;  // 是否正在框选
let rubberEl = null;         // 橡皮筋矩形 DOM

canvasWrap.addEventListener('mousedown', (e) => {
  const isOnNode = e.target.closest('.node');
  const isOnPort = e.target.closest('.node-port');
  if (isOnNode || isOnPort) return;
  // UI 控件（AI 面板/按钮/输入框等，多为 canvasWrap 子元素且事件会冒泡上来）直接放行，
  // 避免误触发框选逻辑、尤其 preventDefault 会冻结焦点导致快捷键失效
  if (e.target.closest('.ai-panel, .context-menu, .modal, .minimap, .node-composer, .edge-delete-btn, button, input, textarea, select, a, label, [contenteditable="true"], [role="button"]')) return;

  // B：点击连线本身 → 选中并显示中点 ✕；未命中连线且已选中 → 取消选中
  if (e.button === 0) {
    const rect = canvasWrap.getBoundingClientRect();
    const hit = hitTestEdges(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) { selectEdge(hit); e.preventDefault(); return; }
    if (__selectedEdge) { clearEdgeSelection(); }
  }

  // 空格键 或 中键 → 平移
  if (e.button === 1 || (isSpacePressed && e.button === 0)) {
    panning = true;
    panStart = { x: e.clientX, y: e.clientY, camX: workflow.camera.x, camY: workflow.camera.y };
    canvasWrap.classList.add('panning');
    e.preventDefault();
  } else if (e.button === 0) {
    // 空白左键按下：记录起点，松开时再判定是“单击清除”还是“框选”
    selDragStart = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
});

window.addEventListener('mousemove', (e) => {
  if (panning && panStart) {
    workflow.camera.x = panStart.camX + (e.clientX - panStart.x);
    workflow.camera.y = panStart.camY + (e.clientY - panStart.y);
    applyTransform();
    markEdgesDirty();
  } else if (selDragStart && !(typeof connecting !== 'undefined' && connecting)) {
    const dx = e.clientX - selDragStart.x;
    const dy = e.clientY - selDragStart.y;
    if (Math.hypot(dx, dy) > 5) {
      isBoxSelecting = true;
      if (!rubberEl) {
        rubberEl = document.createElement('div');
        rubberEl.className = 'rubber-band';
        document.body.appendChild(rubberEl);
      }
      const left = Math.min(selDragStart.x, e.clientX);
      const top = Math.min(selDragStart.y, e.clientY);
      rubberEl.style.left = left + 'px';
      rubberEl.style.top = top + 'px';
      rubberEl.style.width = Math.abs(dx) + 'px';
      rubberEl.style.height = Math.abs(dy) + 'px';
    }
  }
});

window.addEventListener('mouseup', (e) => {
  if (panning) {
    panning = false;
    panStart = null;
    canvasWrap.classList.remove('panning');
  }
  if (isBoxSelecting) {
    const band = rubberEl.getBoundingClientRect();
    const additive = !!(e && e.shiftKey);
    if (!additive) {
      workflow.selection.forEach(id => {
        const n = workflow.nodes.get(id);
        if (n && n.el) n.el.classList.remove('selected');
      });
      workflow.selection.clear();
    }
    let lastComposerNode = null;
    workflow.nodes.forEach(node => {
      if (!node.el) return;
      const nr = node.el.getBoundingClientRect();
      if (nr.left < band.right && nr.right > band.left && nr.top < band.bottom && nr.bottom > band.top) {
        workflow.selection.add(node.id);
        node.el.classList.add('selected');
        if (isComposerType(node)) lastComposerNode = node;
      }
    });
    if (rubberEl && rubberEl.parentNode) rubberEl.parentNode.removeChild(rubberEl);
    rubberEl = null;
    isBoxSelecting = false;
    selDragStart = null;
    // #5：多选只对「最后一个」生成节点生效
    lastComposerNode ? showNodeComposer(lastComposerNode) : hideNodeComposer();
  } else if (selDragStart) {
    // 单击空白（未拖动）→ 清除选中
    workflow.selection.forEach(id => {
      const n = workflow.nodes.get(id);
      if (n && n.el) n.el.classList.remove('selected');
    });
    workflow.selection.clear();
    selDragStart = null;
    // #5：空白点击收起 Composer
    hideNodeComposer();
  }
});

window.addEventListener('keydown', (e) => {
  // 录制快捷键时优先交给录制处理器
  if (recordingShortcut) {
    handleShortcutsRecording(e);
    return;
  }

  if (e.code === 'Space' && !(e.target && e.target.closest && e.target.closest('input, textarea'))) {
    isSpacePressed = true;
    canvasWrap.classList.add('space-down');
    e.preventDefault();
  }

  // 兼容系统惯例：Ctrl+Shift+Z 优先重做
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') && !e.target.closest('input, textarea, select')) {
    e.preventDefault();
    redo();
    return;
  }

  handleShortcutsKeyDown(e);
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    isSpacePressed = false;
    canvasWrap.classList.remove('space-down');
  }
});

// 滚轮缩放（鼠标位置为锚点），鼠标在 AI 面板内时让面板正常滚动
var aiPanelEl = document.getElementById('aiPanel');
canvasWrap.addEventListener('wheel', (e) => {
  if (aiPanelEl && aiPanelEl.contains(e.target)) return;
  e.preventDefault();
  const rect = canvasWrap.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.1 : (1 / 1.1);
  workflow.camera.zoomAt(sx, sy, factor);
  applyTransform();
  markEdgesDirty();
}, { passive: false });

function applyTransform() {
  const cam = workflow.camera;
  nodeLayer.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`;
  const pct = Math.round(cam.zoom * 100) + '%';
  document.getElementById('statZoom').textContent = pct;
  document.getElementById('zoomDisplay').textContent = pct;
  drawGrid();
  renderMinimap();
  // #5：画布平移/缩放时 Composer 跟随选中节点
  positionNodeComposer();
}

//================ 11b. 小地图导航 ================
const mmCanvas = document.getElementById('minimapCanvas');
const mmCtx = mmCanvas.getContext('2d');
let mmState = null; // { scale, minX, minY } 供点击反推世界坐标

function renderMinimap() {
  const cv = mmCanvas;
  const cssW = cv.clientWidth;
  const cssH = cv.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.max(1, Math.floor(cssW * dpr));
  const targetH = Math.max(1, Math.floor(cssH * dpr));
  if (cv.width !== targetW || cv.height !== targetH) {
    cv.width = targetW;
    cv.height = targetH;
    mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const W = cssW, H = cssH;
  mmCtx.clearRect(0, 0, W, H);
  const nodes = [...workflow.nodes.values()];
  const cam = workflow.camera;

  // 世界包围盒（节点 + 当前视口）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height);
  });
  const viewMinX = -cam.x / cam.zoom;
  const viewMinY = -cam.y / cam.zoom;
  const viewMaxX = (canvasWrap.clientWidth - cam.x) / cam.zoom;
  const viewMaxY = (canvasWrap.clientHeight - cam.y) / cam.zoom;
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = canvasWrap.clientWidth; maxY = canvasWrap.clientHeight; }
  minX = Math.min(minX, viewMinX); minY = Math.min(minY, viewMinY);
  maxX = Math.max(maxX, viewMaxX); maxY = Math.max(maxY, viewMaxY);

  const pad = 24;
  const boundMinX = minX - pad, boundMinY = minY - pad;
  const worldW = (maxX - minX) + pad * 2;
  const worldH = (maxY - minY) + pad * 2;
  const scale = Math.min(W / worldW, H / worldH);
  mmState = { scale, minX: boundMinX, minY: boundMinY };

  const toX = wx => (wx - boundMinX) * scale;
  const toY = wy => (wy - boundMinY) * scale;

  // 画节点（按类型色着色）
  nodes.forEach(n => {
    const x = toX(n.x), y = toY(n.y);
    const w = Math.max(2.5, n.width * scale);
    const h = Math.max(2.5, n.height * scale);
    mmCtx.fillStyle = (n.def && n.def.colorRaw) || '#5B8DEF';
    mmCtx.globalAlpha = (n.el && n.el.classList.contains('selected')) ? 1 : 0.82;
    mmCtx.fillRect(x, y, w, h);
  });
  mmCtx.globalAlpha = 1;

  // 画当前视口框（主题感知）
  const theme = document.body.getAttribute('data-theme');
  const isDark = !theme || theme === 'dark';
  const vx = toX(viewMinX), vy = toY(viewMinY);
  const vw = (viewMaxX - viewMinX) * scale, vh = (viewMaxY - viewMinY) * scale;
  mmCtx.fillStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  mmCtx.fillRect(vx, vy, vw, vh);
  mmCtx.strokeStyle = isDark ? '#ffffff' : 'rgba(0,0,0,0.55)';
  mmCtx.lineWidth = 1.5;
  mmCtx.strokeRect(vx, vy, vw, vh);
}

// 点击/拖拽小地图 → 平移视口使对应世界点居中
function minimapNavigate(e) {
  if (!mmState) return;
  const rect = mmCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const wx = mmState.minX + mx / mmState.scale;
  const wy = mmState.minY + my / mmState.scale;
  const cam = workflow.camera;
  cam.x = canvasWrap.clientWidth / 2 - wx * cam.zoom;
  cam.y = canvasWrap.clientHeight / 2 - wy * cam.zoom;
  applyTransform();
  markEdgesDirty();
}

let mmDragging = false;
mmCanvas.addEventListener('mousedown', (e) => { mmDragging = true; minimapNavigate(e); e.preventDefault(); });
window.addEventListener('mousemove', (e) => { if (mmDragging) minimapNavigate(e); });
window.addEventListener('mouseup', () => { mmDragging = false; });

// 小地图折叠/展开
const minimapEl = document.getElementById('minimap');
document.getElementById('minimapToggle').addEventListener('click', () => {
  minimapEl.classList.toggle('collapsed');
  document.getElementById('minimapToggle').textContent = minimapEl.classList.contains('collapsed') ? '+' : '−';
});

//================ 11c. 自动整理布局 ================
function arrangeNodes() {
  const nodes = [...workflow.nodes.values()];
  if (nodes.length === 0) { showToast('画布为空，无可整理节点'); return; }

  // 构建邻接与入度
  const indeg = new Map();
  const adj = new Map();
  nodes.forEach(n => { indeg.set(n.id, 0); adj.set(n.id, []); });
  workflow.edges.forEach(e => {
    if (e.from && e.from.node && e.to && e.to.node && e.from.node.id !== e.to.node.id) {
      adj.get(e.from.node.id).push(e.to.node.id);
      indeg.set(e.to.node.id, indeg.get(e.to.node.id) + 1);
    }
  });

  // Kahn 拓扑分层，记录最长路径深度
  const depth = new Map();
  nodes.forEach(n => depth.set(n.id, 0));
  const indegCopy = new Map(indeg);
  const queue = nodes.filter(n => indeg.get(n.id) === 0).map(n => n.id);
  let head = 0;
  const visited = new Set();
  while (head < queue.length) {
    const id = queue[head++];
    visited.add(id);
    adj.get(id).forEach(nid => {
      depth.set(nid, Math.max(depth.get(nid), depth.get(id) + 1));
      indegCopy.set(nid, indegCopy.get(nid) - 1);
      if (indegCopy.get(nid) === 0) queue.push(nid);
    });
  }
  // 环中节点（未被访问）归到第 0 层
  nodes.forEach(n => { if (!visited.has(n.id)) depth.set(n.id, 0); });

  // 按深度分列，列内保持当前节点顺序
  const cols = new Map();
  nodes.forEach(n => {
    const d = depth.get(n.id);
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d).push(n);
  });

  const colGap = 360, rowGap = 36;
  const baseX = 80, baseY = 80;
  [...cols.keys()].sort((a, b) => a - b).forEach(d => {
    let y = baseY;
    cols.get(d).forEach(n => {
      n.x = baseX + d * colGap;
      n.y = y;
      y += n.height + rowGap;
    });
  });

  pushHistory();
  nodes.forEach(n => {
    if (n.el) {
      n.el.classList.add('arranging');
      n.el.style.left = n.x + 'px';
      n.el.style.top = n.y + 'px';
    }
  });
  setTimeout(() => {
    nodes.forEach(n => { if (n.el) n.el.classList.remove('arranging'); });
  }, 420);

  markEdgesDirty();
  applyTransform();
  fitToContent();
  updateStatusbar();
  scheduleAutosave();
  renderMinimap();
  showToast('已自动整理布局（按连线分层排列）');
}

// 工具栏「自动整理」按钮
document.getElementById('btnArrange').addEventListener('click', arrangeNodes);

// 主题切换按钮
const THEMES = [
  { key: '', label: '黑底' },
  { key: 'light', label: '白底' },
  { key: 'eye-care', label: '护眼模式' }
];
function refreshThemeColors() {
  COLORS.bgDeepest  = getCSSVar('--bg-deepest');
  COLORS.primary    = getCSSVar('--color-primary');
  COLORS.danger     = getCSSVar('--color-danger');
  COLORS.success    = getCSSVar('--color-success');
  COLORS.gridOrigin = getCSSVar('--grid-origin');
  COLORS.gridDotRGB = parseRGB(getCSSVar('--grid-line-minor'));
}
function cycleTheme() {
  const body = document.body;
  const current = body.getAttribute('data-theme') || '';
  const idx = THEMES.findIndex(t => t.key === current);
  const next = THEMES[(idx + 1) % THEMES.length];
  if (next.key) body.setAttribute('data-theme', next.key);
  else body.removeAttribute('data-theme');
  localStorage.setItem('flowcraft-theme', next.key);
  refreshThemeColors();
  drawGrid();
  renderMinimap();
  showToast('已切换为「' + next.label + '」主题', 'info');
}
document.getElementById('btnTheme').addEventListener('click', cycleTheme);

// 背景模式：点阵 / 网格 / 纯色（与主题解耦，独立持久化）
const BG_MODES = [
  { key: 'dot',   label: '点阵' },
  { key: 'grid',  label: '网格' },
  { key: 'solid', label: '纯色' }
];
bgMode = localStorage.getItem('flowcraft-bg-mode') || 'dot';
function updateBgModeBtn() {
  const b = document.getElementById('btnBgMode');
  if (!b) return;
  const cur = BG_MODES.find(t => t.key === bgMode) || BG_MODES[0];
  b.title = '背景模式：' + cur.label + '（点击切换）';
  const lbl = b.querySelector('.tb-bgmode-label');
  if (lbl) lbl.textContent = cur.label;
}
function cycleBgMode() {
  const idx = BG_MODES.findIndex(t => t.key === bgMode);
  const next = BG_MODES[(idx + 1) % BG_MODES.length];
  bgMode = next.key;
  localStorage.setItem('flowcraft-bg-mode', bgMode);
  drawGrid();
  updateBgModeBtn();
  showToast('背景模式：' + next.label, 'info');
}
document.getElementById('btnBgMode').addEventListener('click', cycleBgMode);
updateBgModeBtn();

// 缩放控件
document.getElementById('zoomIn').onclick = () => {
  const rect = canvasWrap.getBoundingClientRect();
  workflow.camera.zoomAt(rect.width / 2, rect.height / 2, 1.2);
  applyTransform();
  markEdgesDirty();
};
document.getElementById('zoomOut').onclick = () => {
  const rect = canvasWrap.getBoundingClientRect();
  workflow.camera.zoomAt(rect.width / 2, rect.height / 2, 1 / 1.2);
  applyTransform();
  markEdgesDirty();
};
document.getElementById('zoomFit').onclick = () => fitToContent();
// 点击缩放百分比 → 回到 100%（以画布中心为锚点）
const zoomDisplayEl = document.getElementById('zoomDisplay');
zoomDisplayEl.title = '点击回到 100%';
zoomDisplayEl.onclick = () => {
  const cam = workflow.camera;
  if (Math.abs(cam.zoom - 1) < 1e-6) return;
  const rect = canvasWrap.getBoundingClientRect();
  cam.zoomAt(rect.width / 2, rect.height / 2, 1 / cam.zoom);
  applyTransform();
  markEdgesDirty();
};

function fitToContent() {
  if (workflow.nodes.size === 0) {
    workflow.camera.x = canvasWrap.clientWidth / 2;
    workflow.camera.y = canvasWrap.clientHeight / 2;
    workflow.camera.zoom = 1;
    applyTransform();
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  workflow.nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });
  const w = maxX - minX, h = maxY - minY;
  const pad = 80;
  const availW = canvasWrap.clientWidth - pad * 2;
  const availH = canvasWrap.clientHeight - 80 - pad; // 减去状态栏和缩放控件
  const z = Math.min(availW / w, availH / h, 1.5);
  workflow.camera.zoom = Math.max(workflow.camera.MIN_ZOOM, z);
  workflow.camera.x = canvasWrap.clientWidth / 2 - (minX + w / 2) * workflow.camera.zoom;
  workflow.camera.y = (canvasWrap.clientHeight - 28) / 2 - (minY + h / 2) * workflow.camera.zoom + 14;
  applyTransform();
  markEdgesDirty();
}

//================ 11. 网格绘制 (Canvas 网点) ================
function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;

  [gridCanvas, edgeCanvas].forEach(cv => {
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  });

  drawGrid();
  markEdgesDirty();
}

function drawGrid() {
  const ctx = gridCtx;
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  const cam = workflow.camera;

  // 背景底色（所有模式通用）
  ctx.fillStyle = COLORS.bgDeepest;
  ctx.fillRect(0, 0, w, h);

  // LOD 策略：基础间距 24 屏幕像素，随缩放放大；过小则倍增直到 ≥ 8px
  const baseSpacing = 24;
  let spacing = baseSpacing * cam.zoom;
  while (spacing < 8) spacing *= 2;
  const offsetX = cam.x % spacing;
  const offsetY = cam.y % spacing;

  const c = COLORS.gridDotRGB;

  if (bgMode === 'grid') {
    // —— 线网格模式：横竖细线 ——
    const alpha = cam.zoom > 1 ? 0.05 : 0.035;
    ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < w; x += spacing) {
      const px = Math.round(x) + 0.5;
      ctx.moveTo(px, 0); ctx.lineTo(px, h);
    }
    for (let y = offsetY; y < h; y += spacing) {
      const py = Math.round(y) + 0.5;
      ctx.moveTo(0, py); ctx.lineTo(w, py);
    }
    ctx.stroke();
  } else if (bgMode === 'dot') {
    // —— 网点模式（原行为）——
    const alpha = cam.zoom > 1 ? 0.06 : 0.04;
    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
    for (let x = offsetX; x < w; x += spacing) {
      for (let y = offsetY; y < h; y += spacing) {
        ctx.fillRect(Math.round(x), Math.round(y), 1.5, 1.5);
      }
    }
  }
  // bgMode === 'solid'：仅纯色底，不绘制任何图案

  // 原点标记（世界原点 0,0 处的十字；纯色模式下不画，保持纯净）
  if (bgMode !== 'solid') {
    const origin = cam.worldToScreen(0, 0);
    if (origin.x > -20 && origin.x < w + 20 && origin.y > -20 && origin.y < h + 20) {
      ctx.strokeStyle = COLORS.gridOrigin;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(origin.x - 10, origin.y);
      ctx.lineTo(origin.x + 10, origin.y);
      ctx.moveTo(origin.x, origin.y - 10);
      ctx.lineTo(origin.x, origin.y + 10);
      ctx.stroke();
    }
  }
}

window.addEventListener('resize', () => { resizeCanvases(); });

//================ 12. 连线绘制 (Canvas 贝塞尔) ================
let edgesDirty = false;
// P3：hover 节点 → 该节点涉及的所有连线恢复高亮，其余连线弱化
let __hoveredNodeId = null;
document.addEventListener('mouseover', (e) => {
  const nEl = e.target && e.target.closest ? e.target.closest('.node') : null;
  const id = nEl ? nEl.dataset.id : null;
  if (id !== __hoveredNodeId) { __hoveredNodeId = id; markEdgesDirty(); }
});
// ===== B 点击连线可删除 =====
// 点击连线本身 → 选中并高亮，中点浮现 ✕ 删除按钮；点 ✕ 或按 Delete/Backspace 删除。
let __selectedEdge = null;
const EDGE_HIT_THRESHOLD = 10; // 命中阈值（屏幕 px）

// 采样贝塞尔曲线点（与 drawBezier 同参数），用于命中测试与中点定位
function sampleBezierPoints(x1, y1, x2, y2, n = 24) {
  const dx = Math.max(50, Math.abs(x2 - x1) * 0.5);
  const cp1x = x1 + dx, cp1y = y1;
  const cp2x = x2 - dx, cp2y = y2;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * mt * x1 + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * x2,
      y: mt * mt * mt * y1 + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * y2,
    });
  }
  return pts;
}
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}
// 命中测试：返回离屏幕点最近且距离 < threshold 的连线
function hitTestEdges(sx, sy, threshold = EDGE_HIT_THRESHOLD) {
  let best = null, bestDist = threshold;
  workflow.edges.forEach(edge => {
    const fn = edge.from.node, tn = edge.to.node;
    if (!fn.el || !tn.el) return;
    const fp = getPortScreenPos(fn, 'output', edge.from.port);
    const tp = getPortScreenPos(tn, 'input', edge.to.port);
    const pts = sampleBezierPoints(fp.x, fp.y, tp.x, tp.y);
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment(sx, sy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < bestDist) { bestDist = d; best = edge; }
    }
  });
  return best;
}

function selectEdge(edge) {
  __selectedEdge = edge;
  markEdgesDirty();
  // 立即显示中点 ✕（不依赖下一帧 RAF）
  positionEdgeDeleteBtn();
}
function clearEdgeSelection() {
  if (!__selectedEdge) return;
  __selectedEdge = null;
  const btn = document.getElementById('edgeDeleteBtn');
  if (btn) btn.hidden = true;
  markEdgesDirty();
}

// 删除指定连线（端口若失去唯一连线则取消 connected 标记）
function deleteEdgeById(id) {
  const edge = workflow.edges.get(id);
  if (!edge) return;
  const fn = edge.from.node, tn = edge.to.node;
  const portStillUsed = (node, kind, idx, exceptId) => {
    let used = false;
    workflow.edges.forEach(e => {
      if (e.id === exceptId) return;
      if (e.from.node === node && e.from.kind === kind && e.from.port === idx) used = true;
      if (e.to.node === node && e.to.kind === kind && e.to.port === idx) used = true;
    });
    return used;
  };
  if (!portStillUsed(fn, 'output', edge.from.port, id)) updatePortConnected(fn, 'output', edge.from.port, false);
  if (!portStillUsed(tn, 'input', edge.to.port, id)) updatePortConnected(tn, 'input', edge.to.port, false);
  pushHistory();
  workflow.edges.delete(id);
  clearEdgeSelection();
  markEdgesDirty();
  scheduleAutosave();
  showToast('已删除连线', 'success');
}

// 把 ✕ 删除按钮定位到选中连线中点
function positionEdgeDeleteBtn() {
  const btn = document.getElementById('edgeDeleteBtn');
  const edge = __selectedEdge;
  if (!btn || !edge) return;
  if (!workflow.edges.has(edge.id)) { clearEdgeSelection(); return; }
  const fn = edge.from.node, tn = edge.to.node;
  if (!fn.el || !tn.el) { btn.hidden = true; return; }
  const fp = getPortScreenPos(fn, 'output', edge.from.port);
  const tp = getPortScreenPos(tn, 'input', edge.to.port);
  const pts = sampleBezierPoints(fp.x, fp.y, tp.x, tp.y);
  const mid = pts[Math.floor(pts.length / 2)];
  const bw = btn.offsetWidth || 22, bh = btn.offsetHeight || 22;
  btn.style.left = Math.round(mid.x - bw / 2) + 'px';
  btn.style.top = Math.round(mid.y - bh / 2) + 'px';
  btn.hidden = false;
}

// 初始化删除按钮
(function initEdgeDeleteBtn() {
  const btn = document.getElementById('edgeDeleteBtn');
  if (!btn) return;
  btn.addEventListener('mousedown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (__selectedEdge) deleteEdgeById(__selectedEdge.id);
  });
})();

// ===== #2 工具确认全局开关（Agent 安全闸门）=====
// 开关开启时，Agent 每次执行工具操作前调用 confirmAgentTool 弹确认；关闭则直接放行。
// #1 Agent 抽屉接入前先落地开关 UI + 持久化 + 调用闸门（默认开启，安全优先）。
const TOOL_CONFIRM_STORAGE = 'fc_tool_confirm';

function getToolConfirm() {
  try { return localStorage.getItem(TOOL_CONFIRM_STORAGE) !== '0'; } catch (e) { return true; }
}
function setToolConfirm(on) {
  try { localStorage.setItem(TOOL_CONFIRM_STORAGE, on ? '1' : '0'); } catch (e) {}
  const btn = document.getElementById('toolConfirmToggle');
  if (btn) {
    btn.textContent = on ? '开' : '关';
    btn.setAttribute('aria-checked', String(on));
    btn.classList.toggle('off', !on);
  }
  const hint = document.getElementById('toolConfirmHint');
  if (hint) hint.textContent = on ? 'Agent 执行工具操作前弹确认（安全闸门）' : '已关闭：Agent 执行工具操作不再询问';
}

// Agent 工具调用闸门：返回 Promise<boolean>（true=允许执行）
function confirmAgentTool(desc) {
  return new Promise((resolve) => {
    if (!getToolConfirm()) { resolve(true); return; }
    let allow = false;
    try {
      allow = window.confirm('🛡 Agent 请求执行工具操作：\n\n' + (desc || '未命名操作') + '\n\n是否允许？');
    } catch (e) { allow = false; }
    resolve(allow);
  });
}

// 初始化开关（读取持久化状态 + 绑定点击）
(function initToolConfirmToggle() {
  const btn = document.getElementById('toolConfirmToggle');
  if (!btn) return;
  setToolConfirm(getToolConfirm());
  btn.addEventListener('click', () => {
    setToolConfirm(!getToolConfirm());
    showToast('工具确认已' + (getToolConfirm() ? '开启' : '关闭'), 'info');
  });
})();

// ===== #1 Agent 全站助手抽屉（连接 / 对话 / 历史 / 日志）=====
// 借鉴 Infinite Canvas「Agent 全站助手」：4 Tab + 顶部新对话 + 工具确认开关（复用 #2 同源）。
// 连接目标为「已配置的模型提供方 / 临时端点」，浏览器直连、Key 仅存本地。
const AGENT_CONN_STORAGE = 'fc_agent_conn';
const AGENT_SESSIONS_STORAGE = 'fc_agent_sessions';
const AGENT_CURRENT_STORAGE = 'fc_agent_current';
const AGENT_LOGS_STORAGE = 'fc_agent_logs';
let __agentBusy = false;

function agentEl(id) { return document.getElementById(id); }

// —— 日志 ——
function agentLog(msg, level = 'info') {
  try {
    const arr = JSON.parse(localStorage.getItem(AGENT_LOGS_STORAGE) || '[]');
    arr.unshift({ t: Date.now(), level, msg: String(msg) });
    localStorage.setItem(AGENT_LOGS_STORAGE, JSON.stringify(arr.slice(0, 300)));
  } catch (e) {}
  agentRenderLogs();
}
function agentRenderLogs() {
  const list = agentEl('agentLogList');
  if (!list) return;
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(AGENT_LOGS_STORAGE) || '[]'); } catch (e) {}
  if (!arr.length) { list.innerHTML = '<div class="agent-chat-empty">暂无 Agent 日志。</div>'; return; }
  list.innerHTML = arr.map(e => {
    const d = new Date(e.t);
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0'), ss = String(d.getSeconds()).padStart(2, '0');
    return '<div class="agent-log-item ' + e.level + '"><span class="agent-log-time">' + hh + ':' + mm + ':' + ss + '</span><span class="agent-log-msg">' + escapeHtml(e.msg) + '</span></div>';
  }).join('');
}

// —— 会话历史 ——
function agentSessions() {
  try { const arr = JSON.parse(localStorage.getItem(AGENT_SESSIONS_STORAGE) || '[]'); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
}
function agentSaveSession(messages) {
  try {
    const arr = agentSessions();
    const first = (messages.find(m => m.role === 'user') || {}).content || '';
    const session = { id: 'as_' + Date.now().toString(36), title: first.replace(/\s+/g, ' ').slice(0, 40) || '（空会话）', t: Date.now(), messages: messages.slice() };
    arr.unshift(session);
    localStorage.setItem(AGENT_SESSIONS_STORAGE, JSON.stringify(arr.slice(0, 50)));
  } catch (e) {}
}
function agentPersistCurrentMessages(messages) {
  try {
    const arr = Array.isArray(messages) ? messages.slice() : [];
    if (!arr.length) { localStorage.removeItem(AGENT_CURRENT_STORAGE); return; }
    localStorage.setItem(AGENT_CURRENT_STORAGE, JSON.stringify(arr));
  } catch (e) {}
}
function agentRestoreCurrentMessages() {
  try {
    const raw = localStorage.getItem(AGENT_CURRENT_STORAGE);
    if (!raw) return false;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return false;
    window.__agentMessages = arr.slice();
    return true;
  } catch (e) { return false; }
}
function agentRenderHist() {
  const list = agentEl('agentHistList');
  if (!list) return;
  const arr = agentSessions();
  if (!arr.length) { list.innerHTML = '<div class="agent-chat-empty">暂无历史会话。</div>'; return; }
  list.innerHTML = arr.map(s => {
    const d = new Date(s.t);
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    const n = (s.messages || []).filter(m => m.role === 'user').length;
    return '<button type="button" class="agent-hist-item" data-agent-session="' + s.id + '">' +
      '<span class="agent-hist-title">' + escapeHtml(s.title) + '</span>' +
      '<span class="agent-hist-meta">' + hh + ':' + mm + ' · ' + n + ' 条对话</span></button>';
  }).join('');
  list.querySelectorAll('[data-agent-session]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = agentSessions().find(x => x.id === btn.getAttribute('data-agent-session'));
      if (!s) return;
      window.__agentMessages = (s.messages || []).slice();
      agentRenderChat();
      agentSwitchTab('chat');
    });
  });
}

// —— 连接状态 ——
function agentConnState() {
  try { return JSON.parse(localStorage.getItem(AGENT_CONN_STORAGE) || 'null'); } catch (e) { return null; }
}
function agentSetConnState(st) {
  try { localStorage.setItem(AGENT_CONN_STORAGE, JSON.stringify(st || null)); } catch (e) {}
}
function agentSetConnDot(state, text) {
  const dot = agentEl('agentConnDot'), txt = agentEl('agentConnText');
  if (dot) dot.className = 'agent-dot ' + state;
  if (txt) txt.textContent = text || (state === 'ok' ? '已连接' : state === 'warn' ? '测试中…' : '未连接');
}
function agentSyncConnUI() {
  const conn = agentConnState();
  if (conn && conn.base) agentSetConnDot('ok', '已连接');
  else agentSetConnDot('', '未连接');
}
function agentSetConnMsg(msg, kind) {
  const el = agentEl('agentConnMsg');
  if (el) { el.textContent = msg; el.className = 'agent-conn-msg' + (kind ? ' ' + kind : ''); }
}

// 测试端点可用性：GET {base}/models（复用多路径探测思路：根 /models → /v1/models）
// CORS/网络错误时返回 {corsWarning:true, msg} 而非抛错——让用户能继续连接到已配置提供方（chat/completions 可能仍可用）
function agentTestConnection(base, key) {
  const b = normalizeApiBase(base);
  const headers = { 'Accept': 'application/json' };
  if (key) headers['Authorization'] = 'Bearer ' + key;
  return fetch(b + '/models', { method: 'GET', headers })
    .then(resp => {
      if (!resp.ok) return resp.text().then(t => { throw new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 160) : '')); });
      return resp.json();
    })
    .then(json => {
      const arr = (json && Array.isArray(json.data)) ? json.data : (json && Array.isArray(json.models)) ? json.models : (Array.isArray(json) ? json : []);
      const models = [];
      arr.forEach(m => { const id = (typeof m === 'string') ? m : (m && (m.id || m.name)); if (id && models.indexOf(id) === -1) models.push(id); });
      return { ok: true, models, url: b + '/models' };
    })
    .catch(err => {
      var msg = (err && err.message) || String(err);
      if (/Failed to fetch|NetworkError|TypeError|Load failed/i.test(msg)) {
        return { ok: false, corsWarning: true, msg: msg, url: b + '/models' };
      }
      throw err;
    });
}

// 方式一：使用已配置提供方
function agentConnect() {
  const sel = agentEl('agentProviderSelect');
  const p = (getProviders() || []).find(x => x.id === sel.value);
  if (!p) { agentSetConnMsg('请先在设置中添加模型提供方，或使用「方式二」临时连接。', 'warn'); return; }
  const model = agentEl('agentModelSelect').value;
  agentSetConnDot('warn', '测试中…');
  agentSetConnMsg('正在测试 ' + (p.name || p.base) + ' …', '');
  agentLog('测试连接：' + (p.name || p.base) + '（' + model + '）');
  agentTestConnection(p.base, p.key)
    .then(r => {
      if (r.corsWarning) {
        // CORS/网络阻止 /models 探测：信任已配置项，仍标记已连接（黄色），对话时再验证
        const normBase = normalizeApiBase(p.base);
        agentSetConnState({ provider: p.id, name: p.name || p.base, base: normBase, key: p.key || '', model, ts: Date.now(), corsWarning: true });
        agentSetConnDot('warn', '已连接（探测受限）');
        agentSetConnMsg('无法探测 ' + (p.name || p.base) + ' 的 /models（很可能是 CORS 阻止）。已信任你提供的配置，可直接进入对话验证。', 'warn');
        agentLog('连接：探测受限（CORS）→ 已信任配置 ' + (p.name || p.base) + ' / ' + model);
        return;
      }
      agentSetConnState({ provider: p.id, name: p.name || p.base, base: p.base, key: p.key || '', model, ts: Date.now() });
      agentSetConnDot('ok', '已连接');
      agentSetConnMsg('已连接 ' + (p.name || p.base) + ' · ' + model + (r.models.length ? '（' + r.models.length + ' 个可用模型）' : '') + '。', 'ok');
      agentLog('连接成功：' + (p.name || p.base) + ' / ' + model);
    })
    .catch(err => {
      agentSetConnState(null);
      agentSetConnDot('err', '连接失败');
      agentSetConnMsg('连接失败：' + (err && err.message || err) + '。可改用手动填写，或检查 CORS/端点。', 'warn');
      agentLog('连接失败：' + (err && err.message || err), 'error');
    });
}

// 方式二：临时端点（不持久化到提供方列表）
function agentTempTest() {
  const base = (agentEl('agentTempBase').value || '').trim();
  const key = (agentEl('agentTempKey').value || '').trim();
  const model = (agentEl('agentTempModel').value || '').trim();
  if (!base) { agentSetConnMsg('请填写临时端点地址。', 'warn'); return; }
  agentSetConnDot('warn', '测试中…');
  agentSetConnMsg('正在测试 ' + base + ' …', '');
  agentTestConnection(base, key)
    .then(r => {
      const normBase = normalizeApiBase(base);
      if (r.corsWarning) {
        agentSetConnState({ provider: '', name: base, base: normBase, key, model: model || 'gpt-4o-mini', ts: Date.now(), corsWarning: true });
        agentSetConnDot('warn', '已连接（探测受限）');
        agentSetConnMsg('无法探测临时端点的 /models（很可能是 CORS 阻止）。已信任你提供的配置，可直接进入对话验证。', 'warn');
        agentLog('临时连接：探测受限（CORS）→ 已信任配置 ' + normBase);
        return;
      }
      agentSetConnState({ provider: '', name: base, base: normBase, key, model: model || (r.models[0] || ''), ts: Date.now() });
      agentSetConnDot('ok', '已连接');
      agentSetConnMsg('临时连接成功 · ' + (model || r.models[0] || '默认模型') + (r.models.length ? '（' + r.models.length + ' 个可用模型）' : '') + '。', 'ok');
      agentLog('临时连接成功：' + normBase + (model ? ' / ' + model : ''));
    })
    .catch(err => {
      agentSetConnState(null);
      agentSetConnDot('err', '连接失败');
      agentSetConnMsg('连接失败：' + (err && err.message || err) + '。', 'warn');
      agentLog('临时连接失败：' + (err && err.message || err), 'error');
    });
}

// 提供方/模型下拉
function isLikelyTextModelId(id) {
  var s = String(id || '').trim().toLowerCase();
  if (!s) return false;
  var mediaRe = /(image|img|video|vision|paint|draw|flux|dalle|midjourney|stable[-_ ]?diffusion|sd\d?)/i;
  if (mediaRe.test(s)) return false;
  return /(gpt|claude|deepseek|gemini|qwen|llama|mistral|moonshot|doubao|ernie|kimi|yi|hunyuan|step|chat|o\d)/i.test(s);
}
function isLikelyMultimodalModelId(id) {
  var s = String(id || '').trim().toLowerCase();
  if (!s) return false;
  return /(vision|multimodal|gpt-image|image|img|video|omni|flash-vision|vision-exp|preview)/i.test(s);
}
function isTextCapableProvider(p) {
  if (!p) return false;
  var ids = [];
  if (Array.isArray(p.models)) ids = ids.concat(p.models);
  if (p.model) ids.push(p.model);
  ids = ids.filter(function(v, i, arr) { return v && arr.indexOf(v) === i; });
  if (!ids.length) return false;
  return ids.some(isLikelyTextModelId);
}
function providerCapabilityTag(p) {
  var ids = getAllProviderModels(p);
  if (!ids.length) return '未标记';
  var hasText = ids.some(isLikelyTextModelId);
  var hasMM = ids.some(isLikelyMultimodalModelId);
  var hasMedia = ids.some(function(id) { return /(image|img|video|draw|paint|flux|dalle|midjourney|stable[-_ ]?diffusion|sd\d?)/i.test(String(id || '')); });
  if (hasText && hasMM) return '文本 + 多模态';
  if (hasText) return '文本';
  if (hasMM) return '多模态';
  if (hasMedia) return '图像/视频';
  return '通用';
}
function getAllProviderModels(p) {
  if (!p) return [];
  var ids = [];
  if (Array.isArray(p.models)) ids = ids.concat(p.models);
  if (p.model) ids.push(p.model);
  ids = ids.filter(function(v, i, arr) { return v && arr.indexOf(v) === i; });
  return ids;
}
function getTextCapableModelsForProvider(p) {
  return getAllProviderModels(p).filter(isLikelyTextModelId);
}

function agentFillProviders() {
  const sel = agentEl('agentProviderSelect');
  if (!sel) return;
  const list = getProviders() || [];
  const conn = agentConnState();
  const shownProviders = list;
  sel.innerHTML = '';
  if (!shownProviders.length) {
    const o = document.createElement('option'); o.value = ''; o.textContent = '（暂无提供方，请到设置添加）'; sel.appendChild(o);
  }
  shownProviders.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    var tag = providerCapabilityTag(p);
    o.textContent = (p.name || p.base) + (p.model ? ' · ' + p.model : '') + ' · ' + tag;
    sel.appendChild(o);
  });
  if (conn && conn.provider && shownProviders.some(function(p) { return p.id === conn.provider; })) sel.value = conn.provider;
  agentFillModels(sel.value);
}
function agentFillModels(providerId) {
  const sel = agentEl('agentModelSelect');
  if (!sel) return;
  const p = (getProviders() || []).find(x => x.id === providerId);
  const conn = agentConnState();
  const models = getAllProviderModels(p);
  sel.innerHTML = '';
  if (!models.length) {
    const o = document.createElement('option'); o.value = ''; o.textContent = '（该提供方暂无模型）'; sel.appendChild(o);
  }
  models.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o); });
  if (conn && conn.model && models.indexOf(conn.model) >= 0) sel.value = conn.model;
}

// —— 画布上下文（Agent 可理解的当前状态）——
function agentCanvasContext() {
  try {
    const nodes = [...workflow.nodes.values()];
    const sel = [...workflow.selection];
    const lines = ['当前画布状态：'];
    lines.push('- 节点数：' + nodes.length);
    if (nodes.length) {
      const byType = {};
      nodes.forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1; });
      lines.push('- 节点构成：' + Object.keys(byType).map(t => t + '×' + byType[t]).join('、'));
    }
    if (sel.length) {
      lines.push('- 当前选中：' + sel.map(id => { const n = workflow.nodes.get(id); return n ? (n.title || n.type) : id; }).join('、'));
    }
    lines.push('- 连线数：' + workflow.edges.size);
    const failed = nodes.filter(n => n.status === 'error');
    if (failed.length) lines.push('- 失败节点：' + failed.map(n => (n.title || n.type)).join('、'));
    return lines.join('\n');
  } catch (e) { return '（画布状态读取失败）'; }
}

// —— 对话 ——
function agentRenderChat() {
  const list = agentEl('agentChatList');
  const msgs = window.__agentMessages || [];
  if (!list) return;
  const empty = agentEl('agentChatEmpty');
  if (!msgs.length) { if (empty) empty.style.display = ''; list.innerHTML = ''; return; }
  if (empty) empty.style.display = 'none';
  list.innerHTML = msgs.map(m => {
    if (m.role === 'system') return '';
    const body = escapeHtml(m.content || '').replace(/\n/g, '<br>');
    return '<div class="agent-msg ' + m.role + '"><div class="agent-msg-bubble">' + body + '</div></div>';
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function agentSend() {
  const input = agentEl('agentChatInput');
  const text = (input.value || '').trim();
  if (!text || __agentBusy) return;
  const conn = agentConnState();
  if (!conn || !conn.base) {
    agentLog('对话被拒：未连接 Agent', 'warn');
    agentSetConnMsg('请先在「连接」页连接提供方或临时端点。', 'warn');
    agentSwitchTab('conn');
    return;
  }
  input.value = '';
  input.style.height = 'auto';
  window.__agentMessages = window.__agentMessages || [];
  window.__agentMessages.push({ role: 'user', content: text });
  agentPersistCurrentMessages(window.__agentMessages);
  agentRenderChat();
  __agentBusy = true;
  const sendBtn = agentEl('agentChatSend');
  if (sendBtn) sendBtn.disabled = true;
  agentLog('用户：' + text.slice(0, 80));

  const messages = [
    { role: 'system', content: '你是 FlowCraft 无限画布上的 Agent 全站助手。你能看到当前画布状态（节点构成、选中、连线、失败节点），可据此给出建议、优化提示词、规划节点或排查问题。回答用简洁中文，必要时给步骤清单。\n\n' + agentCanvasContext() }
  ].concat(window.__agentMessages);

  const base = normalizeApiBase(conn.base);
  const key = conn.key || '';
  const model = conn.model || 'gpt-4o-mini';
  const bubble = agentAppendStreamingBubble();
  const url = base + '/chat/completions';

  const doStream = (fetchPromise) => {
    return fetchPromise
      .then(resp => _consumeSSE(resp, (full) => { bubble.textContent = full; agentScrollChat(); }))
      .then(full => {
        const reply = full || '（' + model + ' 返回内容为空）';
        window.__agentMessages.push({ role: 'assistant', content: reply });
        bubble.textContent = reply;
        bubble.classList.remove('streaming');
        agentLog('Agent：' + reply.slice(0, 80));
        agentSaveSession(window.__agentMessages);
        agentPersistCurrentMessages(window.__agentMessages);
        agentScrollChat();
      });
  };

  let req;
  const proxy = _fcProxy();
  // 优先走 FlowCraft 代理（服务端转发，绕过浏览器 CORS）；仅在代理未启用时直连
  if (proxy) {
    req = doStream(proxy.stream({ provider: conn.provider || 'openai', endpoint: '/chat/completions', body: { model, messages, stream: true, temperature: 0.6 }, token: window.FlowCraft.__userToken || undefined }));
  } else {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    req = doStream(fetch(url, { method: 'POST', headers, body: JSON.stringify({ model, messages, stream: true, temperature: 0.6 }) }));
  }

  req.catch(err => {
    var msg = (err && err.message) || String(err);
    // 直连时的 CORS/网络错误：给用户明确指引（启用代理或换支持 CORS 的端点）
    if (!proxy && /Failed to fetch|NetworkError|TypeError|Load failed/i.test(msg)) {
      msg = '直连被浏览器 CORS 阻止。\n\n解决方式：\n1) 启用 FlowCraft API 代理（推荐）：设置 → 高级 → 启用代理（agent 走服务端转发，可绕过 CORS）\n2) 换一个支持浏览器 CORS 的端点\n3) 自建反向代理为该端点添加 CORS 头';
    }
    bubble.textContent = '⚠ ' + msg;
    agentLog(msg, 'error');
    if (window.__agentMessages.length && window.__agentMessages[window.__agentMessages.length - 1].role === 'assistant') window.__agentMessages.pop();
    agentPersistCurrentMessages(window.__agentMessages);
    agentScrollChat();
  }).finally(() => {
    __agentBusy = false;
    if (sendBtn) sendBtn.disabled = false;
  });
}

function agentAppendStreamingBubble() {
  const list = agentEl('agentChatList');
  const empty = agentEl('agentChatEmpty');
  if (empty) empty.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.className = 'agent-msg ai';
  const bubble = document.createElement('div');
  bubble.className = 'agent-msg-bubble streaming';
  wrap.appendChild(bubble);
  list.appendChild(wrap);
  agentScrollChat();
  return bubble;
}
function agentScrollChat() {
  const list = agentEl('agentChatList');
  if (list) list.scrollTop = list.scrollHeight;
}

// —— 新对话 / Tab 切换 ——
function agentNewConversation() {
  window.__agentMessages = [];
  agentPersistCurrentMessages(window.__agentMessages);
  agentRenderChat();
  agentSwitchTab('chat');
  agentLog('新对话已开始');
}
function agentSwitchTab(name) {
  document.querySelectorAll('.agent-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-agent-tab') === name));
  document.querySelectorAll('.agent-tab-pane').forEach(p => { p.hidden = p.getAttribute('data-agent-pane') !== name; });
  if (name === 'hist') agentRenderHist();
  if (name === 'log') agentRenderLogs();
}

// 初始化
(function initAgentDrawer() {
  const drawer = agentEl('agentDrawer');
  if (!drawer) return;
  const toggle = agentEl('agentToggleBtn');
  const open = () => {
    // 互斥：打开 Agent 抽屉时收起 AI 面板（两者都贴在右侧，避免重叠）
    if (typeof toggleAIPanel === 'function') toggleAIPanel(true);
    drawer.hidden = false;
    agentFillProviders(); agentRenderChat(); agentRenderLogs(); agentSyncConnUI();
  };
  const close = () => { drawer.hidden = true; };
  // 🤖 图标点击 = 显隐切换（打开时再点则收起）
  if (toggle) toggle.addEventListener('click', function() { drawer.hidden ? open() : close(); });
  if (agentEl('agentCloseBtn')) agentEl('agentCloseBtn').addEventListener('click', close);
  if (agentEl('agentNewBtn')) agentEl('agentNewBtn').addEventListener('click', agentNewConversation);
  if (agentEl('agentProviderSelect')) agentEl('agentProviderSelect').addEventListener('change', (e) => agentFillModels(e.target.value));
  if (agentEl('agentConnectBtn')) agentEl('agentConnectBtn').addEventListener('click', agentConnect);
  if (agentEl('agentTempTestBtn')) agentEl('agentTempTestBtn').addEventListener('click', agentTempTest);
  if (agentEl('agentChatSend')) agentEl('agentChatSend').addEventListener('click', agentSend);
  if (agentEl('agentChatInput')) {
    const ta = agentEl('agentChatInput');
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agentSend(); }
      ta.style.height = 'auto';
      ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
    });
  }
  if (agentEl('agentHistClear')) agentEl('agentHistClear').addEventListener('click', () => { try { localStorage.removeItem(AGENT_SESSIONS_STORAGE); } catch (e) {} agentRenderHist(); agentLog('历史已清空'); });
  if (agentEl('agentLogClear')) agentEl('agentLogClear').addEventListener('click', () => { try { localStorage.removeItem(AGENT_LOGS_STORAGE); } catch (e) {} agentRenderLogs(); });
  document.querySelectorAll('.agent-tab').forEach(b => b.addEventListener('click', () => agentSwitchTab(b.getAttribute('data-agent-tab'))));
  // 工具确认镜像开关（与 #2 同源）
  const tc = agentEl('agentToolConfirmToggle');
  if (tc) {
    const sync = () => { const on = getToolConfirm(); tc.textContent = on ? '开' : '关'; tc.setAttribute('aria-checked', String(on)); tc.classList.toggle('off', !on); };
    sync();
    tc.addEventListener('click', () => { setToolConfirm(!getToolConfirm()); sync(); showToast('工具确认已' + (getToolConfirm() ? '开启' : '关闭'), 'info'); });
  }
  agentSyncConnUI();
  if (!agentRestoreCurrentMessages()) window.__agentMessages = window.__agentMessages || [];
  window.agentSwitchTab = agentSwitchTab;
})();

// 防止抽屉内 mousedown 冒泡到画布背景逻辑（避免误框选/误选中连线）
(function agentDrawerStopProp() {
  const drawer = agentEl('agentDrawer');
  if (!drawer) return;
  drawer.addEventListener('mousedown', (e) => e.stopPropagation());
})();

// Agent 面板：拖拽移动（通过 header）+ 右下角缩放（与 AI 助手一致）
(function initAgentDragResize() {
  const drawer = agentEl('agentDrawer');
  const header = drawer ? drawer.querySelector('.agent-drawer-head') : null;
  if (!drawer || !header) return;

  // 拖拽
  let dragging = false, offsetX = 0, offsetY = 0;
  header.addEventListener('mousedown', function(e) {
    if (e.target.closest('.agent-btn, .agent-drawer-new, .agent-drawer-close, button, input, textarea, select, a')) return;
    e.preventDefault();
    dragging = true;
    header.classList.add('dragging');
    drawer.style.transition = 'none';
    const rect = drawer.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    e.preventDefault();
    const maxLeft = window.innerWidth - 120;
    const maxTop = window.innerHeight - 60;
    const newLeft = Math.max(-drawer.offsetWidth + 120, Math.min(maxLeft, e.clientX - offsetX));
    const newTop = Math.max(0, Math.min(maxTop, e.clientY - offsetY));
    drawer.style.left = newLeft + 'px';
    drawer.style.top = newTop + 'px';
    drawer.style.right = 'auto'; // 解除 right 定位，改用 left
  });
  document.addEventListener('mouseup', function() {
    if (dragging) {
      dragging = false;
      header.classList.remove('dragging');
      drawer.style.transition = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  // 缩放
  const resizer = agentEl('agentResizer');
  if (resizer) {
    let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;
    resizer.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      resizer.classList.add('dragging');
      drawer.style.transition = 'none';
      sx = e.clientX; sy = e.clientY;
      sw = drawer.offsetWidth; sh = drawer.offsetHeight;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function(e) {
      if (!resizing) return;
      e.preventDefault();
      const dx = e.clientX - sx, dy = e.clientY - sy;
      drawer.style.width = Math.max(300, Math.min(680, sw + dx)) + 'px';
      drawer.style.height = Math.max(360, Math.min(window.innerHeight - 40, sh + dy)) + 'px';
    });
    document.addEventListener('mouseup', function() {
      if (resizing) {
        resizing = false;
        resizer.classList.remove('dragging');
        drawer.style.transition = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }
})();

function markEdgesDirty() { edgesDirty = true; }

function getPortScreenPos(node, kind, idx) {
  const port = node.el.querySelector(`.node-port.${kind}[data-port-idx="${idx}"]`);
  if (!port) return { x: 0, y: 0 };
  const rect = port.getBoundingClientRect();
  const cRect = canvasWrap.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - cRect.left,
    y: rect.top + rect.height / 2 - cRect.top,
  };
}

function drawEdges() {
  if (!edgesDirty) return;
  edgesDirty = false;
  const ctx = edgeCtx;
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  ctx.clearRect(0, 0, w, h);

  // 已建立连线
  workflow.edges.forEach(edge => {
    const fn = edge.from.node;
    const tn = edge.to.node;
    if (!fn.el || !tn.el) return;
    const fp = getPortScreenPos(fn, 'output', edge.from.port);
    const tp = getPortScreenPos(tn, 'input', edge.to.port);

    // 已建立连线统一样式：默认使用同一颜色，仅在 hover / 选中时高亮
    const hasData = !!(fn.outputsData && fn.outputsData[edge.from.port]);
    const lineColor = COLORS.primary;
    // P3：hover 节点 → 其涉及连线恢复高亮；其余连线弱化（半透明细线）
    const related = __hoveredNodeId && (fn.id === __hoveredNodeId || tn.id === __hoveredNodeId);

    // 贝塞尔曲线 — 颜色读取自 CSS 变量, 线宽 2px (有数据时加粗并带辉光)
    ctx.save();
    if (!related) ctx.globalAlpha = 0.35; // P3：默认弱化；hover 相关恢复
    drawBezier(ctx, fp.x, fp.y, tp.x, tp.y, lineColor, related ? 2.8 : 2);
    // 端点实心圆填充（随弱化态）
    if (!related) ctx.globalAlpha = 0.35;
    drawPortDot(ctx, fp.x, fp.y, lineColor);
    drawPortDot(ctx, tp.x, tp.y, lineColor);
    ctx.restore();

    // 标记端口为 connected
    updatePortConnected(fn, 'output', edge.from.port, true);
    updatePortConnected(tn, 'input', edge.to.port, true);
  });

  // B：选中连线 → 高亮描边 + 中点 ✕ 删除按钮
  if (__selectedEdge) {
    const edge = __selectedEdge;
    if (!workflow.edges.has(edge.id)) {
      clearEdgeSelection();
    } else {
      const fn = edge.from.node, tn = edge.to.node;
      if (fn.el && tn.el) {
        const fp = getPortScreenPos(fn, 'output', edge.from.port);
        const tp = getPortScreenPos(tn, 'input', edge.to.port);
        ctx.save();
        ctx.shadowColor = COLORS.accent || '#C76BF7';
        ctx.shadowBlur = 10;
        drawBezier(ctx, fp.x, fp.y, tp.x, tp.y, COLORS.accent || '#C76BF7', 4);
        ctx.restore();
        positionEdgeDeleteBtn();
      }
    }
  } else {
    const btn = document.getElementById('edgeDeleteBtn');
    if (btn) btn.hidden = true;
  }

  // A：拖节点自动连线预览（虚线 + 端点高亮）
  if (__autoConn && __autoConn.fromNode.el && __autoConn.toNode.el) {
    const fp = getPortScreenPos(__autoConn.fromNode, 'output', __autoConn.fromIdx);
    const tp = getPortScreenPos(__autoConn.toNode, 'input', __autoConn.toIdx);
    drawBezierDashed(ctx, fp.x, fp.y, tp.x, tp.y, COLORS.success, 2);
    drawPortDot(ctx, fp.x, fp.y, COLORS.success);
    drawPortDot(ctx, tp.x, tp.y, COLORS.success, 6);
  }

  // 拖拽中临时线（草稿线：虚线 + 半透明）
  if (workflow.pendingConnection) {
    const pc = workflow.pendingConnection;
    const fp = getPortScreenPos(pc.fromNode, pc.fromKind, pc.fromIdx);
    const valid = pc.valid;
    // B 磁吸（snap）命中 → 与 A 自动连线预览同款绿色；普通悬停有效端口 → 主蓝；无效 → 危险红
    const snapped = connecting && connecting.snapped;
    const color = valid ? (snapped ? COLORS.success : COLORS.primary) : COLORS.danger;

    // 草稿线：虚线
    drawBezierDashed(ctx, fp.x, fp.y, pc.toX, pc.toY, color, 2);
    drawPortDot(ctx, fp.x, fp.y, color);

    // hover 端口高亮
    if (workflow.hoveredPort) {
      const hp = getPortScreenPos(workflow.hoveredPort.node, workflow.hoveredPort.kind, workflow.hoveredPort.idx);
      drawPortDot(ctx, hp.x, hp.y, valid ? (snapped ? COLORS.success : COLORS.primary) : COLORS.danger, 6);
    }
  }
}

function drawBezier(ctx, x1, y1, x2, y2, color, width) {
  // 控制点偏移: max(50, |dx|*0.5)
  const dx = Math.max(50, Math.abs(x2 - x1) * 0.5);
  const cp1x = x1 + dx, cp1y = y1;
  const cp2x = x2 - dx, cp2y = y2;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
  ctx.stroke();
}

function drawBezierDashed(ctx, x1, y1, x2, y2, color, width) {
  const dx = Math.max(50, Math.abs(x2 - x1) * 0.5);
  const cp1x = x1 + dx, cp1y = y1;
  const cp2x = x2 - dx, cp2y = y2;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.6;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawPortDot(ctx, x, y, color, radius = 4) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function updatePortConnected(node, kind, idx, connected) {
  const port = node.el.querySelector(`.node-port.${kind}[data-port-idx="${idx}"]`);
  if (!port) return;
  if (connected) port.classList.add('connected');
  else port.classList.remove('connected');
}

//================ 13. RAF 循环 ================
function loop() {
  drawEdges();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

//================ 14. 端口拖拽连线 ================
let connecting = null;

canvasWrap.addEventListener('mousedown', (e) => {
  const portEl = e.target.closest('.node-port');
  if (!portEl) return;
  e.stopPropagation();
  e.preventDefault();

  const node = workflow.nodes.get(portEl.dataset.node);
  if (!node) return;

  connecting = {
    fromNode: node,
    fromKind: portEl.dataset.kind,
    fromIdx: parseInt(portEl.dataset.portIdx),
    fromType: portEl.dataset.portType,
    snapped: false,
  };
  document.body.classList.add('canvas-ports-visible'); // P1：拖端口时全图端口可见

  // 标记起始端口为 connecting
  portEl.classList.add('connecting');

  workflow.pendingConnection = {
    fromNode: node,
    fromKind: portEl.dataset.kind,
    fromIdx: parseInt(portEl.dataset.portIdx),
    toX: e.clientX - canvasWrap.getBoundingClientRect().left,
    toY: e.clientY - canvasWrap.getBoundingClientRect().top,
    valid: false,
  };
});

window.addEventListener('mousemove', (e) => {
  if (!connecting) return;
  const rect = canvasWrap.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  let snappedPort = false;
  if (connecting) connecting.snapped = false; // 每帧复位，磁吸仅在下方 snap 块置 true

  const portEl = e.target.closest && e.target.closest('.node-port');
  let hovered = null, valid = false;

  // 清除之前的 compatible 标记
  workflow.nodes.forEach(n => {
    n.el.querySelectorAll('.node-port.compatible, .node-port.incompatible').forEach(p => {
      p.classList.remove('compatible', 'incompatible');
    });
  });

  if (portEl && portEl.dataset.node !== connecting.fromNode.id) {
    const toKind = portEl.dataset.kind;
    // 方向验证: output→input 或 input→output (双向)
    const isOpposite = connecting.fromKind !== toKind;
    if (isOpposite) {
      const toType = portEl.dataset.portType;
      const toNodeId = portEl.dataset.node;
      // T2-3 节点数据契约：优先用 FlowCraft.nodes.validateConnection（含原因），未注入时回退原类型相等校验
      const vres = (window.FlowCraft && window.FlowCraft.nodes && window.FlowCraft.nodes.validateConnection)
        ? window.FlowCraft.nodes.validateConnection({
            from: { nodeType: connecting.fromNode.type, portIdx: connecting.fromIdx, kind: connecting.fromKind, portType: connecting.fromType },
            to:   { nodeType: (workflow.nodes.get(toNodeId) || {}).type, portIdx: parseInt(portEl.dataset.portIdx), kind: toKind, portType: toType },
          })
        : null;
      if (vres) { valid = vres.ok; connecting.reason = vres.reason || ''; }
      else { valid = connecting.fromType === toType; connecting.reason = ''; }
      hovered = {
        node: workflow.nodes.get(toNodeId),
        kind: toKind,
        idx: parseInt(portEl.dataset.portIdx),
      };
      // 高亮兼容/不兼容端口
      if (valid) portEl.classList.add('compatible');
      else {
        portEl.classList.add('incompatible');
        portEl.title = connecting.reason || '类型不匹配';
      }
    }
  }

  // B：端口拖拽时，若光标未落在任何端口上、但靠近某节点兼容端口（窗口 = 自动连线同款阈值，按 zoom 缩放），则把连线吸附到该端口（不移动目标节点）
  if (!hovered) {
    const fromType = connecting.fromType;
    const fromKind = connecting.fromKind;
    const wantKind = fromKind === 'output' ? 'input' : 'output';
    const thrX = (typeof AUTOCONN_GAP_X_MAX !== 'undefined' ? AUTOCONN_GAP_X_MAX : 140) * workflow.camera.zoom;
    const thrY = (typeof AUTOCONN_GAP_Y_MAX !== 'undefined' ? AUTOCONN_GAP_Y_MAX : 90) * workflow.camera.zoom;
    let best = null, bestScore = Infinity;
    workflow.nodes.forEach(n => {
      if (!n.el || n === connecting.fromNode) return;
      const defs = wantKind === 'input' ? (n.def.inputs || []) : (n.def.outputs || []);
      defs.forEach((portDef, idx) => {
        const vres = (window.FlowCraft && window.FlowCraft.nodes && window.FlowCraft.nodes.validateConnection)
          ? window.FlowCraft.nodes.validateConnection({
              from: { nodeType: connecting.fromNode.type, portIdx: connecting.fromIdx, kind: fromKind, portType: fromType },
              to:   { nodeType: n.type, portIdx: idx, kind: wantKind, portType: portDef.type },
            })
          : null;
        const ok = vres ? !!vres.ok : (fromType === portDef.type);
        if (!ok) return;
        const p = getPortScreenPos(n, wantKind, idx);
        const dx = Math.abs(p.x - sx);
        const dy = Math.abs(p.y - sy);
        if (dx < thrX && dy < thrY) {
          const score = dx + dy * 2;
          if (score < bestScore) {
            bestScore = score;
            best = { node: n, kind: wantKind, idx, p, portEl: n.el.querySelector(`.node-port.${wantKind}[data-port-idx="${idx}"]`) };
          }
        }
      });
    });
    if (best) {
      hovered = { node: best.node, kind: best.kind, idx: best.idx };
      valid = true;
      connecting.reason = '';
      if (best.portEl) best.portEl.classList.add('compatible');
      workflow.pendingConnection.toX = best.p.x;
      workflow.pendingConnection.toY = best.p.y;
      snappedPort = true;
      connecting.snapped = true;
    }
  }

  // 跟踪 hover 的节点（用于多选批量连线）：鼠标落在某节点（含其端口）上时记录
  const nodeEl = e.target.closest && e.target.closest('.node');
  if (nodeEl && nodeEl.dataset && nodeEl.dataset.id && nodeEl.dataset.id !== connecting.fromNode.id) {
    connecting.hoverNode = workflow.nodes.get(nodeEl.dataset.id) || null;
  } else {
    connecting.hoverNode = null;
  }

  if (!snappedPort) {
    workflow.pendingConnection.toX = sx;
    workflow.pendingConnection.toY = sy;
  }
  workflow.pendingConnection.valid = valid;
  workflow.hoveredPort = hovered;
  markEdgesDirty();
});

window.addEventListener('mouseup', (e) => {
  if (!connecting) return;

  // 清除 connecting 状态
  connecting.fromNode.el.querySelectorAll('.node-port.connecting').forEach(p => {
    p.classList.remove('connecting');
  });
  // 清除 compatible/incompatible
  workflow.nodes.forEach(n => {
    n.el.querySelectorAll('.node-port.compatible, .node-port.incompatible').forEach(p => {
      p.classList.remove('compatible', 'incompatible');
    });
  });

  if (workflow.hoveredPort && workflow.pendingConnection.valid) {
    // 确保 from 是 output, to 是 input
    let fromNode, fromIdx, toNode, toIdx;

    if (connecting.fromKind === 'output') {
      fromNode = connecting.fromNode;
      fromIdx = connecting.fromIdx;
      toNode = workflow.hoveredPort.node;
      toIdx = workflow.hoveredPort.idx;
    } else {
      fromNode = workflow.hoveredPort.node;
      fromIdx = workflow.hoveredPort.idx;
      toNode = connecting.fromNode;
      toIdx = connecting.fromIdx;
    }

    // 多选批量：从 output 拖出、当前选中 ≥2 且起始节点在选中集内 → 全部选中节点连到目标节点
    if (connecting.fromKind === 'output' && workflow.selection.size >= 2 && workflow.selection.has(connecting.fromNode.id)) {
      batchConnectToNode(toNode, connecting.fromNode);
      // 批量后直接结束（不再走下方单连逻辑）
    } else {
      // 检查是否已存在相同连线（避免重复）
      let exists = false;
      workflow.edges.forEach(e => {
        if (e.from.node.id === fromNode.id && e.from.port === fromIdx &&
            e.to.node.id === toNode.id && e.to.port === toIdx) {
          exists = true;
        }
      });

      if (!exists) {
        // 允许多条连线连到同一输入端口（支持参考图等多输入场景）
        pushHistory();
        const edge = new Edge(fromNode, fromIdx, toNode, toIdx);
        workflow.edges.set(edge.id, edge);
        resetNodeData(toNode); // 连线变化 → 下游输入已改变，清除旧数据
        updateStatusbar();
        scheduleAutosave();
      }
    }
  } else if (connecting.fromKind === 'output' && workflow.selection.size >= 2 && workflow.selection.has(connecting.fromNode.id) && connecting.hoverNode && connecting.hoverNode.id !== connecting.fromNode.id) {
    // 多选批量连线：从多个选中节点的输出端口0 依次连到目标节点的输入端口 0、1、2…
    batchConnectToNode(connecting.hoverNode, connecting.fromNode);
  } else {
    // 拖到端口但类型不符：提示具体原因（T2-3）；否则（拖到空白处）弹出节点快捷组合菜单
    if (workflow.hoveredPort && !workflow.pendingConnection.valid && connecting.reason) {
      showToast(connecting.reason, 'error');
    } else {
      const rect = canvasWrap.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = (e.clientX - rect.left - workflow.camera.x) / workflow.camera.zoom;
      const wy = (e.clientY - rect.top - workflow.camera.y) / workflow.camera.zoom;
      showConnectionNodeMenu(
        e.clientX, e.clientY,
        connecting.fromNode, connecting.fromKind, connecting.fromIdx, connecting.fromType,
        wx, wy
      );
    }
  }

  connecting = null;
  workflow.pendingConnection = null;
  workflow.hoveredPort = null;
  document.body.classList.remove('canvas-ports-visible'); // P1：取消全图端口可见
  markEdgesDirty();
});

// 多选批量连线：把选中的多个节点（输出端口0）按「类型匹配优先」连到 target 节点的输入端口
// （图片源连图片输入、文本源连文本输入；多个同类型源可连到同一端口 → 形成多参考图）
function batchConnectToNode(target, originNode) {
  const targetInputs = (target.def && target.def.inputs) || [];
  if (targetInputs.length === 0) { showToast(`「${target.title}」没有输入端口`, 'warn'); return; }

  // 选中且有输出端口的节点，按画布 order 排序保证稳定
  const selSrcs = workflow.order
    .map(id => workflow.nodes.get(id))
    .filter(n => n && workflow.selection.has(n.id) && n.id !== target.id && (n.def.outputs || []).length > 0);
  if (selSrcs.length === 0) { showToast('选中的节点没有可用输出端口', 'warn'); return; }

  // 预计算待建连线：每个选中源找一个类型匹配的目标输入端口（允许多源连同一端口，AI 绘图等多参考图节点会合并发送）
  const newEdges = [];
  selSrcs.forEach((src) => {
    const fromPort = (src.def.outputs || [])[0];
    if (!fromPort) return;
    const fromIdx = 0;
    for (let toIdx = 0; toIdx < targetInputs.length; toIdx++) {
      if (targetInputs[toIdx].type !== fromPort.type) continue; // 类型不匹配，找下一个匹配端口
      // 去重：相同源-端口对不重复
      let exists = false;
      workflow.edges.forEach(e => {
        if (e.from.node.id === src.id && e.from.port === fromIdx && e.to.node.id === target.id && e.to.port === toIdx) exists = true;
      });
      if (exists) break;
      newEdges.push([src, fromIdx, toIdx]);
      break; // 该源连入一个匹配端口后即结束（不重复连到所有同类型端口）
    }
  });

  if (newEdges.length === 0) { showToast('没有可连接的端口（目标输入端口不足或类型不匹配）', 'warn'); return; }

  pushHistory();
  newEdges.forEach(([src, fromIdx, toIdx]) => {
    const edge = new Edge(src, fromIdx, target, toIdx);
    workflow.edges.set(edge.id, edge);
  });
  resetNodeData(target);
  updateStatusbar();
  scheduleAutosave();
  markEdgesDirty();
  showToast(`已批量连接 ${newEdges.length} 条：选中节点 → 「${target.title}」`, 'success');
}

//================ 14b. 连线节点快捷组合菜单 ================
let connectionMenuState = null;
const connectionNodeMenu = document.getElementById('connectionNodeMenu');

function showConnectionNodeMenu(screenX, screenY, sourceNode, sourceKind, sourceIdx, sourceType, worldX, worldY) {
  connectionMenuState = {
    sourceNode, sourceKind, sourceIdx, sourceType, worldX, worldY
  };
  renderConnectionNodeMenu();

  // 菜单位置：以释放点为中心，避免超出视口
  connectionNodeMenu.classList.add('show');
  const menuSize = 440;
  let left = screenX - menuSize / 2;
  let top = screenY - menuSize / 2;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  if (left + menuSize > window.innerWidth - 8) {
    left = window.innerWidth - menuSize - 8;
  }
  if (top + menuSize > window.innerHeight - 8) {
    top = window.innerHeight - menuSize - 8;
  }
  connectionNodeMenu.style.left = left + 'px';
  connectionNodeMenu.style.top = top + 'px';

  // 自动高亮鼠标正下方的节点，无需移动即可单击
  highlightHudButtonAt(screenX, screenY);
}

function hideConnectionNodeMenu() {
  connectionNodeMenu.classList.remove('show');
  connectionNodeMenu.innerHTML = '';
  connectionMenuState = null;
}

//================ 图片文件上传（真实图片载入） ================
// 读取图片并压缩到最大边长，避免 dataURL 过大撑爆 localStorage
function downscaleImage(dataURL, maxDim) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.width, h0 = img.height;
      if (w0 <= maxDim && h0 <= maxDim) { resolve(dataURL); return; }
      const scale = Math.min(maxDim / w0, maxDim / h0);
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(cv.toDataURL('image/png')); }
      catch (err) { resolve(dataURL); }
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

// 将图片文件载入到指定节点（写入 node.thumb，并保留原图引用）
function loadImageFile(file, node) {
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    showToast('请选择图片文件（PNG / JPG / WebP 等）', 'danger');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const raw = e.target.result;
    downscaleImage(raw, 720).then((thumb) => {
      node.params = node.params || {};
      node.params.name = file.name;
      node.thumb = thumb;
      node.uploadedImage = raw;          // 保留原图，供真实导出使用
      node.croppedImage = '';
      node.cropMeta = null;
      node.ratio = null;
      node._fitProbed = false;
      node.outputsData = computeNodeOutput(node);
      if (node.el) buildNodeBody(node.el, node);
      probeFitNode(node);
      if (node === __composerNode) showNodeComposer(node);
      markEdgesDirty();
      scheduleAutosave();
      refreshAssetPanelIfOpen();
      showToast('已载入图片到「' + (node.title || '节点') + '」', 'success');
    });
  };
  reader.onerror = () => showToast('图片读取失败', 'danger');
  reader.readAsDataURL(file);
}

// 打开系统文件选择器
function openImageFilePicker(node) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.style.display = 'none';
  inp.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadImageFile(file, node);
    inp.remove();
  };
  document.body.appendChild(inp);
  inp.click();
}

// 视频输入节点：选择本地视频并抽取首帧作为封面（node.thumb），并记录名称/时长
function openVideoFilePicker(node) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'video/*';
  inp.style.display = 'none';
  inp.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadVideoFile(file, node);
    inp.remove();
  };
  document.body.appendChild(inp);
  inp.click();
}

function loadVideoFile(file, node) {
  if (!file) return;
  if (!file.type || !file.type.startsWith('video/')) {
    showToast('请选择视频文件（MP4 / WebM 等）', 'danger');
    return;
  }
  const url = URL.createObjectURL(file);
  const vid = document.createElement('video');
  vid.preload = 'metadata';
  vid.muted = true;
  vid.src = url;
  let poster = '';
  let durationText = '';
  let rawVideo = '';
  let posterReady = false;
  let rawReady = false;
  let finalized = false;
  const cleanup = () => {
    if (finalized) return;
    finalized = true;
    try { URL.revokeObjectURL(url); } catch (_) {}
    try { if (vid.parentNode) vid.remove(); } catch (_) {}
  };
  const finalize = () => {
    if (finalized || !posterReady || !rawReady) return;
    cleanup();
    node.thumb = poster || createPlaceholderDataURL(120, 70, (parseInt(node.id.replace(/\D/g, '')) || 1) + 300, '视频');
    node.uploadedVideo = rawVideo || '';
    node.params.name = file.name;
    node.params.duration = durationText || '00:00';
    node.videoAspect = vid.videoWidth && vid.videoHeight ? (vid.videoWidth / vid.videoHeight) : node.videoAspect || null;
    node.outputsData = computeNodeOutput(node);
    if (node.el) {
      if (node.type === 'videoInput' && node.videoAspect) {
        const headerH = (node.el.querySelector('.node-header') && node.el.querySelector('.node-header').offsetHeight) || 42;
        const chromeH = headerH + 8;
        const MAX_W = Math.max(240, Math.round(window.innerWidth * 0.42));
        const MAX_H = Math.max(180, Math.round(window.innerHeight * 0.42));
        const MIN_W = 200;
        const scale = Math.min(1, MAX_W / Math.max(1, vid.videoWidth || 1), MAX_H / Math.max(1, vid.videoHeight || 1));
        const contentW = Math.max(MIN_W, Math.round((vid.videoWidth || 640) * scale));
        const contentH = Math.max(120, Math.round(contentW / node.videoAspect));
        node.width = contentW + 32;
        node.height = contentH + chromeH;
        node.el.style.width = node.width + 'px';
        node.el.style.minHeight = node.height + 'px';
      }
      buildNodeBody(node.el, node);
    }
    if (node === __composerNode) showNodeComposer(node);
    markEdgesDirty();
    scheduleAutosave();
    refreshAssetPanelIfOpen();
    showToast('已载入视频：' + file.name, 'success');
  };
  const reader = new FileReader();
  reader.onload = (e) => {
    rawVideo = e.target && typeof e.target.result === 'string' ? e.target.result : '';
    rawReady = true;
    finalize();
  };
  reader.onerror = () => {
    rawVideo = '';
    rawReady = true;
    finalize();
  };
  reader.readAsDataURL(file);
  vid.onloadedmetadata = () => {
    // 跳到第 0.1 秒抽帧，避免空白首帧
    try { vid.currentTime = Math.min(0.1, (vid.duration || 1) / 2); } catch (_) {}
  };
  vid.onseeked = () => {
    try {
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = Math.round(320 * (vid.videoHeight / Math.max(1, vid.videoWidth)));
      const c = cv.getContext('2d');
      c.drawImage(vid, 0, 0, cv.width, cv.height);
      poster = cv.toDataURL('image/png');
      durationText = formatVideoDuration(vid.duration);
    } catch (err) {
      poster = createPlaceholderDataURL(120, 70, (parseInt(node.id.replace(/\D/g, '')) || 1) + 300, '视频');
      durationText = formatVideoDuration(vid.duration);
    }
    posterReady = true;
    finalize();
  };
  vid.onerror = () => {
    poster = createPlaceholderDataURL(120, 70, (parseInt(node.id.replace(/\D/g, '')) || 1) + 300, '视频');
    durationText = '00:00';
    posterReady = true;
    finalize();
    showToast('视频解析失败，已用占位封面', 'warn');
  };
  // 某些浏览器需要 append 后才能触发加载
  document.body.appendChild(vid);
  vid.load();
  setTimeout(() => { if (vid.parentNode) vid.remove(); }, 8000);
}

function formatVideoDuration(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}


//================ 图片 Lightbox ================
// 大图查看器状态：scale/translate 支持滚轮缩放 + 拖拽平移 + 双击还原
const lbState = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

function updateLightboxTransform(smooth) {
  const wrap = document.getElementById('imageLightboxWrapper');
  if (!wrap) return;
  if (smooth) wrap.classList.add('smooth');
  else wrap.classList.remove('smooth');
  wrap.style.transform = `translate(${lbState.x}px, ${lbState.y}px) scale(${lbState.scale})`;
}

function resetLightboxTransform() {
  lbState.scale = 1;
  lbState.x = 0;
  lbState.y = 0;
  updateLightboxTransform(true);
}

// 多图查看状态：列表与当前索引（单图时为空）
let _lbList = null;
let _lbIndex = 0;

function openImageLightbox(src, list, index) {
  const lb = document.getElementById('imageLightbox');
  const img = document.getElementById('imageLightboxImg');
  const counter = document.getElementById('imageLightboxCounter');
  if (!lb || !img) return;
  // 多图支持：传入 list（数组）与 index 即可左右切换
  if (Array.isArray(list) && list.length > 1) {
    _lbList = list;
    _lbIndex = (typeof index === 'number' && index >= 0) ? index : list.indexOf(src);
    if (_lbIndex < 0) _lbIndex = 0;
    lb.classList.add('has-multi');
    if (counter) counter.textContent = '图 ' + (_lbIndex + 1) + ' / ' + list.length;
  } else {
    _lbList = null;
    _lbIndex = 0;
    lb.classList.remove('has-multi');
    if (counter) counter.textContent = '';
  }
  img.src = src;
  resetLightboxTransform();
  lb.classList.add('show');
}
// 在列表中向前/向后切换一张
function lbGo(delta) {
  if (!_lbList || _lbList.length < 2) return;
  const lb = document.getElementById('imageLightbox');
  const img = document.getElementById('imageLightboxImg');
  const counter = document.getElementById('imageLightboxCounter');
  if (!img) return;
  _lbIndex = (_lbIndex + delta + _lbList.length) % _lbList.length;
  img.src = _lbList[_lbIndex];
  if (counter) counter.textContent = '图 ' + (_lbIndex + 1) + ' / ' + _lbList.length;
  resetLightboxTransform();
}
function closeImageLightbox() {
  const lb = document.getElementById('imageLightbox');
  const img = document.getElementById('imageLightboxImg');
  if (!lb) return;
  lb.classList.remove('show');
  lb.classList.remove('has-multi');
  _lbList = null;
  _lbIndex = 0;
  if (img) img.src = '';
  resetLightboxTransform();
}

let __imageCropState = null;

function fitContainRect(srcW, srcH, maxW, maxH) {
  const w = Math.max(1, Number(srcW) || 1);
  const h = Math.max(1, Number(srcH) || 1);
  const boxW = Math.max(1, Number(maxW) || 1);
  const boxH = Math.max(1, Number(maxH) || 1);
  const scale = Math.min(boxW / w, boxH / h);
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  return { x: Math.round((boxW - dw) / 2), y: Math.round((boxH - dh) / 2), w: dw, h: dh, scale };
}

function cropAspectValue(v) {
  if (!v || v === 'free') return null;
  const ratio = parseAspectRatio(v);
  return ratio && isFinite(ratio) && ratio > 0 ? ratio : null;
}

function cropBoxForAspect(rect, aspect) {
  const margin = 0.12;
  const maxW = Math.max(24, Math.round(rect.w * (1 - margin)));
  const maxH = Math.max(24, Math.round(rect.h * (1 - margin)));
  let w = maxW;
  let h = maxH;
  if (aspect) {
    w = maxW;
    h = Math.round(w / aspect);
    if (h > maxH) {
      h = maxH;
      w = Math.round(h * aspect);
    }
  }
  w = Math.max(24, Math.min(rect.w, w));
  h = Math.max(24, Math.min(rect.h, h));
  return {
    x: Math.round((rect.w - w) / 2),
    y: Math.round((rect.h - h) / 2),
    w, h,
  };
}

function clampCropBox(box, rect) {
  const min = 24;
  const out = { ...box };
  out.w = Math.max(min, Math.min(rect.w, out.w));
  out.h = Math.max(min, Math.min(rect.h, out.h));
  out.x = Math.max(0, Math.min(rect.w - out.w, out.x));
  out.y = Math.max(0, Math.min(rect.h - out.h, out.y));
  return out;
}

function renderImageCropModal() {
  const st = __imageCropState;
  const overlay = document.getElementById('imageCropOverlay');
  if (!st || !overlay || !overlay.classList.contains('show')) return;
  const stage = overlay.querySelector('.image-crop-stage');
  const img = overlay.querySelector('.image-crop-img');
  const box = overlay.querySelector('.image-crop-box');
  const aspectSel = overlay.querySelector('#imageCropAspect');
  const meta = overlay.querySelector('.image-crop-meta');
  if (!stage || !img || !box || !aspectSel) return;
  const sr = stage.getBoundingClientRect();
  if (!sr.width || !sr.height) return;
  const rect = fitContainRect(st.naturalW, st.naturalH, sr.width, sr.height);
  st.displayRect = rect;
  if (!st.box || st._boxReset) {
    st.box = cropBoxForAspect(rect, cropAspectValue(aspectSel.value));
    st._boxReset = false;
  } else {
    st.box = clampCropBox(st.box, rect);
  }
  img.src = st.src;
  img.style.left = rect.x + 'px';
  img.style.top = rect.y + 'px';
  img.style.width = rect.w + 'px';
  img.style.height = rect.h + 'px';
  box.style.left = (rect.x + st.box.x) + 'px';
  box.style.top = (rect.y + st.box.y) + 'px';
  box.style.width = st.box.w + 'px';
  box.style.height = st.box.h + 'px';
  if (meta) meta.textContent = `裁剪后 ${Math.max(1, Math.round(st.naturalW * (st.box.w / rect.w)))} × ${Math.max(1, Math.round(st.naturalH * (st.box.h / rect.h)))}`;
}

function closeImageCropModal() {
  const overlay = document.getElementById('imageCropOverlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  overlay.classList.remove('dragging');
  __imageCropState = null;
}

function openImageCropModal(node) {
  const src = getNodeDisplayImageSource(node) || normalizeImageSrc(node && (node.uploadedImage || node.thumb));
  if (!node || node.type !== 'image' || !src) {
    showToast('请先上传图片，再进行裁剪', 'info');
    return;
  }
  const probe = new Image();
  probe.onload = () => {
    __imageCropState = {
      node,
      src,
      naturalW: probe.naturalWidth || probe.width || 1,
      naturalH: probe.naturalHeight || probe.height || 1,
      box: null,
      displayRect: null,
      drag: null,
      _boxReset: false,
    };
    let overlay = document.getElementById('imageCropOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'imageCropOverlay';
      overlay.className = 'image-crop-overlay';
      overlay.innerHTML =
        '<div class="image-crop-modal">' +
          '<div class="image-crop-head">' +
            '<div><div class="image-crop-title">图片裁剪</div><div class="image-crop-meta"></div></div>' +
            '<div class="image-crop-actions">' +
              '<select id="imageCropAspect" class="image-crop-select">' +
                '<option value="free">自由裁剪</option>' +
                '<option value="1:1">1:1</option>' +
                '<option value="4:3">4:3</option>' +
                '<option value="3:4">3:4</option>' +
                '<option value="16:9">16:9</option>' +
                '<option value="9:16">9:16</option>' +
              '</select>' +
              '<button type="button" class="wf-btn" id="imageCropReset">重置</button>' +
              '<button type="button" class="wf-btn" id="imageCropCancel">取消</button>' +
              '<button type="button" class="wf-btn primary" id="imageCropApply">应用裁剪</button>' +
            '</div>' +
          '</div>' +
          '<div class="image-crop-stage"><img class="image-crop-img" alt="裁剪预览"><div class="image-crop-box"><div class="image-crop-handle br"></div></div></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeImageCropModal(); });
      overlay.addEventListener('mousedown', (e) => {
        if (!__imageCropState) return;
        const stage = overlay.querySelector('.image-crop-stage');
        const boxEl = overlay.querySelector('.image-crop-box');
        if (!stage || !boxEl) return;
        const target = e.target;
        if (!target.closest('.image-crop-box')) return;
        e.preventDefault();
        e.stopPropagation();
        const sr = stage.getBoundingClientRect();
        const st = __imageCropState;
        const box = st.box ? { ...st.box } : cropBoxForAspect(st.displayRect || fitContainRect(st.naturalW, st.naturalH, sr.width, sr.height), cropAspectValue(overlay.querySelector('#imageCropAspect').value));
        const start = { x: e.clientX, y: e.clientY, box };
        const aspect = cropAspectValue(overlay.querySelector('#imageCropAspect').value);
        st.drag = { start, aspect };
        overlay.classList.add('dragging');
        const move = (ev) => {
          if (!st.drag) return;
          const dx = ev.clientX - start.x;
          const dy = ev.clientY - start.y;
          const rect = st.displayRect || fitContainRect(st.naturalW, st.naturalH, sr.width, sr.height);
          let next = { ...start.box };
          if (target.closest('.image-crop-handle')) {
            if (st.drag.aspect) {
              let w = Math.max(24, Math.min(rect.w - start.box.x, start.box.w + dx));
              let h = Math.round(w / st.drag.aspect);
              if (h > rect.h - start.box.y) { h = Math.max(24, Math.min(rect.h - start.box.y, start.box.h + dy)); w = Math.round(h * st.drag.aspect); }
              next.w = w;
              next.h = h;
            } else {
              next.w = Math.max(24, Math.min(rect.w - start.box.x, start.box.w + dx));
              next.h = Math.max(24, Math.min(rect.h - start.box.y, start.box.h + dy));
            }
          } else {
            next.x = Math.max(0, Math.min(rect.w - start.box.w, start.box.x + dx));
            next.y = Math.max(0, Math.min(rect.h - start.box.h, start.box.y + dy));
          }
          st.box = clampCropBox(next, rect);
          renderImageCropModal();
        };
        const up = () => {
          st.drag = null;
          overlay.classList.remove('dragging');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      overlay.querySelector('#imageCropAspect').onchange = (e) => {
        if (!__imageCropState) return;
        const rect = __imageCropState.displayRect || fitContainRect(__imageCropState.naturalW, __imageCropState.naturalH, 800, 520);
        __imageCropState.box = cropBoxForAspect(rect, cropAspectValue(e.target.value));
        renderImageCropModal();
      };
      overlay.querySelector('#imageCropReset').onclick = (e) => {
        e.stopPropagation();
        if (!__imageCropState) return;
        __imageCropState._boxReset = true;
        renderImageCropModal();
      };
      overlay.querySelector('#imageCropCancel').onclick = (e) => { e.stopPropagation(); closeImageCropModal(); };
      overlay.querySelector('#imageCropApply').onclick = (e) => {
        e.stopPropagation();
        if (!__imageCropState) return;
        const st = __imageCropState;
        const stage = overlay.querySelector('.image-crop-stage');
        if (!stage || !st.box || !st.displayRect) return;
        const imgEl = overlay.querySelector('.image-crop-img');
        if (!imgEl) return;
        const sx = Math.max(0, Math.round((st.box.x / st.displayRect.w) * st.naturalW));
        const sy = Math.max(0, Math.round((st.box.y / st.displayRect.h) * st.naturalH));
        const sw = Math.max(1, Math.round((st.box.w / st.displayRect.w) * st.naturalW));
        const sh = Math.max(1, Math.round((st.box.h / st.displayRect.h) * st.naturalH));
        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, sw, sh);
        let cropped = '';
        try { cropped = canvas.toDataURL('image/png'); } catch (err) { cropped = ''; }
        if (!cropped) { showToast('裁剪失败，请重试', 'danger'); return; }
        pushHistory();
        st.node.croppedImage = cropped;
        st.node.thumb = cropped;
        st.node.cropMeta = {
          aspect: overlay.querySelector('#imageCropAspect').value || 'free',
          box: { ...st.box },
          sourceSize: { w: st.naturalW, h: st.naturalH },
          croppedAt: Date.now(),
        };
        st.node.outputsData = computeNodeOutput(st.node);
        if (st.node.el) buildNodeBody(st.node.el, st.node);
        probeFitNode(st.node);
        markEdgesDirty();
        scheduleAutosave();
        refreshAssetPanelIfOpen();
        showToast('图片已裁剪', 'success');
        closeImageCropModal();
      };
    }
    // 修复：overlay 创建/显示原依赖 probe.onload，但缺少 probe.src 赋值导致 onload 永不触发、模态打不开。
    if (!overlay.parentNode) document.body.appendChild(overlay);
    overlay.classList.add('show');
    const aspectSel = overlay.querySelector('#imageCropAspect');
    if (aspectSel) aspectSel.value = 'free';
    __imageCropState._boxReset = true;
    requestAnimationFrame(() => renderImageCropModal());
  };
  probe.src = src;
}

// ===== 图片节点旋转（阶段2）：90° 步进 + 自由角度 → canvas 烘焙入像素 =====
let __imageRotateState = null;

// 归一角度到 (-180, 180]
function normalizeAngle(a) {
  let d = (Number(a) || 0) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return Math.round(d);
}

// 把 src 旋转 angleDeg 后烘焙为新 dataURL（扩展画布到旋转后外接矩形，自由角度保留透明角）
function bakeImageRotation(src, angleDeg, cb) {
  const img = new Image();
  img.onload = function() {
    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    const rad = (Number(angleDeg) || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const nw = Math.max(1, Math.round(w * cos + h * sin));
    const nh = Math.max(1, Math.round(w * sin + h * cos));
    const canvas = document.createElement('canvas');
    canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) { cb('', 0, 0); return; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -w / 2, -h / 2);
    let out = '';
    try { out = canvas.toDataURL('image/png'); } catch (err) { out = ''; }
    cb(out, nw, nh);
  };
  img.onerror = function() { cb('', 0, 0); };
  img.src = src;
}

function renderImageRotateModal() {
  const st = __imageRotateState;
  const overlay = document.getElementById('imageRotateOverlay');
  if (!st || !overlay || !overlay.classList.contains('show')) return;
  const stage = overlay.querySelector('.image-crop-stage');
  const img = overlay.querySelector('.image-rotate-img');
  const meta = overlay.querySelector('.image-crop-meta');
  const angleEl = overlay.querySelector('#imageRotateAngle');
  const slider = overlay.querySelector('#imageRotateSlider');
  if (!stage || !img) return;
  const sr = stage.getBoundingClientRect();
  if (!sr.width || !sr.height) return;
  const rad = st.angle * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const bw = Math.max(1, st.naturalW * cos + st.naturalH * sin);
  const bh = Math.max(1, st.naturalW * sin + st.naturalH * cos);
  const scale = Math.min(sr.width / bw, sr.height / bh);
  const dw = Math.max(1, Math.round(st.naturalW * scale));
  const dh = Math.max(1, Math.round(st.naturalH * scale));
  img.src = st.src;
  img.style.width = dw + 'px';
  img.style.height = dh + 'px';
  img.style.left = Math.round((sr.width - dw) / 2) + 'px';
  img.style.top = Math.round((sr.height - dh) / 2) + 'px';
  img.style.transform = 'rotate(' + st.angle + 'deg)';
  if (angleEl) angleEl.textContent = st.angle + '°';
  if (slider && Number(slider.value) !== st.angle) slider.value = String(st.angle);
  if (meta) meta.textContent = '原图 ' + st.naturalW + ' × ' + st.naturalH + ' · 旋转 ' + st.angle + '°';
}

function closeImageRotateModal() {
  const overlay = document.getElementById('imageRotateOverlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  __imageRotateState = null;
}

function openImageRotateModal(node) {
  const src = getNodeDisplayImageSource(node) || normalizeImageSrc(node && (node.uploadedImage || node.thumb));
  if (!node || node.type !== 'image' || !src) {
    showToast('请先上传图片，再进行旋转', 'info');
    return;
  }
  const probe = new Image();
  probe.onload = () => {
    __imageRotateState = {
      node,
      src,
      naturalW: probe.naturalWidth || probe.width || 1,
      naturalH: probe.naturalHeight || probe.height || 1,
      angle: 0,
    };
    let overlay = document.getElementById('imageRotateOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'imageRotateOverlay';
      overlay.className = 'image-crop-overlay image-rotate-overlay';
      overlay.innerHTML =
        '<div class="image-crop-modal">' +
          '<div class="image-crop-head">' +
            '<div><div class="image-crop-title">图片旋转</div><div class="image-crop-meta"></div></div>' +
            '<div class="image-crop-actions">' +
              '<button type="button" class="wf-btn" id="imageRotateCCW" title="逆时针 90°">⟲ 90°</button>' +
              '<button type="button" class="wf-btn" id="imageRotateCW" title="顺时针 90°">⟳ 90°</button>' +
              '<input type="range" id="imageRotateSlider" class="image-rotate-slider" min="-180" max="180" step="1" value="0">' +
              '<span class="image-rotate-angle" id="imageRotateAngle">0°</span>' +
              '<button type="button" class="wf-btn" id="imageRotateReset">重置</button>' +
              '<button type="button" class="wf-btn" id="imageRotateCancel">取消</button>' +
              '<button type="button" class="wf-btn primary" id="imageRotateApply">应用旋转</button>' +
            '</div>' +
          '</div>' +
          '<div class="image-crop-stage"><img class="image-crop-img image-rotate-img" alt="旋转预览"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeImageRotateModal(); });
      overlay.querySelector('#imageRotateCCW').onclick = (e) => { e.stopPropagation(); if (!__imageRotateState) return; __imageRotateState.angle = normalizeAngle(__imageRotateState.angle - 90); renderImageRotateModal(); };
      overlay.querySelector('#imageRotateCW').onclick = (e) => { e.stopPropagation(); if (!__imageRotateState) return; __imageRotateState.angle = normalizeAngle(__imageRotateState.angle + 90); renderImageRotateModal(); };
      overlay.querySelector('#imageRotateSlider').oninput = (e) => { if (!__imageRotateState) return; __imageRotateState.angle = normalizeAngle(e.target.value); renderImageRotateModal(); };
      overlay.querySelector('#imageRotateReset').onclick = (e) => { e.stopPropagation(); if (!__imageRotateState) return; __imageRotateState.angle = 0; renderImageRotateModal(); };
      overlay.querySelector('#imageRotateCancel').onclick = (e) => { e.stopPropagation(); closeImageRotateModal(); };
      overlay.querySelector('#imageRotateApply').onclick = (e) => {
        e.stopPropagation();
        const st = __imageRotateState;
        if (!st) return;
        const angle = st.angle;
        if (!angle) { showToast('角度为 0，无需旋转', 'info'); return; }
        bakeImageRotation(st.src, angle, (baked, nw, nh) => {
          if (!baked) { showToast('旋转失败，请重试', 'danger'); return; }
          pushHistory();
          st.node.croppedImage = baked;
          st.node.thumb = baked;
          const prevAngle = (st.node.cropMeta && st.node.cropMeta.angle) || 0;
          st.node.cropMeta = Object.assign({}, st.node.cropMeta, { angle: normalizeAngle(prevAngle + angle), rotatedAt: Date.now() });
          st.node.outputsData = computeNodeOutput(st.node);
          if (st.node.el) buildNodeBody(st.node.el, st.node);
          probeFitNode(st.node);
          markEdgesDirty();
          scheduleAutosave();
          refreshAssetPanelIfOpen();
          showToast('图片已旋转 ' + angle + '°', 'success');
          closeImageRotateModal();
        });
      };
    }
    if (!overlay.parentNode) document.body.appendChild(overlay);
    overlay.classList.add('show');
    const slider = overlay.querySelector('#imageRotateSlider');
    if (slider) slider.value = '0';
    requestAnimationFrame(() => renderImageRotateModal());
  };
  probe.src = src;
}

window.addEventListener('resize', () => { if (__imageCropState) renderImageCropModal(); if (__imageRotateState) renderImageRotateModal(); });

function renderConnectionNodeMenu() {
  if (!connectionMenuState) return;
  const { sourceNode, sourceKind, sourceIdx, sourceType } = connectionMenuState;

  connectionNodeMenu.innerHTML = '';

  // HUD 结构
  const backdrop = document.createElement('div');
  backdrop.className = 'hud-backdrop';
  const ring = document.createElement('div');
  ring.className = 'hud-ring';
  const ringInner = document.createElement('div');
  ringInner.className = 'hud-ring-inner';

  // 中心枢纽
  const hub = document.createElement('div');
  hub.className = 'hud-hub';
  const hubIcon = document.createElement('div');
  hubIcon.className = 'hud-hub-icon';
  hubIcon.innerHTML = sourceKind === 'output'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
  const hubTitle = document.createElement('div');
  hubTitle.className = 'hud-hub-title';
  hubTitle.textContent = sourceNode.title || '节点';
  const hubType = document.createElement('div');
  hubType.className = 'hud-hub-type';
  hubType.textContent = (sourceKind === 'output' ? '输出 · ' : '输入 · ') + sourceType;
  hub.appendChild(hubIcon);
  hub.appendChild(hubTitle);
  hub.appendChild(hubType);

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'hud-items';

  // 分组定义
  const groups = [
    { key: 'input',   label: '输入',    class: 'hud-group-input',   types: ['image', 'text'] },
    { key: 'ai',      label: 'AI 生成', class: 'hud-group-ai',      types: ['aiImage', 'aiVideo', 'aiSet'] },
    { key: 'process', label: '处理',    class: 'hud-group-process', types: ['upscale', 'compare', 'material', 'light', 'layout', 'lineart'] },
    { key: 'output',  label: '输出',    class: 'hud-group-output',  types: ['save'] },
    { key: 'video',   label: '视频',    class: 'hud-group-video',   types: ['videoBreak', 'script', 'footage', 'voiceover', 'subtitle', 'bgm', 'compose', 'publish'] },
  ];

  // 收集所有可连接节点并附加分组
  let allItems = [];
  groups.forEach(group => {
    group.types.forEach(type => {
      const def = NODE_TYPES[type];
      if (!def) return;
      const compat = computeNodeCompatibility(type, sourceKind, sourceType);
      if (!compat.canConnect) return;
      allItems.push({ type, def, compat, group });
    });
  });

  if (allItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hud-empty';
    empty.textContent = '没有可连接的节点';
    connectionNodeMenu.appendChild(backdrop);
    connectionNodeMenu.appendChild(ring);
    connectionNodeMenu.appendChild(ringInner);
    connectionNodeMenu.appendChild(hub);
    connectionNodeMenu.appendChild(empty);
    return;
  }

  // 精确匹配项排在前面（内圈），其余排外圈
  allItems.sort((a, b) => (b.compat.exactMatch ? 1 : 0) - (a.compat.exactMatch ? 1 : 0));

  // 圆心从 CSS 变量 --hud-size 读取，保证与所有圆环使用同一中心点（单一来源）
  const menuSize = parseFloat(getComputedStyle(connectionNodeMenu).getPropertyValue('--hud-size')) || 440;
  const center = menuSize / 2;
  const innerRadius = 84;   // 与 CSS .hud-ring-inner 直径(168)对齐
  const outerRadius = 130;  // 与 CSS .hud-ring 直径(260)对齐
  const exactItems = allItems.filter(i => i.compat.exactMatch);
  const otherItems = allItems.filter(i => !i.compat.exactMatch);

  function placeItems(items, radius, startDelay) {
    const count = items.length;
    // 从顶部 (-90°) 开始，顺时针均匀分布
    const step = count > 1 ? (Math.PI * 2) / count : 0;
    items.forEach((item, idx) => {
      const angle = -Math.PI / 2 + idx * step;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);

      const btn = document.createElement('div');
      btn.className = 'hud-node-btn ' + item.group.class + (item.compat.exactMatch ? '' : ' incompatible');
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
      btn.style.animationDelay = (startDelay + idx * 0.04) + 's';
      btn.innerHTML = NODE_ICONS[item.type] || '';
      btn.dataset.type = item.type;
      btn._hudItem = item; // 供初始高亮使用

      // 悬停时中心 hub 显示当前节点信息，同时标记 active
      btn.addEventListener('mouseenter', () => setHudActive(btn, item));
      btn.addEventListener('mouseleave', clearHudActive);

      btn.addEventListener('click', () => {
        if (item.compat.exactMatch) {
          createNodeFromConnectionMenu(item.type);
          hideConnectionNodeMenu();
        }
      });

      itemsContainer.appendChild(btn);
    });
  }

  placeItems(exactItems, innerRadius, 0.05);
  placeItems(otherItems, outerRadius, 0.25);

  connectionNodeMenu.appendChild(backdrop);
  connectionNodeMenu.appendChild(ring);
  connectionNodeMenu.appendChild(ringInner);
  connectionNodeMenu.appendChild(hub);
  connectionNodeMenu.appendChild(itemsContainer);
}

// 激活 HUD 节点按钮：视觉放大 + 中心 hub 同步显示该节点信息
function setHudActive(btn, item) {
  connectionNodeMenu.querySelectorAll('.hud-node-btn.active').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hub = connectionNodeMenu.querySelector('.hud-hub');
  if (!hub) return;
  hub.querySelector('.hud-hub-title').textContent = item.def.label;
  hub.querySelector('.hud-hub-type').textContent = item.group.label + (item.compat.exactMatch ? ' · 匹配' : '');
  hub.querySelector('.hud-hub-icon').innerHTML = NODE_ICONS[item.type] || '';
}

// 取消 HUD 激活，中心 hub 恢复为来源节点信息
function clearHudActive() {
  connectionNodeMenu.querySelectorAll('.hud-node-btn.active').forEach(b => b.classList.remove('active'));
  if (!connectionMenuState) return;
  const { sourceNode, sourceKind, sourceType } = connectionMenuState;
  const hub = connectionNodeMenu.querySelector('.hud-hub');
  if (!hub) return;
  hub.querySelector('.hud-hub-title').textContent = sourceNode.title || '节点';
  hub.querySelector('.hud-hub-type').textContent = (sourceKind === 'output' ? '输出 · ' : '输入 · ') + sourceType;
  hub.querySelector('.hud-hub-icon').innerHTML = sourceKind === 'output'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
}

// 面板刚打开时，自动高亮鼠标正下方的节点按钮（无需移动鼠标即可单击）
function highlightHudButtonAt(screenX, screenY) {
  const menuRect = connectionNodeMenu.getBoundingClientRect();
  const cx = screenX - menuRect.left;
  const cy = screenY - menuRect.top;
  let bestBtn = null, bestDist = Infinity;
  connectionNodeMenu.querySelectorAll('.hud-node-btn').forEach(btn => {
    if (btn.classList.contains('incompatible')) return;
    const bx = parseFloat(btn.style.left);
    const by = parseFloat(btn.style.top);
    const dist = Math.hypot(cx - bx, cy - by);
    if (dist < bestDist) { bestDist = dist; bestBtn = btn; }
  });
  // 阈值 30px（略大于按钮半径，给释放位置一些容错）
  if (bestBtn && bestDist <= 30) {
    setHudActive(bestBtn, bestBtn._hudItem);
  }
}

function computeNodeCompatibility(type, sourceKind, sourceType) {
  const def = NODE_TYPES[type];
  if (!def) return { canConnect: false, exactMatch: false };

  if (sourceKind === 'output') {
    // 需要目标节点有 input 端口
    if (!def.inputs || def.inputs.length === 0) return { canConnect: false, exactMatch: false };
    const exactMatch = def.inputs.some(p => p.type === sourceType);
    return { canConnect: true, exactMatch };
  } else {
    // sourceKind === 'input'，需要目标节点有 output 端口
    if (!def.outputs || def.outputs.length === 0) return { canConnect: false, exactMatch: false };
    const exactMatch = def.outputs.some(p => p.type === sourceType);
    return { canConnect: true, exactMatch };
  }
}

function createNodeFromConnectionMenu(type) {
  if (!connectionMenuState) return;
  const { sourceNode, sourceKind, sourceIdx, sourceType, worldX, worldY } = connectionMenuState;

  // 创建新节点，位于释放位置（节点中心对齐）
  const newNode = addNode(type, worldX - 140, worldY - 40);

  // 找到最佳端口匹配
  const match = findBestPortMatch(sourceNode, sourceKind, sourceIdx, sourceType, newNode);
  if (!match) return;

  let fromNode, fromIdx, toNode, toIdx;
  if (sourceKind === 'output') {
    fromNode = sourceNode;
    fromIdx = sourceIdx;
    toNode = newNode;
    toIdx = match.targetIdx;
  } else {
    fromNode = newNode;
    fromIdx = match.targetIdx;
    toNode = sourceNode;
    toIdx = sourceIdx;
  }

  // 检查重复
  let exists = false;
  workflow.edges.forEach(e => {
    if (e.from.node.id === fromNode.id && e.from.port === fromIdx &&
        e.to.node.id === toNode.id && e.to.port === toIdx) {
      exists = true;
    }
  });

  if (!exists) {
    pushHistory();
    const edge = new Edge(fromNode, fromIdx, toNode, toIdx);
    workflow.edges.set(edge.id, edge);
    resetNodeData(toNode); // 连线变化 → 下游输入已改变，清除旧数据
    updateStatusbar();
    scheduleAutosave();
  }

  // 选中新节点并滚动到可见
  selectNode(newNode);
}

function findBestPortMatch(sourceNode, sourceKind, sourceIdx, sourceType, targetNode) {
  const def = targetNode.def;
  if (sourceKind === 'output') {
    // 找目标 input 端口
    if (!def.inputs || def.inputs.length === 0) return null;
    // 优先同类型
    let idx = def.inputs.findIndex(p => p.type === sourceType);
    if (idx === -1) idx = 0;
    return { targetIdx: idx };
  } else {
    // 找目标 output 端口
    if (!def.outputs || def.outputs.length === 0) return null;
    let idx = def.outputs.findIndex(p => p.type === sourceType);
    if (idx === -1) idx = 0;
    return { targetIdx: idx };
  }
}

// 点击菜单外部或按 ESC 关闭
window.addEventListener('mousedown', (e) => {
  if (!connectionMenuState) return;
  if (!e.target.closest('#connectionNodeMenu')) {
    hideConnectionNodeMenu();
  }
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && connectionMenuState) {
    hideConnectionNodeMenu();
  }
});

//================ 15. 左侧节点库拖拽创建 ================
canvasWrap.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  // 拖入图片文件时高亮画布
  if (e.dataTransfer.types && [...e.dataTransfer.types].includes('Files')) {
    canvasWrap.classList.add('drop-file-active');
  }
});
canvasWrap.addEventListener('dragleave', (e) => {
  if (e.target === canvasWrap) canvasWrap.classList.remove('drop-file-active');
});

canvasWrap.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasWrap.classList.remove('drop-file-active');

  // 优先处理拖入的图片文件 → 自动创建图片节点并载入
  const files = e.dataTransfer.files;
  if (files && files.length) {
    const rect = canvasWrap.getBoundingClientRect();
    const cam = workflow.camera;
    const wx = (e.clientX - rect.left - cam.x) / cam.zoom;
    const wy = (e.clientY - rect.top - cam.y) / cam.zoom;
    const imgFiles = [...files].filter(f => f.type && f.type.startsWith('image/'));
    if (imgFiles.length === 0) {
      // 视频文件 → 自动创建「反推提示词」节点并载入
      const vidFiles = [...files].filter(f => f.type && f.type.startsWith('video/'));
      if (vidFiles.length >= 1) {
        const node = addNode('reversePrompt', wx - 150, wy - 60);
        if (node.__handleDropVideo) node.__handleDropVideo(vidFiles[0]);
        showToast('已创建「反推提示词」节点并载入视频', 'success');
      }
      return; // 其它非图片文件，交给下方节点拖放逻辑（getData 为空会直接 return）
    }
    if (imgFiles.length === 1) {
      const node = addNode('image', wx - 140, wy - 50);
      loadImageFile(imgFiles[0], node);
      showToast('已创建图片节点并载入图片', 'success');
    } else {
      // 多图：每个图片一个节点，网格错位排布
      const cols = Math.ceil(Math.sqrt(imgFiles.length));
      const gapX = 200, gapY = 170;
      imgFiles.forEach((f, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const node = addNode('image', wx - 140 + col * gapX, wy - 50 + row * gapY);
        loadImageFile(f, node);
      });
      showToast(`已创建 ${imgFiles.length} 个图片节点`, 'success');
    }
    return;
  }

  const type = e.dataTransfer.getData('text/plain');
  if (!type || !NODE_TYPES[type]) return;
  const rect = canvasWrap.getBoundingClientRect();
  const cam = workflow.camera;
  const wx = (e.clientX - rect.left - cam.x) / cam.zoom;
  const wy = (e.clientY - rect.top - cam.y) / cam.zoom;
  // 节点中心对齐到鼠标位置
  addNode(type, wx - 140, wy - 50);
});

// 搜索过滤
document.getElementById('libSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.node-library-item').forEach(item => {
    const name = item.querySelector('.lib-name').textContent.toLowerCase();
    const desc = item.querySelector('.lib-desc').textContent.toLowerCase();
    item.style.display = (name.includes(q) || desc.includes(q)) ? '' : 'none';
  });
});

// 左侧节点库折叠/展开
document.getElementById('sidebarCollapseBtn').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  // 折叠状态改变后需要重绘画布（画布尺寸变化）
  setTimeout(() => {
    resizeCanvases();
    markEdgesDirty();
  }, 260);
});

// 响应式窄屏：≤760px 侧栏默认收起为覆盖式抽屉（给画布让出宽度），宽屏恢复展开。
// 仅在加载与跨断点 resize 时同步，不干扰用户在断点内的手动折叠/展开。
(function mountResponsiveSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const MOBILE = 760;
  let t = null;
  const repaint = () => setTimeout(() => {
    if (typeof resizeCanvases === 'function') resizeCanvases();
    if (typeof markEdgesDirty === 'function') markEdgesDirty();
  }, 260);
  const sync = () => { sb.classList.toggle('collapsed', window.innerWidth <= MOBILE); repaint(); };
  sync();
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(sync, 150); });
})();
// 折叠态节点图标悬停提示节点名称：body 级 fixed tooltip（sidebar/list 有 overflow 裁剪，::after 会被剪掉）
(function mountCollapsedLibTip() {
  const list = document.getElementById('sidebarList');
  const sidebar = document.getElementById('sidebar');
  if (!list || !sidebar) return;
  let tip = document.getElementById('libIconTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'libIconTip';
    tip.className = 'lib-icon-tip';
    document.body.appendChild(tip);
  }
  const hide = () => { tip.style.opacity = '0'; tip.style.visibility = 'hidden'; };
  list.addEventListener('mouseover', (e) => {
    if (!sidebar.classList.contains('collapsed')) { hide(); return; }
    const item = e.target.closest('.node-library-item');
    if (!item) { hide(); return; }
    const def = NODE_TYPES[item.dataset.type];
    const label = (def && def.label) || item.dataset.type || '';
    if (!label) { hide(); return; }
    const r = item.getBoundingClientRect();
    tip.textContent = label;
    tip.style.left = (r.right + 8) + 'px';
    tip.style.top = (r.top + r.height / 2) + 'px';
    tip.style.visibility = 'visible';
    tip.style.opacity = '1';
  });
  list.addEventListener('mouseout', (e) => {
    const item = e.target.closest('.node-library-item');
    if (item && !item.contains(e.relatedTarget)) hide();
  });
  list.addEventListener('scroll', hide);
  const btn = document.getElementById('sidebarCollapseBtn');
  if (btn) btn.addEventListener('click', hide);
})();

//================ 16. 拓扑执行引擎 (数据流动骨架 A2) ================
// 数据载荷统一结构: { type:'image'|'text'|'video'|'audio', value:<内容>, ... }
//  image  → value 为 dataURL 字符串
//  text   → value 为字符串
//  video  → value 为 { poster, duration, ... }
//  audio  → value 为 { name, duration, ... }

// 清空某节点的运行数据（连线结构变化时调用，避免脏数据残留）
function resetNodeData(node) {
  node.inputsData = (node.def.inputs || []).map(() => null);
  node._multiInputs = (node.def.inputs || []).map(() => []);
  node.outputsData = (node.def.outputs || []).map(() => null);
  node.status = 'idle';
  if (node.el) {
    buildNodeBody(node.el, node);
    updateNodeStatus(node);
  }
}

// 收集该节点每个输入端口的上游载荷
// 多源支持：同一端口允许多条线连入（如多张参考图）。
//   node.inputsData[i]   = 第一个非空 payload（保持向后兼容，单值读取点无感）
//   node._multiInputs[i] = 所有连入该端口的 payload 数组（供需要"多参考图"的节点消费）
function gatherInputs(node) {
  const def = node.def;
  const inputs = def.inputs || [];
  node.inputsData = inputs.map(() => null);
  node._multiInputs = inputs.map(() => []);
  [...workflow.edges.values()].forEach(e => {
    if (e.to.node === node) {
      const src = e.from.node;
      const payload = (src.outputsData && src.outputsData[e.from.port]) || null;
      if (payload) {
        // 单值槽位：保留首个非空（避免被后面的覆盖）
        if (!node.inputsData[e.to.port]) node.inputsData[e.to.port] = payload;
        // 多源数组：累加所有 payload
        node._multiInputs[e.to.port].push(payload);
      }
    }
  });
}

// 根据节点类型 + 输入 + 参数，计算本节点输出载荷
function computeNodeOutput(node) {
  const def = node.def;
  const outDefs = def.outputs || [];
  const inputs = node.inputsData || [];
  const out = outDefs.map(() => null);
  const seed = parseInt(node.id.replace(/\D/g, '')) || 1;

  switch (node.type) {
    case 'image':
      out[0] = { type: 'image', value: getNodeDisplayImageSource(node) || createPlaceholderDataURL(40, 40, seed, 'IMG') };
      break;
    case 'videoInput':
      out[0] = { type: 'video', value: {
        poster: node.thumb || createPlaceholderDataURL(80, 50, seed + 200, ''),
        duration: node.params.duration || '00:12',
        name: node.params.name || '视频',
        src: node.uploadedVideo || ''
      } };
      break;
    case 'text':
      out[0] = { type: 'text', value: applyLoopVars(nodeFullText(node).trim()) || '(空文本)' };
      break;
    case 'bgm':
      out[0] = { type: 'audio', value: { name: node.params.name, duration: node.params.duration } };
      break;
    case 'aiImage':
    case 'imageEdit':
    case 'aiVideo':
    case 'upscale':
    case 'lineart':
    case 'aiSet':
    case 'material':
    case 'light':
    case 'layout': {
      // 优先使用上游传入的图片，否则用自身缩略图或生成占位
      const upImg = inputs.find(d => d && d.type === 'image');
      const gen = (upImg && upImg.value) ? upImg.value
        : (getNodeDisplayImageSource(node) || normalizeImageSrc(node.uploadedImage) || node.thumb || createPlaceholderDataURL(40, 40, seed + 500, node.def.label));
      out[0] = { type: (node.type === 'aiVideo' ? 'video' : 'image'), value: gen };
      break;
    }
    case 'compare': {
      const a = inputs[0], b = inputs[1];
      out[0] = { type: 'image', value: createPlaceholderDataURL(40, 40, seed + 700, a ? '原' : '·', b ? '果' : '·') };
      break;
    }
    case 'videoBreak': {
      // 输入为视频 → 拆解出关键帧（图）与片段（视频）
      const frames = node.params.frames || 6;
      const segs = node.params.segments || 3;
      const upVid = inputs.find(d => d && d.type === 'video');
      const upVidValue = upVid && upVid.value;
      const basePoster = (upVidValue && upVidValue.poster)
        ? upVidValue.poster
        : createPlaceholderDataURL(120, 70, seed + 600, '');
      const upVidSrc = upVidValue && typeof upVidValue.src === 'string' ? upVidValue.src : '';
      // 关键帧：以占位图代表"拆解 N 帧"的合集，可作为下游图片输入
      out[0] = { type: 'image', value: upVidValue && upVidValue.poster
        ? upVidValue.poster
        : createPlaceholderDataURL(120, 120, seed + 600, '拆解' + frames + '帧') };
      // 片段：多段视频
      out[1] = { type: 'video', value: {
        poster: basePoster,
        duration: '片段×' + segs,
        src: upVidSrc
      } };
      break;
    }
    case 'script':
      out[0] = { type: 'text', value: node.params.script || '' };
      break;
    case 'footage':
      out[0] = { type: 'video', value: { poster: createPlaceholderDataURL(80, 50, seed + 800, ''), duration: (node.params.items || []).length + ' 段素材' } };
      break;
    case 'voiceover':
      out[0] = { type: 'audio', value: { name: '配音', duration: node.params.duration } };
      break;
    case 'subtitle':
      out[0] = { type: 'text', value: (node.params.lines || []).map(l => l.text).join(' / ') };
      break;
    case 'compose':
      out[0] = { type: 'video', value: { poster: createPlaceholderDataURL(120, 70, seed + 900, '合成'), duration: node.params.duration } };
      break;
    case 'save':
    case 'publish':
      // 终止节点，无输出
      break;
    case 'loop':
      // 输出由 runLoopNode 在执行时写入 node.outputsData，这里兜底返回
      out[0] = { type: 'image', value: (node._galleryImages && node._galleryImages[0]) || node.thumb || '' };
      break;
  }
  return out;
}

// 异步执行单节点：收集输入 → 计算输出 → 刷新卡片
//================ 4i. ComfyUI 节点（浏览器直连本地 ComfyUI） ================
// 内置工作流模板（标准 ComfyUI API 格式）。build(values) 返回 {nodeId:{class_type,inputs,_meta}}。
function comfyNum(v, d) { const n = parseFloat(v); return isNaN(n) ? d : n; }
function comfyInt(v, d) { const n = parseInt(v); return isNaN(n) ? d : n; }
function comfySeed(v) { const n = parseInt(v); return (isNaN(n) || n < 0) ? Math.floor(Math.random() * 4294967295) : n; }

const COMFY_WORKFLOWS = {
  txt2img: {
    label: '文生图 (SDXL)',
    fields: [
      { key:'prompt', label:'提示词', type:'textarea', default:'(masterpiece, best quality), 1girl, sunny day' },
      { key:'negative', label:'负面提示词', type:'text', default:'lowres, bad anatomy, worst quality' },
      { key:'seed', label:'种子 (-1=随机)', type:'number', default:-1, min:-1, max:4294967295 },
      { key:'steps', label:'采样步数', type:'slider', default:25, min:1, max:80 },
      { key:'cfg', label:'CFG 权重', type:'slider', default:7, min:1, max:20, step:0.5 },
      { key:'width', label:'宽', type:'number', default:1024, min:64, max:2048 },
      { key:'height', label:'高', type:'number', default:1024, min:64, max:2048 },
    ],
    build(v) {
      return {
        "3": { class_type:"KSampler", inputs:{ seed:comfySeed(v.seed), steps:comfyInt(v.steps,25), cfg:comfyNum(v.cfg,7), sampler_name:"euler", scheduler:"normal", denoise:1, model:["4",0], positive:["6",0], negative:["7",0], latent_image:["5",0] }, _meta:{title:"采样"} },
        "4": { class_type:"CheckpointLoaderSimple", inputs:{ ckpt_name:"sd_xl_base_1.0.safetensors" }, _meta:{title:"载入模型"} },
        "5": { class_type:"EmptyLatentImage", inputs:{ width:comfyInt(v.width,1024), height:comfyInt(v.height,1024), batch_size:1 }, _meta:{title:"空白潜空间"} },
        "6": { class_type:"CLIPTextEncode", inputs:{ text:String(v.prompt||''), clip:["4",1] }, _meta:{title:"正向提示词"} },
        "7": { class_type:"CLIPTextEncode", inputs:{ text:String(v.negative||''), clip:["4",1] }, _meta:{title:"负向提示词"} },
        "8": { class_type:"VAEDecode", inputs:{ samples:["3",0], vae:["4",2] }, _meta:{title:"VAE 解码"} },
        "9": { class_type:"SaveImage", inputs:{ images:["8",0] }, _meta:{title:"保存图像"} },
      };
    }
  },
  img2img: {
    label: '图生图 (SDXL)',
    inputs: [{ node:"10", input:"image", portType:"image" }],
    fields: [
      { key:'prompt', label:'提示词', type:'textarea', default:'(masterpiece), 1girl' },
      { key:'negative', label:'负面提示词', type:'text', default:'lowres' },
      { key:'denoise', label:'重绘幅度', type:'slider', default:0.6, min:0, max:1, step:0.05 },
      { key:'seed', label:'种子 (-1=随机)', type:'number', default:-1, min:-1, max:4294967295 },
      { key:'steps', label:'采样步数', type:'slider', default:25, min:1, max:80 },
      { key:'cfg', label:'CFG 权重', type:'slider', default:7, min:1, max:20, step:0.5 },
    ],
    build(v) {
      return {
        "10": { class_type:"LoadImage", inputs:{ image:"__COMFY_INPUT__" }, _meta:{title:"载入图像"} },
        "3": { class_type:"KSampler", inputs:{ seed:comfySeed(v.seed), steps:comfyInt(v.steps,25), cfg:comfyNum(v.cfg,7), sampler_name:"euler", scheduler:"normal", denoise:comfyNum(v.denoise,0.6), model:["4",0], positive:["6",0], negative:["7",0], latent_image:["12",0] }, _meta:{title:"采样"} },
        "4": { class_type:"CheckpointLoaderSimple", inputs:{ ckpt_name:"sd_xl_base_1.0.safetensors" }, _meta:{title:"载入模型"} },
        "11": { class_type:"VAELoader", inputs:{ vae_name:"ae.safetensors" }, _meta:{title:"载入 VAE"} },
        "12": { class_type:"VAEEncode", inputs:{ pixels:["10",0], vae:["11",0] }, _meta:{title:"VAE 编码"} },
        "6": { class_type:"CLIPTextEncode", inputs:{ text:String(v.prompt||''), clip:["4",1] }, _meta:{title:"正向提示词"} },
        "7": { class_type:"CLIPTextEncode", inputs:{ text:String(v.negative||''), clip:["4",1] }, _meta:{title:"负向提示词"} },
        "8": { class_type:"VAEDecode", inputs:{ samples:["3",0], vae:["11",0] }, _meta:{title:"VAE 解码"} },
        "9": { class_type:"SaveImage", inputs:{ images:["8",0] }, _meta:{title:"保存图像"} },
      };
    }
  },
  upscale: {
    label: '超清放大',
    inputs: [{ node:"10", input:"image", portType:"image" }],
    fields: [
      { key:'scale', label:'放大倍数', type:'slider', default:2, min:1.5, max:4, step:0.5 },
      { key:'method', label:'算法', type:'dropdown', options:['lanczos','bilinear','bicubic'], default:'lanczos' },
    ],
    build(v) {
      return {
        "10": { class_type:"LoadImage", inputs:{ image:"__COMFY_INPUT__" }, _meta:{title:"载入图像"} },
        "20": { class_type:"ImageScaleBy", inputs:{ image:["10",0], scale_by:comfyNum(v.scale,2), method:String(v.method||'lanczos') }, _meta:{title:"放大"} },
        "9": { class_type:"SaveImage", inputs:{ images:["20",0] }, _meta:{title:"保存图像"} },
      };
    }
  },
  custom: {
    label: '自定义 JSON',
    custom: true,
    fields: [
      { key:'json', label:'ComfyUI 工作流 JSON', type:'textarea', default:'{\n  "3": { "class_type":"KSampler", "inputs":{ "seed":0, "steps":20, "cfg":7, "sampler_name":"euler", "scheduler":"normal", "denoise":1, "model":["4",0], "positive":["6",0], "negative":["7",0], "latent_image":["5",0] }, "_meta":{ "title":"采样" } },\n  "4": { "class_type":"CheckpointLoaderSimple", "inputs":{ "ckpt_name":"sd_xl_base_1.0.safetensors" }, "_meta":{ "title":"载入模型" } },\n  "5": { "class_type":"EmptyLatentImage", "inputs":{ "width":1024, "height":1024, "batch_size":1 }, "_meta":{ "title":"空白潜空间" } },\n  "6": { "class_type":"CLIPTextEncode", "inputs":{ "text":"beautiful scenery", "clip":["4",1] }, "_meta":{ "title":"正向" } },\n  "7": { "class_type":"CLIPTextEncode", "inputs":{ "text":"", "clip":["4",1] }, "_meta":{ "title":"负向" } },\n  "8": { "class_type":"VAEDecode", "inputs":{ "samples":["3",0], "vae":["4",2] }, "_meta":{ "title":"VAE 解码" } },\n  "9": { "class_type":"SaveImage", "inputs":{ "images":["8",0] }, "_meta":{ "title":"保存图像" } }\n}' },
    ],
    build(v) {
      try { return JSON.parse(String(v.json||'{}')); }
      catch (e) { throw new Error('自定义 JSON 解析失败：' + e.message); }
    }
  }
};

function comfyGetInputImage(node) {
  const list = (node.inputsData || []).filter(d => d && d.type === 'image' && normalizeImageSrc(d.value));
  return list.length ? list[0].value : null;
}

async function comfyUploadImage(addr, dataUrl) {
  try {
    const comma = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, comma);
    const b64 = dataUrl.slice(comma + 1);
    const mime = (meta.match(/data:([^;]+)/) || [,'image/png'])[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const fd = new FormData();
    fd.append('image', blob, 'flowcraft_in.png');
    const r = await fetch(addr + '/upload/image', { method:'POST', body: fd });
    if (!r.ok) return null;
    const j = await r.json();
    return j.name || null;
  } catch (e) { return null; }
}

function comfyExtractImages(addr, historyItem) {
  const out = [];
  try {
    const outs = (historyItem && historyItem.outputs) || {};
    Object.keys(outs).forEach(k => {
      const o = outs[k];
      if (o && Array.isArray(o.images)) {
        o.images.forEach(im => {
          const sub = im.subfolder ? ('&subfolder=' + encodeURIComponent(im.subfolder)) : '';
          const ft = im.type ? ('&type=' + encodeURIComponent(im.type)) : '&type=output';
          out.push(addr + '/view?filename=' + encodeURIComponent(im.filename) + sub + ft);
        });
      }
    });
  } catch (e) {}
  return out;
}

async function runComfyUINode(node) {
  const addr = String(node.params.addr || 'http://127.0.0.1:8188').replace(/\/+$/, '');
  const tmpl = COMFY_WORKFLOWS[node.params.wf] || COMFY_WORKFLOWS.txt2img;
  const values = node.params.fields || {};
  node._comfyErr = '';

  // 0) 执行目标：默认本地直连；配置 comfyProxyBase（或全局 __comfyuiProxyBase__）则走用户隧道/代理
  const _target = _comfyExecTarget(node);
  const base = (_target === 'proxy')
    ? String(node.params.comfyProxyBase || (window.FlowCraft && window.FlowCraft.__comfyuiProxyBase__) || addr)
    : addr;

  // 1) 探测是否可达（loopback 豁免混合内容拦截）
  let reachable = false;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(base + '/system_stats', { signal: ctrl.signal });
    clearTimeout(to);
    reachable = r.ok;
  } catch (e) { reachable = false; }

  if (!reachable) {
    node.status = 'error';
    node._comfyErr = '未检测到 ComfyUI 服务（' + base + '）。请先启动 ComfyUI（建议加参数 --enable-cors-header *），再运行此节点。';
    showToast(node._comfyErr, 'danger');
    return false;
  }

  // 2) 构建提示词（优先使用标准格式 customJson，否则用内置模板）
  let promptObj;
  try {
    if (node.params.customJson) {
      const imp = window.FlowCraft && window.FlowCraft.comfyui && window.FlowCraft.comfyui.importWorkflow;
      promptObj = imp ? imp(node.params.customJson) : JSON.parse(node.params.customJson);
    }
    if (!promptObj) promptObj = tmpl.build(values);
  } catch (e) {
    node.status = 'error';
    node._comfyErr = 'ComfyUI 工作流构建失败：' + localizeError(e);
    showToast(node._comfyErr, 'danger');
    return false;
  }

  // 3) 上传输入图并注入 LoadImage
  if (Array.isArray(tmpl.inputs)) {
    const img = comfyGetInputImage(node);
    const fname = img ? await comfyUploadImage(addr, img) : null;
    tmpl.inputs.forEach(spec => {
      if (promptObj[spec.node] && promptObj[spec.node].inputs) {
        promptObj[spec.node].inputs[spec.input] = fname || '__COMFY_INPUT__';
      }
    });
  }

  // 4) 提交任务
  const clientId = 'flowcraft-' + Math.random().toString(36).slice(2, 10);
  let promptId;
  try {
    const r = await fetch(base + '/prompt', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ prompt: promptObj, client_id: clientId })
    });
    if (!r.ok) {
      let detail = '';
      try { const ej = await r.json(); detail = JSON.stringify(ej.error || ej); } catch(_) {}
      node.status = 'error';
      node._comfyErr = 'ComfyUI 拒绝任务（HTTP ' + r.status + '）：' + localizeError(detail || ('HTTP ' + r.status));
      showToast(node._comfyErr, 'danger');
      return false;
    }
    const pj = await r.json();
    promptId = pj.prompt_id;
  } catch (e) {
    node.status = 'error';
    node._comfyErr = '提交 ComfyUI 任务失败：' + localizeError(e);
    showToast(node._comfyErr, 'danger');
    return false;
  }

  if (!promptId) {
    node.status = 'error';
    node._comfyErr = 'ComfyUI 未返回任务 ID';
    showToast(node._comfyErr, 'danger');
    return false;
  }

  // 5) 轮询历史（最长 30 分钟）
  let historyItem = null;
  const deadline = Date.now() + 1800000;
  while (Date.now() < deadline) {
    try {
      const hr = await fetch(base + '/history/' + promptId);
      if (hr.ok) {
        const hj = await hr.json();
        if (hj[promptId]) { historyItem = hj[promptId]; break; }
      }
    } catch (_) {}
    await new Promise(res => setTimeout(res, 1000));
  }

  if (!historyItem) {
    node.status = 'error';
    node._comfyErr = 'ComfyUI 任务超时（>30分钟）未返回结果';
    showToast(node._comfyErr, 'danger');
    return false;
  }

  // 解析 ComfyUI node_errors（若有）
  if (historyItem.status && historyItem.status.status_str === 'error') {
    let msg = 'ComfyUI 执行失败';
    try {
      const ne = historyItem.status.node_errors || [];
      if (ne.length) msg = 'ComfyUI 节点错误：' + ne.map(x => (x.class_type || x.type || '节点') + ' ' + (x.message || '')).join('；');
    } catch(_) {}
    node.status = 'error';
    node._comfyErr = msg;
    showToast(node._comfyErr, 'danger');
    return false;
  }

  // 6) 提取输出图
  const imgs = comfyExtractImages(base, historyItem);
  if (!imgs.length) {
    node.status = 'error';
    node._comfyErr = 'ComfyUI 未返回任何图像（请确认工作流含 SaveImage 节点）';
    showToast(node._comfyErr, 'danger');
    return false;
  }
  node.thumb = imgs[0];
  node.outputsData = imgs.map(src => ({ type:'image', value: src }));
  return true;
}

function renderComfyNodeBody(node) {
  const wrap = document.createElement('div');
  wrap.className = 'node-body node-body-comfy';
  const tmpl = COMFY_WORKFLOWS[node.params.wf] || COMFY_WORKFLOWS.txt2img;

  // 地址
  const addrRow = document.createElement('div');
  addrRow.className = 'comfy-addr-row';
  const addrInp = document.createElement('input');
  addrInp.type = 'text';
  addrInp.className = 'comfy-addr';
  addrInp.value = node.params.addr || 'http://127.0.0.1:8188';
  addrInp.title = 'ComfyUI 地址（本地局域网）';
  addrInp.oninput = (e) => { node.params.addr = e.target.value.trim(); scheduleAutosave(); };
  addrInp.onmousedown = (e) => e.stopPropagation();
  addrRow.appendChild(addrInp);
  wrap.appendChild(addrRow);

  // 工作流选择
  const wfRow = document.createElement('div');
  wfRow.className = 'comfy-wf-row';
  const wfSel = document.createElement('select');
  wfSel.className = 'comfy-wf';
  Object.keys(COMFY_WORKFLOWS).forEach(k => {
    const o = document.createElement('option'); o.value = k; o.textContent = COMFY_WORKFLOWS[k].label;
    if ((node.params.wf || 'txt2img') === k) o.selected = true;
    wfSel.appendChild(o);
  });
  wfSel.onchange = (e) => {
    node.params.wf = e.target.value;
    node.params.fields = {};
    if (node.el) buildNodeBody(node.el, node);
    scheduleAutosave();
  };
  wfSel.onmousedown = (e) => e.stopPropagation();
  wfRow.appendChild(wfSel);
  wrap.appendChild(wfRow);

  // 字段
  const fieldsBox = document.createElement('div');
  fieldsBox.className = 'comfy-fields';
  (tmpl.fields || []).forEach(f => { fieldsBox.appendChild(comfyFieldRow(node, f)); });
  wrap.appendChild(fieldsBox);

  // 运行按钮
  const actRow = document.createElement('div');
  actRow.className = 'comfy-act-row';
  const runBtn = document.createElement('button');
  runBtn.className = 'run-btn comfy-run';
  runBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l9 6-9 6z"/></svg><span>运行</span>';
  runBtn.onclick = (e) => { e.stopPropagation(); runNode(node); };
  runBtn.onmousedown = (e) => e.stopPropagation();
  actRow.appendChild(runBtn);
  wrap.appendChild(actRow);

  // 打开工作流编辑器按钮
  const editRow = document.createElement('div');
  editRow.className = 'comfy-edit-row';
  const editBtn = document.createElement('button');
  editBtn.className = 'ra-btn comfy-edit-btn';
  editBtn.type = 'button';
  editBtn.textContent = '⚙ 工作流编辑器';
  editBtn.onclick = (e) => { e.stopPropagation(); if (window.FlowCraft && window.FlowCraft._openComfyEditor) window.FlowCraft._openComfyEditor(node); };
  editBtn.onmousedown = (e) => e.stopPropagation();
  editRow.appendChild(editBtn);
  wrap.appendChild(editRow);

  // 自定义工作流标记
  if (node.params.customJson) {
    const badge = document.createElement('div');
    badge.className = 'comfy-custom-badge';
    badge.textContent = '已加载自定义工作流 JSON';
    wrap.appendChild(badge);
  }

  // 提示
  const hint = document.createElement('div');
  hint.className = 'comfy-hint';
  hint.textContent = tmpl.inputs ? '需连接上游图片节点作为输入' : '纯文本生图，无需上游输入';
  wrap.appendChild(hint);

  return wrap;
}

function comfyFieldRow(node, f) {
  const row = document.createElement('div');
  row.className = 'comfy-field';
  const lab = document.createElement('label');
  lab.className = 'comfy-field-label';
  lab.textContent = f.label;
  row.appendChild(lab);
  if (!node.params.fields) node.params.fields = {};
  const raw = node.params.fields[f.key];
  const cur = (raw === undefined || raw === null || raw === '') ? f.default : raw;

  if (f.type === 'textarea') {
    const taWrap = document.createElement('div');
    taWrap.className = 'comfy-ta-row';
    const ta = document.createElement('textarea');
    ta.className = 'comfy-ta'; ta.rows = 2; ta.value = String(cur);
    ta.oninput = (e) => { node.params.fields[f.key] = e.target.value; if (f.key === 'prompt') node.prompt = e.target.value; scheduleAutosave(); };
    ta.onmousedown = (e) => e.stopPropagation();
    taWrap.appendChild(ta);
    // 放大面板：复用全局 openPromptExpandEditor（Esc/Ctrl+Enter 关闭、点外部关闭、字数统计）
    const expBtn = makePromptExpandBtn(
      () => String(node.params.fields[f.key] != null ? node.params.fields[f.key] : ''),
      (v) => { node.params.fields[f.key] = v; if (f.key === 'prompt') node.prompt = v; scheduleAutosave(); },
      (v) => { ta.value = v; },
      (f.label || '提示词') + ' · 放大编辑'
    );
    taWrap.appendChild(expBtn);
    row.appendChild(taWrap); bindEditHistory(ta);
  } else if (f.type === 'dropdown') {
    const sel = document.createElement('select'); sel.className = 'comfy-sel';
    (f.options||[]).forEach(opt => { const o=document.createElement('option'); o.value=opt; o.textContent=opt; sel.appendChild(o); });
    sel.value = String(cur);
    sel.onchange = (e) => { node.params.fields[f.key] = e.target.value; scheduleAutosave(); };
    sel.onmousedown = (e) => e.stopPropagation();
    row.appendChild(sel); bindEditHistory(sel);
  } else if (f.type === 'slider') {
    const rng = document.createElement('input'); rng.type='range';
    rng.min = f.min!=null?f.min:0; rng.max = f.max!=null?f.max:100; rng.step = f.step!=null?f.step:1; rng.value = cur;
    const out = document.createElement('span'); out.className='comfy-range-val'; out.textContent = cur;
    rng.oninput = (e) => { out.textContent = e.target.value; node.params.fields[f.key] = parseFloat(e.target.value); scheduleAutosave(); };
    rng.onmousedown = (e) => { e.stopPropagation(); };
    const rngWrap = document.createElement('div'); rngWrap.className = 'comfy-range-row';
    rngWrap.appendChild(rng); rngWrap.appendChild(out);
    row.appendChild(rngWrap); bindEditHistory(rng);
  } else if (f.type === 'boolean') {
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = !!cur;
    chk.onchange = (e) => { node.params.fields[f.key] = e.target.checked; scheduleAutosave(); };
    chk.onmousedown = (e) => e.stopPropagation();
    row.appendChild(chk); bindEditHistory(chk);
  } else {
    const inp = document.createElement('input'); inp.type = (f.type === 'number') ? 'number' : 'text';
    inp.className = 'comfy-inp'; inp.value = cur;
    if (f.min != null) inp.min = f.min;
    if (f.max != null) inp.max = f.max;
    inp.oninput = (e) => { node.params.fields[f.key] = (f.type === 'number') ? e.target.value : e.target.value; scheduleAutosave(); };
    inp.onmousedown = (e) => e.stopPropagation();
    row.appendChild(inp); bindEditHistory(inp);
  }
  return row;
}

function executeNodeAsync(node, delay) {
  return new Promise(resolve => {
    if (node.status === 'running') { resolve(); return; }
    node.status = 'running';
    updateNodeStatus(node);
    markEdgesDirty();

    // T2-4 运行前校验：节点数据契约（stub 硬拦截 + validate 拦截），错误归档进 REGEN
    // 例外：tier='stub' 但已启用 API 代理的节点（依赖服务端能力的真实视频生成等）视为可运行
    if (window.FlowCraft && window.FlowCraft.nodes && window.FlowCraft.nodes.beforeRun) {
      const br = window.FlowCraft.nodes.beforeRun(node);
      if (!br.ok && !(br.stub && _fcProxy())) {
        // 语义落点区分：stub 是「能力未实现」，validate 不通过是「本次参数不合法」，两者不可混标
        setNodeResultMode(node, br.stub ? 'unimplemented' : 'failed');
        node.status = 'failure';
        updateNodeStatus(node);
        markEdgesDirty();
        if (typeof showToast === 'function') showToast(br.reason || '节点不可运行', 'error');
        try { if (typeof logRegen === 'function') logRegen({ nodeId: node.id, nodeType: node.type, error: br.reason || 'param-validation', kind: 'param-validation' }); } catch (e) {}
        resolve();
        return;
      }
    }

        setTimeout(async () => {
          const _t0 = Date.now();
      try {
        gatherInputs(node);

        // 循环节点：批量驱动下游节点重复执行，聚合产出入图集
        if (node.type === 'loop') {
          await runLoopNode(node);
          setNodeResultMode(node, 'demo');
          node.status = 'done';
          logRun(node, true, Date.now() - _t0);
          if (node.el) buildNodeBody(node.el, node);
          updateNodeStatus(node);
          markEdgesDirty();
          scheduleAutosave();
          resolve();
          return;
        }

        // 上游文本输入 → 生成提示词（角色描述在前 + 节点自身视角指令在后拼接；仅一方存在时用其一）
        if (node.type === 'aiImage' || node.type === 'imageEdit' || node.type === 'aiVideo') {
          const textIn = (node.inputsData || []).find(d => d && d.type === 'text');
          const upText = textIn && textIn.value && textIn.value !== '(空文本)' ? String(textIn.value).trim() : '';
          const ownText = (node.prompt || '').trim();
          const merged = (upText && ownText) ? (upText + '\n' + ownText) : (ownText || upText);
          node.effectivePrompt = applyLoopVars(merged);
        }

        // 保存节点：实际触发本地下载
        if (node.type === 'save') {
          setNodeResultMode(node, 'demo');
          await runSaveNode(node);
          if (node.el) buildNodeBody(node.el, node);
          updateNodeStatus(node);
          markEdgesDirty();
          scheduleAutosave();
          resolve();
          return;
        }

        // 智能超清 / 线稿：基于上游真实图片做图生图（img2img）
        // 有上游图且配置了 OpenAI Key 时调用 images/edits；否则 / 失败时回退到下方 computeNodeOutput（保留原图透传）。
        if (node.type === 'upscale' || node.type === 'lineart' || node.type === 'imageEdit') {
          const upImg = getNodeInputImage(node);
          const editKey = localStorage.getItem(OPENAI_KEY_STORAGE);
          const proxyOn = !!_fcProxy();
          if (upImg && (editKey || proxyOn)) {
            try {
              const edited = await generateOpenAIImageEdit(node, upImg);
              if (edited) {
                node.thumb = edited;
                node.outputsData = [{ type: 'image', value: edited }];
                node._galleryImages = [edited];
                setNodeResultMode(node, 'real');
                node.status = 'done';
                captureGenMeta(node, Date.now() - _t0);
                logRun(node, true, Date.now() - _t0);
                if (node.el) buildNodeBody(node.el, node);
                updateNodeStatus(node);
                markEdgesDirty();
                scheduleAutosave();
                resolve();
                return;
              }
            } catch (err) {
              showToast(node.title + ' 真实图生图失败，已回退为原图：' + localizeError(err), 'warn');
            }
          }
          // 无 AI Key/代理但有上游图 → 本地线稿（Sobel 边缘检测，离线真实出图）
          if (node.type === 'lineart' && upImg && !editKey && !proxyOn) {
            const la = await localLineartImage(upImg);
            if (la) {
              node.thumb = la;
              node.outputsData = [{ type: 'image', value: la }];
              node._galleryImages = [la];
              setNodeResultMode(node, 'real');
              node.status = 'done';
              node._localLineart = true;
              captureGenMeta(node, Date.now() - _t0);
              logRun(node, true, Date.now() - _t0);
              if (node.el) buildNodeBody(node.el, node);
              updateNodeStatus(node);
              markEdgesDirty();
              scheduleAutosave();
              showToast('本地线稿完成（边缘检测）。配置 AI Key/代理后可用模型线稿', 'success', 4200);
              resolve();
              return;
            }
          }
          // 无 AI Key/代理但有上游图 → 本地算法超清（离线真实出图，非占位）
          if (node.type === 'upscale' && upImg && !editKey && !proxyOn) {
            const localUp = await localUpscaleImage(upImg, 2);
            if (localUp) {
              node.thumb = localUp;
              node.outputsData = [{ type: 'image', value: localUp }];
              node._galleryImages = [localUp];
              setNodeResultMode(node, 'real');
              node.status = 'done';
              node._localUpscale = true;
              captureGenMeta(node, Date.now() - _t0);
              logRun(node, true, Date.now() - _t0);
              if (node.el) buildNodeBody(node.el, node);
              updateNodeStatus(node);
              markEdgesDirty();
              scheduleAutosave();
              showToast('本地算法超清完成（2x）。配置 AI Key/代理后可用模型超清', 'success', 4200);
              resolve();
              return;
            }
          }
          // 无上游图 / 未配置 Key / 接口不支持 → 走下方 computeNodeOutput 回退（保留原图 / 占位）
        }

        // ComfyUI 节点：浏览器直连本地 ComfyUI
        if (node.type === 'comfyui') {
          const ok = await runComfyUINode(node);
          if (ok) setNodeResultMode(node, 'real');
          node.status = ok ? 'done' : 'error';
          if (ok) captureGenMeta(node, Date.now() - _t0);
          logRun(node, ok, Date.now() - _t0, ok ? '' : (node._comfyErr || 'ComfyUI 运行失败'));
          if (node.el) buildNodeBody(node.el, node);
          updateNodeStatus(node);
          markEdgesDirty();
          scheduleAutosave();
          resolve();
          return;
        }

        // AI 绘图节点统一走真实生成；节点上的模型名称仅作为 UI 标签，不再把真实生成绑死到单一选项
        const isAiImageNode = node.type === 'aiImage';
        if (node.type === 'aiVideo') {
          // 阶段 5：经 API 安全代理异步生成视频；未启用代理则回退 computeNodeOutput 占位（保 four-features 等价）
          if (_fcProxy()) {
            const v = await runVideoNodeViaProxy(node);
            node.thumb = v.thumb;
            node.outputsData = v.outputsData;
            setNodeResultMode(node, 'real');
          } else {
            node.outputsData = computeNodeOutput(node);
            setNodeResultMode(node, 'demo');
          }
          node.status = 'done';
          captureGenMeta(node, Date.now() - _t0);
          logRun(node, true, Date.now() - _t0);
        } else if (isAiImageNode) {
          // 真实调用图片生成（代理启用时经 FlowCraft.proxy）
          const img = await generateOpenAIImage(node);
          if (!img) { resolve(); return; } // 失败时状态已置 error
          node.thumb = img;
          node.outputsData = [{ type: 'image', value: img }];
          setNodeResultMode(node, 'real');
          node.status = 'done';
          captureGenMeta(node, Date.now() - _t0);
          logRun(node, true, Date.now() - _t0);
        } else if (node.resultMode === 'real' && Array.isArray(node.outputsData) && node.outputsData.length) {
          // 已由真实/本地路径产出：防止重复执行时演示回退覆盖真实结果
        } else {
          const out = computeNodeOutput(node);
          node.outputsData = out;
          setNodeResultMode(node, 'demo');

          // 图片类节点：把产出图片同步到缩略图，直观体现"继承上游"
          const imgOut = out.find(d => d && d.type === 'image');
          const imgTypes = ['image', 'aiImage', 'imageEdit', 'upscale', 'lineart', 'aiSet', 'material', 'light', 'layout', 'videoBreak'];
          if (imgOut && imgOut.value && typeof imgOut.value === 'string' && imgOut.value.startsWith('data:')
              && imgTypes.includes(node.type)) {
            node.thumb = imgOut.value;
          }
          node.status = 'done';
          logRun(node, true, Date.now() - _t0);
        }
      } catch (err) {
        const loc = localizeError(err);
        // 运行时异常（网络失败、上游报错等）属于「本次失败」，不代表节点能力未实现
        setNodeResultMode(node, 'failed');
        setNodeStatus(node, 'error', loc);
        logRun(node, false, Date.now() - _t0, loc);
        try {
          logRegen({
            id: 'regen_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            kind: 'failed', type: node.type,
            title: node.title || (NODE_TYPES[node.type] || {}).label || node.type,
            model: (node.params && node.params.model) || '',
            desc: describeNodeParams(node),
            error: loc, nodeId: node.id
          });
        } catch (e2) {}
        showToast(node.title + ' 运行失败：' + loc, 'danger');
      }
      if (node.el) buildNodeBody(node.el, node);
      if (node === __composerNode) showNodeComposer(node);
      updateNodeStatus(node);
      markEdgesDirty();
      scheduleAutosave();
      resolve();
    }, delay);
  });
}

// gpt-image-2 真实图像生成（images/generations 优先，不支持时自动回退 /v1/responses）
function normalizeApiBase(raw) {
  let b = String(raw || '').trim().replace(/\/+$/, '');
  if (!b) b = OPENAI_DEFAULT_BASE;
  b = b.replace(/\/+$/, '');
  if (!/\/v1$/.test(b)) b += '/v1';
  return b;
}
// 阶段 4：代理是否启用（opt-in）。启用则所有模型调用经 FlowCraft.proxy，浏览器不持有生产 Key。
function _fcProxy() {
  var p = window.FlowCraft && window.FlowCraft.proxy;
  return (p && typeof p.enabled === 'function' && p.enabled()) ? p : null;
}

// 阶段 9：智能模型路由（opt-in）。返回 {model, provider, reason} 或 null（未启用→沿用现网模型）。
// 仅用于「文本对话 / 生图」两类 capability；未启用时返回 null，调用点回退到 aiCurrentModel / gpt-image-2 等现网逻辑。
function _routeModel(capability) {
  var r = window.FlowCraft && window.FlowCraft.router;
  if (!r || typeof r.enabled !== 'function' || !r.enabled()) return null;
  try {
    var sel = r.select({ capability: capability || 'text', strategy: (r.strategy && r.strategy()) || 'quality' });
    return sel || null;
  } catch (_) { return null; }
}

// 阶段 9.2：ComfyUI 执行目标决策（opt-in）。ComfyUI 为本地自托管、无生产 Key，默认本地直连；
// 仅当用户配置 comfyProxyBase（节点参数）或全局 __comfyuiProxyBase__（用户隧道/代理）时走代理。
// 接受 node 或纯 params 对象。
function _comfyExecTarget(p) {
  var params = (p && p.params) ? p.params : (p || {});
  var proxyBase = params.comfyProxyBase || (window.FlowCraft && window.FlowCraft.__comfyuiProxyBase__);
  return proxyBase ? 'proxy' : 'local';
}

function openaiPostJSON(base, path, key, body) {
  var proxy = _fcProxy();
  if (proxy) {
    return proxy.call({ provider: 'openai', endpoint: path, body: body, token: window.FlowCraft.__userToken || undefined })
      .catch(function(err) {
        if (err && err.kind) {
          var m = new Error(err.message || 'proxy error'); m.status = err.status || 0; m.bodyText = ''; m.proxyKind = err.kind;
          throw m;
        }
        throw err;
      });
  }
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify(body)
  }).then(resp => {
    if (!resp.ok) {
      return resp.text().then(t => {
        const err = new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 200) : ''));
        err.status = resp.status;
        err.bodyText = t || '';
        throw err;
      });
    }
    return resp.json();
  });
}
function shouldFallbackToResponses(err) {
  const status = err && err.status;
  const t = String(err && err.bodyText || '').toLowerCase();
  return status === 404 || status === 405 || status === 501 ||
    /not found|does not exist|not support|unsupported|images\/generations|method not allowed|invalid path|endpoint/i.test(t);
}
function responseImageSrc(item) {
  if (!item) return null;
  const cands = [];
  if (typeof item.result === 'string' && item.result) {
    const r = item.result.trim();
    cands.push(/^data:/i.test(r) || /^https?:\/\//i.test(r) ? r : 'data:image/png;base64,' + r);
  }
  if (item.image) {
    if (item.image.b64_json) cands.push('data:image/png;base64,' + item.image.b64_json);
    if (item.image.url) cands.push(item.image.url);
  }
  if (item.image_url) cands.push(typeof item.image_url === 'string' ? item.image_url : (item.image_url.url || ''));
  if (item.url) cands.push(item.url);
  if (item.b64_json) cands.push('data:image/png;base64,' + item.b64_json);
  if (Array.isArray(item.content)) {
    item.content.forEach(c => {
      if (!c) return;
      if (c.type === 'image_url' && c.image_url) cands.push(typeof c.image_url === 'string' ? c.image_url : c.image_url.url || '');
      if (c.type === 'input_image' && c.image_url) cands.push(typeof c.image_url === 'string' ? c.image_url : c.image_url.url || '');
    });
  }
  return cands.map(normalizeImageSrc).find(Boolean) || null;
}
function extractResponseImages(data) {
  const list = [];
  const scan = arr => (arr || []).forEach(item => {
    const s = responseImageSrc(item);
    if (s) list.push(s);
    if (item && Array.isArray(item.output)) scan(item.output);
  });
  scan(data && data.output);
  return list;
}
function generateOpenAIImageViaResponses(base, key, model, prompt, n) {
  const count = Math.max(1, n || 1);
  const one = () => openaiPostJSON(base, '/responses', key, { model: model, input: prompt })
    .then(data => {
      const imgs = extractResponseImages(data);
      if (!imgs.length) throw new Error('responses 接口返回中未找到图片');
      return imgs;
    });
  if (count <= 1) return one();
  return Promise.all(Array.from({ length: count }, () => one()))
    .then(groups => groups.reduce((acc, g) => acc.concat(g), []));
}
// gpt-image-2 图像生成（精简版：只保留常用主模型 + 备选模型）
// 目标：减少兜底链路，避免一次生成触发过多请求。
var OPENAI_IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1'];

// 根据「比例 + 分辨率」挑选 API 支持的具体尺寸
// gpt-image-1 官方支持：1024x1024 / 1024x1536 / 1536x1024 / 1536x1536 / 1536x2048 / 2048x1024 / 2048x1536 / 2048x2048
// 第三方中转（gpt-image-2）可能支持更大的尺寸
const AI_SPEC_ASPECTS = ['1:1', '1:4', '4:5', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21', 'custom'];
const AI_SPEC_RESOLUTION_LABELS = { '高清1K': '1K', '超清2K': '2K', '原画4K': '4K' };
const AI_SPEC_RESOLUTIONS = ['高清1K', '超清2K', '原画4K'];
const AI_SPEC_ASPECT_META = {
  '1:1': { label: '1:1', ratio: 1 },
  '1:4': { label: '1:4', ratio: 1 / 4 },
  '4:5': { label: '4:5', ratio: 4 / 5 },
  '3:2': { label: '3:2', ratio: 3 / 2 },
  '2:3': { label: '2:3', ratio: 2 / 3 },
  '4:3': { label: '4:3', ratio: 4 / 3 },
  '3:4': { label: '3:4', ratio: 3 / 4 },
  '16:9': { label: '16:9', ratio: 16 / 9 },
  '9:16': { label: '9:16', ratio: 9 / 16 },
  '21:9': { label: '21:9', ratio: 21 / 9 },
  '9:21': { label: '9:21', ratio: 9 / 21 },
  custom: { label: '自定义', ratio: null }
};

function resolveAiSpecRatio(aspect, customAspect) {
  const parsedCustom = parseAspectRatio(customAspect);
  if (aspect === 'custom' && parsedCustom) return parsedCustom;
  const meta = AI_SPEC_ASPECT_META[aspect];
  if (meta && typeof meta.ratio === 'number') return meta.ratio;
  return parsedCustom || null;
}

function normalizeAiSpecParams(node) {
  if (!node) return { aspect: '1:1', resolution: '高清1K' };
  node.params = node.params || {};
  const defaultAspect = node.type === 'aiVideo' ? '9:16' : '1:1';
  const aspect = AI_SPEC_ASPECTS.includes(node.params.aspect) ? node.params.aspect : defaultAspect;
  const resolution = AI_SPEC_RESOLUTIONS.includes(node.params.resolution) ? node.params.resolution : AI_SPEC_RESOLUTIONS[0];
  node.params.aspect = aspect;
  node.params.resolution = resolution;
  return { aspect, resolution };
}

function buildUnifiedAiSpecSelect(node, wrapperClass) {
  const current = normalizeAiSpecParams(node);
  const selectClass = wrapperClass || 'nc-select';
  const wrap = document.createElement('button');
  const aspectLabel = AI_SPEC_ASPECT_META[current.aspect] ? AI_SPEC_ASPECT_META[current.aspect].label : current.aspect;
  const resolutionLabel = AI_SPEC_RESOLUTION_LABELS[current.resolution] || current.resolution;
  wrap.type = 'button';
  wrap.className = selectClass + ' ai-spec-trigger';
  wrap.title = '点击选择比例与分辨率';
  wrap.innerHTML = '<span class="ai-spec-trigger-aspect">' + escapeHtml(aspectLabel) + '</span>' +
    '<span class="ai-spec-trigger-sep">·</span>' +
    '<span class="ai-spec-trigger-resolution">' + escapeHtml(resolutionLabel) + '</span>' +
    '<span class="ai-spec-trigger-caret">▾</span>';
  wrap.onmousedown = (e) => e.stopPropagation();
  wrap.onclick = (e) => { e.stopPropagation(); openAiSpecModal(node, wrap); };
  return wrap;
}

function aiSpecSummary(node) {
  const current = normalizeAiSpecParams(node);
  return {
    aspect: current.aspect,
    resolution: current.resolution,
    aspectLabel: AI_SPEC_ASPECT_META[current.aspect] ? AI_SPEC_ASPECT_META[current.aspect].label : current.aspect,
    resolutionLabel: AI_SPEC_RESOLUTION_LABELS[current.resolution] || current.resolution,
  };
}

function applyAiSpecSelection(node, aspect, resolution) {
  if (!node) return;
  node.params = node.params || {};
  if (aspect) node.params.aspect = aspect;
  if (resolution) node.params.resolution = resolution;
  if (aspect && aspect !== 'custom' && node.params.customAspect) delete node.params.customAspect;
  normalizeAiSpecParams(node);
  if (node.type === 'aiImage' || node.type === 'imageEdit' || node.type === 'aiVideo') applySpecSizeToAiImageNode(node);
  if (node.el) buildNodeBody(node.el, node);
  if (node === __composerNode) showNodeComposer(node);
  scheduleAutosave();
}

let __aiSpecModalState = null;

function closeAiSpecModal() {
  const pop = document.getElementById('aiSpecPopover');
  if (!pop) return;
  pop.classList.remove('show');
  __aiSpecModalState = null;
}

function positionAiSpecPopover(pop, anchor) {
  const margin = 8;
  const pw = pop.offsetWidth || 320;
  const ph = pop.offsetHeight || 320;
  const rect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
  let left = margin;
  let top = margin;
  if (rect) {
    left = rect.left;
    top = rect.bottom + 6;
    if (left + pw > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - pw - margin);
    if (top + ph > window.innerHeight - margin) top = Math.max(margin, rect.top - ph - 6);
  }
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function renderAiSpecModal() {
  const st = __aiSpecModalState;
  const pop = document.getElementById('aiSpecPopover');
  if (!st || !pop || !pop.classList.contains('show')) return;
  const bodyEl = pop.querySelector('.ai-spec-modal-body');
  if (!bodyEl) return;

  const summary = aiSpecSummary(st.node);
  bodyEl.innerHTML = '';

  const aspectSection = document.createElement('div');
  aspectSection.className = 'ai-spec-modal-section';
  const aspectTitle = document.createElement('div');
  aspectTitle.className = 'ai-spec-modal-section-title';
  aspectTitle.textContent = '比例';
  const aspectGrid = document.createElement('div');
  aspectGrid.className = 'ai-spec-grid';
  AI_SPEC_ASPECTS.filter(aspect => aspect !== 'custom').forEach((aspect) => {
    const meta = AI_SPEC_ASPECT_META[aspect];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-aspect-card' + (summary.aspect === aspect ? ' active' : '');
    btn.innerHTML = '<span class="ai-aspect-figure" data-aspect="' + aspect + '"></span><span class="ai-aspect-text">' + meta.label + '</span>';
    btn.title = meta.label + ' · ' + (aspect === '1:1' ? '方形' : aspect.indexOf(':') > -1 ? aspect : '比例');
    btn.onmousedown = (e) => e.stopPropagation();
    btn.onclick = (e) => {
      e.stopPropagation();
      applyAiSpecSelection(st.node, aspect, st.node.params && st.node.params.resolution);
      renderAiSpecModal();
    };
    aspectGrid.appendChild(btn);
  });
  const customRow = document.createElement('div');
  customRow.className = 'ai-spec-custom-row' + (summary.aspect === 'custom' ? ' active' : '');
  const customRaw = String((st.node.params && st.node.params.customAspect) || '1:1').split(':');
  const customW = document.createElement('input');
  customW.type = 'number';
  customW.min = '1';
  customW.max = '4096';
  customW.className = 'ai-spec-custom-input';
  customW.value = String(Math.max(1, parseInt(customRaw[0], 10) || 1));
  const customH = customW.cloneNode(false);
  customH.value = String(Math.max(1, parseInt(customRaw[1], 10) || 1));
  const customSep = document.createElement('span');
  customSep.className = 'ai-spec-custom-sep';
  customSep.textContent = ':';
  const customLabel = document.createElement('span');
  customLabel.className = 'ai-spec-custom-label';
  customLabel.textContent = '自定义';
  const commitCustom = () => {
    const w = Math.max(1, parseInt(customW.value, 10) || 1);
    const h = Math.max(1, parseInt(customH.value, 10) || 1);
    st.node.params = st.node.params || {};
    st.node.params.customAspect = w + ':' + h;
    applyAiSpecSelection(st.node, 'custom', st.node.params && st.node.params.resolution);
    customRow.classList.add('active');
  };
  customW.onchange = commitCustom;
  customH.onchange = commitCustom;
  customW.onkeydown = customH.onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  customRow.appendChild(customLabel);
  customRow.appendChild(customW);
  customRow.appendChild(customSep);
  customRow.appendChild(customH);
  aspectSection.appendChild(aspectTitle);
  aspectSection.appendChild(aspectGrid);
  aspectSection.appendChild(customRow);

  const resolutionSection = document.createElement('div');
  resolutionSection.className = 'ai-spec-modal-section';
  const resolutionTitle = document.createElement('div');
  resolutionTitle.className = 'ai-spec-modal-section-title';
  resolutionTitle.textContent = '分辨率';
  const resolutionGrid = document.createElement('div');
  resolutionGrid.className = 'ai-spec-resolution-grid';
  AI_SPEC_RESOLUTIONS.forEach((resolution) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-spec-resolution-btn' + (summary.resolution === resolution ? ' active' : '');
    btn.textContent = AI_SPEC_RESOLUTION_LABELS[resolution] || resolution;
    btn.title = resolution;
    btn.onmousedown = (e) => e.stopPropagation();
    btn.onclick = (e) => {
      e.stopPropagation();
      applyAiSpecSelection(st.node, st.node.params && st.node.params.aspect, resolution);
      renderAiSpecModal();
    };
    resolutionGrid.appendChild(btn);
  });
  resolutionSection.appendChild(resolutionTitle);
  resolutionSection.appendChild(resolutionGrid);

  bodyEl.appendChild(aspectSection);
  bodyEl.appendChild(resolutionSection);
}

function openAiSpecModal(node, anchor) {
  if (!node) return;
  node.params = node.params || {};
  normalizeAiSpecParams(node);
  let pop = document.getElementById('aiSpecPopover');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'aiSpecPopover';
    pop.className = 'ai-spec-popover';
    pop.innerHTML = '<div class="ai-spec-modal-body"></div>';
    document.body.appendChild(pop);
    pop.addEventListener('mousedown', (e) => e.stopPropagation());
    document.addEventListener('mousedown', (e) => {
      const el = document.getElementById('aiSpecPopover');
      if (!el || !el.classList.contains('show')) return;
      if (el.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.ai-spec-trigger')) return;
      closeAiSpecModal();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const el = document.getElementById('aiSpecPopover');
      if (el && el.classList.contains('show')) closeAiSpecModal();
    });
    window.addEventListener('wheel', (e) => {
      const el = document.getElementById('aiSpecPopover');
      if (!el || !el.classList.contains('show')) return;
      if (el.contains(e.target)) return;
      closeAiSpecModal();
    }, { passive: true });
  }
  __aiSpecModalState = { node };
  pop.classList.add('show');
  renderAiSpecModal();
  positionAiSpecPopover(pop, anchor || null);
}

function pickOpenAISize(aspect, resolution, customAspect) {
  const ar = aspect || '1:1';
  const customRatio = resolveAiSpecRatio(ar, customAspect);
  if (resolution === '超清2K' || resolution === '原画4K') {
    const m = {
      '1:1': resolution === '原画4K' ? '4096x4096' : '2048x2048',
      '1:4': resolution === '原画4K' ? '1024x4096' : '512x2048',
      '4:5': resolution === '原画4K' ? '4096x5120' : '2048x2560',
      '16:9': resolution === '原画4K' ? '4096x2304' : '2048x1152',
      '9:16': resolution === '原画4K' ? '2304x4096' : '1152x2048',
      '3:2': resolution === '原画4K' ? '3840x2560' : '1920x1280',
      '3:4': resolution === '原画4K' ? '3072x4096' : '1024x1536',
      '4:3': resolution === '原画4K' ? '4096x3072' : '2048x1536',
      '21:9': resolution === '原画4K' ? '4096x1754' : '1920x822'
    };
    if (ar === 'custom' && customRatio) {
      const longSide = resolution === '原画4K' ? 4096 : 2048;
      const shortSide = Math.max(256, Math.round(longSide / customRatio));
      const safeShortSide = Math.max(256, Math.round(shortSide / 8) * 8);
      return customRatio >= 1 ? longSide + 'x' + safeShortSide : safeShortSide + 'x' + longSide;
    }
    return m[ar] || '2048x2048';
  }
  const m = {
    '1:1': '1024x1024', '1:4': '512x2048', '4:5': '1024x1280', '16:9': '1536x1024', '9:16': '1024x1536',
    '3:2': '1536x1024', '3:4': '1024x1536', '4:3': '1536x1024', '21:9': '1536x1024'
  };
  if (ar === 'custom' && customRatio) {
    return customRatio >= 1 ? '1536x1024' : '1024x1536';
  }
  return m[ar] || '1024x1024';
}

// 解析「16:9」这类比例为数值
function parseAspectRatio(s) {
  const m = /^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/.exec(String(s || ''));
  return m ? Number(m[1]) / Number(m[2]) : null;
}
// 按目标比例居中裁剪 dataURL（上游忽略尺寸参数时的兜底；比例已一致或非 dataURL 时原样返回）
function cropDataUrlToAspect(src, targetRatio) {
  return new Promise(function(resolve) {
    if (typeof src !== 'string' || !src.startsWith('data:') || !targetRatio) { resolve(src); return; }
    const img = new Image();
    img.onload = function() {
      const cur = img.width / img.height;
      if (Math.abs(cur - targetRatio) < 0.02) { resolve(src); return; }
      let sw, sh, sx, sy;
      if (cur > targetRatio) { sh = img.height; sw = img.height * targetRatio; sx = (img.width - sw) / 2; sy = 0; }
      else { sw = img.width; sh = img.width / targetRatio; sx = 0; sy = (img.height - sh) / 2; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sw); canvas.height = Math.round(sh);
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL('image/jpeg', 0.92)); } catch (e) { resolve(src); }
    };
    img.onerror = function() { resolve(src); };
    img.src = src;
  });
}

// 把多张生成图拼成网格（一张图作为节点输出），张数=1 时直接返回原图
function composeImageGrid(images, aspect) {
  if (!images || images.length <= 1) return Promise.resolve(images && images[0]);
  return Promise.all(images.map(loadImgToCanvas)).then(function(imgs) {
    var n = imgs.length;
    var cols = n <= 2 ? n : (n <= 4 ? 2 : 3);
    var rows = Math.ceil(n / cols);
    var tileW = 512;
    var ratio = ({
      '16:9': 16/9, '21:9': 21/9, '9:16': 9/16, '3:4': 3/4,
      '3:2': 3/2, '4:3': 4/3, '1:1': 1
    })[aspect] || 1;
    var tileH = Math.round(tileW / ratio);
    var canvas = document.createElement('canvas');
    canvas.width = tileW * cols;
    canvas.height = tileH * rows;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    imgs.forEach(function(img, i) {
      var r = Math.floor(i / cols);
      var c = i % cols;
      // object-fit: cover
      var ir = img.width / img.height;
      var tr = tileW / tileH;
      var sx, sy, sw, sh;
      if (ir > tr) {
        sh = img.height;
        sw = img.height * tr;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = img.width / tr;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, c * tileW, r * tileH, tileW, tileH);
    });
    return canvas.toDataURL('image/jpeg', 0.9);
  });
}

function loadImgToCanvas(src) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// 单张生成（恒 n=1，规避 gpt-image-1 系列接口的 n 限制）
function openAIImageSingle(base, key, model, prompt, size) {
  return openaiPostJSON(base, '/images/generations', key, { model: model, prompt: prompt, n: 1, size: size || '1024x1024' })
    .then(function(data) {
      const item = data && data.data && data.data[0];
      if (!item) throw new Error('返回数据为空');
      const img = normalizeImageSrc(item.b64_json ? 'data:image/png;base64,' + item.b64_json : (item.url || null));
      if (!img) throw new Error(describeImagePayloadIssue(item));
      return img;
    });
}

// 依次尝试候选模型名：每个只走 /images/generations，失败就换下一个模型名
// 阶段 9：支持 models 覆盖（路由选中的图片模型优先尝试）
function openAIImageWithFallback(base, key, prompt, count, size, models) {
  var lastErr = null;
  var attempts = [];
  var _cands = (models && models.length) ? models.slice() : OPENAI_IMAGE_MODELS.slice();
  function attempt(models) {
    if (!models.length) {
      var e = new Error((lastErr && lastErr.message) || '所有模型名均不可用');
      e.tried = attempts.length ? attempts.join(' / ') : OPENAI_IMAGE_MODELS.join(' / ');
      throw e;
    }
    var m = models[0];
    var rest = models.slice(1);
    return openAIImageSingle(base, key, m, prompt, size)
      .then(function(img) {
        attempts.push(m);
        if (count > 1) {
          var extra = [];
          for (var i = 1; i < count; i++) extra.push(openAIImageSingle(base, key, m, prompt, size));
          return Promise.all(extra).then(function(list) { return [img].concat(list); })
            .catch(function() { return [img]; });
        }
        return [img];
      })
      .catch(function(err) {
        lastErr = err;
        attempts.push(m);
        return attempt(rest);
      });
  }
  return attempt(_cands);
}

function isCorsLikeError(err) {
  var msg = String((err && err.message) || err || '');
  return /Failed to fetch|NetworkError|Load failed|TypeError: Failed|CORS|cross-origin|blocked by.*policy/i.test(msg);
}

function generateImageViaProxyFallback(node, prompt, count, size, reason) {
  var proxy = _fcProxy();
  if (!proxy) return Promise.reject(new Error('代理未配置'));
  var route = _routeModel('image');
  var model = (route && route.model) || 'gpt-image-2';
  var provider = (route && route.provider) || 'openai';
  var t0 = Date.now();
  if (reason) showToast('直连被拦截，已切换代理生成：' + reason, 'warn');
  return proxy.call({
    provider: provider,
    endpoint: '/images/generations',
    token: window.FlowCraft.__userToken || undefined,
    body: { model: model, prompt: prompt, n: count, size: size }
  }).then(function(json) {
    var imgs = [];
    if (Array.isArray(json && json.data)) {
      imgs = json.data.map(function(d) { return normalizeImageSrc(d && d.b64_json ? 'data:image/png;base64,' + d.b64_json : (d && d.url ? d.url : '')) || ''; });
    } else if (Array.isArray(json && json.output)) {
      imgs = json.output.map(function(o) { return normalizeImageSrc(o && o.image && o.image.b64_json ? 'data:image/png;base64,' + o.image.b64_json : (o && o.image && o.image.url ? o.image.url : '')) || ''; });
    }
    imgs = imgs.filter(Boolean);
    if (!imgs.length) throw new ProxyError('代理未返回图片数据', { kind: 'system', retryable: false, code: 'empty_image' });
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: provider + '/' + model, ok: true, ms: Date.now() - t0 });
    return imgs;
  });
}

// 把 OpenAI 接口错误翻译成可操作的提示（区分网络/CORS 与 API 错误）
function describeOpenAIError(err) {
  var msg = (err && err.message || err || '').toString();
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) {
    var isFile = location.protocol === 'file:';
    return '浏览器拦截了网络请求（' + msg + '）。' +
      (isFile
        ? '你正在用 file:// 协议打开页面，浏览器会拦截跨域 fetch。' +
          '请改用右侧 WorkBuddy 预览面板（HTTP 地址）打开本页，或搭建本地代理。'
        : '可能是网络/防火墙问题，或当前 API 地址不支持浏览器跨域（CORS）。' +
          '请检查网络，或⚙ 中换一个支持 CORS 的 API 中转地址。');
  }
  return msg;
}

// 统一错误中文化：把网络/CORS/超时/fetch 失败、HTTP 状态码、OpenAI/ComfyUI 英文错误
// 翻译为面向用户的中文提示。已为中文的错误原样返回。
function localizeError(err) {
  if (!err) return '未知错误';
  const raw = (err && err.message) ? err.message : String(err);
  const s = (raw == null ? '' : raw).toString();
  // 已含中文 → 直接返回
  if (/[一-龥]/.test(s)) return s;
  const lc = s.toLowerCase();

  // 网络层
  if (/failed to fetch|networkerror|load failed|typeerror: failed|net::err/i.test(lc))
    return '网络请求失败（可能是 CORS 跨域拦截，或本地服务未启动）。请确认接口地址可访问，或改用支持 CORS 的 API 中转。';
  if (/(timeout|timed out|aborted|deadline|operation timed)/i.test(lc))
    return '请求超时，请稍后重试，或检查网络/服务是否响应缓慢。';

  // HTTP 状态码
  const sm = s.match(/HTTP\s*(\d{3})/i) || lc.match(/status[=: ]*(\d{3})/);
  if (sm) {
    const code = sm[1];
    const map = {
      '400': '请求参数有误（HTTP 400），请检查提示词或参数。',
      '401': '鉴权失败（HTTP 401），API Key 无效或已过期。',
      '403': '无权限访问（HTTP 403），请确认 Key 或账户额度。',
      '404': '接口不存在（HTTP 404），请检查 API 地址是否正确。',
      '405': '请求方法不被允许（HTTP 405），该地址可能不支持此接口。',
      '408': '请求超时（HTTP 408），请稍后重试。',
      '429': '请求过于频繁（HTTP 429），请稍后重试或降低并发。',
      '500': '服务内部错误（HTTP 500），请稍后重试。',
      '502': '网关错误（HTTP 502），上游服务可能离线。',
      '503': '服务暂不可用（HTTP 503），请稍后重试。'
    };
    if (map[code]) {
      const detail = s.replace(/HTTP\s*\d{3}\s*[：:]\s*/, '').replace(/status[=: ]*\d{3}\s*[：:]\s*/i, '').slice(0, 160);
      return map[code] + (detail ? '（' + detail + '）' : '');
    }
  }

  // OpenAI / 通用英文语义
  if (/incorrect api key|invalid api key|authentication failed|unauthorized/i.test(lc))
    return 'API Key 无效或未配置，请在设置中填写正确的 Key。';
  if (/insufficient|quota|exceed.*limit|rate limit|too many requests/i.test(lc))
    return '额度不足或触发限流，请检查账户余额或稍后重试。';
  if (/model.*not found|does not exist|unknown model|invalid model/i.test(lc))
    return '模型不存在或不支持，请更换模型名称。';
  if (/cors|cross-origin|cross origin|origin not allowed|not allowed by access-control|blocked by.*(cors|policy)/i.test(lc))
    return '跨域（CORS）被拒绝，请使用支持跨域的 API 中转地址。';
  if (/content.*policy|moderat|unsafe|safety system|prompt.*reject|violat/i.test(lc))
    return '内容被安全策略拦截，请调整提示词后重试。';
  if (/node_errors|execution (error|failed|interrupted)|node type|missing/i.test(lc))
    return 'ComfyUI 执行错误：' + s.slice(0, 160);

  // 兜底：交给既有 describeOpenAIError（含 file:// 提示）
  try { return describeOpenAIError(err) || s; } catch (_) { return s; }
}

// —— 带参考图的生成（引用令牌命中时走 /images/edits，多图 multipart）——

// 组装 multipart 表单；useArrayField=true 时字段名为 image[]（OpenAI 多参考图规范）
function buildRefFormData(model, prompt, imageDataUrls, size, useArrayField) {
  const fd = new FormData();
  const field = useArrayField ? 'image[]' : 'image';
  let n = 0;
  (imageDataUrls || []).forEach(function(d, i) {
    if (!useArrayField && n >= 1) return; // 单图模式只带第一张
    const blob = dataURLtoBlob(d);
    if (!blob) return;
    fd.append(field, blob, 'ref' + (i + 1) + '.png');
    n++;
  });
  fd.append('prompt', prompt);
  fd.append('size', size || '1024x1024');
  fd.append('n', '1');
  fd.append('model', model);
  return { fd: fd, count: n };
}

function openAIImageEditMulti(base, key, model, prompt, imageDataUrls, size, useArrayField) {
  const built = buildRefFormData(model, prompt, imageDataUrls, size, useArrayField);
  if (!built.count) return Promise.reject(new Error('参考图为空或格式不支持（需 data: 图片）'));
  return fetch(base + '/images/edits', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key }, // FormData 不能手动设 Content-Type
    body: built.fd
  }).then(function(resp) {
    if (!resp.ok) {
      return resp.text().then(function(t) {
        const e = new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 200) : ''));
        e.status = resp.status; e.bodyText = t || '';
        throw e;
      });
    }
    return resp.json();
  }).then(function(data) {
    const it = (data && data.data && data.data[0]) || null;
    if (!it) throw new Error('参考图生成接口返回为空');
    const img = normalizeImageSrc(it.b64_json ? 'data:image/png;base64,' + it.b64_json : (it.url || null));
    if (!img) return createImageErrorPlaceholder(describeImagePayloadIssue(it));
    return img;
  });
}

// 依次尝试：候选模型 × (多图 image[] → 单图 image)，全失败则抛出
function generateImageWithRefs(base, key, prompt, images, count, size) {
  const models = ['gpt-image-1', 'gpt-image-2'];
  const multi = (images || []).length > 1;
  let lastErr = null;
  function once(model, useArray) {
    return openAIImageEditMulti(base, key, model, prompt, images, size, useArray);
  }
  function attempt(ms) {
    if (!ms.length) {
      const e = new Error((lastErr && lastErr.message) || '参考图接口不可用');
      e.tried = models.join(' / ');
      throw e;
    }
    const m = ms[0];
    const first = multi ? once(m, true).catch(function(err) {
      lastErr = err;
      return once(m, false); // 服务端不认 image[] 时退回单张参考图
    }) : once(m, false);
    return first
      .then(function(img) {
        if (count > 1) {
          const extra = [];
          for (let i = 1; i < count; i++) {
            extra.push(multi ? once(m, true).catch(function() { return once(m, false); }) : once(m, false));
          }
          return Promise.all(extra).then(function(list) { return [img].concat(list); })
            .catch(function() { return [img]; });
        }
        return [img];
      })
      .catch(function(err) {
        lastErr = err;
        return attempt(ms.slice(1));
      });
  }
  return attempt(models.slice());
}

// 阶段 5：经 API 安全代理生成图片（浏览器不持有生产 Key）。
// 代理返回上游原始 JSON：{data:[{b64_json}]} 或 {output:[{image:{url}}]}。
// 失败时抛出 ProxyError，由 executeNodeAsync 的 catch 交由执行引擎分类（transient 可重试）。
async function generateImageViaProxy(node) {
  const proxy = _fcProxy();
  const rawPrompt = (node.effectivePrompt || node.prompt || '').trim();
  if (!rawPrompt) {
    throw new ProxyError('请先输入提示词（或在节点内输入）', { kind: 'param', retryable: false, code: 'empty_prompt' });
  }
  // 负向提示词合并发送：gpt-image 系列无 negative_prompt 参数，以「避免以下问题」追加到提示词末尾
  const neg = ((node.params && node.params.negativePrompt) || '').trim();
  const prompt = neg ? rawPrompt + '\n避免以下问题：' + neg : rawPrompt;

  const countMap = { '1张': 1, '2张': 2, '4张': 4, '6张': 6, '8张': 8 };
  const count = countMap[node.params.count] || 1;
  const size = pickOpenAISize(node.params.aspect, node.params.resolution, node.params.customAspect);
  applySpecSizeToAiImageNode(node); // 生成前确保框型与规格一致
  node.status = 'running';
  updateNodeStatus(node);

  // 参考图：<<<资产令牌>>> + 面板直传 + 多源连入（与直连路径口径一致，最多 4 张）
  let refImages = [];
  try {
    const ref = resolveRefTokens(rawPrompt);
    const inlineRefs = collectInlineRefs(node);
    if (inlineRefs.length) ref.images = ref.images.concat(inlineRefs.map(function(r) { return r.src; }));
    if (node._multiInputs && node._multiInputs[0] && node._multiInputs[0].length > 1) {
      const extraImgs = node._multiInputs[0]
        .filter(function(p) { return p && p.type === 'image' && typeof p.value === 'string' && p.value.startsWith('data:'); })
        .map(function(p) { return p.value; });
      ref.images = ref.images.concat(extraImgs);
    }
    refImages = (ref.images || []).filter(Boolean).slice(0, 4);
    node._refInfo = { hit: (ref.refs || []).length, missing: ref.missing || [], names: (ref.refs || []).map(function(r) { return r.name; }) };
    if (ref.missing && ref.missing.length) {
      showToast('有 ' + ref.missing.length + ' 个引用未在素材库找到：' + ref.missing.join('、'), 'warn');
    }
  } catch (e) { /* 参考图收集失败不阻断文生图 */ }

  // 阶段 9：路由选中的图片模型（默认 gpt-image-2，行为等价）
  const _rImg = _routeModel('image');
  const _imgModel = (_rImg && _rImg.model) || 'gpt-image-2';
  const _imgProvider = (_rImg && _rImg.provider) || 'openai';
  const _imgModelId = _imgProvider + '/' + _imgModel;
  const _t0 = Date.now();
  const _token = (window.FlowCraft && window.FlowCraft.__userToken) || undefined;

  // 中转对 n>1 支持不稳（上游 400 unknown_parameter）：恒按 n=1 生成，多张并行（与直连路径口径一致）
  let editsUnsupported = false;
  // 失败不自动重试：直接报错，由用户决定是否手动重试
  async function once() {
    if (refImages.length && !editsUnsupported) {
      try {
        return await proxy.call({
          provider: _imgProvider, endpoint: '/images/edits', token: _token,
          body: { model: _imgModel, prompt: prompt, n: 1, size: size, imageDataUrls: refImages }
        });
      } catch (errEdits) {
        editsUnsupported = true;
        showToast('参考图生成失败（' + ((errEdits && errEdits.message) || errEdits) + '），已改为纯文生图', 'warn', 4000);
      }
    }
    return proxy.call({
      provider: _imgProvider, endpoint: '/images/generations', token: _token,
      body: { model: _imgModel, prompt: prompt, n: 1, size: size }
    });
  }
  function collect(json) {
    const arr = [];
    if (Array.isArray(json && json.data)) {
      json.data.forEach(d => arr.push('data:image/png;base64,' + (d && d.b64_json ? d.b64_json : '')));
    } else if (Array.isArray(json && json.output)) {
      json.output.filter(o => o && o.image && o.image.url).forEach(o => arr.push(o.image.url));
    }
    return arr.filter(Boolean);
  }

  const first = await once();
  let imgs = collect(first);
  if (count > 1 && imgs.length) {
    const extra = await Promise.all(Array.from({ length: count - 1 }, () => once().catch(() => null)));
    extra.forEach(j => { if (j) imgs = imgs.concat(collect(j)); });
  }
  imgs = imgs.filter(Boolean).slice(0, count);
  // 兜底：该中转实测忽略尺寸参数（恒返回方形）→ 按所选比例居中裁剪
  const _arTarget = resolveAiSpecRatio(node.params.aspect, node.params.customAspect);
  if (_arTarget && imgs.length) {
    let _cropped = false;
    imgs = await Promise.all(imgs.map(async function(src) {
      const out = await cropDataUrlToAspect(src, _arTarget);
      if (out !== src) _cropped = true;
      return out;
    }));
    if (_cropped) showToast('该中转不支持尺寸参数，已按所选比例（' + node.params.aspect + '）居中裁剪', 'warn', 4000);
  }
  if (!imgs.length) {
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _imgModelId, ok: false, ms: Date.now() - _t0 });
    throw new ProxyError('代理未返回图片数据', { kind: 'system', retryable: false, code: 'empty_image' });
  }

  if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _imgModelId, ok: true, ms: Date.now() - _t0 });
  node._galleryImages = imgs.slice();
  node._fitProbed = false;
  node._imageCount = imgs.length;
  if (imgs[0]) node.thumb = imgs[0];
  return imgs[0];
}

// 阶段 5：经 API 安全代理异步生成视频（图生视频 / 文生视频）。
// 代理采用异步任务架构（9.2）：提交 → 立即返回 taskId → 轮询 GET /proxy/task/<id> 直至 success。
// 浏览器不持有视频 API Key（可灵/Runway 等密钥在代理服务端 env）。
// 失败抛出 ProxyError，交由执行引擎分类（transient/system/timeout 可重试）。
async function runVideoNodeViaProxy(node) {
  const proxy = _fcProxy();
  const prompt = (node.effectivePrompt || node.prompt || '').trim() || '生成一段视频';
  const imgIn = (node.inputsData || []).find(d => d && d.type === 'image' && normalizeImageSrc(d.value));
  const videoRefs = collectAiVideoRefs(node);
  const model = String((node.params && node.params.model) || '可灵 2.0').trim();
  const provider = /runway/i.test(model) ? 'runway' : 'kling';
  const videoLabel = provider + ' / ' + model;
  const body = {
    model: model,
    prompt: prompt,
    image: imgIn ? imgIn.value : null,
    aspect: (node.params && node.params.aspect) || '9:16',
    duration: (node.params && node.params.duration) || '5秒',
    refVideos: videoRefs.map(function(r) { return { name: r.name, src: r.src }; })
  };

  const submit = await proxy.call({
    provider: provider,
    endpoint: '/videos',
    token: (window.FlowCraft && window.FlowCraft.__userToken) || undefined,
    body: body
  });
  if (!submit || !submit.taskId) {
    const submitKeys = submit && typeof submit === 'object' ? Object.keys(submit).slice(0, 6).join(', ') : '';
    throw new ProxyError('视频任务提交失败：代理未返回 taskId（' + videoLabel + '）' + (submitKeys ? '，返回字段：' + submitKeys : ''), { kind: 'system', retryable: true, code: 'video_submit' });
  }

  const taskId = submit.taskId;
  const deadline = Date.now() + 120000; // 与 nodeTimeout 对齐
  let task = submit;
  while (Date.now() < deadline) {
    if (node._abort) {
      throw new ProxyError('视频生成已被取消', { kind: 'param', retryable: false, code: 'video_aborted' });
    }
    task = await proxy.getTask(taskId);
    if (task && task.status === 'success') break;
    if (task && task.status === 'failed') {
      const reason = (task.error || task.message || (task.result && (task.result.error || task.result.message)) || '未知原因');
      throw new ProxyError('视频生成失败：' + reason + '（' + videoLabel + '）', { kind: 'system', retryable: true, code: 'video_failed' });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!task || task.status !== 'success') {
    const lastStatus = task && task.status ? task.status : 'unknown';
    throw new ProxyError('视频生成超时：' + videoLabel + ' 在 120 秒内仍处于 ' + lastStatus + ' 状态', { kind: 'timeout', retryable: true, code: 'video_timeout' });
  }
  const videoUrl = (task.result && (task.result.video_url || task.result.url)) || '';
  return { thumb: videoUrl, outputsData: [{ type: 'video', value: videoUrl }], refVideos: videoRefs };
}

function generateOpenAIImage(node) {
  // 阶段 5：代理启用时，浏览器不持有本地 Key，经 FlowCraft.proxy 生成（生产 Key 在代理侧）
  if (_fcProxy()) return generateImageViaProxy(node);

  const key = localStorage.getItem(OPENAI_KEY_STORAGE);
  if (!key) {
    node.status = 'error';
    showToast('未配置 OpenAI API Key：请打开 AI 助手面板 → 模型选「GPT Image 2」→ 点 ⚙ 填入 API Key', 'warn');
    return Promise.resolve(null);
  }
  const _rawPrompt0 = (node.effectivePrompt || node.prompt || '').trim();
  if (!_rawPrompt0) {
    node.status = 'error';
    showToast('请先输入提示词（或在节点内输入）', 'warn');
    return Promise.resolve(null);
  }
  // 负向提示词合并发送（代理/直连口径一致）
  const _neg0 = ((node.params && node.params.negativePrompt) || '').trim();
  const prompt = _neg0 ? _rawPrompt0 + '\n避免以下问题：' + _neg0 : _rawPrompt0;
  const base = normalizeApiBase(localStorage.getItem(OPENAI_BASE_STORAGE));
  const countMap = { '1张': 1, '2张': 2, '4张': 4, '6张': 6, '8张': 8 };
  const count = countMap[node.params.count] || 1;
  const size = pickOpenAISize(node.params.aspect, node.params.resolution, node.params.customAspect);

  node.status = 'running';
  updateNodeStatus(node);

  // 解析 <<<名称>>> 引用令牌 → 命中的资产图作为参考图随请求发送
  const ref = resolveRefTokens(prompt);
  // 合并「面板内直传参考图」（文本节点本体或上游文本节点的 node.refImages）
  const inlineRefs = collectInlineRefs(node);
  if (inlineRefs.length) {
    inlineRefs.forEach(function(r) { ref.refs.push({ token: r.name, name: r.name, src: r.src }); });
    ref.images = ref.images.concat(inlineRefs.map(function(r) { return r.src; }));
  }
  // 合并「多源连入 image 端口」的额外参考图（批量连线：多张图连到同一 image 端口）
  try {
    if (node._multiInputs && node._multiInputs[0] && node._multiInputs[0].length > 1) {
      const extraImgs = node._multiInputs[0]
        .filter(function(p) { return p && p.type === 'image' && typeof p.value === 'string' && p.value.startsWith('data:'); })
        .map(function(p) { return p.value; });
      if (extraImgs.length) {
        ref.images = ref.images.concat(extraImgs);
        showToast(`已将 ${extraImgs.length} 张多源参考图合并发送`, 'info');
      }
    }
  } catch (e) { /* 容错：多源参考图读取失败不影响主流程 */ }
  const shouldSpawnPreview = true;
  ref.augmented = buildRefAugmentedPrompt(ref);
  node._refInfo = { hit: ref.refs.length, missing: ref.missing.length, names: ref.refs.map(function(r) { return r.name; }) };
  if (ref.missing.length) {
    showToast('有 ' + ref.missing.length + ' 个引用未在素材库找到：' + ref.missing.join('、') +
      '（在素材库给对应素材填名称并点「设为资产」）', 'warn');
  }

  function finish(imgs) {
    node._galleryImages = imgs.slice();
    node._fitProbed = false;
    node._imageCount = imgs.length;
    if (imgs[0]) node.thumb = imgs[0];
    return imgs[0];
  }
  function plain() {
    return openAIImageWithFallback(base, key, prompt, count, size).then(finish);
  }

  function plainWithProxyFallback() {
    return openAIImageWithFallback(base, key, prompt, count, size).then(finish).catch(function(err) {
      if (isCorsLikeError(err)) {
        return generateImageViaProxyFallback(node, prompt, count, size, describeOpenAIError(err)).then(finish);
      }
      throw err;
    });
  }

  let task;
  if (ref.refs.length) {
    showToast('已引用 ' + ref.refs.length + ' 个资产（' + ref.refs.map(function(r) { return r.name; }).join('、') +
      '），参考图将随请求一起发送', 'info');
    task = generateImageWithRefs(base, key, ref.augmented, ref.images, count, size)
      .then(finish)
      .catch(function(err) {
        showToast('带参考图生成失败，已回退为纯文本生成：' + describeOpenAIError(err), 'warn');
        return plainWithProxyFallback();
      });
  } else {
    task = plainWithProxyFallback();
  }

  return task.catch(err => {
      node.status = 'error';
      const _loc = localizeError(err);
      try {
        logRun(node, false, 0, _loc);
        logRegen({
          id: 'regen_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          kind: 'failed', type: node.type,
          title: node.title || (NODE_TYPES[node.type] || {}).label || node.type,
          model: (node.params && node.params.model) || '',
          desc: describeNodeParams(node),
          error: _loc, nodeId: node.id
        });
      } catch (e2) {}
      if (node.el) buildNodeBody(node.el, node);
      updateNodeStatus(node);
      showToast('gpt-image-2 生成失败：' + describeOpenAIError(err) +
        '（已尝试模型：' + (err.tried || OPENAI_IMAGE_MODELS.join(' / ')) + '）。' +
        '请检查：① API Key 是否正确 ② ⚙ 中自定义 API 地址 ③ 当前服务是否支持这些模型名 / 当前尺寸', 'danger');
      return null;
    });
}

//================ 图生图（img2img）：智能超清 / 线稿 接真实图片变换 ================
// 基于上游真实图片，调用 OpenAI images/edits 接口生成新图（超清放大 / 线稿提取）。
// 接口不支持或缺少配置时，调用方回退为原图透传，保证不崩。

function dataURLtoBlob(dataURL) {
  const parts = String(dataURL).split(',');
  if (parts.length < 2 || !/^data:/i.test(parts[0] || '')) return null;
  const mime = (/data:(.*?);base64/i.exec(parts[0]) || [])[1] || 'image/png';
  const bin = atob(parts[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// 单次 edits 调用（multipart/form-data）
function openAIImageEditSingle(base, key, model, prompt, imageDataUrl, size) {
  const blob = dataURLtoBlob(imageDataUrl);
  if (!blob) return Promise.reject(new Error('输入图片格式不支持（需 data: 图片）'));
  const fd = new FormData();
  fd.append('image', blob, 'input.png');
  fd.append('prompt', prompt);
  fd.append('size', size || '1024x1024');
  fd.append('n', '1');
  fd.append('model', model);
  return fetch(base + '/images/edits', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key }, // 注意：FormData 不能手动设 Content-Type，由浏览器补 boundary
    body: fd
  }).then(function(resp) {
    if (!resp.ok) {
      return resp.text().then(function(t) {
        const e = new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 200) : ''));
        e.status = resp.status; e.bodyText = t || '';
        throw e;
      });
    }
    return resp.json();
  }).then(function(data) {
    const it = (data && data.data && data.data[0]) || null;
    if (!it) throw new Error('编辑接口返回为空');
    const img = normalizeImageSrc(it.b64_json ? 'data:image/png;base64,' + it.b64_json : (it.url || null));
    if (!img) return createImageErrorPlaceholder(describeImagePayloadIssue(it));
    return img;
  });
}

// 根据节点类型构造图生图提示词
function buildImg2ImgPrompt(node) {
  const extra = (node.effectivePrompt || node.prompt || '').trim();
  const base = extra ? extra + '. ' : '';
  if (node.type === 'upscale') {
    return base + 'Upscale this image to higher resolution (2x), enhance sharpness and fine details, ' +
      'preserve the original composition, subjects, colors and artistic style. Clean, photorealistic, no distortion.';
  }
  if (node.type === 'imageEdit') {
    return base + '请根据修正说明对提供的图片进行修正。尽量保留原始构图、主体身份、色彩和整体结构，除非说明中明确要求更改。' +
      '输出干净、自然、高质量的修正结果，不要额外添加无关元素，也不要造成明显畸变。';
  }
  // lineart：提取为干净黑白线稿
  return base + 'Convert this image into clean black-and-white line art / sketch on a white background. ' +
    'Use smooth, continuous outlines in an anime illustration line-drawing style. ' +
    'Remove all colors and shading. Keep all structural and detail lines.';
}

// 本地线稿（离线真实可用）：灰度 + Sobel 边缘检测 → 黑线白底线稿，无 AI Key/代理时的兜底真实路径
function localLineartImage(dataUrl) {
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      try {
        const MAX = 1024;
        const sc = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(2, Math.round(img.naturalWidth * sc));
        const h = Math.max(2, Math.round(img.naturalHeight * sc));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, w, h);
        const srcData = cx.getImageData(0, 0, w, h);
        const g = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          g[i] = 0.299 * srcData.data[i * 4] + 0.587 * srcData.data[i * 4 + 1] + 0.114 * srcData.data[i * 4 + 2];
        }
        const out = cx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            let mag = 0;
            if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
              const tl = g[i - w - 1], t = g[i - w], tr = g[i - w + 1];
              const l = g[i - 1], r = g[i + 1];
              const bl = g[i + w - 1], b = g[i + w], br = g[i + w + 1];
              const gx = (-tl - 2 * l - bl + tr + 2 * r + br);
              const gy = (-tl - 2 * t - tr + bl + 2 * b + br);
              mag = Math.sqrt(gx * gx + gy * gy);
            }
            const v = Math.max(0, Math.min(255, 255 - mag)); // 边缘黑、背景白
            const o = i * 4;
            out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
            out.data[o + 3] = 255;
          }
        }
        cx.putImageData(out, 0, 0);
        resolve(cv.toDataURL('image/png'));
      } catch (e) { resolve(null); }
    };
    img.onerror = function() { resolve(null); };
    img.src = dataUrl;
  });
}

// 本地算法超清（离线真实可用）：canvas 渐进 2x 放大 + 高质量平滑，无 AI Key/代理时的兜底真实路径
function localUpscaleImage(dataUrl, factor) {
  return new Promise(function(resolve) {
    try {
      const img = new Image();
      img.onload = function() {
        try {
          const f = factor || 2;
          let curW = img.naturalWidth, curH = img.naturalHeight;
          let src = img;
          // 渐进加倍（每次 ≤2x）比一次性放大保留更多细节
          while (curW * 2 <= img.naturalWidth * f) {
            const c = document.createElement('canvas');
            c.width = curW * 2; c.height = curH * 2;
            const cx = c.getContext('2d');
            cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
            cx.drawImage(src, 0, 0, c.width, c.height);
            src = c; curW = c.width; curH = c.height;
          }
          const out = document.createElement('canvas');
          out.width = Math.round(img.naturalWidth * f); out.height = Math.round(img.naturalHeight * f);
          const ox = out.getContext('2d');
          ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
          ox.drawImage(src, 0, 0, out.width, out.height);
          resolve(out.toDataURL('image/png'));
        } catch (e) { resolve(null); }
      };
      img.onerror = function() { resolve(null); };
      img.src = dataUrl;
    } catch (e) { resolve(null); }
  });
}

// 图生图主入口：依次尝试候选模型，全部失败则抛出（调用方捕获并回退）
function generateOpenAIImageEdit(node, imageDataUrl) {
  const proxy = _fcProxy();
  if (proxy) {
    const prompt = buildImg2ImgPrompt(node);
    const aspect = node.params.aspect || '1:1';
    const resolution = node.type === 'upscale' ? '超清2K' : '高清1K';
    const size = pickOpenAISize(aspect, resolution, node.params && node.params.customAspect);
    const route = _routeModel('image');
    const model = 'gpt-image-2';
    const provider = (route && route.provider) || 'openai';
    const t0 = Date.now();
    let extraRefs = [];
    try {
      extraRefs = Array.isArray(node.refImages) ? node.refImages.filter(function(r) { return r && r.src && r.src !== imageDataUrl; }).map(function(r) { return r.src; }) : [];
    } catch (e) { extraRefs = []; }
    return proxy.call({
      provider: provider,
      endpoint: '/images/edits',
      token: window.FlowCraft.__userToken || undefined,
      body: { model: model, prompt: prompt, size: size, n: 1, imageDataUrl: imageDataUrl, imageDataUrls: extraRefs.length ? [imageDataUrl].concat(extraRefs) : [imageDataUrl] }
    }).then(function(data) {
      const it = (data && data.data && data.data[0]) || null;
      const img = it && normalizeImageSrc(it.b64_json ? 'data:image/png;base64,' + it.b64_json : (it.url || null));
      if (!img) return createImageErrorPlaceholder(describeImagePayloadIssue(it));
      if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: provider + '/' + model, ok: true, ms: Date.now() - t0 });
      return img;
    });
  }
  const key = localStorage.getItem(OPENAI_KEY_STORAGE);
  if (!key) return Promise.resolve(null);
  const base = normalizeApiBase(localStorage.getItem(OPENAI_BASE_STORAGE));
  const prompt = buildImg2ImgPrompt(node);
  const aspect = node.params.aspect || '1:1';
  const resolution = node.type === 'upscale' ? '超清2K' : '高清1K';
  const size = pickOpenAISize(aspect, resolution, node.params && node.params.customAspect);
  const extraRefs = Array.isArray(node.refImages) ? node.refImages.filter(function(r) { return r && r.src && r.src !== imageDataUrl; }).map(function(r) { return r.src; }) : [];
  const models = ['gpt-image-2'];
  let lastErr = null;
  function attempt(ms) {
    if (!ms.length) {
      const e = new Error((lastErr && lastErr.message) || '图生图接口不支持当前模型');
      e.tried = models.join(' / ');
      throw e;
    }
    const m = ms[0];
    if (extraRefs.length) {
      return openAIImageEditMulti(base, key, m, prompt, [imageDataUrl].concat(extraRefs), size, true)
        .catch(function(err) {
          lastErr = err;
          if (shouldFallbackToResponses(err) || (err && err.status === 400)) {
            return openAIImageEditSingle(base, key, m, prompt, imageDataUrl, size);
          }
          throw err;
        });
    }
    return openAIImageEditSingle(base, key, m, prompt, imageDataUrl, size)
      .catch(function(err) {
        lastErr = err;
        // 接口不存在 / 模型不支持 → 尝试下一模型；鉴权/其它错误直接抛出
        if (shouldFallbackToResponses(err) || (err && err.status === 400)) {
          return attempt(ms.slice(1));
        }
        throw err;
      });
  }
  return attempt(models.slice());
}

// 收集节点上游传入的真实图片（data: 图片），没有则返回 null
function getNodeInputImage(node) {
  const inData = node.inputsData || [];
  const img = inData.find(function(d) {
    return d && d.type === 'image' && typeof d.value === 'string' && /^data:image/.test(d.value);
  });
  if (img && img.value) return img.value;
  if (node && typeof node.croppedImage === 'string' && /^data:image/.test(node.croppedImage)) return node.croppedImage;
  if (node && typeof node.uploadedImage === 'string' && /^data:image/.test(node.uploadedImage)) return node.uploadedImage;
  const refImg = node && Array.isArray(node.refImages) ? node.refImages.find(r => r && typeof r.src === 'string' && /^data:image/.test(r.src)) : null;
  if (refImg && refImg.src) return refImg.src;
  const thumb = node && typeof node.thumb === 'string' && /^data:image/.test(node.thumb) ? node.thumb : null;
  return thumb;
}

//================ 16b. 循环节点驱动逻辑 ================
// 当前循环迭代上下文（仅循环运行期间有效，循环外为 null）
let LOOP_STATE = null;

// 判断值是否为可展示的图片地址：data: 图片 / http(s) / blob:
// 这里会过滤掉空的 data URL（例如 data:image/png;base64,），避免渲染出黑块或空预览。
function normalizeImageSrc(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (/^(https?:|blob:)/i.test(s)) return s;
  if (!/^data:image\//i.test(s)) return null;
  const comma = s.indexOf(',');
  if (comma < 0) return null;
  const payload = s.slice(comma + 1).trim();
  return payload ? s : null;
}
function isDataImage(v) {
  return typeof v === 'string' && /^data:image\//i.test(v.trim()) && v.trim().indexOf(',') >= 0 && v.trim().slice(v.trim().indexOf(',') + 1).trim().length > 0;
}

// 用于提示“为什么这张图没法显示”：区分“没返回图”与“返回了空/损坏的图片字段”。
function describeImagePayloadIssue(item) {
  if (!item) return '返回数据为空';
  const issues = [];
  if (Object.prototype.hasOwnProperty.call(item, 'b64_json') && !String(item.b64_json || '').trim()) issues.push('b64_json 为空');
  if (Object.prototype.hasOwnProperty.call(item, 'url') && !normalizeImageSrc(item.url)) issues.push('url 无效');
  if (Object.prototype.hasOwnProperty.call(item, 'result') && !normalizeImageSrc(item.result)) issues.push('result 无效');
  if (Object.prototype.hasOwnProperty.call(item, 'image') && item.image) {
    if (Object.prototype.hasOwnProperty.call(item.image, 'b64_json') && !String(item.image.b64_json || '').trim()) issues.push('image.b64_json 为空');
    if (Object.prototype.hasOwnProperty.call(item.image, 'url') && !normalizeImageSrc(item.image.url)) issues.push('image.url 无效');
  }
  return issues.length ? ('返回了无效图片数据（' + issues.join('；') + '）') : '未获取到图片';
}

function createImageErrorPlaceholder(message) {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, '#111827');
  g.addColorStop(0.52, '#0E1220');
  g.addColorStop(1, '#151028');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createLinearGradient(36, 24, canvas.width - 36, canvas.height - 24);
  glow.addColorStop(0, 'rgba(118, 135, 255, 0.20)');
  glow.addColorStop(1, 'rgba(182, 104, 255, 0.18)');
  ctx.fillStyle = glow;
  ctx.fillRect(16, 16, canvas.width - 32, canvas.height - 32);

  ctx.strokeStyle = 'rgba(112, 141, 255, 0.42)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // 顶部小状态条
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(24, 24, 112, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#FFB4B4';
  ctx.font = '600 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('图片异常', 80, 38);

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = '600 20px sans-serif';
  ctx.fillText('预览图未能正常显示', canvas.width / 2, 150);

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = '14px sans-serif';
  const lines = String(message || '无效图片数据').split(/\n+/).slice(0, 2);
  lines.forEach((line, idx) => ctx.fillText(line.slice(0, 34), canvas.width / 2, 180 + idx * 18));
  return canvas.toDataURL('image/png');
}

// 收集某节点的全部下游（后代）
function getDescendants(node) {
  const seen = new Set();
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    [...workflow.edges.values()].forEach(e => {
      if (e.from.node === cur && !seen.has(e.to.node)) {
        seen.add(e.to.node);
        stack.push(e.to.node);
      }
    });
  }
  return seen;
}

// 将提示词中的循环变量替换为当前迭代值
//   《计数》/《序号》→ 当前索引（起始+步长递进）
//   《总数》        → 总次数
//   《轮次》/《迭代》→ 第几轮（1-based）
//   《进度》        → 百分比
//   《起始》        → 起始值
function applyLoopVars(text) {
  if (!text || !LOOP_STATE) return text;
  const st = LOOP_STATE;
  const progress = st.total > 1 ? Math.round((st.iter / st.total) * 100) : 100;
  return String(text)
    .replace(/《计数》|《序号》|\{index\}/g, String(st.index))
    .replace(/《总数》|\{total\}/g, String(st.total))
    .replace(/《轮次》|《迭代》|\{iter\}/g, String(st.iter))
    .replace(/《进度》|\{progress\}/g, progress + '%')
    .replace(/《起始》|\{start\}/g, String(st.start));
}

// 收集某节点产出的全部图片（含多图原图 / 单图输出 / 缩略图）
function collectNodeImages(node) {
  const imgs = [];
  if (Array.isArray(node._galleryImages)) {
    node._galleryImages.forEach(im => { if (isDataImage(im)) imgs.push(im); });
  }
  (node.outputsData || []).forEach(o => {
    if (o && o.type === 'image' && isDataImage(o.value)) imgs.push(o.value);
  });
  if (isDataImage(node.thumb)) imgs.push(node.thumb);
  // 去重（保留顺序）
  const seen = new Set();
  return imgs.filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });
}

// 循环节点执行：重复驱动下游节点 count 次，聚合每次产出的图片
async function runLoopNode(node) {
  const count = Math.max(1, parseInt(node.params.count) || 1);
  let start = parseInt(node.params.start);
  if (isNaN(start)) start = 1;
  const step = Math.max(1, parseInt(node.params.step) || 1);
  const mode = node.params.mode === 'parallel' ? 'parallel' : 'serial';

  node._galleryImages = [];
  node.loopProgress = { iter: 0, total: count };
  if (node.el) buildNodeBody(node.el, node);

  const desc = getDescendants(node);
  if (desc.size === 0) {
    node.outputsData = [{ type: 'image', value: node.thumb || '' }];
    return;
  }

  const order = topoSortNodes(desc);
  const baseDelay = mode === 'parallel' ? 120 : 380; // 串行稍慢，给接口留出余量

  for (let k = 1; k <= count; k++) {
    const index = start + (k - 1) * step;
    LOOP_STATE = { index: index, total: count, iter: k, start: start, step: step };
    try {
      await runInOrder(order, baseDelay, new Set()); // 本轮驱动下游，跳过逻辑不生效
    } catch (err) {
      showToast('循环第 ' + k + ' 轮执行出错：' + (err && err.message || err), 'warn');
    }
    // 收集本轮所有下游产出的图片
    desc.forEach(d => {
      collectNodeImages(d).forEach(im => node._galleryImages.push(im));
    });
    node.loopProgress = { iter: k, total: count };
    if (node.el) buildNodeBody(node.el, node);
  }

  LOOP_STATE = null;
  node.thumb = node._galleryImages[0] || node.thumb || '';
  node.outputsData = [{ type: 'image', value: node.thumb }];
}

// 收集某节点的全部祖先（上游）
function collectAncestors(node, acc) {
  acc = acc || new Set();
  [...workflow.edges.values()].forEach(e => {
    if (e.to.node === node && !acc.has(e.from.node)) {
      acc.add(e.from.node);
      collectAncestors(e.from.node, acc);
    }
  });
  return acc;
}

// 拓扑排序（Kahn 算法）。若传入 seedSet，则只在该集合内排序
function topoSortNodes(seedSet) {
  const nodes = seedSet ? [...seedSet] : [...workflow.nodes.values()];
  const inDegree = new Map();
  const adj = new Map();
  nodes.forEach(n => { inDegree.set(n, 0); adj.set(n, []); });
  [...workflow.edges.values()].forEach(e => {
    if (nodes.includes(e.from.node) && nodes.includes(e.to.node)) {
      adj.get(e.from.node).push(e.to.node);
      inDegree.set(e.to.node, inDegree.get(e.to.node) + 1);
    }
  });
  const queue = nodes.filter(n => inDegree.get(n) === 0);
  const order = [];
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    adj.get(n).forEach(m => {
      inDegree.set(m, inDegree.get(m) - 1);
      if (inDegree.get(m) === 0) queue.push(m);
    });
  }
  return order;
}

// 按拓扑顺序逐个执行；skipSet 中的节点（循环节点的下游）由循环节点自行驱动
async function runInOrder(order, delay, skipSet, force) {
  // 阶段 3：opt-in 委托任务执行引擎（含状态机/并发/取消/超时/重试/幂等/对账）
  if (window.FlowCraft && window.FlowCraft.runner && typeof window.FlowCraft.runner.runInOrder === 'function') {
    return window.FlowCraft.runner.runInOrder(order, delay, skipSet, force);
  }
  skipSet = skipSet || new Set();
  // 并行执行：每个节点只等待它的直接上游完成；互不依赖的分支同时运行
  const done = new Map();
  const pending = [];
  for (const node of order) {
    if (skipSet.has(node)) {
      // 该节点属于某循环节点的下游，跳过全局执行（由循环节点驱动）
      done.set(node, Promise.resolve());
      continue;
    }
    const upstream = [];
    workflow.edges.forEach(e => {
      if (e.to.node === node && order.includes(e.from.node)) upstream.push(e.from.node);
    });
    const p = (async () => {
      await Promise.all(upstream.map(u => done.get(u) || Promise.resolve()));
      // C 失败即断链
      const badUp = upstream.find(u => u.status === 'error' || u.status === 'skipped');
      if (badUp) {
        node.status = 'skipped';
        node._skipReason = '上游『' + (badUp.title || badUp.type) + '』未成功';
        updateNodeStatus(node);
        return;
      }
      // B 增量缓存
      if (!force && node._runCacheOk && node._runCacheKey === fcRunCacheKey(node) && fcHasOutput(node)) {
        node.status = 'skipped';
        node._skipReason = '输入未变更（Shift+运行 强制全量）';
        updateNodeStatus(node);
        return;
      }
      node._pendingCacheKey = fcRunCacheKey(node);
      await executeNodeAsync(node, delay);
      if (node._pendingCacheKey && node.status === 'done') { node._runCacheKey = node._pendingCacheKey; node._runCacheOk = true; }
      else if (node.status === 'error') { node._runCacheOk = false; }
      node._pendingCacheKey = null;
    })();
    done.set(node, p);
    pending.push(p);
  }
  await Promise.all(pending);
}

// 计算循环节点下游集合（用于全局运行跳过，避免重复执行）
function computeLoopSkip() {
  const skip = new Set();
  [...workflow.nodes.values()].forEach(n => {
    if (n.type === 'loop') getDescendants(n).forEach(d => skip.add(d));
  });
  return skip;
}

// 单节点运行：先运行其全部上游，再运行自身（保证输入数据是最新的）
function runNode(node) {
  if (node.status === 'running') return;
  const set = collectAncestors(node);
  set.add(node);
  const order = topoSortNodes(set);
  // 仅跳过本次运行集合内循环节点的下游，避免误伤其它分支
  const skip = new Set();
  set.forEach(n => { if (n.type === 'loop') getDescendants(n).forEach(d => skip.add(d)); });
  window.__loopSkip = skip;
  runInOrder(order, 550, skip);
}

// 全局运行：整张画布按拓扑顺序流动执行
// B 增量缓存键：上游输入指纹 + 参数 + 提示词 + 参考图
function fcRunCacheKey(node) {
  const ins = (node.inputsData || []).map(p => {
    if (!p) return '-';
    const v = String(p.value || '');
    return v.length + ':' + v.slice(0, 24);
  }).join('|');
  const refs = (node.refImages || []).map(r => (r && r.src) ? r.src.length : 0).join(',');
  let params = '';
  try { params = JSON.stringify(node.params || {}); } catch (e) { params = ''; }
  return [node.type, ins, params, String(node.prompt || ''), refs].join('#');
}
function fcHasOutput(node) {
  const od = (node.outputsData || []).some(p => p && p.value);
  return od || !!node.thumb;
}
// F dry-run：判断该节点本轮是否会调用真实模型/ComfyUI
function nodeWillCallReal(node) {
  const t = node.type;
  if (t === 'comfyui') return true;
  if (['aiImage', 'aiVideo', 'upscale', 'lineart', 'imageEdit'].indexOf(t) < 0) return false;
  return !!(localStorage.getItem(OPENAI_KEY_STORAGE) || (typeof _fcProxy === 'function' && _fcProxy()));
}
// F dry-run 预览弹窗：执行数 + 真实调用清单，确认后执行
function showRunPreview(order, realNodes, onConfirm) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:420px;width:92vw;max-height:70vh;overflow:auto;background:var(--bg-panel);border:1px solid var(--border-default);border-radius:12px;padding:16px;box-shadow:var(--shadow-panel);color:var(--text-1);';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:600;margin-bottom:8px;';
  title.textContent = '运行前预览（dry-run）';
  const sum = document.createElement('div');
  sum.style.cssText = 'font-size:12px;color:var(--text-2);line-height:1.7;margin-bottom:6px;';
  sum.innerHTML = '将执行 <b>' + order.length + '</b> 个节点（拓扑序、依赖并行、并发≤2）。<br>其中 <b style="color:var(--color-warn)">' + realNodes.length + '</b> 个会调用真实模型 / ComfyUI：';
  const list = document.createElement('div');
  list.style.cssText = 'font-size:12px;color:var(--text-2);margin:6px 0 12px;padding-left:16px;line-height:1.7;';
  realNodes.slice(0, 8).forEach(n => { const li = document.createElement('div'); li.textContent = '· ' + (n.title || n.type); list.appendChild(li); });
  if (realNodes.length > 8) { const more = document.createElement('div'); more.textContent = '… 等共 ' + realNodes.length + ' 个'; list.appendChild(more); }
  const tip = document.createElement('div');
  tip.style.cssText = 'font-size:11px;color:var(--text-3);margin-bottom:10px;';
  tip.textContent = '输入未变更且上次成功的节点会自动跳过；Shift+运行 强制全量。';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  const cancel = document.createElement('button');
  cancel.className = 'ra-btn'; cancel.textContent = '取消';
  cancel.onclick = () => ov.remove();
  const ok = document.createElement('button');
  ok.className = 'ra-btn';
  ok.style.cssText = 'background:var(--accent,#5B8DEF);color:#fff;border-color:transparent;';
  ok.textContent = '确认运行';
  ok.onclick = () => { ov.remove(); onConfirm(); };
  row.appendChild(cancel); row.appendChild(ok);
  box.appendChild(title); box.appendChild(sum); box.appendChild(list); box.appendChild(tip); box.appendChild(row);
  ov.appendChild(box);
  document.body.appendChild(ov);
}

async function runWorkflow(opts) {
  opts = opts || {};
  // A 运行范围：all / selection(选中子图) / fromNode(该节点到末端)
  let pool = [...workflow.nodes.values()];
  if (opts.scope === 'selection') {
    pool = [...workflow.selection].map(id => workflow.nodes.get(id)).filter(Boolean);
    if (!pool.length) { showToast('未选中任何节点', 'info'); return; }
  } else if (opts.scope === 'fromNode' && opts.seed) {
    pool = [opts.seed].concat(getDescendants(opts.seed));
  }
  const order = topoSortNodes(pool);
  if (order.length === 0) {
    showToast('画布中没有可运行的节点', 'info');
    return;
  }
  // E 环路反馈：pool 中未进入拓扑序的节点明确提示，不再静默不跑
  const inOrder = new Set(order);
  const cyclic = pool.filter(n => !inOrder.has(n));
  if (cyclic.length) {
    showToast(cyclic.length + ' 个节点处于连线环路中，本轮不运行：' + cyclic.slice(0, 3).map(n => n.title || n.type).join('、'), 'warn', 5200);
  }
  window.__loopSkip = computeLoopSkip();
  const doRun = async () => {
    order.forEach(n => { if (n.el) { n.status = 'idle'; updateNodeStatus(n); } });
    await runInOrder(order, 550, window.__loopSkip, !!opts.force);
    window.__loopSkip = new Set();
    markEdgesDirty();
    refreshAssetPanelIfOpen();
    const skipped = order.filter(n => n.status === 'skipped').length;
    showToast('工作流执行完成 · 数据已沿连线流动' + (skipped ? '（跳过 ' + skipped + ' 个：未变更/上游失败）' : ''), 'success');
  };
  // F dry-run：有真实调用时先确认
  const realNodes = order.filter(n => !window.__loopSkip.has(n) && nodeWillCallReal(n));
  if (realNodes.length && !opts.skipPreview) showRunPreview(order, realNodes, doRun);
  else await doRun();
}

// 轻提示
//================ 17. 状态栏更新 ================
function updateStatusbar() {
  document.getElementById('statNodes').textContent = workflow.nodes.size;
  document.getElementById('statEdges').textContent = workflow.edges.size;
  const verEl = document.getElementById('statVersion');
  if (verEl) verEl.textContent = 'v' + APP_VERSION;
}

//================ 17b. 右键上下文菜单 ================
const contextMenu = document.createElement('div');
let _ctxFlyout = null;
let _ctxFlyoutTimer = null;
contextMenu.className = 'context-menu';
document.body.appendChild(contextMenu);

const MENU_ICONS = {
  copy:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3h8"/></svg>',
  duplicate: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="5" y="5" width="8" height="8" rx="1"/></svg>',
  split:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="4" height="4" rx="1"/><rect x="10" y="2" width="4" height="4" rx="1"/><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="10" y="10" width="4" height="4" rx="1"/></svg>',
  delete:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10"/></svg>',
  front:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="8" height="8" rx="1"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/></svg>',
  back:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="8" height="8" rx="1" opacity="0.4"/><rect x="6" y="6" width="8" height="8" rx="1"/></svg>',
  run:       '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l9 6-9 6z"/></svg>',
  fit:       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"/></svg>',
  zoom:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3M5 7h4M7 5v4"/></svg>',
  selectAll: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1" stroke-dasharray="2 2"/></svg>',
};

function addMenuItem(label, icon, shortcut, onClick, isDanger) {
  const item = document.createElement('div');
  item.className = 'context-menu-item' + (isDanger ? ' danger' : '');
  item.innerHTML = `${icon}<span>${label}</span>${shortcut ? `<span class="shortcut">${shortcut}</span>` : ''}`;
  item.addEventListener('click', () => {
    onClick();
    hideContextMenu();
  });
  contextMenu.appendChild(item);
}

// —— 空白处右键：添加节点面板（最近使用 + 分类，画布操作保留在底部）——
const RECENT_NODES_KEY = 'flowcraft:recentNodes:v1';
function loadRecentNodes() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_NODES_KEY));
    return Array.isArray(v) ? v.filter(t => NODE_TYPES[t]) : [];
  } catch (e) { return []; }
}
function saveRecentNodes(list) {
  try { localStorage.setItem(RECENT_NODES_KEY, JSON.stringify(list.slice(0, 6))); } catch (e) {}
}
function recordRecentNode(type) {
  const list = loadRecentNodes().filter(t => t !== type);
  list.unshift(type);
  saveRecentNodes(list);
}
const CTX_NODE_SECTIONS = [
  { label: 'AI 生成', types: ['aiImage', 'imageEdit', 'aiVideo', 'aiSet'] },
  { label: '文本 / 提示词', types: ['text', 'script'] },
  { label: '素材 / 处理', types: ['image', 'videoInput', 'lineart', 'upscale', 'compare', 'material', 'light', 'layout'] },
  { label: '视频成片', types: ['videoBreak', 'footage', 'voiceover', 'subtitle', 'bgm', 'compose', 'publish'] },
  { label: '高级 / 本地', types: ['loop', 'comfyui'] },
  { label: '输出', types: ['save'] },
];
let _ctxWorld = { x: 0, y: 0 };

const CTX_COMMON_TYPES = ['aiImage', 'imageEdit', 'aiVideo', 'text', 'image', 'upscale', 'save'];

function ensureCtxFlyout() {
  if (!_ctxFlyout) {
    _ctxFlyout = document.createElement('div');
    _ctxFlyout.className = 'ctx-flyout';
    document.body.appendChild(_ctxFlyout);
    _ctxFlyout.addEventListener('mouseenter', () => { clearTimeout(_ctxFlyoutTimer); });
    _ctxFlyout.addEventListener('mouseleave', () => { _ctxFlyoutTimer = setTimeout(closeCtxFlyout, 180); });
  }
  return _ctxFlyout;
}
function closeCtxFlyout() {
  if (_ctxFlyout) _ctxFlyout.classList.remove('show');
  contextMenu.querySelectorAll('.has-sub.open').forEach(o => o.classList.remove('open'));
}
function openCtxFlyout(row, types) {
  contextMenu.querySelectorAll('.has-sub.open').forEach(o => { if (o !== row) o.classList.remove('open'); });
  row.classList.add('open');
  const fly = ensureCtxFlyout();
  fly.innerHTML = '';
  types.forEach(type => {
    const def = NODE_TYPES[type];
    if (!def) return;
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.style.setProperty('--type-color', def.color);
    item.innerHTML = '<span class="ctx-node-icon">' + (NODE_ICONS[type] || '') + '</span><span>' + def.label + '</span>';
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      hideContextMenu();
      recordRecentNode(type);
      addNode(type, _ctxWorld.x - 140, _ctxWorld.y - 90);
      showToast('已添加节点：' + def.label, 'info', 1600);
    });
    fly.appendChild(item);
  });
  fly.classList.add('show');
  const r = row.getBoundingClientRect();
  const fr = fly.getBoundingClientRect();
  let left = r.right - 4;
  if (left + fr.width > window.innerWidth - 8) left = r.left - fr.width + 4;
  let top = r.top - 4;
  if (top + fr.height > window.innerHeight - 8) top = Math.max(4, window.innerHeight - 8 - fr.height);
  fly.style.left = left + 'px';
  fly.style.top = top + 'px';
}
function addCtxSubmenu(title, types) {
  const row = document.createElement('div');
  row.className = 'context-menu-item has-sub';
  row.innerHTML = '<span class="ctx-node-icon"></span><span>' + title + '</span><span class="shortcut arrow">▸</span>';
  row.addEventListener('mouseenter', () => { clearTimeout(_ctxFlyoutTimer); openCtxFlyout(row, types); });
  row.addEventListener('mouseleave', () => { _ctxFlyoutTimer = setTimeout(closeCtxFlyout, 180); });
  row.addEventListener('click', (ev) => {
    if (ev.target.closest('.ctx-flyout')) return;
    if (row.classList.contains('open')) closeCtxFlyout();
    else { clearTimeout(_ctxFlyoutTimer); openCtxFlyout(row, types); }
  });
  contextMenu.appendChild(row);
}

function addCtxNodeSection(title, types) {
  const h = document.createElement('div');
  h.className = 'context-menu-section';
  h.textContent = title;
  contextMenu.appendChild(h);
  types.forEach(type => {
    const def = NODE_TYPES[type];
    if (!def) return;
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.style.setProperty('--type-color', def.color);
    item.innerHTML = '<span class="ctx-node-icon">' + (NODE_ICONS[type] || '') + '</span><span>' + def.label + '</span>';
    item.addEventListener('click', () => {
      hideContextMenu();
      recordRecentNode(type);
      addNode(type, _ctxWorld.x - 140, _ctxWorld.y - 90);
      showToast('已添加节点：' + def.label, 'info', 1600);
    });
    contextMenu.appendChild(item);
  });
}
function showCanvasAddMenu(e) {
  const rect = canvasWrap.getBoundingClientRect();
  _ctxWorld = workflow.camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  contextMenu.innerHTML = '';
  contextMenu.classList.add('wide');
  const recent = loadRecentNodes();
  if (recent.length) addCtxNodeSection('最近使用', recent);
  addCtxNodeSection('常用', CTX_COMMON_TYPES.filter(t => !recent.includes(t)));
  CTX_NODE_SECTIONS.forEach(s => addCtxSubmenu(s.label, s.types));
  addMenuSeparator();
  addMenuItem('适应内容', MENU_ICONS.fit, getShortcutDisplay(keybindings.fitContent), () => fitToContent());
  addMenuItem('重置缩放', MENU_ICONS.zoom, getShortcutDisplay(keybindings.resetZoom), () => resetZoom());
  addMenuItem('全选节点', MENU_ICONS.selectAll, getShortcutDisplay(keybindings.selectAll), () => selectAllNodes());
  let h = 8;
  for (const child of contextMenu.children) {
    h += child.classList.contains('context-menu-section') ? 22 : (child.classList.contains('context-menu-separator') ? 9 : 34);
  }
  let mx = e.clientX, my = e.clientY;
  if (mx + 236 > window.innerWidth) mx = e.clientX - 236;
  if (my + h > window.innerHeight) my = e.clientY - h;
  contextMenu.style.left = Math.max(4, mx) + 'px';
  contextMenu.style.top = Math.max(4, my) + 'px';
  contextMenu.classList.add('show');
}

function addMenuSeparator() {
  const sep = document.createElement('div');
  sep.className = 'context-menu-separator';
  contextMenu.appendChild(sep);
}

function showContextMenu(x, y, node) {
  contextMenu.innerHTML = '';
  contextMenu.classList.remove('wide');

  if (node) {
    // —— 节点上下文菜单 ——
    addMenuItem('创建副本', MENU_ICONS.duplicate, getShortcutDisplay(keybindings.duplicateSelected), () => duplicateNode(node));
    if (node.type === 'aiImage' && Array.isArray(node._galleryImages) && node._galleryImages.length > 1) {
      addMenuItem('拆分为独立节点', MENU_ICONS.split, '', () => splitAiImageGalleryToNodes(node));
    }
    // 右键查看大图：单图直接开灯箱，多图画廊传入列表支持左右切换
    const _lbList = (node.type === 'aiImage' && Array.isArray(node._galleryImages) && node._galleryImages.length > 1) ? node._galleryImages : null;
    const _lbSrc = normalizeImageSrc(_lbList ? _lbList[0] : (getNodeDisplayImageSource(node) || node.thumb));
    if (_lbSrc) {
      addMenuItem('查看大图', MENU_ICONS.zoom, '', () => openImageLightbox(_lbSrc, _lbList || undefined, 0));
    }
    addMenuItem('删除节点', MENU_ICONS.delete, getShortcutDisplay(keybindings.deleteSelected), () => deleteNode(node.id), true);
    addMenuSeparator();
    addMenuItem('置于顶层', MENU_ICONS.front, '', () => bringToFront(node));
    addMenuItem('置于底层', MENU_ICONS.back, '', () => sendToBack(node));
    addMenuSeparator();
    if (node.type === 'aiImage' || node.type === 'aiVideo') {
      addMenuItem('运行节点', MENU_ICONS.run, '', () => runNode(node));
    }
    if (workflow.selection && workflow.selection.size > 1) {
      addMenuItem('运行选中子图', MENU_ICONS.run, '', () => runWorkflow({ scope: 'selection' }));
    }
    addMenuItem('从该节点运行到末端', MENU_ICONS.run, '', () => runWorkflow({ scope: 'fromNode', seed: node }));
    addMenuItem('加入场景', MENU_ICONS.selectAll, '', () => assignSelectedToScenePrompt());
  } else {
    // —— 画布上下文菜单 ——
    addMenuItem('适应内容', MENU_ICONS.fit, getShortcutDisplay(keybindings.fitContent), () => fitToContent());
    addMenuItem('重置缩放', MENU_ICONS.zoom, getShortcutDisplay(keybindings.resetZoom), () => resetZoom());
    addMenuSeparator();
    addMenuItem('全选节点', MENU_ICONS.selectAll, getShortcutDisplay(keybindings.selectAll), () => selectAllNodes());
  }

  // 确保菜单不超出视口
  const menuW = 200;
  const menuH = contextMenu.children.length * 34 + 8;
  let mx = x, my = y;
  if (x + menuW > window.innerWidth) mx = x - menuW;
  if (y + menuH > window.innerHeight) my = y - menuH;

  contextMenu.style.left = mx + 'px';
  contextMenu.style.top = my + 'px';
  contextMenu.classList.add('show');
}

function hideContextMenu() {
  contextMenu.classList.remove('show');
  closeCtxFlyout();
}

// 右键事件监听
canvasWrap.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const nodeEl = e.target.closest('.node');
  const node = nodeEl ? workflow.nodes.get(nodeEl.dataset.id) : null;
  if (node) {
    // 右键只负责选中并打开上下文菜单，不带出左键下方 Composer。
    selectNode(node, { showComposer: false });
    hideNodeComposer();
    showContextMenu(e.clientX, e.clientY, node);
  }
  else showCanvasAddMenu(e);
});

// 点击其他地方 / 滚动 / 失焦 → 关闭菜单
window.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu') && !e.target.closest('.ctx-flyout')) hideContextMenu();
});
window.addEventListener('blur', hideContextMenu);
canvasWrap.addEventListener('scroll', hideContextMenu, true);

// —— 菜单辅助函数 ——
function duplicateNode(node) {
  const newNode = addNode(node.type, node.x + 40, node.y + 40, node.thumb);
  newNode.prompt = node.prompt;
  newNode.params = { ...node.params };
  newNode.uploadedImage = typeof node.uploadedImage === 'string' ? node.uploadedImage : '';
  newNode.croppedImage = typeof node.croppedImage === 'string' ? node.croppedImage : '';
  newNode.cropMeta = node.cropMeta ? JSON.parse(JSON.stringify(node.cropMeta)) : null;
  newNode.refImages = node.refImages ? JSON.parse(JSON.stringify(node.refImages)) : [];
  newNode.refVideos = node.refVideos ? JSON.parse(JSON.stringify(node.refVideos)) : [];
  newNode._galleryImages = Array.isArray(node._galleryImages) ? node._galleryImages.slice() : [];
  newNode._imageCount = node._imageCount || newNode._galleryImages.length || 0;
  newNode.charDesc = node.charDesc || '';
  newNode.stateMeta = node.stateMeta ? { ...node.stateMeta } : null;
  newNode.semanticMode = node.semanticMode || getNodeSemanticTier(node.type);
  newNode.resultMode = node.resultMode || 'pending';
  newNode.previewOnly = !!node.previewOnly;
  newNode.previewSourceId = node.previewSourceId || '';
  if (newNode.previewOnly && newNode.el) newNode.el.classList.add('preview-only-node');
  buildNodeBody(newNode.el, newNode);
  selectNode(newNode);
  markEdgesDirty();
  scheduleAutosave();
  return newNode;
}

function isPreviewOnlyNode(node) {
  return !!(node && node.previewOnly);
}

function bringToFront(node) {
  node.el.style.zIndex = (++workflow.nextZ).toString();
}

function sendToBack(node) {
  let minZ = Infinity;
  workflow.nodes.forEach(n => {
    const z = parseInt(n.el.style.zIndex) || 0;
    if (z < minZ) minZ = z;
  });
  node.el.style.zIndex = (minZ - 1).toString();
}

function resetZoom() {
  workflow.camera.zoom = 1;
  applyTransform();
  markEdgesDirty();
}

function selectAllNodes() {
  workflow.selection.forEach(id => {
    const n = workflow.nodes.get(id);
    if (n && n.el) n.el.classList.remove('selected');
  });
  workflow.selection.clear();
  workflow.nodes.forEach(n => {
    workflow.selection.add(n.id);
    n.el.classList.add('selected');
  });
}

//================ 18. 启动：初始化 + 自动恢复 / 示例数据 ================
function init() {
  buildSidebar();
  resizeCanvases();

  // 恢复主题
  const savedTheme = localStorage.getItem('flowcraft-theme');
  if (savedTheme) {
    if (savedTheme === '') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', savedTheme);
    refreshThemeColors();
  }

  // 加载快捷键配置并刷新界面提示
  loadKeybindings();
  updateToolbarTitles();

  // 恢复 AI 设计助手面板开关状态（默认隐藏，由 localStorage 记忆）
  try {
    const aiState = localStorage.getItem('flowcraft-ai-panel');
    if (aiState === 'open') {
      aiPanel.classList.remove('collapsed');
      aiToggleBtn.classList.add('active');
    } else {
      aiPanel.classList.add('collapsed');
      aiToggleBtn.classList.remove('active');
    }
  } catch (_) {
    aiPanel.classList.add('collapsed');
    aiToggleBtn.classList.remove('active');
  }

  // 绑定工具栏按钮
  document.getElementById('btnUndo').onclick = undo;
  document.getElementById('btnRedo').onclick = redo;
  document.getElementById('btnRecycle').onclick = () => toggleRecyclePanel();
  document.getElementById('btnExport').onclick = exportJSON;
  document.getElementById('btnExportPng').onclick = () => { exportCanvasPNG(); };
  document.getElementById('btnImport').onclick = () => document.getElementById('importFileInput').click();
  document.getElementById('btnClearSave').onclick = () => {
    if (confirm('确定清空已保存数据？这将无法恢复之前自动保存的画布状态。')) {
      clearSavedData();
    }
  };
  document.getElementById('btnRunAll').onclick = (e) => runWorkflow({ force: !!(e && e.shiftKey) });
  document.getElementById('btnRunLog').onclick = () => toggleRunLogPanel();
  document.getElementById('runLogClose').onclick = () => toggleRunLogPanel(false);
  document.getElementById('runLogClear').onclick = () => clearRunLog();
  document.getElementById('runLogFilter').onchange = () => renderRunLog();
  // 生成历史：点击「存为素材」把缩略图作为图片节点存入画布/素材库
  document.getElementById('runLogList').addEventListener('click', (e) => {
    const btn = e.target.closest('.rl-save');
    if (!btn) return;
    const thumb = btn.getAttribute('data-thumb');
    if (!thumb) return;
    const n = addNode('image', 80 + Math.floor(Math.random() * 200), 80 + Math.floor(Math.random() * 200));
    n.thumb = thumb;
    if (n.el) buildNodeBody(n.el, n);
    scheduleAutosave();
    refreshAssetPanelIfOpen();
    showToast('已存入素材库', 'success');
  });

  // 重生成归档面板
  document.getElementById('btnRegen').onclick = () => toggleRegenPanel();
  document.getElementById('regenClose').onclick = () => toggleRegenPanel(false);
  document.getElementById('regenClear').onclick = clearRegens;
  document.getElementById('regenFilter').onchange = renderRegenPanel;
  document.getElementById('btnDelivery').onclick = exportDeliveryPackage;
  updateRegenBadge();
  // 场景分组面板
  document.getElementById('btnScenes').onclick = () => toggleScenePanel();
  document.getElementById('sceneClose').onclick = () => toggleScenePanel(false);
  document.getElementById('sceneNew').onclick = () => {
    const name = prompt('场景名称', '场景 ' + (workflow.scenes.length + 1));
    if (name !== null) createScene(name.trim() || ('场景 ' + (workflow.scenes.length + 1)));
  };
  document.getElementById('sceneList').addEventListener('click', (e) => {
    const btn = e.target.closest('.mini-btn');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    if (act === 'focus') focusScene(id);
    else if (act === 'del') deleteScene(id);
    else if (act === 'add') {
      const ids = [...workflow.selection].map(n => n.id);
      if (ids.length) addNodesToScene(id, ids);
    }
  });
  document.getElementById('btnShortcuts').onclick = () => openShortcutsPanel();

  // 开箱模板面板
  document.getElementById('btnTemplates').onclick = () => toggleTemplatePanel();
  document.getElementById('templateClose').onclick = () => closeTemplatePanel();
  bindTemplateEvents();

  // 工作流管理 / 素材库 面板
  document.getElementById('btnWorkflow').onclick = () => {
    toggleWorkflowPanel();
  };
  document.getElementById('btnWorkbench').onclick = () => {
    toggleWorkbenchPanel();
  };
  document.getElementById('btnWorkbenchNew').onclick = () => {
    const nn = prompt('新工作台名称（留空自动命名）', '');
    newWorkbench(nn || '');
  };
  document.getElementById('btnAssets').onclick = () => {
    toggleAssetPanel();
  };
  document.getElementById('workflowClose').onclick = () => toggleWorkflowPanel(false);
  document.getElementById('workflowOverlay').onclick = () => toggleWorkflowPanel(false);
  document.getElementById('workbenchClose').onclick = () => toggleWorkbenchPanel(false);
  document.getElementById('workbenchOverlay').onclick = () => toggleWorkbenchPanel(false);
  document.getElementById('btnSaveWorkflow').onclick = () => {
    const n = prompt('为当前工作流命名', '我的工作流 ' + new Date().toLocaleDateString());
    if (n && n.trim()) saveNamedWorkflow(n.trim());
  };
  document.getElementById('btnNewWorkflow').onclick = () => newWorkflow();
  document.getElementById('btnImportWorkflow').onclick = () => document.getElementById('importFileInput').click();
  document.getElementById('assetClose').onclick = () => toggleAssetPanel(false);
  document.getElementById('assetOverlay').onclick = () => toggleAssetPanel(false);
  document.getElementById('btnRefreshAssets').onclick = () => updateAssetPanel();
  const assetFilters = document.getElementById('assetFilters');
  if (assetFilters) {
    assetFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.asset-filter-chip');
      if (!chip) return;
      _assetCatFilter = chip.getAttribute('data-cat') || '';
      updateAssetPanel();
    });
  }

  // 回收站面板事件
  document.getElementById('recycleClose').onclick = () => toggleRecyclePanel(false);
  document.getElementById('recycleOverlay').onclick = () => toggleRecyclePanel(false);
  document.getElementById('btnRestoreAll').onclick = () => {
    if (recycleBin.length === 0) return;
    if (!confirm('确定还原回收站中的全部节点？')) return;
    // 整个"全部还原"作为单次原子操作，只压入一条撤销历史
    isBatchRestore = true;
    pushHistory(); // 循环前统一压栈一次（捕获还原前状态）
    try {
      // 从后往前还原，避免索引错乱
      for (let i = recycleBin.length - 1; i >= 0; i--) {
        restoreFromRecycle(i);
      }
    } finally {
      isBatchRestore = false; // 确保异常时也能复位标志
    }
  };
  document.getElementById('btnEmptyRecycle').onclick = () => {
    if (!confirm('确定清空回收站？此操作不可撤销。')) return;
    emptyRecycleBin();
  };

  // 图片 Lightbox：滚轮缩放、拖拽平移、双击还原、点击空白/关闭按钮/Esc 关闭
  const imageLightbox = document.getElementById('imageLightbox');
  const imageLightboxClose = document.getElementById('imageLightboxClose');
  const imageLightboxReset = document.getElementById('imageLightboxReset');
  const imageLightboxStage = document.getElementById('imageLightboxStage');
  const imageLightboxWrapper = document.getElementById('imageLightboxWrapper');
  const imageLightboxImg = document.getElementById('imageLightboxImg');

  if (imageLightbox) {
    imageLightbox.addEventListener('click', (e) => {
      // 只点击最外层 overlay 或 stage 空白处才关闭；点击按钮/图片不关闭
      if (e.target === imageLightbox || e.target === imageLightboxStage) {
        closeImageLightbox();
      }
    });
  }
  if (imageLightboxClose) imageLightboxClose.onclick = closeImageLightbox;
  if (imageLightboxReset) imageLightboxReset.onclick = resetLightboxTransform;
  const imageLightboxPrev = document.getElementById('imageLightboxPrev');
  const imageLightboxNext = document.getElementById('imageLightboxNext');
  if (imageLightboxPrev) imageLightboxPrev.onclick = (e) => { e.stopPropagation(); lbGo(-1); };
  if (imageLightboxNext) imageLightboxNext.onclick = (e) => { e.stopPropagation(); lbGo(1); };

  // 滚轮缩放（以鼠标位置为中心）
  if (imageLightboxStage) {
    imageLightboxStage.addEventListener('wheel', (e) => {
      if (!imageLightbox.classList.contains('show')) return;
      e.preventDefault();
      const rect = imageLightboxStage.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY > 0 ? 0.9 : 1.12;
      const oldScale = lbState.scale;
      const newScale = Math.min(Math.max(oldScale * factor, 0.2), 8);
      // 以鼠标为焦点缩放：保持鼠标对应世界坐标不变
      lbState.x = cx - (cx - lbState.x) * (newScale / oldScale);
      lbState.y = cy - (cy - lbState.y) * (newScale / oldScale);
      lbState.scale = newScale;
      updateLightboxTransform(false);
    }, { passive: false });
  }

  // 拖拽平移
  function lbStartDrag(e) {
    if (!imageLightbox.classList.contains('show')) return;
    // 在图片或 stage 上按下均可拖拽
    if (e.target.closest('.lb-close, .lb-reset')) return;
    lbState.dragging = true;
    lbState.lastX = e.clientX;
    lbState.lastY = e.clientY;
    if (imageLightboxStage) imageLightboxStage.classList.add('dragging');
  }
  function lbMoveDrag(e) {
    if (!lbState.dragging) return;
    e.preventDefault();
    const dx = e.clientX - lbState.lastX;
    const dy = e.clientY - lbState.lastY;
    lbState.lastX = e.clientX;
    lbState.lastY = e.clientY;
    lbState.x += dx;
    lbState.y += dy;
    updateLightboxTransform(false);
  }
  function lbEndDrag() {
    lbState.dragging = false;
    if (imageLightboxStage) imageLightboxStage.classList.remove('dragging');
  }
  if (imageLightboxStage) {
    imageLightboxStage.addEventListener('mousedown', lbStartDrag);
    window.addEventListener('mousemove', lbMoveDrag);
    window.addEventListener('mouseup', lbEndDrag);
  }

  // 双击图片 / 包装器 还原
  if (imageLightboxWrapper) {
    imageLightboxWrapper.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      resetLightboxTransform();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const sp = document.getElementById('shortcutsPanel');
      if (sp && sp.classList.contains('show')) {
        closeShortcutsPanel();
        return;
      }
      if (imageLightbox && imageLightbox.classList.contains('show')) {
        closeImageLightbox();
      } else {
        const wf = document.getElementById('workflowPanel');
        const ap = document.getElementById('assetPanel');
        if (wf && wf.classList.contains('show')) toggleWorkflowPanel(false);
        if (ap && ap.classList.contains('show')) toggleAssetPanel(false);
      }
    } else if (imageLightbox && imageLightbox.classList.contains('show')) {
      // 多图查看：左右方向键切换
      if (e.key === 'ArrowLeft') { e.preventDefault(); lbGo(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); lbGo(1); }
    }
  });

  // 快捷键设置面板事件
  const shortcutsPanelOverlay = document.getElementById('shortcutsPanelOverlay');
  const shortcutsPanelClose = document.getElementById('shortcutsPanelClose');
  const shortcutsSaveBtn = document.getElementById('shortcutsSaveBtn');
  const shortcutsResetBtn = document.getElementById('shortcutsResetBtn');
  if (shortcutsPanelOverlay) shortcutsPanelOverlay.onclick = closeShortcutsPanel;
  if (shortcutsPanelClose) shortcutsPanelClose.onclick = closeShortcutsPanel;
  if (shortcutsSaveBtn) shortcutsSaveBtn.onclick = () => { saveKeybindings(); closeShortcutsPanel(); showToast('快捷键已保存', 'success'); };
  if (shortcutsResetBtn) shortcutsResetBtn.onclick = resetKeybindings;

  // 导入文件选择
  document.getElementById('importFileInput').onchange = (e) => {
    const file = e.target.files[0];
    if (file) importJSON(file);
    e.target.value = ''; // 重置，允许重复导入同名文件
  };

  // 初始 camera 居中
  workflow.camera.x = canvasWrap.clientWidth / 2;
  workflow.camera.y = canvasWrap.clientHeight / 2;

  // #13 多工作台：确保存在活跃工作台（并把旧 AUTOSAVE_KEY 迁移为「默认工作台」）
  ensureWorkbench();
  renderWorkbenchSelect();

  // 尝试从 localStorage 恢复（剥离版快速启动）
  const restored = restoreFromStorage();
  _initCanvasSig = canvasSignature(); // 记录初始画布签名，防止后台补全覆盖用户现场
  restoreFullAutosaveFromIDB(true); // #13b：后台从 IndexedDB 补全完整大图版本（仅画布未改动时）

  if (restored !== false && restored > 0) {
    // 有保存数据，恢复成功
    updateStatusbar();
    updateRecycleUI();
    updateUndoRedoButtons();
    applyTransform();
    markEdgesDirty();
    setTimeout(() => fitToContent(), 100);
    setTimeout(() => {
      showToast(`已恢复 ${restored} 个节点`, 'success');
    }, 300);
  } else {
    // 无保存数据，创建示例节点
    createExampleNodes();
  }
}

// 创建示例节点 — AI 餐厅室内设计 6 节点工作流（首次打开或无保存数据时）
function createExampleNodes() {
  var startX = -900;
  var gap = 360;
  var y = -100;

  // 1. 参考图（image）
  var n1 = addNode('image', startX, y);
  n1.title = '参考图';
  n1.thumb = createPlaceholderDataURL(36, 36, 11, '参考');
  buildNodeBody(n1.el, n1);

  // 2. 线稿（lineart）
  var n2 = addNode('lineart', startX + gap, y);
  n2.title = '线稿提取';
  n2.prompt = '提取餐厅空间结构与家具轮廓线稿';
  n2.thumb = createPlaceholderDataURL(36, 36, 23, '线稿');
  buildNodeBody(n2.el, n2);

  // 3. AI 图集（aiSet）
  var n3 = addNode('aiSet', startX + gap * 2, y);
  n3.title = 'AI 图集生成';
  n3.prompt = '现代简约餐厅室内设计，暖色调，橡木材质，柔和吊灯氛围';
  n3.thumb = createPlaceholderDataURL(36, 36, 37, '图集');
  buildNodeBody(n3.el, n3);

  // 4. 材质（material）
  var n4 = addNode('material', startX + gap * 3, y);
  n4.title = '材质贴图';
  n4.prompt = '橡木桌面 + 大理石地面 + 黄铜五金配件';
  n4.thumb = createPlaceholderDataURL(36, 36, 53, '材质');
  buildNodeBody(n4.el, n4);

  // 5. 灯光（light）
  var n5 = addNode('light', startX + gap * 4, y);
  n5.title = '灯光氛围';
  n5.prompt = '暖白主光 3000K + 吊灯点缀 + 吧台重点照明';
  n5.thumb = createPlaceholderDataURL(36, 36, 71, '灯光');
  buildNodeBody(n5.el, n5);

  // 6. 布局方案（layout）
  var n6 = addNode('layout', startX + gap * 5, y);
  n6.title = '布局方案';
  n6.prompt = '4人桌 ×6 + 吧台位 ×8 + 入口迎宾区 + 备餐通道';
  n6.thumb = createPlaceholderDataURL(36, 36, 89, '布局');
  buildNodeBody(n6.el, n6);

  // 连线：n1 → n2 → n3 → n4 → n5 → n6（output[0] → input[0]）
  var e1 = new Edge(n1, 0, n2, 0); workflow.edges.set(e1.id, e1);
  var e2 = new Edge(n2, 0, n3, 0); workflow.edges.set(e2.id, e2);
  var e3 = new Edge(n3, 0, n4, 0); workflow.edges.set(e3.id, e3);
  var e4 = new Edge(n4, 0, n5, 0); workflow.edges.set(e4.id, e4);
  var e5 = new Edge(n5, 0, n6, 0); workflow.edges.set(e5.id, e5);

  updateStatusbar();
  updateRecycleUI();
  updateUndoRedoButtons();

  // 选中第 3 个节点（aiSet）
  selectNode(n3);

  // 适应内容
  setTimeout(function() { fitToContent(); }, 100);

  // 清空 undo 栈（初始状态不应有可撤销的操作）
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtons();

  // 首次保存
  doAutosave();
}

// 页面卸载前保存一次
window.addEventListener('beforeunload', () => {
  doAutosave();
  try { persistAIChatHistory(); } catch (_) {}
});
window.addEventListener('pagehide', function() {
  try { persistAIChatHistory(); } catch (_) {}
});
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') {
    try { persistAIChatHistory(); } catch (_) {}
  }
});

//================ 19. AI 面板交互逻辑 ================

// --- AI 面板状态 ---
var aiCurrentModel = 'gpt-5.4';
var aiIsGenerating = false;
// Deepseek 对话上下文（仅真实模型使用）
var aiConversation = [];
var AI_CHAT_HISTORY_STORAGE = 'flowcraft-ai-chat-history-v1';
var AI_CHAT_HISTORY_SESSION_STORAGE = 'flowcraft-ai-chat-history-v1-session';
var AI_CHAT_HISTORY_MAX = 60;
var aiChatRestoring = false;
var DEEPSEEK_KEY_STORAGE = 'flowcraft-deepseek-key';
var OPENAI_KEY_STORAGE = 'flowcraft-openai-key';
var OPENAI_BASE_STORAGE = 'flowcraft-openai-base';
var PROXY_BASE_STORAGE = 'flowcraft-proxy-base';
var PROXY_TOKEN_STORAGE = 'flowcraft-proxy-token';
var OPENAI_DEFAULT_BASE = 'https://infistar.cc/v1';

// ===== 模型提供方（多端点 / 多 Key）子系统 =====
// 让用户自行添加任意 OpenAI 兼容端点（base + key + model），并在画布内切换使用。
// 选中某个提供方时，会把它写入既有的 OPENAI_KEY_STORAGE / OPENAI_BASE_STORAGE，
// 从而让所有现网调用点（AI 助手对话 / 反推提示词视觉模型 / 生图）自动复用，无需改动各调用点。
var PROVIDERS_STORAGE = 'flowcraft-providers';
var ACTIVE_PROVIDER_STORAGE = 'flowcraft-active-provider';

function getProviders() {
  try {
    var raw = localStorage.getItem(PROVIDERS_STORAGE);
    if (raw === null) return null; // 尚未初始化
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function setProviders(arr) {
  try { localStorage.setItem(PROVIDERS_STORAGE, JSON.stringify(arr || [])); } catch (_) {}
}
function saveProvidersAndRefresh(list) {
  setProviders(list);
  syncActiveProviderToLegacy();
  syncProviderModelsToAiSelects();
  renderProviderSelect();
  renderProviderList();
  try { if (typeof agentFillProviders === 'function') agentFillProviders(); } catch (_) {}
}
function getActiveProviderId() {
  try { return localStorage.getItem(ACTIVE_PROVIDER_STORAGE) || ''; } catch (_) { return ''; }
}
function getActiveProvider() {
  var id = getActiveProviderId();
  if (!id) return null;
  var list = getProviders() || [];
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
  return null;
}
function getProviderById(id) {
  var list = getProviders() || [];
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
  return null;
}
function seedProvidersIfNeeded() {
  if (localStorage.getItem(PROVIDERS_STORAGE) !== null) return; // 已初始化过
  // 首次启动不创建虚假的默认提供方；用户在设置中自行添加端点和 Key。
  setProviders([]);
}
// 把当前激活提供方的 base/key 同步进现网 OPENAI 存储；model 同步进 chat 模型选择。
// 仅在「选中提供方」或启动时调用，避免覆盖用户在 OpenAI 设置里手动填的值。
function syncActiveProviderToLegacy() {
  var p = getActiveProvider();
  if (!p) return;
  try {
    if (p.key) localStorage.setItem(OPENAI_KEY_STORAGE, p.key);
    if (p.base) localStorage.setItem(OPENAI_BASE_STORAGE, p.base);
    // 只有当前模型不属于该提供方时，才切换到该提供方的默认/首个模型。
    // 这样切换提供方时不会把用户刚选中的模型立刻覆盖回去。
    var current = String(aiCurrentModel || '').trim();
    var models = getAllProviderModels(p);
    var nextModel = p.model || (models.length ? models[0] : '');
    if (nextModel && models.indexOf(current) === -1) setGlobalModel(nextModel, null);
  } catch (_) {}
}

function syncProxyConfigToRuntime() {
  try {
    var base = localStorage.getItem(PROXY_BASE_STORAGE) || '';
    var token = localStorage.getItem(PROXY_TOKEN_STORAGE) || '';
    var proxy = window.FlowCraft && window.FlowCraft.proxy;
    if (proxy && typeof proxy.configure === 'function') {
      proxy.configure({ base: base, token: token });
      if (window.FlowCraft) window.FlowCraft.__userToken = token;
    }
    if (window.FlowCraft) {
      window.FlowCraft.__fcProxyConfigured = !!base;
    }
    return !!base;
  } catch (_) {
    return false;
  }
}
function syncProviderSectionToggle() {
  if (!providerSectionToggle || !providerSection) return;
  var collapsed = providerSection.classList.contains('collapsed');
  providerSectionToggle.textContent = collapsed ? '展开' : '收起';
  providerSectionToggle.setAttribute('aria-expanded', String(!collapsed));
}
function setProviderSectionCollapsed(collapsed) {
  if (!providerSection) return;
  providerSection.classList.toggle('collapsed', !!collapsed);
  try { localStorage.setItem('flowcraft-provider-section-collapsed', collapsed ? '1' : '0'); } catch (_) {}
  syncProviderSectionToggle();
}
function restoreProviderSectionCollapsed() {
  if (!providerSection) return;
  var v = '0';
  try { v = localStorage.getItem('flowcraft-provider-section-collapsed') || '0'; } catch (_) {}
  setProviderSectionCollapsed(v === '1');
}
function syncProxySectionToggle() {
  if (!proxySectionToggle || !proxySection) return;
  var collapsed = proxySection.classList.contains('collapsed');
  proxySectionToggle.textContent = collapsed ? '展开' : '收起';
  proxySectionToggle.setAttribute('aria-expanded', String(!collapsed));
}
function setProxySectionCollapsed(collapsed) {
  if (!proxySection) return;
  proxySection.classList.toggle('collapsed', !!collapsed);
  try { localStorage.setItem('flowcraft-proxy-section-collapsed', collapsed ? '1' : '0'); } catch (_) {}
  syncProxySectionToggle();
}
function restoreProxySectionCollapsed() {
  if (!proxySection) return;
  var v = '0';
  try { v = localStorage.getItem('flowcraft-proxy-section-collapsed') || '0'; } catch (_) {}
  setProxySectionCollapsed(v === '1');
}
var SYSTEM_PROMPT = '你是 FlowCraft 的 AI 设计助手，专注于室内设计、参考图构思、线稿、材质、灯光与布局方案。' +
  '请用简洁、专业、可操作的中文回答，必要时给出步骤清单或要点。不要编造不确定的事实。';
var AI_MODEL_NAMES = {
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-image-2': 'GPT Image 2',
  'deepseek-v4-flash': 'DeepSeek V4 Flash'
};
function normalizeAiImageModelName(model) {
  var v = String(model || '').trim();
  if (v === 'gpt-image-2' || v === 'GPT Image 2') return 'GPT Image 2';
  return v;
}
function aiModelLabelForSelect(model) {
  return AI_MODEL_NAMES[model] || model;
}
function ensureAiModelOption(select, model) {
  if (!select || !model) return;
  var value = String(model).trim();
  if (!value) return;
  var exists = false;
  Array.prototype.forEach.call(select.options || [], function(opt) {
    if (opt && opt.value === value) exists = true;
  });
  if (exists) return;
  var o = document.createElement('option');
  o.value = value;
  o.textContent = aiModelLabelForSelect(value);
  o.title = aiModelLabelForSelect(value);
  select.appendChild(o);
}
function getSelectableAiModels() {
  var list = [];
  var seen = {};
  AI_MODELS.forEach(function(m) {
    if (!m || seen[m.value]) return;
    seen[m.value] = 1;
    list.push(m);
  });
  (getProviders() || []).forEach(function(p) {
    getAllProviderModels(p).forEach(function(id) {
      if (!id || seen[id]) return;
      seen[id] = 1;
      list.push({ value: id, label: aiModelLabelForSelect(id), shortLabel: aiModelLabelForSelect(id) });
    });
  });
  return list;
}
function renderAiModelSelectOptions(select, selectedModel) {
  if (!select) return;
  var keep = selectedModel != null ? String(selectedModel) : String(select.value || '');
  var list = getSelectableAiModels();
  select.innerHTML = '';
  list.forEach(function(m) {
    var o = document.createElement('option');
    o.value = m.value;
    o.textContent = m.shortLabel || m.label || m.value;
    o.title = m.label || m.value;
    select.appendChild(o);
  });
  if (keep) {
    ensureAiModelOption(select, keep);
    select.value = keep;
  }
}
function syncProviderModelsToAiSelects() {
  renderAiModelSelectOptions(aiModelSelect, aiModelSelect && aiModelSelect.value);
  document.querySelectorAll('.text-node-model').forEach(function(sel) {
    renderAiModelSelectOptions(sel, sel && sel.value);
  });
}
function getProviderForModelId(model, preferredProviderId) {
  var id = String(model || '').trim();
  if (!id) return null;
  var list = getProviders() || [];
  var i;
  if (preferredProviderId) {
    for (i = 0; i < list.length; i++) {
      var pref = list[i];
      if (!pref || pref.id !== preferredProviderId) continue;
      if (getAllProviderModels(pref).indexOf(id) >= 0) return pref;
      break;
    }
  }
  for (i = 0; i < list.length; i++) {
    var p = list[i];
    if (!p) continue;
    if (getAllProviderModels(p).indexOf(id) >= 0) return p;
  }
  return null;
}
function syncProviderContextByModel(model) {
  var p = getProviderForModelId(model, getActiveProviderId());
  if (!p) return false;
  try {
    if (p.id) localStorage.setItem(ACTIVE_PROVIDER_STORAGE, p.id);
    if (p.key) {
      var vendor = resolveProviderVendor(p, model);
      if (vendor === 'deepseek' || /(^|[\s\/-])deepseek/i.test(String(model || ''))) localStorage.setItem(DEEPSEEK_KEY_STORAGE, p.key);
      else localStorage.setItem(OPENAI_KEY_STORAGE, p.key);
    }
    if (p.base) localStorage.setItem(OPENAI_BASE_STORAGE, p.base);
  } catch (_) {}
  return true;
}
function resolveProviderIdForModel(model) {
  var p = getProviderForModelId(model, getActiveProviderId());
  return p && p.id ? p.id : 'openai';
}
function resolveProviderVendor(provider, model) {
  var explicit = provider && (provider.vendor || provider.providerType || provider.type);
  if (explicit) return String(explicit).trim().toLowerCase();
  var text = [provider && provider.id, provider && provider.name, provider && provider.base, provider && provider.model, model].filter(Boolean).join(' ').toLowerCase();
  if (/deepseek/.test(text)) return 'deepseek';
  if (/claude|anthropic/.test(text)) return 'anthropic';
  if (/gemini|google/.test(text)) return 'google';
  if (/grok|xai/.test(text)) return 'xai';
  return 'openai';
}
function updateModelBindingStatus() {
  var el = document.getElementById('aiModelBindingStatus');
  if (!el) return;
  var provider = getProviderForModelId(aiCurrentModel, getActiveProviderId());
  if (!provider) {
    el.textContent = '当前模型：' + (AI_MODEL_NAMES[aiCurrentModel] || aiCurrentModel || '未选择') + '；未找到匹配的提供方。';
    el.className = 'ai-settings-status warn';
    return;
  }
  var base = provider.base || '（未设置 base）';
  var hasKey = !!provider.key;
  el.textContent = '当前模型：' + (AI_MODEL_NAMES[aiCurrentModel] || aiCurrentModel || '未选择') + '；绑定提供方：' + (provider.name || provider.id) + '；base：' + base + '；Key：' + (hasKey ? '已配置' : '未配置');
  el.className = 'ai-settings-status ' + (provider.base && hasKey ? 'ok' : 'warn');
}
// 模型列表（由 AI_MODEL_NAMES 生成，保证与下拉框一致）
// shortLabel 用于文本节点等紧凑场景；label 走 AI_MODEL_NAMES 全称
var AI_MODELS = Object.keys(AI_MODEL_NAMES).map(function(k) {
  var shorts = {
    'gpt-5.4': 'GPT-5.4', 'gpt-5.4-mini': 'GPT-5.4 Mini',
    'claude-sonnet-4-6': 'Sonnet 4.6', 'gemini-3-flash-preview': 'G3 Flash',
    'gpt-image-2': 'GPT-Img2', 'deepseek-v4-flash': 'DS V4 Flash'
  };
  return { value: k, label: AI_MODEL_NAMES[k], shortLabel: shorts[k] || AI_MODEL_NAMES[k] };
});

// --- 全局模型 / API Key 同步（文本输入节点 ⇄ AI 设计助手） ---
// 修改任意一处，另一处自动同步更新
function setGlobalModel(model, sourceEl) {
  aiCurrentModel = model;
  ensureAiModelOption(aiModelSelect, model);
  syncProviderContextByModel(model);
  if (aiModelSelect && aiModelSelect.value !== model) aiModelSelect.value = model;
  if (typeof updateAISettingsUI === 'function') updateAISettingsUI();
  updateModelBindingStatus();
  // 同步所有文本输入节点上的模型下拉
  document.querySelectorAll('.text-node-model').forEach(function(sel) {
    ensureAiModelOption(sel, model);
    if (sel !== sourceEl && sel.value !== model) sel.value = model;
  });
}

// 将 localStorage 中的 Key 同步到所有文本节点输入框
function syncApiKeyInputs() {
  var key = localStorage.getItem(DEEPSEEK_KEY_STORAGE) || '';
  document.querySelectorAll('.text-node-keyinput').forEach(function(inp) { inp.value = key; });
}

// 展开 / 收起文本节点上的 Key 输入行
function toggleTextNodeKeyRow(keyRow) {
  var show = keyRow.style.display === 'none';
  keyRow.style.display = show ? 'flex' : 'none';
  if (show) {
    var inp = keyRow.querySelector('.text-node-keyinput');
    if (inp) inp.focus();
  }
}

// 复制到剪贴板（带降级方案）
function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) { return false; }
}

// 复制单条 AI 回复（优先 .ai-reply-text，否则取整段文本）
function copyAIMessage(bubble) {
  var reply = bubble.querySelector('.ai-reply-text');
  var text = (reply ? reply.innerText : bubble.innerText) || '';
  text = text.replace(/正在生成[\s\S]*/, '').trim();
  if (!text) { showToast('没有可复制的内容', 'warn'); return; }
  if (copyTextToClipboard(text)) showToast('已复制到剪贴板', 'success');
  else showToast('复制失败，请手动选择', 'warn');
}

// 将 AI 回复提示词直接填入文本输入节点（复用优先：选中→首个→新建）
function addAIReplyToTextNode(bubble) {
  var reply = bubble.querySelector('.ai-reply-text');
  var text = (reply ? reply.innerText : bubble.innerText) || '';
  text = text.replace(/正在生成[\s\S]*/, '').trim();
  if (!text) { showToast('没有可添加的提示词', 'warn'); return; }

  var target = null;
  // 1. 优先当前选中的文本节点
  if (workflow.selection && workflow.selection.size) {
    workflow.selection.forEach(function(id) {
      var n = workflow.nodes.get(id);
      if (!target && n && n.type === 'text') target = n;
    });
  }
  // 2. 否则取画布上第一个文本节点
  if (!target) {
    workflow.nodes.forEach(function(n) { if (!target && n.type === 'text') target = n; });
  }
  // 3. 仍没有则新建一个文本输入节点
  if (!target) {
    target = addNode('text', 200, 160);
  }

  target.prompt = (target.prompt ? target.prompt + '\n' : '') + text;
  if (target.el) {
    var ta = target.el.querySelector('.node-textarea');
    if (ta) ta.value = target.prompt;
  }
  scheduleAutosave();
  selectNode(target);
  showToast('已填入文本节点', 'success');
}

// 文本节点「增强提示词」：调公共 runPromptEnhance，结果直接写回文本框
// 行为与 AI 设计助手 ✨ 提示词扩写完全一致（对齐 WorkBuddy 输入框「增强提示词」）
function enhanceTextNodePrompt(node, textBody) {
  var ta = textBody.querySelector('.node-main-textarea');
  var btn = textBody.querySelector('.text-node-enhance');
  var text = (node.prompt || '').trim();
  if (!text) { showToast('请先输入要增强的提示词', 'warn'); return; }

  var apiKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE);
  if (!apiKey) { showToast('请先点 🔑 配置 Deepseek API Key', 'warn'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  runPromptEnhance(text, { apiKey: apiKey, useLibrary: true })
    .then(function(reply) {
      if (reply) {
        node.prompt = reply;
        if (ta) ta.value = reply;
        scheduleAutosave();
        showToast('提示词已增强', 'success');
      } else {
        showToast('增强结果为空', 'warn');
      }
    })
    .catch(function(err) {
      showToast('增强失败：' + err.message, 'danger');
    })
    .finally(function() {
      if (btn) { btn.disabled = false; btn.textContent = '✨'; }
    });
}

// --- DOM 引用 ---
var aiPanel       = document.getElementById('aiPanel');
var aiChat        = document.getElementById('aiChat');
var aiInput       = document.getElementById('aiInput');
var aiSendBtn     = document.getElementById('aiSendBtn');
var aiResizer     = document.getElementById('aiPanelResizer');
var aiCollapseBtn = document.getElementById('aiCollapseBtn');
var aiClearBtn    = document.getElementById('aiClearBtn');
var aiToggleBtn   = document.getElementById('aiToggleBtn');
var aiModelSelect = document.getElementById('aiModelSelect');
var aiQuickChips  = document.getElementById('aiQuickChips');

// --- 1. 面板折叠/展开 ---
function toggleAIPanel(forceCollapse) {
  if (forceCollapse === undefined) {
    aiPanel.classList.toggle('collapsed');
  } else if (forceCollapse) {
    aiPanel.classList.add('collapsed');
  } else {
    aiPanel.classList.remove('collapsed');
  }
  var isOpen = !aiPanel.classList.contains('collapsed');
  aiToggleBtn.classList.toggle('active', isOpen);
  // 互斥：打开 AI 面板时收起 Agent 抽屉（两者都贴在右侧，避免重叠）
  if (isOpen) {
    const ad = document.getElementById('agentDrawer');
    if (ad && !ad.hidden) ad.hidden = true;
  }
  // 记忆开关状态
  try { localStorage.setItem('flowcraft-ai-panel', isOpen ? 'open' : 'collapsed'); } catch (_) {}
  // 悬浮面板不影响画布尺寸，无需重绘
}

aiCollapseBtn.addEventListener('click', function() { toggleAIPanel(true); });
aiToggleBtn.addEventListener('click',  function() { toggleAIPanel(); });

// --- 2. 拖拽移动（通过 header） ---
var aiDragging = false;
var aiDragOffsetX = 0;
var aiDragOffsetY = 0;
var aiHeader = document.querySelector('.ai-panel-header');

aiHeader.addEventListener('mousedown', function(e) {
  // 不拦截按钮和下拉框的点击
  if (e.target.closest('.ai-btn') || e.target.closest('.ai-model-select')) return;
  e.preventDefault();
  aiDragging = true;
  aiHeader.classList.add('dragging');
  aiPanel.style.transition = 'none';
  var rect = aiPanel.getBoundingClientRect();
  aiDragOffsetX = e.clientX - rect.left;
  aiDragOffsetY = e.clientY - rect.top;
  document.body.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
});

// --- 3. 右下角拖拽调宽高 ---
var aiResizing = false;
var aiResizeStartX = 0;
var aiResizeStartY = 0;
var aiResizeStartW = 0;
var aiResizeStartH = 0;

aiResizer.addEventListener('mousedown', function(e) {
  e.preventDefault();
  e.stopPropagation();
  aiResizing = true;
  aiResizer.classList.add('dragging');
  aiPanel.style.transition = 'none';
  aiResizeStartX = e.clientX;
  aiResizeStartY = e.clientY;
  aiResizeStartW = aiPanel.offsetWidth;
  aiResizeStartH = aiPanel.offsetHeight;
  document.body.style.cursor = 'nwse-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', function(e) {
  if (aiDragging) {
    e.preventDefault();
    var newLeft = e.clientX - aiDragOffsetX;
    var newTop = e.clientY - aiDragOffsetY;
    // 边界约束：不能拖出视口
    var maxLeft = window.innerWidth - 120;  // 至少留 120px 可见
    var maxTop = window.innerHeight - 60;
    newLeft = Math.max(-aiPanel.offsetWidth + 120, Math.min(maxLeft, newLeft));
    newTop = Math.max(0, Math.min(maxTop, newTop));
    aiPanel.style.left = newLeft + 'px';
    aiPanel.style.top = newTop + 'px';
    aiPanel.style.right = 'auto'; // 解除 right 定位，改用 left
  }
  if (aiResizing) {
    e.preventDefault();
    var dx = e.clientX - aiResizeStartX;
    var dy = e.clientY - aiResizeStartY;
    var newW = Math.max(300, Math.min(680, aiResizeStartW + dx));
    var newH = Math.max(360, Math.min(window.innerHeight - 40, aiResizeStartH + dy));
    aiPanel.style.width = newW + 'px';
    aiPanel.style.height = newH + 'px';
  }
});

document.addEventListener('mouseup', function() {
  if (aiDragging) {
    aiDragging = false;
    aiHeader.classList.remove('dragging');
    aiPanel.style.transition = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  if (aiResizing) {
    aiResizing = false;
    aiResizer.classList.remove('dragging');
    aiPanel.style.transition = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

// --- 3. 消息列表辅助 ---
function scrollAIToBottom() {
  aiChat.scrollTop = aiChat.scrollHeight;
}

function removeAIWelcome() {
  var welcome = aiChat.querySelector('.ai-welcome');
  if (welcome) welcome.remove();
}

function deriveAIPlainText(html) {
  var div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
}

// AI 对话历史只保留「可读文本 + 轻量 HTML」，避免把生成图片的 dataURL 一起写入 localStorage。
// 这样既能保留聊天上下文，又不会因为图片太大导致对话无法持久化。
function sanitizeAIChatHTMLForHistory(html) {
  var raw = String(html || '');
  if (!raw) return '';
  if (!/<img\b/i.test(raw) && raw.indexOf('data:image') < 0 && raw.indexOf('blob:') < 0) return raw;
  var div = document.createElement('div');
  div.innerHTML = raw;
  var gen = div.querySelector('.ai-gen-images');
  if (gen) {
    var genCount = gen.querySelectorAll('img').length;
    if (genCount > 0) {
      var stub = document.createElement('div');
      stub.className = 'ai-gen-images ai-gen-images-history';
      stub.innerHTML = '<div class="ai-gen-image-placeholder">已生成 ' + genCount + ' 张图片（历史记录未保存图片本体）</div>';
      gen.replaceWith(stub);
    }
  }
  div.querySelectorAll('img').forEach(function(img) {
    var alt = img.getAttribute('alt') || '图片';
    var span = document.createElement('span');
    span.className = 'ai-image-placeholder';
    span.textContent = '［' + alt + '］';
    img.replaceWith(span);
  });
  return div.innerHTML;
}

function collectAIChatState() {
  var messages = [];
  var conversation = [];
  aiChat.querySelectorAll('.ai-message').forEach(function(msg) {
    if (msg.dataset && msg.dataset.transient === '1') return;
    var role = msg.classList.contains('user') ? 'user' : 'ai';
    var bubble = msg.querySelector('.ai-bubble');
    var html = bubble ? sanitizeAIChatHTMLForHistory(bubble.innerHTML) : '';
    var text = bubble ? ((bubble.dataset && bubble.dataset.plainText) || deriveAIPlainText(html)) : '';
    messages.push({ role: role, html: html, text: text });
    if (text) conversation.push({ role: role, content: text });
  });
  return { messages: messages, conversation: conversation };
}

function persistAIChatHistory() {
  try {
    if (!aiChat) return;
    var state = collectAIChatState();
    if (!state.messages.length) {
      localStorage.removeItem(AI_CHAT_HISTORY_STORAGE);
      try { sessionStorage.removeItem(AI_CHAT_HISTORY_SESSION_STORAGE); } catch (_) {}
      return;
    }
    state.savedAt = Date.now();
    state.storageVersion = 2;
    var raw = JSON.stringify(state);
    try {
      localStorage.setItem(AI_CHAT_HISTORY_STORAGE, raw);
    } catch (err) {
      var trimmed = {
        messages: state.messages.slice(-Math.min(AI_CHAT_HISTORY_MAX, 24)),
        conversation: state.conversation.slice(-Math.min(AI_CHAT_HISTORY_MAX, 24))
      };
      trimmed.savedAt = state.savedAt;
      trimmed.storageVersion = 2;
      raw = JSON.stringify(trimmed);
      try { localStorage.setItem(AI_CHAT_HISTORY_STORAGE, raw); } catch (_) {}
      try { sessionStorage.setItem(AI_CHAT_HISTORY_SESSION_STORAGE, raw); } catch (_) {}
    }
    try { sessionStorage.setItem(AI_CHAT_HISTORY_SESSION_STORAGE, raw); } catch (_) {}
  } catch (_) {}
}

function pushAIConversation(role, content) {
  aiConversation.push({ role: role, content: content });
  persistAIChatHistory();
}

function restoreAIChatHistory() {
  try {
    var raw = null;
    var state = null;
    var backup = null;
    try { raw = localStorage.getItem(AI_CHAT_HISTORY_STORAGE); } catch (_) {}
    if (raw) {
      try { state = JSON.parse(raw); } catch (_) { state = null; }
    }
    if (!state) {
      try { raw = sessionStorage.getItem(AI_CHAT_HISTORY_SESSION_STORAGE); } catch (_) {}
      if (raw) {
        try { state = JSON.parse(raw); } catch (_) { state = null; }
      }
    }
    try {
      var rawBackup = sessionStorage.getItem(AI_CHAT_HISTORY_SESSION_STORAGE);
      if (rawBackup) backup = JSON.parse(rawBackup);
    } catch (_) {}
    if (backup && (!state || (backup.savedAt || 0) > (state.savedAt || 0))) state = backup;
    if (!state) return false;
    if (!state || !Array.isArray(state.messages) || !state.messages.length) return false;
    aiChat.innerHTML = '';
    aiChatRestoring = true;
    aiConversation = Array.isArray(state.conversation) ? state.conversation.slice(0) : [];
    state.messages.slice(-AI_CHAT_HISTORY_MAX).forEach(function(m) {
      appendAIMessage(m.role === 'user' ? 'user' : 'ai', sanitizeAIChatHTMLForHistory(m.html || ''), { plainText: m.text || '', skipPersist: true });
    });
    aiChatRestoring = false;
    aiToggleBtn.classList.add('has-messages');
    persistAIChatHistory();
    return true;
  } catch (_) {
    aiChatRestoring = false;
    return false;
  }
}

/**
 * 追加一条 AI 对话消息。
 * @param {string} role - 'user' | 'ai'
 * @param {string} contentHTML - 气泡内 HTML
 * @returns {HTMLElement} 返回 bubble 元素，便于后续替换内容
 */
function setAIBubbleHTML(bubble, contentHTML, plainText) {
  if (!bubble) return;
  bubble.innerHTML = contentHTML;
  bubble.dataset.plainText = typeof plainText === 'string' ? plainText : deriveAIPlainText(contentHTML);
  bubble.parentElement && bubble.parentElement.parentElement && bubble.parentElement.parentElement.dataset && delete bubble.parentElement.parentElement.dataset.transient;
  persistAIChatHistory();
}

function appendAIMessage(role, contentHTML, opts) {
  opts = opts || {};
  removeAIWelcome();

  var msg = document.createElement('div');
  msg.className = 'ai-message ' + role;

  var avatar = document.createElement('div');
  avatar.className = 'ai-avatar';
  avatar.textContent = role === 'user' ? '我' : 'AI';

  var bubble = document.createElement('div');
  bubble.className = 'ai-bubble';
  bubble.innerHTML = contentHTML;
  bubble.dataset.plainText = typeof opts.plainText === 'string' ? opts.plainText : deriveAIPlainText(contentHTML);
  if (opts.transient || /ai-thinking/.test(contentHTML || '')) msg.dataset.transient = '1';

  var content = document.createElement('div');
  content.className = 'ai-content';
  content.appendChild(bubble);

  if (role === 'ai') {
    // AI 回复操作条：复制 / 填入文本节点
    var actions = document.createElement('div');
    actions.className = 'ai-msg-actions';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'ai-act-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = '📋 复制';
    copyBtn.onclick = function() { copyAIMessage(bubble); };

    var addBtn = document.createElement('button');
    addBtn.className = 'ai-act-btn';
    addBtn.type = 'button';
    addBtn.textContent = '➕ 填入文本节点';
    addBtn.onclick = function() { addAIReplyToTextNode(bubble); };

    actions.appendChild(copyBtn);
    actions.appendChild(addBtn);
    content.appendChild(actions);
  }

  msg.appendChild(avatar);
  msg.appendChild(content);
  aiChat.appendChild(msg);
  scrollAIToBottom();

  aiToggleBtn.classList.add('has-messages');
  if (!opts.skipPersist && !aiChatRestoring) persistAIChatHistory();
  return bubble;
}

// --- 4. mock 生成结果 ---
function generateMockResponse(userText) {
  // 生成 2~4 张占位图
  var imgCount = 2 + Math.floor(Math.random() * 3);
  var images = [];
  for (var i = 0; i < imgCount; i++) {
    var seed = (Date.now() % 10000) + i * 137 + 200;
    images.push(createPlaceholderDataURL(200, 200, seed, '方案' + (i + 1)));
  }

  // 回复文本（含用户关键词）
  var keyword = userText.length > 24 ? userText.substring(0, 24) + '…' : userText;
  var replyText = '已根据您的需求「' + keyword + '」生成以下方案，请查看：';

  var html = escapeHtml(replyText);
  html += '<div class="ai-gen-images">';
  for (var j = 0; j < images.length; j++) {
    html += '<img src="' + images[j] + '" alt="生成结果 ' + (j + 1) + '">';
  }
  html += '</div>';
  return html;
}

// --- 提示词库上下文构造（runPromptEnhance 调用） ---
function buildPromptLibraryContext(userText) {
  var kw = userText.toLowerCase().trim();
  var cats = Object.keys(PROMPT_LIBRARY);
  var lines = [];
  // 常用类始终作为画质/镜头参考
  lines.push('常用：' + PROMPT_LIBRARY['常用'].join('、'));
  cats.forEach(function(c) {
    if (c === '常用') return;
    var matched = PROMPT_LIBRARY[c].filter(function(w) {
      var wl = w.toLowerCase();
      return kw.indexOf(wl) >= 0 || wl.indexOf(kw) >= 0;
    });
    if (matched.length) {
      lines.push(c + '：' + matched.slice(0, 40).join('、'));
    }
  });
  return lines.join('\n');
}

// 通用提示词扩写系统提示（与 WorkBuddy 输入框「增强提示词」输出口径一致：
// 不绑定特定垂直领域，只把用户表述扩写得清晰、专业、可直接使用）
var GENERIC_PROMPT_EXPAND_SYSTEM = '你是一位专业的提示词工程专家。请严格遵循以下规则：\n' +
  '1. 接收用户的简短表述后，扩写为更清晰、更具体、更专业、可直接使用的提示词。\n' +
  '2. 补充必要的维度细节（如对象、风格、场景、约束条件等），但保留用户原意，不要凭空编造。\n' +
  '3. 只输出扩写后的提示词文本，不要解释、不要加标题、不要 Markdown 代码块。';

// 公共提示词扩写入口：画布文本节点 与 AI 设计助手 ✨ 提示词扩写 共用此函数，
// 保证两条路径行为完全一致（与 WorkBuddy 输入框「增强提示词」对齐）。
// opts = { apiKey, useLibrary }
//   apiKey: Deepseek API Key
//   useLibrary: 是否把本地提示词库作为参考上下文注入（默认 true）
// 返回 Promise<string>，resolve 为扩写后的文本，reject 带 Error
function runPromptEnhance(text, opts) {
  return new Promise(function(resolve, reject) {
    var t = (text || '').trim();
    if (!t) { reject(new Error('请先输入要增强的提示词')); return; }
    opts = opts || {};
    var apiKey = opts.apiKey || '';
    if (!apiKey && !_fcProxy()) { reject(new Error('请先配置 Deepseek API Key')); return; }

    var sys = GENERIC_PROMPT_EXPAND_SYSTEM;
    if (opts.useLibrary !== false) {
      var ctx = buildPromptLibraryContext(t);
      if (ctx) sys += '\n\n参考词库（请优先从以下相关词条中挑选组合）：\n' + ctx;
    }

    var messages = [
      { role: 'system', content: sys },
      { role: 'user', content: '请扩写以下提示词，只输出扩写后的提示词文本：\n' + t }
    ];

    streamDeepseek(apiKey, messages, function(text) {
      if (opts.onToken) { try { opts.onToken(text); } catch (_) {} }
    })
    .then(function(reply) {
      reply = (reply || '').replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
      resolve(reply);
    })
    .catch(reject);
  });
}

function expandPromptWithAI() {
  var userText = aiInput.value.trim();
  if (!userText) {
    showToast('请先输入要扩写的简短提示词', 'warn');
    return;
  }
  if (aiIsGenerating) return;

  // 追加用户意图到聊天区（但不污染设计助手上下文）
  appendAIMessage('user', escapeHtml('扩写提示词：' + userText));
  aiInput.value = '';
  aiInput.style.height = 'auto';

  aiIsGenerating = true;
  aiSendBtn.disabled = true;

  var loadingHTML = '<div class="ai-thinking"><span>正在生成</span>' +
    '<div class="ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  var bubble = appendAIMessage('ai', loadingHTML, { transient: true });

  // 提示词扩写始终走 Deepseek 真实模型，与画布文本节点共用 runPromptEnhance
  var apiKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE);
  if (!apiKey && !_fcProxy()) {
    setAIBubbleHTML(bubble, '<div class="ai-reply-text">提示词扩写需要 Deepseek API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，配置后即可一键扩写。</div>', '提示词扩写需要 Deepseek API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，配置后即可一键扩写。');
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    return;
  }

  runPromptEnhance(userText, {
    apiKey: apiKey,
    useLibrary: true,
    onToken: function(t) {
      if (t) {
        setAIBubbleHTML(bubble, '<div class="ai-reply-text">' + escapeHtml(t).replace(/\n/g, '<br>') + '</div>', t);
        scrollAIToBottom();
      }
    }
  })
    .then(function(reply) {
      if (reply) {
        setAIBubbleHTML(bubble, '<div class="ai-reply-text">' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div>', reply);
      } else {
        setAIBubbleHTML(bubble, '<div class="ai-reply-text">扩写结果为空</div>', '扩写结果为空');
      }
      scrollAIToBottom();
    })
    .catch(function(err) {
      setAIBubbleHTML(bubble, '<div class="ai-reply-text" style="color:#E15353">扩写失败：' + escapeHtml(err.message) +
        '<br>请检查 API Key 是否正确、网络是否可访问 api.deepseek.com。</div>', '扩写失败：' + (err && err.message || err) + '；请检查 API Key 是否正确、网络是否可访问 api.deepseek.com。');
      scrollAIToBottom();
    })
    .finally(function() {
      aiIsGenerating = false;
      aiSendBtn.disabled = false;
    });
}

// --- 5. 发送消息 ---
function sendAIMessage() {
  var text = aiInput.value.trim();
  if (!text || aiIsGenerating) return;

  var explicitProvider = getProviderForModelId(aiCurrentModel, getActiveProviderId());
  var explicitModelSelected = !!explicitProvider;

  // 追加 user 消息
  appendAIMessage('user', escapeHtml(text));

  // 清空输入框 & 重置高度
  aiInput.value = '';
  aiInput.style.height = 'auto';

  // 禁用发送
  aiIsGenerating = true;
  aiSendBtn.disabled = true;

  // 追加 AI "生成中" 消息
  var loadingHTML = '<div class="ai-thinking"><span>正在生成</span>' +
    '<div class="ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  var bubble = appendAIMessage('ai', loadingHTML, { transient: true });

  // 阶段 9：智能路由（opt-in，默认关闭）。启用时文本走路由选定模型，覆盖 aiCurrentModel 选择（含 Deepseek 分支）。
  var _rt = (!explicitModelSelected) ? _routeModel('text') : null;
  if (_rt) {
    pushAIConversation('user', text);
    callRelayChat(_rt.model, bubble, _rt.provider);
    return;
  }

  // GPT Image 2 真实图像生成分支（阶段 9：路由启用时改用路由选中的图片模型）
  if (aiCurrentModel === 'gpt-image-2') {
    var _rImg = _routeModel('image');
    pushAIConversation('user', text);
    generateChatImage(text, bubble, _rImg ? _rImg.model : null, _rImg ? _rImg.provider : null);
    return;
  }

  // Deepseek 真实调用分支
  if (aiCurrentModel === 'deepseek-v4-flash') {
    var apiKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE);
    var _proxyOn = !!_fcProxy();
    if (!apiKey && !_proxyOn) {
      setAIBubbleHTML(bubble, '<div class="ai-reply-text">尚未配置 Deepseek API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，配置后即可使用 DeepSeek V4 Flash 真实回复。</div>', '尚未配置 Deepseek API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，配置后即可使用 DeepSeek V4 Flash 真实回复。');
      scrollAIToBottom();
      aiIsGenerating = false;
      aiSendBtn.disabled = false;
      return;
    }
    pushAIConversation('user', text);
    callDeepseek(apiKey, bubble);
    return;
  }

  // 其他模型：经中转真实对话（OpenAI 格式 chat/completions）
  pushAIConversation('user', text);
  callRelayChat(aiCurrentModel, bubble, resolveProviderIdForModel(aiCurrentModel));
}


// GPT Image 2 聊天图像生成（AI 助手对话内直接出图）
// 阶段 9：modelOverride/provider 支持路由选中的图片模型（默认 gpt-image-2，行为等价）
function generateChatImage(text, bubble, modelOverride, provider) {
  var providerEntry = getProviderForModelId(modelOverride || 'gpt-image-2', provider || getActiveProviderId());
  var _modelId = 'openai/' + (modelOverride || 'gpt-image-2');
  var _t0 = Date.now();
  var key = (providerEntry && providerEntry.key) || localStorage.getItem(OPENAI_KEY_STORAGE);
  if (!key) {
    setAIBubbleHTML(bubble, '<div class="ai-reply-text">尚未配置 OpenAI API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，即可使用 GPT Image 2 生成图片。</div>', '尚未配置 OpenAI API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，即可使用 GPT Image 2 生成图片。');
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _modelId, ok: false, ms: Date.now() - _t0 });
    return;
  }
  var base = normalizeApiBase((providerEntry && providerEntry.base) || localStorage.getItem(OPENAI_BASE_STORAGE));
  var prompt = text.trim();
  if (!prompt) {
    setAIBubbleHTML(bubble, '<div class="ai-reply-text">请输入要生成的画面描述。</div>', '请输入要生成的画面描述。');
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    return;
  }
  var _cands = modelOverride ? [modelOverride].concat(OPENAI_IMAGE_MODELS) : OPENAI_IMAGE_MODELS;
  openAIImageWithFallback(base, key, prompt, 2, undefined, _cands)
  .then(function(imgs) {
    if (!imgs || !imgs.length) throw new Error('未获取到图片');
    var html = imgs.map(function(src) {
      return '<img src="' + src + '" alt="生成结果">';
    }).join('');
    setAIBubbleHTML(bubble, '<div class="ai-reply-text">已根据您的描述生成：</div><div class="ai-gen-images">' + html + '</div>', '已根据您的描述生成');
    pushAIConversation('assistant', '已根据您的描述生成图片');
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _modelId, ok: true, ms: Date.now() - _t0 });
  })
  .catch(function(err) {
    setAIBubbleHTML(bubble, '<div class="ai-reply-text" style="color:#E15353">图像生成失败：' + escapeHtml(describeOpenAIError(err)) +
      '（已尝试模型：' + (err.tried || _cands.join(' / ')) + '）。' +
      '<br>请检查 API Key、⚙ 中自定义 API 地址，或当前服务是否支持 gpt-image-2 / gpt-image-1 / dall-e-3。</div>', '图像生成失败：' + describeOpenAIError(err));
    if (aiConversation.length && aiConversation[aiConversation.length - 1].role === 'user') {
      aiConversation.pop();
    }
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _modelId, ok: false, ms: Date.now() - _t0 });
  });
}

// --- 中转对话（OpenAI 格式 /chat/completions，支持 GPT/Claude/Gemini/Grok 等）---
// 阶段 9：provider 参数支持多厂商路由（默认 'openai'）；成功/失败回写 ModelHealth。
function callRelayChat(model, bubble, provider) {
  var providerEntry = getProviderForModelId(model, provider || getActiveProviderId());
  var providerId = providerEntry && providerEntry.id ? providerEntry.id : (provider || resolveProviderIdForModel(model));
  var vendor = resolveProviderVendor(providerEntry, model);
  var _modelId = vendor + '/' + model;
  var _t0 = Date.now();
  var key = (providerEntry && providerEntry.key) || localStorage.getItem(OPENAI_KEY_STORAGE);
  var proxy = _fcProxy();
  if (!key && !proxy) {
    setAIBubbleHTML(bubble, '<div class="ai-reply-text">尚未配置中转 API Key。请点击面板右上角的 ⚙ 图标粘贴你的中转 Key 并保存，即可使用 ' + escapeHtml(model) + ' 真实回复。</div>', '尚未配置中转 API Key。请点击面板右上角的 ⚙ 图标粘贴你的中转 Key 并保存，即可使用 ' + model + ' 真实回复。');
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    if (aiConversation.length && aiConversation[aiConversation.length - 1].role === 'user') aiConversation.pop();
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _modelId, ok: false, ms: Date.now() - _t0 });
    return;
  }
  var base = normalizeApiBase((providerEntry && providerEntry.base) || localStorage.getItem(OPENAI_BASE_STORAGE));
  var messages = [{ role: 'system', content: SYSTEM_PROMPT }].concat(aiConversation);
  var relayReq;
  if (proxy) {
    relayReq = proxy.call({ provider: vendor, endpoint: '/chat/completions', body: { model: model, messages: messages, stream: false }, token: window.FlowCraft.__userToken || undefined })
      .catch(function(err) { if (err && err.kind) { var m = new Error(err.message || 'proxy error'); m.status = err.status || 0; m.proxyKind = err.kind; throw m; } throw err; });
  } else {
    relayReq = fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: model, messages: messages, stream: false })
    }).then(function(resp) {
      if (!resp.ok) { return resp.text().then(function(t) { throw new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 120) : '')); }); }
      return resp.json();
    }).catch(function(err) {
      if (proxy && /Failed to fetch|NetworkError|TypeError|Load failed|CORS|cross-origin|blocked by.*policy/i.test(String(err && err.message || err))) {
        return proxy.call({ provider: vendor, endpoint: '/chat/completions', body: { model: model, messages: messages, stream: false }, token: window.FlowCraft.__userToken || undefined })
          .catch(function(err2) { if (err2 && err2.kind) { var m2 = new Error(err2.message || 'proxy error'); m2.status = err2.status || 0; m2.proxyKind = err2.kind; throw m2; } throw err2; });
      }
      throw err;
    });
  }
  relayReq
  .then(function(data) {
    var reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '（' + model + ' 返回内容为空）';
    pushAIConversation('assistant', reply);
    setAIBubbleHTML(bubble, '<div class="ai-reply-text">' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div>', reply);
    scrollAIToBottom();
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _modelId, ok: true, ms: Date.now() - _t0 });
  })
  .catch(function(err) {
    setAIBubbleHTML(bubble, '<div class="ai-reply-text" style="color:#E15353">调用 ' + escapeHtml(model) + ' 失败：' + escapeHtml(err && err.message || err) +
      '<br>请检查中转 API Key、⚙ 中的 API 地址，或该模型是否可用。</div>', '调用 ' + model + ' 失败：' + (err && err.message || err) + '；请检查中转 API Key、⚙ 中的 API 地址，或该模型是否可用。');
    if (aiConversation.length && aiConversation[aiConversation.length - 1].role === 'user') aiConversation.pop();
    scrollAIToBottom();
    if (window.FlowCraft && window.FlowCraft.health) window.FlowCraft.health.record({ modelId: _modelId, ok: false, ms: Date.now() - _t0 });
  })
  .finally(function() {
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
  });
}

// --- Deepseek SSE 流式调用（逐字增量输出）---
// 返回 Promise<string>（完整文本）；onText(accumulated) 在每收到一段增量时回调，用于实时渲染。
// 阶段 4：SSE 消费（代理/直连共用）
function _consumeSSE(resp, onText) {
  if (!resp.ok) {
    return resp.text().then(function(t) {
      var e = new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 200) : ''));
      e.status = resp.status; throw e;
    });
  }
  if (!resp.body || !resp.body.getReader) {
    return resp.json().then(function(data) {
      var t = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      if (onText) onText(t);
      return t;
    });
  }
  var reader = resp.body.getReader();
  var decoder = new TextDecoder('utf-8');
  var buffer = '';
  var full = '';
  function pump() {
    return reader.read().then(function(step) {
      if (step.done) return full;
      buffer += decoder.decode(step.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop(); // 保留可能未完整的一行
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          var json = JSON.parse(payload);
          var delta = json.choices && json.choices[0] && json.choices[0].delta;
          var piece = delta && delta.content;
          if (piece) { full += piece; if (onText) onText(full); }
        } catch (e) { /* 跳过不完整的片段 */ }
      }
      return pump();
    });
  }
  return pump();
}

function streamDeepseek(apiKey, messages, onText) {
  var model = 'deepseek-v4-flash';
  var proxy = _fcProxy();
  function streamViaProxy(p) {
    return p.stream({ provider: 'deepseek', endpoint: '/chat/completions', body: { model: model, messages: messages, temperature: 0.7, stream: true }, token: window.FlowCraft.__userToken || undefined })
      .then(function(resp) { return _consumeSSE(resp, onText); })
      .catch(function(err) {
        if (err && err.kind) { var m = new Error(err.message || 'proxy error'); m.status = err.status || 0; m.proxyKind = err.kind; throw m; }
        throw err;
      });
  }
  function streamDirect() {
    return fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model, messages: messages, temperature: 0.7, stream: true })
    }).then(function(resp) { return _consumeSSE(resp, onText); });
  }
  // 直连优先策略：本地已配 Deepseek Key 时选择该模型即直连，不占用代理；
  // 仅直连出现网络层失败（无 HTTP status，如断网/DNS/被拦截）才回退代理。
  // Key 无效等 HTTP 错误（401/402）直接抛出，不回退，避免「换通道意外成功」掩盖配置问题。
  if (apiKey) {
    return streamDirect().catch(function(err) {
      if (err && err.status) throw err;
      if (proxy) return streamViaProxy(proxy);
      throw err;
    });
  }
  if (proxy) {
    return streamViaProxy(proxy);
  }
  return streamDirect().catch(function(err) {
    try { syncProxyConfigToRuntime(); } catch (_) {}
    proxy = _fcProxy();
    if (proxy) return streamViaProxy(proxy);
    throw err;
  });
}

// --- Deepseek 真实 API 调用（流式，带错误处理）---
function callDeepseek(apiKey, bubble) {
  var messages = [{ role: 'system', content: SYSTEM_PROMPT }].concat(aiConversation);
  aiIsGenerating = true;
  aiSendBtn.disabled = true;

  streamDeepseek(apiKey, messages, function(text) {
    // 实时把已生成的部分渲染到气泡，首字到达即替换「正在生成」
    if (text) {
      setAIBubbleHTML(bubble, '<div class="ai-reply-text">' + escapeHtml(text).replace(/\n/g, '<br>') + '</div>', text);
      scrollAIToBottom();
    }
  })
  .then(function(reply) {
    var finalText = reply || '（Deepseek 返回内容为空）';
    pushAIConversation('assistant', finalText);
    setAIBubbleHTML(bubble, '<div class="ai-reply-text">' + escapeHtml(finalText).replace(/\n/g, '<br>') + '</div>', finalText);
    scrollAIToBottom();
  })
  .catch(function(err) {
    var _p = _fcProxy();
    var tip = (err && err.proxyKind)
      ? '代理转发失败（代理：' + ((_p && _p.base()) || '未知') + '），请检查代理地址或在 ⚙ 中清空代理改用直连。'
      : '请检查 API Key 是否正确、网络是否可访问 api.deepseek.com。';
    setAIBubbleHTML(bubble, '<div class="ai-reply-text" style="color:#E15353">调用 Deepseek 失败：' + escapeHtml(err.message) +
      '<br>' + tip + '</div>', '调用 Deepseek 失败：' + (err && err.message || err) + '；' + tip);
    // 失败则回滚刚才压入的 user 消息，避免污染上下文
    if (aiConversation.length && aiConversation[aiConversation.length - 1].role === 'user') {
      aiConversation.pop();
    }
    scrollAIToBottom();
  })
  .finally(function() {
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
  });
}

// --- 6. 发送按钮 & 输入框事件 ---
aiSendBtn.addEventListener('click', sendAIMessage);

aiInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAIMessage();
  }
});

// textarea 自动增高
aiInput.addEventListener('input', function() {
  aiInput.style.height = 'auto';
  aiInput.style.height = Math.min(aiInput.scrollHeight, 120) + 'px';
});

// --- 7. 快捷指令 chips ---
aiQuickChips.addEventListener('click', function(e) {
  var chip = e.target.closest('.ai-quick-chip');
  if (!chip) return;
  if (chip.dataset.action === 'expand') {
    expandPromptWithAI();
    return;
  }
  aiInput.value = chip.textContent;
  aiInput.dispatchEvent(new Event('input'));
  sendAIMessage();
});

// --- 8. 模型选择（纯 UI 状态更新） ---
function updateAISettingsUI() {
  var name = AI_MODEL_NAMES[aiCurrentModel] || aiCurrentModel;
  var settingsTitle = document.getElementById('aiSettingsTitle');
  if (settingsTitle) settingsTitle.textContent = 'API Key 设置';
  if (aiSettingsBtn) {
    aiSettingsBtn.title = aiCurrentModel === 'deepseek-v4-flash' || aiCurrentModel === 'gpt-image-2'
      ? '配置 ' + name + ' API Key'
      : 'API 设置（Deepseek / OpenAI）';
  }
  updateModelBindingStatus();
}

aiModelSelect.addEventListener('change', function(e) {
  setGlobalModel(e.target.value, aiModelSelect);
});

// --- 9. Deepseek API Key 设置 ---
var aiSettingsBtn = document.getElementById('aiSettingsBtn');
var aiSettingsPanel = document.getElementById('aiSettingsPanel');
var deepseekKeyInput = document.getElementById('deepseekKeyInput');
var deepseekKeySave = document.getElementById('deepseekKeySave');
var deepseekKeyStatus = document.getElementById('deepseekKeyStatus');

aiSettingsBtn.addEventListener('click', function() {
  aiSettingsPanel.classList.toggle('open');
  if (aiSettingsPanel.classList.contains('open')) {
    deepseekKeyInput.value = localStorage.getItem(DEEPSEEK_KEY_STORAGE) || '';
    openaiKeyInput.value = localStorage.getItem(OPENAI_KEY_STORAGE) || '';
    openaiBaseInput.value = localStorage.getItem(OPENAI_BASE_STORAGE) || OPENAI_DEFAULT_BASE;
    proxyBaseInput.value = localStorage.getItem(PROXY_BASE_STORAGE) || '';
    proxyTokenInput.value = localStorage.getItem(PROXY_TOKEN_STORAGE) || '';
    syncOpenAIBasePreset();
    syncProxyConfigToRuntime();
    deepseekKeyInput.focus();
  }
});

var openaiKeyInput = document.getElementById('openaiKeyInput');
var openaiKeySave = document.getElementById('openaiKeySave');
var openaiBaseInput = document.getElementById('openaiBaseInput');
var openaiKeyStatus = document.getElementById('openaiKeyStatus');
var openaiBasePreset = document.getElementById('openaiBasePreset');
var proxySection = document.querySelector('.proxy-section');
var proxySectionToggle = document.getElementById('proxySectionToggle');
var proxyBaseInput = document.getElementById('proxyBaseInput');
var proxyTokenInput = document.getElementById('proxyTokenInput');
var proxySaveBtn = document.getElementById('proxySaveBtn');
var proxyStatus = document.getElementById('proxyStatus');

// API 地址预设：选择预设自动填入下方输入框
openaiBasePreset.addEventListener('change', function(e) {
  var v = e.target.value;
  if (v) openaiBaseInput.value = v;
});
// 反向同步：手动修改输入框时，如果匹配预设则选中对应项
openaiBaseInput.addEventListener('input', function(e) {
  var opts = Array.from(openaiBasePreset.options).map(o => o.value).filter(Boolean);
  openaiBasePreset.value = opts.indexOf(e.target.value) >= 0 ? e.target.value : '';
});

function setProxyStatus(text, kind) {
  if (!proxyStatus) return;
  proxyStatus.textContent = text;
  proxyStatus.className = 'ai-settings-status ' + (kind || 'ok');
}

if (proxySaveBtn) proxySaveBtn.addEventListener('click', function() {
  var base = (proxyBaseInput && proxyBaseInput.value || '').trim().replace(/\/+$/, '');
  var token = (proxyTokenInput && proxyTokenInput.value || '').trim();
  if (!base) {
    localStorage.removeItem(PROXY_BASE_STORAGE);
    localStorage.removeItem(PROXY_TOKEN_STORAGE);
    if (window.FlowCraft && window.FlowCraft.proxy && typeof window.FlowCraft.proxy.configure === 'function') {
      window.FlowCraft.proxy.configure({ base: '', token: '' });
    }
    if (window.FlowCraft) window.FlowCraft.__userToken = '';
    setProxyStatus('代理已关闭（将回退直连）。', 'warn');
    return;
  }
  localStorage.setItem(PROXY_BASE_STORAGE, base);
  if (token) localStorage.setItem(PROXY_TOKEN_STORAGE, token);
  else localStorage.removeItem(PROXY_TOKEN_STORAGE);
  syncProxyConfigToRuntime();
  setProxyStatus('代理已保存并启用：' + base, 'ok');
  aiSettingsPanel.classList.remove('open');
});

// 打开设置面板时同步预设下拉与当前地址
function syncOpenAIBasePreset() {
  var cur = localStorage.getItem(OPENAI_BASE_STORAGE) || OPENAI_DEFAULT_BASE;
  var opts = Array.from(openaiBasePreset.options).map(o => o.value).filter(Boolean);
  openaiBasePreset.value = opts.indexOf(cur) >= 0 ? cur : OPENAI_DEFAULT_BASE;
}

openaiKeySave.addEventListener('click', function() {
  var val = openaiKeyInput.value.trim();
  if (!val) localStorage.removeItem(OPENAI_KEY_STORAGE);
  else localStorage.setItem(OPENAI_KEY_STORAGE, val);
  var base = openaiBaseInput.value.trim().replace(/\/+$/, '');
  if (!base) base = OPENAI_DEFAULT_BASE;
  localStorage.setItem(OPENAI_BASE_STORAGE, base);
  openaiKeyStatus.textContent = val ? '已保存到本机浏览器。' : '已清除本地 Key。';
  openaiKeyStatus.className = 'ai-settings-status ok';
  aiSettingsPanel.classList.remove('open');
});

syncProxyConfigToRuntime();

deepseekKeySave.addEventListener('click', function() {
  var val = deepseekKeyInput.value.trim();
  if (!val) {
    localStorage.removeItem(DEEPSEEK_KEY_STORAGE);
    deepseekKeyStatus.textContent = '已清除本地 Key。';
    deepseekKeyStatus.className = 'ai-settings-status ok';
  } else {
    localStorage.setItem(DEEPSEEK_KEY_STORAGE, val);
    deepseekKeyStatus.textContent = '已保存到本机浏览器。';
    deepseekKeyStatus.className = 'ai-settings-status ok';
  }
  // 保存/清除后自动收起设置面板，并同步所有文本节点上的 Key 输入
  aiSettingsPanel.classList.remove('open');
  syncApiKeyInputs();
});

// 初始化时若已存 Key，切换模型到 Deepseek 可提示已配置
(function restoreDeepseekKeyUI() {
  updateAISettingsUI();
  syncApiKeyInputs();
  if (localStorage.getItem(DEEPSEEK_KEY_STORAGE)) {
    deepseekKeyStatus.textContent = '已检测到本地保存的 Key。';
    deepseekKeyStatus.className = 'ai-settings-status ok';
  }
})();

// ===== 模型提供方 UI 接线 =====
var providerSelect = document.getElementById('providerSelect');
var provNameInput = document.getElementById('provNameInput');
var provBaseInput = document.getElementById('provBaseInput');
var provKeyInput = document.getElementById('provKeyInput');
var provModelInput = document.getElementById('provModelInput');
var provAddBtn = document.getElementById('provAddBtn');
var providerList = document.getElementById('providerList');
var providerStatus = document.getElementById('providerStatus');
var providerSection = document.querySelector('.provider-section');
var providerSectionToggle = document.getElementById('providerSectionToggle');
var provFetchModelsBtn = document.getElementById('provFetchModelsBtn');
var provModelsBox = document.getElementById('provModelsBox');
var provModelsList = document.getElementById('provModelsList');
var provModelsStatus = document.getElementById('provModelsStatus');
var provModelsSelectAll = document.getElementById('provModelsSelectAll');
var provModelsClear = document.getElementById('provModelsClear');
var provDiagBox = document.getElementById('provDiagBox');       // #12 失败诊断面板
var provCheckAllBtn = document.getElementById('provCheckAllBtn'); // #12 全部校验

if (providerSectionToggle) providerSectionToggle.addEventListener('click', function() {
  setProviderSectionCollapsed(!providerSection.classList.contains('collapsed'));
});

if (proxySectionToggle) proxySectionToggle.addEventListener('click', function() {
  setProxySectionCollapsed(!proxySection.classList.contains('collapsed'));
});

restoreProviderSectionCollapsed();
restoreProxySectionCollapsed();

function renderProviderSelect() {
  if (!providerSelect) return;
  var list = getProviders() || [];
  var active = getActiveProviderId();
  providerSelect.innerHTML = '';
  var optNone = document.createElement('option');
  optNone.value = ''; optNone.textContent = '(使用下方 OpenAI / 自定义设置)';
  providerSelect.appendChild(optNone);
  list.forEach(function(p) {
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.name + ' [' + (p.vendor || 'openai') + ']' + (p.model ? ' · ' + p.model : '');
    providerSelect.appendChild(o);
  });
  providerSelect.value = active;
}

function renderProviderList() {
  if (!providerList) return;
  var list = getProviders() || [];
  providerList.innerHTML = '';
  if (!list.length) {
    providerList.innerHTML = '<div class="provider-empty">还没有提供方，用下方表单添加一个。</div>';
    return;
  }
  list.forEach(function(p) {
    var item = document.createElement('div');
    item.className = 'provider-item';
    var masked = p.key ? (p.key.slice(0, 5) + '…' + p.key.slice(-4)) : '(无 Key)';
    var head = document.createElement('div');
    head.className = 'provider-item-head';
    var nm = document.createElement('span'); nm.className = 'provider-item-name'; nm.textContent = p.name;
    var bs = document.createElement('span'); bs.className = 'provider-item-base'; bs.textContent = p.base || '';
    head.appendChild(nm); head.appendChild(bs);
    var meta = document.createElement('div');
    meta.className = 'provider-item-meta';
    var modelsInfo = (p.models && p.models.length) ? (' · 已记录 ' + p.models.length + ' 个模型') : '';
    meta.textContent = '协议 ' + (p.vendor || 'openai') + ' · 默认模型 ' + (p.model || '—') + ' · Key ' + masked + modelsInfo;
    // #12：校验状态徽标（上次结果，免重复请求）
    var chk = getProviderCheck(p.id);
    if (chk) {
      var badge = document.createElement('span');
      badge.className = 'provider-check-badge ' + chk.status;
      badge.title = chk.msg + '（' + fmtAgo(chk.ts) + '）';
      badge.textContent = chk.status === 'ok' ? '✓ 连通 ' + chk.models.length + ' 模型' : (chk.status === 'cors' ? '⚠ 疑似CORS' : '✗ 失败');
      meta.appendChild(badge);
    }
    var actions = document.createElement('div');
    actions.className = 'provider-item-actions';
    var setBtn = document.createElement('button');
    setBtn.className = 'ai-btn tiny'; setBtn.textContent = '设为当前';
    setBtn.onclick = function() { applyProvider(p.id); };
    var checkBtn = document.createElement('button');
    checkBtn.className = 'ai-btn tiny'; checkBtn.textContent = '校验';
    checkBtn.onclick = function() {
      checkBtn.disabled = true; checkBtn.textContent = '校验中…';
      checkProviderConnectivity(p).then(function(r) {
        checkBtn.disabled = false; checkBtn.textContent = '校验';
        renderProviderList();
        if (providerStatus) {
          providerStatus.textContent = p.name + '：' + (r.status === 'ok' ? ('✓ ' + r.msg) : (r.status === 'cors' ? '⚠ ' + r.msg + '（可能是 CORS 阻止，可启用代理模式或换 CORS 端点）' : '✗ ' + r.msg));
          providerStatus.className = 'ai-settings-status ' + (r.status === 'ok' ? 'ok' : 'warn');
        }
      });
    };
    var editBtn = document.createElement('button');
    editBtn.className = 'ai-btn tiny'; editBtn.textContent = '编辑';
    editBtn.onclick = function() { editProvider(p.id); };
    var addModelBtn = document.createElement('button');
    addModelBtn.type = 'button';
    addModelBtn.className = 'ai-btn tiny provider-model-add-btn';
    addModelBtn.textContent = '+ 模型';
    addModelBtn.title = '给这个提供方新增一个模型';
    addModelBtn.onclick = function(e) { openProviderModelPanel(p.id, addModelBtn, e); };
    var delBtn = document.createElement('button');
    delBtn.className = 'ai-btn tiny danger'; delBtn.textContent = '删除';
    delBtn.onclick = function() { deleteProvider(p.id); };
    actions.appendChild(setBtn); actions.appendChild(checkBtn); actions.appendChild(editBtn); actions.appendChild(addModelBtn); actions.appendChild(delBtn);
    item.appendChild(head); item.appendChild(meta); item.appendChild(actions);
    providerList.appendChild(item);
  });
}

function applyProvider(id) {
  try { localStorage.setItem(ACTIVE_PROVIDER_STORAGE, id || ''); } catch (_) {}
  syncActiveProviderToLegacy();
  syncProviderModelsToAiSelects();
  renderProviderSelect();
  renderProviderList();
  try { if (typeof agentFillProviders === 'function') agentFillProviders(); } catch (_) {}
  if (providerStatus) {
    providerStatus.textContent = id ? '已切换到该提供方（已写入当前 API Key / 地址）。' : '已停用提供方，改用下方 OpenAI / 自定义设置。';
    providerStatus.className = 'ai-settings-status ok';
  }
}

function addProvider() {
  var name = (provNameInput.value || '').trim();
  var base = (provBaseInput.value || '').trim().replace(/\/+$/, '');
  var key = (provKeyInput.value || '').trim();
  var manualRaw = (provModelInput.value || '').trim();
  if (!base) { if (providerStatus) { providerStatus.textContent = '请填写地址（API 端点）。'; providerStatus.className = 'ai-settings-status warn'; } return; }
  var list = getProviders() || [];
  var selected = getSelectedProviderModels();
  // 手动模型支持批量：换行 / 逗号 / 空格 分隔
  var manualIds = manualRaw ? manualRaw.split(/[\s,]+/).map(function(s) { return s.trim(); }).filter(function(s) { return !!s; }) : [];
  // 合并勾选 + 手动，按出现顺序去重
  var seen = {};
  var models = [];
  selected.concat(manualIds).forEach(function(id) { if (id && !seen[id]) { seen[id] = 1; models.push(id); } });
  var model = manualIds[0] || (selected.length ? selected[0] : '') || (models.length ? models[0] : '');
  // 旧版页面没有单独的 vendor 选择控件：这里按名称 / 地址 / 模型自动推断，避免因未定义变量导致添加中断
  var vendor = resolveProviderVendor({ name: name, base: base, model: model }, model) || 'openai';
  var p = { id: 'prov-' + Date.now(), name: name || base, base: base, vendor: vendor, key: key, model: model, models: models };
  list.push(p);
  setProviders(list);
  syncProviderModelsToAiSelects();
  try { localStorage.setItem(ACTIVE_PROVIDER_STORAGE, p.id); } catch (_) {}
  syncActiveProviderToLegacy();
  provNameInput.value = ''; provBaseInput.value = ''; provKeyInput.value = ''; provModelInput.value = '';
  if (provModelsList) provModelsList.innerHTML = '';
  showModelsBox(false);
  if (provModelsStatus) provModelsStatus.textContent = '';
  renderProviderSelect(); renderProviderList();
  try { if (typeof agentFillProviders === 'function') agentFillProviders(); } catch (_) {}
  if (providerStatus) {
    providerStatus.textContent = '已添加并设为当前提供方' + (models.length ? ('（已记录 ' + models.length + ' 个模型）') : '') + '。';
    providerStatus.className = 'ai-settings-status ok';
  }
}

var _providerModelPanel = null;
var _providerModelPanelProviderId = '';
var _providerModelPanelAnchor = null;

function ensureProviderModelPanel() {
  if (_providerModelPanel) return _providerModelPanel;
  var panel = document.createElement('div');
  panel.id = 'providerModelPanel';
  panel.className = 'provider-model-panel';
  panel.innerHTML =
    '<div class="provider-model-panel-head">' +
      '<div class="provider-model-panel-title">新增模型</div>' +
      '<button type="button" class="provider-model-panel-close" id="pmClose">✕</button>' +
    '</div>' +
    '<div class="provider-model-panel-sub" id="pmSub">为当前提供方补充模型 ID</div>' +
    '<label class="provider-model-panel-label">模型 ID</label>' +
    '<textarea class="provider-model-panel-input" id="pmModel" placeholder="可输入一个或多个模型 ID，支持逗号 / 空格 / 换行分隔"></textarea>' +
    '<label class="provider-model-panel-check"><input type="checkbox" id="pmDefault" checked> 设为默认模型</label>' +
    '<div class="provider-model-panel-actions">' +
      '<button type="button" class="ai-btn tiny" id="pmCancel">取消</button>' +
      '<button type="button" class="ai-btn tiny primary" id="pmSave">保存</button>' +
    '</div>';
  document.body.appendChild(panel);
  panel.querySelector('#pmClose').onclick = closeProviderModelPanel;
  panel.querySelector('#pmCancel').onclick = closeProviderModelPanel;
  panel.querySelector('#pmSave').onclick = saveProviderModelPanel;
  panel.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  document.addEventListener('mousedown', function(e) {
    if (!panel.classList.contains('show')) return;
    if (panel.contains(e.target)) return;
    if (e.target && e.target.closest && e.target.closest('.provider-item-actions .provider-model-add-btn')) return;
    closeProviderModelPanel();
  }, true);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel.classList.contains('show')) closeProviderModelPanel();
  });
  _providerModelPanel = panel;
  return panel;
}

function positionProviderModelPanel(panel, anchor) {
  if (!panel || !anchor) return;
  var rect = anchor.getBoundingClientRect();
  var pr = panel.getBoundingClientRect();
  var pad = 12;
  var left = rect.left;
  var top = rect.bottom + 8;
  if (left + pr.width > window.innerWidth - pad) left = window.innerWidth - pr.width - pad;
  if (left < pad) left = pad;
  if (top + pr.height > window.innerHeight - pad) top = rect.top - pr.height - 8;
  if (top < pad) top = pad;
  panel.style.left = Math.round(left) + 'px';
  panel.style.top = Math.round(top) + 'px';
}

function openProviderModelPanel(id, anchor) {
  var p = getProviderById(id);
  if (!p) return;
  var panel = ensureProviderModelPanel();
  _providerModelPanelProviderId = id;
  _providerModelPanelAnchor = anchor || null;
  panel.querySelector('#pmSub').textContent = (p.name || p.base || '该提供方') + ' · 一次输入一个或多个模型 ID';
  panel.querySelector('#pmModel').value = '';
  panel.querySelector('#pmDefault').checked = !p.model;
  panel.classList.add('show');
  panel.style.visibility = 'hidden';
  panel.style.display = 'block';
  requestAnimationFrame(function() {
    positionProviderModelPanel(panel, anchor || panel);
    panel.style.visibility = 'visible';
    panel.querySelector('#pmModel').focus();
  });
}

function closeProviderModelPanel() {
  var panel = _providerModelPanel;
  if (!panel) return;
  panel.classList.remove('show');
  panel.style.display = 'none';
  _providerModelPanelProviderId = '';
  _providerModelPanelAnchor = null;
}

function saveProviderModelPanel() {
  var panel = _providerModelPanel;
  if (!panel) return;
  var p = getProviderById(_providerModelPanelProviderId);
  if (!p) { closeProviderModelPanel(); return; }
  var raw = (panel.querySelector('#pmModel').value || '').trim();
  if (!raw) {
    if (providerStatus) {
      providerStatus.textContent = '请至少填写一个模型 ID。';
      providerStatus.className = 'ai-settings-status warn';
    }
    return;
  }
  var ids = raw.split(/[\s,]+/).map(function(s) { return s.trim(); }).filter(function(s) { return !!s; });
  if (!ids.length) return;
  var list = getProviders() || [];
  var target = null;
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === p.id) { target = list[i]; break; }
  if (!target) { closeProviderModelPanel(); return; }
  if (!Array.isArray(target.models)) target.models = [];
  var added = [];
  ids.forEach(function(id) {
    if (target.models.indexOf(id) === -1) { target.models.push(id); added.push(id); }
  });
  if (panel.querySelector('#pmDefault').checked || !target.model) target.model = ids[0];
  if (added.length || target.model) saveProvidersAndRefresh(list);
  syncProviderModelsToAiSelects();
  try { if (typeof agentFillProviders === 'function') agentFillProviders(); } catch (_) {}
  if (providerStatus) {
    providerStatus.textContent = '已为「' + (target.name || target.base || target.id) + '」新增模型：' + ids.join('、') + '。';
    providerStatus.className = 'ai-settings-status ok';
  }
  closeProviderModelPanel();
}

function editProvider(id) {
  var list = getProviders() || [];
  var p = null;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) { p = list[i]; break; }
  if (!p) return;
  var name = prompt('提供方名称', p.name || ''); if (name === null) return;
  var base = prompt('API 地址（base URL）', p.base || ''); if (base === null) return;
  var vendor = prompt('协议类型（openai / deepseek / anthropic / google / xai）', p.vendor || 'openai');
  if (vendor === null) return;
  var key = prompt('API Key（留空则保持不变）', '');
  var model = prompt('默认模型 id', p.model || '');
  p.name = name.trim() || p.base;
  p.base = base.trim().replace(/\/+$/, '');
  p.vendor = (vendor.trim() || 'openai').toLowerCase();
  if (key && key.trim()) p.key = key.trim();
  if (model !== null) p.model = model.trim();
  setProviders(list);
  if (getActiveProviderId() === id) syncActiveProviderToLegacy();
  syncProviderModelsToAiSelects();
  renderProviderSelect(); renderProviderList();
  try { if (typeof agentFillProviders === 'function') agentFillProviders(); } catch (_) {}
}

function deleteProvider(id) {
  if (!confirm('删除该提供方？')) return;
  var list = getProviders() || [];
  var next = list.filter(function(x) { return x.id !== id; });
  setProviders(next);
  removeProviderCheck(id); // #12：清理该校验记录
  if (getActiveProviderId() === id) { try { localStorage.setItem(ACTIVE_PROVIDER_STORAGE, ''); } catch (_) {} }
  syncProviderModelsToAiSelects();
  renderProviderSelect(); renderProviderList();
  try { if (typeof agentFillProviders === 'function') agentFillProviders(); } catch (_) {}
}

// ===== 识别当前供方的模型：拉取 /models 并解析为可选模型列表 =====
// 兼容常见返回：{ object:'list', data:[{id}] } / { data:[...] } / { models:[...] } / { list:[...] } / 裸数组 等。
function parseModelsPayload(json) {
  var models = [];
  function pushId(id) {
    if (id && typeof id === 'string' && models.indexOf(id) === -1) models.push(id);
  }
  function collect(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function(m) {
      if (!m) return;
      if (typeof m === 'string') { pushId(m); return; }
      pushId(m.id || m.model || m.name || m.object);
      if (m.owned_models && Array.isArray(m.owned_models)) m.owned_models.forEach(function(x) { pushId((x && x.id) ? x.id : x); });
    });
  }
  if (!json) return models;
  if (Array.isArray(json)) { collect(json); return models; }
  collect(json.data);
  collect(json.models);
  collect(json.list);
  collect(json.result);
  collect(json.results);
  if (json.success && json.data) collect(json.data);
  // 个别服务把模型藏在 choices[].models
  if (json.choices && Array.isArray(json.choices)) json.choices.forEach(function(c) { if (c && c.models) collect(c.models); });
  return models;
}

// 根据 base 生成候选 /models 路径（自动兼容 /models 与 /v1/models）
function candidateModelUrls(base) {
  var b = base.replace(/\/+$/, '');
  var urls = [];
  if (/\/v1$/.test(b)) {
    // base 形如 .../v1：候选为 .../v1/models 与 .../models
    urls.push(b + '/models');
    urls.push(b.replace(/\/v1$/, '') + '/models');
  } else {
    // base 形如 .../x：候选为 .../models 与 .../v1/models
    urls.push(b + '/models');
    urls.push(b + '/v1/models');
  }
  // 去重，保序
  var seen = {};
  return urls.filter(function(u) { if (seen[u]) return false; seen[u] = 1; return true; });
}

// 向提供方 base 拉取模型列表：依次探测多个候选路径，返回 { models, url, tried }
// tried 记录每个候选路径的探测结果（供失败诊断可视化）：{ url, ok, code|error, corsLike }
function fetchProviderModels(base, key) {
  return new Promise(function(resolve, reject) {
    var urls = candidateModelUrls(base);
    var lastErr = null;
    var tried = [];
    function tryOne(idx) {
      if (idx >= urls.length) {
        var err = lastErr || new Error('所有候选路径均未返回模型列表（可能该服务不支持标准 /models）');
        err.tried = tried;
        reject(err);
        return;
      }
      var url = urls[idx];
      var headers = { 'Accept': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;
      fetch(url, { method: 'GET', headers: headers })
        .then(function(resp) {
          if (!resp.ok) {
            tried.push({ url: url, ok: false, code: resp.status });
            var e = new Error('HTTP ' + resp.status);
            e.status = resp.status;
            lastErr = e; // 记录最后一次错误，继续试下一个路径
            tryOne(idx + 1);
            return;
          }
          return resp.json().then(function(json) {
            tried.push({ url: url, ok: true, code: 200 });
            var ms = parseModelsPayload(json);
            if (ms.length) resolve({ models: ms, url: url, tried: tried });
            else tryOne(idx + 1); // 该路径可达但无模型数据，试下一个
          });
        })
        .catch(function(err) {
          var msg = (err && err.message) ? String(err.message) : String(err);
          tried.push({ url: url, ok: false, error: msg, corsLike: /Failed to fetch|NetworkError|TypeError|Load failed/i.test(msg) });
          lastErr = err;
          tryOne(idx + 1);
        });
    }
    tryOne(0);
  });
}

// ===== #12 provider 增强：模型缓存 / 一键校验 / 失败诊断可视化 =====
var PROVIDER_MODELS_CACHE_KEY = 'flowcraft:providerModelsCache:v1'; // { base: { models, url, ts } }
var PROVIDER_CHECKS_KEY = 'flowcraft:providerChecks:v1';             // { id: { status, ts, msg, models } }
var PROVIDER_CACHE_TTL = 6 * 60 * 60 * 1000;                         // 缓存有效期 6 小时
var _providerForceRefresh = false;                                   // 命中缓存后再次点击 → 强制联网刷新

function getProviderModelsCache(base) {
  try {
    var o = JSON.parse(localStorage.getItem(PROVIDER_MODELS_CACHE_KEY));
    return (o && o[base]) || null;
  } catch (_) { return null; }
}
function setProviderModelsCache(base, models, url) {
  try {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(PROVIDER_MODELS_CACHE_KEY)) || {}; } catch (_) {}
    o[base] = { models: models, url: url, ts: Date.now() };
    localStorage.setItem(PROVIDER_MODELS_CACHE_KEY, JSON.stringify(o));
  } catch (_) {}
}
function getProviderCheck(id) {
  try {
    var o = JSON.parse(localStorage.getItem(PROVIDER_CHECKS_KEY));
    return (o && o[id]) || null;
  } catch (_) { return null; }
}
function setProviderCheck(id, status, msg, models) {
  try {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(PROVIDER_CHECKS_KEY)) || {}; } catch (_) {}
    o[id] = { status: status, ts: Date.now(), msg: msg || '', models: models || [] };
    localStorage.setItem(PROVIDER_CHECKS_KEY, JSON.stringify(o));
  } catch (_) {}
}
function removeProviderCheck(id) {
  try {
    var o = JSON.parse(localStorage.getItem(PROVIDER_CHECKS_KEY)) || {};
    if (o[id]) { delete o[id]; localStorage.setItem(PROVIDER_CHECKS_KEY, JSON.stringify(o)); }
  } catch (_) {}
}
function fmtAgo(ts) {
  if (!ts) return '';
  var s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + ' 秒前';
  if (s < 3600) return Math.round(s / 60) + ' 分钟前';
  return Math.round(s / 3600) + ' 小时前';
}
// 渲染失败诊断面板：每个候选路径的结果 + 常见解决方案
function renderProviderDiagnostics(tried) {
  if (!provDiagBox) return;
  provDiagBox.hidden = false;
  provDiagBox.innerHTML = '';
  if (tried && tried.length) {
    var head = document.createElement('div');
    head.className = 'pd-head';
    head.textContent = '已探测路径诊断：';
    provDiagBox.appendChild(head);
    tried.forEach(function(t) {
      var row = document.createElement('div');
      row.className = 'pd-row';
      var dot = document.createElement('span');
      dot.className = 'pd-dot ' + (t.ok ? 'ok' : (t.corsLike ? 'warn' : 'err'));
      dot.textContent = t.ok ? '✓' : (t.corsLike ? '⚠' : '✗');
      var txt = document.createElement('span');
      txt.className = 'pd-txt';
      txt.textContent = t.url + ' → ' + (t.ok ? '可达' : (t.code ? 'HTTP ' + t.code : (t.error || '失败')));
      row.appendChild(dot); row.appendChild(txt);
      provDiagBox.appendChild(row);
    });
  }
  var sol = document.createElement('div');
  sol.className = 'pd-solutions';
  sol.innerHTML = '常见解法：① 服务端开启 CORS（或改用中转/代理端点）② 启用 FlowCraft 代理模式 ③ 手动填写模型 id 绕过 /models';
  provDiagBox.appendChild(sol);
}

function showModelsBox(show) {
  if (provModelsBox) provModelsBox.hidden = !show;
}

function renderModelsChecklist(models) {
  if (!provModelsList) return;
  provModelsList.innerHTML = '';
  models.forEach(function(id) {
    var label = document.createElement('label');
    label.className = 'provider-model-check';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = id;
    cb.checked = true; // 默认全选，用户可取消勾选
    cb.setAttribute('data-model', id);
    var span = document.createElement('span');
    span.textContent = id;
    label.appendChild(cb); label.appendChild(span);
    provModelsList.appendChild(label);
  });
}

// 收集当前勾选的模型 id（去重）
function getSelectedProviderModels() {
  if (!provModelsList) return [];
  var out = [];
  provModelsList.querySelectorAll('input[type=checkbox]').forEach(function(cb) {
    var v = cb.getAttribute('data-model');
    if (cb.checked && v && out.indexOf(v) === -1) out.push(v);
  });
  return out;
}

function setProviderStatus(msg, type) {
  if (!providerStatus) return;
  providerStatus.textContent = msg || '';
  providerStatus.className = 'ai-settings-status' + (type ? ' ' + type : '');
}

// 点击「获取模型」：识别当前供方的可用模型并渲染勾选列表
// 缓存策略：6 小时内命中本地缓存直接展示（状态栏注明"缓存"），再次点击强制联网刷新；
//           联网失败但有历史缓存时回退缓存并告警；失败渲染结构化诊断面板。
function onFetchModels() {
  var base = (provBaseInput.value || '').trim().replace(/\/+$/, '');
  if (!base) { setProviderStatus('请先填写地址（API 端点）再获取模型。', 'warn'); return; }
  var key = (provKeyInput.value || '').trim();
  var cache = getProviderModelsCache(base);

  // 命中新鲜缓存 → 先用缓存展示，并提示再次点击强制刷新
  if (cache && cache.models && cache.models.length && !_providerForceRefresh) {
    renderModelsChecklist(cache.models);
    showModelsBox(true);
    if (provModelsStatus) provModelsStatus.textContent = '已用本地缓存（' + fmtAgo(cache.ts) + '，来自 ' + (cache.url || '') + '）。再次点击「获取模型」强制联网刷新。';
    setProviderStatus('已载入缓存模型 ' + cache.models.length + ' 个（' + fmtAgo(cache.ts) + '）。', 'ok');
    _providerForceRefresh = true; // 下次点击强制联网
    return;
  }
  _providerForceRefresh = false;

  var proxyOn = !!_fcProxy();
  setProviderStatus('正在获取模型列表…', '');
  if (provModelsStatus) provModelsStatus.textContent = '请求中…';
  showModelsBox(true);
  if (provDiagBox) provDiagBox.hidden = true;
  fetchProviderModels(base, key).then(function(res) {
    var models = res.models, url = res.url;
    setProviderModelsCache(base, models, url); // 成功后写缓存
    if (!models.length) {
      if (provModelsStatus) provModelsStatus.textContent = '该端点未返回模型列表（可能不是标准 OpenAI 兼容 /models）。可手动填写模型 id。';
      setProviderStatus('未识别到模型，请手动填写模型 id。', 'warn');
      return;
    }
    renderModelsChecklist(models);
    if (provModelsStatus) provModelsStatus.textContent = '共 ' + models.length + ' 个模型（取自 ' + url + '，已缓存 6 小时），勾选要添加的，然后点「添加」。';
    setProviderStatus('已识别 ' + models.length + ' 个模型（取自 ' + url + '），请勾选要添加的。', 'ok');
  }).catch(function(err) {
    var msg = (err && err.message) ? err.message : String(err);
    var tried = (err && err.tried) || [];
    var triedStr = (tried.length ? tried.map(function(t) { return t.url; }).join('、') : candidateModelUrls(base).join('、'));
    var isCorsOrNet = /Failed to fetch|NetworkError|TypeError|Load failed/i.test(msg);
    var specific = isCorsOrNet
      ? '（很可能是浏览器 CORS 阻止：服务端未给 /models 配置跨域头，前端无法绕过。）'
      : (proxyOn ? '（当前为代理模式：浏览器不持有 Key，代理可能未开放 /models 列表接口。）' : '');
    var manualHint = '建议：手动填写模型 id 到上方『模型』框（换行/逗号/空格分隔，可批量添加）。';
    // 联网失败但有缓存 → 回退缓存
    var fallback = cache && cache.models && cache.models.length;
    if (fallback) {
      renderModelsChecklist(cache.models);
      if (provModelsStatus) provModelsStatus.textContent = '联网获取失败，已回退本地缓存（' + fmtAgo(cache.ts) + '）。';
      setProviderStatus('联网获取失败（' + msg + '），已回退本地缓存 ' + cache.models.length + ' 个模型。', 'warn');
    } else {
      if (provModelsStatus) provModelsStatus.textContent = '获取失败：' + msg + '｜已尝试：' + triedStr;
      setProviderStatus('获取模型失败：' + msg + '。已尝试路径：' + triedStr + specific + manualHint, 'warn');
      renderProviderDiagnostics(tried);
    }
  });
}

// 校验单个提供方连通性：探测 /models，分类 ok / cors / fail，结果持久化到 providerChecks
function checkProviderConnectivity(p) {
  if (!p || !p.base) return Promise.resolve({ status: 'fail', msg: '缺少地址' });
  return fetchProviderModels(p.base, p.key).then(function(res) {
    setProviderCheck(p.id, 'ok', '连通，' + res.models.length + ' 个模型（' + res.url + '）', res.models);
    return { status: 'ok', models: res.models.length, msg: '连通，' + res.models.length + ' 个模型', url: res.url };
  }).catch(function(err) {
    var msg = (err && err.message) ? String(err.message) : String(err);
    var corsLike = /Failed to fetch|NetworkError|TypeError|Load failed/i.test(msg);
    var status = corsLike ? 'cors' : 'fail';
    setProviderCheck(p.id, status, msg + (corsLike ? '（疑似 CORS 阻止）' : ''), []);
    return { status: status, msg: msg };
  });
}
// 全部校验：逐个提供方测连通，边测边刷新列表与状态
function checkAllProviders() {
  var list = getProviders() || [];
  if (!list.length) { if (providerStatus) { providerStatus.textContent = '还没有提供方可校验。'; providerStatus.className = 'ai-settings-status warn'; } return; }
  if (providerStatus) { providerStatus.textContent = '正在逐个校验 ' + list.length + ' 个提供方…'; providerStatus.className = 'ai-settings-status'; }
  var chain = Promise.resolve();
  var seq = [];
  list.forEach(function(p) { seq.push(function() { return checkProviderConnectivity(p).then(function() { renderProviderList(); }); }); });
  seq.reduce(function(prev, cur) { return prev.then(cur); }, chain).then(function() {
    renderProviderList();
    if (providerStatus) { providerStatus.textContent = '全部校验完成，见各提供方状态徽标。'; providerStatus.className = 'ai-settings-status ok'; }
  }).catch(function(e) {
    if (providerStatus) { providerStatus.textContent = '校验中断：' + e.message; providerStatus.className = 'ai-settings-status warn'; }
  });
}

if (providerSelect) providerSelect.addEventListener('change', function(e) { applyProvider(e.target.value); });
if (provAddBtn) provAddBtn.addEventListener('click', addProvider);
if (provFetchModelsBtn) provFetchModelsBtn.addEventListener('click', onFetchModels);
if (provCheckAllBtn) provCheckAllBtn.addEventListener('click', checkAllProviders);
if (provModelsSelectAll) provModelsSelectAll.addEventListener('click', function() {
  if (provModelsList) provModelsList.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = true; });
});
if (provModelsClear) provModelsClear.addEventListener('click', function() {
  if (provModelsList) provModelsList.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
});

// 打开设置面板时刷新提供方列表，并收起模型勾选框
aiSettingsBtn.addEventListener('click', function() {
  renderProviderSelect();
  renderProviderList();
  showModelsBox(false);
  if (provModelsList) provModelsList.innerHTML = '';
  if (provModelsStatus) provModelsStatus.textContent = '';
});

// 首次启动：种子默认提供方 + 自动激活（仅首次，不会覆盖你已有的手动设置）
seedProvidersIfNeeded();
syncActiveProviderToLegacy();
syncProviderModelsToAiSelects();
renderProviderSelect();
renderProviderList();
restoreAIChatHistory();

// --- 9. 清空对话 ---
aiClearBtn.addEventListener('click', function() {
  // 仅统计消息条数（排除 welcome）
  var msgCount = aiChat.querySelectorAll('.ai-message').length;
  if (msgCount === 0) return;
  if (!confirm('确定清空所有对话记录？')) return;

  aiChat.innerHTML =
    '<div class="ai-welcome">' +
      '<div class="ai-welcome-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<path d="M12 2a4 4 0 00-4 4v1H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-2V6a4 4 0 00-4-4z"/>' +
          '<path d="M12 14v3"/><circle cx="12" cy="11" r="1"/>' +
        '</svg>' +
      '</div>' +
      '<div class="ai-welcome-title">AI 设计助手</div>' +
      '<div class="ai-welcome-desc">描述你的设计需求，我会帮你生成参考图、线稿、材质、灯光与布局方案。</div>' +
    '</div>';
  aiToggleBtn.classList.remove('has-messages');
  // 清空对话时同步重置 Deepseek 上下文
  aiConversation = [];
  try { localStorage.removeItem(AI_CHAT_HISTORY_STORAGE); } catch (_) {}
});

init();
