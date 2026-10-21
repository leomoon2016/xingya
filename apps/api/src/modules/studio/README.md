# studio —— AI 工作室

**职责**：任务队列（MySQL，最多 2 个并发、本机进程最多 1 个）、提供方适配器（图像、TTS、LLM、OCR）、素材库（OSS/CDN）、资料库、费用预估与月度预算、提示词禁止词表；**技能库与 AI 角色**（技能与版本、SKILL.md 导入导出、角色与版本、技能挂载、工具目录、角色执行器〔工具循环 ≤ 20 步〕、流水线、快捷任务、角色预算、呀哈哈队长的同步执行）。只依赖 platform；业务模块向它注册内置工具（`registerTool`，没有发布类工具），系统任务 `publish_audio`、`material_extract` 用 `registerHandler`。

**拥有的表**（14 张）：ai_jobs, ai_budget_months, assets, materials；skills, skill_versions, skill_allowed_agents, agents, agent_versions, agent_skills, agent_budget_months, quick_tasks, agent_runs, agent_run_steps。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）；子目录 `jobs/`、`assets/`、`skills/`、`agents/`、`runner/`、`tools/`、`providers/`（各有 README，仍属同一模块、只有一个 `index.ts`）；单元测试在 `apps/api/test/unit/studio/`。

需求：`docs/01-requirements/modules/studio.md`；`docs/01-requirements/modules/agents.md`；设计：`docs/03-design/modules/studio.md`、`docs/03-design/modules/agents.md`；决策：ADR 0009、0014。
