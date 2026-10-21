# validate-content

校验 `content/`：模板结构（`content/templates/`）、示例课程（与后台发布使用同一套自动检查 K1–K12，见 `docs/03-design/course-model.md` §7.4）、装扮初始数据（`artSource` 必须原创或已授权）、短语、聊天词表与提示词禁止词表（无重复、正则可编译）。任何错误使 CI 失败。

**是否上服务器**：否。
