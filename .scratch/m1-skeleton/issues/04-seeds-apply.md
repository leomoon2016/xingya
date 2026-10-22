# 04: 种子数据导入

**What to build:** 运维在任何环境执行 `xingya seeds:apply`，系统把 `seeds/` 中需要入库的内置数据（装扮 `shop`、默认技能 `skills`、默认角色挂载 `agents`）里**缺失的行**插入数据库；重复执行结果不变，从不修改或删除已有行，因此系统管理员在后台做过的修改不会被部署覆盖。开发者和 CI 用 `tools/validate-seeds` 校验 `seeds/` 的格式，任何错误都让检查失败。

当前 `seeds/` 各子目录还只有 README（内容随各自里程碑提交，例如默认技能随 W5–6）。本单交付命令与校验框架本身：目录为空时 `seeds:apply` 成功且不写任何行；用测试夹具中的示例数据证明插入、幂等与不覆盖。

依据：[ADR 0015](../../../docs/adr/0015-admin-app-and-seeds.md) 决策 5、[seeds/README](../../../seeds/README.md)、[deployment §9.2](../../../docs/02-solution/deployment.md)、[nfr §10.3](../../../docs/01-requirements/nfr.md)、[tools/validate-seeds/README](../../../tools/validate-seeds/README.md)。

**Blocked by:** [02 平台层和初始迁移](02-platform-layer.md)

**Status:** ready-for-agent

- [ ] `xingya seeds:apply` 使用 migrator 账号运行，设计为在 `xingya migrate` 与 `db/roles.sql` 之后执行。
- [ ] 只插入缺失行：集成测试连续执行两次，数据库内容完全相同。
- [ ] 不覆盖后台修改：集成测试先导入、再模拟后台修改某行，然后再次执行，被修改的行保持修改后的值；已有行从不被删除。
- [ ] `seeds/` 中需入库的子目录为空或不存在时，命令成功退出且不写任何行。
- [ ] 启动时读取、不入库的子目录（`course-templates`、`safety`、`phrases`、`avatars`、`partners`）不会被 `seeds:apply` 写入数据库（`partners` 图片上传 OSS 随 W10–11 游戏搭档实现，见 ADR 0018）；`samples` 不会被自动导入。
- [ ] `tools/validate-seeds` 使用 `packages/seed-schema`（与需要时的 `packages/skill-format`）中的模式校验 `seeds/` 中已存在的文件；格式错误时以非零退出并指出文件与原因（每类至少一个反例测试）。
- [ ] 校验拒绝 `seeds/skills/` 中的可执行文件与 `scripts/` 目录（有反例测试）。
- [ ] `tools/validate-seeds` 可通过统一的工作区命令运行（供 CI 的 `seeds` 阶段调用）。
