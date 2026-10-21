# apps/api —— 后端服务

Node 24 + Fastify 5 + Kysely + Zod + mysql2 的模块化单体（单进程）。设计见 `docs/02-solution/overview.md` 与 `docs/03-design/`。

- `src/modules/`：11 个业务模块，各自拥有自己的表，只通过 `index.ts` 互相调用。
- `src/platform/`：数据库连接与事务、会话鉴权、幂等、错误格式、配置、日志、定时任务、OSS 客户端。
- `test/integration/`：连接真实 MySQL 8.4 的集成测试。
- 运维命令：`xingya migrate`（应用 `db/migrations`）、`xingya admin:create`、`xingya course:import <file>`（示例课程导入为草稿）、`xingya shop:import`（装扮初始数据）。
- 进程内任务执行器消费 `ai_jobs`（最多 2 个并发）；音频任务以一次性进程调用 `/opt/xingya/piper/bin/piper` 与 ffmpeg。

**是否上服务器**：是。编译产物（连同 `packages/` 与 `content/{templates,phrases,safety,avatars}`、`db/migrations` 与 `db/roles.sql`）部署到 `/opt/xingya/releases/<ts-version>/api/`。测试不上服务器。
