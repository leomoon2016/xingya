# API 概要

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。
> 2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../06-releases/v1.0/changes.md)）：作答改为 plays；新增 companion、discovery、admin/studio 端点与相应错误码；去掉课程包接口。
> 2026-10-21 单元层（[ADR 0016](../adr/0016-unit-layer.md)）：路线图与进度按单元返回；草稿增加单元增删排序接口；AI 生成可只生成一个单元；投放规则范围可指向课程/单元/关卡。
> 2026-10-22 回归老系统与模型可配置（[ADR 0020](../adr/0020-revert-to-old-system.md)–[0022](../adr/0022-llm-vision-image-providers.md)）：新增学习卡、放弃作答、秘密路线、学习足迹、四卡小铺（徽章、累计奖励用掉 / 核销）、家长扣星、伙伴改名 / 互动 / 退订 / 赠送、呀哈哈补发、星星伙伴、信件与信箱、孩子自改昵称与偏好、家长中心学习全览与知识图谱；后台增加模型配置、语音设置、扫码上传、资料 ZIP 与软删除、改密码；删除 `PLAY_EXPIRED` 与注册模式设置。


## 5. API 概要

### 5.1 约定
- 基础路径 `/api/v1`；JSON（UTF-8）；字段 camelCase；时间用 ISO 8601 UTC，本地日期用 `YYYY-MM-DD`。
- 鉴权：Cookie `xy_sid`（以后客户端可用 `Authorization: Bearer`）；家庭设备接口另需 `xy_device`。
- 两个站点（ADR 0015）：主站 `<域名>` 提供孩子、家长与公开接口；`/api/v1/admin/*` **只**在后台域名 `admin.<域名>` 上可用——主站 Nginx 对该前缀返回 404，服务端也按 `Host` 拒绝（返回 404）。后台会话 Cookie `xy_admin_sid` 只发给后台域名（不设 `Domain`、`Secure`、`HttpOnly`、`SameSite=Strict`）；主站的 `xy_sid` 同样不设 `Domain`，两站互不携带。系统管理员主体只能由后台 Cookie 建立。
- 所有写请求（含注册、登录等未登录接口）都必须带 `X-Client-Request-Id`：对已登录写请求它是幂等键（[§4.5.1](../01-requirements/nfr.md)），对未登录接口只用于防跨站伪造。服务端只接受同源请求：校验 `Origin`（主站与后台各自只接受本站源），不开放 CORS；由于自定义请求头会触发预检而预检不被允许，跨站伪造请求无法成功。
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
| 403 | `COURSE_NOT_OPEN` / `LEVEL_LOCKED` | 课程未开放 / 关卡未解锁（含所在单元尚未解锁） |
| 403 | `TIME_LIMIT_REACHED` / `OUTSIDE_ALLOWED_HOURS` | 时长用完 / 不在允许时段（`details.availableAt`） |
| 403 | `CROSS_FAMILY_DISABLED` / `NOT_FRIENDS` / `BLOCKED` | 跨家庭互动前提不满足 |
| 403 | `CHAT_DISABLED_FOR_CHILD` | 家长关闭了该孩子的呀哈哈队长 |
| 403 | `REGISTRATION_CLOSED` | 注册码无效、已用或已过期（注册永久只用邀请码，用户 2026-10-22） |
| 403 | `SIGNUP_CODE_EMAIL_MISMATCH` | 注册码签发时绑定了邮箱，注册用的邮箱与之不符 |
| 403 | `SECRET_ROUTE_LOCKED` | 秘密路线尚未出现（条件未满足）或该单元缺少对应关卡 |
| 400 | `MODEL_NOT_SELECTABLE` | 孩子选择的聊天模型未标“孩子可选”或已停用 |
| 404 | `NOT_FOUND` | 不存在或不属于本家庭 |
| 409 | `VERSION_CONFLICT` | 乐观锁冲突（`details.current` 为最新数据） |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 同一请求 ID 不同请求体 |
| 409 | `PLAY_INCOMPLETE` / `PLAY_FINISHED` | 还有题未作答 / 作答已完成或已放弃（作答不过期，ADR 0020；原 `PLAY_EXPIRED` 删除） |
| 409 | `INSUFFICIENT_FRAGMENTS` / `THRESHOLD_NOT_MET` / `DEN_FULL` / `DEN_MAX` | 碎片不足 / 未达领养门槛 / 营地已满（含赠送时对方营地已满）/ 已达最大扩建次数 |
| 409 | `PET_UNIQUE_TAKEN` / `PET_NOT_REFUNDABLE` / `PET_NOT_GIFTABLE` / `PET_IS_ACTIVE` | 唯一档伙伴全站已有人领养 / 受赠伙伴不能退订（ADR 0020 R4）/ 种类不允许赠送或对方已有同种 / 跟随伙伴不能退订或送出 |
| 409 | `PET_INTERACTED_TODAY` | 今天已经和这只伙伴做过这个互动 |
| 409 | `REWARD_BALANCE_INSUFFICIENT` | 累计奖励余额不足（用掉或核销超过余额） |
| 409 | `DRAFT_CHECK_FAILED` / `DRAFT_NOT_IN_REVIEW` / `DRAFT_OPEN_EXISTS` | 自动检查未通过 / 草稿不在审核中 / 该课程已有未完成草稿 |
| 409 | `AI_BUDGET_EXCEEDED` | 本月 AI 预算不足（`details.scope = global\|agent`、`details.remainingFen`、`details.estimateFen`） |
| 409 | `AGENT_NOT_PUBLISHED` / `SKILL_NOT_ALLOWED` | 角色没有已发布版本或已停用 / 技能未把该角色列入白名单、受众不一致、已停用或固定的版本未发布 |
| 409 | `REVIEW_REQUIRED` | 发布前缺少审核或儿童安全审核（数据库 CHECK 兜底） |
| 400 | `SKILL_IMPORT_REJECTED` | 导入包不合规：超限、路径穿越、符号链接、未知工具名、模式无法编译（`details.errors[]`） |
| 409 | `RULE_INVALID` | 投放规则不合法（`details.errors[]`）；数据库 CHECK 兜底 |
| 400 | `PROMPT_BLOCKED` | 描述命中提示词禁止词表（`details.terms`） |
| 400 | `TEXT_BLOCKED` | 单词本文字命中个人信息过滤（`details.field`；ADR 0019） |
| 409 | `INSUFFICIENT_STARS` / `PRICE_CHANGED` / `ALREADY_OWNED` | 星星不足 / 价格已变（`details.currentPrice`）/ 已拥有 |
| 409 | `INSUFFICIENT_POINTS` | 换星时积分不足 |
| 409 | `WORD_DUPLICATE` / `WORDBOOK_FULL` | 单词本已有这个词（`details.entryId`）/ 已满 2000 条 |
| 409 | `WORD_TASK_ACTIVE` / `WORD_TASK_FINISHED` / `WORD_NO_ELIGIBLE` | 已有进行中的一轮（`details.taskId`）/ 这一轮已结束 / 没有可出题的词（`details.excluded[]`） |
| 409 | `WORD_EXAM_LOCKED` / `WORD_EXAM_AI_RESTRICTED` | 考试中不能编辑或生成解释 / 考试中呀哈哈队长暂不开放（交卷或退出后恢复） |
| 409 | `ALREADY_DECIDED` / `PENDING_LIMIT` | 审批已处理 / 待审批已达 3 个 |
| 409 | `GIFT_DAILY_LIMIT` / `MESSAGE_DAILY_LIMIT` | 当日赠送 20 颗 / 跨家庭消息 50 条已满（家庭内信件不限条数，旧系统） |
| 409 | `EMAIL_IN_USE` / `USERNAME_IN_USE` / `NICKNAME_IN_USE` | 唯一性冲突 |
| 409 | `LAST_PARENT` | 不能停用最后一个家长 |
| 409 | `PROVIDER_LIMIT` / `PROVIDER_IN_USE` | 模型配置已达 20 条 / 该配置是某用途的默认或被角色引用，不能停用 |
| 409 | `CHAT_DUPLICATE_REQUEST` | 聊天请求 ID 重放 |
| 423 | `ACCOUNT_LOCKED` | 登录锁定中（`details.lockedUntil`；孩子 PIN / 密码与家长 5 次，系统管理员 5 次锁 15 分钟） |
| 429 | `RATE_LIMITED` / `CHAT_QUOTA_EXCEEDED` | 限流 / 今日聊天次数用完 |
| 500 | `INTERNAL` | 未预期错误 |
| 503 | `AI_DISABLED` / `AI_UNAVAILABLE` | 全站关闭 / 模型超时或出错（不扣配额：记录为 error/timeout） |
| 503 | `AI_BUDGET_EXHAUSTED` | 呀哈哈队长：全站或角色本月预算用完（孩子端友好提示，不扣配额） |

AI 角色运行的失败原因不是 HTTP 错误，而是写在运行记录 `agent_runs.error` 中的代码：`SKILL_OUTPUT_INVALID`（输出不符合技能输出模式，修正后仍失败）、`RUN_STEP_LIMIT`（达到 20 步上限）、`RUN_TIMEOUT`、`RUN_COST_LIMIT`（累计费用将超过预估）、`TOOL_FAILED`、`GUARD_BLOCKED`（安全检查拦截）、`CANCELLED`。

### 5.3 端点（按模块）
P = 家长，K = 孩子，A = 系统管理员，D = 家庭设备 Cookie，公开 = 无需登录。

**family**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| POST /auth/signup | 公开 | 注册码 + 邮箱 + 密码 + 称呼 + 家庭名 + 时区 → 建家庭与家长、登录；注册码绑定了邮箱时必须一致（否则 `403 SIGNUP_CODE_EMAIL_MISMATCH`） |
| POST /auth/login | 公开 | 家长邮箱密码登录 |
| POST /auth/child-login | 公开 | 孩子用户名密码登录 |
| POST /auth/logout | P/K/A | 注销当前会话 |
| POST /auth/password-reset/request · /confirm | 公开 | 找回密码（request 总是 202） |
| POST /auth/verify-email | 公开 | 邮箱验证令牌 |
| POST /auth/invitations/accept | 公开 | 接受家长邀请 |
| GET /me | P/K/A | 当前主体、家庭、孩子卡片（孩子：昵称、头像、佩戴的徽章、星级荣誉、当前课程、偏好、未读信箱数） |
| PATCH /me · PUT /me/password | P | 称呼 / 改密码（需旧密码，其他会话失效；任务单 17） |
| PATCH /me | K | 孩子“我的设置”：`{nickname?, currentCourseId?, prefSound?, prefReducedMotion?, version}`；昵称规则同家长添加（`409 NICKNAME_IN_USE`、`400 TEXT_BLOCKED`），写审计；课程须对自己开放（`403 COURSE_NOT_OPEN`） |
| GET /device/children | D | 头像墙 |
| POST /device/child-session | D | 头像 + PIN → 孩子会话 |
| GET · PATCH /family | P | 家庭设置（名称、时区；乐观锁；任务单 17，时区从下一个本地日生效） |
| GET /family/parents · POST /family/invitations · POST /family/parents/:id/disable | P | 家长成员与邀请；停用另一位家长（任务单 17；`409 LAST_PARENT`） |
| POST /family/devices · GET /family/devices · DELETE /family/devices/:id | P | 标记/列出/撤销家庭设备 |
| POST /children · PATCH /children/:id · POST /children/:id/archive · POST /children/:id/restore | P | 孩子档案；归档 / 恢复（任务单 17）；`GET /children/:id/audit?kind=nickname` 查看孩子改名记录 |
| PUT /children/:id/pin · PUT · DELETE /children/:id/credentials · POST /children/:id/unlock | P | PIN、用户名密码、解除锁定 |
| GET /children/:id/sessions · DELETE /sessions/:id | P | 最近设备与远程下线 |

**content / learning**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /assets/config | 公开 | 素材 CDN 前缀（Service Worker 用） |
| GET /courses | K | 已开放课程（一册一门）及进度摘要（已完成单元数 / 单元数、已通过关卡数）；顶栏课程下拉用它，当前课程见 `GET /me` |
| GET /courses/:courseId/overview | K | “启思大陆”总览：课程全部单元的地区、状态与星级合计（只读） |
| GET /courses/:courseId/map | K | 课程路线图（按当前版本）：`units[{unitKey, title, state: locked\|open\|completed, levelsPassed, levelCount, levels[{levelId, levelKey, state: locked\|open\|passed, bestStars}]}]`；含“今天还能找 N 个” |
| POST /levels/:levelId/plays | K | 开始闯关作答：返回关卡学习卡（`cards[]`）与题目可见部分（选项已打乱、选项与词块 ID 已换成本次作答的随机令牌）与素材 CDN 地址，不含答案；该关已有未完成作答时返回原作答（作答不过期） |
| POST /plays/:playId/cards/:cardKey/seen | K | 学习卡第一次展示 → `{fragmentsDelta, fragments}`（每次作答每张卡一次，1–3 片，服务端随机）；拓展卡与复习不发 |
| POST /plays/:playId/abandon | K | “重新开始”：放弃未完成作答（状态 abandoned，不结算） |
| GET /units/:courseId/:unitKey/extension-cards | K | 单元拓展卡（附加听读，不计分、不发碎片） |
| GET /units/:courseId/:unitKey/secret-routes | K | 该单元秘密路线：`[{route: coins\|kart\|moon, discovered, entered, passed, entryFee, reward}]` |
| POST /units/:courseId/:unitKey/secret-routes/:route/plays | K | 开始秘密路线作答：第一次扣入场费（`expectedFee`，`409 INSUFFICIENT_STARS`），之后免费；未出现 → `403 SECRET_ROUTE_LOCKED`；答题与完成用 `/plays/:playId/*`，3 题全对才算通过 |
| POST /plays/:playId/answers | K | 提交一题 `{questionId, response}` → `{correct, correctOptionId/answer, explanation, reveal?}`（`reveal` = 答后显示的原文与中文、题目来源）；每题只记第一次；两步作答（先选再“检查”）只在客户端，服务端只收最终提交 |
| POST /plays/:playId/listen | K | 听发音积分 `{target}` → `{awarded, pointsDelta, points}`；每次作答每个目标一次 0.1（ADR 0017）；已结束 → `409 PLAY_FINISHED` |
| POST /plays/:playId/finish | K | 完成：结算星级与星星、隐藏奖励（揭晓结果 `hiddenReward`）、秘密路线奖励、伙伴经验与伙伴附赠积分（复习：答对积分与碎片，不发星星）、复习入队、秘密路线出现、单元首次全 3 星级必得，返回藏匿点（只有编号与位置）；幂等 |
| GET /review/summary | K | 今日到期、已复习、剩余额度、是否完成 |
| POST /review/plays | K | 开始复习作答（≤ 剩余额度）；作答与完成用上面两个 `/plays/:playId/*` 端点 |
| GET /me/streak | K | 连续天数（关卡、复习或完成一轮单词本都算学习日） |
| GET /me/footprint | K | 我的学习足迹：按课程 → 单元 → 关卡的挑战次数与最佳星级（只读） |
| GET /children/:id/progress | P | 孩子各课程、各单元进度（已通过关卡数 / 关卡数、3 星级关卡数、完成日期、全 3 星级日期） |
| GET /children/:id/overview?courseId= | P | 学习全览：每单元每关的挑战次数、最佳星级、最近一次时间（旧系统，ADR 0020） |
| GET /children/:id/knowledge-graph?courseId= | P | 知识图谱：按单元列出义项与句型的掌握情况（已掌握 / 复习中 / 未学） |

**learning · 单词本**（[ADR 0019](../adr/0019-wordbook-as-old-system.md)；全部只限会话孩子本人）

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /wordbook?q=&status=&cursor= | K | 词条列表（最近更新在前，每页 20 条）与学习状态；考试中只返回词形 `{id, word, examLocked: true}` |
| GET /wordbook/summary | K | 词条数、可出题数、各状态数、首次学会数与里程碑进度（x / 5）、待领取里程碑数、两种模式余量（x / 5）、进行中的一轮 |
| POST /wordbook/entries | K | 新增 `{word, meaningZh?, meaningEn?, phrases?, examples?, note?, familiar?, explanationSource?}`（幂等）；重复 → `409 WORD_DUPLICATE`；满 → `409 WORDBOOK_FULL` |
| PATCH /wordbook/entries/:id | K | 修改（带 `version`）；改单词时重新归一化并换词身份 |
| DELETE /wordbook/entries/:id | K | 硬删除词条（带 `version`），词身份保留 |
| POST /wordbook/explain | K | AI 解释预览 `{word}` → `{meaningZh, meaningEn, phrases[], examples[]}`；不写库；计入聊天次数与 AI 预算 |
| POST /wordbook/listen | K | 听发音积分 `{text, source: entry\|task, entryId?, taskId?}` → `{awarded, pointsDelta, points, todayUnits, nextAt?}`；规则见 ADR 0017 |
| POST /wordbook/tasks | K | 开始一轮 `{mode: study\|challenge\|exam, entryIds?(1–50), sound}`（幂等）→ 题目可见部分（不含答案）、`excluded[]` |
| GET /wordbook/tasks/current | K | 进行中的一轮（用于恢复；考试题只含孩子自己的作答，不含对错） |
| POST /wordbook/tasks/:id/answers | K | 作答 `{questionId, value, expectedRevision}`；学习 / 闯关只能答当前题且只记一次，返回对错与解释；考试可答任意题、交卷前可改，只返回已保存 |
| POST /wordbook/tasks/:id/advance | K | 学习 / 闯关：学习卡下一页、进入小测或下一题（当前题已答才可）`{expectedRevision}`；考试不用（可跳题） |
| POST /wordbook/tasks/:id/finish | K | 交卷 / 结算（幂等）→ 得分、每个词的状态、单词星、余量、伙伴附赠积分、藏匿点（`spotId`，在结算页点开） |
| POST /wordbook/tasks/:id/abandon | K | 退出本轮（不发奖励） |
| POST /wordbook/rewards/reconcile | K | 补发待领取的里程碑藏匿点（幂等），返回新放置的藏匿点 |

**stars**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /stars | K | 星星可用与冻结、碎片与积分余额、星级荣誉（太阳、月亮）、最近流水 |
| GET /points | K | 积分余额、今日复习积分（/30）、今日单词本听读积分（/10）、积分流水（分页） |
| POST /points/conversions | K | 换星 `{stars}`（1–1000，10 积分 = 1 星；幂等） |
| GET /children/:id/ledger | P | 孩子流水（分页） |
| POST /children/:id/awards | P | 家长加星 `{amount 1–1000000, note?}`（旧系统；孩子收到信箱通知） |
| POST /children/:id/deductions | P | 家长扣星 `{amount, reason}`（原因必填 ≤ 300 字；不能扣冻结部分，`409 INSUFFICIENT_STARS`；孩子收到带原因的信箱通知） |
| GET /shop | K | 星星小铺四卡的数据：探险徽章（价格、是否拥有、是否佩戴）、喜欢的时光摘要、累计奖励余额、复习积分摘要 |
| POST /shop/purchases | K | 购买探险徽章（`expectedPrice`） |
| GET /me/items · PUT /me/badge | K | 我的徽章 / 佩戴一枚（`{itemId \| null}`） |
| GET /rewards | K | 本家庭可兑换的现实奖励（单位、每份数量、每份星价）与我的累计奖励余额 |
| POST /rewards/:optionId/uses | K | 累计奖励“用掉”`{amount, note?}`（不需审批；`409 REWARD_BALANCE_INSUFFICIENT`） |
| GET /rewards/:optionId/ledger | K | 该奖励的余额流水（入账、用掉、核销） |
| GET · POST /family/reward-options · PATCH /family/reward-options/:id | P | 奖励清单（乐观锁） |
| POST /redemptions · POST /redemptions/:id/cancel | K | 按份申请 `{optionId, portions 1–1000, expectedPrice}` / 撤回 |
| GET /redemptions?childId=&status= | P | 兑换记录 |
| POST /redemptions/:id/decision | P | 批准或拒绝（`version`）；批准时把份数 × 每份数量记入累计奖励 |
| GET /children/:id/reward-balances · POST /children/:id/rewards/:optionId/writeoffs | P | 孩子的累计奖励余额与流水 / 核销 `{amount, reason}`（说明必填） |

**companion**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /companion/species | K | 可领养的伙伴（种子宠物与原创伙伴；档位、两种价格（种类单独定价优先）、是否达门槛、是否已拥有、唯一档是否已被领养） |
| GET /companion/den | K | 我的营地：格数、下一次扩建价格、已领养伙伴（等级、经验、阶段、已解锁动作、素材） |
| POST /companion/adoptions | K | 领养 `{speciesId, payWith: star\|fragment, expectedPrice}` |
| POST /companion/den/expansions | K | 扩建营地 `{expectedPrice}` |
| PUT /companion/active | K | 设为跟随伙伴 `{childPetId}` |
| PUT /companion/pets/:id | K | 改名 `{name 1–12, version}`（过滤个人信息，`400 TEXT_BLOCKED`） |
| POST /companion/pets/:id/interactions | K | 互动 `{action: pet\|feed\|play}` → 亲密度（≤ 100），每种每天一次（`409 PET_INTERACTED_TODAY`）；不发任何货币 |
| POST /companion/pets/:id/refund | K | 退订：按原支付币种返还实付的一半（`409 PET_NOT_REFUNDABLE` / `PET_IS_ACTIVE`） |
| POST /companion/pets/:id/gifts | K | 赠送伙伴 `{toChildId}`（家庭内任意；跨家庭须好友家庭；`409 PET_NOT_GIFTABLE` / `DEN_FULL` / `PET_IS_ACTIVE`） |
| GET /children/:id/companion | P | 家长查看孩子的伙伴 |

**discovery**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /discovery/today | K | 今天还能找几个、未点开的藏匿点、收藏数与上限（顶栏“森林口袋 N / 1000”，分母为收藏上限） |
| POST /discovery/reconcile | K | 补发待领取的单元满星必得藏匿点（幂等） |
| POST /discovery/spots/:spotId/reveal | K | 点开藏匿点；重复点开返回第一次的结果；有款式时附问候音频（自动播放一次） |
| GET /discovery/album | K | 图鉴：`sets[{setId, name, styles[{styleId \| 剪影, count}], foundStyles, totalStyles, completed}]`、合计 `foundStyles / totalStyles`（集齐进度，用户 2026-10-22）、`totalFinds`（累计找到数，与顶栏 N 相同） |
| GET /children/:id/album | P | 家长查看孩子的图鉴 |

**social**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /leaderboard?scope=family\|friends\|all&week= | K/P | 周排行榜 |
| GET /contacts | K | 可发消息/赠送的对象（兄弟姐妹、家长、好友家庭孩子） |
| GET /partners | K | 星星伙伴列表：家庭内孩子显示昵称、头像、年级、跟随伙伴、星级荣誉、收藏数；好友家庭孩子⚠只显示昵称与头像（ADR 0020 R6） |
| POST /gifts | K | 赠送星星 |
| GET /conversations · GET /conversations/:peer/messages | K/P | 会话列表与消息（peer = `child:{id}` 或 `parent:{id}`） |
| POST /messages · POST /messages/:id/read | K/P | 发消息（家庭内可写信件 `{subject ≤ 60, body ≤ 500}`，过滤个人信息；跨家庭只能短语 / 表情）/ 已读 |
| GET /inbox · POST /inbox/notifications/:id/read | K/P | 信箱：信件与系统通知（兑换、核销、加减星、伙伴赠送与退订、营地扩建），未读数 / 标记已读 |
| POST /messages/:id/report | K/P | 举报 |
| POST /blocks · GET /blocks · DELETE /blocks/:id | K（建）/P | 屏蔽与解除（解除仅家长） |
| GET /children/:id/messages | P | 家长查看孩子全部消息 |
| GET /social/phrases | K | 预设短语与表情白名单 |
| PUT /family/cross-family · POST /family/friend-code/rotate | P | 跨家庭开关（乐观锁）/ 重置好友码 |
| GET · POST /friendships · POST /friendships/:id/decision · POST /friendships/:id/end | P | 好友家庭 |

**chat**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| GET /yahaha/status | K/P | 是否可用、今日剩余、可选模型（`childSelectable` 的聊天模型）与当前选择 |
| PUT /yahaha/model | K | 切换聊天模型 `{providerId}`（`400 MODEL_NOT_SELECTABLE`；家长可在管控里关闭切换） |
| POST /yahaha/chat | K/P | 发送一轮对话（带上下文），返回回复 |

**controls**

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| POST /heartbeat | K | 30 秒心跳，返回时间状态 |
| GET /me/time-status | K | 剩余时间、是否锁定、下次可用时间 |
| GET · PUT /children/:id/controls | P | 时长、时段、呀哈哈队长额度、退出排行（乐观锁） |
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

**admin/studio**（前缀 `/admin/studio`，仅系统管理员 A；所有入队接口先返回预估费用，带 `confirmEstimateFen` 再次提交才入队）

| 方法 路径 | 说明 |
| --- | --- |
| GET /admin/studio/jobs · GET /admin/studio/jobs/:id · POST /admin/studio/jobs/:id/cancel | 任务列表、详情、取消排队中任务 |
| GET · PUT /admin/studio/budget/:month | 本月上限、预留、已花费（乐观锁） |
| POST /admin/studio/estimate | 预估费用 `{kind, params}`；课程生成返回按单元的明细 `{fen, breakdown, units[{unitKey, fen}]}` |
| GET /admin/studio/assets · GET /admin/studio/assets/:id/url | 素材库、10 分钟签名 URL |
| POST /admin/studio/materials · POST /admin/studio/materials/:id/extract | 申请直传 OSS 的上传地址 / 抽取文本（照片与扫描页由视觉模型识字，先预估按页费用） |
| DELETE /admin/studio/materials/:id · POST /admin/studio/materials/:id/restore · GET /admin/studio/materials/:id/zip | 软删除 / 恢复 / 打包下载原件与抽取文本（ZIP，旧系统） |
| POST /admin/studio/material-links · GET /admin/studio/material-links · POST /admin/studio/material-links/:id/revoke | 扫码上传链接（≤ 72 小时，返回二维码与一次性令牌，只显示一次）/ 列表 / 作废 |
| POST /upload-links/:token/files | 公开（凭令牌，只在后台域名上提供，不需登录）：手机扫码页上传资料（同样 ≤ 20 MB、类型白名单；令牌过期或作废 → 404） |
| GET · POST /admin/studio/words · POST /admin/studio/senses/:id/retire · PUT /admin/studio/words/:id/audio · PUT /admin/studio/senses/:id/image | 词库 |
| GET · POST /admin/studio/courses · POST /admin/studio/courses/:id/drafts | 课程列表、建课程、基于当前版本开草稿 |
| GET · PATCH /admin/studio/drafts/:id | 草稿（表单数据 + 检查结果，乐观锁） |
| POST /admin/studio/drafts/:id/units · PATCH · DELETE /admin/studio/drafts/:id/units/:unitKey · PUT /admin/studio/drafts/:id/units/order | 草稿内单元：新增（位置、`unitKey`、标题）/ 改标题与封面 / 删除（已发布过的需确认）/ 调整顺序（均带草稿 `version`） |
| POST /admin/studio/drafts/:id/analyze · /generate | AI 分析资料 / 按模板生成，请求体 `{scope: "course"\|"unit", unitKey?, position?, materialIds[]}`：`course` = 整门课程（先确认单元列表，按单元逐个生成），`unit` = 生成一个单元加入本草稿（= 课程设计师的角色任务，返回 `runId`；先返回按单元的预估费用） |
| POST /admin/studio/drafts/:id/units/:unitKey/levels/:levelKey/questions/:questionKey/rewrite | 让 AI 重写一题（返回 `runId`） |
| GET /admin/studio/drafts/:id/preview/:unitKey/:levelKey | 孩子视角试玩（不记录） |
| POST /admin/studio/drafts/:id/submit · /return · /publish | 提交审核 / 退回 / 发布（入队 publish_audio） |
| GET /admin/studio/courses/:id/versions | 版本历史 |
| GET /admin/studio/templates | 模板列表（只读，来自仓库） |
| GET · PATCH /admin/studio/pet-tiers · PUT /admin/studio/pet-tiers/:id/stages | 档位与阶段 |
| GET · POST /admin/studio/pets · POST /admin/studio/pets/:id/candidates · /base · /stage-art · /motions · /voice · /submit · /review · /publish · /unlist | 伙伴设计流程 |
| GET · POST /admin/studio/yahaha/sets · GET · POST /admin/studio/yahaha/styles · 同上设计流程 · PATCH /admin/studio/yahaha/styles/:id | 款式与套组 |
| GET · PUT /admin/studio/yahaha/settings | 全局开关、概率、每日上限、稀有度权重、里程碑奖励（乐观锁） |
| GET /admin/studio/yahaha/stats | 统计 |
| POST /admin/studio/rules/parse | 一句话 → 规则结构（= 活动策划的角色任务 `drop-rule-fill`，结果是 RuleSpec 草稿） |
| POST /admin/studio/rules/validate | 校验 + 大白话复述 + 影响估算 + 重叠列表 |
| GET · POST /admin/studio/rules · PATCH /admin/studio/rules/:id · POST /admin/studio/rules/:id/publish · /pause · /resume | 规则 CRUD 与生命周期（审计） |
| GET · POST /admin/studio/shop-items · PATCH /admin/studio/shop-items/:id | 探险徽章 |
| GET · POST /admin/studio/ai-providers · PATCH /admin/studio/ai-providers/:id · POST /admin/studio/ai-providers/:id/test · PUT /admin/studio/ai-providers/defaults | 模型配置（≤ 20 条，ADR 0022）：Key 只写不读（响应只含末 4 位）；测试连接；每种用途设默认（乐观锁） |
| GET · PUT /admin/studio/voice · POST /admin/studio/voice/preview | 语音设置（中 / 英 Piper 参数与命名预设，乐观锁）/ 试听一句（入队 TTS 任务） |
| PATCH /admin/studio/pet-species/:id | 种类单独定价、是否可赠送、唯一档、上下架（种子宠物与原创伙伴都适用） |

**admin/studio · 技能与角色**（第 10 部分；前缀 `/admin/studio`，仅系统管理员 A，需 TOTP 会话；见 [Skill 与 AI 角色 · 模块设计](modules/agents.md)。所有运行类接口先返回预估费用，带 `confirmEstimateFen` 再次提交才开始；AI 只写草稿，发布仍走各业务的审核发布接口）

| 方法 路径 | 说明 |
| --- | --- |
| GET · POST /admin/studio/skills | 技能列表（含近 30 天调用、成功率、平均费用与耗时）/ 新建（产生 v1 草稿） |
| POST /admin/studio/skills/import · GET /admin/studio/skill-versions/:id/export | 导入 SKILL.md 文件夹 ZIP（结果为草稿 + 导入报告；脚本只作惰性文本）/ 导出 ZIP |
| GET /admin/studio/skills/:id · GET /admin/studio/skills/:id/versions · GET /admin/studio/skill-versions/:id · GET /admin/studio/skill-versions/:a/diff/:b | 详情、版本历史、版本内容、两版本对比 |
| POST /admin/studio/skills/:id/versions | 保存为新版本（`baseVersionId`；每次编辑 = 新版本） |
| POST /admin/studio/skill-versions/:id/submit · /review · /safety-review · /publish · /retire | 提交审核 / 审核 / 儿童安全审核（面向孩子或家长的技能必需，附清单与安全测试集结果）/ 发布 / 退役 |
| POST /admin/studio/skills/:id/rollback | 当前版本指回较早的已发布版本 `{toVersionId}` |
| PUT /admin/studio/skills/:id/status | 启用 / 停用（系统技能不能停用；乐观锁） |
| GET · POST /admin/studio/skills/:id/allowed-agents · DELETE /admin/studio/skills/:id/allowed-agents/:agentId | 技能侧角色白名单：列出 / 加入 / 撤销（撤销 = 记 `revoked_at`） |
| POST /admin/studio/skill-versions/:id/test | 试运行台：样例输入 → 输出、校验结果、步骤、费用、耗时（`kind = test`，计入预算） |
| GET /admin/studio/skills/:id/stats?from=&to= | 使用统计 |
| GET · POST /admin/studio/agents · GET /admin/studio/agents/:id · GET /admin/studio/agents/:id/versions | 角色列表 / 新建 / 详情 / 版本历史 |
| POST /admin/studio/agents/:id/versions | 保存角色新版本：名称、头像、说明、工具、模型、月度预算、技能挂载 `[{skillId, pinnedVersionId 或 null, priority, overrides}]` |
| POST /admin/studio/agent-versions/:id/review · /safety-review · /publish · POST /admin/studio/agents/:id/rollback | 审核 / 儿童安全审核（儿童角色）/ 发布 / 回滚 |
| PUT /admin/studio/agents/:id/status · GET /admin/studio/agents/:id/budget/:month | 启用 / 停用；角色当月预算（上限、预留、已花费） |
| POST /admin/studio/runs | 一句话任务 `{page, instruction, agentKey?, input}`（`@角色` 在 instruction 中解析；多个 `@` = 流水线）；第一次返回 `{agent 或 plan, estimateFen}`，带 `confirmEstimateFen` 才开始 |
| POST /admin/studio/pipelines | 按模板或自定义 `plan`（2–6 步）开始流水线（同样先预估） |
| GET /admin/studio/runs?agent=&page=&status= · GET /admin/studio/runs/:id | 任务历史；详情含每一步（流水线含各步进度、费用、耗时） |
| POST /admin/studio/runs/:id/cancel · /clone · /retry-step | 取消 / 克隆并重跑（可改 instruction 与参数，重新预估）/ 从失败步重试 |
| GET · POST /admin/studio/quick-tasks · PATCH · DELETE /admin/studio/quick-tasks/:id · POST /admin/studio/quick-tasks/:id/run | 快捷任务（DELETE = 归档）；运行同样先预估 |
| GET /admin/studio/tools | 内置工具目录（只读：名称、受众、只读/写草稿/生成、注册模块） |

**admin**（前缀 `/admin`；只在后台域名可用，见 §5.1）

| 方法 路径 | 主体 | 说明 |
| --- | --- | --- |
| POST /admin/login | 公开 | 用户名 + 密码 + TOTP；连续 5 次失败锁 15 分钟（`423 ACCOUNT_LOCKED`） |
| PUT /admin/me/password | A | 改密码（需旧密码与当前 TOTP；其他后台会话失效）；TOTP 丢失只能用运维命令 `xingya admin:reset-totp` |
| GET /admin/reports?status= · GET /admin/reports/:id | A | 举报队列；详情含被举报消息及两人之间前后各 10 条 |
| POST /admin/reports/:id/resolve | A | `dismiss` / `hide_message` / `disable_cross_family` / `suspend_family` |
| GET /admin/anomalies | A | 对账不一致（星星、碎片、款式放置数）、发送失败邮件、进程内 5xx 计数、AI 任务失败、预算 ≥ 80%（全站与各角色）、备份状态 |
| GET · PUT /admin/settings | A | 系统设置（`ai.*`、`companion.*`（含 `unlock_stars`）、`discovery.*`（含 `collection_cap`、`unit_milestone`）、`studio.*`、`content.allow_self_review`、`agents.limits`、`agents.page_defaults` 等，乐观锁；键白名单见 [数据模型](data-model.md)；没有注册模式与作答有效期设置） |
| GET · PUT /admin/wordbook/random | A | 单词本随机呀哈哈 `{enabled, probabilityBps 0–10000, dailyLimit 0–100, reason, expectedVersion}`；必须填写原因，写审计日志（ADR 0019） |
| POST /admin/signup-codes | A | 签发一次性注册码（14 天有效，仅显示一次；可选填邮箱：填了即绑定该邮箱，并发送注册邀请邮件） |
| POST /admin/families/:id/suspend · /reactivate | A | 停用/恢复家庭 |
| GET /health | 公开 | `{ok, version}`（不含敏感信息） |

### 5.4 权限矩阵
✓ = 允许；本 = 仅限本家庭/本人；— = 不允许。

| 能力 | 家长 | 孩子 | 系统管理员 |
| --- | --- | --- | --- |
| 修改家庭设置、时区、跨家庭开关 | 本 ✓ | — | — |
| 邀请/停用家长 | 本 ✓ | — | — |
| 添加/修改/归档孩子、设 PIN 与密码、解锁 | 本 ✓ | — | — |
| 标记/撤销家庭设备、查看设备与远程下线 | 本 ✓ | — | — |
| 闯关（含学习卡、秘密路线）、复习、单词本（词条、学习 / 闯关 / 考试、AI 解释）、听发音积分、换星、点开藏匿点、领养伙伴、扩建营地、购买与佩戴徽章、申请兑换、赠送 | — | 本人 ✓ | — |
| 查看孩子进度、流水、报告、伙伴、图鉴 | 本 ✓ | 本人（自己的进度、流水、伙伴、图鉴） | — |
| 查看单词本词条 | —（与旧系统一致；流水与图鉴里能看到单词本的结果） | 本人 ✓ | — |
| 加星、扣星（扣星必须写原因） | 本 ✓ | — | —（⚠ 旧系统管理员可改，ADR 0020 R9） |
| 核销累计奖励 / 用掉累计奖励 | 本 ✓ / — | — / 本人 ✓ | — |
| 改自己的昵称、当前课程、偏好 | — | 本人 ✓ | — |
| 伙伴改名、互动、退订、赠送 | — | 本人 ✓ | — |
| 查看学习全览、知识图谱、孩子改名记录 | 本 ✓ | — | — |
| 信箱（信件与系统通知） | 本人 ✓ | 本人 ✓ | — |
| 维护奖励清单、审批兑换 | 本 ✓ | — | — |
| 设置时长/时段/呀哈哈队长额度/课程开放/退出排行、加时 | 本 ✓ | — | — |
| 查看排行榜 | 本 ✓ | ✓（未退出排行且符合范围） | — |
| 家庭内发消息 | 本 ✓ | 本 ✓ | — |
| 跨家庭发预设短语/表情 | — | ✓（满足前提） | — |
| 阅读孩子全部消息 | 本 ✓ | — | 仅被举报消息及上下文 |
| 举报消息 | 本 ✓ | 本人收到的 ✓ | — |
| 屏蔽 / 解除屏蔽 | ✓ / ✓ | ✓ / — | — |
| 发起/审批/解除好友家庭 | 本 ✓ | — | — |
| 使用呀哈哈队长 | ✓（100 条/天） | ✓（家长设定额度） | — |
| 处理举报、停用家庭 | — | — | ✓ |
| 系统设置（AI 开关、伙伴/发现/工作室参数）、模型配置、语音设置、签发注册码、改自己的密码 | — | — | ✓ |
| AI 工作室：词库、课程草稿/审核/发布、伙伴与款式设计、投放规则、预算、素材 | — | — | ✓（TOTP） |
| 技能库、AI 角色、任务历史、流水线、快捷任务、一句话框（AI 只写草稿，发布须本人确认） | — | — | ✓（TOTP） |
| 运营分析师：全站聚合统计（分组 < 5 个孩子不显示） | — | — | ✓（只读聚合，不含任何单个家庭或孩子） |
| 呀哈哈队长读取“已学的词” | — | 本人（只读，经工具，无参数） | — |
| 读取题目答案与解析 | — | 只在作答后由服务端返回该题的 | ✓（工作室） |
| 查看异常与对账 | — | — | ✓ |
| 访问数据库 | — | — | —（只有运维经 SSH 隧道用 migrator 账号） |
