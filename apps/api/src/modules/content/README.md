# content —— 课程内容

**职责**：共享词库（词、义项）、课程与不可变版本、草稿生命周期（表单编辑、自动检查、审核、发布）、题型判分器、课程模板注册（读取仓库 `seeds/course-templates/`）、示例课程导入命令；内存中的头像/短语/表情/安全词表。

**拥有的表**：words, word_senses, courses, course_versions, course_drafts, levels, questions, question_answers。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）；单元测试在 `apps/api/test/unit/content/`。

需求：`docs/01-requirements/modules/content.md`；设计：`docs/03-design/modules/content.md`。
