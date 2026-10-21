# apps/admin/src

系统管理端源码（ADR 0015）：`app/`（入口、路由、登录与 TOTP、会话）、`components/`（后台专用组件；基础组件来自 `packages/ui`）、`lib/`（API 客户端、签名 URL 与直传、表单工具）、`features/`（各后台页面，见 [features/README.md](features/README.md)）。

**是否上服务器**：是（构建产物 → `releases/<ts-version>/admin/`，后台子域名提供）。
