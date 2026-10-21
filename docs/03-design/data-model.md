# 数据模型

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。


## 6. 数据模型

完整 DDL 见 `db/migrations/0001_init.sql`（表）与 `db/roles.sql`（角色与授权），二者由原 `schema-draft.sql` 拆分（36 张表 = 业务 33 + 平台 3；61 个外键、74 个 CHECK、25 个非主键唯一键、9 个生成列）。全部 InnoDB / utf8mb4；时间 UTC；外键一律 RESTRICT；孩子与家长只停用/归档不硬删。

### 6.1 表清单
| 模块 | 表 | 用途 | 关键列 / 约束 |
| --- | --- | --- | --- |
| family | families | 家庭（租户根） | time_zone、cross_family_enabled（默认 0）、friend_code（唯一，开启时必填）、status、version |
| | parents | 家长 | email（小写、全站唯一）、password_hash、email_verified_at、weekly_report_enabled、失败计数/锁定、`UNIQUE(family_id,id)` 供复合外键 |
| | children | 孩子档案 | nickname（家庭内唯一）、avatar_key、grade 1–6、pin_hash、username/password_hash（同时有或同时无）、失败计数/锁定、status |
| | admin_accounts | 系统管理员 | username、password_hash、totp_secret_enc |
| | family_devices | 家庭设备 | token_hash（唯一）、label、expires_at、revoked_at |
| | sessions | 会话 | token_hash、principal 与 parent/child/admin 互斥 CHECK、PIN 登录必须有家庭设备、expires_at、revoked_reason |
| | auth_tokens | 一次性令牌 | purpose（verify_email / reset_password / invite_parent / family_signup）按用途约束字段形状 |
| | audit_events | 审计（只追加） | actor、action、target、detail JSON |
| content | courses | 课程 | 稳定 id、subject（VARCHAR，正则约束）、grade、sort_order、instruction_lang、retired、pack_version |
| | levels | 关卡 | course_id、seq、retired |
| | words | 词 | 稳定 id（`en.apple`）、text、meaning_zh、image_path、audio_path、retired |
| | questions | 题目 | level_id、seq 1–8、type、word_id、scored（`read_aloud`=0 由 CHECK 保证）、payload JSON |
| | shop_items | 商店物品 | kind（outfit/pet）与 slot 一致、price 1–1000、retired |
| learning | level_progress | 每孩子每关最佳成绩 | PK(child_id, level_id)、best_stars 0–3、first_passed_at 与星数一致 |
| | attempts | 闯关记录（只追加） | `UNIQUE(child_id, client_request_id)`、scored_count 4–8、生成列 accuracy_pct/stars/passed、stars_awarded、answers JSON、activity_date |
| | review_items | 间隔复习条目 | item_type 与 word_id/question_id 互斥、生成列 ref_id、`UNIQUE(child_id,item_type,ref_id)`、box 1–6、due_date |
| | review_sessions | 复习提交（只追加） | `UNIQUE(child_id, client_request_id)`、item_count ≤ 20、生成列 completion_date + 唯一键（每天最多完成一次） |
| stars | star_ledger | 星星流水（只追加） | kind、delta（按 kind 约束正负与范围）、balance_after ≥ 0、`UNIQUE(child_id, source_key)`、local_date、生成列 counts_for_leaderboard |
| | star_balances | 余额缓存 + 行锁 | balance ≥ 0、last_ledger_id |
| | child_items | 已拥有物品 | `UNIQUE(child_id,item_id)`、生成列 equipped_slot + `UNIQUE(child_id,equipped_slot)` |
| | reward_options | 家长定义的现实奖励 | star_price 1–2000、active、version |
| | redemptions | 兑换申请 | 标题/价格快照、status 与决定字段一致、复合外键保证奖励属于同一家庭 |
| social | family_friendships | 好友家庭 | low<high、生成列 live_key + 唯一键（每对家庭最多一条进行中/有效）、状态字段一致 |
| | gifts | 赠送（只追加） | amount 1–20、不能送自己、跨家庭必须关联好友关系、sender_date |
| | messages | 消息 | 发送方/接收方各恰好一个、kind 与内容一致、跨家庭只能 phrase/emoji 且只能孩子↔孩子、hidden_at |
| | blocks | 屏蔽 | blocker 为孩子或整个家庭（生成列 blocker_key）、唯一 |
| | abuse_reports | 举报 | 每家庭对同一消息只举报一次、处理状态一致 |
| chat | ai_chat_usage | 聊天元数据（90 天） | `UNIQUE(family_id, client_request_id)`、status、filter_category（过滤命中时必填）、不含文本 |
| controls | child_controls | 每孩子管控设置 | daily_minutes 10–300、allowed_start<allowed_end、ai_daily_limit 0–100、leaderboard_opt_out、version |
| | course_overrides | 课程开放覆盖 | PK(child_id, course_id)、mode open/closed |
| | usage_days | 每孩子每日用时 | used_seconds、bonus_minutes（15 的倍数 ≤120）、window_extended_until、last_heartbeat_at |
| reports | daily_reports | 每日汇总 | PK(child_id, report_date)、各项计数、top_missed JSON |
| | email_outbox | 邮件发件箱 | `UNIQUE(dedupe_key)`、status、attempts ≤ 10、发送后清空正文 |
| platform | system_settings | 系统设置 | 键白名单 CHECK、version |
| | idempotency_requests | 请求幂等 | `UNIQUE(actor_type, actor_id, client_request_id)`、request_hash、只存 2xx |
| | schema_migrations | 迁移记账 | version、checksum |

### 6.2 租户隔离
- 每个业务表都有 `family_id`；涉及孩子/家长的外键都是 `(family_id, child_id) → children(family_id, id)` 形式的复合外键，数据库层面保证一行不可能“挂”到别的家庭的孩子上（已实测）。
- 每个 repo 函数的第一个参数是 `familyId`（来自已鉴权主体，绝不来自请求体），查询必带该条件。集成测试按路由表自动生成“用 B 家庭会话访问 A 家庭资源 → 404”用例。

### 6.3 数据库账号
| 账号 | 角色 | 权限 | 用途 |
| --- | --- | --- | --- |
| `xingya_app@localhost` | xingya_app_role | 按表最小授权：内容表只读；只追加表 SELECT+INSERT；会话/令牌/幂等/AI 元数据/发件箱/课程覆盖/屏蔽可删；其余 SELECT+INSERT+UPDATE | 服务进程（Unix socket） |
| `xingya_migrator@localhost` | xingya_migrator_role | `ALL ON xingya.*`（无 GRANT OPTION） | 部署时迁移、内容导入、运维脚本（经 SSH） |
| root | — | 全部 | 仅服务器本机 socket 认证，用于初始化与授权 |

- 账号创建时 `ACCOUNT LOCK` 且无口令；服务器引导脚本从 `/etc/xingya/secrets.env` 读取口令执行 `ALTER USER … IDENTIFIED BY … ACCOUNT UNLOCK`。仓库中没有任何口令。
- MySQL 配置：`bind-address=127.0.0.1`、`mysqlx=OFF`、`skip-name-resolve`、`local_infile=OFF`；安全组不开放 3306。运维访问：`ssh -L 3307:/run/mysqld/mysqld.sock xingya-ecs`，在本机连 `127.0.0.1:3307`，落到服务器上即为 socket 连接（匹配 `@localhost`）。

### 6.4 数据保留与删除
| 数据 | 保留 |
| --- | --- |
| AI 聊天元数据 | 90 天 |
| 幂等记录 | 30 天 |
| 会话、令牌 | 过期后 7 天内清理 |
| 邮件正文 | 发送成功即清空；邮件行 180 天 |
| 学习、星星、消息、报告 | 家庭存续期间保留 |
| 备份 | 本地与 OSS 各 14 天 |
| 家庭注销 | 家长发邮件申请 → 系统管理员核实身份 → 运维用 migrator 账号执行 `delete-family` 脚本删除该家庭全部行（含只追加表）→ 14 天后随备份轮换彻底消失；承诺 15 个工作日内完成 |

## 附录 A：数据库结构验证结果

- 环境：本机临时 MySQL 8.4.6（官方 minimal 二进制，独立数据目录与 socket，仅绑定 127.0.0.1），验证脚本 `db/verify/verify.mjs`（Node + mysql2，root 经 socket 连接），完成后删除库、账号并停止实例。
- 拆分为 `0001_init.sql` + `roles.sql` 后按顺序重新执行同一验证：仍为 73 项全部通过，结构指纹与拆分前一致（`9f43c113c81c`）。
- 结果：**73 项全部通过**（完整输出见 `db/verify/result.txt`），要点：
  - 从空库应用两次，结构指纹（列、约束、CHECK、索引、外键、表级授权）完全一致；表 36、外键 61、CHECK 74、非主键唯一键 25、生成列 9。
  - 账号：只有 `xingya_app@localhost`、`xingya_migrator@localhost`（角色为锁定账号）；migrator 可导入内容、可执行 DDL。
  - 应用账号：`UPDATE`/`DELETE star_ledger` 被拒（ER_TABLEACCESS_DENIED_ERROR），`UPDATE attempts`、`DELETE gifts`、`DELETE audit_events`、写内容表、`DROP TABLE`、`CREATE USER`、新增系统设置键均被拒；可切换 AI 开关。
  - CHECK：余额不可为负、通关单次 ≤3 星、赠送单笔 ≤20、支出必须为负、家长奖励必须记录家长、read_aloud 不计分、词 ID 格式、邮箱小写、孩子用户名与密码成对、开启跨家庭须有好友码、PIN 登录必须在家庭设备、复习盒 1–6、计分题 ≥4、加时 15 分钟倍数、时段 start<end、跨家庭不能发自由文本、跨家庭赠送必须关联好友关系、不能送给自己、兑换批准必须记录家长、过滤命中必须记类别、请求 ID 为 UUID。
  - 生成列：4/5→80%、1 星、通过；7/8→87%、1 星；3/4→75% 未通过；5/5→3 星。
  - 唯一/幂等：同一请求 ID 的闯关只记一次；同一 `source_key` 只入账一次；每天最多一次“复习完成”；同一物品只买一次；同一槽位只穿一件；同一对家庭只有一条进行中好友请求（拒绝后可重新申请）；幂等表、聊天请求 ID、周报去重键、举报与屏蔽去重。
  - 复合外键：会话/流水/消息/兑换不能引用其他家庭的孩子、家长或奖励项。
