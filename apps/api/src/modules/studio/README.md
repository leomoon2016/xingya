# studio —— AI 工作室

**职责**：任务队列（MySQL，最多 2 个并发、本机进程最多 1 个）、提供方适配器（图像、TTS、LLM、OCR）、素材库（OSS/CDN）、资料库、费用预估与月度预算、提示词禁止词表。只依赖 platform；业务模块向它注册任务处理器。

**拥有的表**：ai_jobs, ai_budget_months, assets, materials。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/studio.md`；设计：`docs/03-design/modules/studio.md`。
