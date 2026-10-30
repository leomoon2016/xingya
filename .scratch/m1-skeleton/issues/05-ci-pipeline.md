# 05: CI 五个阶段

**What to build:** 每次提交都会跑完整检查：`check`（lint、typecheck、模块边界检查、单元测试）→ `seeds`（`tools/validate-seeds`；儿童技能或安全测试集变化时另跑 `tools/safety-eval`）→ `integration`（PostgreSQL 16 服务容器，从空库应用全部迁移与 `db/roles.sql` → 授权实测 → 集成测试）→ `e2e`（构建 web、admin 与服务，启动各类本地桩，运行 `apps/web/e2e` 与 `apps/admin/e2e`，并检查**孩子端产物不含后台代码**）→ `deploy`（仅 main）。任何一步失败，后续阶段不执行、提交被标红。

本仓库目前只在本地、没有远程，GitHub Actions 不会真正运行。因此本单同时提供一个本地命令，按与工作流相同的顺序运行前四个阶段，开发者在提交前执行；工作流文件写好并通过语法检查，等将来有远程时直接生效。第五阶段 `deploy` 需要发布脚本，在 [08 首次部署](08-first-deploy.md) 中接入。

依据：[deployment §9.2](../../../docs/02-solution/deployment.md)、[.github/workflows/README](../../../.github/workflows/README.md)、[nfr §8.1](../../../docs/01-requirements/nfr.md)（依赖审计、孩子端产物不含后台代码）、[整体评审](../../../docs/reviews/2026-10-21-整体评审.md)“目录调整评审”D.1。

**Blocked by:** [01 仓库骨架打通](01-repo-skeleton.md)

**Status:** ready-for-agent

- [ ] `ci.yml` 定义 `check`、`seeds`、`integration`、`e2e` 四个阶段，按此顺序依赖；推送与 PR 触发；通过工作流语法检查。
- [ ] 一个本地命令按相同顺序运行这四个阶段，任一失败即停止并以非零退出；`integration` 阶段在本地使用临时 PostgreSQL 16（与 CI 服务容器同版本）。
- [ ] 各阶段调用工作区中的统一命令（lint、typecheck、边界检查、单元测试、seeds 校验、集成测试、e2e）；尚未实现的部分（如 02、04 交付前）以空集合通过，由对应任务单接入，不在 CI 中重复实现。
- [ ] “孩子端产物不含后台代码”检查：扫描 web 构建产物中的后台路由名、后台组件名与 `/api/v1/admin` 字符串，命中即失败；有一个反例测试证明往孩子端引入后台字符串时检查会失败。
- [ ] e2e 阶段启动的外部依赖全部是本地桩（LLM、图像、OCR、Piper、SMTP；OSS 用本地目录实现）；当前阶段只需能启动并运行已有用例。
- [ ] `check` 阶段包含依赖审计（high 及以上阻断）。
- [ ] 工作流与本地命令中不出现任何密钥；需要的凭据只以 GitHub Environment 机密的名字引用。
