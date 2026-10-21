# scripts

`bootstrap.sh`（root 首次执行）、`deploy.sh`/`rollback.sh`（切换 `/opt/xingya/current`）、`backup.sh`（每日备份、校验、加密上传 OSS、写 `backup-status.json`）、`alerts.sh`（磁盘/内存/服务/备份/证书告警邮件）。

**是否上服务器**：是（`/opt/xingya/scripts/`）。
