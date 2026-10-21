# 08: 首次部署

**What to build:** 把一个发布包部署到已初始化的服务器上并跑起来：上传到 `/opt/xingya/releases/<ts-version>/`（`api/`、`web/`、`admin/`、`seeds/` 四个子目录）→ `xingya migrate` → root 执行 `db/roles.sql` → `xingya seeds:apply` → 切换 `/opt/xingya/current` → 重启服务 → 30 秒内 `/api/v1/health` 返回新版本，否则自动切回上一个发布并重启、部署失败。首次部署完成后，运维通过 SSH 端口转发在本机浏览器打开孩子端页面并看到健康检查结果。

**备案说明：** 域名与 ICP 备案（主域名与 CDN 子域名）尚未完成，这是项目负责人本人的步骤；在此之前不能用域名在大陆服务器上对外提供服务，本单的验收一律通过 SSH 端口转发完成。仓库没有远程，部署从本机执行发布脚本；CI 的第五阶段 `deploy`（仅 main、GitHub Environment 保护、专用部署密钥、固定 known_hosts）在本单中写好，等有远程后生效。

依据：[deployment §9.2](../../../docs/02-solution/deployment.md)、[overview“服务器目录布局”](../../../docs/02-solution/overview.md)、[deploy/scripts/README](../../../deploy/scripts/README.md)、[roadmap W1–2 与 R1](../../../docs/02-solution/roadmap.md)、[整体评审](../../../docs/reviews/2026-10-21-整体评审.md) §6 建议 5。

**人工步骤说明：** agent 可以编写发布包构建、`deploy.sh`/`rollback.sh`、CI `deploy` 阶段与运维说明，并在一次性环境中验证；对真实 ECS 执行首次部署、经 SSH 端口转发验收、ICP 备案与证书由项目负责人本人完成。

**Blocked by:** [02 平台层和初始迁移](02-platform-layer.md)、[04 种子数据导入](04-seeds-apply.md)、[05 CI 五个阶段](05-ci-pipeline.md)、[06 服务器初始化](06-server-bootstrap.md)

**Status:** ready-for-human

- [ ] 构建发布包：目录名为“时间戳 + 提交短哈希”（如 `20261021-2056-6b463ed`），含 `api/`（连同 `db/migrations` 与 `db/roles.sql`）、`web/`、`admin/`、`seeds/`；不含测试、设计稿、`db/dev-fixtures`、`db/verify` 与 `tools/`。
- [ ] `deploy.sh` 按上述顺序执行；任一步失败即停止且不切换 `current`。
- [ ] 健康检查失败时自动切回上一个发布并重启；有在一次性环境中的测试（故意部署一个健康检查失败的包）证明回滚生效。
- [ ] `rollback.sh` 可手动把 `current` 切回上一个发布并重启；只回代码不回库。
- [ ] 服务器上只保留最近 3 个发布目录。
- [ ] 部署前在临时 MySQL 上再跑一次 `db/verify` 并通过。
- [ ] 首次部署后：`/api/v1/health` 返回本次版本；经 SSH 端口转发在本机打开孩子端可看到健康结果，打开后台外壳可加载页面。
- [ ] CI `deploy` 阶段已写入工作流：只在 main 触发、受 GitHub Environment 保护、使用专用部署密钥与固定 known_hosts；密钥只以 Environment 机密名引用。
- [ ] 部署脚本与发布包中不含任何密钥；服务从 `/etc/xingya/secrets.env` 读取配置。
- [ ] 运维说明写明：首次部署之后需要运行 `xingya admin:create` 创建系统管理员（命令本身见 16），以及备案完成后切换到正式域名与证书的步骤。
