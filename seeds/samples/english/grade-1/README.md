# grade-1 —— 一年级英语示例课程

每门课程（一册）一个文件 `<courseId>.json`，如 `en-g1-a.json`（一年级上册）、`en-g1-b.json`（一年级下册）。文件内 `units[]` 按顺序列出单元（`unitKey` 如 `u01`、`u02`，每单元 3–6 关，`levelKey` 在单元内唯一），结构见 `docs/03-design/course-model.md` §7.3；示例 `en-g1-a.json` 含 2 个单元、每单元 3 关。使用 `seeds/course-templates/` 中的模板。1–2 年级课程不得含拼写题（自动检查规则 K5）。

导入：`xingya course:import seeds/samples/english/grade-1/en-g1-a.json`（生成整门课程的草稿）。
