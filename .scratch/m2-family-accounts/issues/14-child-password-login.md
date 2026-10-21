# 14: 孩子用户名密码登录

**What to build:** 家长可以为孩子设置（或取消）用户名和密码；孩子在不是家庭设备的浏览器上（如学校电脑、亲戚家的平板），用用户名 + 密码登录自己的档案。连续输错会和 PIN 一样被锁定，家长可以解锁。

依据：[family 需求 §4.3.3–4.3.5](../../../docs/01-requirements/modules/family.md)、[api §5.3 family](../../../docs/03-design/api.md)（`POST /auth/child-login`、`PUT · DELETE /children/:id/credentials`）。

**Blocked by:** [13 孩子档案和头像墙](13-child-profile-avatar-wall.md)

**Status:** ready-for-agent

- [ ] 设置用户名密码：用户名全站唯一（重复 → `409 USERNAME_IN_USE`），小写字母开头、4–32 位（小写字母、数字、下划线）；密码 ≥ 6 位；用户名与密码同时存在或同时不存在。反例测试覆盖每条规则。
- [ ] 取消用户名密码后，用旧凭据登录失败，且该孩子用密码登录的现有会话失效。
- [ ] 孩子用户名密码登录不需要家庭设备；成功后建立孩子会话，30 天滑动过期（用可控 Clock 测试）；错误返回 `401 INVALID_CREDENTIALS`。
- [ ] 锁定：与 PIN 共用失败计数，连续 5 次错误锁定 15 分钟（`423 ACCOUNT_LOCKED`），家长可立即解锁；同样受 IP 限流。
- [ ] 已归档的孩子不能登录。
- [ ] 页面：孩子登录页（非家庭设备入口）使用 `packages/ui` 主题，axe 无严重违规；e2e 覆盖“家长设置凭据 → 非家庭设备登录 → 输错 5 次锁定 → 家长解锁 → 登录成功”。
