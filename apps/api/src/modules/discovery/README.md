# discovery —— 呀哈哈发现

**职责**：通关后的藏匿点（服务端决定内容）、单元首次全 3 星级必得、收藏上限、揭晓校验、图鉴、呀哈哈家族款式与套组、全局设置、投放规则（表单或 AI 填写）与审计、统计。

**拥有的表**：yahaha_sets, yahaha_styles, drop_rules, hiding_spots, yahaha_finds。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）；单元测试在 `apps/api/test/unit/discovery/`。

需求：`docs/01-requirements/modules/discovery.md`；设计：`docs/03-design/modules/discovery.md`。
