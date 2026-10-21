# db —— 数据库访问

mysql2 连接池（Unix socket、`time_zone='+00:00'`）、Kysely 实例、事务助手（死锁 / 锁等待超时自动重试 2 次）、幂等表 `idempotency_requests` 的占位与回放、迁移命令 `xingya migrate` 与 `xingya seeds:apply` 的执行入口。
