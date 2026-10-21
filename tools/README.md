# tools —— 内容工具（只在 CI 与本地运行）

| 目录 | 作用 |
| --- | --- |
| `validate-content/` | 课程包 Zod 结构校验 + 规则 C1–C13，校验通过后组装课程包（图片压缩、哈希命名、manifest、ids.lock） |
| `build-audio/` | 用 Piper 离线合成标准音（按内容哈希缓存，ffmpeg 编码 MP3），支持真人录音覆盖 |

**是否上服务器**：否。工具本身不部署；它们生成的课程包与音频会部署（见 `content/README.md`）。
