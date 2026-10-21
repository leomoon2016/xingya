# 里程碑 W3–4：家庭、账号、登录

对应 [路线图](../../docs/02-solution/roadmap.md) W3–4 行：注册码注册、家长登录/邀请/找回密码/邮箱验证、孩子档案、家庭设备与头像墙、PIN 与锁定、孩子密码登录、会话管理与远程下线、系统管理员 TOTP 登录（后台子域名、后台 Cookie 与 Host 限制）、邮件发件箱。需求见 [家庭账号 · 需求](../../docs/01-requirements/modules/family.md)。

任务单沿用全局编号（10–16），前置任务 01–09 在 [m1-skeleton](../m1-skeleton/spec.md)。

## 任务单

| # | 任务单 | Blocked by | Status |
| --- | --- | --- | --- |
| 10 | [邮件发件箱](issues/10-email-outbox.md) | 02 | ready-for-agent |
| 11 | [家长注册和登录](issues/11-parent-signup-login.md) | 02, 03, 10 | ready-for-agent |
| 12 | [邀请家长和找回密码](issues/12-parent-invite-reset.md) | 11 | ready-for-agent |
| 13 | [孩子档案和头像墙](issues/13-child-profile-avatar-wall.md) | 11 | ready-for-agent |
| 14 | [孩子用户名密码登录](issues/14-child-password-login.md) | 13 | ready-for-agent |
| 15 | [会话管理](issues/15-session-management.md) | 13 | ready-for-agent |
| 16 | [系统管理员登录与签发注册码](issues/16-admin-login.md) | 02, 03, 10, 11 | ready-for-agent |

## 当前可开工（frontier）

- 本里程碑暂无可立即开工的任务单；全局 frontier 是 **01** 与 **06**（见 [m1-skeleton](../m1-skeleton/spec.md)）。
- 02 完成后 10 解锁；10 完成后 11 解锁；11 完成后 12、13、16 解锁；13 完成后 14、15 解锁。

## 说明

- 系统管理员按文档由 `xingya admin:create` 创建（强密码 + 必须 TOTP），不使用默认账号（用户 2026-10-22 确认）。
- 注册码的签发（`POST /admin/signup-codes` 与后台“家庭”页）在 [16](issues/16-admin-login.md) 中实现；完成 16 后生产环境即可开通第一个真实家庭。
