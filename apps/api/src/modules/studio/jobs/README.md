# jobs —— 任务队列与执行器

`ai_jobs` 的入队、抢占槽位（全站 2 个、本机进程 1 个）、心跳、中断回收与重试、取消；系统任务 `publish_audio`、`material_extract` 的处理器注册表（`registerHandler`）。拥有的表：ai_jobs、ai_budget_months（预算预留与结算的事务也在这里）。设计：`docs/03-design/modules/studio.md` 执行器一节。

**是否上服务器**：是（编译进 api）。
