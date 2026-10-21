# 家长管控（controls）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

每日时长与可用时段、心跳计时与服务端强制、加时、课程开放规则、审批收件箱。

## 拥有的表

child_controls, course_overrides, usage_days

列与约束见 [数据模型 §6.1](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/controls/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`、`*.test.ts`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**controls**

```ts
getControls(p, childId) / updateControls(p, childId, patch & {version})
setCourseOverride(p, childId, courseId, mode | null, version)
isCourseOpen(child, courseId): boolean / listOpenCourses(child): CourseId[]
heartbeat(child): TimeStatus                           // 计时 + 返回是否锁定
checkAccess(child, activity: 'start' | 'submit' | 'chat'): void   // 超限抛 TIME_LIMIT_REACHED / OUTSIDE_ALLOWED_HOURS
grantExtraTime(p, childId): TimeStatus                 // +15 分钟
getApprovalsInbox(p): {redemptions, friendRequests}   // 汇总 stars 与 social
usageForDay(familyId, childId, date): {seconds}
```

## 端点

见 [API 概要 §5.3](../api.md) 中“controls”一组。

## 需求

见 [家长管控 · 需求](../../01-requirements/modules/controls.md)。
