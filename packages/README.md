# packages —— 共享代码

| 包 | 内容 | 使用方 |
| --- | --- | --- |
| `contracts/` | API 请求/响应 Zod 模式、错误码、共享类型 | api、web |
| `rules/` | 规则常量与纯函数：星级阈值、发星规则、复习间隔、时长计算、连续天数 | api、web（展示）、单元测试 |
| `content-schema/` | 课程包 JSON 的 Zod 模式 | tools、api（导入器与内容加载） |

**是否上服务器**：否。不单独部署；在构建时被编译进 api 与 web 的产物。
