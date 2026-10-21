# nginx

站点配置模板：TLS 1.2+、HTTP→HTTPS、安全响应头（CSP 的 `img-src`/`media-src`/`connect-src` 只额外允许本站 CDN 域名）、`/` 前端（index.html 不缓存、带哈希资源永久缓存）、`/api/` 代理到 127.0.0.1:3000（聊天 30 秒超时、请求体 ≤64 KB、登录限流）。素材由 OSS + CDN 提供，不经 Nginx。

**是否上服务器**：是（`/etc/nginx/`）。
