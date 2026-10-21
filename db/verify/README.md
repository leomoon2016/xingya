# verify —— 结构验证

`verify.mjs`：在**临时** MySQL 8.4 实例上，按顺序执行 `../migrations/0001_init.sql ../roles.sql`，从空库应用两次比较结构指纹，并实测 CHECK、唯一键、复合外键与授权（应用账号不能改删账本等）。只用 root 本地 socket，会删建 `xingya` 库与 `xingya_*` 账号，**切勿指向生产**。

用法：`MYSQL_SOCKET=<socket> node verify.mjs ../migrations/0001_init.sql ../roles.sql`（需要 mysql2）。`result.txt` 为最近一次结果。

**是否上服务器**：否。
