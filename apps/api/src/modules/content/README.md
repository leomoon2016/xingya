# content —— 课程内容

**职责**：在内存中只读提供当前课程包（年级、课程、关卡、词、题目、商店物品等）与题型判分器。

**拥有的表**：courses, levels, words, questions, shop_items（应用只读）+ 内存中的 avatars/phrases/emoji/安全词表。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/content.md`；设计：`docs/03-design/modules/content.md`。
