# 17: 家长账号与家庭设置

**What to build:** 家长在家长中心管理本家庭账号：修改自己的密码（需旧密码，成功后该家长其他会话全部失效）；停用另一位家长（不能停用最后一个有效家长，`409 LAST_PARENT`）；归档与恢复孩子（归档后隐藏、相关会话立即失效、数据保留，可恢复；头像墙与列表默认不显示已归档孩子）；修改家庭名称与时区（乐观锁；时区改动从**下一个本地日**生效，当日学习日与日报仍用旧时区）。本单把 [family 需求](../../../docs/01-requirements/modules/family.md) 已设计、此前漏排的接口落到 W3–4。

依据：[family 需求 §4.3.1–4.3.3、§4.3.5、验收要点](../../../docs/01-requirements/modules/family.md)、[family 设计](../../../docs/03-design/modules/family.md)（`archiveChild` / `restoreChild` / `changePassword`）、[api §5.3 family](../../../docs/03-design/api.md)（`PUT /me/password`、`GET·PATCH /family`、`POST /family/parents/:id/disable`、`POST /children/:id/archive`、`POST /children/:id/restore`）、[data-model §6.1](../../../docs/03-design/data-model.md)、用户 2026-10-22 决定（任务单 17 排入 W3–4，先完成整体设计后再写本单）。

**Blocked by:** [11 家长注册和登录](11-parent-signup-login.md)、[12 邀请家长和找回密码](12-parent-invite-reset.md)、[13 孩子档案和头像墙](13-child-profile-avatar-wall.md)、[15 会话管理](15-session-management.md)

**Status:** ready-for-agent

**改密码**

- [ ] `PUT /api/v1/me/password`：需当前密码 + 新密码（≥ 8 位、拒绝弱密码表）；旧密码错误 → `401 INVALID_CREDENTIALS`；成功后该家长**其他**会话全部失效（当前会话可保留或一并换发新会话，二选一写清并测）；写审计。
- [ ] 未登录或孩子会话调用 → 拒绝；跨家庭不适用（只作用于当前家长）。

**停用家长**

- [ ] `POST /api/v1/family/parents/:id/disable`：只能停用**本家庭另一位**有效家长；停用最后一个有效家长 → `409 LAST_PARENT`；停用后该家长全部会话立即 `401`，不能再登录，直到系统另有恢复路径（本单不做恢复接口，若规格无恢复则文档写明）。
- [ ] 不能停用自己（或停用自己等同退出家庭——规格未允许，一律拒绝）；跨家庭 id → `404`；写审计。
- [ ] `GET /api/v1/family/parents` 列表能区分有效 / 已停用（若已有列表在 12，本单补字段与用例）。

**归档 / 恢复孩子**

- [ ] `POST /api/v1/children/:id/archive`：本家庭孩子；归档后头像墙与默认孩子列表不展示；该孩子全部会话立即失效；星星、进度、伙伴等数据保留；重复归档幂等或 `409`（选定一种并测）。
- [ ] `POST /api/v1/children/:id/restore`：恢复后重新出现在头像墙与列表；PIN / 用户名密码仍有效（除非家长另行重置）。
- [ ] 跨家庭 → `404`；写审计；与 13 的头像墙集成：已归档孩子绝不出现在 PIN 登录入口。

**家庭名称与时区**

- [ ] `GET /api/v1/family`、`PATCH /api/v1/family`：名称、时区；乐观锁，冲突 → `409 VERSION_CONFLICT`（附最新数据）。
- [ ] 时区必须是 IANA 名（非法 → `400`）；**时区变更从下一个本地日生效**：变更当日的“学习日”、日报窗口仍按旧时区计算（用可控 Clock + 固定时区夹具测跨日边界）。
- [ ] 只有本家庭家长可改；系统管理员无此接口（停用家庭走 admin，见 16 范围外）。

**界面与 e2e**

- [ ] 家长中心：账号与安全（改密码）、家庭成员（停用另一家长，最后一位时按钮禁用并说明原因）、孩子列表（归档 / 恢复）、家庭设置（名称、时区）；使用 `packages/ui` 主题；axe 无严重违规。
- [ ] e2e：两位家长家庭 → A 改密码后 B 会话仍在、A 旧会话失效 → A 停用 B 成功 → 停用最后一位被拒 → 归档孩子后头像墙消失、会话 401 → 恢复后可再 PIN 登录 → 改时区后“当日”学习日口径不变、次日按新时区。
