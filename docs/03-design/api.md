# API 概要

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。


## 5. API 概要

### 5.1 约定
- 基础路径 `/api/v1`；JSON（UTF-8）；字段 camelCase；时间用 ISO 8601 UTC，本地日期用 `YYYY-MM-DD`。
- 鉴权：Cookie `xy_sid`（以后客户端可用 `Authorization: Bearer`）；家庭设备接口另需 `xy_device`。
- 所有写请求（含注册、登录等未登录接口）都必须带 `X-Client-Request-Id`：对已登录写请求它是幂等键（[§4.5.1](../01-requirements/nfr.md)），对未登录接口只用于防跨站伪造。服务端只接受同源请求：校验 `Origin`，不开放 CORS；由于自定义请求头会触发预检而预检不被允许，跨站伪造请求无法成功。
- 需要乐观锁的请求体带 `version`。列表接口用游标分页 `?cursor=&limit=`（limit ≤ 50）。
- 所有请求/响应体由 `packages/contracts` 中的 Zod 模式定义，前后端共用；未知字段拒绝。
- 跨家庭的资源（别家的孩子、消息、兑换等）一律返回 `404`，不暴露存在性。

### 5.2 错误格式
```json
{
  "error": {
    "code": "INSUFFICIENT_STARS",
    "message": "星星还不够哦，再闯几关吧！",
    "details": { "available": 12, "required": 30 },
    "traceId": "01JBC9Q3W7…"
  }
}
```
`message` 为可直接展示的中文（孩子端措辞友好）；`details` 可选；`traceId` 与服务端日志对应。

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 请求体/参数不符合模式，缺少请求 ID |
| 401 | `UNAUTHENTICATED` | 未登录或会话失效 |
| 401 | `INVALID_CREDENTIALS` | 邮箱/密码/PIN/TOTP 错误（不区分哪一项） |
| 403 | `FORBIDDEN` | 主体类型无权调用（如孩子调家长接口） |
| 403 | `COURSE_NOT_OPEN` / `LEVEL_LOCKED` | 课程未开放 / 关卡未解锁 |
| 403 | `TIME_LIMIT_REACHED` / `OUTSIDE_ALLOWED_HOURS` | 时长用完 / 不在允许时段（`details.availableAt`） |
| 403 | `CROSS_FAMILY_DISABLED` / `NOT_FRIENDS` / `BLOCKED` | 跨家庭互动前提不满足 |
| 403 | `CHAT_DISABLED_FOR_CHILD` | 家长关闭了该孩子的呀哈哈 |
| 403 | `REGISTRATION_CLOSED` | 注册未开放或注册码无效 |
| 404 | `NOT_FOUND` | 不存在或不属于本家庭 |
| 409 | `VERSION_CONFLICT` | 乐观锁冲突（`details.current` 为最新数据） |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 同一请求 ID 不同请求体 |
| 409 | `CONTENT_STALE` | 提交的题目集合与当前课程包不一致 |
| 409 | `INSUFFICIENT_STARS` / `PRICE_CHANGED` / `ALREADY_OWNED` | 星星不足 / 价格已变（`details.currentPrice`）/ 已拥有 |
| 409 | `ALREADY_DECIDED` / `PENDING_LIMIT` | 审批已处理 / 待审批已达 3 个 |
| 409 | `GIFT_DAILY_LIMIT` / `MESSAGE_DAILY_LIMIT` | 当日赠送 20 颗 / 消息 50 条已满 |
| 409 | `EMAIL_IN_USE` / `USERNAME_IN_USE` / `NICKNAME_IN_USE` | 唯一性冲突 |
| 409 | `LAST_PARENT` | 不能停用最后一个家长 |
| 409 | `CHAT_DUPLICATE_REQUEST` | 聊天请求 ID 重放 |
| 423 | `ACCOUNT_LOCKED` | 登录锁定中（`details.lockedUntil`） |
| 429 | `RATE_LIMITED` / `CHAT_QUOTA_EXCEEDED` | 限流 / 今日聊天次数用完 |
| 500 | `INTERNAL` | 未预期错误 |
| 503 | `AI_DISABLED` / `AI_UNAVAILABLE` | 全站关闭 / LLM 超时或出错（不扣配额：记录为 error/timeout） |

### 5.3 端点（按模块）
P = 家长，K = 孩子，A = 系统管理员，D = 家庭设备 Cookie，公开 = 无需登录。

**family**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| POST /auth/signup | 公开 | 注册码 + 邮箱 + 密码 + 称呼 + 家庭名 + 时区 → 建家庭与家长、登录 |
| POST /auth/login | 公开 | 家长邮箱密码登录 |
| POST /auth/child-login | 公开 | 孩子用户名密码登录 |
| POST /auth/logout | P/K/A | 注销当前会话 |
| POST /auth/password-reset/request · /confirm | 公开 | 找回密码（request 总是 202） |
| POST /auth/verify-email | 公开 | 邮箱验证令牌 |
| POST /auth/invitations/accept | 公开 | 接受家长邀请 |
| GET /me | P/K/A | 当前主体、家庭、孩子卡片 |
| PATCH /me · PUT /me/password | P | 称呼 / 改密码（其他会话失效） |
| GET /device/children | D | 头像墙 |
| POST /device/child-session | D | 头像 + PIN → 孩子会话 |
| GET · PATCH /family | P | 家庭设置（名称、时区；乐观锁） |
| GET /family/parents · POST /family/invitations · POST /family/parents/:id/disable | P | 家长成员与邀请 |
| POST /family/devices · GET /family/devices · DELETE /family/devices/:id | P | 标记/列出/撤销家庭设备 |
| POST /children · PATCH /children/:id · POST /children/:id/archive · POST /children/:id/restore | P | 孩子档案 |
| PUT /children/:id/pin · PUT · DELETE /children/:id/credentials · POST /children/:id/unlock | P | PIN、用户名密码、解除锁定 |
| GET /children/:id/sessions · DELETE /sessions/:id | P | 最近设备与远程下线 |

**content / learning**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /pack | 公开 | 当前课程包版本与静态资源前缀（Service Worker 用） |
| GET /courses | K | 已开放课程及进度摘要 |
| GET /courses/:courseId/map | K | 关卡路线图（锁定/可玩/已通过/星数） |
| GET /levels/:levelId | K | 关卡题目（含答案，供即时反馈）与资源 URL |
| POST /attempts | K | 整批提交闯关 |
| GET /review/summary | K | 今日到期、已复习、剩余额度、是否完成 |
| GET /review/batch | K | 本次复习题（≤ 剩余额度） |
| POST /review/sessions | K | 整批提交复习 |
| GET /me/streak | K | 连续天数 |
| GET /children/:id/progress | P | 孩子各课程进度 |

**stars**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /stars | K | 可用、冻结、最近流水 |
| GET /children/:id/ledger | P | 孩子流水（分页） |
| POST /children/:id/awards | P | 手动奖励 1–50 |
| GET /shop | K | 物品与是否拥有 |
| POST /shop/purchases | K | 购买（`expectedPrice`） |
| GET /me/items · PUT /me/equipment | K | 我的物品 / 穿戴与陪伴宠物 |
| GET /rewards | K | 本家庭可兑换的现实奖励 |
| GET · POST /family/reward-options · PATCH /family/reward-options/:id | P | 奖励清单（乐观锁） |
| POST /redemptions · POST /redemptions/:id/cancel | K | 申请 / 撤回 |
| GET /redemptions?childId=&status= | P | 兑换记录 |
| POST /redemptions/:id/decision | P | 批准或拒绝（`version`） |

**social**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /leaderboard?scope=family\|friends\|all&week= | K/P | 周排行榜 |
| GET /contacts | K | 可发消息/赠送的对象（兄弟姐妹、家长、好友家庭孩子） |
| POST /gifts | K | 赠送星星 |
| GET /conversations · GET /conversations/:peer/messages | K/P | 会话列表与消息（peer = `child:{id}` 或 `parent:{id}`） |
| POST /messages · POST /messages/:id/read | K/P | 发消息 / 已读 |
| POST /messages/:id/report | K/P | 举报 |
| POST /blocks · GET /blocks · DELETE /blocks/:id | K（建）/P | 屏蔽与解除（解除仅家长） |
| GET /children/:id/messages | P | 家长查看孩子全部消息 |
| GET /social/phrases | K | 预设短语与表情白名单 |
| PUT /family/cross-family · POST /family/friend-code/rotate | P | 跨家庭开关（乐观锁）/ 重置好友码 |
| GET · POST /friendships · POST /friendships/:id/decision · POST /friendships/:id/end | P | 好友家庭 |

**chat**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /yahaha/status | K/P | 是否可用、今日剩余 |
| POST /yahaha/chat | K/P | 发送一轮对话（带上下文），返回回复 |

**controls**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| POST /heartbeat | K | 30 秒心跳，返回时间状态 |
| GET /me/time-status | K | 剩余时间、是否锁定、下次可用时间 |
| GET · PUT /children/:id/controls | P | 时长、时段、呀哈哈额度、退出排行（乐观锁） |
| GET /children/:id/courses · PUT · DELETE /children/:id/course-overrides/:courseId | P | 课程开放状态与覆盖（乐观锁） |
| POST /children/:id/time-grants | P | 再玩 15 分钟 |
| GET /approvals | P | 审批收件箱 |

**reports**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /children/:id/reports?from=&to= | P | 每日报告（含今天实时） |
| GET /children/:id/reports/weekly?week= | P | 周汇总 |
| PUT /me/notifications | P | 周报订阅开关 |
| GET · POST /unsubscribe?token= | 公开 | 退订确认页 / 一键退订（RFC 8058） |

**admin**（前缀 `/admin`）

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| POST /admin/login | 公开 | 用户名 + 密码 + TOTP |
| GET /admin/reports?status= · GET /admin/reports/:id | A | 举报队列；详情含被举报消息及两人之间前后各 10 条 |
| POST /admin/reports/:id/resolve | A | `dismiss` / `hide_message` / `disable_cross_family` / `suspend_family` |
| GET /admin/anomalies | A | 对账不一致、发送失败邮件、进程内 5xx 计数、备份状态 |
| GET · PUT /admin/settings | A | `ai.enabled`、`ai.model`、`registration.mode`（乐观锁） |
| POST /admin/signup-codes | A | 签发一次性注册码（14 天有效，仅显示一次；可选填邮箱，同时发送注册邀请邮件） |
| POST /admin/families/:id/suspend · /reactivate | A | 停用/恢复家庭 |
| GET /health | 公开 | `{ok, version, packVersion}`（不含敏感信息） |

### 5.4 权限矩阵
✓ = 允许；本 = 仅限本家庭/本人；— = 不允许。

| 能力 | 家长 | 孩子 | 系统管理员 |
| --- | --- | --- | --- |
| 修改家庭设置、时区、跨家庭开关 | 本 ✓ | — | — |
| 邀请/停用家长 | 本 ✓ | — | — |
| 添加/修改/归档孩子、设 PIN 与密码、解锁 | 本 ✓ | — | — |
| 标记/撤销家庭设备、查看设备与远程下线 | 本 ✓ | — | — |
| 闯关、复习、购买、穿戴、申请兑换、赠送 | — | 本人 ✓ | — |
| 查看孩子进度、流水、报告 | 本 ✓ | 本人（自己的进度与流水） | — |
| 手动奖励星星 | 本 ✓ | — | — |
| 维护奖励清单、审批兑换 | 本 ✓ | — | — |
| 设置时长/时段/呀哈哈额度/课程开放/退出排行、加时 | 本 ✓ | — | — |
| 查看排行榜 | 本 ✓ | ✓（未退出排行且符合范围） | — |
| 家庭内发消息 | 本 ✓ | 本 ✓ | — |
| 跨家庭发预设短语/表情 | — | ✓（满足前提） | — |
| 阅读孩子全部消息 | 本 ✓ | — | 仅被举报消息及上下文 |
| 举报消息 | 本 ✓ | 本人收到的 ✓ | — |
| 屏蔽 / 解除屏蔽 | ✓ / ✓ | ✓ / — | — |
| 发起/审批/解除好友家庭 | 本 ✓ | — | — |
| 使用呀哈哈 | ✓（100 条/天） | ✓（家长设定额度） | — |
| 处理举报、停用家庭 | — | — | ✓ |
| 系统设置（AI 开关、模型、注册模式）、签发注册码 | — | — | ✓ |
| 查看异常与对账 | — | — | ✓ |
| 访问数据库 | — | — | —（只有运维经 SSH 隧道用 migrator 账号） |
