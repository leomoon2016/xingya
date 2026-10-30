# ADR 0024：AI 工作室使用 PostgreSQL 任务队列与月度预算

- 状态：已接受（承接 ADR 0014：AI 流程仍为「角色 + 技能」在同一队列上运行）
- 日期：2026-10-30
- 取代：[ADR 0009](0009-studio-mysql-job-queue.md)
- 依据：[PostgreSQL 重新设计规格](../superpowers/specs/2026-10-30-postgresql-redesign.md)

## 背景

伙伴形象、呀哈哈家族款式、规则解析、课程生成需要外部 AI 或本机进程（Piper、资料解析）。2 GB 内存不宜引入 Redis。原方案用 MySQL 任务表 + `running_slot` 唯一 + 生成列 `local_slot`，调度互斥用 `GET_LOCK`。

## 决策

- 仍用表 `ai_jobs` 作队列；执行器在 API 进程内约每 2 秒轮询。
- **抢占**：`SELECT … WHERE status='queued' ORDER BY queued_at FOR UPDATE SKIP LOCKED LIMIT 1`，同一事务写入 `status='running'`、`running_slot`、`started_at`。
- **并发兜底不变**：`running_slot` 取值 1/2 且唯一 → 全站最多 2 个 running；生成列 `local_slot` 唯一 → `needs_local` 的 running 最多 1 个。
- **调度互斥**：`pg_try_advisory_lock(hashtext('xingya:job:'||name))` 取代 `GET_LOCK`。
- 生成前预估费用、管理员确认、`ai_budget_months` 同事务预留；CHECK「预留 + 已花费 ≤ 上限」；实际 ≤ 预估。
- 产物先草稿、管理员审核后可见；提示词服务器模板拼装。

## 后果

无新中间件；预算与并发仍由数据库约束兜底；吞吐量适合单个系统管理员。

## 未采用的方案

Redis/BullMQ；去掉槽位唯一仅靠应用计数；继续使用 MySQL `GET_LOCK`。
