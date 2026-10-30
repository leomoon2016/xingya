# scripts

`bootstrap.sh`（root 首次执行：用户、目录、PostgreSQL、Nginx、swap、安装 Piper 到 `/opt/xingya/piper/bin` 与声音模型到 `/opt/xingya/piper/voices` 并校验 SHA-256、ffmpeg）、`deploy.sh`/`rollback.sh`（发布目录 `/opt/xingya/releases/<ts-version>/{api,web,admin,seeds}`，执行 `xingya migrate`、`roles.sql`、`xingya seeds:apply` 后切换 `/opt/xingya/current`）、`backup.sh`（每日备份、校验、加密上传 OSS、写 `backup-status.json`）、`alerts.sh`（磁盘/内存/服务/备份/证书/AI 预算告警邮件）。

**是否上服务器**：是（`/opt/xingya/scripts/`）。
