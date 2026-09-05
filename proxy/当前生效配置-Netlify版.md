# FlowCraft API 代理 · 当前生效配置（Netlify 版）

> 2026-08-29 部署完成并全链路验证通过（鉴权 / CORS / 真实生图）。
> 背景：中转站不支持浏览器 CORS，且 workers.dev 与 vercel.app 域名在本机网络被屏蔽，
> 最终选用 Netlify Functions（netlify.app 域名可达）。

## 代理地址与口令

- **代理地址**：`https://famous-bienenstitch-cb1abc.netlify.app`
- **代理令牌**：存于 Netlify 环境变量 `PERSONAL_ACCESS_TOKEN`，本文件不记录具体值
- **上游**：`https://momoai.asia/v1`（OPENAI_UPSTREAM_BASE），Key 存于 Netlify 环境变量（OPENAI_KEY）

## FlowCraft 前端配置

1. AI 助手 → ⚙ → **API 代理地址** 填上面的代理地址
2. **代理令牌** 填 Netlify 环境变量 `PERSONAL_ACCESS_TOKEN` 的值
3. 点「保存/启用」

生效范围：生图（gpt-image-2 等）与中转对话全部经代理；DeepSeek 配了 Key 时仍直连优先。

## 维护说明

- 源码：`proxy/netlify-proxy/`（netlify/functions/proxy.js + netlify.toml）
- 部署：`netlify deploy --prod --dir=. --functions=netlify/functions`（需从 netlify-proxy 目录执行）
- 环境变量：`netlify env:set PERSONAL_ACCESS_TOKEN VALUE --context production`（VALUE 仅通过终端输入，不写入仓库）
- 注意：站点 Project visibility 必须保持 **Public**（默认 Private，会导致全站 401 登录墙）

## 历史尝试记录

| 平台 | 结果 |
|---|---|
| Cloudflare Workers（workers.dev） | 部署成功，但 workers.dev 域名被本机网络屏蔽（DNS 污染） |
| Vercel（vercel.app） | 部署成功，但 *.vercel.app 同样被屏蔽 |
| Deno Deploy | 注册不可用（403） |
| **Netlify（netlify.app）** | ✅ 域名可达，当前生效方案 |
