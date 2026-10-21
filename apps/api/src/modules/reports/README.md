# reports —— 报告通知

**职责**：每晚汇总每日报告、家长报告、周报邮件、邮件发件箱与退订。

**拥有的表**：daily_reports, email_outbox。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/reports.md`；设计：`docs/03-design/modules/reports.md`。
