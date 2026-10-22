-- =====================================================================
-- 0001_init.sql —— 星芽学园首个数据库迁移
-- 【草案，设计文档评审通过前可能调整】
-- 因尚未部署任何环境，2026-10-21 的设计变更（数据库课程与版本、共享词库、题目可见/答案分离、
-- 伙伴、呀哈哈发现、AI 工作室、碎片币种、Skill 与 AI 角色、课程与关卡之间的单元层）直接修订本文件，
-- 而不是追加新的迁移文件。
-- 内容层级：年级 > 课程（一册，如 en-g1-a = 一年级上册）> 单元（unit_key 如 u03）> 关卡 > 题目；
-- 发布与版本以课程为单位，课程版本包含它的全部单元（ADR 0016）。
-- 设计说明：docs/03-design/data-model.md；角色与授权：db/roles.sql；验证：db/verify/
-- 目标：MySQL 8.4 LTS，InnoDB，utf8mb4；所有时间列存 UTC（连接 time_zone='+00:00'）
-- 执行：首次初始化时第 0 段（CREATE DATABASE）需要 root；之后的迁移由 migrator 账号按文件名顺序
--       （NNNN_名称.sql）应用，只前进。
-- 约定：
--   * 业务表都带 family_id，并用 (family_id, child_id) 复合外键把行“钉”在同一家庭；
--   * 外键一律 RESTRICT（不级联删除）；孩子/家长只停用不硬删；
--   * 只追加表（ledger、attempts、review_sessions、gifts、audit_events、yahaha_finds，
--     以及已发布课程版本 course_versions、units、levels、questions、question_answers）
--     对应用账号只授予 SELECT, INSERT（见 db/roles.sql），没有 UPDATE/DELETE；
--   * 课程编辑只发生在 course_drafts；发布 = 在一个事务内插入新版本行 + 切换 courses.current_version_id。
-- 表数：67（业务 64 + 平台 3）
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 0. 建库（root）
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS xingya CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE xingya;

-- ---------------------------------------------------------------------
-- 1. 家庭账号 family（8 张）
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
  avatar_key         VARCHAR(48)  NOT NULL,                  -- 仓库 seeds/avatars 中的头像键
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
-- 2. AI 工作室 studio（14 张：任务队列、素材库、资料库、月度预算 + 2b 节 Skill 与 AI 角色 10 张）
-- ---------------------------------------------------------------------
CREATE TABLE ai_jobs (                                       -- MySQL 中的后台任务队列（单进程消费）
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind                VARCHAR(32)  NOT NULL,                 -- agent_run（AI 角色运行，§4.10）、publish_audio、material_extract（系统任务）
  status              ENUM('queued','running','succeeded','failed','cancelled') NOT NULL DEFAULT 'queued',
  running_slot        TINYINT UNSIGNED NULL,                 -- 运行中必须占用 1 或 2 号槽位：数据库保证最多 2 个并发任务
  needs_local         TINYINT(1)   NOT NULL DEFAULT 0,       -- 需要在本机启动 Piper/ffmpeg 一次性进程
  local_slot          TINYINT(1)   AS (IF(status = 'running' AND needs_local = 1, 1, NULL)) STORED,
  owner_ref           VARCHAR(64)  NULL,                     -- 如 course_draft:12、pet_species:3、yahaha_style:5、drop_rule:7
  params              JSON         NOT NULL,
  result              JSON         NULL,
  error               VARCHAR(500) NULL,
  estimated_cost_fen  INT UNSIGNED NOT NULL DEFAULT 0,       -- 入队前展示给系统管理员并预留的费用上限（分）
  actual_cost_fen     INT UNSIGNED NULL,
  budget_month        CHAR(7)      NOT NULL,                 -- 预算月份 YYYY-MM（UTC+8）
  attempts            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_by_admin_id BIGINT UNSIGNED NULL,                  -- NULL = 系统发起（如定时清理）
  queued_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at          DATETIME(3)  NULL,
  heartbeat_at        DATETIME(3)  NULL,                     -- 运行中每 15 秒更新；超过 2 分钟视为中断
  finished_at         DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_jobs_running_slot (running_slot),
  UNIQUE KEY uq_ai_jobs_local_slot (local_slot),             -- 本机进程类任务同一时刻最多 1 个（内存预算）
  KEY ix_ai_jobs_queue (status, queued_at),
  KEY ix_ai_jobs_owner (owner_ref),
  CONSTRAINT fk_ai_jobs_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_ai_jobs_kind CHECK (REGEXP_LIKE(kind, '^[a-z][a-z_]{2,31}$', 'c')),
  CONSTRAINT ck_ai_jobs_slot CHECK (running_slot IS NULL OR running_slot IN (1, 2)),
  CONSTRAINT ck_ai_jobs_running CHECK ((status = 'running') = (running_slot IS NOT NULL)),
  CONSTRAINT ck_ai_jobs_finished CHECK ((status IN ('succeeded','failed','cancelled')) = (finished_at IS NOT NULL)),
  CONSTRAINT ck_ai_jobs_cost CHECK (actual_cost_fen IS NULL OR actual_cost_fen <= estimated_cost_fen),
  CONSTRAINT ck_ai_jobs_attempts CHECK (attempts <= 3),
  CONSTRAINT ck_ai_jobs_month CHECK (REGEXP_LIKE(budget_month, '^[0-9]{4}-(0[1-9]|1[0-2])$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE ai_budget_months (                              -- 每月 AI 生成预算：预留 + 已花费 ≤ 上限
  budget_month        CHAR(7)      NOT NULL,
  cap_fen             INT UNSIGNED NOT NULL,
  reserved_fen        INT UNSIGNED NOT NULL DEFAULT 0,       -- 已入队/运行中任务的预估费用
  spent_fen           INT UNSIGNED NOT NULL DEFAULT 0,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (budget_month),
  CONSTRAINT fk_ai_budget_admin FOREIGN KEY (updated_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_ai_budget_month CHECK (REGEXP_LIKE(budget_month, '^[0-9]{4}-(0[1-9]|1[0-2])$', 'c')),
  CONSTRAINT ck_ai_budget_cap CHECK (reserved_fen + spent_fen <= cap_fen)
) ENGINE=InnoDB;

CREATE TABLE assets (                                        -- 素材库：图片、动画清单、音频；文件在 OSS，经 CDN 提供
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind                ENUM('image','animation','audio') NOT NULL,   -- animation = 关键帧图片 + 动效模板的 JSON 清单
  visibility          ENUM('draft','public') NOT NULL DEFAULT 'draft', -- draft：OSS 私有前缀，管理端签名 URL；public：发布时复制到 CDN 前缀
  oss_key             VARCHAR(200) NOT NULL,                 -- 按内容哈希命名
  sha256              BINARY(32)   NOT NULL,
  mime                VARCHAR(48)  NOT NULL,
  bytes               INT UNSIGNED NOT NULL,
  width               SMALLINT UNSIGNED NULL,
  height              SMALLINT UNSIGNED NULL,
  duration_ms         INT UNSIGNED NULL,
  source              ENUM('ai_image','tts','composed','upload') NOT NULL,
  provider            VARCHAR(32)  NULL,                     -- 如 piper、某图像服务
  model               VARCHAR(64)  NULL,
  prompt              VARCHAR(2000) NULL,                    -- AI 生成时的最终提示词（含自动追加的禁止项）
  job_id              BIGINT UNSIGNED NULL,
  status              ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_assets_oss_key (oss_key),
  KEY ix_assets_kind (kind, status, created_at),
  CONSTRAINT fk_assets_job FOREIGN KEY (job_id) REFERENCES ai_jobs (id),
  CONSTRAINT fk_assets_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_assets_size CHECK (
       (kind <> 'image'     OR bytes <= 307200)                -- 图片 ≤ 300 KB（webp）
   AND (kind <> 'audio'     OR bytes <= 204800)                -- 音频 ≤ 200 KB（单声道 MP3）
   AND (kind <> 'animation' OR bytes <= 65536)),             -- 动画清单 ≤ 64 KB（关键帧图片单独计）
  CONSTRAINT ck_assets_prompt CHECK (source <> 'ai_image' OR prompt IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE materials (                                     -- 课程资料库（PDF/Word/PPT/照片/文本）；文件在 OSS 私有前缀
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title               VARCHAR(80)  NOT NULL,
  kind                ENUM('pdf','docx','pptx','image','text') NOT NULL,
  oss_key             VARCHAR(200) NOT NULL,
  sha256              BINARY(32)   NOT NULL,
  bytes               INT UNSIGNED NOT NULL,
  extraction_status   ENUM('pending','done','failed') NOT NULL DEFAULT 'pending',
  extracted_text      MEDIUMTEXT   NULL,                     -- 文本抽取 / 照片 OCR 结果
  uploaded_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_materials_oss_key (oss_key),
  CONSTRAINT fk_materials_admin FOREIGN KEY (uploaded_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_materials_bytes CHECK (bytes BETWEEN 1 AND 20971520),       -- ≤ 20 MB
  CONSTRAINT ck_materials_text CHECK ((extraction_status = 'done') = (extracted_text IS NOT NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2b. Skill 与 AI 角色（studio，10 张；2026-10-21 设计变更 §4.10）
--   技能 = 数据库中的版本化提示词包（无可执行代码）；角色 = 挂载技能的 AI 角色（每次保存 = 新版本）。
--   AI 只产出草稿；没有任何“发布”工具，发布永远由系统管理员在界面确认。
-- ---------------------------------------------------------------------
CREATE TABLE agents (                                        -- AI 角色身份；配置在 agent_versions
  id                  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_key           VARCHAR(48)  NOT NULL,                 -- 如 course-designer、yahaha-captain；永不复用
  audience            ENUM('admin','child','parent') NOT NULL,  -- 服务对象；创建后不可改（列级授权）
  is_system           TINYINT(1)   NOT NULL DEFAULT 0,       -- 迁移写入的 7 个默认角色
  status              ENUM('active','disabled') NOT NULL DEFAULT 'active',
  current_version_id  BIGINT UNSIGNED NULL,                  -- 正在使用的已发布版本；NULL = 尚未发布（不能运行）
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  created_by_admin_id BIGINT UNSIGNED NULL,                  -- NULL = 迁移写入的默认角色
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_agents_key (agent_key),
  UNIQUE KEY uq_agents_id_audience (id, audience),           -- 供复合外键：技能与角色的受众必须一致
  CONSTRAINT fk_agents_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_agents_key CHECK (REGEXP_LIKE(agent_key, '^[a-z][a-z0-9]*(-[a-z0-9]+)*$', 'c') AND CHAR_LENGTH(agent_key) BETWEEN 3 AND 48),
  CONSTRAINT ck_agents_creator CHECK (is_system = 1 OR created_by_admin_id IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE skills (                                        -- 技能身份；内容在 skill_versions
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  skill_key           VARCHAR(64)  NOT NULL,                 -- 如 course-generate、english-practice；与 SKILL.md 的 name 对应
  audience            ENUM('admin','child','parent') NOT NULL,  -- 创建后不可改（列级授权）
  is_system           TINYINT(1)   NOT NULL DEFAULT 0,       -- 系统技能（child-safety）：不能停用
  status              ENUM('active','disabled') NOT NULL DEFAULT 'active',
  current_version_id  BIGINT UNSIGNED NULL,                  -- “跟随最新发布”指向的版本；回滚 = 指回较早的已发布版本
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  created_by_admin_id BIGINT UNSIGNED NULL,                  -- NULL = 系统技能或 seeds:apply 导入的默认技能
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_skills_key (skill_key),
  UNIQUE KEY uq_skills_id_audience (id, audience),
  CONSTRAINT fk_skills_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_skills_key CHECK (REGEXP_LIKE(skill_key, '^[a-z][a-z0-9]*(-[a-z0-9]+)*$', 'c') AND CHAR_LENGTH(skill_key) BETWEEN 3 AND 64),
  CONSTRAINT ck_skills_system_active CHECK (is_system = 0 OR status = 'active')   -- 儿童安全技能不能停用
) ENGINE=InnoDB;

CREATE TABLE skill_versions (                                -- 每次编辑 = 新版本；内容列不可改（列级授权），只改状态与审核
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  skill_id                    INT UNSIGNED NOT NULL,
  audience                    ENUM('admin','child','parent') NOT NULL,   -- 冗余自 skills，复合外键保证一致
  version_no                  SMALLINT UNSIGNED NOT NULL,
  name                        VARCHAR(64)  NOT NULL,
  when_to_use                 VARCHAR(1024) NOT NULL,        -- 何时使用（SKILL.md 的 description）
  instructions                TEXT         NOT NULL,         -- 提示词与步骤（Markdown；SKILL.md 正文）
  input_schema                JSON         NOT NULL,         -- JSON Schema：输入
  output_schema               JSON         NOT NULL,         -- JSON Schema：输出（运行结果必须通过校验）
  allowed_tools               JSON         NOT NULL,         -- 内置工具白名单（名称数组；不存在“发布”类工具）
  resources                   JSON         NOT NULL DEFAULT (JSON_ARRAY()),  -- 参考资料 [{name, kind:'text'|'asset', text?|assetId?, inert?}]
  default_params              JSON         NOT NULL DEFAULT (JSON_OBJECT()), -- 可被角色覆盖的参数及默认值
  preferred_model             VARCHAR(64)  NULL,             -- NULL = 使用角色或系统设置 ai.model
  source                      ENUM('editor','import','seed') NOT NULL,
  import_report               JSON         NULL,             -- 导入时被忽略或作为惰性文本保存的文件（脚本永不执行）
  content_sha256              BINARY(32)   NOT NULL,
  based_on_version_id         BIGINT UNSIGNED NULL,
  status                      ENUM('draft','in_review','published','retired') NOT NULL DEFAULT 'draft',
  created_by_admin_id         BIGINT UNSIGNED NULL,          -- NULL 仅限 source = seed
  reviewed_by_admin_id        BIGINT UNSIGNED NULL,
  reviewed_at                 DATETIME(3)  NULL,
  safety_reviewed_by_admin_id BIGINT UNSIGNED NULL,          -- 面向孩子/家长的技能：单独的儿童安全审核
  safety_reviewed_at          DATETIME(3)  NULL,
  published_at                DATETIME(3)  NULL,
  created_at                  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_skill_versions_no (skill_id, version_no),
  UNIQUE KEY uq_skill_versions_skill_id (skill_id, id),
  KEY ix_skill_versions_status (status),
  CONSTRAINT fk_skill_versions_skill   FOREIGN KEY (skill_id, audience) REFERENCES skills (id, audience),
  CONSTRAINT fk_skill_versions_base    FOREIGN KEY (skill_id, based_on_version_id) REFERENCES skill_versions (skill_id, id),
  CONSTRAINT fk_skill_versions_creator FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_skill_versions_review  FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_skill_versions_safety  FOREIGN KEY (safety_reviewed_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_skill_versions_no CHECK (version_no >= 1),
  CONSTRAINT ck_skill_versions_schemas CHECK (JSON_TYPE(input_schema) = 'OBJECT' AND JSON_TYPE(output_schema) = 'OBJECT'
                                              AND JSON_UNQUOTE(JSON_EXTRACT(output_schema, '$.type')) = 'object'),
  CONSTRAINT ck_skill_versions_tools CHECK (JSON_TYPE(allowed_tools) = 'ARRAY' AND JSON_LENGTH(allowed_tools) <= 20),
  CONSTRAINT ck_skill_versions_resources CHECK (JSON_TYPE(resources) = 'ARRAY' AND JSON_LENGTH(resources) <= 20),
  CONSTRAINT ck_skill_versions_params CHECK (JSON_TYPE(default_params) = 'OBJECT'),
  CONSTRAINT ck_skill_versions_creator CHECK ((source = 'seed') = (created_by_admin_id IS NULL)),
  CONSTRAINT ck_skill_versions_published CHECK (status NOT IN ('published','retired')
                                                OR (published_at IS NOT NULL AND reviewed_by_admin_id IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT ck_skill_versions_safety CHECK (audience = 'admin' OR status NOT IN ('published','retired')
                                             OR (safety_reviewed_by_admin_id IS NOT NULL AND safety_reviewed_at IS NOT NULL))
) ENGINE=InnoDB;

ALTER TABLE skills ADD CONSTRAINT fk_skills_current
  FOREIGN KEY (id, current_version_id) REFERENCES skill_versions (skill_id, id);     -- 当前版本必须属于本技能

CREATE TABLE skill_allowed_agents (                          -- 技能侧角色白名单：只有列入的角色能挂载该技能
  skill_id            INT UNSIGNED NOT NULL,
  agent_id            SMALLINT UNSIGNED NOT NULL,
  audience            ENUM('admin','child','parent') NOT NULL,   -- 两个复合外键同时成立 ⇒ 技能与角色受众一致
  added_by_admin_id   BIGINT UNSIGNED NULL,                  -- NULL = seeds:apply
  revoked_at          DATETIME(3)  NULL,                     -- 撤销后不能再挂载、运行时跳过（历史版本仍可追溯）
  revoked_by_admin_id BIGINT UNSIGNED NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (skill_id, agent_id),
  CONSTRAINT fk_skill_allowed_skill  FOREIGN KEY (skill_id, audience) REFERENCES skills (id, audience),
  CONSTRAINT fk_skill_allowed_agent  FOREIGN KEY (agent_id, audience) REFERENCES agents (id, audience),
  CONSTRAINT fk_skill_allowed_admin  FOREIGN KEY (added_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_skill_allowed_revoker FOREIGN KEY (revoked_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_skill_allowed_revoked CHECK ((revoked_at IS NULL) = (revoked_by_admin_id IS NULL))
) ENGINE=InnoDB;

CREATE TABLE agent_versions (                                -- 角色配置的版本：每次保存 = 新版本；内容与挂载的技能不可改
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id                    SMALLINT UNSIGNED NOT NULL,
  audience                    ENUM('admin','child','parent') NOT NULL,
  version_no                  SMALLINT UNSIGNED NOT NULL,
  name                        VARCHAR(20)  NOT NULL,         -- 如 课程设计师、呀哈哈队长
  avatar_asset_id             BIGINT UNSIGNED NULL,
  description                 VARCHAR(500) NOT NULL,         -- 角色说明（系统提示词中的角色段）
  allowed_tools               JSON         NOT NULL,         -- 角色允许的内置工具；实际可用 = 角色 ∩ 技能 ∩ 受众工具目录
  model                       VARCHAR(64)  NULL,             -- NULL = 系统设置 ai.model
  monthly_budget_fen          INT UNSIGNED NOT NULL,         -- 角色月度预算（在全站 AI 预算之内）
  params                      JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  based_on_version_id         BIGINT UNSIGNED NULL,
  status                      ENUM('draft','published','retired') NOT NULL DEFAULT 'draft',
  created_by_admin_id         BIGINT UNSIGNED NULL,          -- NULL = 迁移写入的默认版本
  reviewed_by_admin_id        BIGINT UNSIGNED NULL,
  reviewed_at                 DATETIME(3)  NULL,
  safety_reviewed_by_admin_id BIGINT UNSIGNED NULL,
  safety_reviewed_at          DATETIME(3)  NULL,
  published_at                DATETIME(3)  NULL,
  created_at                  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_agent_versions_no (agent_id, version_no),
  UNIQUE KEY uq_agent_versions_agent_id (agent_id, id),
  UNIQUE KEY uq_agent_versions_id_audience (id, audience),   -- 供 agent_runs / ai_chat_usage 证明受众
  CONSTRAINT fk_agent_versions_agent   FOREIGN KEY (agent_id, audience) REFERENCES agents (id, audience),
  CONSTRAINT fk_agent_versions_base    FOREIGN KEY (agent_id, based_on_version_id) REFERENCES agent_versions (agent_id, id),
  CONSTRAINT fk_agent_versions_avatar  FOREIGN KEY (avatar_asset_id) REFERENCES assets (id),
  CONSTRAINT fk_agent_versions_creator FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_agent_versions_review  FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_agent_versions_safety  FOREIGN KEY (safety_reviewed_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_agent_versions_no CHECK (version_no >= 1),
  CONSTRAINT ck_agent_versions_tools CHECK (JSON_TYPE(allowed_tools) = 'ARRAY' AND JSON_LENGTH(allowed_tools) <= 30),
  CONSTRAINT ck_agent_versions_params CHECK (JSON_TYPE(params) = 'OBJECT'),
  CONSTRAINT ck_agent_versions_budget CHECK (monthly_budget_fen <= 1000000),
  CONSTRAINT ck_agent_versions_published CHECK (status NOT IN ('published','retired')
                                                OR (published_at IS NOT NULL AND reviewed_by_admin_id IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT ck_agent_versions_safety CHECK (audience = 'admin' OR status NOT IN ('published','retired')
                                             OR (safety_reviewed_by_admin_id IS NOT NULL AND safety_reviewed_at IS NOT NULL))
) ENGINE=InnoDB;

ALTER TABLE agents ADD CONSTRAINT fk_agents_current
  FOREIGN KEY (id, current_version_id) REFERENCES agent_versions (agent_id, id);     -- 当前版本必须属于本角色

CREATE TABLE agent_skills (                                  -- 角色版本挂载的技能（随角色版本保存，不可改）
  agent_version_id        BIGINT UNSIGNED NOT NULL,
  agent_id                SMALLINT UNSIGNED NOT NULL,
  skill_id                INT UNSIGNED NOT NULL,
  pinned_skill_version_id BIGINT UNSIGNED NULL,              -- NULL = 跟随技能当前发布版本；否则固定此版本
  priority                TINYINT UNSIGNED NOT NULL,         -- 1 最先；指令冲突时数字小者优先（系统安全守则永远在最前）
  overrides               JSON         NOT NULL DEFAULT (JSON_OBJECT()),  -- 角色级参数覆盖（只能覆盖技能 default_params 中的键）
  PRIMARY KEY (agent_version_id, skill_id),
  UNIQUE KEY uq_agent_skills_priority (agent_version_id, priority),
  CONSTRAINT fk_agent_skills_version FOREIGN KEY (agent_id, agent_version_id) REFERENCES agent_versions (agent_id, id),
  CONSTRAINT fk_agent_skills_allowed FOREIGN KEY (skill_id, agent_id) REFERENCES skill_allowed_agents (skill_id, agent_id),
  CONSTRAINT fk_agent_skills_pin     FOREIGN KEY (skill_id, pinned_skill_version_id) REFERENCES skill_versions (skill_id, id),
  CONSTRAINT ck_agent_skills_priority CHECK (priority BETWEEN 1 AND 50),
  CONSTRAINT ck_agent_skills_overrides CHECK (JSON_TYPE(overrides) = 'OBJECT')
) ENGINE=InnoDB;

CREATE TABLE agent_budget_months (                           -- 角色月度预算：与全站 ai_budget_months 在同一事务内一起预留
  agent_id     SMALLINT UNSIGNED NOT NULL,
  budget_month CHAR(7)      NOT NULL,
  cap_fen      INT UNSIGNED NOT NULL,                        -- 本月首次使用时取当前版本的 monthly_budget_fen
  reserved_fen INT UNSIGNED NOT NULL DEFAULT 0,
  spent_fen    INT UNSIGNED NOT NULL DEFAULT 0,
  version      INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (agent_id, budget_month),
  KEY ix_agent_budget_month (budget_month),
  CONSTRAINT fk_agent_budget_agent FOREIGN KEY (agent_id) REFERENCES agents (id),
  CONSTRAINT fk_agent_budget_month FOREIGN KEY (budget_month) REFERENCES ai_budget_months (budget_month),  -- 必须有全站预算月份
  CONSTRAINT ck_agent_budget_cap CHECK (reserved_fen + spent_fen <= cap_fen)
) ENGINE=InnoDB;

CREATE TABLE quick_tasks (                                   -- 保存的快捷任务：一句话 + 目标角色或多角色流水线（只限管理端角色）
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(40)  NOT NULL,
  page                VARCHAR(32)  NOT NULL,                 -- 显示在哪个后台页面（courses、pets、yahaha、rules、stats…）
  target              ENUM('agent','pipeline') NOT NULL,
  agent_id            SMALLINT UNSIGNED NULL,
  role_audience       ENUM('admin','child','parent') NOT NULL DEFAULT 'admin',
  plan                JSON         NULL,                     -- 流水线：[{agentKey, instruction?}]，2–6 步
  instruction         VARCHAR(1000) NOT NULL,
  params              JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  status              ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_quick_tasks_name (page, name),
  CONSTRAINT fk_quick_tasks_agent FOREIGN KEY (agent_id, role_audience) REFERENCES agents (id, audience),
  CONSTRAINT fk_quick_tasks_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_quick_tasks_admin_only CHECK (role_audience = 'admin'),
  CONSTRAINT ck_quick_tasks_page CHECK (REGEXP_LIKE(page, '^[a-z][a-z-]{1,31}$', 'c')),
  CONSTRAINT ck_quick_tasks_target CHECK (
       (target = 'agent'    AND agent_id IS NOT NULL AND plan IS NULL)
    OR (target = 'pipeline' AND agent_id IS NULL AND JSON_TYPE(plan) = 'ARRAY' AND JSON_LENGTH(plan) BETWEEN 2 AND 6)),
  CONSTRAINT ck_quick_tasks_params CHECK (JSON_TYPE(params) = 'OBJECT')
) ENGINE=InnoDB;

CREATE TABLE agent_runs (                                    -- 管理端 AI 运行：单角色任务、流水线、流水线步骤、技能试运行
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind               ENUM('task','pipeline','pipeline_step','test') NOT NULL,
  agent_id           SMALLINT UNSIGNED NULL,
  agent_version_id   BIGINT UNSIGNED NULL,                   -- 运行时固定的角色版本
  role_audience      ENUM('admin','child','parent') NOT NULL DEFAULT 'admin',
  skill_version_id   BIGINT UNSIGNED NULL,                   -- 选中的技能版本（test：被测版本）
  parent_run_id      BIGINT UNSIGNED NULL,                   -- pipeline_step 所属的流水线
  step_no            TINYINT UNSIGNED NULL,                  -- 流水线第几步（1–6）
  plan               JSON         NULL,                      -- pipeline：[{agentKey, instruction?}]
  job_id             BIGINT UNSIGNED NULL,                   -- ai_jobs 中 kind = agent_run 的任务
  page               VARCHAR(32)  NULL,                      -- 从哪个后台页面的一句话框发起
  instruction        VARCHAR(1000) NOT NULL,                 -- 系统管理员的一句话（作为数据段传入，不作为系统指令）
  input              JSON         NOT NULL,
  output             JSON         NULL,                      -- 已通过技能输出模式校验；只含草稿引用与说明
  error              VARCHAR(500) NULL,
  status             ENUM('queued','running','waiting','succeeded','failed','cancelled') NOT NULL DEFAULT 'queued',
  estimated_cost_fen INT UNSIGNED NOT NULL DEFAULT 0,
  actual_cost_fen    INT UNSIGNED NULL,
  budget_month       CHAR(7)      NOT NULL,
  step_count         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  latency_ms         INT UNSIGNED NULL,
  cloned_from_run_id BIGINT UNSIGNED NULL,                   -- 从历史任务克隆重跑
  quick_task_id      INT UNSIGNED NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at         DATETIME(3)  NULL,
  finished_at        DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agent_runs_step (parent_run_id, step_no),
  UNIQUE KEY uq_agent_runs_job (job_id),
  KEY ix_agent_runs_agent (agent_id, created_at),
  KEY ix_agent_runs_skill (skill_version_id, created_at),
  KEY ix_agent_runs_created (created_at),
  CONSTRAINT fk_agent_runs_version  FOREIGN KEY (agent_id, agent_version_id) REFERENCES agent_versions (agent_id, id),
  CONSTRAINT fk_agent_runs_audience FOREIGN KEY (agent_version_id, role_audience) REFERENCES agent_versions (id, audience),
  CONSTRAINT fk_agent_runs_skill    FOREIGN KEY (skill_version_id) REFERENCES skill_versions (id),
  CONSTRAINT fk_agent_runs_parent   FOREIGN KEY (parent_run_id) REFERENCES agent_runs (id),
  CONSTRAINT fk_agent_runs_clone    FOREIGN KEY (cloned_from_run_id) REFERENCES agent_runs (id),
  CONSTRAINT fk_agent_runs_job      FOREIGN KEY (job_id) REFERENCES ai_jobs (id),
  CONSTRAINT fk_agent_runs_quick    FOREIGN KEY (quick_task_id) REFERENCES quick_tasks (id),
  CONSTRAINT fk_agent_runs_admin    FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_agent_runs_admin_only CHECK (role_audience = 'admin'),     -- 孩子对话不进入运行记录（不存对话文本）
  CONSTRAINT ck_agent_runs_shape CHECK (
       (kind = 'test'          AND skill_version_id IS NOT NULL AND parent_run_id IS NULL AND step_no IS NULL AND plan IS NULL)
    OR (kind = 'task'          AND agent_version_id IS NOT NULL AND parent_run_id IS NULL AND step_no IS NULL AND plan IS NULL)
    OR (kind = 'pipeline'      AND agent_id IS NULL AND agent_version_id IS NULL AND parent_run_id IS NULL AND step_no IS NULL
                               AND job_id IS NULL AND JSON_TYPE(plan) = 'ARRAY' AND JSON_LENGTH(plan) BETWEEN 2 AND 6)
    OR (kind = 'pipeline_step' AND agent_version_id IS NOT NULL AND parent_run_id IS NOT NULL AND step_no BETWEEN 1 AND 6 AND plan IS NULL)),
  CONSTRAINT ck_agent_runs_steps CHECK (step_count <= 20),               -- 工具循环最多 20 步
  CONSTRAINT ck_agent_runs_cost CHECK (actual_cost_fen IS NULL OR actual_cost_fen <= estimated_cost_fen),
  CONSTRAINT ck_agent_runs_finished CHECK ((status IN ('succeeded','failed','cancelled')) = (finished_at IS NOT NULL)),
  CONSTRAINT ck_agent_runs_month CHECK (REGEXP_LIKE(budget_month, '^[0-9]{4}-(0[1-9]|1[0-2])$', 'c')),
  CONSTRAINT ck_agent_runs_input CHECK (JSON_TYPE(input) = 'OBJECT')
) ENGINE=InnoDB;

CREATE TABLE agent_run_steps (                               -- 每一步的记录（不可改；180 天后整行清理，汇总留在 agent_runs）
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id           BIGINT UNSIGNED NOT NULL,
  step_no          TINYINT UNSIGNED NOT NULL,
  kind             ENUM('route','llm','tool','validate','guard') NOT NULL,   -- guard：禁止词与输出安全检查
  skill_version_id BIGINT UNSIGNED NULL,
  tool_name        VARCHAR(64)  NULL,
  model            VARCHAR(64)  NULL,
  status           ENUM('ok','error','blocked','timeout') NOT NULL,
  input            JSON         NULL,
  output           JSON         NULL,
  cost_fen         INT UNSIGNED NOT NULL DEFAULT 0,
  latency_ms       INT UNSIGNED NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_agent_run_steps_no (run_id, step_no),
  CONSTRAINT fk_agent_run_steps_run   FOREIGN KEY (run_id) REFERENCES agent_runs (id),
  CONSTRAINT fk_agent_run_steps_skill FOREIGN KEY (skill_version_id) REFERENCES skill_versions (id),
  CONSTRAINT ck_agent_run_steps_no CHECK (step_no BETWEEN 1 AND 20),
  CONSTRAINT ck_agent_run_steps_tool CHECK ((kind = 'tool') = (tool_name IS NOT NULL)),
  CONSTRAINT ck_agent_run_steps_model CHECK (kind NOT IN ('route','llm') OR model IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. 课程内容 content（9 张：共享词库 + 数据库课程、版本与单元；已发布版本只追加、不可改）
-- ---------------------------------------------------------------------
CREATE TABLE words (                                         -- 共享词库：拼写形式
  id             VARCHAR(64)  NOT NULL,                      -- 稳定词 ID，如 en.apple、en.ice-cream；永不改义、永不复用
  subject        VARCHAR(16)  NOT NULL,
  text           VARCHAR(64)  COLLATE utf8mb4_0900_as_cs NOT NULL,
  phonetic       VARCHAR(64)  NULL,
  audio_asset_id BIGINT UNSIGNED NULL,                       -- 发布时由 Piper 一次性生成的标准音
  status         ENUM('draft','active','retired') NOT NULL DEFAULT 'draft',  -- draft：AI 生成的候选，课程发布时转 active
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_words_text (subject, text),
  CONSTRAINT fk_words_audio FOREIGN KEY (audio_asset_id) REFERENCES assets (id),
  CONSTRAINT ck_words_id CHECK (REGEXP_LIKE(id, '^[a-z]{2}\\.[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_words_subject CHECK (REGEXP_LIKE(subject, '^[a-z]{2,16}$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE word_senses (                                   -- 义项：复习进度绑定在义项上
  id             VARCHAR(96)  NOT NULL,                      -- 如 en.bat.animal、en.apple.fruit；以所属词 ID 为前缀
  word_id        VARCHAR(64)  NOT NULL,
  pos            VARCHAR(16)  NULL,
  meaning_zh     VARCHAR(64)  NOT NULL,
  example_en     VARCHAR(200) NULL,
  example_zh     VARCHAR(200) NULL,
  image_asset_id BIGINT UNSIGNED NULL,
  status         ENUM('draft','active','retired') NOT NULL DEFAULT 'draft',
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_word_senses_word (word_id),
  CONSTRAINT fk_word_senses_word  FOREIGN KEY (word_id) REFERENCES words (id),
  CONSTRAINT fk_word_senses_image FOREIGN KEY (image_asset_id) REFERENCES assets (id),
  CONSTRAINT ck_word_senses_id CHECK (REGEXP_LIKE(id, '^[a-z]{2}\\.[a-z0-9]+(-[a-z0-9]+)*\\.[a-z0-9]+(-[a-z0-9]+)*$', 'c')
                                      AND LEFT(id, CHAR_LENGTH(word_id) + 1) = CONCAT(word_id, '.'))
) ENGINE=InnoDB;

CREATE TABLE courses (                                       -- 课程身份（稳定 ID）；内容在版本里
  id                  VARCHAR(64)  NOT NULL,                 -- 一册一门课，如 en-g1-a（一年级上册）、en-g1-b（下册）
  subject             VARCHAR(16)  NOT NULL,
  grade               TINYINT UNSIGNED NOT NULL,
  sort_order          INT          NOT NULL,
  template_id         VARCHAR(48)  NOT NULL,                 -- 仓库 seeds/course-templates 中的模板 ID
  current_version_id  BIGINT UNSIGNED NULL,                  -- 孩子看到的已发布版本；NULL = 未发布
  status              ENUM('active','retired') NOT NULL DEFAULT 'active',
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_order (subject, grade, sort_order),
  CONSTRAINT fk_courses_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_courses_id CHECK (REGEXP_LIKE(id, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_courses_subject CHECK (REGEXP_LIKE(subject, '^[a-z]{2,16}$', 'c')),
  CONSTRAINT ck_courses_grade CHECK (grade BETWEEN 1 AND 6),
  CONSTRAINT ck_courses_template CHECK (REGEXP_LIKE(template_id, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE course_versions (                               -- 只追加：一次发布 = 一行；已发布版本不可修改
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id             VARCHAR(64)  NOT NULL,
  version_no            SMALLINT UNSIGNED NOT NULL,
  draft_id              BIGINT UNSIGNED NOT NULL,
  template_id           VARCHAR(48)  NOT NULL,
  template_version      SMALLINT UNSIGNED NOT NULL,
  title                 VARCHAR(60)  NOT NULL,
  instruction_lang      ENUM('zh','en') NOT NULL DEFAULT 'zh',
  cover_asset_id        BIGINT UNSIGNED NULL,
  published_by_admin_id BIGINT UNSIGNED NOT NULL,
  published_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_versions_no (course_id, version_no),
  UNIQUE KEY uq_course_versions_course_id (course_id, id),
  UNIQUE KEY uq_course_versions_draft (draft_id),
  CONSTRAINT fk_course_versions_course FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT fk_course_versions_cover  FOREIGN KEY (cover_asset_id) REFERENCES assets (id),
  CONSTRAINT fk_course_versions_admin  FOREIGN KEY (published_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_course_versions_no CHECK (version_no >= 1)
) ENGINE=InnoDB;

ALTER TABLE courses ADD CONSTRAINT fk_courses_current
  FOREIGN KEY (id, current_version_id) REFERENCES course_versions (course_id, id);   -- 当前版本必须属于本课程

CREATE TABLE course_drafts (                                 -- 可编辑草稿：draft → in_review → publishing → published
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id            VARCHAR(64)  NOT NULL,
  base_version_id      BIGINT UNSIGNED NULL,                 -- 从哪个已发布版本复制而来（新课程为 NULL）
  template_id          VARCHAR(48)  NOT NULL,
  template_version     SMALLINT UNSIGNED NOT NULL,
  status               ENUM('draft','in_review','publishing','published','discarded') NOT NULL DEFAULT 'draft',
  open_key             TINYINT(1)   AS (IF(status IN ('draft','in_review','publishing'), 1, NULL)) STORED,
  document             JSON         NOT NULL,                -- 知识清单、单元、关卡、题目（含答案与解析），结构见 course-model.md
  check_report         JSON         NULL,                    -- 自动检查结果：每题红色标记与原因
  check_passed         TINYINT(1)   NOT NULL DEFAULT 0,      -- 最近一次检查无错误且之后未再修改
  created_by_admin_id  BIGINT UNSIGNED NOT NULL,
  submitted_at         DATETIME(3)  NULL,
  reviewed_by_admin_id BIGINT UNSIGNED NULL,
  published_version_id BIGINT UNSIGNED NULL,
  version              INT UNSIGNED NOT NULL DEFAULT 1,      -- 乐观锁
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_drafts_open (course_id, open_key),    -- 每门课同时最多一份未完成草稿
  CONSTRAINT fk_course_drafts_course    FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT fk_course_drafts_base      FOREIGN KEY (course_id, base_version_id) REFERENCES course_versions (course_id, id),
  CONSTRAINT fk_course_drafts_published FOREIGN KEY (course_id, published_version_id) REFERENCES course_versions (course_id, id),
  CONSTRAINT fk_course_drafts_creator   FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_course_drafts_reviewer  FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_course_drafts_checked CHECK (status IN ('draft','discarded') OR check_passed = 1),
  CONSTRAINT ck_course_drafts_submitted CHECK (status IN ('draft','discarded') OR submitted_at IS NOT NULL),
  CONSTRAINT ck_course_drafts_reviewed CHECK (status NOT IN ('publishing','published') OR reviewed_by_admin_id IS NOT NULL),
  CONSTRAINT ck_course_drafts_published CHECK ((status = 'published') = (published_version_id IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE units (                                         -- 只追加：单元（一个主题）属于某个已发布版本；单元内关卡数由模板规定（默认 3–6，Q26）
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_version_id BIGINT UNSIGNED NOT NULL,
  unit_key          VARCHAR(32)  NOT NULL,                   -- 跨版本稳定（如 u03）；单元进度按 (课程, unit_key) 记录
  seq               SMALLINT UNSIGNED NOT NULL,              -- 课程内顺序；单元按顺序解锁
  title             VARCHAR(60)  NOT NULL,                   -- 如 Unit 3 Animals
  title_zh          VARCHAR(60)  NULL,                       -- 如 动物
  cover_asset_id    BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_key (course_version_id, unit_key),
  UNIQUE KEY uq_units_seq (course_version_id, seq),
  UNIQUE KEY uq_units_version_id (course_version_id, id),   -- 供关卡复合外键：关卡的单元必须属于同一版本
  CONSTRAINT fk_units_version FOREIGN KEY (course_version_id) REFERENCES course_versions (id),
  CONSTRAINT fk_units_cover   FOREIGN KEY (cover_asset_id) REFERENCES assets (id),
  CONSTRAINT ck_units_key CHECK (REGEXP_LIKE(unit_key, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_units_seq CHECK (seq >= 1)
) ENGINE=InnoDB;

CREATE TABLE levels (                                        -- 只追加：属于某个已发布版本的某个单元
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_version_id BIGINT UNSIGNED NOT NULL,
  unit_id           BIGINT UNSIGNED NOT NULL,
  level_key         VARCHAR(32)  NOT NULL,                   -- 单元内跨版本稳定（如 l01）；进度按 (课程, unit_key, level_key) 记录
  seq               SMALLINT UNSIGNED NOT NULL,              -- 单元内顺序；关卡在单元内按顺序解锁
  title             VARCHAR(60)  NOT NULL,
  scene_asset_id    BIGINT UNSIGNED NULL,                    -- 关卡地图场景图（藏匿点所在）
  pages             JSON         NULL,                       -- 绘本阅读课的分页内容（图、句、音频）
  hiding_spots      JSON         NOT NULL,                   -- 场景中的 3 个藏匿点定义 [{kind, x, y}]（呀哈哈发现用）
  PRIMARY KEY (id),
  UNIQUE KEY uq_levels_key (unit_id, level_key),            -- level_key 在单元内唯一（不同单元都可以有 l01）
  UNIQUE KEY uq_levels_seq (unit_id, seq),
  UNIQUE KEY uq_levels_version_id (course_version_id, id),
  CONSTRAINT fk_levels_unit  FOREIGN KEY (course_version_id, unit_id) REFERENCES units (course_version_id, id),
  CONSTRAINT fk_levels_scene FOREIGN KEY (scene_asset_id) REFERENCES assets (id),
  CONSTRAINT ck_levels_key CHECK (REGEXP_LIKE(level_key, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_levels_seq CHECK (seq >= 1),
  CONSTRAINT ck_levels_spots CHECK (JSON_TYPE(hiding_spots) = 'ARRAY' AND JSON_LENGTH(hiding_spots) = 3)
) ENGINE=InnoDB;

CREATE TABLE questions (                                     -- 只追加：孩子可见部分（作答前只下发这一部分）
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level_id     BIGINT UNSIGNED NOT NULL,
  question_key VARCHAR(32)  NOT NULL,                        -- 关卡内稳定键
  seq          TINYINT UNSIGNED NOT NULL,
  type         VARCHAR(24)  NOT NULL,                        -- 9 种题型，见 learning 需求 §4.1.3
  scored       TINYINT(1)   NOT NULL,
  sense_id     VARCHAR(96)  NULL,                            -- 考查的义项（句型/阅读题可为空）
  visible      JSON         NOT NULL,                        -- 题干、选项（带选项 ID）、资源 ID；不得含答案字段
  PRIMARY KEY (id),
  UNIQUE KEY uq_questions_key (level_id, question_key),
  UNIQUE KEY uq_questions_seq (level_id, seq),
  CONSTRAINT fk_questions_level FOREIGN KEY (level_id) REFERENCES levels (id),
  CONSTRAINT fk_questions_sense FOREIGN KEY (sense_id) REFERENCES word_senses (id),
  CONSTRAINT ck_questions_type CHECK (REGEXP_LIKE(type, '^[a-z_]{3,24}$', 'c')),
  CONSTRAINT ck_questions_seq CHECK (seq BETWEEN 1 AND 8),
  CONSTRAINT ck_questions_scored CHECK (scored = IF(type = 'read_aloud', 0, 1)),
  CONSTRAINT ck_questions_visible CHECK (JSON_TYPE(visible) = 'OBJECT'
    AND NOT JSON_CONTAINS_PATH(visible, 'one', '$.answer', '$.accept', '$.explanation', '$.correct', '$.correctOptionId'))
) ENGINE=InnoDB;

CREATE TABLE question_answers (                              -- 只追加：答案与解析，单独存放，作答前从不下发
  question_id  BIGINT UNSIGNED NOT NULL,
  answer       JSON         NOT NULL,                        -- 选项 ID / 排序后的选项 ID 数组 / 拼写答案与 accept[]
  explanation  VARCHAR(500) NULL,
  PRIMARY KEY (question_id),
  CONSTRAINT fk_question_answers_question FOREIGN KEY (question_id) REFERENCES questions (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. 学习 learning（6 张）
-- ---------------------------------------------------------------------
CREATE TABLE plays (                                         -- 一次作答（闯关或复习）：下发可见题目，逐题记录第一次作答
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id         BIGINT UNSIGNED NOT NULL,
  child_id          BIGINT UNSIGNED NOT NULL,
  kind              ENUM('level','review') NOT NULL,
  course_version_id BIGINT UNSIGNED NULL,                    -- 开始时的版本；作答在该版本上完成
  level_id          BIGINT UNSIGNED NULL,
  client_request_id CHAR(36)     NOT NULL,
  local_date        DATE         NOT NULL,
  items             JSON         NOT NULL,                   -- 下发的题目 ID、选项顺序（每次打乱）、本次随机选项令牌 ↔ 选项 ID 映射、复习生成题的选项
  responses         JSON         NOT NULL DEFAULT (JSON_OBJECT()),  -- {questionKey: {response, correct}}，每题只记第一次
  status            ENUM('open','finished','expired') NOT NULL DEFAULT 'open',
  started_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at        DATETIME(3)  NOT NULL,
  finished_at       DATETIME(3)  NULL,
  companion_level   TINYINT UNSIGNED NULL,                   -- 开始时跟随伙伴的等级快照（伙伴附赠积分用，ADR 0017）；没有跟随伙伴为 NULL
  PRIMARY KEY (id),
  UNIQUE KEY uq_plays_request (child_id, client_request_id),
  KEY ix_plays_child (child_id, status, started_at),
  KEY ix_plays_family (family_id, child_id),
  CONSTRAINT fk_plays_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_plays_level FOREIGN KEY (course_version_id, level_id) REFERENCES levels (course_version_id, id),
  CONSTRAINT ck_plays_kind CHECK ((kind = 'level') = (level_id IS NOT NULL) AND (level_id IS NULL) = (course_version_id IS NULL)),
  CONSTRAINT ck_plays_finished CHECK ((status = 'finished') = (finished_at IS NOT NULL)),
  CONSTRAINT ck_plays_expiry CHECK (expires_at > started_at),
  CONSTRAINT ck_plays_companion_level CHECK (companion_level IS NULL OR companion_level BETWEEN 1 AND 100),
  CONSTRAINT ck_plays_request_id CHECK (REGEXP_LIKE(client_request_id, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE level_progress (                                -- 按 (课程, unit_key, level_key) 记录，课程改版不丢进度
  family_id       BIGINT UNSIGNED NOT NULL,
  child_id        BIGINT UNSIGNED NOT NULL,
  course_id       VARCHAR(64)  NOT NULL,
  unit_key        VARCHAR(32)  NOT NULL,
  level_key       VARCHAR(32)  NOT NULL,
  best_stars      TINYINT UNSIGNED NOT NULL DEFAULT 0,       -- 最佳星级
  best_accuracy   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  attempts_count  INT UNSIGNED NOT NULL DEFAULT 0,
  first_passed_at DATETIME(3)  NULL,
  last_attempt_at DATETIME(3)  NOT NULL,
  PRIMARY KEY (child_id, course_id, unit_key, level_key),
  KEY ix_level_progress_family (family_id, child_id),
  CONSTRAINT fk_level_progress_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_level_progress_course FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT ck_level_progress_stars CHECK (best_stars BETWEEN 0 AND 3),
  CONSTRAINT ck_level_progress_accuracy CHECK (best_accuracy <= 100),
  CONSTRAINT ck_level_progress_passed CHECK ((best_stars = 0) = (first_passed_at IS NULL))
) ENGINE=InnoDB;

CREATE TABLE unit_progress (                                 -- 单元进度：按 (课程, unit_key) 记录；结算事务内更新
  family_id               BIGINT UNSIGNED NOT NULL,
  child_id                BIGINT UNSIGNED NOT NULL,
  course_id               VARCHAR(64)  NOT NULL,
  unit_key                VARCHAR(32)  NOT NULL,
  level_count             SMALLINT UNSIGNED NOT NULL,        -- 最近一次结算时当前版本中本单元的关卡数
  levels_passed           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  levels_three_star       SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- 最佳星级 = 3 的关卡数
  first_completed_at      DATETIME(3)  NULL,                 -- 首次全部关卡通过：下一单元第一关从此解锁（之后不再收回）
  first_all_three_star_at DATETIME(3)  NULL,                 -- 首次全部关卡 3 星级：触发 unit_first_all_three_star（只一次）
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (child_id, course_id, unit_key),
  KEY ix_unit_progress_family (family_id, child_id),
  CONSTRAINT fk_unit_progress_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_unit_progress_course FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT ck_unit_progress_key CHECK (REGEXP_LIKE(unit_key, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_unit_progress_counts CHECK (level_count >= 1 AND levels_three_star <= levels_passed AND levels_passed <= level_count),
  CONSTRAINT ck_unit_progress_three_star CHECK (first_all_three_star_at IS NULL
    OR (first_completed_at IS NOT NULL AND first_all_three_star_at >= first_completed_at))
) ENGINE=InnoDB;

CREATE TABLE attempts (                                      -- 只追加：一次闯关 = 一行
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id         BIGINT UNSIGNED NOT NULL,
  child_id          BIGINT UNSIGNED NOT NULL,
  play_id           BIGINT UNSIGNED NOT NULL,
  course_version_id BIGINT UNSIGNED NOT NULL,
  level_id          BIGINT UNSIGNED NOT NULL,
  activity_date     DATE         NOT NULL,                   -- 家庭时区的本地日期
  scored_count      TINYINT UNSIGNED NOT NULL,
  correct_count     TINYINT UNSIGNED NOT NULL,
  accuracy_pct      TINYINT UNSIGNED AS (FLOOR(correct_count * 100 / scored_count)) STORED,
  stars             TINYINT UNSIGNED AS (CASE WHEN correct_count = scored_count THEN 3
                                              WHEN correct_count * 100 >= scored_count * 90 THEN 2
                                              WHEN correct_count * 100 >= scored_count * 80 THEN 1
                                              ELSE 0 END) STORED,
  passed            TINYINT(1)   AS (correct_count * 100 >= scored_count * 80) STORED,
  stars_awarded     TINYINT UNSIGNED NOT NULL,               -- 本次实际发放的星星（只发提升差额）
  answers           JSON         NOT NULL,                   -- [{questionId, senseId, response, correct}]
  submitted_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_attempts_play (play_id),                      -- 一次作答最多一条闯关记录（重复完成只算一次）
  KEY ix_attempts_child_date (child_id, activity_date),
  KEY ix_attempts_family (family_id, child_id),
  CONSTRAINT fk_attempts_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_attempts_play  FOREIGN KEY (play_id) REFERENCES plays (id),
  CONSTRAINT fk_attempts_level FOREIGN KEY (course_version_id, level_id) REFERENCES levels (course_version_id, id),
  CONSTRAINT ck_attempts_counts CHECK (scored_count BETWEEN 4 AND 8 AND correct_count <= scored_count),
  CONSTRAINT ck_attempts_awarded CHECK (stars_awarded <= 3)
) ENGINE=InnoDB;

CREATE TABLE review_items (                                  -- 间隔复习条目：绑定义项或（无义项时）不可变的题目行
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id        BIGINT UNSIGNED NOT NULL,
  child_id         BIGINT UNSIGNED NOT NULL,
  item_type        ENUM('sense','question') NOT NULL,
  sense_id         VARCHAR(96)  NULL,
  question_id      BIGINT UNSIGNED NULL,
  ref_id           VARCHAR(96)  AS (COALESCE(sense_id, CAST(question_id AS CHAR))) STORED,
  box              TINYINT UNSIGNED NOT NULL DEFAULT 1,       -- 1..6 对应间隔 1,2,4,7,15,30 天
  due_date         DATE         NOT NULL,
  lapses           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_result      ENUM('none','correct','wrong') NOT NULL DEFAULT 'none',
  last_reviewed_at DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_items_ref (child_id, item_type, ref_id),
  KEY ix_review_items_due (child_id, due_date, box),
  CONSTRAINT fk_review_items_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_review_items_sense FOREIGN KEY (sense_id) REFERENCES word_senses (id),
  CONSTRAINT fk_review_items_question FOREIGN KEY (question_id) REFERENCES questions (id),
  CONSTRAINT ck_review_items_ref CHECK (
       (item_type = 'sense'    AND sense_id IS NOT NULL AND question_id IS NULL)
    OR (item_type = 'question' AND question_id IS NOT NULL AND sense_id IS NULL)),
  CONSTRAINT ck_review_items_box CHECK (box BETWEEN 1 AND 6)
) ENGINE=InnoDB;

CREATE TABLE review_sessions (                               -- 只追加：一次复习完成 = 一行
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id         BIGINT UNSIGNED NOT NULL,
  child_id          BIGINT UNSIGNED NOT NULL,
  play_id           BIGINT UNSIGNED NOT NULL,
  review_date       DATE         NOT NULL,
  item_count        TINYINT UNSIGNED NOT NULL,
  correct_count     TINYINT UNSIGNED NOT NULL,
  completes_day     TINYINT(1)   NOT NULL DEFAULT 0,
  completion_date   DATE         AS (IF(completes_day = 1, review_date, NULL)) STORED,
  results           JSON         NOT NULL,                   -- [{reviewItemId, response, correct}]
  submitted_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_sessions_play (play_id),
  UNIQUE KEY uq_review_sessions_completion (child_id, completion_date),   -- 每天最多一次“完成”
  KEY ix_review_sessions_date (child_id, review_date),
  CONSTRAINT fk_review_sessions_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_review_sessions_play  FOREIGN KEY (play_id) REFERENCES plays (id),
  CONSTRAINT ck_review_sessions_counts CHECK (item_count BETWEEN 0 AND 20 AND correct_count <= item_count)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. 星星、碎片与积分 stars（6 张；ledger 只追加：应用账号无 UPDATE/DELETE）
--    积分（currency='point'，ADR 0017）的 delta / balance_after 以 0.01 积分为单位（1 积分 = 100）
-- ---------------------------------------------------------------------
CREATE TABLE ledger (                                        -- 星星、碎片与积分共用的只追加账本；currency 区分币种
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id       BIGINT UNSIGNED NOT NULL,
  child_id        BIGINT UNSIGNED NOT NULL,
  currency        ENUM('star','fragment','point') NOT NULL,  -- 枚举顺序即锁顺序：star → fragment → point
  kind            ENUM('level_pass','review_day','streak','parent_award',
                       'gift_in','gift_out','purchase',
                       'redeem_hold','redeem_release','redeem_debit',
                       'pet_adopt','den_expand','discovery','discovery_bonus',
                       'level_listen','word_listen','review_correct','pet_bonus','point_convert') NOT NULL,
  delta           INT          NOT NULL,
  balance_after   INT          NOT NULL,                     -- 该孩子该币种的余额
  source_key      VARCHAR(96)  NOT NULL,                     -- 业务幂等键，如 attempt:123、frag:level:en-g1-a:u03:l01:2026-10-21、listen:{playId}:{target}、convert:{requestId}
  local_date      DATE         NOT NULL,
  counts_for_leaderboard TINYINT(1) AS (currency = 'star' AND kind IN ('level_pass','streak')) STORED,  -- = “学习星”（复习不发星，ADR 0017）
  actor_parent_id BIGINT UNSIGNED NULL,
  note            VARCHAR(100) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ledger_source (child_id, currency, source_key),
  KEY ix_ledger_child (child_id, currency, id),
  KEY ix_ledger_learning (child_id, counts_for_leaderboard),
  KEY ix_ledger_board (local_date, counts_for_leaderboard, child_id),
  KEY ix_ledger_family (family_id, child_id),
  CONSTRAINT fk_ledger_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_ledger_parent FOREIGN KEY (family_id, actor_parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT ck_ledger_currency_kind CHECK (
       (currency = 'star'     AND kind NOT IN ('discovery','review_day','level_listen','word_listen','review_correct','pet_bonus'))
    OR (currency = 'fragment' AND kind IN ('level_pass','review_day','discovery','pet_adopt'))
    OR (currency = 'point'    AND kind IN ('level_listen','word_listen','review_correct','pet_bonus','point_convert'))),
  CONSTRAINT ck_ledger_sign CHECK (
       (kind IN ('level_pass','review_day','streak','parent_award','gift_in','redeem_release','discovery','discovery_bonus',
                 'level_listen','word_listen','review_correct','pet_bonus') AND delta > 0)
    OR (kind IN ('gift_out','purchase','redeem_hold','redeem_debit','pet_adopt','den_expand') AND delta < 0)
    OR (kind = 'point_convert' AND ((currency = 'star' AND delta > 0) OR (currency = 'point' AND delta < 0)))),  -- 积分换星：积分出、星星入
  CONSTRAINT ck_ledger_ranges CHECK (
       (kind <> 'level_pass'      OR delta BETWEEN 1 AND 3)    -- 星：提升差额 1–3；碎片：本次星级 1–3
   AND (kind <> 'review_day'      OR delta = 2)                -- 只有碎片
   AND (kind NOT IN ('level_listen','word_listen') OR delta = 10)   -- +0.1 积分
   AND (kind <> 'review_correct'  OR delta = 100)              -- 每道答对的复习题 +1 积分
   AND (kind <> 'pet_bonus'       OR delta BETWEEN 10 AND 300) -- 星数 1–3 × 每星 0.10–1.00 积分
   AND (kind <> 'point_convert'   OR (currency = 'star' AND delta BETWEEN 1 AND 1000)
                                  OR (currency = 'point' AND delta BETWEEN -1000000 AND -1000 AND MOD(delta, 1000) = 0))  -- 10 积分 = 1 星
   AND (kind <> 'discovery'       OR delta = 1)
   AND (kind <> 'discovery_bonus' OR delta BETWEEN 1 AND 50)
   AND (kind <> 'parent_award'    OR delta BETWEEN 1 AND 50)
   AND (kind NOT IN ('gift_in','gift_out') OR ABS(delta) BETWEEN 1 AND 20)),
  CONSTRAINT ck_ledger_balance CHECK (balance_after >= 0),
  CONSTRAINT ck_ledger_actor CHECK ((kind = 'parent_award') = (actor_parent_id IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE balances (                                      -- 每孩子每币种余额缓存 + 行锁；每晚对账（积分以 0.01 为单位）
  child_id       BIGINT UNSIGNED NOT NULL,
  currency       ENUM('star','fragment','point') NOT NULL,
  family_id      BIGINT UNSIGNED NOT NULL,
  balance        INT          NOT NULL DEFAULT 0,
  last_ledger_id BIGINT UNSIGNED NULL,
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (child_id, currency),
  CONSTRAINT fk_balances_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_balances_ledger FOREIGN KEY (last_ledger_id) REFERENCES ledger (id),
  CONSTRAINT ck_balances_nonneg CHECK (balance >= 0)
) ENGINE=InnoDB;

CREATE TABLE shop_items (                                    -- 商店装扮（系统管理员维护；伙伴不在商店，由 companion 模块提供）
  id                  VARCHAR(64)  NOT NULL,
  slot                ENUM('head','body','accessory') NOT NULL,
  name                VARCHAR(30)  NOT NULL,
  price               INT UNSIGNED NOT NULL,
  image_asset_id      BIGINT UNSIGNED NOT NULL,
  sort_order          INT          NOT NULL,
  status              ENUM('draft','listed','unlisted') NOT NULL DEFAULT 'draft',  -- 下架后不再出售，已拥有的保留
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_shop_items_image FOREIGN KEY (image_asset_id) REFERENCES assets (id),
  CONSTRAINT fk_shop_items_admin FOREIGN KEY (updated_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_shop_items_id CHECK (REGEXP_LIKE(id, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_shop_items_price CHECK (price BETWEEN 1 AND 1000)
) ENGINE=InnoDB;

CREATE TABLE child_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id          BIGINT UNSIGNED NOT NULL,
  child_id           BIGINT UNSIGNED NOT NULL,
  item_id            VARCHAR(64)  NOT NULL,
  slot               ENUM('head','body','accessory') NOT NULL,   -- 购买时从 shop_items 复制（槽位不可变）
  equipped           TINYINT(1)   NOT NULL DEFAULT 0,
  equipped_slot      VARCHAR(16)  AS (IF(equipped = 1, slot, NULL)) STORED,
  purchase_ledger_id BIGINT UNSIGNED NOT NULL,
  acquired_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_child_items_item (child_id, item_id),
  UNIQUE KEY uq_child_items_equipped (child_id, equipped_slot),
  CONSTRAINT fk_child_items_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_child_items_item FOREIGN KEY (item_id) REFERENCES shop_items (id),
  CONSTRAINT fk_child_items_ledger FOREIGN KEY (purchase_ledger_id) REFERENCES ledger (id)
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
-- 6. 伙伴 companion（5 张）
-- ---------------------------------------------------------------------
CREATE TABLE pet_tiers (                                     -- 档位：价格、领养门槛、等级曲线（系统管理员可配置）
  id                  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(20)  NOT NULL,
  sort_order          SMALLINT     NOT NULL,
  star_price          INT UNSIGNED NOT NULL,
  fragment_price      INT UNSIGNED NOT NULL,
  adoption_threshold  INT UNSIGNED NOT NULL DEFAULT 0,       -- 历史累计“学习星”门槛
  max_level           TINYINT UNSIGNED NOT NULL DEFAULT 30,
  xp_base             SMALLINT UNSIGNED NOT NULL DEFAULT 5,  -- L→L+1 所需经验 = xp_base + xp_step × (L − 1)
  xp_step             SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pet_tiers_name (name),
  CONSTRAINT fk_pet_tiers_admin FOREIGN KEY (updated_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_pet_tiers_prices CHECK (star_price BETWEEN 1 AND 5000 AND fragment_price BETWEEN 1 AND 20000),
  CONSTRAINT ck_pet_tiers_threshold CHECK (adoption_threshold <= 100000),
  CONSTRAINT ck_pet_tiers_curve CHECK (max_level BETWEEN 2 AND 100 AND xp_base BETWEEN 1 AND 1000 AND xp_step <= 1000)
) ENGINE=InnoDB;

CREATE TABLE pet_tier_stages (                               -- 成长阶段（幼苗/探险/守护/星耀…）：换形象、解锁动作
  tier_id          SMALLINT UNSIGNED NOT NULL,
  stage_no         TINYINT UNSIGNED NOT NULL,
  name             VARCHAR(10)  NOT NULL,
  min_level        TINYINT UNSIGNED NOT NULL,
  unlocked_actions JSON         NOT NULL,                    -- 本阶段新解锁的动作，如 ["cheer-jump"]
  PRIMARY KEY (tier_id, stage_no),
  CONSTRAINT fk_pet_tier_stages_tier FOREIGN KEY (tier_id) REFERENCES pet_tiers (id),
  CONSTRAINT ck_pet_tier_stages_no CHECK (stage_no BETWEEN 1 AND 4),
  CONSTRAINT ck_pet_tier_stages_first CHECK (min_level >= 1 AND (stage_no <> 1 OR min_level = 1)),
  CONSTRAINT ck_pet_tier_stages_actions CHECK (JSON_TYPE(unlocked_actions) = 'ARRAY')
) ENGINE=InnoDB;

CREATE TABLE pet_species (                                   -- 伙伴种类：AI 工作室设计 → 审核 → 上架
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  species_key          VARCHAR(48)  NOT NULL,
  name                 VARCHAR(20)  NOT NULL,
  description          VARCHAR(200) NOT NULL,
  tier_id              SMALLINT UNSIGNED NOT NULL,
  status               ENUM('draft','in_review','published','unlisted') NOT NULL DEFAULT 'draft',
  design               JSON         NOT NULL,                -- 基础形象、各阶段图片、动作动画、台词与音频的素材 ID
  voice_id             VARCHAR(48)  NULL,
  voice_pitch          DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  created_by_admin_id  BIGINT UNSIGNED NOT NULL,
  reviewed_by_admin_id BIGINT UNSIGNED NULL,
  published_at         DATETIME(3)  NULL,
  version              INT UNSIGNED NOT NULL DEFAULT 1,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pet_species_key (species_key),
  UNIQUE KEY uq_pet_species_name (name),
  CONSTRAINT fk_pet_species_tier FOREIGN KEY (tier_id) REFERENCES pet_tiers (id),
  CONSTRAINT fk_pet_species_creator FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_pet_species_reviewer FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_pet_species_key CHECK (REGEXP_LIKE(species_key, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_pet_species_pitch CHECK (voice_pitch BETWEEN 0.50 AND 2.00),
  CONSTRAINT ck_pet_species_published CHECK ((status IN ('published','unlisted')) = (published_at IS NOT NULL)
                                             AND (status NOT IN ('published','unlisted') OR reviewed_by_admin_id IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE pet_dens (                                      -- 每个孩子的营地：基础格数来自系统设置，这里记录已扩建格数
  child_id    BIGINT UNSIGNED NOT NULL,
  family_id   BIGINT UNSIGNED NOT NULL,
  extra_slots TINYINT UNSIGNED NOT NULL DEFAULT 0,
  version     INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (child_id),
  CONSTRAINT fk_pet_dens_child FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT ck_pet_dens_extra CHECK (extra_slots <= 10)
) ENGINE=InnoDB;

CREATE TABLE child_pets (                                    -- 孩子拥有的伙伴：不可删除、不可转赠、不可退订
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id        BIGINT UNSIGNED NOT NULL,
  child_id         BIGINT UNSIGNED NOT NULL,
  species_id       BIGINT UNSIGNED NOT NULL,
  level            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  xp               INT UNSIGNED NOT NULL DEFAULT 0,          -- 当前等级内已积累的经验
  total_xp         INT UNSIGNED NOT NULL DEFAULT 0,
  is_companion     TINYINT(1)   NOT NULL DEFAULT 0,          -- 跟随伙伴（每个孩子最多 1 只）
  companion_key    TINYINT(1)   AS (IF(is_companion = 1, 1, NULL)) STORED,
  adopted_with     ENUM('star','fragment') NOT NULL,
  price_paid       INT UNSIGNED NOT NULL,
  adopt_ledger_id  BIGINT UNSIGNED NOT NULL,
  adopted_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_child_pets_species (child_id, species_id),   -- 每种每人 1 只
  UNIQUE KEY uq_child_pets_companion (child_id, companion_key),
  UNIQUE KEY uq_child_pets_ledger (adopt_ledger_id),
  KEY ix_child_pets_family (family_id, child_id),
  CONSTRAINT fk_child_pets_child   FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_child_pets_species FOREIGN KEY (species_id) REFERENCES pet_species (id),
  CONSTRAINT fk_child_pets_ledger  FOREIGN KEY (adopt_ledger_id) REFERENCES ledger (id),
  CONSTRAINT ck_child_pets_level CHECK (level BETWEEN 1 AND 100 AND xp <= total_xp),
  CONSTRAINT ck_child_pets_price CHECK (price_paid >= 1)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. 呀哈哈发现 discovery（5 张）
-- ---------------------------------------------------------------------
CREATE TABLE yahaha_sets (                                   -- 图鉴套组：集齐一套奖励星星
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(20)  NOT NULL,
  bonus_stars TINYINT UNSIGNED NOT NULL DEFAULT 5,
  sort_order  SMALLINT     NOT NULL,
  status      ENUM('draft','listed','unlisted') NOT NULL DEFAULT 'draft',
  version     INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_yahaha_sets_name (name),
  CONSTRAINT ck_yahaha_sets_bonus CHECK (bonus_stars BETWEEN 1 AND 50)
) ENGINE=InnoDB;

CREATE TABLE yahaha_styles (                                 -- 呀哈哈家族的款式
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  style_key            VARCHAR(48)  NOT NULL,
  name                 VARCHAR(20)  NOT NULL,
  set_id               SMALLINT UNSIGNED NOT NULL,
  rarity               ENUM('common','uncommon','rare','legendary') NOT NULL DEFAULT 'common',  -- 决定抽取权重
  per_child_max        TINYINT UNSIGNED NULL,                -- 每个孩子最多拥有几个（NULL = 不限）
  total_stock          INT UNSIGNED NULL,                    -- 全站总量（NULL = 不限）
  placed_total         INT UNSIGNED NOT NULL DEFAULT 0,      -- 已放入藏匿点的数量（含尚未点开的）
  status               ENUM('draft','in_review','published','unlisted') NOT NULL DEFAULT 'draft',
  design               JSON         NOT NULL,                -- 形象、关键帧、发现动画、叫声的素材 ID
  created_by_admin_id  BIGINT UNSIGNED NOT NULL,
  reviewed_by_admin_id BIGINT UNSIGNED NULL,
  published_at         DATETIME(3)  NULL,
  version              INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_yahaha_styles_key (style_key),
  CONSTRAINT fk_yahaha_styles_set FOREIGN KEY (set_id) REFERENCES yahaha_sets (id),
  CONSTRAINT fk_yahaha_styles_creator FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT fk_yahaha_styles_reviewer FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_yahaha_styles_key CHECK (REGEXP_LIKE(style_key, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT ck_yahaha_styles_max CHECK (per_child_max IS NULL OR per_child_max BETWEEN 1 AND 100),
  CONSTRAINT ck_yahaha_styles_stock CHECK (total_stock IS NULL OR (total_stock >= 1 AND placed_total <= total_stock)),
  CONSTRAINT ck_yahaha_styles_published CHECK ((status IN ('published','unlisted')) = (published_at IS NOT NULL)
                                               AND (status NOT IN ('published','unlisted') OR reviewed_by_admin_id IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE drop_rules (                                    -- 投放规则：限时活动规则 / 课程设定规则（AI 只负责填写，服务端校验）
                                                             -- 范围 spec.scope.targets：[{courseId, unitKey?, levelKey?}]，可指向课程、单元或关卡
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(40)  NOT NULL,
  rule_type           ENUM('campaign','course') NOT NULL,
  status              ENUM('draft','published','paused','ended') NOT NULL DEFAULT 'draft',
  source_text         VARCHAR(500) NULL,                     -- 系统管理员的一句话描述（可空：直接用表单创建）
  spec                JSON         NOT NULL,                 -- 完整结构化规则（固定模式，见 discovery 设计）
  trigger_type        ENUM('level_pass','unit_first_all_three_star','specific_level_pass','streak_days') NOT NULL,
  effect              ENUM('raise_probability','restrict_styles','guaranteed') NOT NULL,
  probability_pct     TINYINT UNSIGNED NULL,                 -- 每个藏匿点的命中概率 1–100
  daily_cap           TINYINT UNSIGNED NULL,                 -- 每孩子每日上限 1–10
  total_quantity      INT UNSIGNED NULL,                     -- 本规则总投放量（NULL = 不限）
  consumed_quantity   INT UNSIGNED NOT NULL DEFAULT 0,
  starts_at           DATETIME(3)  NOT NULL,
  ends_at             DATETIME(3)  NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  published_at        DATETIME(3)  NULL,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_drop_rules_active (status, starts_at, ends_at),
  CONSTRAINT fk_drop_rules_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_drop_rules_probability CHECK (probability_pct IS NULL OR probability_pct BETWEEN 1 AND 100),
  CONSTRAINT ck_drop_rules_cap CHECK (daily_cap IS NULL OR daily_cap BETWEEN 1 AND 10),
  CONSTRAINT ck_drop_rules_quantity CHECK (total_quantity IS NULL OR (total_quantity >= 1 AND consumed_quantity <= total_quantity)),
  CONSTRAINT ck_drop_rules_window CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT ck_drop_rules_type CHECK (
       (rule_type = 'campaign' AND ends_at IS NOT NULL AND trigger_type = 'level_pass'
          AND effect IN ('raise_probability','restrict_styles'))
    OR (rule_type = 'course' AND COALESCE(JSON_LENGTH(spec, '$.scope.targets'), 0) >= 1
          AND trigger_type IN ('unit_first_all_three_star','specific_level_pass','streak_days','level_pass')
          AND effect IN ('guaranteed','raise_probability'))),
  -- 范围结构：课程 / 单元 / 关卡三级；有 levelKey 必须有 unitKey；最多 20 个目标
  CONSTRAINT ck_drop_rules_scope CHECK (JSON_EXTRACT(spec, '$.scope') IS NULL OR JSON_SCHEMA_VALID('{
      "type": "object", "required": ["targets"], "additionalProperties": false,
      "properties": { "targets": { "type": "array", "minItems": 1, "maxItems": 20,
        "items": { "type": "object", "required": ["courseId"], "additionalProperties": false,
          "properties": {
            "courseId": { "type": "string", "maxLength": 64, "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
            "unitKey":  { "type": "string", "maxLength": 32, "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
            "levelKey": { "type": "string", "maxLength": 32, "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" } },
          "dependencies": { "levelKey": ["unitKey"] } } } } }', JSON_EXTRACT(spec, '$.scope'))),
  -- 触发与范围一致：“单元首次全 3 星级”只能指向课程或单元；“指定关卡通关”的每个目标都必须是关卡
  CONSTRAINT ck_drop_rules_trigger_scope CHECK (
       (trigger_type <> 'unit_first_all_three_star' OR NOT JSON_CONTAINS_PATH(spec, 'one', '$.scope.targets[*].levelKey'))
   AND (trigger_type <> 'specific_level_pass'
        OR (COALESCE(JSON_LENGTH(spec, '$.scope.targets'), 0) >= 1
            AND COALESCE(JSON_LENGTH(JSON_EXTRACT(spec, '$.scope.targets[*].levelKey')), 0) = JSON_LENGTH(spec, '$.scope.targets')))),
  CONSTRAINT ck_drop_rules_effect CHECK (
       (effect <> 'raise_probability' OR probability_pct IS NOT NULL)
   AND (effect <> 'restrict_styles' OR COALESCE(JSON_LENGTH(spec, '$.styleIds'), 0) >= 1)),
  CONSTRAINT ck_drop_rules_published CHECK (status = 'draft' OR published_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE hiding_spots (                                  -- 通关时由服务端决定并记录内容；点开只做校验与揭晓
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id   BIGINT UNSIGNED NOT NULL,
  child_id    BIGINT UNSIGNED NOT NULL,
  attempt_id  BIGINT UNSIGNED NOT NULL,
  spot_no     TINYINT UNSIGNED NOT NULL,                     -- 1..3
  spot_kind   VARCHAR(16)  NOT NULL,                         -- leaf / rock / cloud …（来自关卡场景）
  local_date  DATE         NOT NULL,
  style_id    BIGINT UNSIGNED NULL,                          -- NULL = 空藏匿点
  rule_id     BIGINT UNSIGNED NULL,                          -- 决定本次放置的规则（NULL = 全局默认）
  daily_seq   TINYINT UNSIGNED NULL,                         -- 当天第几个被放置的呀哈哈家族成员：唯一键 + 上限 10 由数据库保证
  revealed_at DATETIME(3)  NULL,                             -- 只能从 NULL 改为时间一次
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hiding_spots_attempt (attempt_id, spot_no),
  UNIQUE KEY uq_hiding_spots_daily (child_id, local_date, daily_seq),
  UNIQUE KEY uq_hiding_spots_id_style (id, style_id),           -- 供图鉴复合外键：图鉴款式必须等于藏匿点里的款式
  KEY ix_hiding_spots_child (child_id, revealed_at),
  CONSTRAINT fk_hiding_spots_child   FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_hiding_spots_attempt FOREIGN KEY (attempt_id) REFERENCES attempts (id),
  CONSTRAINT fk_hiding_spots_style   FOREIGN KEY (style_id) REFERENCES yahaha_styles (id),
  CONSTRAINT fk_hiding_spots_rule    FOREIGN KEY (rule_id) REFERENCES drop_rules (id),
  CONSTRAINT ck_hiding_spots_no CHECK (spot_no BETWEEN 1 AND 3),
  CONSTRAINT ck_hiding_spots_seq CHECK ((style_id IS NULL) = (daily_seq IS NULL) AND (daily_seq IS NULL OR daily_seq BETWEEN 1 AND 10)),
  CONSTRAINT ck_hiding_spots_rule CHECK (rule_id IS NULL OR style_id IS NOT NULL),
  CONSTRAINT ck_hiding_spots_kind CHECK (REGEXP_LIKE(spot_kind, '^[a-z]{2,16}$', 'c'))
) ENGINE=InnoDB;

CREATE TABLE yahaha_finds (                                  -- 只追加：图鉴（每个被点开的非空藏匿点一行）
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_id          BIGINT UNSIGNED NOT NULL,
  child_id           BIGINT UNSIGNED NOT NULL,
  spot_id            BIGINT UNSIGNED NOT NULL,
  style_id           BIGINT UNSIGNED NOT NULL,
  fragment_ledger_id BIGINT UNSIGNED NOT NULL,
  found_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_yahaha_finds_spot (spot_id),
  UNIQUE KEY uq_yahaha_finds_ledger (fragment_ledger_id),
  KEY ix_yahaha_finds_child_style (child_id, style_id),
  CONSTRAINT fk_yahaha_finds_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_yahaha_finds_spot   FOREIGN KEY (spot_id, style_id) REFERENCES hiding_spots (id, style_id),
  CONSTRAINT fk_yahaha_finds_style  FOREIGN KEY (style_id) REFERENCES yahaha_styles (id),
  CONSTRAINT fk_yahaha_finds_ledger FOREIGN KEY (fragment_ledger_id) REFERENCES ledger (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. 社交 social（5 张）
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
  phrase_key          VARCHAR(48)  NULL,                     -- 仓库 seeds/phrases/phrases.json 的键
  emoji_key           VARCHAR(32)  NULL,                     -- 仓库 seeds/phrases/emoji.json 白名单的键
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at             DATETIME(3)  NULL,
  hidden_at           DATETIME(3)  NULL,                     -- 举报后对举报方隐藏 / 系统管理员处理后隐藏
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
-- 9. AI 聊天 呀哈哈队长 chat（1 张：只存元数据，不存对话内容；保留 90 天）
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
  agent_version_id  BIGINT UNSIGNED NULL,                    -- 呀哈哈队长（儿童角色）的角色版本；输入被拦截时为 NULL
  agent_audience    ENUM('admin','child','parent') NOT NULL DEFAULT 'child',
  cost_fen          INT UNSIGNED NOT NULL DEFAULT 0,         -- 计入全站与角色月度预算
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_usage_request (family_id, client_request_id),
  KEY ix_ai_usage_child_day (child_id, local_date),
  KEY ix_ai_usage_parent_day (parent_id, local_date),
  KEY ix_ai_usage_created (created_at),
  CONSTRAINT fk_ai_usage_child  FOREIGN KEY (family_id, child_id) REFERENCES children (family_id, id),
  CONSTRAINT fk_ai_usage_parent FOREIGN KEY (family_id, parent_id) REFERENCES parents (family_id, id),
  CONSTRAINT fk_ai_usage_agent  FOREIGN KEY (agent_version_id, agent_audience) REFERENCES agent_versions (id, audience),
  CONSTRAINT ck_ai_usage_child_role CHECK (agent_audience = 'child'),   -- 聊天只能使用面向孩子的角色版本
  CONSTRAINT ck_ai_usage_principal CHECK (
       (principal = 'child'  AND child_id IS NOT NULL AND parent_id IS NULL)
    OR (principal = 'parent' AND parent_id IS NOT NULL AND child_id IS NULL)),
  CONSTRAINT ck_ai_usage_filter CHECK ((status IN ('input_blocked','output_blocked')) = (filter_category IS NOT NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. 家长管控 controls（3 张）
-- ---------------------------------------------------------------------
CREATE TABLE child_controls (
  child_id             BIGINT UNSIGNED NOT NULL,
  family_id            BIGINT UNSIGNED NOT NULL,
  daily_minutes        SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  allowed_start        TIME         NOT NULL DEFAULT '07:00:00',
  allowed_end          TIME         NOT NULL DEFAULT '21:00:00',
  ai_daily_limit       TINYINT UNSIGNED NOT NULL DEFAULT 20,  -- 0 = 关闭呀哈哈队长（AI 聊天）
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
-- 11. 报告通知 reports（2 张）
-- ---------------------------------------------------------------------
CREATE TABLE daily_reports (                                 -- 每晚聚合，幂等重算（UPSERT）
  child_id          BIGINT UNSIGNED NOT NULL,
  report_date       DATE         NOT NULL,
  family_id         BIGINT UNSIGNED NOT NULL,
  active_seconds    INT UNSIGNED NOT NULL DEFAULT 0,
  attempts_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  levels_passed     SMALLINT UNSIGNED NOT NULL DEFAULT 0,      -- 当天首次通关的关卡数
  units_completed   SMALLINT UNSIGNED NOT NULL DEFAULT 0,      -- 当天首次完成（全部关卡通过）的单元数
  scored_questions  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  correct_questions SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  review_done_items SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  review_completed  TINYINT(1)   NOT NULL DEFAULT 0,
  stars_in          INT UNSIGNED NOT NULL DEFAULT 0,
  stars_out         INT UNSIGNED NOT NULL DEFAULT 0,
  fragments_in      INT UNSIGNED NOT NULL DEFAULT 0,
  points_in         INT UNSIGNED NOT NULL DEFAULT 0,           -- 积分收入，0.01 为单位
  points_converted  INT UNSIGNED NOT NULL DEFAULT 0,           -- 兑换成星星的积分，0.01 为单位
  yahaha_found      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
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
-- 12. 平台 platform（3 张）
-- ---------------------------------------------------------------------
CREATE TABLE system_settings (
  setting_key         VARCHAR(64) NOT NULL,
  value               JSON        NOT NULL,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_system_settings_admin FOREIGN KEY (updated_by_admin_id) REFERENCES admin_accounts (id),
  CONSTRAINT ck_system_settings_key CHECK (setting_key IN (
    'ai.enabled','ai.model','registration.mode',
    'discovery.enabled','discovery.spot_probability_pct','discovery.daily_cap','discovery.rarity_weights','discovery.milestone_bonus',
    'companion.den_base_slots','companion.den_slot_prices','companion.fragment_pass_scope',
    'studio.default_monthly_cap_fen','studio.unit_prices','studio.voices',
    'learning.play_ttl_minutes','content.allow_self_review','content.unit_levels',
    'agents.limits','agents.page_routes','agents.stats_min_group')),
  -- 规则边界由数据库保证（AI 或界面填错都写不进去）
  CONSTRAINT ck_system_settings_probability CHECK (setting_key <> 'discovery.spot_probability_pct'
    OR (JSON_TYPE(value) = 'INTEGER' AND JSON_EXTRACT(value, '$') BETWEEN 1 AND 100)),
  CONSTRAINT ck_system_settings_daily_cap CHECK (setting_key <> 'discovery.daily_cap'
    OR (JSON_TYPE(value) = 'INTEGER' AND JSON_EXTRACT(value, '$') BETWEEN 1 AND 10)),
  CONSTRAINT ck_system_settings_den_slots CHECK (setting_key <> 'companion.den_base_slots'
    OR (JSON_TYPE(value) = 'INTEGER' AND JSON_EXTRACT(value, '$') BETWEEN 1 AND 10)),
  CONSTRAINT ck_system_settings_play_ttl CHECK (setting_key <> 'learning.play_ttl_minutes'
    OR (JSON_TYPE(value) = 'INTEGER' AND JSON_EXTRACT(value, '$') BETWEEN 30 AND 720)),
  CONSTRAINT ck_system_settings_unit_levels CHECK (setting_key <> 'content.unit_levels'   -- 每个单元的关卡数范围（Q26，默认 3–6）
    OR (JSON_TYPE(value) = 'OBJECT' AND JSON_TYPE(JSON_EXTRACT(value, '$.min')) = 'INTEGER' AND JSON_TYPE(JSON_EXTRACT(value, '$.max')) = 'INTEGER'
        AND JSON_EXTRACT(value, '$.min') BETWEEN 1 AND 12 AND JSON_EXTRACT(value, '$.max') BETWEEN JSON_EXTRACT(value, '$.min') AND 12)),
  CONSTRAINT ck_system_settings_agent_limits CHECK (setting_key <> 'agents.limits'
    OR (JSON_TYPE(value) = 'OBJECT'
        AND JSON_EXTRACT(value, '$.max_steps') BETWEEN 1 AND 20              -- 工具循环最多 20 步（用户指定上限）
        AND JSON_EXTRACT(value, '$.child_max_steps') BETWEEN 1 AND 5
        AND JSON_EXTRACT(value, '$.max_pipeline_steps') BETWEEN 2 AND 6
        AND JSON_EXTRACT(value, '$.run_timeout_s') BETWEEN 30 AND 1800
        AND JSON_EXTRACT(value, '$.child_run_timeout_s') BETWEEN 5 AND 30)),
  CONSTRAINT ck_system_settings_stats_group CHECK (setting_key <> 'agents.stats_min_group'
    OR (JSON_TYPE(value) = 'INTEGER' AND JSON_EXTRACT(value, '$') BETWEEN 3 AND 50))
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
  version    VARCHAR(32) NOT NULL,                           -- 如 0001
  checksum   CHAR(64)    NOT NULL,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (version)
) ENGINE=InnoDB;

INSERT INTO system_settings (setting_key, value) VALUES
  ('ai.enabled',                      CAST('true' AS JSON)),
  ('ai.model',                        CAST('"default"' AS JSON)),
  ('registration.mode',               CAST('"invite"' AS JSON)),
  ('discovery.enabled',               CAST('true' AS JSON)),
  ('discovery.spot_probability_pct',  CAST('20' AS JSON)),
  ('discovery.daily_cap',             CAST('3' AS JSON)),
  ('discovery.rarity_weights',        CAST('{"common":100,"uncommon":30,"rare":10,"legendary":2}' AS JSON)),
  ('discovery.milestone_bonus',       CAST('{"10":3,"30":5,"100":10}' AS JSON)),
  ('companion.den_base_slots',        CAST('3' AS JSON)),
  ('companion.den_slot_prices',       CAST('[30,60,120]' AS JSON)),
  ('companion.fragment_pass_scope',   CAST('"per_level_per_day"' AS JSON)),
  ('studio.default_monthly_cap_fen',  CAST('20000' AS JSON)),
  ('studio.unit_prices',              CAST('{"llm_per_1k_tokens_fen":1,"image_fen":20,"ocr_page_fen":1,"tts_fen":0}' AS JSON)),
  ('studio.voices',                   CAST('{"zh":"zh_CN-huayan-medium","en":"en_US-amy-medium"}' AS JSON)),
  ('learning.play_ttl_minutes',       CAST('120' AS JSON)),
  ('content.allow_self_review',       CAST('true' AS JSON)),
  ('content.unit_levels',             CAST('{"min":3,"max":6}' AS JSON)),
  ('agents.limits',                   CAST('{"max_steps":20,"child_max_steps":3,"max_pipeline_steps":6,"llm_timeout_s":60,"child_llm_timeout_s":20,"tool_timeout_s":30,"run_timeout_s":600,"child_run_timeout_s":25,"output_repair_attempts":1}' AS JSON)),
  ('agents.page_routes',              CAST('{"courses":"course-designer","pets":"art-designer","yahaha":"art-designer","rules":"event-planner","skills":"qa-reviewer","agents":"qa-reviewer","runs":"ops-analyst","stats":"ops-analyst"}' AS JSON)),
  ('agents.stats_min_group',          CAST('5' AS JSON));
-- 伙伴默认档位与成长阶段（开放问题 Q5、Q8：已默认，可调整；系统管理员在后台修改）
INSERT INTO pet_tiers (id, name, sort_order, star_price, fragment_price, adoption_threshold) VALUES
  (1, '初级', 1,  20,  40,   0),
  (2, '中级', 2,  50, 100, 100),
  (3, '高级', 3, 100, 200, 300),
  (4, '稀有', 4, 200, 400, 600);
INSERT INTO pet_tier_stages (tier_id, stage_no, name, min_level, unlocked_actions)
SELECT t.id, s.stage_no, s.name, s.min_level, CAST(s.actions AS JSON)
FROM pet_tiers t
CROSS JOIN (
  SELECT 1 AS stage_no, '幼苗' AS name,  1 AS min_level, '["idle-breathe","happy-bounce"]' AS actions
  UNION ALL SELECT 2, '探险',  5, '["cheer-jump"]'
  UNION ALL SELECT 3, '守护', 12, '["happy-wave"]'
  UNION ALL SELECT 4, '星耀', 20, '["cheer-spin"]'
) s;
-- 系统技能：儿童安全（不能停用；内容由 xingya seeds:apply 从仓库 seeds/skills/child-safety/ 导入）
INSERT INTO skills (id, skill_key, audience, is_system) VALUES (1, 'child-safety', 'child', 1);
-- 默认 7 个 AI 角色（开放问题 Q19–Q21：已默认，可调整）。v1 为草稿：seeds:apply 挂载默认技能后，由系统管理员审核发布才能运行。
INSERT INTO agents (id, agent_key, audience, is_system) VALUES
  (1, 'course-designer', 'admin', 1),
  (2, 'art-designer',    'admin', 1),
  (3, 'voice-artist',    'admin', 1),
  (4, 'event-planner',   'admin', 1),
  (5, 'qa-reviewer',     'admin', 1),
  (6, 'ops-analyst',     'admin', 1),
  (7, 'yahaha-captain',  'child', 1);
INSERT INTO agent_versions (id, agent_id, audience, version_no, name, description, allowed_tools, monthly_budget_fen) VALUES
  (1, 1, 'admin', 1, '课程设计师', '根据资料分析单词、句型与知识点，按模板生成整门课程或单个单元的草稿，按要求重写单题；只写草稿。',
     CAST('["materials.read","words.search","templates.read","course.read_draft","course.write_draft","course.rewrite_question"]' AS JSON), 6000),
  (2, 2, 'admin', 1, '美术设计师', '设计伙伴、呀哈哈家族款式与课程配图，保持统一画风；全部原创，只写草稿素材。',
     CAST('["image.generate","assets.search","course.read_draft","course.attach_images","pet.write_design","yahaha.write_style"]' AS JSON), 7000),
  (3, 3, 'admin', 1, '配音师', '为伙伴台词、呀哈哈家族叫声与课程对话分配声音与音高，用本机 Piper 生成试听音频。',
     CAST('["tts.synthesize","assets.search","course.read_draft","course.assign_voices","pet.write_voice","yahaha.write_voice"]' AS JSON), 500),
  (4, 4, 'admin', 1, '活动策划', '把一句话活动想法填成投放规则表单并估算影响；规则须系统管理员确认后生效。',
     CAST('["rules.read","styles.read","courses.list","rule.write_draft","rule.estimate_impact"]' AS JSON), 1000),
  (5, 5, 'admin', 1, '质检员', '检查课程、伙伴、款式与规则草稿：自动检查、儿童安全与原创性，写质检报告；不能发布。',
     CAST('["course.read_draft","course.run_checks","assets.read","pet.read_design","yahaha.read_style","rules.read","qa.write_report"]' AS JSON), 2000),
  (6, 6, 'admin', 1, '运营分析师', '只读全站聚合数据（人数少于阈值的分组不显示），输出运营与费用分析。',
     CAST('["stats.aggregate","jobs.summary"]' AS JSON), 500),
  (7, 7, 'child', 1, '呀哈哈队长', '友善的小树灵，带领呀哈哈家族，陪 6–12 岁孩子练英语、讲故事、答疑；不记忆对话。',
     CAST('["child.learned_words"]' AS JSON), 3000);
INSERT INTO schema_migrations (version, checksum) VALUES ('0001', REPEAT('0', 64));
