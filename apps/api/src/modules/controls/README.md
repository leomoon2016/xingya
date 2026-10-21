# controls —— 家长管控

**职责**：每日时长与可用时段、心跳计时与服务端强制、加时、课程开放规则、审批收件箱。

**拥有的表**：child_controls, course_overrides, usage_days。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/controls.md`；设计：`docs/03-design/modules/controls.md`。
