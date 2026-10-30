# verify —— 结构验证

`verify.mjs`：在**临时** PostgreSQL 16 实例上，按顺序执行 `../migrations/0001_init.sql ../roles.sql`，从空库应用两次比较结构指纹，并实测关键 CHECK、唯一槽位、`FOR UPDATE SKIP LOCKED` 与授权。只用超级用户本机连接，会删建 `xingya` 库与 `xingya_*` 角色，**切勿指向生产**。

## 环境变量

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `PGHOST` | 主机或 Unix socket 目录 | `/tmp/pg16/sock` 或 `127.0.0.1` |
| `PGPORT` | 端口 | `55432` |
| `PGUSER` | 超级用户 | `postgres` |
| `PGPASSWORD` | 口令（socket trust 时可省略） | |
| `PGDATABASE` | 维护库（用于 CREATE DATABASE） | `postgres` |

## 用法

```bash
pnpm add -D pg   # 或 npm i pg
PGHOST=/path/to/sockdir PGPORT=5432 PGUSER=postgres \
  node verify.mjs ../migrations/0001_init.sql ../roles.sql
```

`result.txt` 为最近一次结果。

**是否上服务器**：否。
