# 测试欠债登记簿（test/DEBT.md）

> 本文件随 deploy 仓库发布，是回归闸门外脚本的唯一登记处。
> 闸门入口 `test/run-regression.mjs`（`npm run verify:regression`）；更新日期 2026-09-19。

## 口径

- 闸门入口：`test/run-regression.mjs`（`npm run verify:regression`）。
- 当前闸门条目 **69**，2026-09-19 全绿（`test-results/regression-2026-09-19.md`）。
- `test/` 目录共 **75** 个脚本文件；闸门外 **6** 个 = 设计如此 **3**（性能测量 / 演示物料 / 需真实 Key）
  + 单跑入口 **3**（`run-regression.mjs` 是闸门本身、`verify-current-build` 与 `verify-security`
  由 `npm run verify:build` / `verify:security` 单独调）。**真欠债 0 条**（2026-09-19 结案最后一条 A 类）。
- 第 65 条 `verify-ui-affordance.mjs` 是 2026-09-18 新增的「可点性体检」闸门：不再问「控件在不在」，
  而是问「用户鼠标按得到按不到」（`elementFromPoint` 命中 + 祖先链 display/visibility + 自身 pointer-events
  + 尺寸 + 中心点在视口内）。三处产品缺陷都属于前者通过、后者失败的盲区，故固化为常规闸门。
- 本文件登记欠债的判定与证据；`run-regression.mjs` 的注释只列文件名。
- 2026-09-18 已清 6 条：`verify-asset-dedup` / `verify-char-flow` / `verify-genmeta-retry` /
  `verify-ctxmenu-lightbox` / `verify-genmeta-bottom` / `verify-stage4-character-assets`。
  修法与踩坑见文末「已关闭」；**清的过程中查出 2 处真产品缺陷并已修**，见「本轮查出的产品缺陷」。

## 设计如此（永久不入闸门，不算欠债）

| 脚本 | 原因 |
|---|---|
| `verify-perf-baseline.mjs` | 性能测量，输出报告不做通过/失败判定，单独跑 |
| `reel-char-trial.mjs` | 生成演示物料（逐幕截图），不是断言集 |
| `verify-real-links.mjs` | 需要真实 AI Key（只从 env 读），CI/本地无凭据必红 |
| `run-regression.mjs` | 它本身就是闸门入口，不能自包 |
| `verify-current-build.mjs` | 构建产物一致性校验，走 `npm run verify:build` 单独调 |
| `verify-security.mjs` | 生产安全扫描，走 `npm run verify:security --production` 单独调 |

## 真欠债 0 条（2026-09-17 取证的 2 条 A 类已于 2026-09-19 全部结案）

### A 类｜用例过期（产品行为已有意变更，断言写的是旧契约）

> 下表 `verify-auto-connect` 虽登记在 A 类，但结案结论是**定级错了**：它不是用例过期而是产品缺陷
> （第 4 处：拖动中候选反馈丢失）。登记时那句「这是已决策的性能优化」只依据一条代码注释，
> 既没查提交说明（`d6a9720` 压根没提这次行为变更），也没测成本（实测 100 节点 0.012ms/帧）。
> 处理原则 6（先假设测试是对的）本轮再次生效。

| 脚本 | 现状 | 证据 | 判定依据 |
|---|---|---|---|
| `verify-composer.mjs` | **已结案（2026-09-19，33/33 入闸门）** | 失败 7 条：比例 select 写回、生成按钮完成(done)、节点拖动/缩放/平移后跟随、切换选中跟随 | **7 条全是测试侧，本轮 0 处产品缺陷**，且两条「过期」都有提交说明背书（`d6a9720`）：① 比例入口按「规格选择改画布内浮动卡片」改版，旧用例按 `.nc-select` **下标 [1]** 取控件，而那个下标现在是 `<button class="nc-select nc-spec-select ai-spec-trigger">` → 赋 value 恒无效；② 「FLUX.1 演示出图 → done」把已被 P0-4 语义契约移除的占位图当契约，无 Key 时报 error 才是正确行为；③ 跟随 4 条是实现没错、夹具错了——旧用例只改 `node.x` 不改 `el.style.left`（元素根本没动），再拿 `style.left`（canvasWrap 相对）比 `node.x*zoom+cam.x`（视口绝对，且没算 wrap 左偏移 220px）。真实鼠标拖动 / 滚轮 / 中键平移实测：面板与节点 `getBoundingClientRect` 左缘差恒为 0 |
| `verify-auto-connect.mjs` | **已结案（2026-09-19，18/18 入闸门）** 原判 7/11 的定级是错的 | 当时那条「这是已决策的性能优化」的判定只信了代码注释。复核发现：`updateAutoConnect` 只在 `onUp` 里被调（`legacy.js:12591`），紧接着 `commitAutoConnect()`（12596）同步清空 `__autoConn` → 候选虚线（drawEdges 分支）与目标端口 `.compatible` 高亮（`styles.css:3190`）**一帧都渲染不出来**，用户全程零提示；`AUTOCONN_PORT_GAP` 已成无引用死常量，节头注释还写着「吸附到端口对齐位置」。实测 100 节点图单次检测 **0.012ms**（300 次 4.8ms），注释里的性能顾虑不成立 → 判定从「用例过期」改回「产品缺陷」，见第 4 处 |

### B/C 类｜已清空（见文末「已关闭」）

原 B 类 2 条（`verify-asset-dedup`、`verify-char-flow`）与原 C 类 1 条（`verify-genmeta-retry`）已于 2026-09-18 全部修好并入闸门；判定与修法移到文末「已关闭」小节，这里不再占位。

探针附带排除的一条嫌疑：无 Key 时点生成会拿到 `status=error`，一度以为是「报错无提示」的体验缺陷；核对后确认 `legacy.js:12051 / 12076` 有未配置 Key 的分类与提示，是**探针读错字段**（读了 `msg` 空值），不立案。

## 已关闭（2026-09-18；前 5 条只改测试，最后 1 条同时修了 2 处产品缺陷）

| 脚本 | 原判定 | 实际修法 | 复跑 |
|---|---|---|---|
| `verify-asset-dedup.mjs` | 测试未 await 异步存资产 | evaluate 改 `async` + `await window.saveNodeImageAsAsset(node)`（两处） | 7/7 |
| `verify-char-flow.mjs` | 页签视图口径变了 | 先切「我的资产」并 **`waitForFunction` 等 `.active` 落地**，再 await 水合，最后统计 | 15/15 |
| `verify-genmeta-retry.mjs` | **不是待定级，是用例过期** | `page.route('**/images/generations')` 打桩出图 + 注入测试 Key，断言 `status=done` 且**新增** `resultMode=real` | 16/16 |
| `verify-genmeta-bottom.mjs` | 用例过期（承载节点选错） | fixture 由 `upscale` 换 `aiImage`；信息条只读 genMeta，不需要真出图 | 8/8 |
| `verify-ctxmenu-lightbox.mjs` | 同上 | 折叠/展开两条换 `aiImage` 承载；「单击不弹大图」+ 右键菜单**仍留** `upscale`（它有 clean-output 预览区而 aiImage 没有）；**新增**反向钉住「高清节点不渲染信息条」 | 5/5 |
| `verify-stage4-character-assets.mjs` | **判定错了：不是用例过期，是产品有 2 处缺陷**（原判「UI 文案已变」） | 把 `evaluate(b => b.click())` 换成真实 `click()`、把「存在即通过」的 `hasToolbar` 升级为 `actionsReachable`（查 display + 尺寸）；配套修产品（见下节）；用官方 `FlowCraft.editor.moveNode` 把状态节点铺成网格避开副本 40×40 遮挡 | **34/34** |

判定补记（`verify-genmeta-retry` 定级结论）：`legacy.js:16781` 注释与 16798-16801 行表明
「**AI 绘图节点统一走真实生成，节点上的模型名仅作 UI 标签**」，演示占位图已按 P0-4 语义契约移除
（`legacy.js:4140`「不制造占位图」）。所以「FLUX.1 → 占位出图 → done」这条断言写的是废弃契约；
无 Key 时 `status=error` + toast「未配置 OpenAI API Key」是**正确的当前行为**。同理
`verify-composer.mjs` 的「生成按钮触发运行并完成（done）」也是这一条根因，A 类改写时一并处理。

**上表有一条要打折**（2026-09-18 复核）：那次把 `verify-genmeta-bottom` 的承载由 `upscale` 换成 `aiImage`，
本身仍是一条假绿 —— aiImage 的信息条按设计就被 CSS 隐藏，用例断言的那些布局属性用户从来看不到。
本轮改为挂 **comfyui**（当前唯一能让信息条显形的类型）并补「摘要对用户可见」判定 + 反向钉；
`verify-genmeta-retry` 也补了真实入口点击的场景 2b。两条复跑计数升到 **10/10** 与 **19/19**，教训见坑 5。

## 查出的产品缺陷（第 1、2 处见提交 3dc466a；第 3 处见本节末）

| 缺陷 | 表现 | 根因 | 修法 |
|---|---|---|---|
| 角色状态节点 4 个按钮是死控件 | `.node-toolbar` display:none、按钮 0×0、`elementFromPoint` 命中不相干元素；hover 也救不回 | `styles.css:947` 的 image-only 收敛（本意只隐藏「复制链接/发送到画布」等通用按钮）碰上 `legacy.js:7967`「所有 aiImage 都加 `node--image-only`」，把 `legacy.js:10790` 新加的状态按钮一起吞了 | 加一行例外 `.node--image-only .node-toolbar:has(.state-node-action){display:flex}` |
| 冷启动把整个画布渲染两遍 | `workflow.nodes.size=2` 而 `.node[data-id]` 有 4 个；两条同矩形、都 visible，一条是当前 `node.el` 的孤儿 | `restoreFromStorage()` 启动时被调两次（`legacy.js:19158` 的 `init()` + `compat/main.js:192/242` 的 `restoreWithIDB`），第二遍不清场，`nodes.set()` 只覆盖引用 | 照 `applyWorkflowData:1658` 的做法在写入前清 nodes/edges/order/selection + `recycleBin`，使函数幂等 |

两条都属于「只用 `querySelector` 存在性做断言」时永远发现不了的缺陷 —— 元素在 DOM 里、永远查得到，只是点不到 / 多了一份。

### 第 3 处（2026-09-18 可点性体检查出并已修）

| 缺陷 | 表现 | 根因 | 修法 |
|---|---|---|---|
| aiImage / imageEdit 上「同参重试」没有任何用户入口 | 右键菜单无该项、composer 无该按钮、节点内也看不到；`retrySameParams` 的 2 个调用点全在隐藏 DOM 里 | 该函数原先只挂在生成信息条内（`legacy.js:5296` 快捷重试、`5314` 详情内按钮），而 `styles.css:912-922` 对 `.node--image-only` 隐藏整个信息条（`legacy.js:7967` 给所有 aiImage 都加了该类）；`legacy.js:5273` 注释「角落重试特例已移除：统一在底部信息条提供同参重试与参数编辑」——信息条一隐藏，入口就归零 | 按 B 方案把入口搬到用户可达处：composer 参数行加 `.nc-retry` 次要按钮、右键菜单加「同参重试」项（配套 `MENU_ICONS.retry`），两者仅在 `node.genMeta` 存在时出现。**信息条对 image-only 节点继续完全隐藏**（纯图片视图契约不变，另有反向钉住） |

定级过程：`probe-affordance.mjs` 全域体检（27 个节点类型 × 133 个控件）报出 74 个「点不到」，其中 offscreen 24 个是夹具视口不足、blocked-by 3 个压在小地图上、hidden-by 47 个逐个查源码——多数是有意设计（`#aiPanel` 折叠态、text-node keyRow 默认隐藏、image-only 信息条），只有这一条是「两个入口都在隐藏 DOM 里」的功能级不可达。

### 第 4 处（2026-09-19 清 auto-connect 欠债时查出并已修）

| 缺陷 | 表现 | 根因 | 修法 |
|---|---|---|---|
| 拖动节点靠近面板时**没有任何候选反馈**，松手才突然冒出一条连线 | 真实鼠标拖拽全程 `__autoConn` 恒为 null，目标端口 `getComputedStyle` 的 `transform` 与 `box-shadow` 与非候选端口完全一致 | `updateAutoConnect` 只在 `onUp` 里调用一次，下一行 `commitAutoConnect()` 就把候选与高亮同步清掉 → 反馈代码（画布虚线 + `.compatible` 样式）全在，但永远跑不到渲染帧；`d6a9720`（2026-09-05 大批量提交）把每帧检测删成松手检测时，提交说明完全没提这件事 | 把 `updateAutoConnect(group[0].n)` 挂进已有的 rAF 拖拽帧 `applyDragFrame`（**每帧一次而非每次 mousemove**，100 节点实测 0.012ms/帧）；松手仍按现契约落库、**不搬节点位置**；顺手删掉死常量 `AUTOCONN_PORT_GAP` 并按实现改写节头注释 |

配套用例改造：`verify-auto-connect.mjs` 从合成事件 + 写死坐标（x=272 y=228）改为真实 `page.mouse` 逐段拖拽、每帧取样、按 `portWorldPos` 实算间隙判窗口边界（-30~140px），高亮以 `transform` scale ≥1.25 且光晕区别于兄弟端口为准；再加一条性能护栏断言（100 节点单帧检测 <2ms），防止下一个人为「避免全图扫描」把它再删掉。**7/11 → 18/18**。

### 第 5 次复核（2026-09-19 清 composer）：结论是「没有产品缺陷」，但用例确实会咬

按处理原则 6 先用真实鼠标动作复测了 4 条「跟随」与 1 条「比例写回」，事实是：拖动中/缩放后/平移后 Composer 与节点的 `getBoundingClientRect` 左缘差恒为 0，切换选中会改绑到新节点，比例浮层点 16:9 卡片确实写回 `params.aspect` 并把节点重排成 416×235（1.77）→ 缺陷不成立，改的是用例。

为确认新用例不是「换了写法的恒真」，做了一次变异验证：把 `applyTransform` 与 `applyDragFrame` 里的 `positionNodeComposer()` 两处调用注掉并重新构建 → **恰好**「拖动中实时跟随 / 滚轮缩放后贴合 / 中键平移后贴合」3 条变红，其余 30 条不动（「松手后贴回」仍绿是对的，因为 `onUp` 里那次调用没被注掉）；随后 `git checkout` 还原源码并重建，`build.mjs --check` 回到 1,450,772 字节。这种「注掉实现看谁变红」的反向验证以后作为 A 类改写的收尾动作。

顺带补上一处覆盖空白：**比例/分辨率浮层（用户改比例的唯一入口）此前全仓库没有任何用例碰过**（`grep aiSpecPopover test/` 为 0 命中），旧用例只按 `.nc-select` 下标取控件，等于这个入口坏了也照样绿。现由 `verify-composer.mjs` 钉住「浮层真实弹出 + 11 个卡片可点 + 点 16:9 写回 + 触发器文案同步 + 节点按新比例重排」。

### 第 5 处缺陷（2026-09-19 用户真机报告）：开箱模板面板没有点外部 / Esc 关闭路径

症状：打开「开箱模板」抽屉后点画布区域毫无反应，只能点右上 X 或再点工具栏按钮关闭。探针 `probe-p67-tpl-close.mjs` 取证：应用内其它浮层全有关闭契约——比例浮层 / 批量规格 / 宫格拆分 / 提示词库 / 提供方模型面板是 document mousedown 点外部关，工作流 / 工作台抽屉是遮罩点击关，全局 Esc 链也收 workflow / asset 抽屉——唯独 `#templatePanel` 三条路都没有，属契约缺口而非设计如此。

修复：`legacy.js` 给模板面板加捕获阶段 mousedown 点外部关（排除面板自身与 `#btnTemplates`——否则 mousedown 先关、click 又 toggle 开，工具栏按钮将永远关不掉面板），全局 Esc 链补模板面板一档（与 workflow / asset 抽屉同档）。闸门 `verify-template-panel-close.mjs` 7 条断言全用真实鼠标/键盘：画布空白点击关、面板内部（落点先经 elementFromPoint 确认非按钮）不关、Esc 关、工具栏 toggle 不坏、关后画布选中不受牵连；修复前反向验证恰好「画布点击关 / Esc 关」2 条红、其余 5 条绿。

### 第 6 处缺陷（2026-09-19 用户真机报告）：场景分组面板点画布不关闭

与第 5 处同类（点外部 / Esc 两条关闭路径全缺），但不能照抄模板面板的「任何外部点击都关」：场景卡上的「加入选中(N)」按钮依赖「面板开着 → 画布点选节点 → 回面板点加入」这条主流程，点节点即关会把它打断。修复契约：点面板外关闭，例外两类——`#btnScenes`（保 toggle）与 `.node` 本体（保选节点）；全局 Esc 链补场景面板一档。闸门 `verify-scene-panel-close.mjs` 8 条断言（含「垂直居中浮窗、不贴顶」布局钉），修复前反向验证恰好「画布空白点击关 / Esc 关」2 条红。

过程注记：首版 ③「点节点不关」在修复前也红，查明是**夹具假失败**而非产品缺陷——`addNode` 只写数据坐标，冷启动相机把节点垫到了 minimap 底下，点击落在 `.minimap-header` 上（DEBT 坑 7 的又一变体）。修法是 `fitToContent()` 归一视图 + 点击前 `elementFromPoint` 确认命中节点本体，并把「落点命中」作为该断言前置。教训：反向验证发现「不该红的红了」时，先怀疑夹具，别急着改产品。

### 低危（登记不修）

| 项 | 现状 | 判定 |
|---|---|---|
| 节点工具栏 4 个空实现占位按钮（复制链接 / 发送到画布 / 发送到对话 / 发送到分镜） | `legacy.js` 的 `tools` 数组里 `btn.onclick = (e) => { e.stopPropagation(); }`，无任何实际行为 | 27 类型 × 选中态实测：这些按钮**从不显形**（一直被 image-only 规则挡在隐藏区），用户看不到也就不会被骗 → 零用户影响，不改产品。已在 `verify-ui-affordance.mjs` 里加反向钉「空实现占位按钮保持隐藏」，将来若有人放开隐藏让死按钮露出来，闸门直接红 |
| `styles.css:923-945` 的 `.ngm-corner-retry`（角落悬停浮现的同参重试按钮）整套样式是死规则 | `legacy.js` 全文已无该类名、元素从不渲染（对应 `legacy.js:5273`「角落重试特例已移除：统一在底部信息条提供」的残留） | 零行为影响，纯冗余 CSS；且它恰好是「入口归零」这条缺陷的历史成因，留着反而有解释价值。下轮整理样式时连同 `:hover/.selected` 那两条一起删，本轮不动 |

### 可复用的几个坑（写测试前先看）

1. **资产相关写入基本都是 async**：`saveNodeImageAsAsset`、素材库页签 click 处理器内部都要 `await` IndexedDB 水合。`element.click()` 之后视图/数据不会同步变化，必须 `waitForFunction` 等状态落地，否则拿到的是旧视图。
2. **aiImage 出图断言一律走 `page.route` 打桩**（参照 `verify-provider-models.mjs` 的既有写法）：不 mock 就只会得到「未配置 Key」的 error；直接放宽成 `['done','error'].includes(status)` 则是假绿。
3. **信息条 `.node-gen-meta` 有两道闸门，别只看第一道**：`legacy.js:10875` 决定**渲不渲染**（只认 `aiImage/comfyui/imageEdit`，高清、线稿的参数入口是各自下方专属面板），`styles.css:912-922` 决定**可不可见**（`.node--image-only` 把摘要/快捷重试/详情整体 `display:none`，而所有 aiImage 都带这个类）。合起来的现行契约是：**只有 comfyui 用户能看到信息条**；imageEdit 渲染但同样不可见。所以「信息条布局/摘要内容」类断言只能挂 comfyui，挂 aiImage 就是一条注定假绿的空断言（本轮就为此返工过一次）。
4. **`querySelector` 命中 ≠ 用户点得到**：`display:none` 的元素 Playwright 判不可见（真实 `.click()` 会超时），但 `el.querySelector(...)` 照样返回它 —— 本轮 2 处产品缺陷都是这么藏住的。UI 断言优先用真实 `locator.click()`；确需用 `evaluate` 时补一条 display + 尺寸的可显示性判定，别只查存在。同理 `workflow.nodes.size` 与 `.node[data-id]` 元素数不等就说明有孤儿元素，值得单独立一条断言。
5. **弱断言会替产品缺陷打掩护**（本轮修掉的两条假绿，形态各不相同）：`verify-genmeta-retry` 的「节点渲染了生成信息条」只看 DOM 里有没有那个节点，而 CSS 恰好把它藏了；`verify-genmeta-bottom` 拿 aiImage 当信息条布局的承载节点，而 aiImage 恰恰是唯一看不到信息条的那类。修法不是放宽断言，而是三件事一起做：① 换合法承载（**comfyui 是当前唯一能看到信息条的类型**，布局类断言只能挂它）② 加反向钉（`aiStripHidden`：aiImage 节点体内摘要必须仍 `display:none`，把纯图片视图契约钉住，防止有人「为测而显形」）③ 加真实入口动作（`locator.click()` 点 composer 的 `.nc-retry`，断言参数从被改过的值恢复成快照且 `status=done`）。「函数在、调用点在、就是没人能按到」只有把断言换成用户动作才会暴露。另注意判可见性别一刀切：`opacity:0 + :hover/.selected` 显形是本应用既有交互（要先真实 `mouse.move` 悬停），祖先 `pointer-events:none` 也不致命（子元素可 `auto` 重新 opt-in），以 `elementFromPoint` 为真值。
6. **夹具跑出视口 = 自己造一条假绿**：`verify-auto-connect` 改造第一版把测试节点摆在画布 y=900/1400/2400，视口只有 1000 高 → `elementFromPoint` 全空 → 起拖点找不到 → 拖拽一次没发生 → `samples` 是空数组 → `[].every(s => !s.autoConn)` **恒真**，「无候选」断言白给。修法：播种时把节点摆在视口内（本文件用 `__seed` 固定 y=140 并按 `portWorldPos` 精确摆间隙），并让**每条断言都带 `ok === true` 前置**（夹具失败必须显形为 FAIL，而不是被恒真掩掉）。同理 `find()` 返回 undefined 后直接读属性会抛异常中断脚本，页内取样要显式返回 `{missing:true}`。
7. **`addNode` 会顺手选中新节点**（`verify-composer` 首版 9 条红里有 6 条是它造成的）：播种第二个节点后 Composer 已改绑，此后的 `fill/selectOption/点击浮层` 全打在另一个节点上，读回来就像「产品写回坏了」。修法是铺完再 `selectNode(a)` 交回选中权，并让**定位/写回类断言都带 `boundTo === 目标 id` 前置**。同一坑的另一面：节点被推到视口外时面板会走避让/钳制分支，此时断言「左缘对齐」必红——要么先复位相机（`camera.x/y/zoom` + `applyTransform()`），要么改判「贴合某条边」而不是「贴在下方」。
8. **真实点击的两类时序假失败**（同一份用例连踩两次）：① 「先 `getBoundingClientRect` 量坐标、再 `mouse.click(x,y)`」在中间任何重排（出图徽标、error 徽标、skeleton、Composer 跟着节点位移）后就会点到节点本体 → 症状是「点了什么都没发生、外发请求为 0」，改用 `page.click(selector)` 让 Playwright 自己等可动作并复核命中点；② 点完立刻读状态会读到**上一次运行留下的旧终态**（error→点击→异步置 running 之间有间隙）→ 先记 `prevStatus`，只认「从 prev 变化之后的那个终态」。两条断言的 detail 都带上 `_lastError` 与外发请求列表，红的时候能一眼分清「没发请求」还是「发了没跑完」。

## 处理原则

1. **不许为了变绿静默删断言。** 每条要么改断言并在提交信息里写明「行为契约变更 + 决策出处」，要么改产品。
2. A 类改写后必须回到闸门并留在里面——它们覆盖的是 Composer 定位、自动连线这类主干交互，弃跑等于裸奔。
3. B 类是本次最便宜的红利：`await` + 切页签，预计 3 条断言直接转绿。
4. 坐标写死的断言（`x=272 y=228` 一类）改成「相对目标端口的间隙/对齐」判定，否则每次布局调整都会误报。
5. **A 类欠债清零**（2026-09-19）：`verify-auto-connect` 18/18、`verify-composer` 33/33，两条都在闸门里。两条的定性走的是相反方向——auto-connect 从「用例过期」翻案成产品缺陷（第 4 处），composer 从「疑似缺陷」查实为 7 条测试自身问题；共同做法是**先按处理原则 6 假设测试是对的**，用真实用户动作 + 探针取事实，再决定改产品还是改用例，并且改完做一次反向验证（注掉实现里的调用，看该红的断言是否真红）。
6. **先假设测试是对的**。本轮教训：stage4 登记时被判为「用例过期、UI 文案已变」，实际是把 `evaluate(b => b.click())` 换成真实 `click()` 后发现的两处产品缺陷。改测试迁就现状前，先问一句「用户真的能用这个功能吗」。
7. 登记「用例过期」必须同时具备三件证据：**提交说明或决策出处**、**现行实现读证**、**真实用户动作实测**；只有代码注释或口头理由一律不算（`verify-auto-connect` 就是被一条注释加一句「避免全图扫描」误导，白记了一个月「设计如此」）。收尾还要补一次反向验证：把实现里对应的调用注掉重建，确认该红的断言真红，否则新写的断言可能只是换了一种写法的恒真。

## 复现命令

```bash
cd 部署仓库根目录
node test/verify-asset-dedup.mjs      # 单跑某条
node test/run-regression.mjs          # 全量闸门（67）
node test/verify-ui-affordance.mjs    # 单跑可点性体检
node test/verify-auto-connect.mjs       # 单跑拖动靠近自动连线
node test/verify-composer.mjs         # 单跑节点下方 Composer（含比例浮层与打桩出图）
node test/verify-template-panel-close.mjs  # 单跑模板面板关闭契约（点外部/Esc）
node test/verify-scene-panel-close.mjs     # 单跑场景面板关闭契约（点外部/Esc，点节点例外）
```

分类用的探针脚本未随仓库发布（在开发机 `.flowcraft-patches/` 下）：`probe-debt.mjs`（批量跑欠债脚本取退出码与末段输出）、`probe-composer.mjs`（Composer 现行控件结构与写回行为）、`probe-asset-panel.mjs`（存资产后面板各时点卡片数）、`probe-asset-dom.mjs`（资产面板 DOM 归属）、`probe-genmeta-strip.mjs`（信息条在各类型节点上的渲染情况）、`probe-ctxmenu-dom.mjs`（高清/AI 绘图节点预览区与信息条 DOM 对照 + 右键菜单项清单）、`probe-state-toolbar.mjs`（状态按钮 display/尺寸/命中测试 + 注入修复后的对照）、`probe-reload-toolbar.mjs`（恢复后同 data-id 元素数）、`probe-dup-node-el.mjs`（重复元素的归属链与 isLive 比对）、`probe-coldstart-append.mjs`（在应用脚本前挂 `Node.prototype.appendChild` 钩子，抓冷启动两次 append 的调用栈）、`probe-affordance.mjs`（27 类型 × 133 控件的全域可点性体检，输出 hidden-by/offscreen/blocked-by 分类）、`probe-afford-seed.mjs`（单类型逐个控件的显形对照）、`probe-placeholder-btns.mjs`（空实现占位按钮在各类型选中态下是否显形）、`probe-retry-reach.mjs`（同参重试入口可达性取证：右键菜单项清单 + 悬停选中态下可见控件）、`probe-p53-retry.mjs`（B 方案新入口复验：真实点击后参数是否恢复快照、菜单项是否触发 running）、`probe-ai-panel-chain.mjs`（`#aiSettingsBtn` 的 pointer-events 继承链与 `#btnNewWorkflow` 视口位置）、`probe-workbench-overlay.mjs`（三个抽屉共用 `.recycle-panel`/`.recycle-overlay` 类时的开关与遮罩状态）、`probe-p64-composer.mjs`（Composer 跟随/比例浮层/生成三处事实取样）、`probe-p64b-run.mjs` 与 `probe-p64c-model.mjs`（生成报错文案、外发 URL、`selectOption` 写回是否成立）、`probe-p64d-run-hang.mjs`（按新用例序列复现「卡在 running」并打印逐帧状态与网络）、`probe-p67-tpl-close.mjs`（模板面板关闭路径修复前后事实取样，带 after 参数按修复后预期判定）。其中后四个是 `verify-ui-affordance.mjs` 判据的定标依据：抽屉要开对（`#btnWorkflow` 才含 `#btnNewWorkflow`）、slide 动画要等 700ms、`reload` 会把 AI 面板恢复成展开态遮住节点、节点定位前需 `fitToContent()` 归一视图。复现 A/B 类判定只需按上表跑对应脚本，再按「证据」列的关键差异对照现行源码。
