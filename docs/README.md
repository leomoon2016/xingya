# 文档索引

- [01-requirements/PRD.md](01-requirements/PRD.md)：产品需求：术语、背景与目标、用户决定与假设、成功标准、与旧系统的取舍
- [01-requirements/modules/family.md](01-requirements/modules/family.md)：家庭账号需求：家庭与角色、家长与孩子账号、登录方式、会话
- [01-requirements/modules/content.md](01-requirements/modules/content.md)：课程内容需求：内容结构与稳定 ID
- [01-requirements/modules/learning.md](01-requirements/modules/learning.md)：学习需求：课程开放与解锁、题型、判分与星级、整批提交、间隔复习、连续天数
- [01-requirements/modules/stars.md](01-requirements/modules/stars.md)：星星需求：星星来源、账本与余额、商店与宠物、现实奖励兑换
- [01-requirements/modules/social.md](01-requirements/modules/social.md)：社交需求：赠送、周排行榜、消息、好友家庭
- [01-requirements/modules/chat.md](01-requirements/modules/chat.md)：AI 聊天（呀哈哈）需求
- [01-requirements/modules/controls.md](01-requirements/modules/controls.md)：家长管控需求：课程开放（家长侧）、时长与时段、审批收件箱
- [01-requirements/modules/reports.md](01-requirements/modules/reports.md)：报告通知需求：每日报告与周报邮件
- [01-requirements/nfr.md](01-requirements/nfr.md)：非功能需求：幂等、事务与锁、只追加、乐观锁、离线、安全、儿童安全、无障碍、测试策略
- [01-requirements/open-questions.md](01-requirements/open-questions.md)：待决问题（附推荐答案）与规格自审记录
- [02-solution/overview.md](02-solution/overview.md)：方案总览：部署拓扑、技术栈、仓库目录、哪些内容上服务器、模块与边界、后台任务
- [02-solution/deployment.md](02-solution/deployment.md)：部署与运维：服务器、发布流水线、监控告警、备份恢复
- [02-solution/roadmap.md](02-solution/roadmap.md)：里程碑（13 周）与风险
- [03-design/modules/family.md](03-design/modules/family.md)：家庭账号模块设计：表、边界、接口
- [03-design/modules/content.md](03-design/modules/content.md)：课程内容模块设计
- [03-design/modules/learning.md](03-design/modules/learning.md)：学习模块设计（含闯关提交时序图）
- [03-design/modules/stars.md](03-design/modules/stars.md)：星星模块设计（含兑换时序图）
- [03-design/modules/social.md](03-design/modules/social.md)：社交模块设计
- [03-design/modules/chat.md](03-design/modules/chat.md)：AI 聊天模块设计
- [03-design/modules/controls.md](03-design/modules/controls.md)：家长管控模块设计
- [03-design/modules/reports.md](03-design/modules/reports.md)：报告通知模块设计
- [03-design/api.md](03-design/api.md)：API 概要：约定、错误格式与错误码、端点、权限矩阵
- [03-design/data-model.md](03-design/data-model.md)：数据模型：表清单、租户隔离、数据库账号、数据保留；附录 A 结构验证结果
- [03-design/content-pack.md](03-design/content-pack.md)：课程包格式：目录、JSON 结构、构建流程、校验规则、旧内容转换
- [04-ui-design/README.md](04-ui-design/README.md)：界面设计目录说明（令牌、流程、线框、效果图、组件、角色）
- [05-plans/README.md](05-plans/README.md)：实施计划目录说明
- [06-releases/README.md](06-releases/README.md)：发布文档目录说明
- [06-releases/backlog.md](06-releases/backlog.md)：v1.0 之后的待办
- [06-releases/v1.0/scope.md](06-releases/v1.0/scope.md)：v1.0 范围：包含内容与非目标
- [06-releases/v1.0/changes.md](06-releases/v1.0/changes.md)：v1.0 范围变更记录
- [06-releases/v1.0/acceptance.md](06-releases/v1.0/acceptance.md)：v1.0 验收清单
- [06-releases/v1.0/release-notes.md](06-releases/v1.0/release-notes.md)：v1.0 发布说明
- [adr/README.md](adr/README.md)：架构决策记录索引（ADR 0001–0007）
- [xingya-设计文档合集.docx](xingya-设计文档合集.docx)：合集：01–03 全部文档与 v1.0 范围，供审阅

## 原规格章节 → 文件

拆分后的文档沿用原《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed，已从仓库移除，可在 Git 历史中查看）的章节编号。

| 原章节 | 文件 |
| --- | --- |
| §0 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §1 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §1.1 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §1.2 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §1.3 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §1.4 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §1.5 | [06-releases/v1.0/scope.md](06-releases/v1.0/scope.md) |
| §2 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §3 | [02-solution/overview.md](02-solution/overview.md) |
| §3.1 | [02-solution/overview.md](02-solution/overview.md) |
| §3.2 | [02-solution/overview.md](02-solution/overview.md) |
| §3.3 | [02-solution/overview.md](02-solution/overview.md) |
| §3.4 | [02-solution/overview.md](02-solution/overview.md) |
| §3.6 | [02-solution/overview.md](02-solution/overview.md) |
| §4.1.1 | [01-requirements/modules/content.md](01-requirements/modules/content.md) |
| §4.1.2 | [01-requirements/modules/learning.md](01-requirements/modules/learning.md) |
| §4.1.3 | [01-requirements/modules/learning.md](01-requirements/modules/learning.md) |
| §4.1.4 | [01-requirements/modules/learning.md](01-requirements/modules/learning.md) |
| §4.1.5 | [01-requirements/modules/learning.md](01-requirements/modules/learning.md) |
| §4.1.6 | [01-requirements/modules/learning.md](01-requirements/modules/learning.md) |
| §4.1.7 | [01-requirements/modules/learning.md](01-requirements/modules/learning.md) |
| §4.1.8 | [01-requirements/modules/stars.md](01-requirements/modules/stars.md) |
| §4.2.1 | [01-requirements/modules/stars.md](01-requirements/modules/stars.md) |
| §4.2.2 | [01-requirements/modules/stars.md](01-requirements/modules/stars.md) |
| §4.2.3 | [01-requirements/modules/stars.md](01-requirements/modules/stars.md) |
| §4.2.4 | [01-requirements/modules/social.md](01-requirements/modules/social.md) |
| §4.2.5 | [01-requirements/modules/social.md](01-requirements/modules/social.md) |
| §4.2.6 | [01-requirements/modules/social.md](01-requirements/modules/social.md) |
| §4.2.7 | [01-requirements/modules/social.md](01-requirements/modules/social.md) |
| §4.3.1 | [01-requirements/modules/family.md](01-requirements/modules/family.md) |
| §4.3.2 | [01-requirements/modules/family.md](01-requirements/modules/family.md) |
| §4.3.3 | [01-requirements/modules/family.md](01-requirements/modules/family.md) |
| §4.3.4 | [01-requirements/modules/family.md](01-requirements/modules/family.md) |
| §4.3.5 | [01-requirements/modules/family.md](01-requirements/modules/family.md) |
| §4.3.6 | [01-requirements/modules/controls.md](01-requirements/modules/controls.md) |
| §4.4.1 | [01-requirements/modules/controls.md](01-requirements/modules/controls.md) |
| §4.4.2 | [01-requirements/modules/reports.md](01-requirements/modules/reports.md) |
| §4.4.3 | [01-requirements/modules/controls.md](01-requirements/modules/controls.md) |
| §4.4.4 | [01-requirements/modules/chat.md](01-requirements/modules/chat.md) |
| §4.5 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §4.5.1 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §4.5.2 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §4.5.3 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §4.5.4 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §4.5.5 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §5 | [03-design/api.md](03-design/api.md) |
| §5.1 | [03-design/api.md](03-design/api.md) |
| §5.2 | [03-design/api.md](03-design/api.md) |
| §5.3 | [03-design/api.md](03-design/api.md) |
| §5.4 | [03-design/api.md](03-design/api.md) |
| §6 | [03-design/data-model.md](03-design/data-model.md) |
| §6.1 | [03-design/data-model.md](03-design/data-model.md) |
| §6.2 | [03-design/data-model.md](03-design/data-model.md) |
| §6.3 | [03-design/data-model.md](03-design/data-model.md) |
| §6.4 | [03-design/data-model.md](03-design/data-model.md) |
| §7 | [03-design/content-pack.md](03-design/content-pack.md) |
| §7.1 | [03-design/content-pack.md](03-design/content-pack.md) |
| §7.2 | [03-design/content-pack.md](03-design/content-pack.md) |
| §7.3 | [03-design/content-pack.md](03-design/content-pack.md) |
| §7.4 | [03-design/content-pack.md](03-design/content-pack.md) |
| §7.5 | [03-design/content-pack.md](03-design/content-pack.md) |
| §8 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §8.1 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §8.2 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §8.3 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §9 | [02-solution/deployment.md](02-solution/deployment.md) |
| §9.1 | [02-solution/deployment.md](02-solution/deployment.md) |
| §9.2 | [02-solution/deployment.md](02-solution/deployment.md) |
| §9.3 | [02-solution/deployment.md](02-solution/deployment.md) |
| §9.4 | [02-solution/deployment.md](02-solution/deployment.md) |
| §10 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §10.1 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §10.2 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §10.3 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §10.4 | [01-requirements/nfr.md](01-requirements/nfr.md) |
| §11 | [02-solution/roadmap.md](02-solution/roadmap.md) |
| §12 | [02-solution/roadmap.md](02-solution/roadmap.md) |
| §13 | [01-requirements/open-questions.md](01-requirements/open-questions.md) |
| §14.1 | [01-requirements/open-questions.md](01-requirements/open-questions.md) |
| §14.2 | [01-requirements/PRD.md](01-requirements/PRD.md) |
| §附录 A | [03-design/data-model.md](03-design/data-model.md) |
| §3.3 | 由批准的仓库目录结构取代，见 [02-solution/overview.md](02-solution/overview.md) |
| §3.5 | 按模块拆入 `03-design/modules/*.md` 的“接口”一节 |
| §4.1.5、§4.2.3 时序图 | `03-design/modules/learning.md`、`03-design/modules/stars.md` |
