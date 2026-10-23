# 更新日志

本项目的重要变更记录在此。格式参考 Keep a Changelog；版本发布后对应条目移入版本号下。

## 未发布

### 新增
- 2026-10-23：孩子端界面设计起步——新增设计令牌 `docs/04-ui-design/tokens/design-tokens.json`（色板/字体取自原型 D，断点与触控对齐 nfr §8.4）；填写孩子端线框图（shell、login、learn、review、wordbook、shop、companion、social、discovery、album、chat、inbox、footprint、settings），更新 wireframes 索引；家长/后台线框与 mockups 未做。
- 2026-10-21：全新系统设计规格（已由用户逐节确认），数据库结构草案并在临时 MySQL 8.4 上验证（73/73）。
- 2026-10-21：按批准的目录结构建立仓库骨架；规格拆分为 `docs/01-requirements`、`02-solution`、`03-design`、`06-releases/v1.0/scope.md`；新增 ADR 0001–0007；数据库草案拆分为 `db/migrations/0001_init.sql` 与 `db/roles.sql` 并重新验证。
- 2026-10-21：设计变更（用户已批准）——新增伙伴模块（companion）、呀哈哈发现（discovery）、AI 工作室（studio）三个模块与 AI 生成课程，全部进入 v1.0，排期调整为约 19 周；新增 ADR 0008–0013；新增 `docs/03-design/course-model.md`（由 `content-pack.md` 改写）、各新模块的需求与设计文档、Web 端 `companion`/`discovery`/`album`/`admin/studio` 功能目录；新增整体评审报告 `docs/reviews/2026-10-21-整体评审.md`。
- 2026-10-21：第 10 部分“Skill 管理与 AI 角色”（用户已批准，进入 v1.0）——技能数据库版本化（SKILL.md 兼容导入导出、无可执行代码、强制儿童安全与原创规则）、技能库后台、7 个默认 AI 角色（课程设计师、美术设计师、配音师、活动策划、质检员、运营分析师、呀哈哈队长）、角色的技能配置、角色执行器（studio，≤ 20 步）、多角色流水线、一句话框与 `@角色`、任务克隆重跑与快捷任务；新增需求 `docs/01-requirements/modules/agents.md`、设计 `docs/03-design/modules/agents.md`、ADR 0014；新增 `content/skills/`、`content/agents/` 与 Web 端 `admin/studio/{skills,agents,runs}` 目录说明；整体评审追加“第十节补充评审”。
- 2026-10-21：目录调整（用户已批准，[ADR 0015](docs/adr/0015-admin-app-and-seeds.md)）——新增独立后台应用 `apps/admin`（独立 Vite 构建、`admin.<域名>` 子域名、独立 CSP，含 `e2e/`）；新增 `packages/ui`、`packages/skill-format`、`tools/safety-eval`；`apps/api/src/platform/{db,auth,logging,config}`、studio 模块子目录 `jobs/assets/skills/agents/runner/tools/providers`、`apps/api/test/{unit,concurrency,safety}`；`docs/04-ui-design` 的流程、线框、效果图按 `child/`、`parent/`、`admin/` 分组；部署步骤新增 `xingya seeds:apply`；整体评审追加“目录调整评审”。

### 变更
- 2026-10-22：ADR 0020 §8 六点全部已决定（关闭 Q34–Q37；宠物导出记为风险 R20）——伙伴退订 50% / 赠送 / 全站唯一档保留（受赠不可退订）；顶栏“森林口袋 N / 1000”，图鉴页集齐进度；Q33 确认错题数星级、无未通过；伙伴自动经验（含单词星），不做花星星升级；R17 保留家长审批与每家庭奖励清单；15 种宠物从 `MarioCharacters.jsx` 导出 SVG。数据库不变（404/404，指纹 `e8f0e51fe1f6`）。
- 2026-10-22：星级改按错题数（错 0 / 1 / ≥ 2 题 → 3 / 2 / 1 星级），关卡取消 80% 通过线、没有未通过，每次完成都通关（用户决定，取代同日的百分比规则并关闭 Q33）；单词本闯关 / 考试不变。数据库删除 `attempts.passed`，`level_progress.best_stars` 为 1–3；verify 404/404，指纹 `e8f0e51fe1f6`。
- 2026-10-22：回归老系统总规则与 11 项决定（用户决定，[ADR 0020](docs/adr/0020-revert-to-old-system.md)、[0021](docs/adr/0021-nintendo-pets-seed.md)、[0022](docs/adr/0022-llm-vision-image-providers.md)）——未逐项决定的功能一律照旧系统（学习卡、累计奖励、小铺四卡、星级荣誉、秘密路线与隐藏奖励、原型 D、听音选图、一二年级禁拼写与阅读、伙伴改名与亲密度、单元必得呀哈哈、家长扣星、学习足迹、孩子自改昵称、24 种种子宠物）；新星级规则；不迁移旧数据；单词星算学习星；注册码可绑定邮箱、永久只用邀请码；系统管理员锁定 / 改密码 / `admin:reset-totp`；聊天 / 视觉 / 图像模型分别可配置（默认百炼，不用 OCR 服务），邮件默认 DirectMail；上线检查清单（ICP 备案）。数据库 82 张表，verify 402/402；排期约 29.5 周（+8）；安全与隐私冲突 R1–R17 见 ADR 0020。
- 2026-10-22：单词本照旧系统实现并进入 v1.0（用户决定，[ADR 0019](docs/adr/0019-wordbook-as-old-system.md)）——词条、AI 解释（呀哈哈队长技能 `word-explain`）、学习 / 闯关 / 考试、单词星（奖励星）、伙伴附赠、单词本里程碑与随机呀哈哈、考试保护、单词本听发音积分生效（Q30 后续 ① 已决定，新增 Q32）；`0001_init.sql` 新增 5 张表（共 72 张）、2 种星星 kind、`wordbook.random` 设置，藏匿点新增单词本来源；验证 299/299；排期 +1 周（约 21.5 周）。
- 2026-10-22：伙伴最高等级改为 100（用户决定，与旧系统一致）——等级曲线与阶段起始等级（1/20/50/100）照旧系统；`pet_tiers` 默认 `max_level=100`、新增 `xp_quad_div`；复习积分每天 30 的上限保持不变；数据库重新验证 258/258。
- 2026-10-22：恢复积分（用户决定，[ADR 0017](docs/adr/0017-points-currency.md)）——规则与旧系统完全一致：听发音 +0.1、复习答对 +1（每天 ≤ 30）、单词本听发音（每天 ≤ 10，v1.0 无单词本暂不产生）、跟随伙伴按等级附赠，10 积分换 1 星；复习不再发星星；`0001_init.sql` 的 `ledger`/`balances` 增加 `point` 币种，`plays` 增加伙伴等级快照，日报增加积分列；数据库重新验证 255/255。
- 2026-10-22：正式系统一直使用马里奥（用户决定，[ADR 0018](docs/adr/0018-mario-game-partner.md)）——恢复游戏搭档（马里奥、林克），第三方 IP 规则增加具名例外，素材放 `seeds/partners/`，AI 工作室仍不生成任天堂角色；新增术语“积分”“换星”“游戏搭档”。
- 2026-10-22：设备与屏幕（用户决定）——孩子端以平板和电脑横屏为主、手机竖屏可用（紧凑布局）；家长中心响应式；后台桌面优先。新增 [nfr §8.4](docs/01-requirements/nfr.md#84-设备与屏幕)、开放问题 Q29；PRD、界面设计说明、v1.0 变更记录与任务单 03 同步。
- 2026-10-21：课程改为存数据库并版本化（已发布版本不可修改）、共享词库、题目拆为可见部分与答案部分并每次打乱选项；Piper 改为发布时一次性运行；素材改用 OSS + CDN；生成前费用预估与月度预算上限。数据库草案 `0001_init.sql` 直接修订为 55 张表（业务 52 + 平台 3），`roles.sql` 同步更新，在临时 MySQL 8.4.6 上重新验证 155/155 通过。所有文档只使用 Markdown。
- 2026-10-21：目录改名（`git mv`，保留历史）——`content/` → `seeds/`（`templates` → `course-templates`，`english` → `samples/english`）、`packages/content-schema` → `packages/seed-schema`、`tools/validate-content` → `tools/validate-seeds`；`apps/web/src/features/` 下孩子端功能移入 `child/`，`admin/` 移出为 `apps/admin/src/features/`；发布目录改为 `releases/<ts>/{api,web,admin,seeds}`；`xingya skills:seed` 与 `xingya shop:import` 合并为幂等的 `xingya seeds:apply`；ADR 0001、0005 修订；数据库结构不变（只改迁移注释中的路径），重新验证通过。
- ADR 0003 标记为“已被 ADR 0008、0010 取代”；ADR 0004 由 ADR 0011 修订（账本改名 `ledger` 并支持碎片）。

- 2026-10-21：数据库草案 `0001_init.sql` 新增 10 张表（skills、skill_versions、skill_allowed_agents、agents、agent_versions、agent_skills、agent_budget_months、quick_tasks、agent_runs、agent_run_steps），`ai_chat_usage` 增加角色版本与费用，系统设置增加 `agents.*`，共 65 张表（业务 62 + 平台 3）；`roles.sql` 同步授权；验证脚本新增授权全覆盖与 Skill/AI 角色检查，在临时 MySQL 8.4.6 上重新验证 207/207 通过。原 AI 任务处理器改为“AI 角色 + 技能 + 内置工具”（系统任务 `publish_audio`、`material_extract` 保留）；呀哈哈队长聊天费用改为计入预算（修订 Q13）；排期调整为约 20.5 周。

- 2026-10-21：统一术语（以根目录 [GLOSSARY.md](GLOSSARY.md) 为准）——“学习伙伴”改称“伙伴”（模块称“伙伴模块（companion）”），“学习陪伴/当前陪伴”改称“跟随伙伴”；评分统一称“星级”，非学习来源的星星统称“奖励星”；系统管理员发布前检查称“审核”、家长处理孩子申请称“审批”；“学生”改称“孩子”（如“孩子视角试玩”）、单用的“管理员”改称“系统管理员”、单用的“呀哈哈”改为“呀哈哈队长/呀哈哈家族”。只改文字与注释，表名、列名、接口、枚举与数据库结构不变；`docs/README.md`、`AGENTS.md` 加入术语表链接。

- 2026-10-21：保留单元层（用户决定，[ADR 0016](docs/adr/0016-unit-layer.md)，修订 ADR 0008）——内容层级改为年级 > 课程（一册，ID 如 `en-g1-a`）> 单元（`unit_key` 如 `u03`，每单元 3–6 关）> 关卡 > 题目；数据库草案 `0001_init.sql` 新增 `units`（随版本只追加）与 `unit_progress`，`levels` 改为属于单元（复合外键保证同一版本，`level_key` 单元内唯一），`level_progress` 主键加入 `unit_key`，投放规则范围改为 `scope.targets`（课程/单元/关卡，JSON Schema CHECK），`daily_reports.units_completed`，系统设置 `content.unit_levels`；共 67 张表（业务 64 + 平台 3），`roles.sql` 同步授权，验证脚本新增单元检查并修正术语，在临时 MySQL 8.4.6 上重新验证 236/236 通过。需求、设计、API（单元增删排序、按单元生成与预估）、模板与示例课程 README、开放问题 Q26–Q28、里程碑说明同步更新；排期不变。种子数据中 AI 角色描述的术语同步修正。

### 移除
- `tools/build-audio`（构建期生成音频，改为发布时生成）；课程包（`GET /pack`）与内容导入流程。
