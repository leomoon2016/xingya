# 09: 备份与告警

**What to build:** 服务器每天 03:30（UTC+8）自动备份数据库：`pg_dump --single-transaction --routines --triggers xingya | gzip` 写到 `/var/backups/xingya/xingya-YYYYMMDD.sql.gz`，保留 14 份，`gunzip -t` 校验，用 age 公钥加密后上传到 OSS 的 `xingya/db/`，并把最近一次结果写入 `backup-status.json`。每 5 分钟运行一次的告警脚本在磁盘、内存、服务、备份、证书出问题时给运维发邮件。运维有一份恢复手册，并且确实用某次备份恢复成功过。

依据：[deployment §9.3–9.4](../../../docs/02-solution/deployment.md)、[nfr §8.1](../../../docs/01-requirements/nfr.md)“备份”、[roadmap R11](../../../docs/02-solution/roadmap.md)。上传 OSS 使用 07 中配置的私有桶与只写 `xingya/db/` 的备份子账号。

**人工步骤说明：** agent 可以编写备份、恢复、告警脚本与 timer 单元并在一次性环境中验证；在真实 ECS 上启用、离线保存 age 私钥、配置备份子账号与 SMTP 凭据、执行恢复演练由项目负责人本人完成。

**Blocked by:** [06 服务器初始化](06-server-bootstrap.md)、[07 对象存储接入](07-oss-storage.md)

**Status:** ready-for-human

- [ ] `backup.sh` 由 `xingya-backup.timer` 每天 03:30（UTC+8）触发；生成的文件通过 `gunzip -t` 校验；本地只保留 14 份。
- [ ] 备份用 age **公钥**加密后经 `ossutil` 上传到 `oss://<bucket>/xingya/db/`，使用只写该前缀的子账号；服务器上没有 age 私钥（私钥离线保存）。
- [ ] 每次运行（成功或失败）都更新 `/var/backups/xingya/backup-status.json`（时间、结果、文件、大小）；任一步失败时状态为失败并触发告警。
- [ ] 恢复验证：有一个脚本或测试在一次性环境中把加密备份解密、导入一个新库，并检查表数与关键行数和源库一致；恢复手册写明“取最新加密备份 → 解密 → 导入新库 → 指向并启动服务”，目标 RTO ≤ 2 小时。
- [ ] `alerts.sh` 由 `xingya-alerts.timer` 每 5 分钟触发，检查：磁盘 ≥ 85%；可用内存 < 200 MB 连续两次或 swap 使用 > 1 GB；`xingya`、`postgresql`、`nginx` 任一不是 active；最近成功备份早于 26 小时；证书 14 天内到期（含 CDN 与后台子域名证书）。
- [ ] 告警以邮件发出，同类告警 6 小时内只发一次；有测试用模拟的检查结果覆盖每一类告警与去重。
- [ ] SMTP 与 OSS 凭据只从 `/etc/xingya/secrets.env` 读取，不进仓库与日志。
