# config —— 配置与基础设施

读取 `/etc/xingya/secrets.env` 与环境变量并用 Zod 校验；系统设置缓存（10 秒）；可注入的 Clock；进程内调度器（`GET_LOCK` 防重叠）；OSS 客户端（签名 URL、`pub/` 复制）；内置数据目录 `seeds/` 的位置（发布目录中的 `seeds/`）。
