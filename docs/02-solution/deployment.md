# 部署与运维

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。
> 2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../06-releases/v1.0/changes.md)）：素材改存阿里云 OSS 并经 CDN 提供；音频在课程发布时由后台任务以一次性进程运行 Piper 生成；部署不再导入课程包；内存预算加入一次性 Piper 进程。第 10 部分：AI 角色执行器在服务进程内。目录调整（ADR 0015）：后台改为独立应用 `apps/admin`，在后台子域名上提供；发布目录为 `{api,web,admin,seeds}`；每次部署执行幂等的 `xingya seeds:apply`。


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
2. `seeds`：`tools/validate-seeds` 校验 `seeds/`（模板、示例课程、徽章、种子宠物、短语、头像、安全词表、默认技能与角色挂载；不生成音频）；`tools/safety-eval` 在儿童技能或安全测试集变化时运行。
3. `integration`：服务容器 `mysql:8.4`，应用全部迁移（从空库）→ 授权实测 → 集成测试。
4. `e2e`：构建 web、admin 与服务，启动 MySQL、服务、聊天 / 视觉 / 图像模型桩、Piper 桩、本地 OSS 目录与 SMTP 捕获器，运行 `apps/web/e2e` 与 `apps/admin/e2e`；检查 web 构建产物中不含后台代码（路由、组件名与 `/api/v1/admin` 字符串扫描）。
5. `deploy`（仅 main，GitHub Environment 保护）：SSH（专用部署密钥，固定 known_hosts）上传发布包到 `/opt/xingya/releases/<ts-version>/`（`api/`、`web/`、`admin/`、`seeds/` 四个子目录）→ `xingya migrate`（migrator 账号，按版本号应用 `db/migrations` 中未应用的文件，校验已应用文件的 checksum）→ root 执行 `db/roles.sql`（幂等，补齐新表授权）→ `xingya seeds:apply`（migrator 账号，幂等：只插入 `seeds/` 中缺失的徽章、种子宠物、默认技能与角色挂载，从不删除已有行、不覆盖后台修改；唯一例外是 `origin = seed` 的种子宠物更新名称、描述与图片，写审计，ADR 0021）→ 切换 `/opt/xingya/current` 软链接 → `systemctl restart xingya` → 30 秒内 `/api/v1/health` 返回新版本，否则切回上一个软链接并重启、流水线失败。
- 迁移只前进，并遵守“先扩展、后收缩”：任何迁移都必须与上一个发布的代码兼容，回滚只回代码不回库。
- 部署**不导入任何课程**：课程、伙伴、呀哈哈家族款式在后台制作与发布，存在数据库与 OSS；发布新代码不影响已发布内容。`seeds:apply` 只补齐内置数据中缺失的行；`seeds/samples/` 示例课程只在运维手动执行 `xingya course:import` 时导入。模板、安全词表、短语、头像由 api 启动时从发布目录的 `seeds/` 读取，不入库。
- 技能与 AI 角色（第 10 部分）：角色执行器在 xingya 服务进程内运行（属于“任务执行器”，不新增进程或内存预算；技能里没有可执行代码，不会启动任何子进程）。系统守则 `seeds/safety/agent-guard.md` 随发布包更新，工具目录随 api 更新。默认技能与角色挂载由每次部署的 `xingya seeds:apply` 补齐（已存在的技能不覆盖，只导入缺失的 v1 草稿与白名单），之后技能与角色只在后台修改；部署不会覆盖后台的修改。
- 首次部署：`deploy/scripts/bootstrap.sh`（root 执行一次）安装 Node 24、MySQL 8.4、Nginx、ffmpeg，安装 Piper 到 `/opt/xingya/piper/bin` 与声音模型到 `/opt/xingya/piper/voices`（校验 SHA-256），创建 `xingya` 系统用户（`loginctl enable-linger xingya`）、目录（含 `/var/lib/xingya/tmp`）、swap、systemd 单元，执行 `db/migrations/0001_init.sql` 第 0 段（建库）与 `db/roles.sql`、设置账号口令；之后运行 `xingya admin:create`（`xingya seeds:apply` 已在部署步骤中执行），可选 `xingya course:import` 导入示例课程草稿。

### 9.2a 对象存储与 CDN（阿里云 OSS）
- 一个私有桶（与 ECS 同地域），前缀：`draft/`（草稿素材）、`materials/`（上传资料）、`pub/`（已发布素材）、`xingya/db/`（加密备份，见 §9.4）。
- `pub/` 经 CDN 提供：CDN 域名（如 `cdn.<备案域名>`）**同样需要 ICP 备案**；回源使用 OSS 私有桶回源鉴权；缓存规则：按内容哈希命名的文件 `Cache-Control: public, max-age=31536000, immutable`；CORS 只允许主站源与后台源（Service Worker 缓存与后台预览需要）；开启 Referer 防盗链。
- 草稿与资料只通过 api 签发的 10 分钟签名 URL 访问（仅系统管理员）；孩子端永远只拿到 `pub/` 的 CDN 地址。
- api 使用 RAM 子账号 AccessKey（存 `/etc/xingya/secrets.env`），权限只限本桶 `draft/`、`materials/`、`pub/` 前缀的读写与复制，不能删除桶、改策略或访问 `xingya/db/`；备份上传使用另一个只写 `xingya/db/` 的子账号。
- 删除：素材从不物理删除（已发布版本可能引用）；草稿素材 90 天未被引用则由清理任务归档（`status='archived'`，OSS 生命周期转低频存储）。

### 9.2b 后台子域名（ADR 0015）
- 系统管理端是独立应用 `apps/admin`，部署在 `admin.<备案域名>`：Nginx 单独的 `server` 块提供 `/opt/xingya/current/admin/` 静态文件，`/api/` 代理到同一个服务进程（不新增进程与内存预算）；主站的 `/api/v1/admin/` 直接返回 404，服务端也按 Host 拒绝（双重限制）。
- **ICP**：后台子域名属于已备案主域名，主域名备案覆盖其子域名，不需要单独备案；但需在 DNS 与 TLS 证书中加入（证书同时覆盖主域名、`cdn.` 与 `admin.` 子域名，可用通配符证书），证书到期告警同样覆盖。后台**不经 CDN**（不缓存、不暴露到 CDN 节点）。
- **CSP**：后台使用独立、更严格的 CSP（允许 OSS 签名 URL 预览草稿素材与直传上传地址；`frame-ancestors 'none'`；`X-Robots-Tag: noindex`），主站 CSP 不再需要为后台放宽；见 `deploy/nginx/README.md`。
- **Cookie**：后台会话 Cookie 只发给后台域名（Host-only、`Secure`、`HttpOnly`、`SameSite=Strict`）；主站会话 Cookie 同样不设 `Domain`，两个站点互不携带对方 Cookie。
- 可选：Nginx 按运维 IP 白名单限制后台访问（默认不启用，TOTP 为必需）。

### 9.3 运行与监控
- systemd：`xingya.service`（`Restart=always`、`RestartSec=2`、`User=xingya`、`EnvironmentFile=/etc/xingya/secrets.env`）；`xingya-backup.timer`（每日 03:30 UTC+8）；`xingya-alerts.timer`（每 5 分钟）。
- 告警脚本（邮件，同类告警 6 小时内只发一次）：磁盘 ≥ 85%；可用内存 < 200 MB 连续两次或 swap 使用 > 1 GB；`xingya`/`mysql`/`nginx` 非 active；最近成功备份早于 26 小时；证书 14 天内到期（含 CDN 与后台子域名证书）。
- 应用内异常：对账不一致（星星或碎片）、邮件最终失败、5xx 突增（10 分钟 > 20 次）、AI 任务连续失败 3 次、本月 AI 预算使用超过 80% → 入队 `admin_alert` 邮件并在管理端“异常”页展示。

### 9.4 备份与恢复
- 备份脚本把最近一次结果写入 `/var/backups/xingya/backup-status.json`，应用读取后在管理端“异常”页展示。
- 每日 03:30：`mysqldump --single-transaction --routines --triggers xingya | gzip` → `/var/backups/xingya/xingya-YYYYMMDD.sql.gz`，保留 14 份；`gunzip -t` 校验；age 加密后 `ossutil cp` 到 `oss://<bucket>/xingya/db/`，OSS 生命周期规则 14 天删除。
- 恢复手册：从 OSS 取最新加密备份 → 解密 → 在新库导入 → 指向并启动服务。上线前演练一次并记录用时（目标 RTO ≤ 2 小时）；之后每季度演练一次。

> 服务器目录布局与“哪些内容上服务器”见 [overview.md](overview.md)。

### 9.5 上线检查清单
上线（对外提供服务）前逐项确认；未完成任何一项都不能上线。

| # | 项目 | 说明 |
| --- | --- | --- |
| L1 | **选定域名并完成 ICP 备案** | 域名推迟到上线前选定（用户 2026-10-22）。备案需 **1–3 周**，最迟 W26 提交（[里程碑 §11](roadmap.md#11-里程碑单人开发约-295-周)）；主域名备案覆盖 `admin.` 与 `cdn.` 子域名，但 CDN 加速域名需单独在 CDN 控制台添加并通过审核 |
| L2 | **DirectMail 发信域名** | 阿里云邮件推送**只接受已备案的域名**，所以必须在 L1 之后：添加发信域名（如 `mail.<备案域名>`）、配置 SPF / DKIM / DMARC 与 MX、创建发信地址 `noreply@…`、把 SMTP 用户名与密码写入 `/etc/xingya/secrets.env`（[ADR 0022](../adr/0022-llm-vision-image-providers.md)）；用 QQ 邮箱与 163 邮箱各收一封测试邮件，确认未进垃圾箱 |
| L3 | TLS 证书 | 覆盖主域名、`admin.`、`cdn.`；到期告警生效 |
| L4 | OSS 与 CDN | 私有桶、回源鉴权、`pub/` 缓存规则、RAM 子账号最小权限 |
| L5 | 模型配置 | 三个默认模型（聊天 / 视觉 / 图像，阿里云百炼）的 Key 已在后台录入并“测试连接”通过；`XINGYA_MASTER_KEY` 已生成并离线备份；月度 AI 预算与角色预算已设置 |
| L6 | 种子数据 | `xingya seeds:apply` 成功：默认技能与角色、徽章、短语、头像、游戏搭档、**24 种种子宠物**（`seeds/pets/`）；默认角色与技能经审核发布 |
| L7 | 首发课程 | 首发课程（含旧英语课程导入结果）通过 K1–K13 并发布 |
| L8 | 系统管理员 | 用 `xingya admin:create` 创建、TOTP 已绑定；`xingya admin:reset-totp` 演练一次 |
| L9 | 备份与恢复 | 恢复演练已完成（RTO ≤ 2 小时） |
| L10 | 验收 | S1–S13 全部通过（[v1.0 验收](../06-releases/v1.0/acceptance.md)） |
| L11 | 替换素材预案 | 游戏搭档与种子宠物的原创替换图已准备好（[ADR 0018](../adr/0018-mario-game-partner.md)、[ADR 0021](../adr/0021-nintendo-pets-seed.md)），换图步骤写进运维手册 |
