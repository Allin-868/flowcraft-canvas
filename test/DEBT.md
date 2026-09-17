# 测试欠债登记簿（test/DEBT.md）

> 本文件随 deploy 仓库发布，是回归闸门外脚本的唯一登记处。
> 闸门入口 `test/run-regression.mjs`（`npm run verify:regression`）；更新日期 2026-09-17。

## 口径

- 闸门入口：`test/run-regression.mjs`（`npm run verify:regression`）。
- 当前闸门条目 **58**，2026-09-17 全绿（`test-results/regression-2026-09-17.md`）。
- `test/` 目录共 **72** 个脚本文件；未进闸门的 **11** 个 = 设计如此 **3** + 真欠债 **8**。
- 本文件登记 8 条真欠债。`run-regression.mjs` 的注释只列文件名，判定与证据在这里。

## 设计如此（永久不入闸门，不算欠债）

| 脚本 | 原因 |
|---|---|
| `verify-perf-baseline.mjs` | 性能测量，输出报告不做通过/失败判定，单独跑 |
| `reel-char-trial.mjs` | 生成演示物料（逐幕截图），不是断言集 |
| `verify-real-links.mjs` | 需要真实 AI Key（只从 env 读），CI/本地无凭据必红 |

## 真欠债 8 条（今日逐个复跑取证的退出码与断言名）

### A 类｜用例过期（产品行为已有意变更，断言写的是旧契约）

| 脚本 | 现状 | 证据 | 判定依据 |
|---|---|---|---|
| `verify-composer.mjs` | 14/21 | 失败 7 条：比例 select 写回、生成按钮完成(done)、节点拖动/缩放/平移后跟随、切换选中跟随 | 探针 `probe-composer.mjs`：现行 DOM 里**已无含 `16:9` 的下拉**（比例入口改版）；Composer 已加**避让逻辑**（`verify-composer-avoid.mjs` 在闸门内且通过），`left` 不再等于「节点正下方」公式值 |
| `verify-auto-connect.mjs` | 7/11 | 失败 4 条：拖动中出现候选预览、端口 compatible 高亮、吸附到 x=272 y=228、间隙 100px 即吸附 | `legacy.js:12547` 明确注释「拖拽过程中只更新位移；吸附和自动连线留到松手时处理，避免每次 mousemove 全图扫描」——**这是已决策的性能优化**，与断言 1/2 的旧契约直接冲突；断言 3/4 还写死了坐标 |
| `verify-ctxmenu-lightbox.mjs` | 崩溃 | `page.evaluate: TypeError: Cannot read properties of null (reading 'querySelector')`（脚本 19 行处调用） | 脚本内联函数对节点 header / 弹层结构取了已不存在的容器；属查看大图走右键菜单改版（09-06）后的选择器失效 |
| `verify-genmeta-bottom.mjs` | 崩溃 | 同上，`reading 'querySelectorAll'` | 同一批改版遗留，测试侧取 null 节点 |
| `verify-stage4-character-assets.mjs` | 15/16 | 1 条 `locator.click` 超时，`element is not visible`（脚本 187 行） | UI 文案/层级已变，该按钮当前不在可见路径上 |

### B 类｜测试实现与新异步模型不匹配（不是产品缺陷）

| 脚本 | 现状 | 证据 | 判定依据 |
|---|---|---|---|
| `verify-asset-dedup.mjs` | 6/7 | 失败 1 条：`命名令牌保留（显示名=我的角色）`，实际 `displayName="AI 绘图"`、`gKey=""` | `saveNodeImageAsAsset` 现在是 **async**（`legacy.js:8187`，资产真源迁 IndexedDB），脚本调用**没有 await** → 紧接着 `globalAssetEntries()` 读到 0 条 → `setAssetMeta('')` 写空 key → 显示名回退节点标题 |
| `verify-char-flow.mjs` | 13/15 | 失败 2 条：`素材库面板可打开且显示资产卡片：cards=0`、`搜索框过滤「晚礼服」命中 1 张卡片：cards=0` | 探针 `probe-asset-panel.mjs` 实测：存资产后 `globalEntries=1`（数据在库），但 `updateAssetPanel` 按页签分流（`legacy.js:2205-2206`），默认页签「当前素材」**会排除已入库的 src** → 不切到「我的资产」就是 0 张卡，属预期行为 |

### C 类｜需要真判一次（今日未定级）

| 脚本 | 现状 | 说明 |
|---|---|---|
| `verify-genmeta-retry.mjs` | 14/15 | 唯一失败「同参重试后节点被触发重新运行（完成）」实际状态 `error`，但**同权重跑 `重跑后 genMeta 刷新为同参快照` 通过**。未确定是 mock 出图路径被改（用例过期）还是重试链路真失败。开工时先看 `runNode` 在重试入口的 `resultMode` |

探针附带排除的一条嫌疑：无 Key 时点生成会拿到 `status=error`，一度以为是「报错无提示」的体验缺陷；核对后确认 `legacy.js:12051 / 12076` 有未配置 Key 的分类与提示，是**探针读错字段**（读了 `msg` 空值），不立案。

## 处理原则

1. **不许为了变绿静默删断言。** 每条要么改断言并在提交信息里写明「行为契约变更 + 决策出处」，要么改产品。
2. A 类改写后必须回到闸门并留在里面——它们覆盖的是 Composer 定位、自动连线这类主干交互，弃跑等于裸奔。
3. B 类是本次最便宜的红利：`await` + 切页签，预计 3 条断言直接转绿。
4. 坐标写死的断言（`x=272 y=228` 一类）改成「相对目标端口的间隙/对齐」判定，否则每次布局调整都会误报。
5. 建议顺序：**B（半天内）→ C（1 条，定向）→ A（composer / auto-connect 两批）**。前两步做完可把 58 提到 60 且把「已知欠债」从 8 压到 5。

## 复现命令

```bash
cd 部署仓库根目录
node test/verify-asset-dedup.mjs      # 单跑某条
node test/run-regression.mjs          # 全量闸门（58）
```

分类用的探针脚本未随仓库发布（在开发机 `.flowcraft-patches/` 下）：`probe-debt.mjs`（批量跑欠债脚本取退出码与末段输出）、`probe-composer.mjs`（Composer 现行控件结构与写回行为）、`probe-asset-panel.mjs`（存资产后面板各时点卡片数）、`probe-asset-dom.mjs`（资产面板 DOM 归属）。复现 A/B 类判定只需按上表跑对应脚本，再按「证据」列的关键差异对照现行源码。
