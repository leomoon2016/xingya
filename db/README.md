# db —— 数据库

| 路径 | 内容 | 是否上服务器 |
| --- | --- | --- |
| `migrations/` | 版本化 SQL 迁移 `NNNN_名称.sql`，只前进；部署时由 migrator 角色按顺序应用 | 是（随 api 发布包部署） |
| `roles.sql` | PostgreSQL 角色与按表/按列授权；超级用户在应用迁移之后执行，可重复执行 | 是 |
| `dev-fixtures/` | 本地开发与 e2e 用的 SQL 示例行（测试夹具），从不部署；与顶层 `seeds/` 不同 | 否 |
| `verify/` | 在临时 PostgreSQL 16 上验证迁移与授权的脚本及结果 | 否 |

`migrations/0001_init.sql` 是**草案**：因为还没有部署任何环境，历次设计变更直接修订本文件。**2026-10-30** 由 MySQL 8.4 原地改写为 **PostgreSQL 16**（见 [specs/2026-10-30-postgresql-redesign.md](../docs/superpowers/specs/2026-10-30-postgresql-redesign.md)、[ADR 0023](../docs/adr/0023-postgres-local-only-ssh-tunnel.md)、[ADR 0024](../docs/adr/0024-studio-postgres-job-queue.md)）。共 82 张表（业务 79 + 平台 3）。**一旦有环境部署过 0001，之后的结构变更只能追加新的迁移文件。**
