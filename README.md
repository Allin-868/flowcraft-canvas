# FlowCraft · AI 工作流编辑器（无限画布）

FlowCraft v2.1 —— 基于无限画布的 AI 生图工作流编辑器（单文件 HTML，零依赖）。

## 功能

- 无限画布：拖拽节点、缩放平移（滚轮/触控板）、网格背景
- 节点类型：图片输入、文本输入、AI 绘图、AI 视频、智能超清、对比、保存
- 连线、右键菜单、撤销/重做、复制、回收站
- **v2.1 新增**：框选、多选批量操作（Ctrl/Shift+点击）、整组拖拽、对齐/分布工具、缩略图导航、触控板支持、方向键微调
- 数据：localStorage 自动保存 + JSON 导入导出
- 规格（比例·分辨率）：在 composer/参数面板中以触发按钮呈现，点击在画布内打开浮动卡片选择（非全屏模态）；自定义比例为行内 W:H 输入

## 使用

打开 https://<你的用户名>.github.io/flowcraft-canvas/ 即可直接使用。

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

`verify:build` 会额外确认 `index.html` 与当前 `src/` 源码严格一致，避免源码改动没有进入部署产物；`verify:security` 与 `verify:regression` 默认运行仓库内 `test/` 的校验脚本。回归闸门包含 58 个不调用真实 AI 的本地 mock/浏览器 smoke test，覆盖真实 / 演示 / 未实现语义、图片比例适配、AI 流水线节点界面、工作流执行机制、编导链路、统一资产底座与设计智能体节点；结果写入 Git 忽略的 `test-results/`。全部用例都在仓库内 `test/` 目录，克隆后自包含，不依赖上层 Workspace 的历史脚本。`test/` 另有 11 个脚本默认不入闸门：性能测量、演示物料生成、需真实 Key 的 3 类属设计如此；其余为已登记欠债，判定与证据见 `test/DEBT.md`。

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
