# course-templates —— 课程模板

每个模板一个文件 `<templateId>.json`（带 `templateVersion`），描述**一个单元**的结构（[ADR 0016](../../docs/adr/0016-unit-layer.md)）：

- `levelsPerUnit`：每个单元的关卡数范围，必须落在系统设置 `content.unit_levels`（默认 3–6，**已默认，可调整**，开放问题 Q26）之内；
- `unitPlan`：单元内关卡的顺序与每关允许的题型与数量（`count` 可为范围，一个元素可生成一关或多关）；
- `questionsPerLevel`（5–8，计分题 ≥ 4）、适用年级 `grades`、生成提示词片段 `promptHints`。

一门课程（一册，如一年级上册 `en-g1-a`）选一个模板，所有单元按同一结构生成（开放问题 Q27）；单元数不由模板规定，每门课至少 1 个单元。AI 工作室可以一次生成整门课程，也可以只生成一个单元加入现有草稿，费用按单元预估。

首发 4 个：`word-quest`（单词闯关课）、`sentence-dialogue`（句型对话课）、`picture-book`（绘本阅读课）、`phonics`（自然拼读课）。api 启动时读取，不入库。结构与规则（含自动检查 K13）见 `docs/03-design/course-model.md` §7.2。
