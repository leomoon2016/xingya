# 部署与运维

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。
> 2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../06-releases/v1.0/changes.md)）：素材改存阿里云 OSS 并经 CDN 提供；音频在课程发布时由后台任务以一次性进程运行 Piper 生成；部署不再导入课程包；内存预算加入一次性 Piper 进程。


## 9. 部署与运维

### 9.1 服务器
- 阿里云 ECS（2 GB 内存）+ 2 GB swap 文件（`vm.swappiness=10`），Ubuntu 24.04 LTS，40 GB 云盘，chrony 校时。
- 内存预算（2 GB 物理内存 + 2 GB swap）：

| 进程 | 预算 | 约束 |
| --- | --- | --- |
| MySQL | ≈ 450 MB | `innodb_buffer_pool_size=256M`、`performance_schema=OFF`、`max_connections=40` |
| Node（xingya 服务，含任务执行器） | ≈ 400 MB | `--max-old-space-size=384`，systemd `MemoryMax=600M`；AI 提供方调用都是 HTTP，不占本机大内存；资料文本抽取在 worker 线程中流式处理（堆上限 128 MB、解压总量 ≤ 100 MB），单文件 ≤ 20 MB |
| Piper / ffmpeg 一次性进程 | ≤ 350 MB，**只在音频任务运行时存在** | `systemd-run --user --scope -p MemoryMax=350M`，独立 cgroup；数据库槽位保证同一时刻最多 1 个；每段文本超时 120 秒 |
| Nginx | ≈ 20 MB | |
| 系统 | ≈ 300 MB | |
| 余量 | ≈ 480 MB（Piper 运行时）/ ≈ 830 MB（平时） | 另有 2 GB swap 兜底；可用内存 < 200 MB 告警 |

- 没有常驻语音服务；Piper 二进制与声音模型（约 60–120 MB/个，首发 2 个）放在磁盘 `/opt/xingya/piper/`，只在任务运行时加载。
- 磁盘预算：发布目录 3 个 ≤ 300 MB；Piper 与声音模型 ≤ 300 MB；临时目录 `/var/lib/xingya/tmp`（任务结束即删）≤ 1 GB；本地备份 14 份；日志 ≤ 500 MB；告警阈值 85%。图片、音频、动画素材与上传资料都在 OSS，不占云盘。

### 9.2 发布流水线（GitHub Actions）
1. `check`：lint、typecheck、模块边界检查、单元测试。
2. `content`：`tools/validate-content` 校验模板、示例课程、装扮初始数据、短语与安全词表（不生成音频）。
3. `integration`：服务容器 `mysql:8.4`，应用全部迁移（从空库）→ 授权实测 → 集成测试。
4. `e2e`：构建前端与服务，启动 MySQL、服务、LLM/图像/OCR 桩、Piper 桩、本地 OSS 目录与 SMTP 桩，运行 Playwright。
5. `deploy`（仅 main，GitHub Environment 保护）：SSH（专用部署密钥，固定 known_hosts）上传发布包到 `/opt/xingya/releases/<ts-version>/`（`api/`、`web/` 两个子目录）→ `xingya migrate`（migrator 账号，按版本号应用 `db/migrations` 中未应用的文件，校验已应用文件的 checksum）→ root 执行 `db/roles.sql`（幂等，补齐新表授权）→ 同步前端静态文件 → 切换 `/opt/xingya/current` 软链接 → `systemctl restart xingya` → 30 秒内 `/api/v1/health` 返回新版本，否则切回上一个软链接并重启、流水线失败。
- 迁移只前进，并遵守“先扩展、后收缩”：任何迁移都必须与上一个发布的代码兼容，回滚只回代码不回库。
- 部署**不导入任何内容**：课程、伙伴、呀哈哈款式在后台制作与发布，存在数据库与 OSS；发布新代码不影响已发布内容。
- 首次部署：`deploy/scripts/bootstrap.sh`（root 执行一次）安装 Node 24、MySQL 8.4、Nginx、ffmpeg，安装 Piper 到 `/opt/xingya/piper/bin` 与声音模型到 `/opt/xingya/piper/voices`（校验 SHA-256），创建 `xingya` 系统用户（`loginctl enable-linger xingya`）、目录（含 `/var/lib/xingya/tmp`）、swap、systemd 单元，执行 `db/migrations/0001_init.sql` 第 0 段（建库）与 `db/roles.sql`、设置账号口令；之后运行 `xingya admin:create`、`xingya shop:import`，可选 `xingya course:import` 导入示例课程草稿。

### 9.2a 对象存储与 CDN（阿里云 OSS）
- 一个私有桶（与 ECS 同地域），前缀：`draft/`（草稿素材）、`materials/`（上传资料）、`pub/`（已发布素材）、`xingya/db/`（加密备份，见 §9.4）。
- `pub/` 经 CDN 提供：CDN 域名（如 `cdn.<备案域名>`）**同样需要 ICP 备案**；回源使用 OSS 私有桶回源鉴权；缓存规则：按内容哈希命名的文件 `Cache-Control: public, max-age=31536000, immutable`；CORS 只允许本站源（Service Worker 缓存需要）；开启 Referer 防盗链。
- 草稿与资料只通过 api 签发的 10 分钟签名 URL 访问（仅系统管理员）；孩子端永远只拿到 `pub/` 的 CDN 地址。
- api 使用 RAM 子账号 AccessKey（存 `/etc/xingya/secrets.env`），权限只限本桶 `draft/`、`materials/`、`pub/` 前缀的读写与复制，不能删除桶、改策略或访问 `xingya/db/`；备份上传使用另一个只写 `xingya/db/` 的子账号。
- 删除：素材从不物理删除（已发布版本可能引用）；草稿素材 90 天未被引用则由清理任务归档（`status='archived'`，OSS 生命周期转低频存储）。

### 9.3 运行与监控
- systemd：`xingya.service`（`Restart=always`、`RestartSec=2`、`User=xingya`、`EnvironmentFile=/etc/xingya/secrets.env`）；`xingya-backup.timer`（每日 03:30 UTC+8）；`xingya-alerts.timer`（每 5 分钟）。
- 告警脚本（邮件，同类告警 6 小时内只发一次）：磁盘 ≥ 85%；可用内存 < 200 MB 连续两次或 swap 使用 > 1 GB；`xingya`/`mysql`/`nginx` 非 active；最近成功备份早于 26 小时；证书 14 天内到期（含 CDN 域名证书）。
- 应用内异常：对账不一致（星星或碎片）、邮件最终失败、5xx 突增（10 分钟 > 20 次）、AI 任务连续失败 3 次、本月 AI 预算使用超过 80% → 入队 `admin_alert` 邮件并在管理端“异常”页展示。

### 9.4 备份与恢复
- 备份脚本把最近一次结果写入 `/var/backups/xingya/backup-status.json`，应用读取后在管理端“异常”页展示。
- 每日 03:30：`mysqldump --single-transaction --routines --triggers xingya | gzip` → `/var/backups/xingya/xingya-YYYYMMDD.sql.gz`，保留 14 份；`gunzip -t` 校验；age 加密后 `ossutil cp` 到 `oss://<bucket>/xingya/db/`，OSS 生命周期规则 14 天删除。
- 恢复手册：从 OSS 取最新加密备份 → 解密 → 在新库导入 → 指向并启动服务。上线前演练一次并记录用时（目标 RTO ≤ 2 小时）；之后每季度演练一次。

> 服务器目录布局与“哪些内容上服务器”见 [overview.md](overview.md)。
