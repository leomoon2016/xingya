# packages —— 共享代码

| 包 | 内容 | 使用方 |
| --- | --- | --- |
| `contracts/` | API 请求/响应 Zod 模式、错误码、共享类型 | api、web、admin |
| `rules/` | 规则常量与纯函数：星级阈值、发星与碎片规则、复习间隔、时长计算、连续天数、伙伴等级曲线、发现概率与上限合并 | api、web（展示）、单元测试 |
| `ui/` | 主题（由 `docs/04-ui-design/tokens/design-tokens.json` 生成）与基础组件（按钮、表单控件、对话框、排版） | web、admin |
| `seed-schema/` | 内置数据的模式：课程文档、课程模板、学习卡与 10 种题型（可见部分与答案部分）的 Zod 模式与自动检查 K 规则；探险徽章、种子宠物、短语、头像、默认角色挂载清单的模式 | api（草稿编辑、发布、导入、`seeds:apply`）、admin（课程表单）、tools |
| `skill-format/` | SKILL.md 文件夹格式：解析、字段映射、导入包限制与校验（路径、大小、未知工具名、脚本识别为惰性文本）、导出 | api（技能导入导出）、admin（上传前预检）、tools（校验 `seeds/skills/`） |

**是否上服务器**：否。不单独部署；在构建时被编译进 api、web、admin 的产物。
