# 更新日志

本项目的重要变更记录在此。格式参考 Keep a Changelog；版本发布后对应条目移入版本号下。

## 未发布

### 新增
- 2026-10-21：全新系统设计规格（已由用户逐节确认），数据库结构草案并在临时 MySQL 8.4 上验证（73/73）。
- 2026-10-21：按批准的目录结构建立仓库骨架；规格拆分为 `docs/01-requirements`、`02-solution`、`03-design`、`06-releases/v1.0/scope.md`；新增 ADR 0001–0007；数据库草案拆分为 `db/migrations/0001_init.sql` 与 `db/roles.sql` 并重新验证。
- 2026-10-21：设计变更（用户已批准）——新增学习伙伴（companion）、呀哈哈发现（discovery）、AI 工作室（studio）三个模块与 AI 生成课程，全部进入 v1.0，排期调整为约 19 周；新增 ADR 0008–0013；新增 `docs/03-design/course-model.md`（由 `content-pack.md` 改写）、各新模块的需求与设计文档、Web 端 `companion`/`discovery`/`album`/`admin/studio` 功能目录；新增整体评审报告 `docs/reviews/2026-10-21-整体评审.md`。

### 变更
- 2026-10-21：课程改为存数据库并版本化（已发布版本不可修改）、共享词库、题目拆为可见部分与答案部分并每次打乱选项；Piper 改为发布时一次性运行；素材改用 OSS + CDN；生成前费用预估与月度预算上限。数据库草案 `0001_init.sql` 直接修订为 55 张表（业务 52 + 平台 3），`roles.sql` 同步更新，在临时 MySQL 8.4.6 上重新验证 155/155 通过。所有文档只使用 Markdown。
- ADR 0003 标记为“已被 ADR 0008、0010 取代”；ADR 0004 由 ADR 0011 修订（账本改名 `ledger` 并支持碎片）。

### 移除
- `tools/build-audio`（构建期生成音频，改为发布时生成）；课程包（`GET /pack`）与内容导入流程。
