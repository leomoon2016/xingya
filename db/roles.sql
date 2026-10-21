-- =====================================================================
-- db/roles.sql —— 数据库角色、账号与授权（root 执行，可重复执行）
-- 【草案，设计文档审核通过前可能调整】
-- 顺序：表级授权要求表已存在，因此 root 在“应用迁移之后”执行本文件；
--       以后新增表时，在这里补充对应授权并再次执行（幂等）。
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 13. 数据库角色与账号（root；可重复执行）
--   * 只建 @'localhost' 账号：应用与 SSH 隧道都经 Unix socket 连接（隧道用 ssh -L 端口:/run/mysqld/mysqld.sock）；
--   * 服务器 my.cnf：bind-address=127.0.0.1、mysqlx=OFF、skip-name-resolve；不存在任何远程账号；
--   * 账号创建时 ACCOUNT LOCK 且无口令；部署引导脚本从 /etc/xingya/secrets.env 读取口令执行
--     ALTER USER ... IDENTIFIED BY ... ACCOUNT UNLOCK（口令不进仓库）。
-- ---------------------------------------------------------------------
CREATE ROLE IF NOT EXISTS 'xingya_app_role', 'xingya_migrator_role';

-- migrator：库内全部权限（DDL、示例课程导入、运维脚本），无 GRANT OPTION
GRANT ALL PRIVILEGES ON xingya.* TO 'xingya_migrator_role';

-- app：按表最小授权
-- (a) 只读
GRANT SELECT ON xingya.schema_migrations TO 'xingya_app_role';
-- (b) 只追加：SELECT, INSERT（没有 UPDATE/DELETE）
--     账本（星星与碎片）、闯关与复习记录、赠送、审计、图鉴，
--     以及已发布课程版本：发布 = 插入新行，已发布的行永远不能被应用修改或删除
GRANT SELECT, INSERT ON xingya.ledger           TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.attempts         TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.review_sessions  TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.gifts            TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.audit_events     TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.yahaha_finds     TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.course_versions  TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.levels           TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.questions        TO 'xingya_app_role';
GRANT SELECT, INSERT ON xingya.question_answers TO 'xingya_app_role';
-- (c) 列级更新：只允许改指定列
GRANT SELECT, INSERT ON xingya.words        TO 'xingya_app_role';
GRANT UPDATE (phonetic, audio_asset_id, status) ON xingya.words TO 'xingya_app_role';           -- 拼写 text 不可改
GRANT SELECT, INSERT ON xingya.word_senses  TO 'xingya_app_role';
GRANT UPDATE (image_asset_id, status) ON xingya.word_senses TO 'xingya_app_role';               -- 释义不可改：勘误 = 退役 + 新义项
GRANT SELECT, INSERT ON xingya.hiding_spots TO 'xingya_app_role';
GRANT UPDATE (revealed_at) ON xingya.hiding_spots TO 'xingya_app_role';                          -- 通关时决定的内容不可改
GRANT SELECT, INSERT ON xingya.assets       TO 'xingya_app_role';
GRANT UPDATE (visibility, status) ON xingya.assets TO 'xingya_app_role';
-- (d) 可改不可删
GRANT SELECT, INSERT, UPDATE ON xingya.families           TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.parents            TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.children           TO 'xingya_app_role';
GRANT SELECT, UPDATE         ON xingya.admin_accounts     TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.family_devices     TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.courses            TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.course_drafts      TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.level_progress     TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.review_items       TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.balances           TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.shop_items         TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.child_items        TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.reward_options     TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.redemptions        TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.pet_tiers          TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.pet_tier_stages    TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.pet_species        TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.pet_dens           TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.child_pets         TO 'xingya_app_role';   -- 无 DELETE：伙伴不可物理删除
GRANT SELECT, INSERT, UPDATE ON xingya.yahaha_sets        TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.yahaha_styles      TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.drop_rules         TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.ai_jobs            TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.ai_budget_months   TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.family_friendships TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.messages           TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.abuse_reports      TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.child_controls     TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.usage_days         TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE ON xingya.daily_reports      TO 'xingya_app_role';
GRANT SELECT, UPDATE         ON xingya.system_settings    TO 'xingya_app_role';
-- (e) 可删（会话、令牌、过期数据清理、取消覆盖/屏蔽、未完成作答、资料）
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.sessions             TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.auth_tokens          TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.idempotency_requests TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.ai_chat_usage        TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.email_outbox         TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.course_overrides     TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.blocks               TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.plays                TO 'xingya_app_role';
GRANT SELECT, INSERT, UPDATE, DELETE ON xingya.materials            TO 'xingya_app_role';

CREATE USER IF NOT EXISTS 'xingya_app'@'localhost'      ACCOUNT LOCK;
CREATE USER IF NOT EXISTS 'xingya_migrator'@'localhost' ACCOUNT LOCK;
GRANT 'xingya_app_role'      TO 'xingya_app'@'localhost';
GRANT 'xingya_migrator_role' TO 'xingya_migrator'@'localhost';
SET DEFAULT ROLE 'xingya_app_role'      TO 'xingya_app'@'localhost';
SET DEFAULT ROLE 'xingya_migrator_role' TO 'xingya_migrator'@'localhost';
