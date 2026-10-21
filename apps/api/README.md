# apps/api —— 后端服务

Node 24 + Fastify 5 + Kysely + Zod + mysql2 的模块化单体（单进程）。设计见 `docs/02-solution/overview.md` 与 `docs/03-design/`。

- `src/modules/`：11 个业务模块，各自拥有自己的表，只通过 `index.ts` 互相调用。
- `src/platform/`：`db/`（连接、事务、幂等、迁移）、`auth/`（会话、主体、TOTP、主站与后台域名的区分）、`logging/`（日志与错误格式）、`config/`（配置、Clock、调度器、OSS 客户端）。
- `test/`：`unit/`（单元）、`integration/`（真实 MySQL 8.4）、`concurrency/`（并发）、`safety/`（儿童安全）。
- 运维命令：`xingya migrate`（应用 `db/migrations`）、`xingya admin:create`、`xingya seeds:apply`（部署时执行：只插入 `seeds/` 中缺失的装扮、默认技能与角色挂载，不覆盖后台修改）、`xingya course:import <file>`（示例课程导入为草稿，手动）。
- 进程内任务执行器消费 `ai_jobs`（最多 2 个并发）；音频任务以一次性进程调用 `/opt/xingya/piper/bin/piper` 与 ffmpeg。

**是否上服务器**：是。编译产物（连同 `packages/`、`db/migrations` 与 `db/roles.sql`）部署到 `/opt/xingya/releases/<ts-version>/api/`；内置数据在同一发布目录的 `seeds/`（api 启动时读取模板、安全词表、短语、头像）。测试不上服务器。同一进程同时服务主站与后台域名的 `/api`，`/api/admin/*` 只接受后台域名（ADR 0015）。
