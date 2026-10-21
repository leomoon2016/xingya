# 文档索引

- [01-requirements/PRD.md](01-requirements/PRD.md)：产品需求：术语、背景与目标、用户决定与假设、成功标准、与旧系统的取舍
- [01-requirements/modules/family.md](01-requirements/modules/family.md)：家庭账号需求：家庭与角色、家长与孩子账号、登录方式、会话
- [01-requirements/modules/content.md](01-requirements/modules/content.md)：课程内容需求：内容结构、课程生命周期（草稿/审核/版本）、共享词库、题目可见部分与答案部分
- [01-requirements/modules/learning.md](01-requirements/modules/learning.md)：学习需求：课程开放与解锁、题型、判分与星级、作答（plays）与逐题反馈、间隔复习、连续天数
- [01-requirements/modules/stars.md](01-requirements/modules/stars.md)：星星需求：星星来源、账本与余额、碎片账本、商店与装扮、现实奖励兑换
- [01-requirements/modules/social.md](01-requirements/modules/social.md)：社交需求：赠送、周排行榜、消息、好友家庭
- [01-requirements/modules/companion.md](01-requirements/modules/companion.md)：学习伙伴需求：档位与领养、碎片、营地、成长、互动、AI 伙伴设计
- [01-requirements/modules/discovery.md](01-requirements/modules/discovery.md)：呀哈哈发现需求：藏匿点、概率与上限、款式与图鉴、投放规则与 AI 一句话规则
- [01-requirements/modules/studio.md](01-requirements/modules/studio.md)：AI 工作室与 AI 生成课程需求：资料上传、按模板生成、自动检查、任务与费用预算、素材库
- [01-requirements/modules/agents.md](01-requirements/modules/agents.md)：Skill 管理与 AI 角色需求（§4.10，属于 studio）：技能与版本、技能库后台、7 个默认 AI 角色、角色的技能配置、便捷功能与流水线
- [01-requirements/modules/chat.md](01-requirements/modules/chat.md)：AI 聊天（呀哈哈队长）需求
- [01-requirements/modules/controls.md](01-requirements/modules/controls.md)：家长管控需求：课程开放（家长侧）、时长与时段、审批收件箱
- [01-requirements/modules/reports.md](01-requirements/modules/reports.md)：报告通知需求：每日报告与周报邮件
- [01-requirements/nfr.md](01-requirements/nfr.md)：非功能需求：幂等、事务与锁、只追加、乐观锁、离线、安全、儿童安全、无障碍、测试策略
- [01-requirements/open-questions.md](01-requirements/open-questions.md)：待决问题（附推荐答案；Q5–Q25 为 2026-10-21 的默认值，已默认，可调整）与规格自审记录
- [02-solution/overview.md](02-solution/overview.md)：方案总览：部署拓扑、技术栈、仓库目录、哪些内容上服务器、模块与边界、后台任务
- [02-solution/deployment.md](02-solution/deployment.md)：部署与运维：服务器、发布流水线、监控告警、备份恢复
- [02-solution/roadmap.md](02-solution/roadmap.md)：里程碑（约 20.5 周）、削减顺序与风险
- [03-design/modules/family.md](03-design/modules/family.md)：家庭账号模块设计：表、边界、接口
- [03-design/modules/content.md](03-design/modules/content.md)：课程内容模块设计（词库、草稿、发布事务）
- [03-design/modules/learning.md](03-design/modules/learning.md)：学习模块设计（含闯关提交时序图）
- [03-design/modules/stars.md](03-design/modules/stars.md)：星星模块设计（含兑换时序图）
- [03-design/modules/social.md](03-design/modules/social.md)：社交模块设计
- [03-design/modules/companion.md](03-design/modules/companion.md)：学习伙伴模块设计（含领养时序图）
- [03-design/modules/discovery.md](03-design/modules/discovery.md)：呀哈哈发现模块设计（规则结构、放置算法、揭晓）
- [03-design/modules/studio.md](03-design/modules/studio.md)：AI 工作室模块设计（任务执行器、费用预估与预算、提示词安全、素材）
- [03-design/modules/agents.md](03-design/modules/agents.md)：Skill 与 AI 角色模块设计（studio）：表与数据库保证、工具目录、提示词组装、角色执行器、流水线、呀哈哈队长同步路径、导入导出
- [03-design/modules/chat.md](03-design/modules/chat.md)：AI 聊天（呀哈哈队长）模块设计
- [03-design/modules/controls.md](03-design/modules/controls.md)：家长管控模块设计
- [03-design/modules/reports.md](03-design/modules/reports.md)：报告通知模块设计
- [03-design/api.md](03-design/api.md)：API 概要：约定、错误格式与错误码、端点、权限矩阵
- [03-design/data-model.md](03-design/data-model.md)：数据模型：表清单（65 张）、租户隔离、数据库账号、数据保留；附录 A 结构验证结果
- [03-design/course-model.md](03-design/course-model.md)：课程模型：存储位置、模板定义、草稿文档结构、自动检查 K1–K12、发布流程、首发内容
- [04-ui-design/README.md](04-ui-design/README.md)：界面设计目录说明（令牌、流程、线框、效果图、组件、角色；流程、线框、效果图按 `child/`、`parent/`、`admin/` 分组）
- [05-plans/README.md](05-plans/README.md)：实施计划目录说明
- [06-releases/README.md](06-releases/README.md)：发布文档目录说明
- [06-releases/backlog.md](06-releases/backlog.md)：v1.0 之后的待办
- [06-releases/v1.0/scope.md](06-releases/v1.0/scope.md)：v1.0 范围：包含内容与非目标
- [06-releases/v1.0/changes.md](06-releases/v1.0/changes.md)：v1.0 范围变更记录
- [06-releases/v1.0/acceptance.md](06-releases/v1.0/acceptance.md)：v1.0 验收清单
- [06-releases/v1.0/release-notes.md](06-releases/v1.0/release-notes.md)：v1.0 发布说明
- [adr/README.md](adr/README.md)：架构决策记录索引（ADR 0001–0015）
- [reviews/README.md](reviews/README.md)：文档评审记录索引
- [reviews/2026-10-21-整体评审.md](reviews/2026-10-21-整体评审.md)：2026-10-21 文档整体评审报告（一致性、过期引用、验收标准、安全与儿童安全、链接；含第十节补充评审与目录调整评审）

## 原规格章节 → 文件

2026-10-21 设计变更新增的章节（§4.1.1a–c、§4.6–§4.10、§7.6）编号接续原规格；变更的决策见 [adr/](adr/README.md) 0008–0014；目录调整（后台独立应用、`seeds/`）见 ADR 0015；评审见 [reviews/](reviews/2026-10-21-整体评审.md)。

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
| §4.1.1a–c | [01-requirements/modules/content.md](01-requirements/modules/content.md) |
| §4.6（学习伙伴） | [01-requirements/modules/companion.md](01-requirements/modules/companion.md)、[03-design/modules/companion.md](03-design/modules/companion.md) |
| §4.7（呀哈哈发现） | [01-requirements/modules/discovery.md](01-requirements/modules/discovery.md)、[03-design/modules/discovery.md](03-design/modules/discovery.md) |
| §4.8（AI 生成课程）、§4.9（AI 工作室） | [01-requirements/modules/studio.md](01-requirements/modules/studio.md)、[03-design/modules/studio.md](03-design/modules/studio.md) |
| §4.10（Skill 管理与 AI 角色） | [01-requirements/modules/agents.md](01-requirements/modules/agents.md)、[03-design/modules/agents.md](03-design/modules/agents.md) |
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
| §7 | [03-design/course-model.md](03-design/course-model.md) |
| §7.1 | [03-design/course-model.md](03-design/course-model.md) |
| §7.2 | [03-design/course-model.md](03-design/course-model.md) |
| §7.3 | [03-design/course-model.md](03-design/course-model.md) |
| §7.4 | [03-design/course-model.md](03-design/course-model.md) |
| §7.5 | [03-design/course-model.md](03-design/course-model.md) |
| §7.6 | [03-design/course-model.md](03-design/course-model.md) |
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
| §4.1.5、§4.2.3、§4.6.1 时序图 | `03-design/modules/learning.md`、`03-design/modules/stars.md`、`03-design/modules/companion.md` |

> 本仓库所有文档均为 Markdown。
