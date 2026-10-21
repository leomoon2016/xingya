# 部署与运维

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。


## 9. 部署与运维

### 9.1 服务器
- 阿里云 ECS（2 GB 内存）+ 2 GB swap 文件（`vm.swappiness=10`），Ubuntu 24.04 LTS，40 GB 云盘，chrony 校时。
- 内存预算：MySQL ≈ 450 MB（`innodb_buffer_pool_size=256M`、`performance_schema=OFF`、`max_connections=40`）；Node ≈ 300–400 MB（`--max-old-space-size=384`，systemd `MemoryMax=600M`）；Nginx ≈ 20 MB；系统 ≈ 300 MB；余量 ≈ 500 MB。
- 磁盘预算：课程包 3 个版本 ≤ 1.5 GB；本地备份 14 份；日志 ≤ 500 MB；告警阈值 85%。

### 9.2 发布流水线（GitHub Actions）
1. `check`：lint、typecheck、模块边界检查、单元测试。
2. `content`：课程包校验 → 音频生成（缓存）→ 构建。
3. `integration`：服务容器 `mysql:8.4`，应用全部迁移（从空库）→ 授权实测 → 集成测试。
4. `e2e`：构建前端与服务，启动 MySQL、服务、LLM 桩与 SMTP 桩，运行 Playwright。
5. `deploy`（仅 main，GitHub Environment 保护）：SSH（专用部署密钥，固定 known_hosts）上传发布包到 `/opt/xingya/releases/<ts-version>/`（`api/`、`web/`、`content/` 三个子目录）→ `xingya migrate`（migrator 账号，按版本号应用 `db/migrations` 中未应用的文件，校验已应用文件的 checksum）→ root 执行 `db/roles.sql`（幂等，补齐新表授权）→ `xingya content:import` → 同步静态文件 → 切换 `/opt/xingya/current` 软链接 → `systemctl restart xingya` → 30 秒内 `/api/v1/health` 返回新版本，否则切回上一个软链接并重启、流水线失败。
- 迁移只前进，并遵守“先扩展、后收缩”：任何迁移都必须与上一个发布的代码兼容，回滚只回代码不回库。
- 首次部署：`deploy/scripts/bootstrap.sh`（root 执行一次）安装 Node 24、MySQL 8.4、Nginx，创建 `xingya` 系统用户、目录、swap、systemd 单元、执行 `db/migrations/0001_init.sql` 第 0 段（建库）与 `db/roles.sql`、设置账号口令。

### 9.3 运行与监控
- systemd：`xingya.service`（`Restart=always`、`RestartSec=2`、`User=xingya`、`EnvironmentFile=/etc/xingya/secrets.env`）；`xingya-backup.timer`（每日 03:30 UTC+8）；`xingya-alerts.timer`（每 5 分钟）。
- 告警脚本（邮件，同类告警 6 小时内只发一次）：磁盘 ≥ 85%；可用内存 < 200 MB 连续两次或 swap 使用 > 1 GB；`xingya`/`mysql`/`nginx` 非 active；最近成功备份早于 26 小时；证书 14 天内到期。
- 应用内异常：对账不一致、邮件最终失败、5xx 突增（10 分钟 > 20 次）→ 入队 `admin_alert` 邮件并在管理端“异常”页展示。

### 9.4 备份与恢复
- 备份脚本把最近一次结果写入 `/var/backups/xingya/backup-status.json`，应用读取后在管理端“异常”页展示。
- 每日 03:30：`mysqldump --single-transaction --routines --triggers xingya | gzip` → `/var/backups/xingya/xingya-YYYYMMDD.sql.gz`，保留 14 份；`gunzip -t` 校验；age 加密后 `ossutil cp` 到 `oss://<bucket>/xingya/db/`，OSS 生命周期规则 14 天删除。
- 恢复手册：从 OSS 取最新加密备份 → 解密 → 在新库导入 → 指向并启动服务。上线前演练一次并记录用时（目标 RTO ≤ 2 小时）；之后每季度演练一次。

> 服务器目录布局与“哪些内容上服务器”见 [overview.md](overview.md)。
