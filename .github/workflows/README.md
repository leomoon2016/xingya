# GitHub Actions 工作流（说明，尚未启用）

这里将放 `ci.yml` 与 `deploy.yml`。目前只有说明，没有会运行的工作流。

**ci.yml**（推送与 PR 触发）
1. `check`：lint、typecheck、模块边界检查、单元测试。
2. `content`：课程包校验 → 音频生成（Actions 缓存）→ 组装课程包。
3. `integration`：服务容器 `mysql:8.4`，从空库应用 `db/migrations` + `db/roles.sql` → 授权实测 → 集成测试。
4. `e2e`：构建前端与服务，启动 MySQL、服务、LLM 桩与 SMTP 桩，运行 Playwright。

**deploy.yml**（仅 main，GitHub Environment 保护）
SSH（专用部署密钥、固定 known_hosts）上传发布包到 `/opt/xingya/releases/<ts-version>/` → `xingya migrate` → root 执行 `db/roles.sql` → `xingya content:import` → 同步静态文件 → 切换 `current` → 重启服务 → 30 秒内健康检查，失败自动切回上一个发布。

详见 `docs/02-solution/deployment.md` §9.2。
