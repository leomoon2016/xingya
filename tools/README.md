# tools —— 仓库工具（只在 CI 与本地运行）

| 目录 | 作用 |
| --- | --- |
| `validate-content/` | 校验 `content/` 下的模板、示例课程（Zod 结构 + 课程自动检查 K 规则）、装扮初始数据、短语、安全词表与提示词禁止词表 |

音频不再在构建期生成：课程发布时由 api 的后台任务以一次性进程运行 Piper（见 `docs/adr/0010-oss-cdn-publish-time-piper.md`）。

**是否上服务器**：否。
