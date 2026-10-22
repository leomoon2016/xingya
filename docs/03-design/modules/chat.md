# AI 聊天（呀哈哈队长）（chat）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

呀哈哈队长浮动聊天：开关与配额、输入输出过滤、调用 studio 的儿童角色执行器（同步）、只记录元数据。呀哈哈队长是 AI 角色 `yahaha-captain`（第 10 部分，见 [Skill 与 AI 角色 · 模块设计](agents.md#呀哈哈队长同步chat-调用)）。

## 拥有的表

ai_chat_usage

列与约束见 [数据模型 §6.1](../data-model.md#61-表清单72-张)。`ai_chat_usage` 记录 `agent_version_id`（外键到 `agent_versions`，受众必须是 `child`）与 `cost_fen`。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/chat/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`；单元测试在 `apps/api/test/unit/chat/`。
- 依赖：controls（`checkAccess`、配额）、studio（`reserveChildAgentInTx` / `runChildAgent` / `settleChildAgentInTx`）。不再直接调用 LLM 适配器。
- 流程：输入过滤（纯计算，先于事务）→ 事务一（`child_controls` 行锁、配额、幂等、`pending` 记录；输入未命中时预留全站 + 角色预算，命中时直接记 `input_blocked`、不预留）→ 事务外运行角色（最多 3 步、25 秒）→ 事务二（更新记录、结算）。预算不足 → `503 AI_BUDGET_EXHAUSTED`（记录 `error`，不计配额）。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**chat**

```ts
status(principal): {enabled, remainingToday}
chat(principal, {clientRequestId, messages[]}): {reply, filtered, remainingToday}
usageForDay(familyId, childId, date): {messages, filterHits}
purgeOldUsage(now)                                    // 90 天
```

## 端点

见 [API 概要 §5.3](../api.md) 中“chat”一组。

## 需求

见 [AI 聊天（呀哈哈队长） · 需求](../../01-requirements/modules/chat.md)。
