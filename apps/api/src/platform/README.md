# platform —— 平台层（非业务模块）

放所有模块共用的基础设施，不含业务规则：

- **db**：mysql2 连接池（Unix socket、`time_zone='+00:00'`）、Kysely 实例、事务助手（死锁自动重试 2 次）。
- **session**：会话与家庭设备 Cookie 的解析、主体（家长/孩子/管理员）鉴权钩子。
- **idempotency**：`X-Client-Request-Id` 校验、`idempotency_requests` 占位与响应回放。
- **error format**：统一错误体 `{error:{code,message,details,traceId}}` 与错误码映射。
- **config**：读取 `/etc/xingya/secrets.env` 与环境变量，Zod 校验。
- **logging**：pino JSON 日志与脱敏规则。
- **scheduled jobs**：进程内调度器（`GET_LOCK` 防重叠），任务本身由各模块提供。
- **Clock**：可注入的时间源（测试可控）。

拥有的表：system_settings、idempotency_requests、schema_migrations。
