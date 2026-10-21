# 报告通知（reports）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

每晚汇总每日报告、家长报告查询、周报邮件、邮件发件箱与退订。

## 拥有的表

daily_reports, email_outbox

列与约束见 [数据模型 §6.1](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/reports/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`、`*.test.ts`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**reports**

```ts
getDailyReports(p, childId, from, to) / getTodayLive(p, childId) / getWeekly(p, childId, isoWeek)
runNightlyAggregation(now)                             // 每 15 分钟调度，按家庭时区处理“昨天”
                                                       // 读取 learning/stars/discovery/chat/controls 的 statsForDay（含碎片收入、找到的呀哈哈）
enqueueWeeklyReports(now)                              // 每 5 分钟调度，周日 20:00 后入队
enqueueEmail(tx | db, {kind, dedupeKey, to, subject, html, text, familyId?, parentId?})
sendDueEmails(now)                                     // 每 30 秒
unsubscribe(signedToken)
```

## 端点

见 [API 概要 §5.3](../api.md) 中“reports”一组。

## 需求

见 [报告通知 · 需求](../../01-requirements/modules/reports.md)。
