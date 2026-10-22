# 家庭账号（family）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。

> 2026-10-22 用户决定：注册永久只用邀请码（没有注册模式设置）；注册码可绑定邮箱；系统管理员 5 次锁定 15 分钟、后台改密码、`admin:reset-totp`；孩子自改昵称与服务端偏好；任务单 17 的家长账号与家庭设置接口；信箱系统通知表 `notifications` 归 family（各模块都依赖 family，避免环）。旧孩子数据不迁移。

## 职责

家庭（租户根）、家长与孩子账号、家庭设备与头像墙、PIN/密码登录、会话、邀请与找回密码、系统管理员账号（登录锁定、改密码、TOTP 重置命令）、审计、信箱系统通知。

## 拥有的表

families, parents, children, admin_accounts, family_devices, sessions, auth_tokens, audit_events, notifications（9 张）

列与约束见 [数据模型 §6.1](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/family/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`；单元测试在 `apps/api/test/unit/family/`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**family**

```ts
registerFamily(cmd: {signupCode, email, password, displayName, familyName, timeZone}): {family, parent, session}   // 只凭注册码；码绑定邮箱时必须一致 → 403 SIGNUP_CODE_EMAIL_MISMATCH
loginParent(email, password, ctx): Session            // 失败计数、锁定
inviteParent(p, email): void                          // 发 invite_parent 令牌邮件
acceptInvitation(token, password, displayName): Session
requestPasswordReset(email): void / resetPassword(token, newPassword): void / verifyEmail(token): void
createChild(p, {nickname, avatarKey, grade, pin}): Child
updateChild(p, childId, patch & {version}): Child      // 版本冲突 → VERSION_CONFLICT
setChildPin(p, childId, pin) / setChildCredentials(p, childId, {username, password} | null)
archiveChild(p, childId) / restoreChild(p, childId)        // 任务单 17
changePassword(p, {oldPassword, newPassword})             // 任务单 17；其他会话失效
disableParent(p, parentId)                                // 任务单 17；最后一个有效家长 → LAST_PARENT
updateChildSelf(child, {nickname?, currentCourseId?, prefSound?, prefReducedMotion?, version})   // 孩子“我的设置”；改昵称写审计
markFamilyDevice(p, label): {deviceToken}             // 设置 xy_device Cookie
listDeviceChildren(deviceToken): ChildCard[]          // 头像墙
loginChildByPin(deviceToken, childId, pin): Session
loginChildByPassword(username, password): Session
authenticate(sessionToken): P | null                  // 每个请求的鉴权钩子调用
listChildSessions(p, childId) / revokeSession(p, sessionId) / revokeFamilyDevice(p, deviceId)
getFamily(familyId) / getChild(familyId, childId) / listChildren(familyId)
updateFamily(p, {name?, timeZone?, version}) / setCrossFamily(p, enabled, version) / rotateFriendCode(p)
findFamilyByFriendCode(code): FamilyRef | null
recordAudit(tx, event)
notifyInTx(tx, {familyId, to: {childId} | {parentId}, kind, title, body, ref?})   // 信箱系统通知；被 stars、companion、social、controls 调用
listNotifications(viewer, cursor) / markNotificationRead(viewer, id) / unreadCount(viewer)
// 系统管理员
loginAdmin(username, password, totp, ctx): Session      // 连续 5 次失败锁 15 分钟（failed_count、locked_until）
changeAdminPassword(admin, {oldPassword, newPassword, totp})
issueSignupCode(admin, {email?}): {code}                 // 填了邮箱即绑定（小写）
// 运维命令：xingya admin:create、xingya admin:reset-totp <username>（重置后下次登录重新绑定）
```

## 端点

见 [API 概要 §5.3](../api.md) 中“family”一组。

## 需求

见 [家庭账号 · 需求](../../01-requirements/modules/family.md)。
