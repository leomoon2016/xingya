# 学习（learning）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

关卡路线与解锁、整批提交闯关与判分、最佳成绩、错题与词的间隔复习、连续学习天数。

## 拥有的表

level_progress, attempts, review_items, review_sessions

列与约束见 [数据模型 [§6.1](../data-model.md)](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/learning/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`、`*.test.ts`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**learning**

```ts
getCourseMap(child, courseId): LevelState[]           // locked | open | passed(stars)
getLevelForPlay(child, levelId): PlayableLevel        // 检查开放、解锁、时长
submitAttempt(child, cmd: {levelId, clientStartedAt?, answers[]}): AttemptResult
getReviewSummary(child): {dueToday, doneToday, remainingToday, completedToday}
getReviewBatch(child): ReviewQuestion[]               // ≤ 20 - doneToday
submitReview(child, cmd: {items[]}): ReviewResult
getStreak(child): {current, longest, todayCounts}
statsForDay(familyId, childId, date): LearningDayStats  // 供 reports 聚合
```

## 时序

```mermaid
sequenceDiagram
  autonumber
  participant C as 孩子端
  participant API as Fastify 路由
  participant CT as controls
  participant L as learning
  participant CO as content（内存）
  participant S as stars
  participant DB as MySQL
  C->>API: POST /api/v1/attempts（X-Client-Request-Id: R，levelId，answers[]）
  API->>API: 鉴权（孩子会话）+ Zod 校验
  API->>CT: checkAccess(child, 'submit')（含 10 分钟宽限）
  API->>DB: BEGIN
  API->>DB: INSERT idempotency_requests(child, R, 202 占位)
  alt 唯一键冲突（R 已处理过）
    DB-->>API: ER_DUP_ENTRY（等待前一事务提交后返回）
    API->>DB: ROLLBACK；读取已存响应
    API-->>C: 原样返回第一次的结果（请求体哈希不同 → 409 IDEMPOTENCY_KEY_REUSED）
  else 首次
    API->>L: submitAttemptInTx(tx, child, cmd)
    L->>CT: isCourseOpen；L 检查解锁
    L->>CO: getLevel → 校验题目集合 → gradeResponse 逐题判分
    L->>DB: SELECT level_progress … FOR UPDATE
    L->>DB: INSERT attempts（生成列复核星级）
    L->>DB: UPSERT level_progress（最佳星级、首次通过时间）
    L->>DB: 首次通过：该关词 → review_items（盒 1，明天到期，已存在则不变）
    L->>DB: 答错的计分题 → review_items（新建或重置为盒 1，明天到期）
    opt awarded > 0
      L->>S: creditInTx(level_pass, awarded, sourceKey = attempt:{id})
      S->>DB: SELECT star_balances … FOR UPDATE；INSERT star_ledger；UPDATE star_balances
    end
    L->>L: 连续天数检查；达到 3/7/30 天 → S.creditInTx(streak)
    API->>DB: UPDATE idempotency_requests 写入最终响应（200）
    API->>DB: COMMIT
    API-->>C: {accuracy, stars, passed, awarded, nextLevelUnlocked, streak, balance}
  end
```

## 端点

见 [API 概要 [§5.3](../api.md)](../api.md) 中“content / learning”一组。

## 需求

见 [学习 · 需求](../../01-requirements/modules/learning.md)。
