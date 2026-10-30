# 10: 邮件发件箱

**What to build:** 任何业务操作需要发邮件时（邮箱验证、找回密码、邀请家长、注册邀请、以后的周报与系统管理员告警），只在同一个数据库事务里往 `email_outbox` 写一行，随业务一起提交；外部 SMTP 从不在事务里调用。后台的“邮件发送”任务每 30 秒取出到期邮件发送，失败按退避重试，最多 10 次后标记为最终失败。开发环境不连接任何 SMTP，只把邮件记录到日志，方便本地点开链接；测试与 e2e 使用 SMTP 桩。

依据：[nfr §4.5.2](../../../docs/01-requirements/nfr.md)（外部调用不在事务里）、[overview §3.6](../../../docs/02-solution/overview.md)（邮件发送、数据清理）、[data-model §6.1](../../../docs/03-design/data-model.md)（`email_outbox`）、开放问题 Q3（阿里云邮件推送 SMTP）。

**Blocked by:** [02 平台层和初始迁移](../../m1-skeleton/issues/02-platform-layer.md)

**Status:** ready-for-agent

- [ ] 提供“在事务内入队邮件”的接口（类型限 `email_outbox.kind` 中的取值，带 `dedupe_key`）；业务事务回滚时邮件不入队，有集成测试。
- [ ] 相同 `dedupe_key` 重复入队只保留一封，有集成测试。
- [ ] 发送任务每 30 秒运行（经 02 的调度器，`pg_try_advisory_lock` 防重叠）；只取 `pending` 且到期的邮件；两个进程同时运行时同一封邮件不会发两次（并发测试）。
- [ ] 发送失败按 1m / 5m / 30m / 2h / 6h… 退避，`attempts` 最多 10 次，之后状态为 `failed` 并留下 `last_error`，可供以后的系统管理员“异常”页读取；用可控 Clock 的测试覆盖完整退避序列。
- [ ] 发送成功即清空正文（不在库里留存令牌链接），记录 `sent_at`；有集成测试断言。
- [ ] 生产环境经 SMTPS 465 发送（nodemailer），SMTP 凭据只从 `/etc/xingya/secrets.env` 读取。
- [ ] 开发环境：不连接 SMTP，把收件人、主题与正文写入日志；该行为只在开发环境开启，生产与测试环境日志仍遵守脱敏规则（令牌不记录、邮箱打码），有测试断言。
- [ ] 测试与 e2e：SMTP 桩可被测试读取已“发送”的邮件（供 11、12 的用例取验证链接）。
