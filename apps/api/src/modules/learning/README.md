# learning —— 学习

**职责**：关卡路线与解锁、整批提交闯关与判分、最佳成绩、间隔复习、连续学习天数。

**拥有的表**：level_progress, attempts, review_items, review_sessions。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/learning.md`；设计：`docs/03-design/modules/learning.md`。
