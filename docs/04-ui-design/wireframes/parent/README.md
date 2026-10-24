# wireframes/parent —— 家长中心线框图

画框：**手机 360×800（单列）** 与 **桌面 ≥1280** 均需考虑（[nfr §8.4](../../../01-requirements/nfr.md#84-设备与屏幕)）。色板用 [`design-tokens.json`](../../tokens/design-tokens.json) 的 `color.neutral`。格式对齐孩子端线框（目的 / ASCII 布局 / 双画框 / 状态 / 空错 / 无障碍）。

**尚未绘制**：系统管理后台线框；高保真 mockups。

与孩子端闭环：小铺「喜欢的时光」→ [approvals/inbox](approvals/inbox.md)；「累计奖励」→ [rewards/writeoff](rewards/writeoff.md)；奖励目录 → [rewards/catalog](rewards/catalog.md)（ADR 0020 R17）。

## 外壳

| 文件 | 说明 |
| --- | --- |
| [shell.md](shell.md) | 侧栏/底栏导航、顶栏家庭名与信箱、孩子芯片切换 |

## 按功能

| 目录 | 线框 | 说明 |
| --- | --- | --- |
| [dashboard/](dashboard/) | [home.md](dashboard/home.md) | 首页：今日卡、加时、待办摘要 |
| [overview/](overview/) | [child-list.md](overview/child-list.md)、[learning.md](overview/learning.md)、[knowledge-graph.md](overview/knowledge-graph.md)、[stars.md](overview/stars.md)、[nickname-audit.md](overview/nickname-audit.md) | 孩子列表、学习全览、知识图谱、加减星与流水、改名记录 |
| [approvals/](approvals/) | [inbox.md](approvals/inbox.md) | 兑换审批 + 好友请求 |
| [rewards/](rewards/) | [catalog.md](rewards/catalog.md)、[writeoff.md](rewards/writeoff.md) | 家庭奖励清单、累计核销 |
| [controls/](controls/) | [hub.md](controls/hub.md)、[time.md](controls/time.md)、[courses.md](controls/courses.md)、[friend-families.md](controls/friend-families.md)、[devices.md](controls/devices.md) | 时长加时、课程开放、好友家庭、设备会话 |
| [reports/](reports/) | [daily.md](reports/daily.md)、[weekly-mail.md](reports/weekly-mail.md) | 学习报告、周报订阅 |
| [settings/](settings/) | [family.md](settings/family.md)、[account.md](settings/account.md)、[children.md](settings/children.md) | 家庭名时区、改密码/停用家长、孩子归档（任务单 17） |
| [inbox/](inbox/) | [inbox.md](inbox/inbox.md) | 家长信箱 |

导航建议：首页 / 待处理 / 孩子 / 报告 / 管控 / 奖励 / 设置。
