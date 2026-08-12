
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
  aiImage:  { label: 'AI 绘图',  desc: '文生图 / 图生图',    color: 'var(--node-ai-image)', colorRaw: '#9B59F0', inputs: [{type:'image',label:'图片'},{type:'text',label:'提示词'}], outputs: [{type:'image',label:'图片'}] },
  aiVideo:  { label: 'AI 视频',  desc: '图生视频 / 文生视频', color: 'var(--node-ai-video)', colorRaw: '#C76BF7', inputs: [{type:'image',label:'图片'},{type:'text',label:'提示词'}], outputs: [{type:'video',label:'视频'}], defaultParams: { model: 'Sora 2', aspect: '9:16', duration: '5秒', resolution: '高清1K', mode: '异步' } },
  upscale:  { label: '智能超清', desc: '图片无损放大',       color: 'var(--node-upscale)',  colorRaw: '#F2C66B', inputs: [{type:'image',label:'图片'}], outputs: [{type:'image',label:'图片'}] },
  compare:  { label: '对比',     desc: '左右对比展示',       color: 'var(--node-compare)',  colorRaw: '#E15353', inputs: [{type:'image',label:'原图'},{type:'image',label:'结果'}], outputs: [{type:'image',label:'对比图'}] },
  videoBreak: { label: '视频拆解', desc: '拆解视频为关键帧/片段', color: 'var(--node-video-break)', colorRaw: '#3DA5E0', inputs: [{type:'video',label:'视频'}], outputs: [{type:'image',label:'关键帧'},{type:'video',label:'片段'}], defaultParams: { frames: 6, segments: 3 } },
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
  text:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10M3 7h10M3 11h6"/></svg>',
  aiImage: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6l1.5 2 1.5-1.5L11 10M6 5.5h.01"/></svg>',
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
    this.title = this.def.label;
    this.thumb = null;
    this.prompt = '';
    this.params = this.def.defaultParams
      ? JSON.parse(JSON.stringify(this.def.defaultParams))
      : { ...DEFAULT_NODE_PARAMS };
    this.status = 'idle'; // idle | running | done | error
    // 数据流动骨架 (A1)：运行后存储真实数据载荷
    this.inputsData = [];   // 与 def.inputs 对齐，存放上游传入的载荷
    this.outputsData = [];  // 与 def.outputs 对齐，存放本节点产出的载荷
    this.el = null;
  }
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

//================ 4b. 回收站 ================
const recycleBin = []; // 已删除节点快照数组，每项: { node, edges, deletedAt }

//================ 4c. 撤销/重做 (Undo / Redo) ================
const HISTORY_LIMIT = 50; // 历史栈上限
let undoStack = [];       // 撤销栈
let redoStack = [];       // 重做栈
let isRestoringHistory = false; // 标记正在执行 undo/redo，避免重复压栈
let isBatchRestore = false;    // 标记批量还原操作，避免 restoreFromRecycle 内部重复压栈

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
      prompt: n.prompt,
      params: { ...n.params },
      status: n.status,
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
  };
}

// 压入历史栈（在状态变更前调用）
function pushHistory() {
  if (isRestoringHistory) return;
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
      node.prompt = nd.prompt;
      node.params = { ...nd.params };
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

//================ 4d. 自动保存 (localStorage 持久化) ================
const AUTOSAVE_KEY = 'flowcraft:autosave:v1';
// 自动保存数据结构版本。每次改变节点/工作流存储结构时 +1，
// 旧版本数据在 restoreFromStorage 中经 migrateAutosave 平滑迁移，避免整页崩溃或用户数据丢失。
const CURRENT_AUTOSAVE_VERSION = 3;
let autosaveTimer = null;
// 自动保存体积安全上限（localStorage 约 5MB，预留余量在超限前主动剥离大图）
const SAFE_AUTOSAVE_LIMIT = 4_500_000;
let lastSaveStripped = false;

// 剥离节点里的大体积 dataURL（图片预览），保证长项目也能落到 localStorage
function _stripHeavyDataUrls(nodesData) {
  const THRESH = 60000;
  const scrub = (v) => (typeof v === 'string' && v.startsWith('data:') && v.length > THRESH) ? '(stripped)' : v;
  nodesData.forEach(nd => {
    if (nd.thumb) nd.thumb = scrub(nd.thumb);
    if (nd.params) Object.keys(nd.params).forEach(k => { nd.params[k] = scrub(nd.params[k]); });
    if (Array.isArray(nd.inputsData)) nd.inputsData.forEach(d => { if (d) d.value = scrub(d.value); });
    if (Array.isArray(nd.outputsData)) nd.outputsData.forEach(d => { if (d) d.value = scrub(d.value); });
  });
}

// 序列化当前工作流为 JSON
function serializeWorkflow(stripHeavy = false) {
  const nodesData = [];
  workflow.nodes.forEach(n => {
    nodesData.push({
      id: n.id, type: n.type, x: n.x, y: n.y,
      width: n.width, height: n.height, title: n.title,
      thumb: n.thumb, prompt: n.prompt,
      params: { ...n.params }, status: n.status,
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

// 执行保存到 localStorage（体积超限自动剥离大图，失败不再静默）
function doAutosave() {
  try {
    const data = serializeWorkflow(false);
    if (data.length > SAFE_AUTOSAVE_LIMIT) {
      const stripped = serializeWorkflow(true);
      localStorage.setItem(AUTOSAVE_KEY, stripped);
      lastSaveStripped = true;
      setSaveStatus('已保存（已剥离大图）', 'warn');
      showToast('自动保存：项目较大，已自动剥离大图预览以保证存档成功，建议导出备份', 'warn', 4500);
    } else {
      localStorage.setItem(AUTOSAVE_KEY, data);
      lastSaveStripped = false;
      setSaveStatus('已保存', 'ok');
    }
  } catch (err) {
    // 兜底：即便完整写入失败，也尝试剥离大图后保存
    try {
      const stripped = serializeWorkflow(true);
      localStorage.setItem(AUTOSAVE_KEY, stripped);
      lastSaveStripped = true;
      setSaveStatus('已保存（已剥离大图）', 'warn');
      showToast('自动保存空间不足，已剥离大图预览后重试成功，请尽快导出备份', 'warn', 5000);
    } catch (err2) {
      lastSaveStripped = false;
      setSaveStatus('保存失败', 'err');
      showToast('⚠️ 自动保存失败：' + ((err2 && err2.message) || '浏览器存储不可用') + '，请立即导出备份！', 'danger', 6000);
    }
  }
}

// 状态栏保存指示器
function setSaveStatus(text, kind) {
  const el = document.getElementById('statSave');
  if (!el) return;
  el.textContent = text;
  el.style.color = kind === 'err' ? 'var(--color-danger)' : kind === 'warn' ? 'var(--color-warn)' : 'var(--text-2)';
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
  // 未来版本：此处继续追加 v2 → v3 … 的分支；当前版本即视为最新
  if (!Array.isArray(parsed.scenes)) parsed.scenes = [];
  parsed.version = CURRENT_AUTOSAVE_VERSION;
  return parsed;
}

// 从 localStorage 恢复工作流
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
  if (!parsed || !parsed.nodes) return false;

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
      node.prompt = nd.prompt || '';
      node.params = { ...DEFAULT_NODE_PARAMS, ...(nd.params || {}) };
      node.status = nd.status || 'idle';
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
  if (!parsed || !parsed.nodes) throw new Error('无效的工作流数据');
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
    node.prompt = nd.prompt || '';
    node.params = { ...DEFAULT_NODE_PARAMS, ...(nd.params || {}) };
    node.status = nd.status || 'idle';
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
  if (parsed.recycleBin) {
    parsed.recycleBin.forEach(item => {
      recycleBin.push({
        node: { ...item.node, params: { ...item.node.params } },
        edges: item.edges.map(e => ({ ...e })),
        deletedAt: item.deletedAt,
      });
    });
  }
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

//================ 4h. 资产管理 (素材库) ================
const ASSET_IMAGE_TYPES = ['image', 'aiImage', 'aiVideo', 'upscale', 'compare', 'aiSet', 'material', 'light', 'layout', 'lineart', 'comfyui'];

function collectAssets() {
  const assets = [];
  workflow.nodes.forEach(node => {
    const def = node.def || {};
    // 节点自身缩略图（产出图类型）
    if (ASSET_IMAGE_TYPES.includes(node.type) && node.thumb && typeof node.thumb === 'string' && node.thumb.startsWith('data:')) {
      assets.push({ src: node.thumb, label: '节点图', nodeId: node.id, nodeTitle: node.title, kind: 'thumb' });
    }
    // 输入图片（按端口语义名）
    (node.inputsData || []).forEach((pl, i) => {
      if (pl && pl.type === 'image' && typeof pl.value === 'string' && pl.value.startsWith('data:')) {
        const portLabel = (def.inputs && def.inputs[i]) ? def.inputs[i].label : ('输入' + (i + 1));
        assets.push({ src: pl.value, label: '输入·' + portLabel, nodeId: node.id, nodeTitle: node.title, kind: 'input' });
      }
    });
    // 产出图片
    (node.outputsData || []).forEach((pl, i) => {
      if (pl && pl.type === 'image' && typeof pl.value === 'string' && pl.value.startsWith('data:')) {
        assets.push({ src: pl.value, label: '产出·' + (i + 1), nodeId: node.id, nodeTitle: node.title, kind: 'output' });
      }
    });
  });
  return assets;
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
  const assets = _assetCatFilter ? all.filter(a => catsMap[assetKey(a)] === _assetCatFilter) : all;
  if (count) count.textContent = assets.length + (_assetCatFilter ? ' / ' + all.length : '');
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
      cell.querySelector('[data-act="locate"]').onclick = () => { locateNode(a.nodeId); toggleAssetPanel(false); };
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
        showToast('已设为资产 <<<' + (nm || refName) + '>>>' + (sel.value ? ' · ' + sel.value : ''), 'success');
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
  }
];

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
        '<button class="ai-btn small" data-act="append" data-id="' + t.id + '">追加</button>' +
        '<button class="ai-btn small" data-act="replace" data-id="' + t.id + '">清空并加载</button>' +
      '</div>' +
    '</div>';
  }).join('');
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
  if (mode === 'replace') clearGraph();
  pushHistory();
  const created = [];
  // 追加模式：自动错开前一个模板的位置（整体放在现有节点右侧，避免重叠）
  let offX = 0, offY = 0;
  if (mode === 'append') {
    // 模板自身最左节点的 spec.x（spec 常含负值，需按整体平移）
    let tMinX = Infinity;
    t.nodes.forEach(s => { if (s.x < tMinX) tMinX = s.x; });
    if (!isFinite(tMinX)) tMinX = 0;
    const bb = getNodesBBox();
    const GAP = 80;
    if (bb) {
      // 把本模板最左节点对齐到「现有内容右边界 + 间距」
      offX = (bb.maxX + GAP) - tMinX;
    } else {
      // 画布为空时把模板最左节点对齐到 x=0
      offX = -tMinX;
    }
    offY = 0;
  }
  t.nodes.forEach(spec => {
    const x = spec.x + offX, y = spec.y + offY;
    const node = new WorkflowNode(spec.type, x, y);
    node.title = spec.title || node.def.label;
    if (spec.params) node.params = Object.assign({}, node.params, spec.params);
    const el = createNodeElement(node);
    nodeLayer.appendChild(el);
    workflow.nodes.set(node.id, node);
    workflow.order.push(node.id);
    if (node.el) node.el.classList.add('selected');
    buildNodeBody(node.el, node);
    created.push(node);
  });
  // 清空旧选中（追加模式下不强制，但保持单选直觉）
  workflow.selection.clear();
  created.forEach(n => workflow.selection.add(n.id));
  // 连线：output[0] → input[0]
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
  // 挑选后自动关闭开箱模板面板
  closeTemplatePanel();
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
    loadTemplate(btn.getAttribute('data-id'), btn.getAttribute('data-act'));
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
      type: node.type,
      title: node.title || def.label || node.type,
      model: (node.params && node.params.model) || '',
      desc: describeNodeParams(node),
      duration: Math.max(0, Math.round(durationMs || 0)),
      status: success ? 'success' : 'error',
      error: success ? '' : (errorMsg || '未知错误'),
      // 仅持久化 http(s) 缩略图（ComfyUI 的 /view 链接），避免 localStorage 被大体积 dataURL 撑爆
      thumb: (success && typeof node.thumb === 'string' && node.thumb.startsWith('http')) ? node.thumb : ''
    };
  const list = loadRunLog();
  list.unshift(entry);
  saveRunLog(list);
  if (typeof renderRunLog === 'function') renderRunLog();
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
  node.prompt = nd.prompt;
  node.params = { ...nd.params };
  node.status = nd.status;
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

  ['aiImage', 'aiVideo', 'aiSet'].forEach(type => {
    list.appendChild(createLibraryItem(type));
  });

  // 处理类
  const processLabel = document.createElement('div');
  processLabel.className = 'sidebar-section-label';
  processLabel.textContent = '处理';
  list.appendChild(processLabel);

  ['upscale', 'compare', 'videoBreak', 'material', 'light', 'layout', 'loop'].forEach(type => {
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
  item.innerHTML = `
    <div class="lib-icon">${NODE_ICONS[type] || ''}</div>
    <div class="lib-text">
      <div class="lib-name">${def.label}</div>
      <div class="lib-desc">${def.desc}</div>
    </div>
  `;
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  });
  return item;
}

//================ 7. 节点 DOM 渲染 ================
function createNodeElement(node) {
  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.id = node.id;
  el.dataset.type = node.type;
  el.style.left = node.x + 'px';
  el.style.top = node.y + 'px';
  el.style.zIndex = (++workflow.nextZ).toString();
  el.style.setProperty('--type-color', node.def.color);

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'node-close-btn';
  closeBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  closeBtn.onclick = (e) => { e.stopPropagation(); deleteNode(node.id); };

  // 标题栏
  const header = document.createElement('div');
  header.className = 'node-header';
  const statusDot = document.createElement('div');
  statusDot.className = 'node-status-dot idle';
  const titleText = document.createElement('div');
  titleText.className = 'node-title-text';
  titleText.textContent = node.title;
  const statusPill = document.createElement('div');
  statusPill.className = 'node-status-pill idle';
  statusPill.textContent = '待运行';
  header.appendChild(statusDot);
  header.appendChild(titleText);
  header.appendChild(statusPill);
  header.appendChild(closeBtn);

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
      selectNode(node); // 未选中 → 先单选再拖动
    }
    startNodeDrag(e, node);
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
  if (node.thumb && typeof node.thumb === 'string' && node.thumb.startsWith('data:')) return node.thumb;
  const outData = node.outputsData || [];
  for (const payload of outData) {
    if (payload && payload.type === 'image' && typeof payload.value === 'string' && payload.value.startsWith('data:')) {
      return payload.value;
    }
  }
  const inData = node.inputsData || [];
  for (const payload of inData) {
    if (payload && payload.type === 'image' && typeof payload.value === 'string' && payload.value.startsWith('data:')) {
      return payload.value;
    }
  }
  return null;
}

function renderImagePreviewSection(el, node) {
  const previewTypes = ['image', 'aiImage', 'aiVideo', 'upscale', 'compare', 'aiSet', 'material', 'light', 'layout', 'lineart', 'videoBreak'];
  if (!previewTypes.includes(node.type)) return;

  const def = node.def;
  const inData = node.inputsData || [];

  // AI 绘图节点优先展示逐张生成的原图（带下载按钮）
  const gallery = (node.type === 'aiImage' && Array.isArray(node._galleryImages) && node._galleryImages.length > 0)
    ? node._galleryImages
    : null;

  // 收集需要预览的图片：优先所有上游 image 输入，按端口顺序标注 图一/图二…
  const imgs = [];
  (def.inputs || []).forEach((p, i) => {
    const pl = inData[i];
    if (pl && pl.type === 'image' && typeof pl.value === 'string' && pl.value.startsWith('data:')) {
      imgs.push({ src: pl.value, cap: '图' + cnNum(imgs.length + 1) });
    }
  });

  const area = document.createElement('div');
  area.className = 'node-preview-area';

  // 顶部标签：画廊（多张原图）优先
  const label = document.createElement('div');
  label.className = 'node-preview-label';
  const totalCount = gallery ? gallery.length : imgs.length;
  label.textContent = '图片预览' + (totalCount > 1 ? '（' + totalCount + ' 张）' : '');
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
      img.src = src;
      img.alt = '图' + (idx + 1);
      img.onmousedown = (e) => e.stopPropagation();
      img.onclick = (e) => { e.stopPropagation(); openImageLightbox(src, gallery, idx); };
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

  // 其它节点（image / 上游参考图）：保留原有逻辑
  // 无上游输入图时，回退显示节点自身缩略图
  if (imgs.length === 0 && node.thumb && typeof node.thumb === 'string' && node.thumb.startsWith('data:')) {
    imgs.push({ src: node.thumb, cap: '本图' });
  }

  if (imgs.length === 1) {
    // 单图预览：完整呈现，可随节点尺寸自适应
    const img = document.createElement('img');
    img.className = 'node-preview-img';
    img.src = imgs[0].src;
    img.alt = imgs[0].cap;
    img.onmousedown = (e) => e.stopPropagation();
    img.onclick = (e) => { e.stopPropagation(); openImageLightbox(imgs[0].src); };
    area.appendChild(img);
  } else if (imgs.length > 1) {
    const grid = document.createElement('div');
    grid.className = 'node-preview-grid';
    imgs.forEach(it => {
      const cell = document.createElement('div');
      cell.className = 'node-preview-cell';
      const img = document.createElement('img');
      img.className = 'node-preview-img';
      img.src = it.src;
      img.alt = it.cap;
      img.onmousedown = (e) => e.stopPropagation();
      img.onclick = (e) => { e.stopPropagation(); openImageLightbox(it.src); };
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
          if (src.type === 'text') t = (src.prompt || '').trim();
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
function runSaveNode(node) {
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
    galleryImgs.forEach((src, idx) => {
      const m = String(src).match(/data:image\/(\w+);/i);
      const ext = (m && m[1]) ? m[1] : 'png';
      downloadDataURL(src, filename + '_' + (idx + 1) + '.' + ext);
    });
    showToast('已保存 ' + galleryImgs.length + ' 张图片（逐张分开）', 'success');
    node.status = 'done';
    return;
  }

  const inData = collectSaveInputs(node);
  const imgIn = inData.find(d => d && d.type === 'image' && typeof d.value === 'string');
  const textIn = inData.find(d => d && d.type === 'text' && typeof d.value === 'string');

  if (imgIn && /^data:image\//i.test(imgIn.value)) {
    const m = imgIn.value.match(/data:image\/(\w+);/i);
    const ext = (m && m[1]) ? m[1] : 'png';
    downloadDataURL(imgIn.value, filename + '.' + ext);
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


function buildNodeBody(el, node) {
  // 移除旧的 body / preset-row / controls / toolbar / ports / preview
  el.querySelectorAll('.node-body, .node-preset-row, .node-controls, .node-toolbar, .node-port, .node-dataflow, .node-preview-area')
    .forEach(n => n.remove());

  const def = node.def;
  const hasPrompt = ['aiImage', 'aiVideo'].includes(node.type);
  const hasThumb = ['image', 'aiImage', 'aiVideo', 'upscale', 'compare', 'videoInput'].includes(node.type);
  const hasControls = ['aiImage', 'aiVideo'].includes(node.type);
  const hasToolbar = ['image', 'aiImage', 'aiVideo', 'upscale'].includes(node.type);

  // —— body: 缩略图 + 提示词 ——
  let body = null;
  if (hasThumb || hasPrompt) {
    body = document.createElement('div');
    body.className = 'node-body';

    if (hasThumb) {
      const thumbRow = document.createElement('div');
      thumbRow.className = 'node-thumb-row';

      // 缩略图行：同时展示上游输入图（图一/图二…）与本节点图
      const inputImages = [];
      (def.inputs || []).forEach((p, i) => {
        const pl = node.inputsData[i];
        if (pl && pl.type === 'image' && typeof pl.value === 'string' && pl.value.startsWith('data:')) {
          inputImages.push({ src: pl.value, label: '图' + cnNum(inputImages.length + 1), readonly: true });
        }
      });
      const ownThumb = node.thumb ? { src: node.thumb, label: inputImages.length ? '本图' : '', readonly: false } : null;
      const displayImages = ownThumb ? [...inputImages, ownThumb] : inputImages;

      if (displayImages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'node-thumb-empty';
        empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8h10"/></svg>';
        empty.onclick = (e) => {
          e.stopPropagation();
          if (node.type === 'image') {
            openImageFilePicker(node);
          } else if (node.type === 'videoInput') {
            openVideoFilePicker(node);
          } else {
            var _seed = parseInt(node.id.replace(/\D/g, '')) || 1;
            node.thumb = createPlaceholderDataURL(36, 36, _seed, node.title);
            buildNodeBody(el, node);
            markEdgesDirty();
            scheduleAutosave();
          }
        };
        empty.onmousedown = (e) => e.stopPropagation();
        if (node.type === 'videoInput') {
          empty.classList.add('video');
          empty.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="9" height="8" rx="1.5"/><path d="M11 7l3-2v6l-3-2"/></svg>';
        }
        thumbRow.appendChild(empty);
      } else {
        displayImages.forEach((imgInfo) => {
          const wrap = document.createElement('div');
          wrap.className = 'node-thumb-wrap';

          const thumb = document.createElement('div');
          thumb.className = 'node-thumb';
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

      // 提示词 (AI 类型)
      if (hasPrompt) {
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
        thumbRow.appendChild(promptArea);
      }

      body.appendChild(thumbRow);
    }
  } else if (node.type === 'text') {
    // 纯文本输入节点 + 模型选择 + API Key（与 AI 设计助手联动）
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

    // 文本输入区（按内容自适应高度，封顶 320px 内部滚动）
    const textarea = document.createElement('textarea');
    textarea.className = 'node-textarea';
    textarea.placeholder = '输入文本内容...';
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
    textBody.appendChild(textarea);
    // 初始按已有内容自适应
    setTimeout(autoResize, 0);

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
      img.src = imgIn.value;
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
      : ['Sora 2', 'Veo 3', '可灵 2.0', 'Runway Gen-4', '即梦 3.0'];
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'GPT Image 2' ? m + '（真实出图）' : m + '（演示）';
      modelSel.appendChild(opt);
    });
    modelSel.value = node.params.model;
    // 旧存档或默认 model 与当前类型模型列表不匹配时，归正到第一个可用模型
    if (!models.includes(node.params.model)) {
      node.params.model = models[0];
    }
    modelSel.value = node.params.model;
    modelSel.onchange = (e) => { node.params.model = e.target.value; scheduleAutosave(); };
    modelSel.onmousedown = (e) => e.stopPropagation();
    controls.appendChild(modelSel);

    // 参数下拉选择：比例 / 分辨率 / (张数 | 时长) / 模式
    const isVideoNode = node.type === 'aiVideo';
    const paramSelects = [
      { key: 'aspect',     label: '比例',   options: ['1:1', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] },
      { key: 'resolution', label: '分辨率', options: ['高清1K', '超清2K', '原画4K'] },
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
    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';

    // 图片输入节点：额外提供"上传图片"按钮
    if (node.type === 'image') {
      const upBtn = document.createElement('button');
      upBtn.className = 'tool-btn tool-btn-upload';
      upBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 10V3M5 6l3-3 3 3M3 13h10"/></svg>';
      upBtn.title = '上传图片';
      upBtn.onclick = (e) => { e.stopPropagation(); openImageFilePicker(node); };
      upBtn.onmousedown = (e) => e.stopPropagation();
      toolbar.appendChild(upBtn);
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
    el.appendChild(toolbar);
  }

  // —— 底部图片预览区 ——
  renderImagePreviewSection(el, node);

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
}

function updateNodeStatus(node) {
  if (!node.el) return;
  const dot = node.el.querySelector('.node-status-dot');
  if (dot) dot.className = 'node-status-dot ' + node.status;

  const pill = node.el.querySelector('.node-status-pill');
  if (pill) {
    pill.className = 'node-status-pill ' + node.status;
    const labelMap = { idle: '待运行', running: '运行中', done: '已完成', error: '失败' };
    pill.textContent = labelMap[node.status] || node.status;
  }

  if (node.status === 'running') {
    node.el.classList.add('running');
  } else {
    node.el.classList.remove('running');
  }

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
      prompt: node.prompt,
      params: { ...node.params },
      status: node.status,
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

function selectNode(node) {
  workflow.selection.forEach(id => {
    const n = workflow.nodes.get(id);
    if (n && n.el) n.el.classList.remove('selected');
  });
  workflow.selection.clear();
  workflow.selection.add(node.id);
  node.el.classList.add('selected');
  node.el.style.zIndex = (++workflow.nextZ).toString();
}

//================ 9. 节点拖拽 ================
let dragContext = null;

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
    // 以主键计算吸附后的有效位移，整组共用，保持相对位置不变
    let rawX = group[0].ox + dx;
    let rawY = group[0].oy + dy;
    if (!e2.shiftKey) {
      const snapped = snapNodePosition(group[0].n, rawX, rawY);
      rawX = snapped.x;
      rawY = snapped.y;
    }
    const effDx = rawX - group[0].ox;
    const effDy = rawY - group[0].oy;
    group.forEach(g => {
      const nx = g.ox + effDx;
      const ny = g.oy + effDy;
      g.n.x = nx;
      g.n.y = ny;
      g.n.el.style.left = nx + 'px';
      g.n.el.style.top = ny + 'px';
    });
    markEdgesDirty();
    renderMinimap();
  };
  const onUp = () => {
    group.forEach(g => g.n.el && g.n.el.classList.remove('dragging'));
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (moved) {
      scheduleAutosave();
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
    const newW = Math.max(minW, Math.min(maxW, origW + dw));
    const newH = Math.max(minH, Math.min(maxH, origH + dh));
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
    runWorkflow();
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
  if (e.target.closest('.ai-panel, .context-menu, .modal, .minimap, button, input, textarea, select, a, label, [contenteditable="true"], [role="button"]')) return;

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
    workflow.nodes.forEach(node => {
      if (!node.el) return;
      const nr = node.el.getBoundingClientRect();
      if (nr.left < band.right && nr.right > band.left && nr.top < band.bottom && nr.bottom > band.top) {
        workflow.selection.add(node.id);
        node.el.classList.add('selected');
      }
    });
    if (rubberEl && rubberEl.parentNode) rubberEl.parentNode.removeChild(rubberEl);
    rubberEl = null;
    isBoxSelecting = false;
    selDragStart = null;
  } else if (selDragStart) {
    // 单击空白（未拖动）→ 清除选中
    workflow.selection.forEach(id => {
      const n = workflow.nodes.get(id);
      if (n && n.el) n.el.classList.remove('selected');
    });
    workflow.selection.clear();
    selDragStart = null;
  }
});

window.addEventListener('keydown', (e) => {
  // 录制快捷键时优先交给录制处理器
  if (recordingShortcut) {
    handleShortcutsRecording(e);
    return;
  }

  if (e.code === 'Space' && !e.target.closest('input, textarea')) {
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

  // 深色背景
  ctx.fillStyle = COLORS.bgDeepest;
  ctx.fillRect(0, 0, w, h);

  // 网点网格 — LOD 策略
  const baseSpacing = 24; // 屏幕像素基础间距
  let spacing = baseSpacing * cam.zoom;
  // 缩放越低间距越大：小于 8px 时倍增直到 ≥ 8px
  while (spacing < 8) spacing *= 2;

  const offsetX = cam.x % spacing;
  const offsetY = cam.y % spacing;

  // 网点颜色：基于 CSS 变量 --grid-line-minor 的 RGB 分量，动态调节透明度
  const alpha = cam.zoom > 1 ? 0.06 : 0.04;
  const c = COLORS.gridDotRGB;
  ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;

  for (let x = offsetX; x < w; x += spacing) {
    for (let y = offsetY; y < h; y += spacing) {
      ctx.fillRect(Math.round(x), Math.round(y), 1.5, 1.5);
    }
  }

  // 原点标记（世界原点 0,0 处的十字）
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

window.addEventListener('resize', () => { resizeCanvases(); });

//================ 12. 连线绘制 (Canvas 贝塞尔) ================
let edgesDirty = false;
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

    // 判断该连线是否承载了真实数据流（上游已产出对应端口数据）
    const hasData = !!(fn.outputsData && fn.outputsData[edge.from.port]);
    const lineColor = hasData ? COLORS.success : COLORS.primary;

    // 贝塞尔曲线 — 颜色读取自 CSS 变量, 线宽 2px (有数据时加粗并带辉光)
    if (hasData) {
      ctx.save();
      ctx.shadowColor = COLORS.success;
      ctx.shadowBlur = 8;
      drawBezier(ctx, fp.x, fp.y, tp.x, tp.y, lineColor, 2.5);
      ctx.restore();
    } else {
      drawBezier(ctx, fp.x, fp.y, tp.x, tp.y, lineColor, 2);
    }

    // 端点实心圆填充
    drawPortDot(ctx, fp.x, fp.y, lineColor);
    drawPortDot(ctx, tp.x, tp.y, lineColor);

    // 标记端口为 connected
    updatePortConnected(fn, 'output', edge.from.port, true);
    updatePortConnected(tn, 'input', edge.to.port, true);
  });

  // 拖拽中临时线（草稿线：虚线 + 半透明）
  if (workflow.pendingConnection) {
    const pc = workflow.pendingConnection;
    const fp = getPortScreenPos(pc.fromNode, pc.fromKind, pc.fromIdx);
    const valid = pc.valid;
    const color = valid ? COLORS.primary : COLORS.danger;

    // 草稿线：虚线
    drawBezierDashed(ctx, fp.x, fp.y, pc.toX, pc.toY, color, 2);
    drawPortDot(ctx, fp.x, fp.y, color);

    // hover 端口高亮
    if (workflow.hoveredPort) {
      const hp = getPortScreenPos(workflow.hoveredPort.node, workflow.hoveredPort.kind, workflow.hoveredPort.idx);
      drawPortDot(ctx, hp.x, hp.y, valid ? COLORS.primary : COLORS.danger, 6);
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
  };

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
            to:   { nodeType: toNodeId, portIdx: parseInt(portEl.dataset.portIdx), kind: toKind, portType: toType },
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

  workflow.pendingConnection.toX = sx;
  workflow.pendingConnection.toY = sy;
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
  markEdgesDirty();
});

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
      try { resolve(cv.toDataURL('image/jpeg', 0.82)); }
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
      node.thumb = thumb;
      node.uploadedImage = raw;          // 保留原图，供真实导出使用
      if (node.el) buildNodeBody(node.el, node);
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
      const poster = cv.toDataURL('image/png');
      node.thumb = poster;
      node.params.name = file.name;
      node.params.duration = formatVideoDuration(vid.duration);
      if (node.el) buildNodeBody(node.el, node);
      markEdgesDirty();
      scheduleAutosave();
      showToast('已载入视频：' + file.name, 'success');
    } catch (err) {
      node.thumb = createPlaceholderDataURL(120, 70, (parseInt(node.id.replace(/\D/g, '')) || 1) + 300, '视频');
      node.params.name = file.name;
      if (node.el) buildNodeBody(node.el, node);
      markEdgesDirty();
      scheduleAutosave();
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  vid.onerror = () => {
    node.thumb = createPlaceholderDataURL(120, 70, (parseInt(node.id.replace(/\D/g, '')) || 1) + 300, '视频');
    node.params.name = file.name;
    if (node.el) buildNodeBody(node.el, node);
    markEdgesDirty();
    scheduleAutosave();
    URL.revokeObjectURL(url);
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
  const innerRadius = 108;
  const outerRadius = 168;
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
  if (files && files.length && files[0].type && files[0].type.startsWith('image/')) {
    const rect = canvasWrap.getBoundingClientRect();
    const cam = workflow.camera;
    const wx = (e.clientX - rect.left - cam.x) / cam.zoom;
    const wy = (e.clientY - rect.top - cam.y) / cam.zoom;
    const node = addNode('image', wx - 140, wy - 50);
    loadImageFile(files[0], node);
    showToast('已创建图片节点并载入图片', 'success');
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

//================ 16. 拓扑执行引擎 (数据流动骨架 A2) ================
// 数据载荷统一结构: { type:'image'|'text'|'video'|'audio', value:<内容>, ... }
//  image  → value 为 dataURL 字符串
//  text   → value 为字符串
//  video  → value 为 { poster, duration, ... }
//  audio  → value 为 { name, duration, ... }

// 清空某节点的运行数据（连线结构变化时调用，避免脏数据残留）
function resetNodeData(node) {
  node.inputsData = (node.def.inputs || []).map(() => null);
  node.outputsData = (node.def.outputs || []).map(() => null);
  node.status = 'idle';
  if (node.el) {
    buildNodeBody(node.el, node);
    updateNodeStatus(node);
  }
}

// 收集该节点每个输入端口的上游载荷
function gatherInputs(node) {
  const def = node.def;
  const inputs = def.inputs || [];
  node.inputsData = inputs.map(() => null);
  [...workflow.edges.values()].forEach(e => {
    if (e.to.node === node) {
      const src = e.from.node;
      const payload = (src.outputsData && src.outputsData[e.from.port]) || null;
      node.inputsData[e.to.port] = payload;
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
      out[0] = { type: 'image', value: node.thumb || createPlaceholderDataURL(40, 40, seed, 'IMG') };
      break;
    case 'videoInput':
      out[0] = { type: 'video', value: {
        poster: node.thumb || createPlaceholderDataURL(80, 50, seed + 200, ''),
        duration: node.params.duration || '00:12',
        name: node.params.name || '视频'
      } };
      break;
    case 'text':
      out[0] = { type: 'text', value: applyLoopVars((node.prompt || '').trim()) || '(空文本)' };
      break;
    case 'bgm':
      out[0] = { type: 'audio', value: { name: node.params.name, duration: node.params.duration } };
      break;
    case 'aiImage':
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
        : (node.thumb || createPlaceholderDataURL(40, 40, seed + 500, node.def.label));
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
      const basePoster = (upVid && upVid.value && upVid.value.poster)
        ? upVid.value.poster
        : createPlaceholderDataURL(120, 70, seed + 600, '');
      // 关键帧：以占位图代表"拆解 N 帧"的合集，可作为下游图片输入
      out[0] = { type: 'image', value: upVid && upVid.value && upVid.value.poster
        ? upVid.value.poster
        : createPlaceholderDataURL(120, 120, seed + 600, '拆解' + frames + '帧') };
      // 片段：多段视频
      out[1] = { type: 'video', value: {
        poster: basePoster,
        duration: '片段×' + segs
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
  const list = (node.inputsData || []).filter(d => d && d.type === 'image' && typeof d.value === 'string' && d.value.startsWith('data:'));
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

  // 1) 探测本地 ComfyUI 是否可达（loopback 豁免混合内容拦截）
  let reachable = false;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(addr + '/system_stats', { signal: ctrl.signal });
    clearTimeout(to);
    reachable = r.ok;
  } catch (e) { reachable = false; }

  if (!reachable) {
    node.status = 'error';
    node._comfyErr = '未检测到本地 ComfyUI 服务（' + addr + '）。请先启动 ComfyUI（建议加参数 --enable-cors-header *），再运行此节点。';
    showToast(node._comfyErr, 'danger');
    return false;
  }

  // 2) 构建提示词
  let promptObj;
  try {
    promptObj = tmpl.build(values);
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
    const r = await fetch(addr + '/prompt', {
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
      const hr = await fetch(addr + '/history/' + promptId);
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
  const imgs = comfyExtractImages(addr, historyItem);
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
  runBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l9 6-9 6z"/></svg> 运行';
  runBtn.onclick = (e) => { e.stopPropagation(); runNode(node); };
  runBtn.onmousedown = (e) => e.stopPropagation();
  actRow.appendChild(runBtn);
  wrap.appendChild(actRow);

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
    const ta = document.createElement('textarea');
    ta.className = 'comfy-ta'; ta.rows = 2; ta.value = String(cur);
    ta.oninput = (e) => { node.params.fields[f.key] = e.target.value; if (f.key === 'prompt') node.prompt = e.target.value; scheduleAutosave(); };
    ta.onmousedown = (e) => e.stopPropagation();
    row.appendChild(ta);
  } else if (f.type === 'dropdown') {
    const sel = document.createElement('select'); sel.className = 'comfy-sel';
    (f.options||[]).forEach(opt => { const o=document.createElement('option'); o.value=opt; o.textContent=opt; sel.appendChild(o); });
    sel.value = String(cur);
    sel.onchange = (e) => { node.params.fields[f.key] = e.target.value; scheduleAutosave(); };
    sel.onmousedown = (e) => e.stopPropagation();
    row.appendChild(sel);
  } else if (f.type === 'slider') {
    const rng = document.createElement('input'); rng.type='range';
    rng.min = f.min!=null?f.min:0; rng.max = f.max!=null?f.max:100; rng.step = f.step!=null?f.step:1; rng.value = cur;
    const out = document.createElement('span'); out.className='comfy-range-val'; out.textContent = cur;
    rng.oninput = (e) => { out.textContent = e.target.value; node.params.fields[f.key] = parseFloat(e.target.value); scheduleAutosave(); };
    rng.onmousedown = (e) => e.stopPropagation();
    row.appendChild(rng); row.appendChild(out);
  } else if (f.type === 'boolean') {
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = !!cur;
    chk.onchange = (e) => { node.params.fields[f.key] = e.target.checked; scheduleAutosave(); };
    chk.onmousedown = (e) => e.stopPropagation();
    row.appendChild(chk);
  } else {
    const inp = document.createElement('input'); inp.type = (f.type === 'number') ? 'number' : 'text';
    inp.className = 'comfy-inp'; inp.value = cur;
    if (f.min != null) inp.min = f.min;
    if (f.max != null) inp.max = f.max;
    inp.oninput = (e) => { node.params.fields[f.key] = (f.type === 'number') ? e.target.value : e.target.value; scheduleAutosave(); };
    inp.onmousedown = (e) => e.stopPropagation();
    row.appendChild(inp);
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
    if (window.FlowCraft && window.FlowCraft.nodes && window.FlowCraft.nodes.beforeRun) {
      const br = window.FlowCraft.nodes.beforeRun(node);
      if (!br.ok) {
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
          node.status = 'done';
          logRun(node, true, Date.now() - _t0);
          if (node.el) buildNodeBody(node.el, node);
          updateNodeStatus(node);
          markEdgesDirty();
          scheduleAutosave();
          resolve();
          return;
        }

        // 上游文本输入 → 生成提示词（连线传词优先于节点内手输）
        if (node.type === 'aiImage' || node.type === 'aiVideo') {
          const textIn = (node.inputsData || []).find(d => d && d.type === 'text');
          const upText = textIn && textIn.value && textIn.value !== '(空文本)' ? String(textIn.value).trim() : '';
          node.effectivePrompt = applyLoopVars(upText || (node.prompt || '').trim());
        }

        // 保存节点：实际触发本地下载
        if (node.type === 'save') {
          runSaveNode(node);
          if (node.el) buildNodeBody(node.el, node);
          updateNodeStatus(node);
          markEdgesDirty();
          scheduleAutosave();
          resolve();
          return;
        }

        // 智能超清 / 线稿：基于上游真实图片做图生图（img2img）
        // 有上游图且配置了 OpenAI Key 时调用 images/edits；否则 / 失败时回退到下方 computeNodeOutput（保留原图透传）。
        if (node.type === 'upscale' || node.type === 'lineart') {
          const upImg = getNodeInputImage(node);
          const editKey = localStorage.getItem(OPENAI_KEY_STORAGE);
          if (upImg && editKey) {
            try {
              const edited = await generateOpenAIImageEdit(node, upImg);
              if (edited) {
                node.thumb = edited;
                node.outputsData = [{ type: 'image', value: edited }];
                node._galleryImages = [edited];
                node.status = 'done';
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
          // 无上游图 / 未配置 Key / 接口不支持 → 走下方 computeNodeOutput 回退（保留原图 / 占位）
        }

        // ComfyUI 节点：浏览器直连本地 ComfyUI
        if (node.type === 'comfyui') {
          const ok = await runComfyUINode(node);
          node.status = ok ? 'done' : 'error';
          logRun(node, ok, Date.now() - _t0, ok ? '' : (node._comfyErr || 'ComfyUI 运行失败'));
          if (node.el) buildNodeBody(node.el, node);
          updateNodeStatus(node);
          markEdgesDirty();
          scheduleAutosave();
          resolve();
          return;
        }

        const isGptImage = node.type === 'aiImage' && node.params && node.params.model === 'GPT Image 2';
        if (isGptImage) {
          // 真实调用 gpt-image-2 生成图片
          const img = await generateOpenAIImage(node);
          if (!img) { resolve(); return; } // 失败时状态已置 error
          node.thumb = img;
          node.outputsData = [{ type: 'image', value: img }];
        } else {
          const out = computeNodeOutput(node);
          node.outputsData = out;

          // 图片类节点：把产出图片同步到缩略图，直观体现"继承上游"
          const imgOut = out.find(d => d && d.type === 'image');
          const imgTypes = ['image', 'aiImage', 'upscale', 'lineart', 'aiSet', 'material', 'light', 'layout', 'videoBreak'];
          if (imgOut && imgOut.value && typeof imgOut.value === 'string' && imgOut.value.startsWith('data:')
              && imgTypes.includes(node.type)) {
            node.thumb = imgOut.value;
          }
        }
        node.status = 'done';
        logRun(node, true, Date.now() - _t0);
      } catch (err) {
        node.status = 'error';
        const loc = localizeError(err);
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
function openaiPostJSON(base, path, key, body) {
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
  return cands.find(s => s && s.indexOf('data:') === 0) || cands.find(Boolean) || null;
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
// gpt-image-2 图像生成（候选模型名依次尝试，兼容官方 API 与第三方中转）
// 失败根因：部分服务不认 "gpt-image-2" 这个模型名（官方为 gpt-image-1 / dall-e-3），
// 原代码只在这个名字上重试不同接口，两端都失败 → 生成失败。
var OPENAI_IMAGE_MODELS = ['gpt-image-2', 'image', 'gpt-image-1', 'dall-e-3'];

// 根据「比例 + 分辨率」挑选 API 支持的具体尺寸
// gpt-image-1 官方支持：1024x1024 / 1024x1536 / 1536x1024 / 1536x1536 / 1536x2048 / 2048x1024 / 2048x1536 / 2048x2048
// 第三方中转（gpt-image-2）可能支持更大的尺寸
function pickOpenAISize(aspect, resolution) {
  const ar = aspect || '1:1';
  if (resolution === '超清2K' || resolution === '原画4K') {
    const m = {
      '1:1': '2048x2048', '16:9': '2048x1152', '9:16': '1152x2048',
      '3:2': '1920x1280', '3:4': '1024x1536', '4:3': '2048x1536', '21:9': '1920x822'
    };
    return m[ar] || '2048x2048';
  }
  const m = {
    '1:1': '1024x1024', '16:9': '1536x1024', '9:16': '1024x1536',
    '3:2': '1536x1024', '3:4': '1024x1536', '4:3': '1536x1024', '21:9': '1536x1024'
  };
  return m[ar] || '1024x1024';
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
      const img = item.b64_json ? 'data:image/png;base64,' + item.b64_json : (item.url || null);
      if (!img) throw new Error('未获取到图片');
      return img;
    });
}

// 依次尝试候选模型名：每个先走 /images/generations，遇 404/不支持回退 /responses，再失败换下一个模型名
function openAIImageWithFallback(base, key, prompt, count, size) {
  var lastErr = null;
  var attempts = [];
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
        if (shouldFallbackToResponses(err)) {
          return generateOpenAIImageViaResponses(base, key, m, prompt, 1)
            .then(function(imgs) {
              if (count > 1) {
                var extra = [];
                for (var j = 1; j < count; j++) extra.push(generateOpenAIImageViaResponses(base, key, m, prompt, 1));
                return Promise.all(extra).then(function(gs) {
                  var all = imgs.concat.apply(imgs, gs);
                  return all.slice(0, count);
                }).catch(function() { return imgs; });
              }
              return imgs;
            })
            .catch(function(err2) { lastErr = err2; return attempt(rest); });
        }
        return attempt(rest);
      });
  }
  return attempt(OPENAI_IMAGE_MODELS.slice());
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
    const img = it.b64_json ? 'data:image/png;base64,' + it.b64_json : (it.url || null);
    if (!img) throw new Error('未获取到图片');
    return img;
  });
}

// 依次尝试：候选模型 × (多图 image[] → 单图 image)，全失败则抛出
function generateImageWithRefs(base, key, prompt, images, count, size) {
  const models = ['gpt-image-1', 'gpt-image-2', 'dall-e-2'];
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

function generateOpenAIImage(node) {
  const key = localStorage.getItem(OPENAI_KEY_STORAGE);
  if (!key) {
    node.status = 'error';
    showToast('未配置 OpenAI API Key：请打开 AI 助手面板 → 模型选「GPT Image 2」→ 点 ⚙ 填入 API Key', 'warn');
    return Promise.resolve(null);
  }
  const prompt = (node.effectivePrompt || node.prompt || '').trim();
  if (!prompt) {
    node.status = 'error';
    showToast('请先输入提示词（或在节点内输入）', 'warn');
    return Promise.resolve(null);
  }
  const base = normalizeApiBase(localStorage.getItem(OPENAI_BASE_STORAGE));
  const countMap = { '1张': 1, '2张': 2, '4张': 4, '6张': 6, '8张': 8 };
  const count = countMap[node.params.count] || 1;
  const size = pickOpenAISize(node.params.aspect, node.params.resolution);

  node.status = 'running';
  updateNodeStatus(node);

  // 解析 <<<名称>>> 引用令牌 → 命中的资产图作为参考图随请求发送
  const ref = resolveRefTokens(prompt);
  node._refInfo = { hit: ref.refs.length, missing: ref.missing.length, names: ref.refs.map(function(r) { return r.name; }) };
  if (ref.missing.length) {
    showToast('有 ' + ref.missing.length + ' 个引用未在素材库找到：' + ref.missing.join('、') +
      '（在素材库给对应素材填名称并点「设为资产」）', 'warn');
  }

  function finish(imgs) {
    node._galleryImages = imgs.slice();
    if (count > 1) {
      return composeImageGrid(imgs, node.params.aspect).then(function(grid) {
        node._imageCount = imgs.length;
        return grid;
      });
    }
    return imgs[0];
  }
  function plain() {
    return openAIImageWithFallback(base, key, prompt, count, size).then(finish);
  }

  let task;
  if (ref.refs.length) {
    showToast('已引用 ' + ref.refs.length + ' 个资产（' + ref.refs.map(function(r) { return r.name; }).join('、') +
      '），参考图将随请求一起发送', 'info');
    task = generateImageWithRefs(base, key, ref.augmented, ref.images, count, size)
      .then(finish)
      .catch(function(err) {
        showToast('带参考图生成失败，已回退为纯文本生成：' + describeOpenAIError(err), 'warn');
        return plain();
      });
  } else {
    task = plain();
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
    const img = it.b64_json ? 'data:image/png;base64,' + it.b64_json : (it.url || null);
    if (!img) throw new Error('未获取到图片');
    return img;
  });
}

// 根据节点类型构造图生图提示词
function buildImg2ImgPrompt(node) {
  const extra = (node.prompt || '').trim();
  const base = extra ? extra + '. ' : '';
  if (node.type === 'upscale') {
    return base + 'Upscale this image to higher resolution (2x), enhance sharpness and fine details, ' +
      'preserve the original composition, subjects, colors and artistic style. Clean, photorealistic, no distortion.';
  }
  // lineart：提取为干净黑白线稿
  return base + 'Convert this image into clean black-and-white line art / sketch on a white background. ' +
    'Use smooth, continuous outlines in an anime illustration line-drawing style. ' +
    'Remove all colors and shading. Keep all structural and detail lines.';
}

// 图生图主入口：依次尝试候选模型，全部失败则抛出（调用方捕获并回退）
function generateOpenAIImageEdit(node, imageDataUrl) {
  const key = localStorage.getItem(OPENAI_KEY_STORAGE);
  if (!key) return Promise.resolve(null);
  const base = normalizeApiBase(localStorage.getItem(OPENAI_BASE_STORAGE));
  const prompt = buildImg2ImgPrompt(node);
  const aspect = node.params.aspect || '1:1';
  const resolution = node.type === 'upscale' ? '超清2K' : '高清1K';
  const size = pickOpenAISize(aspect, resolution);
  const models = ['gpt-image-1', 'gpt-image-2', 'dall-e-2'];
  let lastErr = null;
  function attempt(ms) {
    if (!ms.length) {
      const e = new Error((lastErr && lastErr.message) || '图生图接口不支持当前模型');
      e.tried = models.join(' / ');
      throw e;
    }
    const m = ms[0];
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
  return img ? img.value : null;
}

//================ 16b. 循环节点驱动逻辑 ================
// 当前循环迭代上下文（仅循环运行期间有效，循环外为 null）
let LOOP_STATE = null;

// 判断值是否为 data: 图片
function isDataImage(v) {
  return typeof v === 'string' && v.indexOf('data:image') === 0;
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
async function runInOrder(order, delay, skipSet) {
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
      return executeNodeAsync(node, delay);
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
async function runWorkflow() {
  const order = topoSortNodes();
  if (order.length === 0) {
    showToast('画布中没有可运行的节点', 'info');
    return;
  }
  // 重置所有节点状态，给出干净的反馈
  order.forEach(n => {
    if (n.el) { n.status = 'idle'; updateNodeStatus(n); }
  });
  window.__loopSkip = computeLoopSkip();
  await runInOrder(order, 550, window.__loopSkip);
  window.__loopSkip = new Set();
  markEdgesDirty();
  refreshAssetPanelIfOpen();
  showToast('工作流执行完成 · 数据已沿连线流动', 'success');
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
  { label: 'AI 生成', types: ['aiImage', 'aiVideo', 'aiSet'] },
  { label: '文本 / 提示词', types: ['text', 'script'] },
  { label: '素材 / 处理', types: ['image', 'videoInput', 'lineart', 'upscale', 'compare', 'material', 'light', 'layout'] },
  { label: '视频成片', types: ['videoBreak', 'footage', 'voiceover', 'subtitle', 'bgm', 'compose', 'publish'] },
  { label: '高级 / 本地', types: ['loop', 'comfyui'] },
  { label: '输出', types: ['save'] },
];
let _ctxWorld = { x: 0, y: 0 };

const CTX_COMMON_TYPES = ['aiImage', 'aiVideo', 'text', 'image', 'upscale', 'save'];

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
    addMenuItem('删除节点', MENU_ICONS.delete, getShortcutDisplay(keybindings.deleteSelected), () => deleteNode(node.id), true);
    addMenuSeparator();
    addMenuItem('置于顶层', MENU_ICONS.front, '', () => bringToFront(node));
    addMenuItem('置于底层', MENU_ICONS.back, '', () => sendToBack(node));
    addMenuSeparator();
    if (node.type === 'aiImage' || node.type === 'aiVideo') {
      addMenuItem('运行节点', MENU_ICONS.run, '', () => runNode(node));
    }
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
  if (node) selectNode(node);
  if (node) showContextMenu(e.clientX, e.clientY, node);
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
  buildNodeBody(newNode.el, newNode);
  selectNode(newNode);
  markEdgesDirty();
  scheduleAutosave();
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
  document.getElementById('btnImport').onclick = () => document.getElementById('importFileInput').click();
  document.getElementById('btnClearSave').onclick = () => {
    if (confirm('确定清空已保存数据？这将无法恢复之前自动保存的画布状态。')) {
      clearSavedData();
    }
  };
  document.getElementById('btnRunAll').onclick = () => runWorkflow();
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
  document.getElementById('btnAssets').onclick = () => {
    toggleAssetPanel();
  };
  document.getElementById('workflowClose').onclick = () => toggleWorkflowPanel(false);
  document.getElementById('workflowOverlay').onclick = () => toggleWorkflowPanel(false);
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

  // 尝试从 localStorage 恢复
  const restored = restoreFromStorage();

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
});

//================ 19. AI 面板交互逻辑 ================

// --- AI 面板状态 ---
var aiCurrentModel = 'gpt-5.4';
var aiIsGenerating = false;
// Deepseek 对话上下文（仅真实模型使用）
var aiConversation = [];
var DEEPSEEK_KEY_STORAGE = 'flowcraft-deepseek-key';
var OPENAI_KEY_STORAGE = 'flowcraft-openai-key';
var OPENAI_BASE_STORAGE = 'flowcraft-openai-base';
var OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';
var SYSTEM_PROMPT = '你是 FlowCraft 的 AI 设计助手，专注于室内设计、参考图构思、线稿、材质、灯光与布局方案。' +
  '请用简洁、专业、可操作的中文回答，必要时给出步骤清单或要点。不要编造不确定的事实。';
var AI_MODEL_NAMES = {
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.5-openai-compact': 'GPT-5.5 Compact',
  'gpt-5.6-luna': 'GPT-5.6 Luna',
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-sonnet-4-6-thinking': 'Claude Sonnet 4.6 Thinking',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-opus-4-6-thinking': 'Claude Opus 4.6 Thinking',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-opus-5': 'Claude Opus 5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-fable-5': 'Claude Fable 5',
  'claude-ccmax': 'Claude CCMax',
  'gemini-3-flash-preview': 'Gemini 3 Flash',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'gemini-3-pro-image-preview': 'Gemini 3 Pro Image',
  'gemini-3.1-flash-image-preview': 'Gemini 3.1 Flash Image',
  'gemini-anti': 'Gemini Anti',
  'gemini-anti-0.25': 'Gemini Anti 0.25',
  'grok-4': 'Grok 4',
  'grok-4-deepsearch': 'Grok 4 DeepSearch',
  'grok-4.3': 'Grok 4.3',
  'grok-4.3-fast': 'Grok 4.3 Fast',
  'grok-4.5': 'Grok 4.5',
  'grok-4.5-fast': 'Grok 4.5 Fast',
  'grok-420-fast': 'Grok 420 Fast',
  'grok-420-thinking': 'Grok 420 Thinking',
  'grok-auto': 'Grok Auto',
  'codex': 'Codex',
  'codex-auto-review': 'Codex Auto Review',
  'kiro': 'Kiro',
  'vertex': 'Vertex',
  'default': 'Default',
  'test': 'Test',
  'gpt-image-2': 'GPT Image 2',
  'deepseek': 'DeepSeek V3'
};
// 模型列表（由 AI_MODEL_NAMES 生成，保证与下拉框一致）
// shortLabel 用于文本节点等紧凑场景；label 走 AI_MODEL_NAMES 全称
var AI_MODELS = Object.keys(AI_MODEL_NAMES).map(function(k) {
  var shorts = {
    'gpt-5.4': 'GPT-5.4', 'gpt-5.4-mini': 'GPT-5.4 Mini', 'gpt-5.5': 'GPT-5.5',
    'gpt-5.5-openai-compact': 'GPT-5.5 C', 'gpt-5.6-luna': 'GPT-5.6 Luna', 'gpt-5.6-sol': 'GPT-5.6 Sol',
    'gpt-5.6-terra': 'GPT-5.6 Terra', 'claude-sonnet-4-6': 'Sonnet 4.6', 'claude-sonnet-4-6-thinking': 'Sonnet 4.6T',
    'claude-sonnet-5': 'Sonnet 5', 'claude-opus-4-6': 'Opus 4.6', 'claude-opus-4-6-thinking': 'Opus 4.6T',
    'claude-opus-4-7': 'Opus 4.7', 'claude-opus-4-8': 'Opus 4.8', 'claude-opus-5': 'Opus 5',
    'claude-haiku-4-5': 'Haiku 4.5', 'claude-fable-5': 'Fable 5', 'claude-ccmax': 'CCMax',
    'gemini-3-flash-preview': 'G3 Flash', 'gemini-3.1-pro-preview': 'G3.1 Pro', 'gemini-3-pro-image-preview': 'G3 Pro Img',
    'gemini-3.1-flash-image-preview': 'G3.1 Flash Img', 'gemini-anti': 'G-Anti', 'gemini-anti-0.25': 'G-Anti 0.25',
    'grok-4': 'Grok 4', 'grok-4-deepsearch': 'Grok 4 DS', 'grok-4.3': 'Grok 4.3', 'grok-4.3-fast': 'Grok 4.3 F',
    'grok-4.5': 'Grok 4.5', 'grok-4.5-fast': 'Grok 4.5 F', 'grok-420-fast': 'Grok 420 F', 'grok-420-thinking': 'Grok 420T',
    'grok-auto': 'Grok Auto', 'codex': 'Codex', 'codex-auto-review': 'Codex Review', 'kiro': 'Kiro',
    'vertex': 'Vertex', 'default': 'Default', 'test': 'Test', 'gpt-image-2': 'GPT-Img2', 'deepseek': 'DS V3'
  };
  return { value: k, label: AI_MODEL_NAMES[k], shortLabel: shorts[k] || AI_MODEL_NAMES[k] };
});

// --- 全局模型 / API Key 同步（文本输入节点 ⇄ AI 设计助手） ---
// 修改任意一处，另一处自动同步更新
function setGlobalModel(model, sourceEl) {
  aiCurrentModel = model;
  if (aiModelSelect && aiModelSelect.value !== model) aiModelSelect.value = model;
  if (typeof updateAISettingsUI === 'function') updateAISettingsUI();
  // 同步所有文本输入节点上的模型下拉
  document.querySelectorAll('.text-node-model').forEach(function(sel) {
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
  var ta = textBody.querySelector('.node-textarea');
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

/**
 * 追加一条 AI 对话消息。
 * @param {string} role - 'user' | 'ai'
 * @param {string} contentHTML - 气泡内 HTML
 * @returns {HTMLElement} 返回 bubble 元素，便于后续替换内容
 */
function appendAIMessage(role, contentHTML) {
  removeAIWelcome();

  var msg = document.createElement('div');
  msg.className = 'ai-message ' + role;

  var avatar = document.createElement('div');
  avatar.className = 'ai-avatar';
  avatar.textContent = role === 'user' ? '我' : 'AI';

  var bubble = document.createElement('div');
  bubble.className = 'ai-bubble';
  bubble.innerHTML = contentHTML;

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
    if (!apiKey) { reject(new Error('请先配置 Deepseek API Key')); return; }

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
  var bubble = appendAIMessage('ai', loadingHTML);

  // 提示词扩写始终走 Deepseek 真实模型，与画布文本节点共用 runPromptEnhance
  var apiKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE);
  if (!apiKey) {
    bubble.innerHTML = '<div class="ai-reply-text">提示词扩写需要 Deepseek API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，配置后即可一键扩写。</div>';
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
        bubble.innerHTML = '<div class="ai-reply-text">' + escapeHtml(t).replace(/\n/g, '<br>') + '</div>';
        scrollAIToBottom();
      }
    }
  })
    .then(function(reply) {
      if (reply) {
        bubble.innerHTML = '<div class="ai-reply-text">' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div>';
      } else {
        bubble.innerHTML = '<div class="ai-reply-text">扩写结果为空</div>';
      }
      scrollAIToBottom();
    })
    .catch(function(err) {
      bubble.innerHTML = '<div class="ai-reply-text" style="color:#E15353">扩写失败：' + escapeHtml(err.message) +
        '<br>请检查 API Key 是否正确、网络是否可访问 api.deepseek.com。</div>';
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
  var bubble = appendAIMessage('ai', loadingHTML);

  // GPT Image 2 真实图像生成分支
  if (aiCurrentModel === 'gpt-image-2') {
    generateChatImage(text, bubble);
    return;
  }

  // Deepseek 真实调用分支
  if (aiCurrentModel === 'deepseek') {
    var apiKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE);
    if (!apiKey) {
      bubble.innerHTML = '<div class="ai-reply-text">尚未配置 Deepseek API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，配置后即可使用 Deepseek 真实回复。</div>';
      scrollAIToBottom();
      aiIsGenerating = false;
      aiSendBtn.disabled = false;
      return;
    }
    aiConversation.push({ role: 'user', content: text });
    callDeepseek(apiKey, bubble);
    return;
  }

  // 其他模型：经中转真实对话（OpenAI 格式 chat/completions）
  aiConversation.push({ role: 'user', content: text });
  callRelayChat(aiCurrentModel, bubble);
}


// GPT Image 2 聊天图像生成（AI 助手对话内直接出图）
function generateChatImage(text, bubble) {
  var key = localStorage.getItem(OPENAI_KEY_STORAGE);
  if (!key) {
    bubble.innerHTML = '<div class="ai-reply-text">尚未配置 OpenAI API Key。请点击面板右上角的 ⚙ 图标粘贴你的 Key 并保存，即可使用 GPT Image 2 生成图片。</div>';
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    return;
  }
  var base = normalizeApiBase(localStorage.getItem(OPENAI_BASE_STORAGE));
  var prompt = text.trim();
  if (!prompt) {
    bubble.innerHTML = '<div class="ai-reply-text">请输入要生成的画面描述。</div>';
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    return;
  }
  openAIImageWithFallback(base, key, prompt, 2)
  .then(function(imgs) {
    if (!imgs || !imgs.length) throw new Error('未获取到图片');
    var html = imgs.map(function(src) {
      return '<img src="' + src + '" alt="GPT Image 2 生成结果">';
    }).join('');
    bubble.innerHTML = '<div class="ai-reply-text">已根据您的描述生成：</div><div class="ai-gen-images">' + html + '</div>';
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
  })
  .catch(function(err) {
    bubble.innerHTML = '<div class="ai-reply-text" style="color:#E15353">GPT Image 2 生成失败：' + escapeHtml(describeOpenAIError(err)) +
      '（已尝试模型：' + (err.tried || OPENAI_IMAGE_MODELS.join(' / ')) + '）。' +
      '<br>请检查 API Key、⚙ 中自定义 API 地址，或当前服务是否支持 gpt-image-2 / gpt-image-1 / dall-e-3。</div>';
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
  });
}

// --- 中转对话（OpenAI 格式 /chat/completions，支持 GPT/Claude/Gemini/Grok 等）---
function callRelayChat(model, bubble) {
  var key = localStorage.getItem(OPENAI_KEY_STORAGE);
  if (!key) {
    bubble.innerHTML = '<div class="ai-reply-text">尚未配置中转 API Key。请点击面板右上角的 ⚙ 图标粘贴你的中转 Key 并保存，即可使用 ' + escapeHtml(model) + ' 真实回复。</div>';
    scrollAIToBottom();
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
    if (aiConversation.length && aiConversation[aiConversation.length - 1].role === 'user') aiConversation.pop();
    return;
  }
  var base = normalizeApiBase(localStorage.getItem(OPENAI_BASE_STORAGE));
  var messages = [{ role: 'system', content: SYSTEM_PROMPT }].concat(aiConversation);
  fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: model, messages: messages, stream: false })
  })
  .then(function(resp) {
    if (!resp.ok) {
      return resp.text().then(function(t) { throw new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 120) : '')); });
    }
    return resp.json();
  })
  .then(function(data) {
    var reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '（' + model + ' 返回内容为空）';
    aiConversation.push({ role: 'assistant', content: reply });
    bubble.innerHTML = '<div class="ai-reply-text">' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div>';
    scrollAIToBottom();
  })
  .catch(function(err) {
    bubble.innerHTML = '<div class="ai-reply-text" style="color:#E15353">调用 ' + escapeHtml(model) + ' 失败：' + escapeHtml(err && err.message || err) +
      '<br>请检查中转 API Key、⚙ 中的 API 地址，或该模型是否可用。</div>';
    if (aiConversation.length && aiConversation[aiConversation.length - 1].role === 'user') aiConversation.pop();
    scrollAIToBottom();
  })
  .finally(function() {
    aiIsGenerating = false;
    aiSendBtn.disabled = false;
  });
}

// --- Deepseek SSE 流式调用（逐字增量输出）---
// 返回 Promise<string>（完整文本）；onText(accumulated) 在每收到一段增量时回调，用于实时渲染。
function streamDeepseek(apiKey, messages, onText) {
  return fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      stream: true
    })
  })
  .then(function(resp) {
    if (!resp.ok) {
      return resp.text().then(function(t) {
        throw new Error('HTTP ' + resp.status + (t ? '：' + t.slice(0, 200) : ''));
      });
    }
    // 环境不支持流式读取（无 body/reader）→ 回退一次性 JSON
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
      bubble.innerHTML = '<div class="ai-reply-text">' + escapeHtml(text).replace(/\n/g, '<br>') + '</div>';
      scrollAIToBottom();
    }
  })
  .then(function(reply) {
    var finalText = reply || '（Deepseek 返回内容为空）';
    aiConversation.push({ role: 'assistant', content: finalText });
    bubble.innerHTML = '<div class="ai-reply-text">' + escapeHtml(finalText).replace(/\n/g, '<br>') + '</div>';
    scrollAIToBottom();
  })
  .catch(function(err) {
    bubble.innerHTML = '<div class="ai-reply-text" style="color:#E15353">调用 Deepseek 失败：' + escapeHtml(err.message) +
      '<br>请检查 API Key 是否正确、网络是否可访问 api.deepseek.com。</div>';
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
    aiSettingsBtn.title = aiCurrentModel === 'deepseek' || aiCurrentModel === 'gpt-image-2'
      ? '配置 ' + name + ' API Key'
      : 'API 设置（Deepseek / OpenAI）';
  }
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
    openaiBaseInput.value = localStorage.getItem(OPENAI_BASE_STORAGE) || '';
    syncOpenAIBasePreset();
    deepseekKeyInput.focus();
  }
});

var openaiKeyInput = document.getElementById('openaiKeyInput');
var openaiKeySave = document.getElementById('openaiKeySave');
var openaiBaseInput = document.getElementById('openaiBaseInput');
var openaiKeyStatus = document.getElementById('openaiKeyStatus');
var openaiBasePreset = document.getElementById('openaiBasePreset');

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

// 打开设置面板时同步预设下拉与当前地址
function syncOpenAIBasePreset() {
  var cur = localStorage.getItem(OPENAI_BASE_STORAGE) || '';
  var opts = Array.from(openaiBasePreset.options).map(o => o.value).filter(Boolean);
  openaiBasePreset.value = opts.indexOf(cur) >= 0 ? cur : '';
}

openaiKeySave.addEventListener('click', function() {
  var val = openaiKeyInput.value.trim();
  if (!val) localStorage.removeItem(OPENAI_KEY_STORAGE);
  else localStorage.setItem(OPENAI_KEY_STORAGE, val);
  var base = openaiBaseInput.value.trim().replace(/\/+$/, '');
  if (!base) localStorage.removeItem(OPENAI_BASE_STORAGE);
  else localStorage.setItem(OPENAI_BASE_STORAGE, base);
  openaiKeyStatus.textContent = val ? '已保存到本机浏览器。' : '已清除本地 Key。';
  openaiKeyStatus.className = 'ai-settings-status ok';
  aiSettingsPanel.classList.remove('open');
});

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
});

init();
