# 数据模型

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。
> 2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../06-releases/v1.0/changes.md)）：`0001_init.sql` 尚未部署到任何环境，因此**直接修订**（不追加 0002），由 36 张表变为 55 张。

## 6. 数据模型

完整 DDL 见 `db/migrations/0001_init.sql`（表）与 `db/roles.sql`（角色与授权）。共 55 张表（业务 52 + 平台 3）；108 个外键、133 个 CHECK、54 个非主键唯一键、12 个生成列。全部 InnoDB / utf8mb4；时间 UTC；外键一律 RESTRICT；孩子与家长只停用/归档不硬删。

### 6.1 表清单（55 张）
| 模块 | 表 | 用途 | 关键列 / 约束 |
| --- | --- | --- | --- |
| family（8） | families | 家庭（租户根） | time_zone、cross_family_enabled（默认 0）、friend_code（唯一，开启时必填）、status、version |
| | parents | 家长 | email（小写、全站唯一）、password_hash、email_verified_at、weekly_report_enabled、失败计数/锁定、`UNIQUE(family_id,id)` 供复合外键 |
| | children | 孩子档案 | nickname（家庭内唯一）、avatar_key、grade 1–6、pin_hash、username/password_hash（同时有或同时无）、失败计数/锁定、status |
| | admin_accounts | 系统管理员 | username、password_hash、totp_secret_enc |
| | family_devices | 家庭设备 | token_hash（唯一）、label、expires_at、revoked_at |
| | sessions | 会话 | token_hash、principal 与 parent/child/admin 互斥 CHECK、PIN 登录必须有家庭设备、expires_at、revoked_reason |
| | auth_tokens | 一次性令牌 | purpose（verify_email / reset_password / invite_parent / family_signup）按用途约束字段形状 |
| | audit_events | 审计（只追加） | actor、action、target（含 `drop_rule`、`course_draft`、`pet_species`、`yahaha_style`、`setting`）、detail JSON |
| studio（4） | ai_jobs | 后台任务队列 | kind、status、`running_slot` 1/2 唯一（最多 2 并发）、生成列 `local_slot` 唯一（本机进程最多 1 个）、estimated/actual 费用（实际 ≤ 预估）、budget_month、attempts ≤ 3、heartbeat_at |
| | ai_budget_months | 月度 AI 预算 | PK budget_month、cap/reserved/spent（`reserved + spent ≤ cap`）、version |
| | assets | 素材库 | kind（image/animation/audio）、visibility（draft/public）、oss_key 唯一（内容哈希）、bytes 上限按 kind、source、AI 图像必须有 prompt |
| | materials | 课程资料 | kind（pdf/docx/pptx/image/text）、oss_key、bytes ≤ 20 MB、extraction_status 与 extracted_text 一致 |
| content（8） | words | 共享词库：词 | 稳定 id（`en.apple`，正则）、`UNIQUE(subject,text)`（区分大小写）、audio_asset_id、status draft/active/retired |
| | word_senses | 义项 | 稳定 id（`en.bat.animal`，必须以词 ID 为前缀）、meaning_zh（不可改）、image_asset_id、status |
| | courses | 课程身份 | 稳定 id、subject、grade、sort_order（同学科同年级唯一）、template_id、current_version_id（复合外键：必须是本课程的版本）、status active/retired |
| | course_versions | 已发布版本（只追加） | `UNIQUE(course_id, version_no)`、`UNIQUE(draft_id)`、template_id/version、title、instruction_lang、published_by |
| | course_drafts | 草稿 | status draft/in_review/publishing/published/discarded、生成列 open_key + `UNIQUE(course_id, open_key)`（每课最多一份未完成草稿）、document JSON、check_report、非草稿必须 check_passed、发布前必须有审核人、published ↔ published_version_id |
| | levels | 关卡（只追加） | course_version_id、level_key（跨版本稳定）、seq、scene_asset_id、pages（绘本）、hiding_spots（恰好 3 个藏匿点定义） |
| | questions | 题目可见部分（只追加） | level_id、question_key、seq 1–8、type、scored（`read_aloud`=0）、sense_id、visible JSON（CHECK 拒绝答案字段） |
| | question_answers | 题目答案部分（只追加） | PK question_id、answer JSON、explanation |
| learning（5） | plays | 作答 | kind level/review、course_version_id + level_id（复合外键：关卡属于该版本）、`UNIQUE(child_id, client_request_id)`、items（下发题目与选项顺序）、responses（每题第一次作答）、status、expires_at |
| | level_progress | 最佳成绩 | PK(child_id, course_id, level_key)、best_stars 0–3、first_passed_at 与星数一致 |
| | attempts | 闯关记录（只追加） | `UNIQUE(play_id)`、course_version_id + level_id、scored_count 4–8、生成列 accuracy_pct/stars/passed、stars_awarded、answers JSON、activity_date |
| | review_items | 间隔复习条目 | item_type sense/question 与 sense_id/question_id 互斥、生成列 ref_id、`UNIQUE(child_id,item_type,ref_id)`、box 1–6、due_date |
| | review_sessions | 复习结算（只追加） | `UNIQUE(play_id)`、item_count ≤ 20、生成列 completion_date + 唯一键（每天最多完成一次） |
| stars（6） | ledger | 账本（只追加，星星 + 碎片） | currency、kind（按币种限定，CHECK）、delta（按 kind 约束正负与范围）、balance_after ≥ 0、`UNIQUE(child_id, currency, source_key)`、生成列 counts_for_leaderboard（= 学习星） |
| | balances | 余额缓存 + 行锁 | PK(child_id, currency)、balance ≥ 0、last_ledger_id |
| | shop_items | 装扮 | slot head/body/accessory、price 1–1000、image_asset_id、status draft/listed/unlisted、version |
| | child_items | 已拥有装扮 | `UNIQUE(child_id,item_id)`、生成列 equipped_slot + `UNIQUE(child_id,equipped_slot)` |
| | reward_options | 家长定义的现实奖励 | star_price 1–2000、active、version |
| | redemptions | 兑换申请 | 标题/价格快照、status 与决定字段一致、复合外键保证奖励属于同一家庭 |
| companion（5） | pet_tiers | 伙伴档位 | star_price 1–5000、fragment_price 1–20000、adoption_threshold、max_level、xp_base/xp_step、version |
| | pet_tier_stages | 成长阶段 | PK(tier_id, stage_no 1–4)、name、min_level（第 1 阶段必须为 1）、unlocked_actions JSON 数组 |
| | pet_species | 伙伴种类 | species_key、name 唯一、tier_id、status draft/in_review/published/unlisted（上架必须有审核人与时间）、design JSON、voice_id、voice_pitch 0.5–2.0 |
| | pet_dens | 营地 | PK child_id、extra_slots ≤ 10、version |
| | child_pets | 已领养伙伴（无 DELETE） | `UNIQUE(child_id, species_id)`、生成列 companion_key + 唯一（每人 1 只陪伴）、level/xp/total_xp、adopted_with、price_paid、adopt_ledger_id 唯一 |
| discovery（5） | yahaha_sets | 图鉴套组 | name 唯一、bonus_stars 1–50、status |
| | yahaha_styles | 呀哈哈家族款式 | style_key、set_id、rarity、per_child_max 1–100、total_stock、placed_total ≤ total_stock、status（上架必须有审核人与时间）、design JSON |
| | drop_rules | 投放规则 | rule_type campaign/course、status、source_text、spec JSON、trigger_type、effect、probability_pct 1–100、daily_cap 1–10、total_quantity/consumed（consumed ≤ total）、时间窗；类型与触发/效果组合、课程规则必须有课程、限定款式必须列款式等 CHECK |
| | hiding_spots | 藏匿点 | `UNIQUE(attempt_id, spot_no)`（spot_no 1–3）、`UNIQUE(child_id, local_date, daily_seq)`（daily_seq 1–10，与 style_id 同时有或同时无）、rule_id、revealed_at（只能更新这一列） |
| | yahaha_finds | 图鉴记录（只追加） | `UNIQUE(spot_id)`、复合外键 (spot_id, style_id) → 藏匿点里的款式、fragment_ledger_id 唯一 |
| social（5） | family_friendships | 好友家庭 | low<high、生成列 live_key + 唯一键（每对家庭最多一条进行中/有效）、状态字段一致 |
| | gifts | 赠送（只追加） | amount 1–20、不能送自己、跨家庭必须关联好友关系、sender_date |
| | messages | 消息 | 发送方/接收方各恰好一个、kind 与内容一致、跨家庭只能 phrase/emoji 且只能孩子↔孩子、hidden_at |
| | blocks | 屏蔽 | blocker 为孩子或整个家庭（生成列 blocker_key）、唯一 |
| | abuse_reports | 举报 | 每家庭对同一消息只举报一次、处理状态一致 |
| chat（1） | ai_chat_usage | 聊天元数据（90 天） | `UNIQUE(family_id, client_request_id)`、status、filter_category（过滤命中时必填）、不含文本 |
| controls（3） | child_controls | 每孩子管控设置 | daily_minutes 10–300、allowed_start<allowed_end、ai_daily_limit 0–100、leaderboard_opt_out、version |
| | course_overrides | 课程开放覆盖 | PK(child_id, course_id)、mode open/closed |
| | usage_days | 每孩子每日用时 | used_seconds、bonus_minutes（15 的倍数 ≤120）、window_extended_until、last_heartbeat_at |
| reports（2） | daily_reports | 每日汇总 | PK(child_id, report_date)、各项计数（含 fragments_in、yahaha_found）、top_missed JSON |
| | email_outbox | 邮件发件箱 | `UNIQUE(dedupe_key)`、status、attempts ≤ 10、发送后清空正文 |
| platform（3） | system_settings | 系统设置 | 键白名单 CHECK；`discovery.spot_probability_pct` 1–100、`discovery.daily_cap` 1–10、`companion.den_base_slots` 1–10、`learning.play_ttl_minutes` 30–720 的取值 CHECK；version |
| | idempotency_requests | 请求幂等 | `UNIQUE(actor_type, actor_id, client_request_id)`、request_hash、只存 2xx |
| | schema_migrations | 迁移记账 | version、checksum |

**系统设置初始值**：`ai.enabled=true`、`ai.model`、`registration.mode="invite"`、`discovery.enabled=true`、`discovery.spot_probability_pct=20`、`discovery.daily_cap=3`、`discovery.rarity_weights={common:100,uncommon:30,rare:10,legendary:2}`、`discovery.milestone_bonus={10:3,30:5,100:10}`、`companion.den_base_slots=3`、`companion.den_slot_prices=[30,60,120]`、`companion.fragment_pass_scope="per_level_per_day"`、`studio.default_monthly_cap_fen=20000`、`studio.unit_prices`、`studio.voices`、`learning.play_ttl_minutes=120`、`content.allow_self_review=true`（各项含义见[开放问题](../01-requirements/open-questions.md) Q5–Q18）。伙伴默认档位（初级/中级/高级/稀有，Q5）与每档 4 个成长阶段（Q8）同样由 0001 迁移写入 `pet_tiers`/`pet_tier_stages`，之后在后台修改（见 [companion 需求](../01-requirements/modules/companion.md)）。

### 6.2 租户隔离
- 每张**家庭数据表**（家长、孩子、会话、作答、账本、伙伴、藏匿点、图鉴、社交、管控、报告等）都有 `family_id`；**全站共享的目录表**没有 `family_id`：词库与课程（words、word_senses、courses、course_versions、course_drafts、levels、questions、question_answers）、工作室（ai_jobs、ai_budget_months、assets、materials）、shop_items、伙伴档位与种类（pet_tiers、pet_tier_stages、pet_species）、呀哈哈目录与规则（yahaha_sets、yahaha_styles、drop_rules）、admin_accounts 与平台表。目录表只有系统管理员能写（权限矩阵 A），孩子端只读取已发布/已上架的行，不含任何家庭数据。涉及孩子/家长的外键都是 `(family_id, child_id) → children(family_id, id)` 形式的复合外键，数据库层面保证一行不可能“挂”到别的家庭的孩子上（已实测）。
- 每个 repo 函数的第一个参数是 `familyId`（来自已鉴权主体，绝不来自请求体），查询必带该条件。集成测试按路由表自动生成“用 B 家庭会话访问 A 家庭资源 → 404”用例。

### 6.3 数据库账号
| 账号 | 角色 | 权限 | 用途 |
| --- | --- | --- | --- |
| `xingya_app@localhost` | xingya_app_role | 按表（必要时按列）最小授权，见下表 | 服务进程（Unix socket） |
| `xingya_migrator@localhost` | xingya_migrator_role | `ALL ON xingya.*`（无 GRANT OPTION） | 部署时迁移、示例课程与装扮导入、运维脚本（经 SSH） |
| root | — | 全部 | 仅服务器本机 socket 认证，用于初始化与授权 |

应用账号授权（`db/roles.sql`，每张表都有授权，验证脚本检查全覆盖）：

| 授权 | 表 |
| --- | --- |
| 只读 | schema_migrations |
| 只追加（SELECT、INSERT） | ledger、attempts、review_sessions、gifts、audit_events、yahaha_finds；**已发布课程**：course_versions、levels、questions、question_answers |
| 插入 + 仅指定列可更新 | words（phonetic、audio_asset_id、status；拼写不可改）、word_senses（image_asset_id、status；释义不可改）、hiding_spots（revealed_at；放置内容不可改）、assets（visibility、status） |
| SELECT、UPDATE（不能插入） | admin_accounts、system_settings（不能新增键） |
| SELECT、INSERT、UPDATE（不能删除） | families、parents、children、family_devices、courses、course_drafts、level_progress、review_items、balances、shop_items、child_items、reward_options、redemptions、pet_tiers、pet_tier_stages、pet_species、pet_dens、child_pets、yahaha_sets、yahaha_styles、drop_rules、ai_jobs、ai_budget_months、family_friendships、messages、abuse_reports、child_controls、usage_days、daily_reports |
| 可删除 | sessions、auth_tokens、idempotency_requests、ai_chat_usage、email_outbox、course_overrides、blocks、plays（过期清理）、materials |

- 账号创建时 `ACCOUNT LOCK` 且无口令；服务器引导脚本从 `/etc/xingya/secrets.env` 读取口令执行 `ALTER USER … IDENTIFIED BY … ACCOUNT UNLOCK`。仓库中没有任何口令。
- MySQL 配置：`bind-address=127.0.0.1`、`mysqlx=OFF`、`skip-name-resolve`、`local_infile=OFF`；安全组不开放 3306。运维访问：`ssh -L 3307:/run/mysqld/mysqld.sock xingya-ecs`，在本机连 `127.0.0.1:3307`，落到服务器上即为 socket 连接（匹配 `@localhost`）。

### 6.4 数据保留与删除
| 数据 | 保留 |
| --- | --- |
| AI 聊天元数据 | 90 天 |
| 幂等记录 | 30 天 |
| 会话、令牌 | 过期后 7 天内清理 |
| 未完成的作答（plays） | 过期 7 天后删除；已完成的保留 |
| 邮件正文 | 发送成功即清空；邮件行 180 天 |
| AI 任务 | 保留（费用审计）；结束 180 天后清空参数中的资料文本 |
| 上传资料 | 由管理员删除（OSS 文件同时删除）；未被引用的草稿素材 90 天后归档 |
| 已发布课程版本、素材 | 永久（历史作答与复习引用） |
| 学习、账本、伙伴、图鉴、消息、报告 | 家庭存续期间保留 |
| 备份 | 本地与 OSS 各 14 天 |
| 家庭注销 | 家长发邮件申请 → 系统管理员核实身份 → 运维用 migrator 账号执行 `delete-family` 脚本删除该家庭全部行（含只追加表、藏匿点、图鉴、伙伴）→ 14 天后随备份轮换彻底消失；承诺 15 个工作日内完成 |

## 附录 A 数据库验证结果

- 环境：本机临时 MySQL 8.4.6（官方 minimal 二进制，独立数据目录与 socket，仅绑定 127.0.0.1），验证脚本 `db/verify/verify.mjs`（Node + mysql2，root 经 socket 连接），完成后删除库、账号并停止实例。
- 2026-10-21 按设计变更修订后重新验证：**155 项全部通过**（完整输出见 `db/verify/result.txt`）；原有 73 项按新表名与新结构改写后全部保留（`star_ledger` → `ledger`、闯关改为 `play_id` 唯一、复习条目绑定义项、商店不含宠物等），并新增下列检查。
- 结构：从空库应用两次，结构指纹（列、约束、CHECK、索引、外键、表级与列级授权）完全一致；表 55、外键 108、CHECK 133、非主键唯一键 54、生成列 12；指纹 `ab12eef1c3b3`。
- 碎片账本只追加：应用账号对碎片流水 UPDATE/DELETE 被拒；碎片不能用于购买、不能由家长奖励（币种与类型 CHECK）；每个呀哈哈 1 片、复习完成 2 片（范围 CHECK）；碎片余额不可为负；同一 `source_key` 在同一币种只入账一次，不同币种各一次；“学习星”只统计星星的 level_pass/review_day/streak。
- 已发布版本不可修改：应用账号 UPDATE `questions`/`question_answers`/`levels`、DELETE `course_versions` 均被拒；同一草稿只能发布一次；课程当前版本必须属于本课程；每门课只有一份未完成草稿；未通过自动检查不能提交审核；发布前必须有审核人；义项释义不能改（列级授权）、义项 ID 必须以词 ID 为前缀；每关必须定义 3 个藏匿点。
- 答案部分分离：可见部分含 `answer` 字段被 CHECK 拒绝；`questions` 表没有答案/解析列（information_schema 检查）。
- 作答：同一请求 ID 只开始一次；作答的关卡必须属于所记录的版本；同一次作答只产生一条闯关记录。
- 藏匿点：同一次通关同一藏匿点只记一次；每次通关最多 3 个；当天放置序号唯一（并发不超额）且 ≤ 10；有呀哈哈的藏匿点必须占当天序号；放置内容不能改（列级授权）；揭晓更新第一次影响 1 行、第二次 0 行；同一藏匿点只进一次图鉴、碎片只发一次；图鉴款式必须等于藏匿点款式；图鉴不能删除；款式放置数不超过全站库存。
- 投放规则：概率 0 或 101、每日上限 11、限时活动无结束时间、课程规则未绑定课程、限定款式未列款式、消耗超过总量均被 CHECK 拒绝；系统设置中全局概率 1–100、每日上限 1–10、作答有效期 30–720 被 CHECK 约束，未知设置键连 migrator 也写不进。
- 工作室：第 3 个并发任务被拒（槽位唯一）、槽位只能 1/2、运行中必须占槽位、本机进程任务同时最多 1 个；实际费用不得超过预估；预留 + 已花费不得超过月度上限；图片 ≤ 300 KB、AI 图片必须记录提示词；素材 OSS 路径不能改。
- 学习伙伴：默认 4 个档位与 16 个阶段由迁移写入、档位价格范围、第 1 阶段从 1 级开始、上架必须经过审核、每人只有一只学习陪伴、同种伙伴每人一只、伙伴不能物理删除、营地扩建最多 10 格。
