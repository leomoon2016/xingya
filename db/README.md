# db —— 数据库

| 路径 | 内容 | 是否上服务器 |
| --- | --- | --- |
| `migrations/` | 版本化 SQL 迁移 `NNNN_名称.sql`，只前进；部署时由 migrator 账号按顺序应用 | 是（随 api 打包） |
| `roles.sql` | 角色、账号（@localhost，初始锁定）与按表授权；root 在应用迁移之后执行，可重复执行 | 是（随 api 打包） |
| `seeds/` | 本地开发与 e2e 用的示例数据 | 否 |
| `verify/` | 在临时 MySQL 8.4 上验证迁移与授权的脚本及结果 | 否 |

`migrations/0001_init.sql` 与 `roles.sql` 由设计阶段的 `schema-draft.sql` 拆分而来（第 0–9 段 / 第 10 段），**草案，设计文档审核通过前可能调整**。拆分后已重新验证：73/73 通过，结构与拆分前一致（见 `verify/result.txt`）。
