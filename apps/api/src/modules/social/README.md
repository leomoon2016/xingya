# social —— 社交

**职责**：周排行榜、赠送星星、消息、好友家庭、举报与屏蔽。

**拥有的表**：family_friendships, gifts, messages, blocks, abuse_reports。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/social.md`；设计：`docs/03-design/modules/social.md`。
