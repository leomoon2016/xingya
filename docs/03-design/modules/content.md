# 课程内容（content）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

在内存中只读提供当前课程包：年级、课程、关卡、词、题目、商店物品、头像、预设短语/表情、安全词表；题型判分器。

## 拥有的表

courses, levels, words, questions, shop_items（应用只读）+ 内存中的 avatars/phrases/emoji/安全词表

列与约束见 [数据模型 [§6.1](../data-model.md)](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/content/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`、`*.test.ts`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**content**（启动时把当前课程包载入内存，只读）

```ts
packVersion(): string
listCourses(filter: {subject?, grade?}): Course[]
getCourse(courseId) / getLevel(levelId): LevelWithQuestions / getQuestion(id) / getWord(id)
levelWords(levelId): WordId[]                        // 该关计分题与跟读题涉及的全部词
nextLevel(levelId): LevelId | null / previousLevel(levelId): LevelId | null   // 跳过已退役关卡
pickDistractors(wordId, n): WordId[]                 // 同课程优先，确定性随机（种子 = 复习条目 ID）
gradeResponse(question, response): boolean           // 题型判分器注册表
listShopItems() / getShopItem(id)
avatars() / phrases() / emojis() / safetyLists()
```

## 端点

见 [API 概要 [§5.3](../api.md)](../api.md) 中“content / learning”一组。

## 需求

见 [课程内容 · 需求](../../01-requirements/modules/content.md)。
