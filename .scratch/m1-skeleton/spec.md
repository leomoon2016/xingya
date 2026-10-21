# 里程碑 W1–2：骨架与发布流水线

对应 [路线图](../../docs/02-solution/roadmap.md) W1–2 行：单仓库结构（含独立后台应用外壳与 `packages/ui` 主题，ADR 0015）、模块边界检查、平台层、`0001` 迁移、`xingya seeds:apply`、CI 五个阶段（含“孩子端产物不含后台代码”检查）、服务器 bootstrap（含 Piper 与声音模型）、OSS 桶与 CDN、Nginx 主站与后台两个站点（HTTPS、两套 CSP）、备份与告警、`/api/v1/health` 部署成功。

完成标准：发布包部署到服务器，`/api/v1/health` 返回新版本；ICP 备案完成前通过 SSH 端口转发验证（备案是项目负责人本人的步骤）。

任务单按全局编号，W3–4 的 10–16 在 [m2-family-accounts](../m2-family-accounts/spec.md)。

## 任务单

| # | 任务单 | Blocked by | Status |
| --- | --- | --- | --- |
| 01 | [仓库骨架打通](issues/01-repo-skeleton.md) | — | ready-for-agent |
| 02 | [平台层和初始迁移](issues/02-platform-layer.md) | 01 | ready-for-agent |
| 03 | [界面主题包](issues/03-ui-theme.md) | 01 | ready-for-agent |
| 04 | [种子数据导入](issues/04-seeds-apply.md) | 02 | ready-for-agent |
| 05 | [CI 五个阶段](issues/05-ci-pipeline.md) | 01 | ready-for-agent |
| 06 | [服务器初始化](issues/06-server-bootstrap.md) | — | ready-for-agent |
| 07 | [对象存储接入](issues/07-oss-storage.md) | 02 | ready-for-agent |
| 08 | [首次部署](issues/08-first-deploy.md) | 02, 04, 05, 06 | ready-for-agent |
| 09 | [备份与告警](issues/09-backup-alerts.md) | 06 | ready-for-agent |

## 当前可开工（frontier）

- **01 仓库骨架打通**、**06 服务器初始化**：没有前置任务，可以立即开始。
- 01 完成后：02、03、05 解锁；02 完成后：04、07 解锁（以及 W3–4 的 10、16 的一部分前置）；06 完成后：09 解锁；02、04、05、06 都完成后：08 解锁。
