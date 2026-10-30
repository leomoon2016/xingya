# W3–4 家庭、账号、登录 Implementation Plan

> **2026-10-30 PostgreSQL**：脚手架与集成测试目标库改为 PostgreSQL 16；驱动 `pg`；备份 `pg_dump`；队列抢占 `FOR UPDATE SKIP LOCKED`（ADR 0023 / 0024）。下列任务中若仍出现历史 PostgreSQL 字样，以本注记为准。


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 家长凭注册码注册并登录、邀请/找回密码、孩子档案与头像墙 PIN、孩子密码登录、会话远程下线、系统管理员 TOTP 登录并签发注册码、家长账号与家庭设置（任务单 17）；开发环境邮件经发件箱 + 捕获器可完成 e2e。

**Architecture:** 业务在 `apps/api/src/modules/family`；邮件入队在 `modules/reports`（表 `email_outbox`），SMTP 传输在 `platform/config`；会话 Cookie 主站 `xy_sid` / 设备 `xy_device`、后台 `xy_admin_sid`（Host-only，ADR 0015）；所有令牌库内只存 SHA-256；时间与锁定经 Task 2 的 `Clock`；跨家庭一律 `404`。

**Tech Stack:** 同 W1–2；另加 nodemailer（生产 SMTPS 465 / DirectMail）、scrypt（N=2^15,r=8,p=1；并发哈希 ≤4）、TOTP（otplib 或等价）、Playwright 双站 e2e。

**Spec:** [.scratch/m2-family-accounts/spec.md](../../.scratch/m2-family-accounts/spec.md)（任务单 10–17）；对照 [family 需求](../01-requirements/modules/family.md)、[family 设计](../03-design/modules/family.md)、[api §5.3 family / admin](../03-design/api.md)、[reports 设计 enqueueEmail](../03-design/modules/reports.md)、[ADR 0007](../adr/0007-family-as-tenant.md)、[ADR 0015](../adr/0015-admin-app-and-seeds.md)、[ADR 0022](../adr/0022-llm-vision-image-providers.md)。

## Blockers（本计划不可先于 m1 对应任务）

| 本任务 | 阻塞于 m1 |
| --- | --- |
| 10 邮件发件箱 | 02 平台层（调度器、事务、Clock） |
| 11 家长注册登录 | 02、03、**10** |
| 12 邀请/找回 | 11 |
| 13 孩子档案头像墙 | 11 |
| 14 孩子密码登录 | 13 |
| 15 会话管理 | 13 |
| 16 管理员登录与注册码 | 02、03、10、11 |
| 17 家长账号与家庭设置 | 11、12、13、15 |

全局 frontier 仍是 m1 的 **01** 与 **06**；本计划在 m1 Task 2（及 3/10 依赖链）完成前不要开工编码。

## Global Constraints

- 继承 [W1–2 Global Constraints](./2026-10-24-w1-2-skeleton.md#global-constraints)。
- **永久只用注册码**（Q4 已关闭）：无 `registration.mode` 设置；无码/无效码/已用码拒绝创建家庭；码绑定邮箱时不一致 → `403 SIGNUP_CODE_EMAIL_MISMATCH`（以需求/api 为准；ticket 11 中 `registration.mode` 表述作废）。
- 昵称 **1–24 字**（需求/数据模型；ticket 13 写 ≤20 处以需求为准）。
- 口令/PIN/会话令牌：库内哈希或 SHA-256；日志脱敏；Cookie 不设 `Domain`。
- 系统管理员：`xingya admin:create` 创建（强密码 + 必 TOTP），无默认账号；连续 **5** 次失败锁 **15** 分钟；`PUT /admin/me/password`；`xingya admin:reset-totp <username>`。
- 孩子 PIN 登录仅家庭设备（DB CHECK + API）；跨家庭资源 → `404`；权限矩阵见 api §5.4。

## Review Focus

1. **注册码邮箱绑定：** 绑定码用其他邮箱 → `403 SIGNUP_CODE_EMAIL_MISMATCH`；不绑定则任意邮箱一次——Task 11 + 16。
2. **找回密码枚举：** `password-reset/request` 无论邮箱是否存在均 202——Task 12。
3. **PIN 锁定持久化：** 5 次错误锁 15 分钟落库，进程重启不丢；家长 unlock——Task 13。
4. **Host 隔离：** 主站 Host 调 `/api/v1/admin/*` → 404；`xy_sid` 不能进后台、`xy_admin_sid` 不能进家长/孩子 API——Task 16。
5. **时区次日生效：** `PATCH /family` 改时区后，当日学习日仍按旧时区——Task 17（可控 Clock）。

## File map

| 路径 | 职责 |
| --- | --- |
| `apps/api/src/modules/reports/{index,repo,service}.ts` | `enqueueEmail`、`sendDueEmails` |
| `apps/api/src/platform/config/mail.ts` | SMTP / 开发日志捕获 / 测试桩 |
| `apps/api/src/modules/family/{index,routes,service,repo}.ts` | 家庭账号全部业务与路由 |
| `apps/api/src/platform/auth/` | Cookie 解析、Principal、TOTP 辅助 |
| `apps/api/src/cli/admin-create.ts`, `admin-reset-totp.ts` | 运维命令 |
| `apps/web/src/features/{child,parent}/` | 登录、头像墙、家长中心账号页 |
| `apps/admin/src/features/{auth,families}/` | 后台登录、签发注册码 |
| `packages/contracts/src/family.ts` | Zod 请求/响应 |
| `apps/api/test/{unit,integration,concurrency}/family|reports/` | 服务端测试 |
| `apps/web/e2e/`, `apps/admin/e2e/` | 跨应用流程 |

---

### Task 10: 邮件发件箱（ticket 10）

**Files:**
- Create: `apps/api/src/modules/reports/repo.ts`, `service.ts`, `index.ts`
- Create: `apps/api/src/platform/config/mail.ts`（`SmtpTransport` | `LogCaptureTransport` | `TestSinkTransport`）
- Create: `apps/api/test/integration/email-outbox.test.ts`, `apps/api/test/concurrency/email-send.lock.test.ts`
- Modify: 调度器注册 `email-send` every 30s → `sendDueEmails`

**Interfaces:**
- Consumes: m1 `withTx`, `Scheduler`, `Clock`
- Produces:
  - `enqueueEmail(tx, { kind, dedupeKey, to, subject, html, text, familyId?, parentId? }): void` — 同事务；回滚则无行；`UNIQUE(dedupe_key)` 重复入队保留一封
  - `sendDueEmails(now: Date): Promise<number>` — 只取 pending 且到期；成功清空正文并 `sent_at`；失败退避 1m/5m/30m/2h/6h…，`attempts≤10` 后 `failed`+`last_error`
  - TestSink：`getSent(): OutboxMail[]` 供 11/12/16 e2e 取链接

- [ ] **Step 1: Write failing tests** — 事务回滚无邮件；dedupe；Clock 推完退避序列；成功后 body 空；双进程同信不双发。

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @xingya/api test:integration -- email-outbox`

- [ ] **Step 3: Implement enqueue + sender** — 生产 nodemailer SMTPS 465，凭据仅 secrets.env；开发 LogCapture（令牌不落日志、邮箱打码）；测试 TestSink。

- [ ] **Step 4: Re-run integration + concurrency — PASS**

- [ ] **Step 5: Commit** — `feat(m2): email outbox enqueue and sendDueEmails`

---

### Task 11: 家长注册和登录（ticket 11）

**Files:**
- Create: `apps/api/src/modules/family/{repo,service,routes,index}.ts`（signup/login/logout/verify/me）
- Create: `packages/contracts/src/family.ts`（SignupBody、LoginBody、MeResponse…）
- Create: `apps/web/src/features/child/login/*`, `apps/web/src/features/parent/*`（注册后进家长中心）
- Test: `apps/api/test/integration/family-signup-login.test.ts`；e2e `apps/web/e2e/parent-signup.spec.ts`

**Interfaces:**
- Consumes: Task 10 `enqueueEmail`；m1 幂等/Clock/主题
- Produces（对齐 family 设计签名）:
  - `registerFamily({ signupCode, email, password, displayName, familyName, timeZone }) → { family, parent, session }`
  - `loginParent(email, password, ctx) → Session`
  - `verifyEmail(token): void`
  - `authenticate(sessionToken): Principal | null`
  - HTTP: `POST /api/v1/auth/signup|login|logout`, `POST /auth/verify-email`, `GET /me`
  - Cookie `xy_sid`：HttpOnly、Secure、SameSite=Lax、Path=/；个人设备家长会话 30 天滑动；`last_seen_at` ≤每 5 分钟写一次

- [ ] **Step 1: Write failing API tests** — 无码/废码拒绝；码一次用；邮箱小写去重 → `409 EMAIL_IN_USE`；弱密码拒；绑定邮箱不符 → `403 SIGNUP_CODE_EMAIL_MISMATCH`；登录统一 `401 INVALID_CREDENTIALS`；10 次失败 → `423`+`lockedUntil`；IP 10 分钟 20 次 → `429`；跨家庭资源 `404`。

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** — 同事务建家庭+家长+入队验证邮件+建会话；令牌/会话只存 SHA-256；密码 scrypt 参数按 ticket；验证令牌一次性。

- [ ] **Step 4: Integration + e2e「注册→验证→退出→登录」+ axe — PASS**

- [ ] **Step 5: Commit** — `feat(m2): parent signup, login, verify-email, GET /me`

**Note:** 测试夹具直接插入 `family_signup` 令牌；生产签发在 Task 16。

---

### Task 12: 邀请家长和找回密码（ticket 12）

**Files:**
- Modify: `family/service.ts`, `routes.ts`
- Create: web 邀请接受页、重置密码页
- Test: `family-invite-reset.test.ts`；e2e 邀请与重置

**Interfaces:**
- Consumes: Task 11 会话；Task 10 入队
- Produces:
  - `inviteParent(p, email): void` — 7 天 `invite_parent` 令牌
  - `acceptInvitation(token, password, displayName) → Session`
  - `requestPasswordReset(email): void` — 总是成功路径对外 202
  - `resetPassword(token, newPassword): void` — 30 分钟、一次性；该家长其他会话全废
  - HTTP: `POST /family/invitations`, `POST /auth/invitations/accept`, `POST /auth/password-reset/request|confirm`
  - `GET /family/parents` 列出成员

- [ ] **Step 1: Failing tests** — EMAIL_IN_USE；Clock 7d/30m 边界；重置后旧会话 401；审计事件存在。

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement + 写审计 `recordAudit`**

- [ ] **Step 4: e2e A 邀 B → SMTP 桩 → B 同家庭；B 重置 → 旧会话死 — PASS**

- [ ] **Step 5: Commit** — `feat(m2): parent invite and password reset`

---

### Task 13: 孩子档案和头像墙（ticket 13）

**Files:**
- Modify: family service/routes
- Create: `apps/web` 头像墙、PIN 垫、家长中心孩子表单
- Create: `seeds/avatars/manifest.json`（若仍缺 SVG，用占位键 + README，真实画稍后；清单必须存在以便校验）
- Test: integration + e2e Chromium+WebKit

**Interfaces:**
- Consumes: Task 11
- Produces:
  - `createChild(p, { nickname, avatarKey, grade, pin })` — 昵称 1–24、家庭唯一、敏感词、禁 5+ 连续数字；avatar ∈ seeds/avatars；grade 1–6；PIN 4 位拒弱表；scrypt
  - `updateChild(p, id, patch & { version })` — `409 VERSION_CONFLICT`
  - `setChildPin(p, id, pin)`
  - `markFamilyDevice(p, label) → { deviceToken }` — Cookie `xy_device` 365d
  - `listDeviceChildren(deviceToken) → ChildCard[]` — 仅未归档
  - `loginChildByPin(deviceToken, childId, pin) → Session` — 最长 12h；5 次 → 423；家长 `POST /children/:id/unlock`
  - HTTP: `POST/PATCH /children`, `PUT /children/:id/pin`, `POST /children/:id/unlock`, `POST/GET /family/devices`, `GET /device/children`, `POST /device/child-session`
  - 家庭设备上家长会话：15 分钟无操作 / 最长 2h；同浏览器同一时刻单一身份

- [ ] **Step 1: Failing rule tests**（昵称/PIN/头像/年级每条反例）+ 设备 Cookie 缺失看不到孩子 + 非设备 PIN 被拒

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** — 锁状态落库；审计锁定/解锁

- [ ] **Step 4: e2e 标记设备→错 PIN×5→解锁→正确进入→换人；触控≥44；axe — PASS**

- [ ] **Step 5: Commit** — `feat(m2): children, family device, avatar wall PIN`

---

### Task 14: 孩子用户名密码登录（ticket 14）

**Files:**
- Modify: family service/routes；web 非家庭设备孩子登录页
- Test: `child-password-login.test.ts` + e2e

**Interfaces:**
- Consumes: Task 13（共享失败计数/锁定）
- Produces:
  - `setChildCredentials(p, id, { username, password } | null)` — 用户名全站唯一、`^[a-z][a-z0-9_]{3,31}$`；密码 ≥6；成对存在/成对空
  - `loginChildByPassword(username, password) → Session` — 30 天滑动；不需 `xy_device`
  - HTTP: `PUT|DELETE /children/:id/credentials`, `POST /auth/child-login`
  - 取消凭据 → 旧会话失效；已归档不可登录

- [ ] **Step 1: Failing tests** — USERNAME_IN_USE；格式反例；归档拒绝；与 PIN 共用 5 次锁

- [ ] **Step 2–4: Implement + e2e「设凭据→非设备登录→锁→解锁」— PASS**

- [ ] **Step 5: Commit** — `feat(m2): child username/password login`

---

### Task 15: 会话管理（ticket 15）

**Files:**
- Modify: family service/routes；家长中心会话与设备列表 UI
- Test: `sessions.test.ts` + e2e 撤销设备

**Interfaces:**
- Consumes: Task 13
- Produces:
  - `listChildSessions(p, childId)` — 近 30 天；设备名或 UA 摘要；**无**令牌/哈希
  - `revokeSession(p, sessionId)` — 下次 401；审计
  - `revokeFamilyDevice(p, deviceId)` — 设备 Cookie 失效 + 该设备孩子会话全废
  - HTTP: `GET /children/:id/sessions`, `DELETE /sessions/:id`, `GET|DELETE /family/devices/:id`
  - 孩子调这些 → `403`；跨家庭 → `404`
  - Clock 覆盖四种主体时效（家长个人/家庭设备、孩子 PIN/密码）按需求 §4.3.5

- [ ] **Step 1: Failing tests** for revoke + matrix

- [ ] **Step 2–4: Implement + e2e 家长撤设备 → 孩子回登录 — PASS**

- [ ] **Step 5: Commit** — `feat(m2): session list and remote revoke`

---

### Task 16: 系统管理员登录与签发注册码（ticket 16）

**Files:**
- Create: `apps/api/src/cli/admin-create.ts`, `admin-reset-totp.ts`
- Modify: family（admin 函数）+ platform/auth TOTP；admin 登录页与「家庭」签发表单
- Create: `apps/admin/e2e/signup-code.spec.ts`（双站）
- Create: `deploy/docs/first-family.md`（admin:create → 转发登录 → 签发 → 家长注册）

**Interfaces:**
- Consumes: Task 10、11；m1 Host/CSP
- Produces:
  - `loginAdmin(username, password, totp, ctx) → Session` — 任一错 `401`；**5** 次 / **15** 分钟 `423`；审计
  - Cookie `xy_admin_sid`：Host-only、Secure、HttpOnly、SameSite=Strict；30 分钟空闲 / 最长 8h
  - `issueSignupCode(admin, { email? }) → { code }` — 14 天、明文仅响应一次；可选邮箱绑定+邀请邮件
  - `changeAdminPassword(admin, { oldPassword, newPassword, totp })`；CLI `xingya admin:reset-totp`
  - HTTP: `POST /api/v1/admin/login`, `PUT /admin/me/password`, `POST /admin/signup-codes`（仅后台 Host）
  - 主站 Host → 404；权限矩阵：管理员无家庭学习/改星接口

- [ ] **Step 1: Failing tests** — create 重复用户名；TOTP 窗口边界；Host 隔离；码二次使用/过期；明文不落库不落日志；改密后其他后台会话失效

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** — TOTP 种子用 `XINGYA_MASTER_KEY` 加密；admin UI 签发后「只显示一次」

- [ ] **Step 4: 双站 e2e — PASS**；确认 web dist 仍无后台字符串（m1 Task 5 检查）

- [ ] **Step 5: Commit** — `feat(m2): admin TOTP login, signup codes, admin:create`

---

### Task 17: 家长账号与家庭设置（ticket 17）

**Files:**
- Modify: family service/routes；家长中心「账号与安全 / 成员 / 孩子 / 家庭设置」
- Test: `family-settings.test.ts` + e2e 全流程

**Interfaces:**
- Consumes: Tasks 11–13、15
- Produces:
  - `changePassword(p, { oldPassword, newPassword })` — 旧错 `401`；**其他**会话失效；当前会话保留（选定并测）
  - `disableParent(p, parentId)` — 不能停自己；最后一位 → `409 LAST_PARENT`；跨家庭 `404`；目标会话全 401
  - `archiveChild` / `restoreChild` — 归档隐藏+会话废；恢复后可再 PIN；重复归档幂等（选定并测）
  - `updateFamily(p, { name?, timeZone?, version })` — IANA 时区；非法 `400`；乐观锁；**时区下一本地日生效**
  - HTTP: `PUT /me/password`, `POST /family/parents/:id/disable`, `POST /children/:id/archive|restore`, `GET|PATCH /family`
  - `GET /family/parents` 区分 active/disabled

- [ ] **Step 1: Failing tests** — LAST_PARENT；归档后头像墙无孩子；时区跨日边界（Clock + 固定 TZ 夹具）；审计

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** — 本单不做停用家长的恢复接口（文档注明）

- [ ] **Step 4: e2e 按 ticket 17 清单 — PASS + axe**

- [ ] **Step 5: Commit** — `feat(m2): parent password, disable parent, archive child, family settings`

---

## Self-Review

1. **Spec coverage:** m2 任务单 10–17 均有对应 Task；signup 邮箱绑定、管理员 5/15、改密、reset-totp、任务单 17 全覆盖；与 api §5.3 / family 设计签名对齐。
2. **Step scan:** 以接口签名与测试断言为主；无整文件实现倾销。
3. **Type consistency:** `enqueueEmail`、`registerFamily`、`loginChildByPin`、`issueSignupCode` 与设计文档一致；Cookie 名与 ADR 0015 一致。
4. **Review Focus:** 五条均落入 Task 11/12/13/16/17 测试。
5. **Proportion:** 计划短于实现代码量级；细节以 ticket + api 为准。
6. **Gaps / notes:** （a）ticket 11 `registration.mode`、ticket 13 昵称 ≤20 以需求/数据模型为准并在任务内注明；（b）`updateChildSelf`（孩子自改昵称/偏好）属 family 设计，可在 Task 13 或紧随的小步加入 `PATCH /me`（K）——若本里程碑时间紧，至少留下路由壳与合约，完整 UI 可随学习里程碑，但 API 与审计应在 W3–4 具备（需求已定）；（c）本计划不实现周报/日报（reports 其余部分属后续里程碑）。
