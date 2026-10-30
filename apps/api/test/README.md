# apps/api/test

服务端测试（Vitest），不放在模块目录中：

| 目录 | 内容 |
| --- | --- |
| `unit/` | 单元测试，按模块分子目录 `unit/<module>/` |
| `integration/` | 集成测试：CI 中真实 PostgreSQL 16，从空库应用全部迁移与 `db/roles.sql` |
| `concurrency/` | 并发与幂等：账本、冻结与兑换、任务槽位、乐观锁 |
| `safety/` | 儿童安全规则：过滤词表、守则、呀哈哈队长输出检查（与 `tools/safety-eval` 配合） |

**是否上服务器**：否。
