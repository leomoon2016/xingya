# tools —— 内置工具目录

`registerTool` 注册表与 studio 自己的通用工具（`image.generate`、`tts.synthesize`、`assets.search`、`assets.read`、`jobs.summary`、`qa.write_report`）；启动时断言没有发布类工具、受众与效果合法。业务工具由各业务模块注册（依赖倒置），实现留在各自模块。

**是否上服务器**：是（编译进 api）。
