# GitHub Actions 工作流（说明，尚未启用）

这里将放 `ci.yml` 与 `deploy.yml`。目前只有说明，没有会运行的工作流。

**ci.yml**（推送与 PR 触发）
1. `check`：lint、typecheck、模块边界检查、单元测试。
2. `seeds`：`tools/validate-seeds` 校验 `seeds/`（模板、示例课程 K 规则、装扮、短语、头像、安全词表、默认技能与角色挂载）；`tools/safety-eval` 在儿童技能或安全测试集变化时运行（不生成音频、不组装课程包）。
3. `integration`：服务容器 `mysql:8.4`，从空库应用 `db/migrations` + `db/roles.sql` → 授权实测 → 集成测试（OSS 用本地目录实现、AI 提供方与 Piper 用桩）。
4. `e2e`：构建 web、admin 与服务，启动 MySQL、服务、LLM/图像/OCR 桩、Piper 桩与 SMTP 桩，运行 `apps/web/e2e` 与 `apps/admin/e2e`；并检查 web 构建产物中没有后台代码。

**deploy.yml**（仅 main，GitHub Environment 保护）
SSH（专用部署密钥、固定 known_hosts）上传发布包到 `/opt/xingya/releases/<ts-version>/` → `xingya migrate` → root 执行 `db/roles.sql` → `xingya seeds:apply`（只插入缺失的内置数据）→ 发布目录含 `api/`、`web/`、`admin/`、`seeds/` → 切换 `current` → 重启服务 → 30 秒内健康检查，失败自动切回上一个发布。部署不导入任何课程（示例课程只手动导入）；课程在后台发布。

详见 `docs/02-solution/deployment.md` §9.2。
