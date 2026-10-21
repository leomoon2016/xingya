# apps/web —— 前端（React 19 + Vite，可安装 PWA）

孩子端、家长中心、系统管理端三个懒加载路由块；React Router、TanStack Query、vite-plugin-pwa、CSS Modules。API 类型来自 `packages/contracts`。

- `src/app/`：应用入口、路由、全局状态与 Service Worker 注册。
- `src/features/`：按功能划分的页面与逻辑。
- `src/components/`：跨功能复用的界面组件。
- `src/lib/`：API 客户端、请求 ID 生成、心跳、音频播放与录音等工具。
- `public/`：图标、PWA manifest 等原样复制的静态文件。
- `e2e/`：Playwright 端到端测试。

**是否上服务器**：是。构建产物（`dist/`）部署到 `/opt/xingya/releases/<ts-version>/web/`，由 Nginx 提供。`e2e/` 不上服务器。
