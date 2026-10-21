# AI 聊天（呀哈哈队长）（chat）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

呀哈哈队长浮动聊天：开关与配额、输入输出过滤、调用外部 LLM、只记录元数据。

## 拥有的表

ai_chat_usage

列与约束见 [数据模型 §6.1](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/chat/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`、`*.test.ts`。

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
