# 测试欠债登记簿（test/DEBT.md）

> 本文件随 deploy 仓库发布，是回归闸门外脚本的唯一登记处。
> 闸门入口 `test/run-regression.mjs`（`npm run verify:regression`）；更新日期 2026-09-18。

## 口径

- 闸门入口：`test/run-regression.mjs`（`npm run verify:regression`）。
- 当前闸门条目 **63**，2026-09-18 全绿（`test-results/regression-2026-09-18.md`）。
- `test/` 目录共 **72** 个脚本文件；未进闸门的 **6** 个 = 设计如此 **3** + 真欠债 **3**。
- 本文件登记欠债的判定与证据；`run-regression.mjs` 的注释只列文件名。
- 2026-09-18 已清 5 条：`verify-asset-dedup` / `verify-char-flow` / `verify-genmeta-retry` /
  `verify-ctxmenu-lightbox` / `verify-genmeta-bottom`。修法与踩坑见文末「已关闭」。

## 设计如此（永久不入闸门，不算欠债）

| 脚本 | 原因 |
|---|---|
| `verify-perf-baseline.mjs` | 性能测量，输出报告不做通过/失败判定，单独跑 |
| `reel-char-trial.mjs` | 生成演示物料（逐幕截图），不是断言集 |
| `verify-real-links.mjs` | 需要真实 AI Key（只从 env 读），CI/本地无凭据必红 |

## 真欠债 3 条（2026-09-17 复跑取证，2026-09-18 已清其中 2 条）

### A 类｜用例过期（产品行为已有意变更，断言写的是旧契约）

| 脚本 | 现状 | 证据 | 判定依据 |
|---|---|---|---|
| `verify-composer.mjs` | 14/21 | 失败 7 条：比例 select 写回、生成按钮完成(done)、节点拖动/缩放/平移后跟随、切换选中跟随 | 探针 `probe-composer.mjs`：现行 DOM 里**已无含 `16:9` 的下拉**（比例入口改版）；Composer 已加**避让逻辑**（`verify-composer-avoid.mjs` 在闸门内且通过），`left` 不再等于「节点正下方」公式值 |
| `verify-auto-connect.mjs` | 7/11 | 失败 4 条：拖动中出现候选预览、端口 compatible 高亮、吸附到 x=272 y=228、间隙 100px 即吸附 | `legacy.js:12547` 明确注释「拖拽过程中只更新位移；吸附和自动连线留到松手时处理，避免每次 mousemove 全图扫描」——**这是已决策的性能优化**，与断言 1/2 的旧契约直接冲突；断言 3/4 还写死了坐标 |
| `verify-stage4-character-assets.mjs` | 15/16 | 1 条 `locator.click` 超时，`element is not visible`（脚本 187 行） | UI 文案/层级已变，该按钮当前不在可见路径上 |

### B/C 类｜已清空（见文末「已关闭」）

原 B 类 2 条（`verify-asset-dedup`、`verify-char-flow`）与原 C 类 1 条（`verify-genmeta-retry`）已于 2026-09-18 全部修好并入闸门；判定与修法移到文末「已关闭」小节，这里不再占位。

探针附带排除的一条嫌疑：无 Key 时点生成会拿到 `status=error`，一度以为是「报错无提示」的体验缺陷；核对后确认 `legacy.js:12051 / 12076` 有未配置 Key 的分类与提示，是**探针读错字段**（读了 `msg` 空值），不立案。

## 已关闭（2026-09-18，全部只改测试，未改产品）

| 脚本 | 原判定 | 实际修法 | 复跑 |
|---|---|---|---|
| `verify-asset-dedup.mjs` | 测试未 await 异步存资产 | evaluate 改 `async` + `await window.saveNodeImageAsAsset(node)`（两处） | 7/7 |
| `verify-char-flow.mjs` | 页签视图口径变了 | 先切「我的资产」并 **`waitForFunction` 等 `.active` 落地**，再 await 水合，最后统计 | 15/15 |
| `verify-genmeta-retry.mjs` | **不是待定级，是用例过期** | `page.route('**/images/generations')` 打桩出图 + 注入测试 Key，断言 `status=done` 且**新增** `resultMode=real` | 16/16 |
| `verify-genmeta-bottom.mjs` | 用例过期（承载节点选错） | fixture 由 `upscale` 换 `aiImage`；信息条只读 genMeta，不需要真出图 | 8/8 |
| `verify-ctxmenu-lightbox.mjs` | 同上 | 折叠/展开两条换 `aiImage` 承载；「单击不弹大图」+ 右键菜单**仍留** `upscale`（它有 clean-output 预览区而 aiImage 没有）；**新增**反向钉住「高清节点不渲染信息条」 | 5/5 |

判定补记（`verify-genmeta-retry` 定级结论）：`legacy.js:16781` 注释与 16798-16801 行表明
「**AI 绘图节点统一走真实生成，节点上的模型名仅作 UI 标签**」，演示占位图已按 P0-4 语义契约移除
（`legacy.js:4140`「不制造占位图」）。所以「FLUX.1 → 占位出图 → done」这条断言写的是废弃契约；
无 Key 时 `status=error` + toast「未配置 OpenAI API Key」是**正确的当前行为**。同理
`verify-composer.mjs` 的「生成按钮触发运行并完成（done）」也是这一条根因，A 类改写时一并处理。

### 可复用的两个坑（写测试前先看）

1. **资产相关写入基本都是 async**：`saveNodeImageAsAsset`、素材库页签 click 处理器内部都要 `await` IndexedDB 水合。`element.click()` 之后视图/数据不会同步变化，必须 `waitForFunction` 等状态落地，否则拿到的是旧视图。
2. **aiImage 出图断言一律走 `page.route` 打桩**（参照 `verify-provider-models.mjs` 的既有写法）：不 mock 就只会得到「未配置 Key」的 error；直接放宽成 `['done','error'].includes(status)` 则是假绿。
3. **信息条 `.node-gen-meta` 有类型闸门**（`legacy.js:10875`，只认 `aiImage/comfyui/imageEdit`）：高清、线稿的参数入口是各自下方专属面板。写「信息条/参数详情」类断言前先确认承载节点类型，别默认任何出图节点都有这条。

## 处理原则

1. **不许为了变绿静默删断言。** 每条要么改断言并在提交信息里写明「行为契约变更 + 决策出处」，要么改产品。
2. A 类改写后必须回到闸门并留在里面——它们覆盖的是 Composer 定位、自动连线这类主干交互，弃跑等于裸奔。
3. B 类是本次最便宜的红利：`await` + 切页签，预计 3 条断言直接转绿。
4. 坐标写死的断言（`x=272 y=228` 一类）改成「相对目标端口的间隙/对齐」判定，否则每次布局调整都会误报。
5. 剩余 3 条全是 A 类，建议顺序：**stage4-character-assets（1 条，最便宜）→ auto-connect → composer**。composer 的「生成按钮完成(done)」断言与 genmeta-retry 同根因（出图需 `page.route` 打桩），其「比例下拉写回 / 跟随节点定位」两条则要先确认新版避让逻辑下的正确预期，不能简单放宽。

## 复现命令

```bash
cd 部署仓库根目录
node test/verify-asset-dedup.mjs      # 单跑某条
node test/run-regression.mjs          # 全量闸门（63）
```

分类用的探针脚本未随仓库发布（在开发机 `.flowcraft-patches/` 下）：`probe-debt.mjs`（批量跑欠债脚本取退出码与末段输出）、`probe-composer.mjs`（Composer 现行控件结构与写回行为）、`probe-asset-panel.mjs`（存资产后面板各时点卡片数）、`probe-asset-dom.mjs`（资产面板 DOM 归属）、`probe-genmeta-strip.mjs`（信息条在各类型节点上的渲染情况）、`probe-ctxmenu-dom.mjs`（高清/AI 绘图节点预览区与信息条 DOM 对照 + 右键菜单项清单）。复现 A/B 类判定只需按上表跑对应脚本，再按「证据」列的关键差异对照现行源码。
