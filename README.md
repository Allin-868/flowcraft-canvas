# FlowCraft · AI 工作流编辑器（无限画布）

FlowCraft —— 基于无限画布的 AI 生图工作流编辑器（单文件 HTML，零依赖）。版本口径见 `package.json`，产物由 `build.mjs` 从 `src/` 生成。

## 功能

- 无限画布：拖拽节点、缩放平移（滚轮/触控板）、网格背景
- 节点类型：图片输入、文本输入、AI 绘图、AI 视频、智能超清、对比、保存
- 连线、右键菜单、撤销/重做、复制、回收站
- **v2.1 新增**：框选、多选批量操作（Ctrl/Shift+点击）、整组拖拽、对齐/分布工具、缩略图导航、触控板支持、方向键微调
- 数据：localStorage 自动保存 + JSON 导入导出
- 规格（比例·分辨率）：在 composer/参数面板中以触发按钮呈现，点击在画布内打开浮动卡片选择（非全屏模态）；自定义比例为行内 W:H 输入

## 使用

本地直接使用：用浏览器打开仓库根目录的 `index.html`（单文件产物，无需服务器、无需安装）。数据存于浏览器 localStorage / IndexedDB，清站点数据会丢失画布。

> 线上地址状态（2026-09-18 实测）：本仓库尚未发布，`https://<用户名>.github.io/flowcraft-canvas/` 当前返回 404，仓库内也没有任何 Pages / Netlify / Vercel 配置。若要发布：先 `git push`，再在 GitHub 仓库 Settings → Pages 选择 `main` 分支根目录（产物 `index.html` 已在仓库内，无需构建命令）；Netlify / Vercel 则直接把本目录作为静态站点目录上传。

## 部署

静态页面，单文件，可部署到任意静态托管（GitHub Pages / Vercel / 本地服务器）。
## 本地构建与回归（阶段三）

要求：Node.js 20+、npm、当前平台的 esbuild、Playwright 和可用的 Chrome/Chromium。部署仓库的 `node_modules` 如果来自其他操作系统，不能直接复用原生 esbuild；请设置 `ESBUILD_BINARY_PATH` 指向当前平台的 esbuild CLI。

```bash
cd /Users/allin/Workspace/项目/project-001-FlowCraft无限画布/输出成果/deploy
npm ci
npx playwright install chromium
npm run build
npm run verify:security
npm run verify:build
npm run verify:regression
```

`verify:build` 会额外确认 `index.html` 与当前 `src/` 源码严格一致，避免源码改动没有进入部署产物；`verify:security` 与 `verify:regression` 默认运行仓库内 `test/` 的校验脚本。回归闸门包含 77 个不调用真实 AI 的本地 mock/浏览器 smoke test，覆盖真实 / 演示 / 未实现语义、图片比例适配、AI 流水线节点界面、工作流执行机制、编导链路、统一资产底座与设计智能体节点；结果写入 Git 忽略的 `test-results/`。全部用例都在仓库内 `test/` 目录，克隆后自包含，不依赖上层 Workspace 的历史脚本。`test/` 另有 6 个脚本默认不入闸门：性能测量、演示物料生成、需真实 Key 的 3 个属设计如此，其余 3 个是闸门入口与两个单独调用的校验；**登记在案的欠债已清零**（判定与证据保留在 `test/DEBT.md`）。清欠债过程中查出并修复了 9 处产品缺陷（状态节点按钮点不到、冷启动节点元素成倍残留、aiImage 上「同参重试」无用户入口、拖动靠近时候选反馈丢失、开箱模板面板点画布不关闭、场景分组面板点画布不关闭、场景分组用浏览器原生 prompt、「加入选中/加入场景」把 undefined 写进场景成员、节点库徽标吃 fallback 与 registry 脱节）；第 77 条 `verify-responsive.mjs` 钉住响应式窄屏适配（用户 2026-09-20 拍板「先做窄屏适配」，此前该用例存在但未入闸门）：1440/1024/760/390/320 五档断言 html 无横向滚动、`#btnArrange`/`#btnUndo`/折叠按钮可达、≤760px 侧栏改覆盖式抽屉（默认收起、点按钮开合）、minimap 收纳；本轮新增「打开态右滑面板不超视口」断言并修复对应缺陷——320px 实测 `.recycle-panel`(380px,right:0) 打开态左裁 60px、`.run-log-panel`(344px,right:12) 左裁 36px、`.agent-drawer`(380px,right:8) 左裁 68px，修复为在 ≤760px 媒体查询内加宽度帽 `min(380px,100vw)`/`min(344px,calc(100vw-24px))`/`min(380px,calc(100vw-16px))`（`.template-panel` 已有 max-width:94vw 无需处理），前/后对照（修复前 L-60/L-36 红、修复后 L0/L12 绿）构成反向验证；打开态面板为全高模态抽屉、自带可达关闭钮，工具栏 toggle 被其覆盖属模态抽屉预期行为故不调整 z-index/top。第 76 条 `verify-data-reliability.mjs` 钉住阶段 E 数据可靠性压测（用户 2026-09-20 拍板「推进阶段 E」）：把「刷新不丢数据 / 大图不丢 / 写入失败不撒谎 / 快照与 ZIP 往返保真 / 孤儿清理可回滚」这条最容易翻车的主线用真实运行时行为钉死，补齐此前 `verify-storage-faults`（仅静态源码检查故障注入钩子与批量回滚接线）、`verify-project-panel`（仅浅层 ZIP/快照往返、不校验大图逐字节）、`verify-refresh-recovery`（仅小节点刷新）三者的盲区——A 配额/写失败时 `autosave` 必须如实 `ok:false` 且带 `QUOTA_EXCEEDED`、绝不伪装成功，故障解除后能恢复保存；B IndexedDB 打开失败时如实降级返回 `IDB_UNAVAILABLE` 不抛到 UI；C 含 >60KB 大图的项目 `snapshot`→清空画布→`restoreSnapshot` 后大图 thumb/outputsData 逐字节一致；D `exportProject`→`importProject` ZIP 往返后大图 dataURL 像素级存活，且同一内容二次导入资产 store 不膨胀（sha256 去重）；E `transactionalPut` 多条有效记录单事务全部落库；F 大图 `autosave`→`reload`→`loadFromIDB` 后大图仍在且非 `(stripped)`（kv 双 keyPath 大图静默丢失历史坑的回归护栏，已做反向验证：直接往真源写剥离态时 F2/F3 必红，证明非假绿）；G `previewOrphans` 只回元数据不含 dataUrl（不把大图带进 UI/日志）、`cleanupOrphans` 先快照后删、`restoreSnapshot` 能把被清理资产找回（清理可回滚）；H 快照超 20 个裁最旧、标记 `[永久]` 的豁免不删；批量写入「失败侧整体回滚」依赖 IndexedDB 事务中止、从外部无法稳定强制触发真实异步事务错误，其回滚接线仍由静态用例 `verify-storage-faults` 钉住，本脚本只实测成功侧原子落库。第 75 条 `verify-agent-drawer-scroll.mjs` 钉住 Agent 抽屉滚轮豁免（canvasWrap 的 wheel 缩放处理器原先只豁免 #aiPanel、漏了 #agentDrawer，导致在 Agent 抽屉内滚轮被 preventDefault 锁死消息列表滚动并误缩放画布；修复后抽屉内滚轮正常翻看、画布空白处缩放能力不变），反向验证移除豁免后「向上滚不动 + 画布误缩放」两条恰红、护栏仍绿；第 74 条 `verify-audio-node-ui.mjs` 钉住 D+E 批音频节点（用户 2026-09-19 拍板：先只借鉴竞品 TTS 面板「布局/交互」、参数不虚标，再把配音与配乐整合为单一 audio 节点、模式切换）：voiceover/bgm 合并为一个「音频」节点，节点体内「🎤 配音 / 🎵 配乐」tab 互斥切换、单音频输出，两种模式均保留 D 批 UI（波形预览区解码渲染 + Composer + 可折叠高级设置；配音=语速滑杆+试听语言，配乐=时长+音量；配音绝不虚标声调/音量/采样率假控件）；旧 voiceover/bgm 类型保留为兼容别名（存档校验先于迁移运行，删类型会导致旧档整体拒绝恢复；创建入口只暴露 audio），存档 v5→v6 自动迁移把旧实例转 audio+audioMode 且 params 无损；执行回退与合成语义不变（配音无 Key 仍如实回落浏览器试听、配乐仍本地合成真实 WAV、compose 仍保留配音/配乐两个音轨端口），断言分「U 整合节点+迁移」与「D 数据护栏」两类，反向验证回退 E 批后 U 红、D 仍绿；第 73 条 `verify-batch-c-compose-publish.mjs` 钉住 C 批合成/发布（用户 2026-09-19 拍板：均走浏览器端真实本地能力、零服务端零密钥）：合成（compose）把上游素材抽帧重绘到目标画布、烧制字幕、混音配音/配乐后用 MediaRecorder 真实录制 webm 产出（无输入如实回退 demo，不再伪装 progress:100），发布（publish）生成真实发布包（成片引用 + 标题/简介/标签 + 封面抽帧 + 各平台上传深链，手动上传口径、不伪装已发布），registry 同步 compose→local、publish→local；第 72 条 `verify-batch-b-audio.mjs` 钉住 B 批音频节点（用户 2026-09-19 拍板）：配音（voiceover）有 Key 直连 /audio/speech 真实合成 mp3（无 Key 如实回落浏览器语音试听、不导出文件），配乐（bgm）用 OfflineAudioContext 本地按情绪真实合成免版权 WAV 且保留已上传音频不被覆盖，外加 registry voiceover→production、bgm→local 升档并清掉字幕重复 note 键；第 71 条 `verify-batch-a-nodes.mjs` 钉住 A 批节点补齐（用户 2026-09-19 盘点 27 类节点后拍板）：compare 真实拼接、videoBreak 真实抽帧、subtitle 本地切分、aiSet 批量真实生成、material 图生图通道，外加 registry 徽标与实际能力对齐（11 升档、B 批 footage/compose/publish 如实保留 demo），每条能力都同时断言「有真实输入出真结果」与「无输入如实回退占位」；第 70 条 `verify-scene-dialogs.mjs` 钉住场景分组输入/选择走应用内居中对话框（零原生弹窗、Enter 提交、Esc/遮罩关闭、右键「加入场景」点选卡片）；第 69 条 `verify-scene-panel-close.mjs` 钉住场景分组面板「点外部 / Esc 关闭 + 点节点不关」契约（「选节点→加入选中」主流程保护）；第 68 条 `verify-template-panel-close.mjs` 钉住开箱模板面板「点外部 / Esc 关闭」两条契约（与应用内其它浮层对齐，用户真机报告 + 探针取证，修复前恰好 2 条断言红）；第 67 条 `verify-composer.mjs` 用真实鼠标/滚轮/键盘动作钉住节点下方 Composer 的浮现、跟随、参数写回与出图，并首次覆盖「比例/分辨率浮层」这个用户改比例的唯一入口（此前全仓库无用例碰过）；第 66 条 `verify-auto-connect.mjs` 用真实鼠标拖拽钉住「拖动中候选反馈 + 松手落库」，并带一条 100 节点单帧检测 <2ms 的性能护栏；第 65 条 `verify-ui-affordance.mjs` 是针对这一类盲区的「可点性体检」闸门——用 `elementFromPoint` 命中测试加祖先链样式判定，断言全局入口、抽屉与面板内控件、悬停态节点工具按钮、composer、右键菜单项真的能被真实鼠标按到，而不只是存在于 DOM 里。详见 `test/DEBT.md` 的「查出的产品缺陷」。

如果回归输出 `EPERM` 且涉及 `listen`，或 Chrome 输出 `bootstrap_check_in ... Permission denied`，表示当前执行环境禁止本机回环端口或浏览器进程启动，统一记录为“环境阻塞”，不能当作业务测试失败。此时请在本机终端执行：

```bash
cd /Users/allin/Workspace/项目/project-001-FlowCraft无限画布/输出成果/deploy
npm run verify:regression
```

本机已有可用 Node 时，也可以直接使用 `npm run verify:regression`。

语义回归也可以单独运行：

```bash
npm run verify:node-semantics
```

这项检查需要 Playwright 以及可由 Playwright 启动的 Chrome/Chromium。2026-09-05 起本机已安装 Playwright Chromium（无 npm 环境时用 `node node_modules/playwright/cli.js install chromium`），浏览器业务回归已通过：`verify-node-semantics` PASS、`verify:regression` 6/6。回归脚本的本地 HTTP 服务必须监听 `127.0.0.1`（不传 host 会绑定 0.0.0.0，在 macOS 权限层下以 EPERM 失败）。

语义契约（P0-4）：节点类型语义 `semanticMode` 为 input/production/demo/stub；运行结果语义 `resultMode` 为 pending/real/demo/failed/unimplemented。其中 `failed` 表示「本次运行失败」（运行时异常或参数校验不通过），`unimplemented` 仅表示「能力未实现」（stub 硬拦截）。产品当前无 stub 节点，该分支由合成用例覆盖。
