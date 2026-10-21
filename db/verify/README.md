# verify —— 结构验证

`verify.mjs`：在**临时** MySQL 8.4 实例上，按顺序执行 `../migrations/0001_init.sql ../roles.sql`，从空库应用两次比较结构指纹，并实测 CHECK、唯一键、复合外键与授权：账本（星星与碎片）只追加、已发布课程版本不可修改、题目可见部分不含答案、藏匿点只能揭晓一次、每日放置上限、投放规则边界、任务并发槽位、月度预算等。只用 root 本地 socket，会删建 `xingya` 库与 `xingya_*` 账号，**切勿指向生产**。

用法：`MYSQL_SOCKET=<socket> node verify.mjs ../migrations/0001_init.sql ../roles.sql`（需要 mysql2）。`result.txt` 为最近一次结果。

**是否上服务器**：否。
