# content —— 仓库中保留的内容（模板与示例）

2026-10-21 起课程存放在数据库并版本化（见 `docs/03-design/course-model.md`、ADR 0008）。这里只保留随代码一起版本化的定义与少量示例：

- `templates/`：课程模板定义（关卡顺序、题型组合、每关题数、适用年级），随 api 打包。
- `english/grade-1/`：少量示例课程，用 `xingya course:import` 导入为**草稿**，再走审核与发布。
- `shop/`：商店装扮的初始数据（首次部署时导入，之后在后台维护）。
- `phrases/`：跨家庭预设短语与表情白名单，随 api 打包。
- `safety/`：聊天过滤分类词表与规则、AI 提示词禁止词表，随 api 打包。
- `avatars/`：孩子可选的原创头像清单，随 api 打包（图片在 OSS/CDN）。

全部由 `tools/validate-content` 在 CI 中校验。

**是否上服务器**：间接。没有课程包、部署时不导入内容；`templates/`、`phrases/`、`safety/`、`avatars/` 编译进 api 产物；示例课程与装扮初始数据只在需要时由运维命令导入。图片与音频素材在阿里云 OSS，经 CDN 提供。
