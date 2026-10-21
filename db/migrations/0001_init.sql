-- =====================================================================
-- 0001_init.sql —— 星芽学园首个数据库迁移
-- 【草案，设计文档审核通过前可能调整】
-- 来源：docs/superpowers/specs/schema-draft.sql（提交 6b463ed，已在临时 MySQL 8.4.6 上验证 73/73）
--       第 0–9 段；第 10 段（角色与账号）拆到 db/roles.sql。
-- 设计说明：docs/03-design/data-model.md
-- 目标：MySQL 8.4 LTS，InnoDB，utf8mb4；所有时间列存 UTC（连接 time_zone='+00:00'）
-- 执行：首次初始化时第 0 段（CREATE DATABASE）需要 root 或拥有 xingya.* CREATE 权限的账号；
--       之后的迁移由 migrator 账号按文件名顺序（NNNN_名称.sql）应用，只前进。
-- 约定：
--   * 业务表都带 family_id，并用 (family_id, child_id) 复合外键把行“钉”在同一家庭；
--   * 外键一律 RESTRICT（不级联删除）；孩子/家长只停用不硬删；
--   * 只追加表（star_ledger、attempts、review_sessions、gifts、audit_events）
--     对应用账号只授予 SELECT, INSERT（见 db/roles.sql），没有 UPDATE/DELETE；
--   * 内容表（courses/levels/words/questions/shop_items）对应用账号只读，
--     由 migrator 账号在部署时从课程包导入。
-- 表数：36（业务 33 + 平台 3）
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 0. 建库（root）
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS xingya CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE xingya;

-- ---------------------------------------------------------------------
-- 1. 家庭账号 identity（8 张）
-- ---------------------------------------------------------------------
CREATE TABLE families (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                 VARCHAR(40)  NOT NULL,
  time_zone            VARCHAR(64)  NOT NULL DEFAULT 'Asia/Shanghai',  -- IANA 时区名，应用层校验
  cross_family_enabled TINYINT(1)   NOT NULL DEFAULT 0,               -- 跨家庭功能总开关，新家庭默认关
  friend_code          CHAR(8)      NULL,                             -- 好友家庭码；开启跨家庭功能时生成，可重置
  status               ENUM('active','suspended') NOT NULL DEFAULT 'active',
  version              INT UNSIGNED NOT NULL DEFAULT 1,               -- 乐观锁
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_families_friend_code (friend_code),
  CONSTRAINT ck_families_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 40),
  CONSTRAINT ck_families_friend_code CHECK (friend_code IS NULL OR REGEXP_LIKE(friend_code, '^[A-HJ-NP-Z2-9]{8}$', 'c')),
  CONSTRAINT ck_families_code_when_enabled CHECK (cross_family_enabled = 0 OR friend_code IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE parents (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id             BIGINT UNSIGNED NOT NULL,
  email                 VARCHAR(254) NOT NULL,                 -- 统一小写存储
  password_hash         VARCHAR(255) NOT NULL,                 -- scrypt，含参数与盐
  display_name          VARCHAR(40)  NOT NULL,
  email_verified_at     DATETIME(3)  NULL,
  weekly_report_enabled TINYINT(1)   NOT NULL DEFAULT 1,       -- 周报订阅（退订链接改为 0）
  status                ENUM('active','disabled') NOT NULL DEFAULT 'active',
  failed_login_count    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until          DATETIME(3)  NULL,
  version               INT UNSIGNED NOT NULL DEFAULT 1,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_parents_email (email),
  UNIQUE KEY uq_parents_family_id (family_id, id),
  CONSTRAINT fk_parents_family FOREIGN KEY (family_id) REFERENCES families (id),
  CONSTRAINT ck_parents_email CHECK (CAST(email AS BINARY) = CAST(LOWER(email) AS BINARY) AND email LIKE '%_@_%'),
  CONSTRAINT ck_parents_display_name CHECK (CHAR_LENGTH(TRIM(display_name)) BETWEEN 1 AND 40)
) ENGINE=InnoDB;

CREATE TABLE children (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id          BIGINT UNSIGNED NOT NULL,
  nickname           VARCHAR(20)  NOT NULL,
  avatar_key         VARCHAR(48)  NOT NULL,                  -- 内容包 avatars.json 中的键
  grade              TINYINT UNSIGNED NOT NULL,
  pin_hash           VARCHAR(255) NOT NULL,                  -- 4 位 PIN 的 scrypt 哈希
  username           VARCHAR(32)  NULL,                      -- 可选：其他设备登录用
  password_hash      VARCHAR(255) NULL,
  failed_login_count TINYINT UNSIGNED NOT NULL DEFAULT 0,    -- PIN 与密码共用
  locked_until       DATETIME(3)  NULL,
  status             ENUM('active','archived') NOT NULL DEFAULT 'active',
  version            INT UNSIGNED NOT NULL DEFAULT 1,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_children_family_id (family_id, id),
  UNIQUE KEY uq_children_family_nickname (family_id, nickname),
  UNIQUE KEY uq_children_username (username),
  CONSTRAINT fk_children_family FOREIGN KEY (family_id) REFERENCES families (id),
  CONSTRAINT ck_children_grade CHECK (grade BETWEEN 1 AND 6),
  CONSTRAINT ck_children_nickname CHECK (CHAR_LENGTH(TRIM(nickname)) BETWEEN 1 AND 20),
  CONSTRAINT ck_children_credentials CHECK ((username IS NULL) = (password_hash IS NULL)),
  CONSTRAINT ck_children_username CHECK (username IS NULL OR REGEXP_LIKE(username, '^[a-z][a-z0-9_]{3,31}$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE admin_accounts (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username           VARCHAR(32)  NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  totp_secret_enc    VARBINARY(255) NOT NULL,                -- 以服务端主密钥加密的 TOTP 种子
  status             ENUM('active','disabled') NOT NULL DEFAULT 'active',
  failed_login_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until       DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB;

CREATE TABLE family_devices (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id            BIGINT UNSIGNED NOT NULL,
  token_hash           BINARY(32)   NOT NULL,                -- 设备 Cookie 的 SHA-256
  label                VARCHAR(40)  NOT NULL,
  user_agent           VARCHAR(255) NULL,
  created_by_parent_id BIGINT UNSIGNED NOT NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at         DATETIME(3)  NULL,
  expires_at           DATETIME(3)  NOT NULL,
  revoked_at           DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_family_devices_token (token_hash),
  UNIQUE KEY uq_family_devices_family_id (family_id, id),
  CONSTRAINT fk_family_devices_parent FOREIGN KEY (family_id, created_by_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_family_devices_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB;

CREATE TABLE sessions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash       BINARY(32)   NOT NULL,                    -- 会话令牌的 SHA-256（明文只在 Cookie/Bearer 中）
  principal        ENUM('parent','child','admin') NOT NULL,
  family_id        BIGINT UNSIGNED NULL,
  parent_id        BIGINT UNSIGNED NULL,
  child_id         BIGINT UNSIGNED NULL,
  admin_id         BIGINT UNSIGNED NULL,
  family_device_id BIGINT UNSIGNED NULL,                     -- 在家庭设备上通过头像+PIN 登录时记录
  login_method     ENUM('password','pin','child_password','admin_totp') NOT NULL,
  user_agent       VARCHAR(255) NULL,
  ip               VARCHAR(45)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at       DATETIME(3)  NOT NULL,
  revoked_at       DATETIME(3)  NULL,
  revoked_reason   ENUM('logout','parent_revoked','password_changed','admin','expired_cleanup') NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY ix_sessions_child (child_id, last_seen_at),
  KEY ix_sessions_parent (parent_id, last_seen_at),
  CONSTRAINT fk_sessions_parent FOREIGN KEY (family_id, parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT fk_sessions_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_sessions_admin  FOREIGN KEY (admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_sessions_device FOREIGN KEY (family_id, family_device_id) REFERENCES family_devices (family_id, id),
  CONSTRAINT ck_sessions_principal CHECK (
       (principal = 'parent' AND family_id IS NOT NULL AND parent_id IS NOT NULL AND child_id IS NULL AND admin_id IS NULL
          AND login_method = 'password')
    OR (principal = 'child'  AND family_id IS NOT NULL AND child_id IS NOT NULL AND parent_id IS NULL AND admin_id IS NULL
          AND login_method IN ('pin','child_password'))
    OR (principal = 'admin'  AND family_id IS NULL AND admin_id IS NOT NULL AND parent_id IS NULL AND child_id IS NULL
          AND family_device_id IS NULL AND login_method = 'admin_totp')),
  CONSTRAINT ck_sessions_pin_device CHECK (login_method <> 'pin' OR family_device_id IS NOT NULL),
  CONSTRAINT ck_sessions_expiry CHECK (expires_at > created_at),
  CONSTRAINT ck_sessions_revoked CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
) ENGINE=InnoDB;

CREATE TABLE auth_tokens (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purpose              ENUM('verify_email','reset_password','invite_parent','family_signup') NOT NULL,
  token_hash           BINARY(32)   NOT NULL,
  family_id            BIGINT UNSIGNED NULL,
  parent_id            BIGINT UNSIGNED NULL,                 -- verify_email / reset_password 的目标家长
  email                VARCHAR(254) NULL,                    -- invite_parent 的受邀邮箱
  created_by_parent_id BIGINT UNSIGNED NULL,
  created_by_admin_id  BIGINT UNSIGNED NULL,
  expires_at           DATETIME(3)  NOT NULL,
  used_at              DATETIME(3)  NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_tokens_hash (token_hash),
  CONSTRAINT fk_auth_tokens_parent  FOREIGN KEY (family_id, parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT fk_auth_tokens_creator FOREIGN KEY (family_id, created_by_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT fk_auth_tokens_admin   FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_auth_tokens_shape CHECK (
       (purpose IN ('verify_email','reset_password') AND family_id IS NOT NULL AND parent_id IS NOT NULL
          AND email IS NULL AND created_by_admin_id IS NULL)
    OR (purpose = 'invite_parent' AND family_id IS NOT NULL AND parent_id IS NULL AND email IS NOT NULL
          AND created_by_parent_id IS NOT NULL AND created_by_admin_id IS NULL)
    OR (purpose = 'family_signup' AND family_id IS NULL AND parent_id IS NULL AND created_by_parent_id IS NULL
          AND created_by_admin_id IS NOT NULL)),
  CONSTRAINT ck_auth_tokens_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB;

CREATE TABLE audit_events (                                  -- 只追加
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id   BIGINT UNSIGNED NULL,
  actor_type  ENUM('parent','child','admin','system') NOT NULL,
  actor_id    BIGINT UNSIGNED NULL,
  action      VARCHAR(48)  NOT NULL,                         -- 如 auth.pin_locked、session.revoked、controls.updated
  target_type VARCHAR(32)  NULL,
  target_id   VARCHAR(64)  NULL,
  detail      JSON         NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_audit_family_time (family_id, created_at),
  CONSTRAINT fk_audit_family FOREIGN KEY (family_id) REFERENCES families (id),
  CONSTRAINT ck_audit_actor CHECK ((actor_type = 'system') = (actor_id IS NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. 课程内容 content（5 张，应用只读；部署时由内容包导入）
-- ---------------------------------------------------------------------
CREATE TABLE courses (
  id               VARCHAR(64)  NOT NULL,                    -- 稳定 ID，如 en-g1-u01
  subject          VARCHAR(16)  NOT NULL,                    -- 学科是字段：首发只有 english
  grade            TINYINT UNSIGNED NOT NULL,
  title            VARCHAR(60)  NOT NULL,
  sort_order       INT          NOT NULL,
  instruction_lang ENUM('zh','en') NOT NULL DEFAULT 'zh',     -- 题干说明语言（替代旧系统的日期特判）
  cover_image      VARCHAR(255) NULL,
  retired          TINYINT(1)   NOT NULL DEFAULT 0,          -- 内容包删除的条目只标记退役，不删除
  pack_version     VARCHAR(32)  NOT NULL,                    -- 最近一次导入它的内容包版本
  PRIMARY KEY (id),
  KEY ix_courses_subject_grade (subject, grade, sort_order),
  CONSTRAINT ck_courses_id CHECK (REGEXP_LIKE(id, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_courses_subject CHECK (REGEXP_LIKE(subject, '^[a-z]{2,16}$', 'c')),
  CONSTRAINT ck_courses_grade CHECK (grade BETWEEN 1 AND 6)
) ENGINE=InnoDB;

CREATE TABLE levels (
  id           VARCHAR(64)  NOT NULL,
  course_id    VARCHAR(64)  NOT NULL,
  seq          SMALLINT UNSIGNED NOT NULL,                   -- 课程内顺序（解锁顺序）
  title        VARCHAR(60)  NOT NULL,
  retired      TINYINT(1)   NOT NULL DEFAULT 0,
  pack_version VARCHAR(32)  NOT NULL,
  PRIMARY KEY (id),
  KEY ix_levels_course_seq (course_id, seq),
  CONSTRAINT fk_levels_course FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT ck_levels_id CHECK (REGEXP_LIKE(id, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_levels_seq CHECK (seq >= 1)
) ENGINE=InnoDB;

CREATE TABLE words (
  id           VARCHAR(64)  NOT NULL,                        -- 稳定词 ID，如 en.apple、en.bat-animal，跨版本不变、不复用
  subject      VARCHAR(16)  NOT NULL,
  text         VARCHAR(64)  NOT NULL,
  meaning_zh   VARCHAR(64)  NOT NULL,
  phonetic     VARCHAR(64)  NULL,
  image_path   VARCHAR(255) NULL,                            -- 内容包内哈希文件名
  audio_path   VARCHAR(255) NOT NULL,                        -- 构建期生成的标准音
  retired      TINYINT(1)   NOT NULL DEFAULT 0,
  pack_version VARCHAR(32)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_words_id CHECK (REGEXP_LIKE(id, '^[a-z]{2}\\.[a-z0-9]+(-[a-z0-9]+)*$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE questions (
  id           VARCHAR(64)  NOT NULL,
  level_id     VARCHAR(64)  NOT NULL,
  seq          TINYINT UNSIGNED NOT NULL,
  type         VARCHAR(24)  NOT NULL,                        -- pick_image | listen_choose | spell | read_aloud（新学科增加新类型无需迁移）
  word_id      VARCHAR(64)  NULL,
  scored       TINYINT(1)   NOT NULL,                        -- read_aloud=0，其余=1（校验器保证）
  payload      JSON         NOT NULL,                        -- 题干/选项/答案，结构见设计 §8
  retired      TINYINT(1)   NOT NULL DEFAULT 0,
  pack_version VARCHAR(32)  NOT NULL,
  PRIMARY KEY (id),
  KEY ix_questions_level (level_id, seq),
  CONSTRAINT fk_questions_level FOREIGN KEY (level_id) REFERENCES levels (id),
  CONSTRAINT fk_questions_word  FOREIGN KEY (word_id) REFERENCES words (id),
  CONSTRAINT ck_questions_type CHECK (REGEXP_LIKE(type, '^[a-z_]{3,24}$', 'c')),
  CONSTRAINT ck_questions_seq CHECK (seq BETWEEN 1 AND 8),
  CONSTRAINT ck_questions_scored CHECK (scored = IF(type = 'read_aloud', 0, 1))
) ENGINE=InnoDB;

CREATE TABLE shop_items (
  id           VARCHAR(64)  NOT NULL,
  kind         ENUM('outfit','pet') NOT NULL,
  slot         ENUM('head','body','accessory','pet') NOT NULL,
  name         VARCHAR(30)  NOT NULL,
  price        INT UNSIGNED NOT NULL,
  image_path   VARCHAR(255) NOT NULL,
  sort_order   INT          NOT NULL,
  retired      TINYINT(1)   NOT NULL DEFAULT 0,             -- 退役后不再出售，已拥有的保留
  pack_version VARCHAR(32)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_shop_items_slot CHECK ((kind = 'pet') = (slot = 'pet')),
  CONSTRAINT ck_shop_items_price CHECK (price BETWEEN 1 AND 1000)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. 学习 learning（4 张）
-- ---------------------------------------------------------------------
CREATE TABLE level_progress (
  family_id       BIGINT UNSIGNED NOT NULL,
  child_id        BIGINT UNSIGNED NOT NULL,
  level_id        VARCHAR(64)  NOT NULL,
  best_stars      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  best_accuracy   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  attempts_count  INT UNSIGNED NOT NULL DEFAULT 0,
  first_passed_at DATETIME(3)  NULL,
  last_attempt_at DATETIME(3)  NOT NULL,
  PRIMARY KEY (child_id, level_id),
  KEY ix_level_progress_family (family_id, child_id),
  CONSTRAINT fk_level_progress_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_level_progress_level FOREIGN KEY (level_id) REFERENCES levels (id),
  CONSTRAINT ck_level_progress_stars CHECK (best_stars BETWEEN 0 AND 3),
  CONSTRAINT ck_level_progress_accuracy CHECK (best_accuracy <= 100),
  CONSTRAINT ck_level_progress_passed CHECK ((best_stars = 0) = (first_passed_at IS NULL))
) ENGINE=InnoDB;

CREATE TABLE attempts (                                      -- 只追加：一次闯关 = 一行
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id         BIGINT UNSIGNED NOT NULL,
  child_id          BIGINT UNSIGNED NOT NULL,
  level_id          VARCHAR(64)  NOT NULL,
  client_request_id CHAR(36)     NOT NULL,
  activity_date     DATE         NOT NULL,                   -- 家庭时区的本地日期
  scored_count      TINYINT UNSIGNED NOT NULL,
  correct_count     TINYINT UNSIGNED NOT NULL,
  accuracy_pct      TINYINT UNSIGNED AS (FLOOR(correct_count * 100 / scored_count)) STORED,
  stars             TINYINT UNSIGNED AS (CASE WHEN correct_count = scored_count THEN 3
                                              WHEN correct_count * 100 >= scored_count * 90 THEN 2
                                              WHEN correct_count * 100 >= scored_count * 80 THEN 1
                                              ELSE 0 END) STORED,
  passed            TINYINT(1)   AS (correct_count * 100 >= scored_count * 80) STORED,
  stars_awarded     TINYINT UNSIGNED NOT NULL,               -- 本次实际发放（只发提升差额）
  answers           JSON         NOT NULL,                   -- [{questionId, wordId, response, correct}]
  client_started_at DATETIME(3)  NULL,
  submitted_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_attempts_request (child_id, client_request_id),
  KEY ix_attempts_child_date (child_id, activity_date),
  KEY ix_attempts_family (family_id, child_id),
  CONSTRAINT fk_attempts_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_attempts_level FOREIGN KEY (level_id) REFERENCES levels (id),
  CONSTRAINT ck_attempts_counts CHECK (scored_count BETWEEN 4 AND 8 AND correct_count <= scored_count),
  CONSTRAINT ck_attempts_awarded CHECK (stars_awarded <= 3),
  CONSTRAINT ck_attempts_request_id CHECK (REGEXP_LIKE(client_request_id, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE review_items (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id        BIGINT UNSIGNED NOT NULL,
  child_id         BIGINT UNSIGNED NOT NULL,
  item_type        ENUM('word','question') NOT NULL,
  word_id          VARCHAR(64)  NULL,
  question_id      VARCHAR(64)  NULL,
  ref_id           VARCHAR(64)  AS (COALESCE(word_id, question_id)) STORED,
  box              TINYINT UNSIGNED NOT NULL DEFAULT 1,       -- 1..6 对应间隔 1,2,4,7,15,30 天
  due_date         DATE         NOT NULL,                    -- 家庭时区本地日期
  lapses           SMALLINT UNSIGNED NOT NULL DEFAULT 0,      -- 答错（回到 1 盒）次数
  last_result      ENUM('none','correct','wrong') NOT NULL DEFAULT 'none',
  last_reviewed_at DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_items_ref (child_id, item_type, ref_id),
  KEY ix_review_items_due (child_id, due_date, box),
  CONSTRAINT fk_review_items_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_review_items_word FOREIGN KEY (word_id) REFERENCES words (id),
  CONSTRAINT fk_review_items_question FOREIGN KEY (question_id) REFERENCES questions (id),
  CONSTRAINT ck_review_items_ref CHECK (
       (item_type = 'word' AND word_id IS NOT NULL AND question_id IS NULL)
    OR (item_type = 'question' AND question_id IS NOT NULL AND word_id IS NULL)),
  CONSTRAINT ck_review_items_box CHECK (box BETWEEN 1 AND 6)
) ENGINE=InnoDB;

CREATE TABLE review_sessions (                               -- 只追加：一次复习批量提交 = 一行
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id         BIGINT UNSIGNED NOT NULL,
  child_id          BIGINT UNSIGNED NOT NULL,
  client_request_id CHAR(36)     NOT NULL,
  review_date       DATE         NOT NULL,
  item_count        TINYINT UNSIGNED NOT NULL,               -- 本批有效判分的条目数
  correct_count     TINYINT UNSIGNED NOT NULL,
  completes_day     TINYINT(1)   NOT NULL DEFAULT 0,          -- 本批提交后“今日复习”完成
  completion_date   DATE         AS (IF(completes_day = 1, review_date, NULL)) STORED,
  results           JSON         NOT NULL,                   -- [{reviewItemId, response, correct}]
  submitted_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_sessions_request (child_id, client_request_id),
  UNIQUE KEY uq_review_sessions_completion (child_id, completion_date),   -- 每天最多一次“完成”
  KEY ix_review_sessions_date (child_id, review_date),
  CONSTRAINT fk_review_sessions_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT ck_review_sessions_counts CHECK (item_count BETWEEN 0 AND 20 AND correct_count <= item_count)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. 星星 stars（5 张）
-- ---------------------------------------------------------------------
CREATE TABLE star_ledger (                                   -- 只追加：应用账号无 UPDATE/DELETE
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id       BIGINT UNSIGNED NOT NULL,
  child_id        BIGINT UNSIGNED NOT NULL,
  kind            ENUM('level_pass','review_day','streak','parent_award',
                       'gift_in','gift_out','purchase',
                       'redeem_hold','redeem_release','redeem_debit') NOT NULL,
  delta           INT          NOT NULL,
  balance_after   INT          NOT NULL,
  source_key      VARCHAR(96)  NOT NULL,                     -- 业务幂等键，如 attempt:123、review:2026-10-21、gift:9:out
  local_date      DATE         NOT NULL,                     -- 家庭时区日期（排行榜周、报告用）
  counts_for_leaderboard TINYINT(1) AS (kind IN ('level_pass','review_day','streak')) STORED,
  actor_parent_id BIGINT UNSIGNED NULL,
  note            VARCHAR(100) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_star_ledger_source (child_id, source_key),
  KEY ix_star_ledger_child (child_id, id),
  KEY ix_star_ledger_board (local_date, counts_for_leaderboard, child_id),
  KEY ix_star_ledger_family (family_id, child_id),
  CONSTRAINT fk_star_ledger_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_star_ledger_parent FOREIGN KEY (family_id, actor_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_star_ledger_sign CHECK (
       (kind IN ('level_pass','review_day','streak','parent_award','gift_in','redeem_release') AND delta > 0)
    OR (kind IN ('gift_out','purchase','redeem_hold','redeem_debit') AND delta < 0)),
  CONSTRAINT ck_star_ledger_ranges CHECK (
       (kind <> 'level_pass'   OR delta BETWEEN 1 AND 3)
   AND (kind <> 'parent_award' OR delta BETWEEN 1 AND 50)
   AND (kind NOT IN ('gift_in','gift_out') OR ABS(delta) BETWEEN 1 AND 20)),
  CONSTRAINT ck_star_ledger_balance CHECK (balance_after >= 0),
  CONSTRAINT ck_star_ledger_actor CHECK ((kind = 'parent_award') = (actor_parent_id IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE star_balances (                                 -- 余额缓存：与流水同一事务维护，每晚对账
  child_id       BIGINT UNSIGNED NOT NULL,
  family_id      BIGINT UNSIGNED NOT NULL,
  balance        INT          NOT NULL DEFAULT 0,
  last_ledger_id BIGINT UNSIGNED NULL,
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (child_id),
  CONSTRAINT fk_star_balances_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_star_balances_ledger FOREIGN KEY (last_ledger_id) REFERENCES star_ledger (id),
  CONSTRAINT ck_star_balances_nonneg CHECK (balance >= 0)
) ENGINE=InnoDB;

CREATE TABLE child_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id          BIGINT UNSIGNED NOT NULL,
  child_id           BIGINT UNSIGNED NOT NULL,
  item_id            VARCHAR(64)  NOT NULL,
  slot               ENUM('head','body','accessory','pet') NOT NULL,   -- 购买时从 shop_items 复制（槽位不可变）
  equipped           TINYINT(1)   NOT NULL DEFAULT 0,
  equipped_slot      VARCHAR(16)  AS (IF(equipped = 1, slot, NULL)) STORED,
  purchase_ledger_id BIGINT UNSIGNED NOT NULL,
  acquired_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_child_items_item (child_id, item_id),          -- 同一物品只能买一次
  UNIQUE KEY uq_child_items_equipped (child_id, equipped_slot), -- 每个槽位最多穿戴一件；pet 槽 = 陪伴宠物
  CONSTRAINT fk_child_items_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_child_items_item FOREIGN KEY (item_id) REFERENCES shop_items (id),
  CONSTRAINT fk_child_items_ledger FOREIGN KEY (purchase_ledger_id) REFERENCES star_ledger (id)
) ENGINE=InnoDB;

CREATE TABLE reward_options (                                -- 家长定义的现实奖励
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id            BIGINT UNSIGNED NOT NULL,
  title                VARCHAR(40)  NOT NULL,
  star_price           INT UNSIGNED NOT NULL,
  active               TINYINT(1)   NOT NULL DEFAULT 1,
  created_by_parent_id BIGINT UNSIGNED NOT NULL,
  version              INT UNSIGNED NOT NULL DEFAULT 1,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reward_options_family_id (family_id, id),
  CONSTRAINT fk_reward_options_parent FOREIGN KEY (family_id, created_by_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_reward_options_title CHECK (CHAR_LENGTH(TRIM(title)) BETWEEN 1 AND 40),
  CONSTRAINT ck_reward_options_price CHECK (star_price BETWEEN 1 AND 2000)
) ENGINE=InnoDB;

CREATE TABLE redemptions (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id            BIGINT UNSIGNED NOT NULL,
  child_id             BIGINT UNSIGNED NOT NULL,
  reward_option_id     BIGINT UNSIGNED NOT NULL,
  title_snapshot       VARCHAR(40)  NOT NULL,
  price                INT UNSIGNED NOT NULL,
  status               ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  requested_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decided_at           DATETIME(3)  NULL,
  decided_by_parent_id BIGINT UNSIGNED NULL,
  decision_note        VARCHAR(100) NULL,
  version              INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_redemptions_family_status (family_id, status),
  KEY ix_redemptions_child (child_id, status),
  CONSTRAINT fk_redemptions_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_redemptions_option FOREIGN KEY (family_id, reward_option_id) REFERENCES reward_options (family_id, id),
  CONSTRAINT fk_redemptions_parent FOREIGN KEY (family_id, decided_by_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_redemptions_price CHECK (price BETWEEN 1 AND 2000),
  CONSTRAINT ck_redemptions_decision CHECK (
       (status = 'pending'   AND decided_at IS NULL AND decided_by_parent_id IS NULL)
    OR (status IN ('approved','rejected') AND decided_at IS NOT NULL AND decided_by_parent_id IS NOT NULL)
    OR (status = 'cancelled' AND decided_at IS NOT NULL AND decided_by_parent_id IS NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. 社交 social（5 张）
-- ---------------------------------------------------------------------
CREATE TABLE family_friendships (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_low_id          BIGINT UNSIGNED NOT NULL,           -- 两个家庭 id 中较小者
  family_high_id         BIGINT UNSIGNED NOT NULL,
  requested_by_family_id BIGINT UNSIGNED NOT NULL,
  requested_by_parent_id BIGINT UNSIGNED NOT NULL,
  status                 ENUM('pending','active','declined','ended') NOT NULL DEFAULT 'pending',
  decided_by_parent_id   BIGINT UNSIGNED NULL,               -- 对方家庭家长
  ended_by_family_id     BIGINT UNSIGNED NULL,
  live_key               TINYINT(1) AS (IF(status IN ('pending','active'), 1, NULL)) STORED,
  created_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decided_at             DATETIME(3)  NULL,
  ended_at               DATETIME(3)  NULL,
  version                INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_friendships_live (family_low_id, family_high_id, live_key),  -- 同一对家庭最多一条进行中/有效关系
  KEY ix_friendships_high (family_high_id, status),
  CONSTRAINT fk_friendships_low  FOREIGN KEY (family_low_id)  REFERENCES families (id),
  CONSTRAINT fk_friendships_high FOREIGN KEY (family_high_id) REFERENCES families (id),
  CONSTRAINT fk_friendships_requester FOREIGN KEY (requested_by_family_id, requested_by_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_friendships_order CHECK (family_low_id < family_high_id),
  CONSTRAINT ck_friendships_requester CHECK (requested_by_family_id IN (family_low_id, family_high_id)),
  CONSTRAINT ck_friendships_state CHECK (
       (status = 'pending'  AND decided_by_parent_id IS NULL AND decided_at IS NULL AND ended_at IS NULL)
    OR (status IN ('active','declined') AND decided_by_parent_id IS NOT NULL AND decided_at IS NOT NULL AND ended_at IS NULL)
    OR (status = 'ended' AND ended_at IS NOT NULL AND ended_by_family_id IN (family_low_id, family_high_id)))
) ENGINE=InnoDB;

CREATE TABLE gifts (                                         -- 只追加
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_family_id BIGINT UNSIGNED NOT NULL,
  from_child_id  BIGINT UNSIGNED NOT NULL,
  to_family_id   BIGINT UNSIGNED NOT NULL,
  to_child_id    BIGINT UNSIGNED NOT NULL,
  amount         TINYINT UNSIGNED NOT NULL,
  sender_date    DATE         NOT NULL,                      -- 发送方家庭时区日期（每日 20 星上限按此统计）
  friendship_id  BIGINT UNSIGNED NULL,                       -- 跨家庭时必填
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_gifts_sender_day (from_child_id, sender_date),
  KEY ix_gifts_to (to_child_id, created_at),
  CONSTRAINT fk_gifts_from FOREIGN KEY (from_family_id, from_child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_gifts_to   FOREIGN KEY (to_family_id, to_child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_gifts_friendship FOREIGN KEY (friendship_id) REFERENCES family_friendships (id),
  CONSTRAINT ck_gifts_amount CHECK (amount BETWEEN 1 AND 20),
  CONSTRAINT ck_gifts_self CHECK (from_child_id <> to_child_id),
  CONSTRAINT ck_gifts_cross CHECK ((from_family_id = to_family_id) = (friendship_id IS NULL))
) ENGINE=InnoDB;

CREATE TABLE messages (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_family_id    BIGINT UNSIGNED NOT NULL,
  sender_child_id     BIGINT UNSIGNED NULL,
  sender_parent_id    BIGINT UNSIGNED NULL,
  recipient_family_id BIGINT UNSIGNED NOT NULL,
  recipient_child_id  BIGINT UNSIGNED NULL,
  recipient_parent_id BIGINT UNSIGNED NULL,
  kind                ENUM('text','phrase','emoji') NOT NULL,
  body                VARCHAR(200) NULL,                     -- 仅家庭内 text
  phrase_key          VARCHAR(48)  NULL,                     -- 内容包 phrases.json 的键
  emoji_key           VARCHAR(32)  NULL,                     -- 内容包 emoji 白名单的键
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at             DATETIME(3)  NULL,
  hidden_at           DATETIME(3)  NULL,                     -- 举报后对举报方隐藏 / 管理员处理后隐藏
  PRIMARY KEY (id),
  KEY ix_messages_recipient_child (recipient_child_id, created_at),
  KEY ix_messages_sender_child (sender_child_id, created_at),
  KEY ix_messages_recipient_parent (recipient_parent_id, created_at),
  CONSTRAINT fk_messages_sender_child     FOREIGN KEY (sender_family_id, sender_child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_messages_sender_parent    FOREIGN KEY (sender_family_id, sender_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT fk_messages_recipient_child  FOREIGN KEY (recipient_family_id, recipient_child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_messages_recipient_parent FOREIGN KEY (recipient_family_id, recipient_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_messages_one_sender    CHECK ((sender_child_id IS NULL) <> (sender_parent_id IS NULL)),
  CONSTRAINT ck_messages_one_recipient CHECK ((recipient_child_id IS NULL) <> (recipient_parent_id IS NULL)),
  CONSTRAINT ck_messages_kind CHECK (
       (kind = 'text'   AND body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) BETWEEN 1 AND 200 AND phrase_key IS NULL AND emoji_key IS NULL)
    OR (kind = 'phrase' AND phrase_key IS NOT NULL AND body IS NULL AND emoji_key IS NULL)
    OR (kind = 'emoji'  AND emoji_key IS NOT NULL AND body IS NULL AND phrase_key IS NULL)),
  CONSTRAINT ck_messages_cross_family CHECK (
       sender_family_id = recipient_family_id
    OR (kind <> 'text' AND sender_child_id IS NOT NULL AND recipient_child_id IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE blocks (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  blocker_family_id BIGINT UNSIGNED NOT NULL,
  blocker_child_id  BIGINT UNSIGNED NULL,                    -- NULL = 家长以整个家庭名义屏蔽
  blocker_key       BIGINT UNSIGNED AS (COALESCE(blocker_child_id, 0)) STORED,
  blocked_family_id BIGINT UNSIGNED NOT NULL,
  blocked_child_id  BIGINT UNSIGNED NOT NULL,
  created_by        ENUM('parent','child') NOT NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_blocks_pair (blocker_family_id, blocker_key, blocked_child_id),
  KEY ix_blocks_blocked (blocked_child_id),
  CONSTRAINT fk_blocks_blocker FOREIGN KEY (blocker_family_id, blocker_child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_blocks_blocker_family FOREIGN KEY (blocker_family_id) REFERENCES families (id),
  CONSTRAINT fk_blocks_blocked FOREIGN KEY (blocked_family_id, blocked_child_id) REFERENCES children (family_id, id),
  CONSTRAINT ck_blocks_self CHECK (blocker_child_id IS NULL OR blocker_child_id <> blocked_child_id),
  CONSTRAINT ck_blocks_creator CHECK (blocker_child_id IS NOT NULL OR created_by = 'parent')
) ENGINE=InnoDB;

CREATE TABLE abuse_reports (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_family_id  BIGINT UNSIGNED NOT NULL,
  reporter_child_id   BIGINT UNSIGNED NULL,
  reporter_parent_id  BIGINT UNSIGNED NULL,
  message_id          BIGINT UNSIGNED NOT NULL,
  reason              ENUM('rude','scary','spam','stranger','other') NOT NULL,
  note                VARCHAR(200) NULL,
  status              ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  handled_by_admin_id BIGINT UNSIGNED NULL,
  handled_at          DATETIME(3)  NULL,
  admin_note          VARCHAR(200) NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_abuse_reports_once (message_id, reporter_family_id),
  KEY ix_abuse_reports_status (status, created_at),
  CONSTRAINT fk_abuse_reports_message FOREIGN KEY (message_id) REFERENCES messages (id),
  CONSTRAINT fk_abuse_reports_child  FOREIGN KEY (reporter_family_id, reporter_child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_abuse_reports_parent FOREIGN KEY (reporter_family_id, reporter_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT fk_abuse_reports_admin  FOREIGN KEY (handled_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_abuse_reports_reporter CHECK ((reporter_child_id IS NULL) <> (reporter_parent_id IS NULL)),
  CONSTRAINT ck_abuse_reports_handled CHECK ((status = 'open') = (handled_at IS NULL)
                                         AND (status = 'open') = (handled_by_admin_id IS NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. AI 聊天 呀哈哈（1 张：只存元数据，不存对话内容；保留 90 天）
-- ---------------------------------------------------------------------
CREATE TABLE ai_chat_usage (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id         BIGINT UNSIGNED NOT NULL,
  principal         ENUM('child','parent') NOT NULL,
  child_id          BIGINT UNSIGNED NULL,
  parent_id         BIGINT UNSIGNED NULL,
  client_request_id CHAR(36)     NOT NULL,
  local_date        DATE         NOT NULL,
  model             VARCHAR(64)  NOT NULL,
  status            ENUM('pending','ok','input_blocked','output_blocked','error','timeout') NOT NULL DEFAULT 'pending',
  filter_category   VARCHAR(32)  NULL,                       -- 命中的过滤类别（不存原文）
  input_chars       SMALLINT UNSIGNED NOT NULL,
  output_chars      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  prompt_tokens     INT UNSIGNED NULL,
  completion_tokens INT UNSIGNED NULL,
  latency_ms        INT UNSIGNED NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_usage_request (family_id, client_request_id),
  KEY ix_ai_usage_child_day (child_id, local_date),
  KEY ix_ai_usage_parent_day (parent_id, local_date),
  KEY ix_ai_usage_created (created_at),
  CONSTRAINT fk_ai_usage_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_ai_usage_parent FOREIGN KEY (family_id, parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_ai_usage_principal CHECK (
       (principal = 'child'  AND child_id IS NOT NULL AND parent_id IS NULL)
    OR (principal = 'parent' AND parent_id IS NOT NULL AND child_id IS NULL)),
  CONSTRAINT ck_ai_usage_filter CHECK ((status IN ('input_blocked','output_blocked')) = (filter_category IS NOT NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. 家长管控 parent controls（3 张）
-- ---------------------------------------------------------------------
CREATE TABLE child_controls (
  child_id             BIGINT UNSIGNED NOT NULL,
  family_id            BIGINT UNSIGNED NOT NULL,
  daily_minutes        SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  allowed_start        TIME         NOT NULL DEFAULT '07:00:00',
  allowed_end          TIME         NOT NULL DEFAULT '21:00:00',
  ai_daily_limit       TINYINT UNSIGNED NOT NULL DEFAULT 20,  -- 0 = 关闭呀哈哈
  leaderboard_opt_out  TINYINT(1)   NOT NULL DEFAULT 0,
  version              INT UNSIGNED NOT NULL DEFAULT 1,      -- 课程开放覆盖变化也递增此版本
  updated_by_parent_id BIGINT UNSIGNED NULL,
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (child_id),
  CONSTRAINT fk_child_controls_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_child_controls_parent FOREIGN KEY (family_id, updated_by_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_child_controls_minutes CHECK (daily_minutes BETWEEN 10 AND 300),
  CONSTRAINT ck_child_controls_window CHECK (allowed_start < allowed_end),
  CONSTRAINT ck_child_controls_ai CHECK (ai_daily_limit <= 100)
) ENGINE=InnoDB;

CREATE TABLE course_overrides (
  child_id             BIGINT UNSIGNED NOT NULL,
  course_id            VARCHAR(64)  NOT NULL,
  family_id            BIGINT UNSIGNED NOT NULL,
  mode                 ENUM('open','closed') NOT NULL,      -- open：额外开放高年级课程；closed：关闭本年级某课程
  created_by_parent_id BIGINT UNSIGNED NOT NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (child_id, course_id),
  CONSTRAINT fk_course_overrides_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_course_overrides_course FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT fk_course_overrides_parent FOREIGN KEY (family_id, created_by_parent_id) REFERENCES parents (family_id, id)
) ENGINE=InnoDB;

CREATE TABLE usage_days (
  child_id              BIGINT UNSIGNED NOT NULL,
  usage_date            DATE         NOT NULL,               -- 家庭时区日期
  family_id             BIGINT UNSIGNED NOT NULL,
  used_seconds          INT UNSIGNED NOT NULL DEFAULT 0,
  bonus_minutes         SMALLINT UNSIGNED NOT NULL DEFAULT 0, -- 家长“再玩 15 分钟”累计
  window_extended_until DATETIME(3)  NULL,                   -- 时段外临时延长截止时刻
  last_heartbeat_at     DATETIME(3)  NULL,
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (child_id, usage_date),
  CONSTRAINT fk_usage_days_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT ck_usage_days_seconds CHECK (used_seconds <= 86400),
  CONSTRAINT ck_usage_days_bonus CHECK (bonus_minutes <= 120 AND MOD(bonus_minutes, 15) = 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. 报告通知 reports & notifications（2 张）
-- ---------------------------------------------------------------------
CREATE TABLE daily_reports (                                 -- 每晚聚合，幂等重算（UPSERT）
  child_id          BIGINT UNSIGNED NOT NULL,
  report_date       DATE         NOT NULL,
  family_id         BIGINT UNSIGNED NOT NULL,
  active_seconds    INT UNSIGNED NOT NULL DEFAULT 0,
  attempts_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  levels_passed     SMALLINT UNSIGNED NOT NULL DEFAULT 0,      -- 当天首次通关的关卡数
  scored_questions  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  correct_questions SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  review_done_items SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  review_completed  TINYINT(1)   NOT NULL DEFAULT 0,
  stars_in          INT UNSIGNED NOT NULL DEFAULT 0,
  stars_out         INT UNSIGNED NOT NULL DEFAULT 0,
  top_missed        JSON         NOT NULL,                   -- [{wordId, misses}]，最多 5 个
  ai_messages       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ai_filter_hits    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  generated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (child_id, report_date),
  KEY ix_daily_reports_family (family_id, report_date),
  CONSTRAINT fk_daily_reports_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT ck_daily_reports_correct CHECK (correct_questions <= scored_questions)
) ENGINE=InnoDB;

CREATE TABLE email_outbox (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id       BIGINT UNSIGNED NULL,
  parent_id       BIGINT UNSIGNED NULL,
  kind            ENUM('verify_email','reset_password','invite_parent','family_signup','weekly_report','admin_alert') NOT NULL,
  dedupe_key      VARCHAR(96)  NOT NULL,                     -- 如 weekly:12:2026-W43，防重复入队
  to_email        VARCHAR(254) NOT NULL,
  subject         VARCHAR(150) NOT NULL,
  body_html       MEDIUMTEXT   NULL,                         -- 发送成功后清空（避免库里留存令牌链接）
  body_text       MEDIUMTEXT   NULL,
  status          ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_error      VARCHAR(255) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  sent_at         DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_outbox_dedupe (dedupe_key),
  KEY ix_email_outbox_due (status, next_attempt_at),
  CONSTRAINT fk_email_outbox_parent FOREIGN KEY (family_id, parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_email_outbox_attempts CHECK (attempts <= 10),
  CONSTRAINT ck_email_outbox_sent CHECK ((status = 'sent') = (sent_at IS NOT NULL)),
  CONSTRAINT ck_email_outbox_body CHECK (status = 'sent' OR body_html IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. 平台 platform（3 张）
-- ---------------------------------------------------------------------
CREATE TABLE system_settings (
  setting_key         VARCHAR(64) NOT NULL,
  value               JSON        NOT NULL,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_system_settings_admin FOREIGN KEY (updated_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_system_settings_key CHECK (setting_key IN ('ai.enabled','ai.model','registration.mode','content.pack_version'))
) ENGINE=InnoDB;

CREATE TABLE idempotency_requests (                          -- 所有需登录的写请求：同一客户端请求 ID 只执行一次
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_type        ENUM('parent','child','admin') NOT NULL,
  actor_id          BIGINT UNSIGNED NOT NULL,
  client_request_id CHAR(36)     NOT NULL,
  operation         VARCHAR(48)  NOT NULL,                   -- 如 learning.submitAttempt
  request_hash      BINARY(32)   NOT NULL,                   -- 规范化请求体的 SHA-256；同 ID 不同请求体 => 409
  response_status   SMALLINT UNSIGNED NOT NULL,              -- 事务开始时写 202 占位，提交前改为最终 2xx
  response_body     JSON         NOT NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_idempotency (actor_type, actor_id, client_request_id),
  KEY ix_idempotency_created (created_at),
  CONSTRAINT ck_idempotency_request_id CHECK (REGEXP_LIKE(client_request_id, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'c')),
  CONSTRAINT ck_idempotency_status CHECK (response_status BETWEEN 200 AND 299)   -- 只记住成功结果；业务错误回滚、不占用请求 ID
) ENGINE=InnoDB;

CREATE TABLE schema_migrations (                             -- 迁移工具记账（只由 migrator 写）
  version    VARCHAR(32) NOT NULL,                           -- 如 V001
  checksum   CHAR(64)    NOT NULL,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (version)
) ENGINE=InnoDB;

INSERT INTO system_settings (setting_key, value) VALUES
  ('ai.enabled',           CAST('true' AS JSON)),
  ('ai.model',             CAST('"default"' AS JSON)),
  ('registration.mode',    CAST('"invite"' AS JSON)),
  ('content.pack_version', CAST('null' AS JSON));
INSERT INTO schema_migrations (version, checksum) VALUES ('0001', REPEAT('0', 64));

