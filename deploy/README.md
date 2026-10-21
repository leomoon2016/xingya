# deploy —— 服务器配置与脚本

| 目录 | 内容 | 落到服务器的位置 |
| --- | --- | --- |
| `nginx/` | 站点配置：HTTPS、HSTS、CSP（允许本站 CDN 域名）、前端静态文件、`/api` 反向代理与限流 | `/etc/nginx/` |
| `systemd/` | `xingya.service`、`xingya-backup.timer`、`xingya-alerts.timer` 等单元 | `/etc/systemd/system/` |
| `scripts/` | `bootstrap.sh`（首次初始化，含安装 Piper 与声音模型）、发布/回滚、备份（mysqldump + age + ossutil）、资源告警 | `/opt/xingya/scripts/` |

课程图片、音频与动画素材不经 Nginx：存放在阿里云 OSS 公开前缀 `pub/`，经 CDN 提供。

**是否上服务器**：是。机密不在这里，放服务器 `/etc/xingya/secrets.env`。
