# 02: 平台层和初始迁移

**What to build:** 服务端具备所有业务模块都要依赖的平台能力：一个业务操作 = 一个数据库事务、写请求幂等、统一错误格式、可注入的 Clock、进程内调度器、迁移命令。运维在一个空的 MySQL 8.4 上执行 `xingya migrate` 后，`0001` 迁移被完整应用、`db/roles.sql` 授权补齐；开发者跑集成测试时，`db/verify` 的结构与授权检查作为测试的一部分自动执行。之后的任务单只需要写业务代码，不再自己处理事务、幂等与错误格式。

依据：[nfr §4.5](../../../docs/01-requirements/nfr.md)（幂等、事务与锁、乐观锁）、[api §5.1–5.2](../../../docs/03-design/api.md)（约定与错误格式）、[overview §3.6](../../../docs/02-solution/overview.md)（调度器）、[deployment §9.2](../../../docs/02-solution/deployment.md)（迁移）、[db/README](../../../db/README.md)。

**Blocked by:** [01 仓库骨架打通](01-repo-skeleton.md)

**Status:** ready-for-agent

- [ ] `xingya migrate`：用 migrator 账号按版本号顺序应用 `db/migrations` 中未应用的文件，记录到 `schema_migrations`，并校验已应用文件的 checksum（被改动时拒绝继续）；迁移只前进。
- [ ] 集成测试：在空库上执行 `xingya migrate` + `db/roles.sql`，`0001` 迁移成功；再执行一次 `xingya migrate` 无变化。
- [ ] `db/verify` 接入集成测试：在临时 MySQL 8.4 上跑其全部检查（两次构建结构指纹一致、CHECK、唯一键、复合外键与授权实测）并全部通过；测试只连接临时实例，绝不指向生产。
- [ ] 事务：提供“一个业务操作一个事务”（REPEATABLE READ）的封装；遇到 `ER_LOCK_DEADLOCK` / `ER_LOCK_WAIT_TIMEOUT` 自动重试整个事务最多 2 次；跨模块调用以 `…InTx` 形式接收调用方的事务、从不自行提交；有集成测试覆盖重试与回滚。
- [ ] 幂等：所有需登录的写请求必须带 `X-Client-Request-Id`（小写 UUID v4），缺失 → `400 VALIDATION_FAILED`；事务第一步写 `idempotency_requests` 占位，完成后保存 2xx 响应；同 ID 并发 10 次只执行一次、其余原样返回已存响应；同 ID 不同请求体 → `409 IDEMPOTENCY_KEY_REUSED`；业务 4xx 回滚、不占用该 ID。以上都有集成或并发测试。
- [ ] 未登录写接口同样要求 `X-Client-Request-Id`（只用于防跨站伪造，不写幂等表）；服务端校验 `Origin` 只接受本站源，不开放 CORS。
- [ ] 统一错误格式 `{error: {code, message, details?, traceId}}`：错误码枚举放在 `packages/contracts`，`message` 为可直接展示的中文；未预期异常 → `500 INTERNAL` 且不泄露堆栈；`traceId` 与服务端日志一致。
- [ ] 输入校验：所有请求体用 Zod 严格模式（未知字段拒绝）；请求体 ≤ 64 KB。
- [ ] 日志：pino JSON；口令、令牌、PIN 脱敏，邮箱打码；有单元测试断言脱敏生效。
- [ ] Clock：所有取时间的代码都经可注入的 `Clock`；测试环境（`NODE_ENV=test`）提供仅本机可访问的 `POST /__test/clock`，生产构建不包含该路由（有测试断言）。
- [ ] 调度器：进程内单实例调度器，按名称注册周期任务；执行时用 MySQL `GET_LOCK('xingya:job:<name>', 0)` 防止重叠执行；有测试证明两个实例同时触发同一任务时只有一个执行。
- [ ] 连接设置 `time_zone='+00:00'`，所有时间以 UTC 读写。
- [ ] 集成测试可以通过一个统一的工作区命令运行（供 CI 的 `integration` 阶段调用）。
