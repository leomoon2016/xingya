# apps/admin —— 系统管理端（独立应用）

React 19 + Vite 的**独立**后台应用（ADR 0015）：自己的构建产物、自己的子域名（`admin.<备案域名>`）、自己的 CSP；孩子端 PWA 永远不包含后台代码。不做 PWA、不注册 Service Worker。只有系统管理员（用户名 + 密码 + TOTP）可用。API 类型来自 `packages/contracts`，主题与基础组件来自 `packages/ui`，课程表单模式来自 `packages/seed-schema`，SKILL.md 导入预检来自 `packages/skill-format`。

- `src/app/`：入口、路由、TOTP 登录、全局 Provider 与错误边界。
- `src/features/`：后台功能（AI 工作室、技能库、AI 角色、任务历史、课程、伙伴（宠物）、呀哈哈家族、投放规则、家庭、系统设置、审计与异常）。
- `src/components/`：后台专用组件（表单编辑器、费用预估确认框、一句话框、流水线进度等）。
- `src/lib/`：API 客户端（请求 ID、统一错误处理）、签名 URL 预览、上传助手。
- `e2e/`：后台 Playwright 用例。

**是否上服务器**：是。构建产物部署到 `/opt/xingya/releases/<ts-version>/admin/`，由 Nginx 在后台子域名上提供（不经 CDN）。`e2e/` 不上服务器。
