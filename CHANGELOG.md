# 更新日志

本项目的重要变更记录在此。格式参考 Keep a Changelog；版本发布后对应条目移入版本号下。

## 未发布

### 新增
- 2026-10-21：全新系统设计规格（已由用户逐节确认），数据库结构草案并在临时 MySQL 8.4 上验证（73/73）。
- 2026-10-21：按批准的目录结构建立仓库骨架；规格拆分为 `docs/01-requirements`、`02-solution`、`03-design`、`06-releases/v1.0/scope.md`；新增 ADR 0001–0007；数据库草案拆分为 `db/migrations/0001_init.sql` 与 `db/roles.sql` 并重新验证。
- 2026-10-21：设计变更（用户已批准）——新增学习伙伴（companion）、呀哈哈发现（discovery）、AI 工作室（studio）三个模块与 AI 生成课程，全部进入 v1.0，排期调整为约 19 周；新增 ADR 0008–0013；新增 `docs/03-design/course-model.md`（由 `content-pack.md` 改写）、各新模块的需求与设计文档、Web 端 `companion`/`discovery`/`album`/`admin/studio` 功能目录；新增整体评审报告 `docs/reviews/2026-10-21-整体评审.md`。
- 2026-10-21：第 10 部分“Skill 管理与 AI 角色”（用户已批准，进入 v1.0）——技能数据库版本化（SKILL.md 兼容导入导出、无可执行代码、强制儿童安全与原创规则）、技能库后台、7 个默认 AI 角色（课程设计师、美术设计师、配音师、活动策划、质检员、运营分析师、呀哈哈队长）、角色的技能配置、角色执行器（studio，≤ 20 步）、多角色流水线、一句话框与 `@角色`、任务克隆重跑与快捷任务；新增需求 `docs/01-requirements/modules/agents.md`、设计 `docs/03-design/modules/agents.md`、ADR 0014；新增 `content/skills/`、`content/agents/` 与 Web 端 `admin/studio/{skills,agents,runs}` 目录说明；整体评审追加“第十节补充评审”。

### 变更
- 2026-10-21：课程改为存数据库并版本化（已发布版本不可修改）、共享词库、题目拆为可见部分与答案部分并每次打乱选项；Piper 改为发布时一次性运行；素材改用 OSS + CDN；生成前费用预估与月度预算上限。数据库草案 `0001_init.sql` 直接修订为 55 张表（业务 52 + 平台 3），`roles.sql` 同步更新，在临时 MySQL 8.4.6 上重新验证 155/155 通过。所有文档只使用 Markdown。
- ADR 0003 标记为“已被 ADR 0008、0010 取代”；ADR 0004 由 ADR 0011 修订（账本改名 `ledger` 并支持碎片）。

- 2026-10-21：数据库草案 `0001_init.sql` 新增 10 张表（skills、skill_versions、skill_allowed_agents、agents、agent_versions、agent_skills、agent_budget_months、quick_tasks、agent_runs、agent_run_steps），`ai_chat_usage` 增加角色版本与费用，系统设置增加 `agents.*`，共 65 张表（业务 62 + 平台 3）；`roles.sql` 同步授权；验证脚本新增授权全覆盖与 Skill/AI 角色检查，在临时 MySQL 8.4.6 上重新验证 207/207 通过。原 AI 任务处理器改为“AI 角色 + 技能 + 内置工具”（系统任务 `publish_audio`、`material_extract` 保留）；呀哈哈队长聊天费用改为计入预算（修订 Q13）；排期调整为约 20.5 周。

### 移除
- `tools/build-audio`（构建期生成音频，改为发布时生成）；课程包（`GET /pack`）与内容导入流程。
