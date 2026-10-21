# deploy —— 服务器配置与脚本

| 目录 | 内容 | 落到服务器的位置 |
| --- | --- | --- |
| `nginx/` | 站点配置：HTTPS、HSTS、CSP、静态文件（前端、课程包）、`/api` 反向代理与限流 | `/etc/nginx/` |
| `systemd/` | `xingya.service`、`xingya-backup.timer`、`xingya-alerts.timer` 等单元 | `/etc/systemd/system/` |
| `scripts/` | `bootstrap.sh`（首次初始化）、发布/回滚、备份（mysqldump + age + ossutil）、资源告警 | `/opt/xingya/scripts/` |

**是否上服务器**：是。机密不在这里，放服务器 `/etc/xingya/secrets.env`。
