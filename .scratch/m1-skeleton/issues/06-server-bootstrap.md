# 06: 服务器初始化

**What to build:** 运维在一台全新的阿里云 ECS（Ubuntu 24.04 LTS，2 GB 内存）上以 root 执行一次 `deploy/scripts/bootstrap.sh`，服务器即具备运行星芽学园的全部条件：安装 Node 24、PostgreSQL 16、Nginx、ffmpeg；安装 Piper 到 `/opt/xingya/piper/bin`、声音模型到 `/opt/xingya/piper/voices`（校验 SHA-256）；创建 `xingya` 系统用户与目录、2 GB swap、systemd 单元；执行 `0001` 迁移的第 0 段（建库）与 `db/roles.sql` 并设置账号口令。Nginx 配好主站与后台子域名两个 `server` 块（HTTPS、两套 CSP）。之后发布包可以直接部署上来（见 08）。

在真实 ECS 上执行脚本、开放安全组、申请证书属于运维（项目负责人）本人的步骤；本单交付脚本与配置，并在一次性的 Ubuntu 24.04 环境（容器或虚拟机）中验证。域名的 ICP 备案尚未完成，证书与正式域名在备案后再签发；备案前通过 SSH 端口转发访问。

依据：[deployment §9.1–9.3](../../../docs/02-solution/deployment.md)、[overview“服务器目录布局”](../../../docs/02-solution/overview.md)、[nfr §8.1](../../../docs/01-requirements/nfr.md)、[deploy/nginx/README](../../../deploy/nginx/README.md)、[deploy/systemd/README](../../../deploy/systemd/README.md)、[ADR 0023](../../../docs/adr/0023-postgres-local-only-ssh-tunnel.md)、[ADR 0015](../../../docs/adr/0015-admin-app-and-seeds.md)、开放问题 Q17（声音模型）。

**人工步骤说明：** agent 可以编写并在一次性环境中验证 bootstrap 脚本、Nginx 与 systemd 配置和运维说明；在真实 ECS 上执行、配置安全组、申请证书、ICP 备案由项目负责人本人完成。

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [ ] `bootstrap.sh` 在一次性的 Ubuntu 24.04 环境中从零执行成功；执行后 Node 24、PostgreSQL 16、Nginx、ffmpeg、Piper 可用。
- [ ] Piper 与声音模型（首发 `zh_CN-huayan-medium`、`en_US-amy-medium`）下载后校验 SHA-256，校验失败时脚本中止。
- [ ] 创建 `xingya` 系统用户（启用 linger）、`/opt/xingya/{releases,scripts,piper}`、`/var/lib/xingya/tmp`、`/var/backups/xingya`；2 GB swap 与 `vm.swappiness=10`；chrony 校时。
- [ ] PostgreSQL 只监听本机，并按内存预算配置（`shared_buffers=128MB`、`work_mem=4MB`、`maintenance_work_mem=64MB`、`effective_cache_size=512MB`、`max_connections=40`）；执行 `0001` 第 0 段与 `db/roles.sql`，账号口令在服务器上生成，只写入 `/etc/xingya/secrets.env`（0600，属主 xingya），不回显、不进仓库与日志。
- [ ] systemd：`xingya.service`（`User=xingya`、`Restart=always`、`RestartSec=2`、`MemoryMax=600M`、`EnvironmentFile=/etc/xingya/secrets.env`，允许以 `systemd-run --user --scope -p MemoryMax=350M` 启动一次性 Piper/ffmpeg 进程）；备份与告警的 timer 单元文件就位（脚本内容在 09）。
- [ ] Nginx 主站：TLS 1.2+、HTTP→HTTPS、HSTS；`/` 提供 `current/web/`（index.html 与 Service Worker 不缓存，带哈希资源永久缓存）；`/api/` 代理到 127.0.0.1:3000，请求体 ≤ 64 KB、登录限流；`/api/v1/admin/` 直接返回 404；CSP `default-src 'self'`，`img-src`/`media-src` 只额外允许本站 CDN 域名，`connect-src 'self'`，`frame-ancestors 'none'`。
- [ ] Nginx 后台站点 `admin.<域名>`：提供 `current/admin/`（无 Service Worker，index.html 不缓存），`/api/` 代理到同一服务并标明后台主机；独立、更严格的 CSP（额外只允许 CDN 与 OSS 签名 URL / 直传地址，`frame-ancestors 'none'`）；`X-Robots-Tag: noindex`；不经 CDN；可选运维 IP 白名单默认关闭。
- [ ] 两个站点都带 `X-Frame-Options: DENY`、`Referrer-Policy: same-origin`、`Permissions-Policy: microphone=(self)`；`nginx -t` 通过，并有自动检查断言两套 CSP 与上述响应头。
- [ ] 服务器加固：SSH 仅密钥登录、禁止 root 密码登录、fail2ban、自动安全更新；安全组只开放 22/80/443 写入运维说明（控制台操作由运维完成）。
- [ ] 域名、证书相关取值都是占位参数，不在脚本中写死；备案前用 SSH 端口转发访问的方法写入运维说明。
