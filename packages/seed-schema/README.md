# seed-schema（原 content-schema）

内置数据（`seeds/`）与课程文档的模式：课程文档（单元、知识清单、关卡、题目）、课程模板、学习卡与 10 种题型的 Zod 模式（每种题型分“孩子可见部分”与“答案部分”）与课程自动检查规则 K1–K13 的实现；以及探险徽章初始数据、种子宠物清单（`seeds/pets/pets.json`）、短语与表情、头像清单、默认角色挂载清单（`seeds/agents/defaults.json`）的模式。供 api、后台表单与 `tools/validate-seeds` 共用。格式见 `docs/03-design/course-model.md`。技能包格式不在这里，见 `packages/skill-format`。

**是否上服务器**：否（编译进 api 与 admin）。
