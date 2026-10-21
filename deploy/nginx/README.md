# nginx

站点配置模板（TLS 1.2+、HTTP→HTTPS、HSTS），两个 `server` 块（ADR 0015）：

**主站**（`<备案域名>`，孩子端与家长中心）
- `/`：`/opt/xingya/current/web/`（index.html 不缓存、带哈希资源永久缓存、Service Worker 不缓存）。
- `/api/`：代理到 127.0.0.1:3000（聊天 30 秒超时、请求体 ≤ 64 KB、登录限流）；**`/api/v1/admin/` 直接返回 404**（后台接口只在后台域名可用）。
- CSP：`default-src 'self'`；`img-src`/`media-src` 只额外允许本站 CDN 域名；`connect-src 'self'`；`frame-ancestors 'none'`。

**后台**（`admin.<备案域名>`，系统管理端）
- `/`：`/opt/xingya/current/admin/`（不做 PWA，无 Service Worker；index.html 不缓存）。
- `/api/`：代理到同一个 127.0.0.1:3000，并设置请求头标明后台主机；后台会话 Cookie 只发给本域名（`Host-only`、`Secure`、`HttpOnly`、`SameSite=Strict`）。
- 独立、更严格的 CSP：`default-src 'self'`；`img-src`/`media-src` 允许本站 CDN 与 OSS 签名 URL 所在的私有桶域名（草稿素材预览）；`connect-src` 允许 `'self'` 与 OSS 直传上传地址；`frame-ancestors 'none'`；`X-Robots-Tag: noindex`。
- 可选：按运维 IP 白名单限制访问（`allow`/`deny`），默认不启用。
- 后台不经 CDN；证书与 DNS 记录需同时覆盖主域名、CDN 子域名与后台子域名（同一主域名的 ICP 备案覆盖其子域名，见部署文档）。

素材由 OSS + CDN 提供，不经 Nginx。

**是否上服务器**：是（`/etc/nginx/`）。
