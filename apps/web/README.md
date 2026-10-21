# apps/web —— 孩子端与家长中心（React 19 + Vite，可安装 PWA）

孩子端与家长中心两个懒加载路由块；React Router、TanStack Query、vite-plugin-pwa、CSS Modules。API 类型来自 `packages/contracts`，主题来自 `packages/ui`。**不包含任何系统管理端代码**：后台是独立应用 `apps/admin`（ADR 0015），本应用的构建产物中不得出现 `/admin` 路由或管理端组件（CI 检查构建产物）。

- `src/app/`：应用入口、路由、全局状态与 Service Worker 注册。
- `src/features/child/`：孩子端功能；`src/features/parent/`：家长中心。
- `src/components/`：跨功能复用的界面组件（与后台共享的基础组件在 `packages/ui`）。
- `src/lib/`：API 客户端、请求 ID 生成、心跳、音频播放与录音等工具。
- `public/`：图标、PWA manifest 等原样复制的静态文件。
- `e2e/`：Playwright 端到端测试（孩子与家长流程）。

**是否上服务器**：是。构建产物（`dist/`）部署到 `/opt/xingya/releases/<ts-version>/web/`，由 Nginx 在主域名上提供。`e2e/` 不上服务器。
