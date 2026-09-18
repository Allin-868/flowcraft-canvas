# 测试欠债登记簿（test/DEBT.md）

> 本文件随 deploy 仓库发布，是回归闸门外脚本的唯一登记处。
> 闸门入口 `test/run-regression.mjs`（`npm run verify:regression`）；更新日期 2026-09-19。

## 口径

- 闸门入口：`test/run-regression.mjs`（`npm run verify:regression`）。
- 当前闸门条目 **65**，2026-09-19 全绿（`test-results/regression-2026-09-19.md`）。
- `test/` 目录共 **73** 个脚本文件；未进闸门的 **5** 个 = 设计如此 **3** + 真欠债 **2**。
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

## 真欠债 2 条（2026-09-17 复跑取证，2026-09-18 已清其中 4 条）

### A 类｜用例过期（产品行为已有意变更，断言写的是旧契约）

| 脚本 | 现状 | 证据 | 判定依据 |
|---|---|---|---|
| `verify-composer.mjs` | 14/21 | 失败 7 条：比例 select 写回、生成按钮完成(done)、节点拖动/缩放/平移后跟随、切换选中跟随 | 探针 `probe-composer.mjs`：现行 DOM 里**已无含 `16:9` 的下拉**（比例入口改版）；Composer 已加**避让逻辑**（`verify-composer-avoid.mjs` 在闸门内且通过），`left` 不再等于「节点正下方」公式值 |
| `verify-auto-connect.mjs` | 7/11 | 失败 4 条：拖动中出现候选预览、端口 compatible 高亮、吸附到 x=272 y=228、间隙 100px 即吸附 | `legacy.js:12547` 明确注释「拖拽过程中只更新位移；吸附和自动连线留到松手时处理，避免每次 mousemove 全图扫描」——**这是已决策的性能优化**，与断言 1/2 的旧契约直接冲突；断言 3/4 还写死了坐标 |

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

## 处理原则

1. **不许为了变绿静默删断言。** 每条要么改断言并在提交信息里写明「行为契约变更 + 决策出处」，要么改产品。
2. A 类改写后必须回到闸门并留在里面——它们覆盖的是 Composer 定位、自动连线这类主干交互，弃跑等于裸奔。
3. B 类是本次最便宜的红利：`await` + 切页签，预计 3 条断言直接转绿。
4. 坐标写死的断言（`x=272 y=228` 一类）改成「相对目标端口的间隙/对齐」判定，否则每次布局调整都会误报。
5. 剩余 2 条（`verify-auto-connect`、`verify-composer`），建议顺序 auto-connect → composer。composer 的「生成按钮完成(done)」断言与 genmeta-retry 同根因（出图需 `page.route` 打桩），其「比例下拉写回 / 跟随节点定位」两条则要先确认新版避让逻辑下的正确预期，不能简单放宽。
6. **先假设测试是对的**。本轮教训：stage4 登记时被判为「用例过期、UI 文案已变」，实际是把 `evaluate(b => b.click())` 换成真实 `click()` 后发现的两处产品缺陷。改测试迁就现状前，先问一句「用户真的能用这个功能吗」。

## 复现命令

```bash
cd 部署仓库根目录
node test/verify-asset-dedup.mjs      # 单跑某条
node test/run-regression.mjs          # 全量闸门（65）
node test/verify-ui-affordance.mjs    # 单跑可点性体检
```

分类用的探针脚本未随仓库发布（在开发机 `.flowcraft-patches/` 下）：`probe-debt.mjs`（批量跑欠债脚本取退出码与末段输出）、`probe-composer.mjs`（Composer 现行控件结构与写回行为）、`probe-asset-panel.mjs`（存资产后面板各时点卡片数）、`probe-asset-dom.mjs`（资产面板 DOM 归属）、`probe-genmeta-strip.mjs`（信息条在各类型节点上的渲染情况）、`probe-ctxmenu-dom.mjs`（高清/AI 绘图节点预览区与信息条 DOM 对照 + 右键菜单项清单）、`probe-state-toolbar.mjs`（状态按钮 display/尺寸/命中测试 + 注入修复后的对照）、`probe-reload-toolbar.mjs`（恢复后同 data-id 元素数）、`probe-dup-node-el.mjs`（重复元素的归属链与 isLive 比对）、`probe-coldstart-append.mjs`（在应用脚本前挂 `Node.prototype.appendChild` 钩子，抓冷启动两次 append 的调用栈）、`probe-affordance.mjs`（27 类型 × 133 控件的全域可点性体检，输出 hidden-by/offscreen/blocked-by 分类）、`probe-afford-seed.mjs`（单类型逐个控件的显形对照）、`probe-placeholder-btns.mjs`（空实现占位按钮在各类型选中态下是否显形）、`probe-retry-reach.mjs`（同参重试入口可达性取证：右键菜单项清单 + 悬停选中态下可见控件）、`probe-p53-retry.mjs`（B 方案新入口复验：真实点击后参数是否恢复快照、菜单项是否触发 running）、`probe-ai-panel-chain.mjs`（`#aiSettingsBtn` 的 pointer-events 继承链与 `#btnNewWorkflow` 视口位置）、`probe-workbench-overlay.mjs`（三个抽屉共用 `.recycle-panel`/`.recycle-overlay` 类时的开关与遮罩状态）。其中后四个是 `verify-ui-affordance.mjs` 判据的定标依据：抽屉要开对（`#btnWorkflow` 才含 `#btnNewWorkflow`）、slide 动画要等 700ms、`reload` 会把 AI 面板恢复成展开态遮住节点、节点定位前需 `fitToContent()` 归一视图。复现 A/B 类判定只需按上表跑对应脚本，再按「证据」列的关键差异对照现行源码。
