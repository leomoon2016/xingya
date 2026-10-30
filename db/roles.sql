-- =====================================================================
-- db/roles.sql —— PostgreSQL 角色与授权（超级用户执行，可重复执行）
-- 【草案】2026-10-30：由 MySQL 账号模型改写为 PostgreSQL 角色（ADR 0023）
-- 顺序：表级授权要求表已存在，因此在“应用迁移之后”执行；新增表时补充授权并再执行（幂等）。
-- 连接：只允许本机 Unix socket / 127.0.0.1（见 deploy 中 pg_hba.conf）；无远程角色。
-- 口令：角色先 NOLOGIN 或无密码；部署引导从 /etc/xingya/secrets.env 设置密码并允许 LOGIN。
-- =====================================================================

SET client_encoding = 'UTF8';

-- 应用与迁移角色（无继承超级用户）
DO $$ BEGIN
  CREATE ROLE xingya_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE xingya_migrator_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE xingya_app LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE xingya_migrator LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 登录角色挂到权限角色
GRANT xingya_app_role TO xingya_app;
GRANT xingya_migrator_role TO xingya_migrator;

-- 库与 schema
GRANT CONNECT ON DATABASE xingya TO xingya_app_role, xingya_migrator_role;
GRANT USAGE ON SCHEMA public TO xingya_app_role, xingya_migrator_role;
GRANT CREATE ON SCHEMA public TO xingya_migrator_role;
-- 表所有者默认为执行迁移的超级用户；为便于 migrator 后续 DDL，迁移后可将 public 表改属 migrator（部署脚本可选）：
-- ALTER TABLE ... OWNER TO xingya_migrator;  或在超级用户会话 SET ROLE 后应用迁移。


-- migrator：DDL + 数据（无 CREATEROLE / 无把权限再授予他人）
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO xingya_migrator_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO xingya_migrator_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO xingya_migrator_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO xingya_migrator_role;

-- 序列：应用需要 nextval（IDENTITY）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO xingya_app_role;

GRANT SELECT ON public.schema_migrations TO xingya_app_role;
GRANT SELECT, INSERT ON public.ledger           TO xingya_app_role;
GRANT SELECT, INSERT ON public.attempts         TO xingya_app_role;
GRANT SELECT, INSERT ON public.review_sessions  TO xingya_app_role;
GRANT SELECT, INSERT ON public.gifts            TO xingya_app_role;
GRANT SELECT, INSERT ON public.audit_events     TO xingya_app_role;
GRANT SELECT, INSERT ON public.yahaha_finds     TO xingya_app_role;
GRANT SELECT, INSERT ON public.word_random_draws TO xingya_app_role;  -- 单词本随机判定记录
GRANT SELECT, INSERT ON public.course_versions  TO xingya_app_role;
GRANT SELECT, INSERT ON public.units            TO xingya_app_role;   -- 单元随课程版本只追加
GRANT SELECT, INSERT ON public.levels           TO xingya_app_role;
GRANT SELECT, INSERT ON public.questions        TO xingya_app_role;
GRANT SELECT, INSERT ON public.question_answers TO xingya_app_role;
GRANT SELECT, INSERT ON public.learning_cards   TO xingya_app_role;   -- 学习卡随课程版本只追加
GRANT SELECT, INSERT ON public.reward_ledger    TO xingya_app_role;   -- 累计奖励流水
GRANT SELECT, INSERT ON public.hidden_reward_claims TO xingya_app_role;
GRANT SELECT, INSERT ON public.pet_gifts        TO xingya_app_role;
GRANT SELECT, INSERT ON public.pet_interactions TO xingya_app_role;
GRANT SELECT, INSERT ON public.words        TO xingya_app_role;
GRANT UPDATE (phonetic, audio_asset_id, status) ON public.words TO xingya_app_role;           -- 拼写 text 不可改
GRANT SELECT, INSERT ON public.word_senses  TO xingya_app_role;
GRANT UPDATE (image_asset_id, status) ON public.word_senses TO xingya_app_role;               -- 释义不可改：勘误 = 退役 + 新义项
GRANT SELECT, INSERT ON public.hiding_spots TO xingya_app_role;
GRANT UPDATE (revealed_at) ON public.hiding_spots TO xingya_app_role;                          -- 通关时决定的内容不可改
GRANT SELECT, INSERT ON public.assets       TO xingya_app_role;
GRANT UPDATE (visibility, status) ON public.assets TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.families           TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.parents            TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.children           TO xingya_app_role;
GRANT SELECT ON public.admin_accounts TO xingya_app_role;
GRANT UPDATE (password_hash, failed_login_count, locked_until, password_changed_at) ON public.admin_accounts TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.family_devices     TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.courses            TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.course_drafts      TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.plays              TO xingya_app_role;   -- 作答不过期（旧系统），无 DELETE
GRANT SELECT, INSERT, UPDATE ON public.level_progress     TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.unit_progress      TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.review_items       TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.word_identities    TO xingya_app_role;   -- 词身份不可删：删除词条后学习状态与奖励进度保留
GRANT SELECT, INSERT, UPDATE ON public.word_book_progress TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.word_tasks         TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.balances           TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.shop_items         TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.child_items        TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.reward_options     TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.redemptions        TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.reward_balances    TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.pet_tiers          TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.pet_tier_stages    TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.pet_species        TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.pet_dens           TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.child_pets         TO xingya_app_role;   -- 无 DELETE：退订与赠出只改状态
GRANT SELECT, INSERT ON public.secret_routes TO xingya_app_role;
GRANT UPDATE (entry_ledger_id, entered_at, passed_at, reward_ledger_id) ON public.secret_routes TO xingya_app_role;  -- 发现记录不可改
GRANT SELECT, INSERT, UPDATE ON public.yahaha_sets        TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.yahaha_styles      TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.drop_rules         TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_jobs            TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_budget_months   TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_providers       TO xingya_app_role;   -- 停用而不删除；密钥列只写入密文
GRANT SELECT, INSERT, UPDATE ON public.material_upload_links TO xingya_app_role; -- 撤销而不删除
GRANT SELECT, INSERT, UPDATE ON public.materials          TO xingya_app_role;   -- 软删除可恢复（旧系统），无 DELETE
GRANT SELECT, INSERT, UPDATE ON public.family_friendships TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.messages           TO xingya_app_role;
GRANT SELECT, INSERT ON public.notifications TO xingya_app_role;
GRANT UPDATE (read_at) ON public.notifications TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.abuse_reports      TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.child_controls     TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.usage_days         TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.daily_reports      TO xingya_app_role;
GRANT SELECT, UPDATE         ON public.system_settings    TO xingya_app_role;
GRANT SELECT, INSERT ON public.skills               TO xingya_app_role;
GRANT UPDATE (status, current_version_id, version) ON public.skills TO xingya_app_role;            -- skill_key、audience 不可改
GRANT SELECT, INSERT ON public.skill_versions       TO xingya_app_role;
GRANT UPDATE (status, reviewed_by_admin_id, reviewed_at, safety_reviewed_by_admin_id, safety_reviewed_at, published_at)
  ON public.skill_versions TO xingya_app_role;                                                        -- 提示词、模式、工具白名单不可改
GRANT SELECT, INSERT ON public.skill_allowed_agents TO xingya_app_role;
GRANT UPDATE (revoked_at, revoked_by_admin_id) ON public.skill_allowed_agents TO xingya_app_role;  -- 撤销而不删除
GRANT SELECT, INSERT ON public.agents               TO xingya_app_role;
GRANT UPDATE (status, current_version_id, version) ON public.agents TO xingya_app_role;            -- agent_key、audience 不可改
GRANT SELECT, INSERT ON public.agent_versions       TO xingya_app_role;
GRANT UPDATE (status, reviewed_by_admin_id, reviewed_at, safety_reviewed_by_admin_id, safety_reviewed_at, published_at)
  ON public.agent_versions TO xingya_app_role;
GRANT SELECT, INSERT ON public.agent_skills         TO xingya_app_role;                              -- 随角色版本不可改
GRANT SELECT, INSERT, UPDATE ON public.agent_budget_months TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE ON public.quick_tasks         TO xingya_app_role;                       -- 归档而不删除
GRANT SELECT, INSERT, UPDATE ON public.agent_runs          TO xingya_app_role;
GRANT SELECT, INSERT, DELETE ON public.agent_run_steps     TO xingya_app_role;                       -- 不可改；180 天保留期后删除
-- (e) 可删（会话、令牌、过期数据清理、取消覆盖/屏蔽、单词本词条）
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions             TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_tokens          TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_requests TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_usage        TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_outbox         TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_overrides     TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks               TO xingya_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.word_entries         TO xingya_app_role;   -- 单词本词条可删除（词身份保留）


-- 注释：登录限制由 pg_hba.conf 保证（local/host 127.0.0.1 only；reject 其他）。
-- 部署时：ALTER ROLE xingya_app WITH PASSWORD '...'; ALTER ROLE xingya_migrator WITH PASSWORD '...';
