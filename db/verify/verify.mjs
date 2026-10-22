// 在临时 MySQL 8.4 上验证 db/migrations + db/roles.sql。只连本机 socket，只建/删 xingya 库与 xingya_* 账号。
import fs from 'node:fs';
import mysql from 'mysql2/promise';
const SOCK = process.env.MYSQL_SOCKET;
// 参数：按顺序给出要执行的 SQL 文件（例如 ../migrations/0001_init.sql ../roles.sql），依次拼接后执行。
const SQL = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra }); };
const root = await mysql.createConnection({ socketPath: SOCK, user: 'root', multipleStatements: true });

async function fingerprint() {
  const q = async (sql) => JSON.stringify((await root.query(sql))[0]);
  const parts = await Promise.all([
    q(`SELECT table_name, column_name, column_type, is_nullable, column_default, extra, generation_expression FROM information_schema.columns WHERE table_schema='xingya' ORDER BY table_name, ordinal_position`),
    q(`SELECT table_name, constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema='xingya' ORDER BY table_name, constraint_name`),
    q(`SELECT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_schema='xingya' ORDER BY constraint_name`),
    q(`SELECT table_name, index_name, non_unique, seq_in_index, column_name FROM information_schema.statistics WHERE table_schema='xingya' ORDER BY table_name, index_name, seq_in_index`),
    q(`SELECT constraint_name, table_name, referenced_table_name, update_rule, delete_rule FROM information_schema.referential_constraints WHERE constraint_schema='xingya' ORDER BY constraint_name`),
    q(`SELECT User, Host, Table_name, Table_priv, Column_priv FROM mysql.tables_priv WHERE Db='xingya' ORDER BY User, Table_name`),
  ]);
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}
async function counts() {
  const [[t]] = await root.query(`SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema='xingya'`);
  const [[f]] = await root.query(`SELECT COUNT(*) n FROM information_schema.referential_constraints WHERE constraint_schema='xingya'`);
  const [[c]] = await root.query(`SELECT COUNT(*) n FROM information_schema.check_constraints WHERE constraint_schema='xingya'`);
  const [[u]] = await root.query(`SELECT COUNT(DISTINCT table_name, index_name) n FROM information_schema.statistics WHERE table_schema='xingya' AND non_unique=0 AND index_name<>'PRIMARY'`);
  const [[g]] = await root.query(`SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema='xingya' AND generation_expression<>''`);
  return { tables: t.n, fks: f.n, checks: c.n, uniques: u.n, generated: g.n };
}

// 1) 从空库应用两次
await root.query('DROP DATABASE IF EXISTS xingya');
await root.query(SQL);
const fp1 = await fingerprint(); const c1 = await counts();
await root.query('DROP DATABASE xingya');
await root.query(SQL);
const fp2 = await fingerprint(); const c2 = await counts();
ok('从空库应用两次结构指纹一致', fp1 === fp2, `${fp1.slice(0, 12)} / ${fp2.slice(0, 12)}`);
ok('表数=82', c2.tables === 82, JSON.stringify(c2));
{ const [miss] = await root.query(`SELECT table_name t FROM information_schema.tables WHERE table_schema='xingya' AND table_name NOT IN (SELECT Table_name FROM mysql.tables_priv WHERE Db='xingya' AND User='xingya_app_role')`);
  ok('授权全覆盖：每张表都有应用角色授权', miss.length === 0, JSON.stringify(miss)); }

// 2) 账号：解锁并设置测试口令（生产由引导脚本从密钥文件读取）
await root.query(`ALTER USER 'xingya_app'@'localhost' IDENTIFIED BY 'test-app-pw-1' ACCOUNT UNLOCK`);
await root.query(`ALTER USER 'xingya_migrator'@'localhost' IDENTIFIED BY 'test-mig-pw-1' ACCOUNT UNLOCK`);
const [hosts] = await root.query(`SELECT user, host FROM mysql.user WHERE user LIKE 'xingya%'`);
ok('xingya 账号只有 @localhost（角色除外）', hosts.filter(h => !h.user.endsWith('_role')).every(h => h.host === 'localhost'), JSON.stringify(hosts));
const app = await mysql.createConnection({ socketPath: SOCK, user: 'xingya_app', password: 'test-app-pw-1', database: 'xingya', multipleStatements: true });
const mig = await mysql.createConnection({ socketPath: SOCK, user: 'xingya_migrator', password: 'test-mig-pw-1', database: 'xingya', multipleStatements: true });
for (const c of [app, mig]) await c.query(`SET time_zone='+00:00'`);

const expectErr = async (name, conn, sql, params, codes) => {
  try { await conn.query(sql, params); ok(name, false, 'unexpectedly succeeded'); }
  catch (e) { ok(name, codes.includes(e.code), `${e.code}: ${e.message.slice(0, 90)}`); }
};
const expectOk = async (name, conn, sql, params) => {
  try { const [r] = await conn.query(sql, params); ok(name, true); return r; }
  catch (e) { ok(name, false, `${e.code}: ${e.message.slice(0, 120)}`); }
};

// 3) migrator：DDL；系统管理员账号（课程与工作室数据需要）
await expectOk('migrator 可执行 DDL', mig, `CREATE TABLE zz_tmp (id INT PRIMARY KEY); DROP TABLE zz_tmp`);
await expectOk('migrator 建系统管理员', mig, `INSERT INTO admin_accounts (id,username,password_hash,totp_secret_enc) VALUES (1,'ops','h',X'00')`);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// 4) app：家庭数据
await expectOk('app 建家庭/家长/孩子', app, `INSERT INTO families (id,name) VALUES (1,'王家'),(2,'李家');
  INSERT INTO parents (id,family_id,email,password_hash,display_name) VALUES (1,1,'a@x.com','h','爸爸'),(2,2,'b@y.com','h','妈妈');
  INSERT INTO children (id,family_id,nickname,avatar_key,grade,pin_hash) VALUES (1,1,'小明','sprout',1,'h'),(2,1,'小红','leaf',3,'h'),(3,2,'小李','sun',2,'h');
  INSERT INTO balances (child_id,currency,family_id,balance) VALUES (1,'star',1,0),(1,'fragment',1,0),(2,'star',1,0),(3,'star',2,0)`);
await expectErr('CHECK：家长邮箱必须小写', app, `INSERT INTO parents (family_id,email,password_hash,display_name) VALUES (1,'New@x.com','h','x')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：家庭内昵称唯一', app, `INSERT INTO children (family_id,nickname,avatar_key,grade,pin_hash) VALUES (1,'小明','a',1,'h')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：孩子用户名与密码同时存在', app, `UPDATE children SET username='xiaoming' WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：开启跨家庭须有好友码', app, `UPDATE families SET cross_family_enabled=1 WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：会话的孩子必须属于同一家庭', app, `INSERT INTO sessions (token_hash,principal,family_id,child_id,login_method,expires_at) VALUES (UNHEX(SHA2('t1',256)),'child',2,1,'child_password',NOW()+INTERVAL 1 DAY)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：PIN 登录必须在家庭设备上', app, `INSERT INTO sessions (token_hash,principal,family_id,child_id,login_method,expires_at) VALUES (UNHEX(SHA2('t2',256)),'child',1,1,'pin',NOW()+INTERVAL 1 DAY)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('家庭设备 + PIN 会话', app, `INSERT INTO family_devices (id,family_id,token_hash,label,created_by_parent_id,expires_at) VALUES (1,1,UNHEX(SHA2('d1',256)),'客厅平板',1,NOW()+INTERVAL 365 DAY);
  INSERT INTO sessions (token_hash,principal,family_id,child_id,family_device_id,login_method,expires_at) VALUES (UNHEX(SHA2('t3',256)),'child',1,1,1,'pin',NOW()+INTERVAL 8 HOUR)`);
// 4b) 孩子自改昵称与偏好、系统管理员登录锁定与改密码、注册码绑定邮箱（ADR 0020，用户 2026-10-22）
await expectOk('孩子昵称 24 字以内（孩子可自改，旧系统）、偏好存服务端', app, `UPDATE children SET nickname='${'星'.repeat(24)}', pref_sound=0, pref_reduced_motion=1, version=version+1 WHERE id=2`);
await expectErr('CHECK：孩子昵称不超过 24 字', app, `UPDATE children SET nickname='${'星'.repeat(25)}' WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DATA_TOO_LONG']);
await expectOk('app 可改系统管理员密码并记录时间', app, `UPDATE admin_accounts SET password_hash='h2', password_changed_at=NOW(3) WHERE id=1`);
await expectOk('app 记录登录失败与 15 分钟锁定', app, `UPDATE admin_accounts SET failed_login_count=5, locked_until=NOW(3)+INTERVAL 15 MINUTE WHERE id=1`);
await expectErr('CHECK：系统管理员连续失败计数不超过 5（第 5 次即锁定并清零）', app, `UPDATE admin_accounts SET failed_login_count=6 WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能改 TOTP 种子（只有 xingya admin:reset-totp）', app, `UPDATE admin_accounts SET totp_secret_enc=X'01' WHERE id=1`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能建系统管理员', app, `INSERT INTO admin_accounts (username,password_hash,totp_secret_enc) VALUES ('x','h',X'00')`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('migrator 重置 TOTP（运维命令 admin:reset-totp）', mig, `UPDATE admin_accounts SET totp_secret_enc=X'02', totp_reset_at=NOW(3), failed_login_count=0, locked_until=NULL WHERE id=1`);
const signup = (h, email) => `INSERT INTO auth_tokens (purpose,token_hash,email,created_by_admin_id,expires_at) VALUES ('family_signup',UNHEX(SHA2('${h}',256)),${email},1,NOW()+INTERVAL 7 DAY)`;
await expectOk('注册码：绑定邮箱（只有该邮箱能注册）与不绑定各一个', app, `${signup('s1', "'mom@x.com'")}; ${signup('s2', 'NULL')}`);
await expectErr('CHECK：注册码绑定的邮箱必须小写', app, signup('s3', "'Mom@X.com'"), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 5) AI 工作室：任务队列并发上限、本机进程互斥、预算、素材
const job = (id, st, slot, local = 0) => `INSERT INTO ai_jobs (id,kind,status,running_slot,needs_local,params,budget_month,started_at) VALUES (${id},'agent_run','${st}',${slot},${local},'{}','2026-10',${st === 'running' ? 'NOW(3)' : 'NULL'})`;
await expectOk('任务队列：两个运行中任务（槽位 1、2）', app, `${job(1, 'running', 1, 1)}; ${job(2, 'running', 2, 0)}`);
await expectErr('任务队列：第 3 个并发任务被拒（槽位唯一）', app, job(3, 'running', 1), [], ['ER_DUP_ENTRY']);
await expectErr('任务队列：槽位只能是 1 或 2', app, job(3, 'running', 3), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('任务队列：运行中必须占槽位', app, job(3, 'running', 'NULL'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`UPDATE ai_jobs SET status='succeeded', running_slot=NULL, finished_at=NOW(3) WHERE id=2`);
await expectErr('任务队列：本机进程类任务同时最多 1 个', app, job(3, 'running', 2, 1), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：实际费用不得超过预估', app, `INSERT INTO ai_jobs (kind,params,budget_month,estimated_cost_fen,actual_cost_fen) VALUES ('agent_run','{}','2026-10',100,101)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO ai_budget_months (budget_month,cap_fen,reserved_fen,spent_fen) VALUES ('2026-10',20000,500,1000)`);
await expectErr('CHECK：预留 + 已花费 不得超过月度预算', app, `UPDATE ai_budget_months SET reserved_fen=reserved_fen+19000 WHERE budget_month='2026-10'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('素材入库', app, `INSERT INTO assets (id,kind,oss_key,sha256,mime,bytes,source,provider,prompt) VALUES (1,'image','pub/a1.webp',UNHEX(SHA2('a1',256)),'image/webp',20000,'ai_image','img','apple, original character'),(2,'audio','pub/a2.mp3',UNHEX(SHA2('a2',256)),'audio/mpeg',8000,'tts','piper',NULL)`);
await expectErr('CHECK：图片 ≤ 300 KB', app, `INSERT INTO assets (kind,oss_key,sha256,mime,bytes,source,prompt) VALUES ('image','pub/big.webp',UNHEX(SHA2('b',256)),'image/webp',400000,'upload',NULL)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：AI 图片必须记录提示词', app, `INSERT INTO assets (kind,oss_key,sha256,mime,bytes,source) VALUES ('image','pub/np.webp',UNHEX(SHA2('np',256)),'image/webp',100,'ai_image')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能改素材的 OSS 路径（列级授权）', app, `UPDATE assets SET oss_key='x' WHERE id=1`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
// 5b) 模型配置（ADR 0022）与扫码上传资料（旧系统）
{ const [[pv]] = await app.query(`SELECT COUNT(*) n, SUM(is_default) d, SUM(api_key_enc IS NULL) nokey, GROUP_CONCAT(purpose ORDER BY purpose) ps, MIN(vendor) v FROM ai_providers`);
  ok('默认模型配置 3 条：聊天 / 视觉 / 图像各一个默认，阿里云百炼，密钥未填', Number(pv.n) === 3 && Number(pv.d) === 3 && Number(pv.nokey) === 3 && pv.ps === 'chat,vision,image' && pv.v === '阿里云百炼', JSON.stringify(pv)); }
await expectOk('新增聊天模型配置（孩子可切换），密钥以密文保存', app, `INSERT INTO ai_providers (purpose,name,vendor,base_url,model,api_key_enc,child_selectable) VALUES ('chat','备用聊天','某厂商','https://llm.example.com/v1','m-small',X'A1B2',1)`);
await expectErr('UNIQUE：每种用途只有一个有效默认', app, `UPDATE ai_providers SET is_default=1 WHERE name='备用聊天'`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：模型服务地址必须是 https', app, `INSERT INTO ai_providers (purpose,name,vendor,base_url,model) VALUES ('vision','明文','x','http://ocr.example.com','m')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：只有聊天模型可以让孩子切换', app, `INSERT INTO ai_providers (purpose,name,vendor,base_url,model,child_selectable) VALUES ('image','图2','x','https://img.example.com','m',1)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：模型配置不能物理删除（停用即可）', app, `DELETE FROM ai_providers WHERE name='备用聊天'`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('扫码上传链接 72 小时有效', app, `INSERT INTO material_upload_links (id,token_hash,created_by_admin_id,expires_at) VALUES (1,UNHEX(SHA2('q1',256)),1,NOW(3)+INTERVAL 72 HOUR)`);
await expectErr('CHECK：扫码上传链接最长 72 小时', app, `INSERT INTO material_upload_links (token_hash,created_by_admin_id,expires_at) VALUES (UNHEX(SHA2('q2',256)),1,NOW(3)+INTERVAL 73 HOUR)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('经扫码上传的资料', app, `INSERT INTO materials (id,title,kind,oss_key,sha256,bytes,uploaded_by_admin_id,upload_link_id) VALUES (1,'课本第 3 页','image','priv/m1.jpg',UNHEX(SHA2('m1',256)),300000,1,1)`);
await expectErr('CHECK：软删除必须记录操作人', app, `UPDATE materials SET deleted_at=NOW(3) WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('软删除与恢复资料', app, `UPDATE materials SET deleted_at=NOW(3), deleted_by_admin_id=1 WHERE id=1; UPDATE materials SET deleted_at=NULL, deleted_by_admin_id=NULL WHERE id=1`);
await expectErr('权限：资料不能物理删除（软删除可恢复）', app, `DELETE FROM materials WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);

// 6) 词库与课程：草稿 → 发布（插入不可变版本行）
await expectOk('词库：词与义项', app, `INSERT INTO words (id,subject,text,audio_asset_id,status) VALUES ('en.apple','english','apple',2,'active'),('en.pear','english','pear',NULL,'active'),('en.bat','english','bat',NULL,'active');
  INSERT INTO word_senses (id,word_id,meaning_zh,image_asset_id,status) VALUES ('en.apple.fruit','en.apple','苹果',1,'active'),('en.pear.fruit','en.pear','梨',NULL,'active'),('en.bat.animal','en.bat','蝙蝠',NULL,'active')`);
await expectErr('CHECK：词 ID 格式', app, `INSERT INTO words (id,subject,text) VALUES ('Apple','english','Apple2')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：义项 ID 必须以所属词 ID 为前缀', app, `INSERT INTO word_senses (id,word_id,meaning_zh) VALUES ('en.pear.x','en.apple','错')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：同学科同拼写只有一个词', app, `INSERT INTO words (id,subject,text) VALUES ('en.apple-2','english','apple')`, [], ['ER_DUP_ENTRY']);
await expectErr('权限：app 不能改义项释义（列级授权）', app, `UPDATE word_senses SET meaning_zh='香蕉' WHERE id='en.apple.fruit'`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('app 可更新义项图片', app, `UPDATE word_senses SET image_asset_id=1 WHERE id='en.pear.fruit'`);
await expectOk('建课程（一册一门：一年级上册、下册）与草稿', app, `INSERT INTO courses (id,subject,grade,sort_order,template_id,created_by_admin_id) VALUES ('en-g1-a','english',1,101,'word-quest',1),('en-g1-b','english',1,102,'word-quest',1);
  INSERT INTO course_drafts (id,course_id,template_id,template_version,document,created_by_admin_id) VALUES (1,'en-g1-a','word-quest',1,'{}',1)`);
await expectErr('UNIQUE：每门课同时只有一份未完成草稿', app, `INSERT INTO course_drafts (course_id,template_id,template_version,document,created_by_admin_id) VALUES ('en-g1-a','word-quest',1,'{}',1)`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：未通过自动检查不能提交审核', app, `UPDATE course_drafts SET status='in_review', submitted_at=NOW(3) WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：发布前必须有审核人', app, `UPDATE course_drafts SET check_passed=1, status='publishing', submitted_at=NOW(3) WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const SPOTS = '[{"kind":"leaf","x":0.2,"y":0.6},{"kind":"rock","x":0.5,"y":0.8},{"kind":"cloud","x":0.8,"y":0.2}]';
await expectOk('发布：插入版本、单元、关卡、题目（可见部分）与答案', app, `UPDATE course_drafts SET check_passed=1, status='publishing', submitted_at=NOW(3), reviewed_by_admin_id=1 WHERE id=1;
  INSERT INTO course_versions (id,course_id,version_no,draft_id,template_id,template_version,title,published_by_admin_id) VALUES (1,'en-g1-a',1,1,'word-quest',1,'一年级上册',1);
  INSERT INTO units (id,course_version_id,unit_key,seq,title,title_zh) VALUES (1,1,'u01',1,'Unit 1 Fruits','水果'),(2,1,'u02',2,'Unit 2 Animals','动物');
  INSERT INTO levels (id,course_version_id,unit_id,level_key,seq,title,hiding_spots) VALUES (1,1,1,'l01',1,'认识水果','${SPOTS}');
  INSERT INTO questions (id,level_id,question_key,seq,type,scored,sense_id,visible) VALUES
    (1,1,'q1',1,'pick_image',1,'en.apple.fruit','{"imageAssetId":1,"options":[{"id":"o1","senseId":"en.apple.fruit"},{"id":"o2","senseId":"en.pear.fruit"}]}'),
    (2,1,'q2',2,'read_aloud',0,'en.apple.fruit','{"text":"I like apples."}');
  INSERT INTO question_answers (question_id,answer,explanation) VALUES (1,'{"optionId":"o1"}','apple 是苹果');
  UPDATE courses SET current_version_id=1, version=version+1 WHERE id='en-g1-a';
  UPDATE course_drafts SET status='published', published_version_id=1 WHERE id=1`);
await expectErr('CHECK：每关必须定义 3 个藏匿点', app, `INSERT INTO levels (course_version_id,unit_id,level_key,seq,title,hiding_spots) VALUES (1,1,'l02',2,'x','[]')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：课程的当前版本必须属于本课程', app, `UPDATE courses SET current_version_id=1 WHERE id='en-g1-b'`, [], ['ER_NO_REFERENCED_ROW_2']);
// 6b) 单元：课程 > 单元 > 关卡
await expectErr('UNIQUE：同一课程版本内 unit_key 唯一', app, `INSERT INTO units (course_version_id,unit_key,seq,title) VALUES (1,'u01',3,'x')`, [], ['ER_DUP_ENTRY']);
await expectErr('UNIQUE：同一课程版本内单元顺序唯一', app, `INSERT INTO units (course_version_id,unit_key,seq,title) VALUES (1,'u03',2,'x')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：unit_key 格式', app, `INSERT INTO units (course_version_id,unit_key,seq,title) VALUES (1,'Unit 3',3,'x')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('外键：单元必须属于已发布版本', app, `INSERT INTO units (course_version_id,unit_key,seq,title) VALUES (99,'u01',1,'x')`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectOk('不同单元可以有相同的 level_key（u02 的 l01）', app, `INSERT INTO levels (id,course_version_id,unit_id,level_key,seq,title,hiding_spots) VALUES (2,1,2,'l01',1,'认识动物','${SPOTS}')`);
await expectErr('UNIQUE：单元内 level_key 唯一', app, `INSERT INTO levels (course_version_id,unit_id,level_key,seq,title,hiding_spots) VALUES (1,1,'l01',2,'x','${SPOTS}')`, [], ['ER_DUP_ENTRY']);
await expectErr('UNIQUE：单元内关卡顺序唯一', app, `INSERT INTO levels (course_version_id,unit_id,level_key,seq,title,hiding_spots) VALUES (1,1,'l09',1,'x','${SPOTS}')`, [], ['ER_DUP_ENTRY']);
// 6c) 学习卡（先学后练，不计分；ADR 0020）与隐藏奖励关卡
await expectOk('关卡学习卡 2 张 + 单元拓展卡 1 张 + 字母卡（例词）', app, `INSERT INTO learning_cards (course_version_id,unit_id,level_id,card_key,seq,kind,sense_id,content) VALUES
    (1,1,1,'c01',1,'word','en.apple.fruit','{"word":"apple","meaning":"苹果","sentence":"I like apples.","sentenceMeaning":"我喜欢苹果。","imageAssetId":1,"audioAssetId":2}'),
    (1,1,1,'c02',2,'letter',NULL,'{"upper":"A","lower":"a","examples":["apple","ant"]}'),
    (1,1,NULL,'x01',1,'sentence',NULL,'{"sentence":"An apple a day.","sentenceMeaning":"一天一个苹果。"}')`);
await expectErr('UNIQUE：同一关卡内学习卡键唯一', app, `INSERT INTO learning_cards (course_version_id,unit_id,level_id,card_key,seq,kind,content) VALUES (1,1,1,'c01',3,'word','{}')`, [], ['ER_DUP_ENTRY']);
await expectErr('复合外键：学习卡的关卡必须属于同一单元', app, `INSERT INTO learning_cards (course_version_id,unit_id,level_id,card_key,seq,kind,content) VALUES (1,1,2,'c09',9,'word','{}')`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：字母卡例词最多 50 个', app, `INSERT INTO learning_cards (course_version_id,unit_id,level_id,card_key,seq,kind,content) VALUES (1,1,1,'c03',3,'letter',JSON_OBJECT('examples', JSON_ARRAY(${Array.from({ length: 51 }, (_, i) => `'w${i}'`).join(',')})))`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('不可变：app 不能修改已发布学习卡', app, `UPDATE learning_cards SET content='{}' WHERE card_key='c01'`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('隐藏奖励关卡（宝箱 20 星）与题目来源、答后显示原文与中文', app, `INSERT INTO levels (id,course_version_id,unit_id,level_key,seq,title,hiding_spots,station,hidden_reward) VALUES (3,1,1,'l02',2,'水果宝箱','${SPOTS}','果园','fixed');
  INSERT INTO questions (id,level_id,question_key,seq,type,scored,visible,source) VALUES (3,3,'q1',1,'listen_pick_image',1,'{"audioAssetId":2,"options":[{"id":"o1","imageAssetId":1}]}','一年级上册 第 12 页');
  INSERT INTO question_answers (question_id,answer,reveal) VALUES (3,'{"optionId":"o1"}','{"transcript":"apple","zh":"苹果"}')`);
await expectErr('CHECK：隐藏奖励只有翻倍或宝箱两种', app, `INSERT INTO levels (course_version_id,unit_id,level_key,seq,title,hiding_spots,hidden_reward) VALUES (1,1,'l03',3,'x','${SPOTS}','triple')`, [], ['ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'WARN_DATA_TRUNCATED', 'ER_WRONG_VALUE_FOR_FIELD', 'ER_DATA_TOO_LONG']);
await expectOk('发布另一门课程（一年级下册）的版本与单元', app, `INSERT INTO course_drafts (id,course_id,template_id,template_version,document,created_by_admin_id) VALUES (2,'en-g1-b','word-quest',1,'{}',1);
  UPDATE course_drafts SET check_passed=1, status='publishing', submitted_at=NOW(3), reviewed_by_admin_id=1 WHERE id=2;
  INSERT INTO course_versions (id,course_id,version_no,draft_id,template_id,template_version,title,published_by_admin_id) VALUES (2,'en-g1-b',1,2,'word-quest',1,'一年级下册',1);
  INSERT INTO units (id,course_version_id,unit_key,seq,title) VALUES (3,2,'u01',1,'Unit 1 School');
  UPDATE courses SET current_version_id=2 WHERE id='en-g1-b';
  UPDATE course_drafts SET status='published', published_version_id=2 WHERE id=2`);
await expectErr('复合外键：关卡的单元必须属于同一课程版本', app, `INSERT INTO levels (course_version_id,unit_id,level_key,seq,title,hiding_spots) VALUES (1,3,'l05',5,'x','${SPOTS}')`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('不可变：app 不能修改已发布单元', app, `UPDATE units SET title='x' WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('不可变：app 不能删除已发布单元', app, `DELETE FROM units WHERE id=2`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('CHECK：题目可见部分不得含答案字段', app, `INSERT INTO questions (level_id,question_key,seq,type,scored,visible) VALUES (1,'q3',3,'listen_choose',1,'{"options":[],"answer":"o1"}')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：read_aloud 不能计分', app, `INSERT INTO questions (level_id,question_key,seq,type,scored,visible) VALUES (1,'q4',4,'read_aloud',1,'{}')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const [qcols] = await root.query(`SELECT column_name c FROM information_schema.columns WHERE table_schema='xingya' AND table_name='questions' ORDER BY ordinal_position`);
ok('题目表不含答案/解析列（答案在 question_answers）', !qcols.some(r => /answer|explanation|accept/i.test(r.c)), qcols.map(r => r.c).join(','));
await expectErr('不可变：app 不能修改已发布题目', app, `UPDATE questions SET visible='{}' WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('不可变：app 不能修改已发布答案', app, `UPDATE question_answers SET answer='{"optionId":"o2"}' WHERE question_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('不可变：app 不能修改已发布关卡', app, `UPDATE levels SET title='x' WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('不可变：app 不能删除已发布版本', app, `DELETE FROM course_versions WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('UNIQUE：同一草稿只能发布一次', app, `INSERT INTO course_versions (course_id,version_no,draft_id,template_id,template_version,title,published_by_admin_id) VALUES ('en-g1-a',2,1,'word-quest',1,'x',1)`, [], ['ER_DUP_ENTRY']);

// 7) 作答与闯关记录：生成列与幂等
const fplay = (id, n, extra = "'level',1,1") => `(${id},1,1,${extra},'${uuid(n)}','2026-10-21','[]','finished',NOW(3))`;
await expectOk('作答（play）：4 次已完成', app, `INSERT INTO plays (id,family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items,status,finished_at) VALUES ${fplay(1, 1)},${fplay(2, 2)},${fplay(3, 3)},${fplay(4, 4)}`);
await expectErr('UNIQUE：同一请求 ID 只开始一次作答', app, `INSERT INTO plays (family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items) VALUES (1,1,'level',1,1,?,'2026-10-21','[]')`, [uuid(1)], ['ER_DUP_ENTRY']);
await expectErr('复合外键：作答的关卡必须属于所记录的版本', app, `INSERT INTO plays (family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items) VALUES (1,1,'level',99,1,?,'2026-10-21','[]')`, [uuid(9)], ['ER_NO_REFERENCED_ROW_2']);
await expectOk('开始一次未完成作答（不过期，旧系统）', app, `INSERT INTO plays (id,family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items) VALUES (5,1,1,'level',1,1,?,'2026-10-21','[]')`, [uuid(5)]);
await expectErr('UNIQUE：同一关同时只有一次未完成作答（再次开始即恢复）', app, `INSERT INTO plays (family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items) VALUES (1,1,'level',1,1,?,'2026-10-21','[]')`, [uuid(6)], ['ER_DUP_ENTRY']);
{ const [cols] = await root.query(`SELECT column_name c FROM information_schema.columns WHERE table_schema='xingya' AND table_name='plays' AND column_name='expires_at'`);
  ok('作答没有过期时间列（旧系统：未完成的作答一直保留）', cols.length === 0, JSON.stringify(cols)); }
await expectOk('秘密路线作答（金币小径，题目来自第 1 关）', app, `INSERT INTO plays (id,family_id,child_id,kind,course_version_id,level_id,secret_route,client_request_id,local_date,items) VALUES (6,1,1,'secret',1,1,'coins',?,'2026-10-21','[]')`, [uuid(7)]);
await expectErr('CHECK：秘密路线作答必须指明路线', app, `INSERT INTO plays (family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items) VALUES (1,1,'secret',1,2,?,'2026-10-21','[]')`, [uuid(8)], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const att = (play, s, c, aw) => `INSERT INTO attempts (id,family_id,child_id,play_id,course_version_id,level_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (${play},1,1,${play},1,1,'2026-10-21',${s},${c},${aw},'[]')`;
await expectOk('提交闯关 4/5', app, att(1, 5, 4, 2));
const [[a1]] = await app.query(`SELECT accuracy_pct,stars,passed FROM attempts WHERE id=1`);
ok('生成列：4/5 => 80%、只错 1 题 → 2 星级、通过（用户 2026-10-22）', a1.accuracy_pct === 80 && a1.stars === 2 && a1.passed === 1, JSON.stringify(a1));
await app.query(`${att(2, 8, 7, 0)}; ${att(3, 4, 3, 0)}; ${att(4, 5, 5, 1)}`);
const [rows] = await app.query(`SELECT accuracy_pct, stars, passed FROM attempts ORDER BY id`);
ok('生成列：7/8=87%→2 星级；3/4=75%→未通过（错 1 题但不到 80%）；5/5→3 星级', rows[1].stars === 2 && rows[2].passed === 0 && rows[2].stars === 0 && rows[3].stars === 3, JSON.stringify(rows.map(r => [r.accuracy_pct, r.stars, r.passed])));
{ const [st] = await root.query(`SELECT generation_expression g FROM information_schema.columns WHERE table_schema='xingya' AND table_name='attempts' AND column_name='stars'`);
  ok('星级生成列含“只错 1 题”分支（scored_count - 1），不再有 90% 阈值', /scored_count` - 1/.test(st[0].g) && !/90/.test(st[0].g), st[0].g.slice(0, 160)); }
await expectErr('幂等：同一次作答只产生一条闯关记录', app, `INSERT INTO attempts (family_id,child_id,play_id,course_version_id,level_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,1,1,1,'2026-10-21',5,4,1,'[]')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：每关计分题至少 4 道', app, `INSERT INTO attempts (family_id,child_id,play_id,course_version_id,level_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,2,1,1,'2026-10-21',3,3,0,'[]')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DUP_ENTRY']);
await expectErr('CHECK：关卡进度的最佳星级与首次通过时间一致', app, `INSERT INTO level_progress (family_id,child_id,course_id,unit_key,level_key,best_stars,last_attempt_at) VALUES (1,1,'en-g1-a','u01','l01',2,NOW())`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('关卡进度按 (课程, unit_key, level_key)：u01/l01 与 u02/l01 各一行', app, `INSERT INTO level_progress (family_id,child_id,course_id,unit_key,level_key,best_stars,first_passed_at,last_attempt_at) VALUES (1,1,'en-g1-a','u01','l01',3,NOW(3),NOW(3)),(1,1,'en-g1-a','u02','l01',1,NOW(3),NOW(3))`);
await expectErr('UNIQUE：同一单元同一关卡只有一行进度', app, `INSERT INTO level_progress (family_id,child_id,course_id,unit_key,level_key,last_attempt_at) VALUES (1,1,'en-g1-a','u01','l01',NOW())`, [], ['ER_DUP_ENTRY']);
await expectOk('单元进度：u01 全部关卡通过且全 3 星级', app, `INSERT INTO unit_progress (family_id,child_id,course_id,unit_key,level_count,levels_passed,levels_three_star,first_completed_at,first_all_three_star_at) VALUES (1,1,'en-g1-a','u01',1,1,1,NOW(3),NOW(3))`);
await expectErr('UNIQUE：同一孩子同一单元只有一行进度（首次全 3 星级只触发一次）', app, `INSERT INTO unit_progress (family_id,child_id,course_id,unit_key,level_count) VALUES (1,1,'en-g1-a','u01',4)`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：单元已通过关卡数不超过关卡数', app, `INSERT INTO unit_progress (family_id,child_id,course_id,unit_key,level_count,levels_passed) VALUES (1,1,'en-g1-a','u02',4,5)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：3 星级关卡数不超过已通过关卡数', app, `INSERT INTO unit_progress (family_id,child_id,course_id,unit_key,level_count,levels_passed,levels_three_star) VALUES (1,1,'en-g1-a','u02',4,1,2)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：单元全 3 星级必须先完成单元', app, `INSERT INTO unit_progress (family_id,child_id,course_id,unit_key,level_count,levels_passed,levels_three_star,first_all_three_star_at) VALUES (1,1,'en-g1-a','u02',1,1,1,NOW(3))`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：单元进度的孩子必须属于同一家庭', app, `INSERT INTO unit_progress (family_id,child_id,course_id,unit_key,level_count) VALUES (2,1,'en-g1-a','u02',4)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('权限：app 不能 UPDATE 闯关记录', app, `UPDATE attempts SET correct_count=5`, [], ['ER_TABLEACCESS_DENIED_ERROR']);

// 8) 复习（绑定义项）
await expectOk('复习条目（义项）', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,due_date) VALUES (1,1,'sense','en.apple.fruit','2026-10-22')`);
await expectErr('UNIQUE：同一孩子同一义项只有一条复习条目', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,due_date) VALUES (1,1,'sense','en.apple.fruit','2026-10-23')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：复习盒 1..6', app, `UPDATE review_items SET box=7 WHERE child_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：义项条目不能带题目 ID', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,question_id,due_date) VALUES (1,1,'sense','en.pear.fruit',1,'2026-10-22')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('复习条目记录来源单元（月亮秘境统计用）', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,due_date,origin_course_id,origin_unit_key) VALUES (1,1,'sense','en.bat.animal','2026-10-22','en-g1-a','u02')`);
await expectErr('CHECK：来源课程与来源单元同时存在', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,due_date,origin_course_id) VALUES (1,2,'sense','en.bat.animal','2026-10-22','en-g1-a')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO plays (id,family_id,child_id,kind,client_request_id,local_date,items,status,finished_at) VALUES (10,1,1,'review',?,'2026-10-22','[]','finished',NOW(3)),(11,1,1,'review',?,'2026-10-22','[]','finished',NOW(3)),(12,1,1,'review',?,'2026-10-22','[]','finished',NOW(3))`, [uuid(10), uuid(11), uuid(12)]);
await app.query(`INSERT INTO review_sessions (family_id,child_id,play_id,review_date,item_count,correct_count,completes_day,results) VALUES (1,1,10,'2026-10-22',10,9,0,'[]'),(1,1,11,'2026-10-22',10,10,1,'[]')`);
await expectErr('UNIQUE：每天最多一次“今日复习完成”', app, `INSERT INTO review_sessions (family_id,child_id,play_id,review_date,item_count,correct_count,completes_day,results) VALUES (1,1,12,'2026-10-22',1,1,1,'[]')`, [], ['ER_DUP_ENTRY']);
// 8b) 隐藏奖励与秘密路线（旧系统，ADR 0020）
const hclaim = (lvl, type, amt, att, ledger = 'NULL') => `INSERT INTO hidden_reward_claims (family_id,child_id,course_id,unit_key,level_key,reward_type,amount,attempt_id,ledger_id) VALUES (1,1,'en-g1-a','u01','${lvl}','${type}',${amt},${att},${ledger})`;
await expectOk('隐藏奖励：翻倍时本次没有新增星，记 0 也算已领（旧系统）', app, hclaim('l01', 'double', 0, 2));
await expectErr('UNIQUE：每个孩子每关只领一次隐藏奖励', app, hclaim('l01', 'double', 1, 3, 1), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：宝箱隐藏奖励固定 20 星', app, hclaim('l02', 'fixed', 19, 3, 1), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：有奖励数量必须有星星流水', app, hclaim('l02', 'double', 2, 3), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能修改隐藏奖励记录', app, `UPDATE hidden_reward_claims SET amount=3`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
const sroute = (route, extra = ['', '']) => `INSERT INTO secret_routes (family_id,child_id,course_id,unit_key,route${extra[0]}) VALUES (1,1,'en-g1-a','u01','${route}'${extra[1]})`;
await expectOk('发现秘密路线：金币小径', app, sroute('coins'));
{ const [[sr]] = await app.query(`SELECT entry_cost c FROM secret_routes WHERE route='coins'`);
  ok('秘密路线入场费由路线决定：金币小径 2 星（赛车 5、月亮 10）', Number(sr.c) === 2, JSON.stringify(sr)); }
await expectErr('UNIQUE：同一单元同一路线只发现一次', app, sroute('coins'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：进入秘密路线必须有入场费流水', app, `UPDATE secret_routes SET entered_at=NOW(3) WHERE route='coins'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：通过秘密路线必须先进入', app, sroute('kart', [',passed_at,reward_ledger_id', ',NOW(3),1']), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：秘密路线的发现记录不可改（列级授权）', app, `UPDATE secret_routes SET discovered_at=NOW(3) WHERE route='coins'`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);

// 9) 账本：星星
const led = (cur, kind, d, bal, key, extra = '') => `INSERT INTO ledger (family_id,child_id,currency,kind,delta,balance_after,source_key,local_date${extra ? ',actor_parent_id' : ''}) VALUES (1,1,'${cur}','${kind}',${d},${bal},'${key}','2026-10-21'${extra ? ',' + extra : ''})`;
await expectOk('账本：通关 +1 星', app, led('star', 'level_pass', 1, 1, 'attempt:1'));
await expectOk('账本：家长奖励 +40 星', app, led('star', 'parent_award', 40, 41, 'award:1:x', '1'));
await expectErr('幂等：同一 source_key 只入账一次', app, led('star', 'level_pass', 1, 2, 'attempt:1'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：余额不可为负', app, led('star', 'purchase', -50, -9, 'purchase:hat'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：通关单次最多 3 星', app, led('star', 'level_pass', 5, 46, 'attempt:99'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：赠送单笔 ≤20', app, led('star', 'gift_out', -21, 20, 'gift:1:out'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：支出类必须为负', app, led('star', 'purchase', 30, 71, 'purchase:hat2'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：家长奖励必须记录家长', app, led('star', 'parent_award', 5, 46, 'award:1:y'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：家长奖励的家长必须同一家庭', app, led('star', 'parent_award', 5, 46, 'award:2:z', '2'), [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('权限：app 不能 UPDATE 账本', app, `UPDATE ledger SET delta=3 WHERE child_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DELETE 账本', app, `DELETE FROM ledger WHERE child_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);

// 10) 账本：碎片（同一只追加账本的第二币种）
await expectOk('碎片：学习卡首次展示 +3（旧系统随机 1–3）、复习 +2', app, `${led('fragment', 'learning_card', 3, 3, 'card:1:c01')}; ${led('fragment', 'review_day', 2, 5, 'review:2026-10-21')}`);
await expectErr('CHECK：通关不再发碎片（旧系统没有通关碎片）', app, led('fragment', 'level_pass', 3, 8, 'frag:level:x'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：学习卡碎片每次 1–3 片', app, led('fragment', 'learning_card', 4, 9, 'card:1:c02'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('幂等：同一次作答同一张学习卡只发一次碎片', app, led('fragment', 'learning_card', 1, 6, 'card:1:c01'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：学习卡碎片不发星星', app, led('star', 'learning_card', 1, 46, 'card:1:c03'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('同一 source_key 在不同币种下各记一次', app, led('star', 'streak', 3, 44, 'review:2026-10-21'));
await expectErr('CHECK：复习不发星星（review_day 只用于碎片，ADR 0017）', app, led('star', 'review_day', 2, 46, 'review:2026-10-19'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('幂等：碎片同一 source_key 只入账一次', app, led('fragment', 'review_day', 2, 7, 'review:2026-10-21'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：碎片不能用于购买装扮（币种与类型匹配）', app, led('fragment', 'purchase', -1, 4, 'purchase:hat-x'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：碎片不能由家长奖励（无被动或人工来源）', app, led('fragment', 'parent_award', 5, 10, 'award:f', '1'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：每个呀哈哈家族成员只给 1 片碎片', app, led('fragment', 'discovery', 2, 7, 'discovery:spot:9'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：复习完成碎片固定 2 片', app, led('fragment', 'review_day', 3, 8, 'review:2026-10-20'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：碎片余额不可为负', app, led('fragment', 'pet_adopt', -40, -35, 'pet:adopt:1'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能 UPDATE 碎片流水', app, `UPDATE ledger SET delta=3 WHERE currency='fragment'`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DELETE 碎片流水', app, `DELETE FROM ledger WHERE currency='fragment'`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
const [[fsum]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND currency='fragment'`);
ok('碎片余额 = SUM(delta) = 5（与星星分开计算）', Number(fsum.s) === 5);
const [[ls]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND counts_for_leaderboard=1`);
ok('“学习星”：通关 1 + 连续 3 = 4（家长奖励不算）', Number(ls.s) === 4, String(ls.s));
// 10a) 家长加星 / 扣星（旧系统 1–1000000，扣星带原因）、隐藏奖励与秘密路线星（孩子 2）
const led2 = (kind, d, bal, key, actor = '', note = '') => `INSERT INTO ledger (family_id,child_id,currency,kind,delta,balance_after,source_key,local_date,actor_parent_id,note) VALUES (1,2,'star','${kind}',${d},${bal},'${key}','2026-10-21',${actor || 'NULL'},${note ? `'${note}'` : 'NULL'})`;
await expectOk('家长加星 500（旧系统范围 1–1000000）', app, led2('parent_award', 500, 500, 'award:2:a', '1', '帮忙做家务'));
await expectOk('家长扣星 20，带原因', app, led2('parent_deduct', -20, 480, 'deduct:2:a', '1', '没完成约定'));
await expectErr('CHECK：扣星必须写原因', app, led2('parent_deduct', -5, 475, 'deduct:2:b', '1'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：扣星必须记录家长', app, led2('parent_deduct', -5, 475, 'deduct:2:c', '', 'x'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：家长加星单次不超过 1000000', app, led2('parent_award', 1000001, 1000481, 'award:2:b', '1'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('隐藏奖励 +20、秘密路线入场 −5 与奖励 +10', app, `${led2('hidden_reward', 20, 500, 'hidden:en-g1-a:u01:l02')}; ${led2('secret_entry', -5, 495, 'secret:entry:en-g1-a:u01:kart')}; ${led2('secret_reward', 10, 505, 'secret:reward:en-g1-a:u01:kart')}`);
await expectErr('CHECK：隐藏奖励最多 20 星', app, led2('hidden_reward', 21, 526, 'hidden:x'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：秘密路线入场费只能是 2 / 5 / 10', app, led2('secret_entry', -3, 502, 'secret:entry:x'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：秘密路线奖励只能是 4 / 10 / 20（入场费 2 倍）', app, led2('secret_reward', 6, 511, 'secret:reward:x'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
{ const [[l2]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=2 AND counts_for_leaderboard=1`);
  ok('学习星含隐藏奖励与秘密路线奖励（入场费、家长加减星不算）：20 + 10 = 30', Number(l2.s) === 30, String(l2.s)); }

// 10b) 账本：积分（同一只追加账本的第三币种；0.01 为单位，ADR 0017）
await expectOk('积分：关内听发音 +0.1、单词本听发音 +0.1、复习答对 +1、伙伴附赠', app, `${led('point', 'level_listen', 10, 10, 'listen:7:q1:prompt')}; ${led('point', 'word_listen', 10, 20, 'word:2026-10-21:en.bat.animal:us')}; ${led('point', 'review_correct', 100, 120, 'review_correct:2026-10-21:5')}; ${led('point', 'pet_bonus', 30, 150, 'petbonus:attempt:1')}`);
await expectErr('幂等：同一作答同一发音目标只得一次积分', app, led('point', 'level_listen', 10, 160, 'listen:7:q1:prompt'), [], ['ER_DUP_ENTRY']);
await expectErr('幂等：同一复习条目同一天只得一次积分', app, led('point', 'review_correct', 100, 250, 'review_correct:2026-10-21:5'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：听发音每次固定 0.1 积分', app, led('point', 'level_listen', 20, 170, 'listen:7:q2:prompt'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：伙伴附赠每星至少 0.10（1 星 × 0.10 = 10 单位）', app, led('point', 'pet_bonus', 5, 155, 'petbonus:attempt:2'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：积分不能由家长奖励', app, led('point', 'parent_award', 100, 250, 'award:p', '1'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：积分不能直接购买装扮', app, led('point', 'purchase', -100, 50, 'purchase:hat-p'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：星星不能记为听发音来源', app, led('star', 'level_listen', 10, 54, 'listen:7:q3:prompt'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('复习答对 9 题（不同条目）累计到 10.50 积分', app, [6,7,8,9,10,11,12,13,14].map((i, k) => led('point', 'review_correct', 100, 250 + k * 100, `review_correct:2026-10-21:${i}`)).join('; '));
await expectOk('积分换星：−10 积分 与 +1 星 同一 source_key', app, `${led('point', 'point_convert', -1000, 50, 'convert:r1')}; INSERT INTO ledger (family_id,child_id,currency,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'star','point_convert',1,45,'convert:r1','2026-10-21')`);
await expectErr('CHECK：兑换必须是 10 积分的整数倍', app, led('point', 'point_convert', -1500, 0, 'convert:r2'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：一次最多兑换 1000 星', app, `INSERT INTO ledger (family_id,child_id,currency,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'star','point_convert',1001,1046,'convert:r3','2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：积分余额不可为负', app, led('point', 'point_convert', -1000, -1000, 'convert:r4'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能 UPDATE 积分流水', app, `UPDATE ledger SET delta=20 WHERE currency='point'`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
{ const [[ps]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND currency='point'`);
  ok('积分余额 = SUM(delta) = 0.50（1050 − 1000 单位）', Number(ps.s) === 50, String(ps.s));
  const [[ls2]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND counts_for_leaderboard=1`);
  ok('积分换来的星星是奖励星（不计学习星）', Number(ls2.s) === 4, String(ls2.s)); }
await expectOk('作答记录跟随伙伴等级快照', app, `INSERT INTO plays (family_id,child_id,kind,client_request_id,local_date,items,companion_level) VALUES (1,1,'review',?,'2026-10-22','[]',12)`, [uuid(13)]);
await expectErr('CHECK：伙伴等级快照 1–100', app, `INSERT INTO plays (family_id,child_id,kind,client_request_id,local_date,items,status,finished_at,companion_level) VALUES (1,1,'review',?,'2026-10-22','[]','finished',NOW(3),0)`, [uuid(14)], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 11) 商店、现实奖励
await app.query(`INSERT INTO shop_items (id,name,price,image_asset_id,sort_order,status) VALUES ('hat-leaf','叶子徽章',30,1,1,'listed'),('hat-star','星星徽章',40,1,2,'listed')`);
await expectErr('权限：app 不能 DROP 表', app, `DROP TABLE ledger`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能建账号', app, `CREATE USER 'evil'@'%' IDENTIFIED BY 'x'`, [], ['ER_SPECIFIC_ACCESS_DENIED_ERROR']);
await expectErr('CHECK：余额缓存不可为负', app, `UPDATE balances SET balance=-1 WHERE child_id=1 AND currency='star'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('购买并持有物品', app, `${led('star', 'purchase', -30, 15, 'purchase:hat-leaf')};
  INSERT INTO child_items (family_id,child_id,item_id,equipped,purchase_ledger_id) VALUES (1,1,'hat-leaf',1,LAST_INSERT_ID())`);
await expectErr('UNIQUE：同一物品只能买一次', app, `INSERT INTO child_items (family_id,child_id,item_id,purchase_ledger_id) SELECT 1,1,'hat-leaf',MAX(id) FROM ledger`, [], ['ER_DUP_ENTRY']);
await app.query(`INSERT INTO child_items (family_id,child_id,item_id,equipped,purchase_ledger_id) SELECT 1,1,'hat-star',0,MAX(id) FROM ledger`);
await expectErr('UNIQUE：同时只佩戴一枚探险徽章（旧系统）', app, `UPDATE child_items SET equipped=1 WHERE item_id='hat-star'`, [], ['ER_DUP_ENTRY']);
const [[ss]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND currency='star'`);
ok('星星余额 = SUM(delta) = 最后一行 balance_after', Number(ss.s) === 15, String(ss.s));
await app.query(`INSERT INTO reward_options (id,family_id,title,unit,amount_per_portion,star_price,created_by_parent_id) VALUES (1,1,'玩游戏机','minute',10,20,1),(2,2,'吃冰淇淋','count',1,5,2),(3,1,'玩具额度','fen',100,1,1)`);
const redeem = (id, opt, title, unit, portions, unitPrice, amount, price) => `INSERT INTO redemptions (${id ? 'id,' : ''}family_id,child_id,reward_option_id,title_snapshot,unit,portions,unit_price,amount_total,price) VALUES (${id ? id + ',' : ''}1,1,${opt},'${title}','${unit}',${portions},${unitPrice},${amount},${price})`;
await expectErr('复合外键：只能兑换本家庭的奖励', app, redeem(0, 2, '吃冰淇淋', 'count', 1, 5, 1, 5), [], ['ER_NO_REFERENCED_ROW_2']);
await expectOk('兑换 3 份“玩游戏机”（每份 10 分钟 / 20 星）', app, redeem(1, 1, '玩游戏机', 'minute', 3, 20, 30, 60));
await expectErr('CHECK：冻结星星 = 份数 × 每份星价', app, redeem(0, 1, '玩游戏机', 'minute', 3, 20, 30, 50), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：一次最多兑换 1000 份', app, redeem(0, 3, '玩具额度', 'fen', 1001, 1, 100100, 1001), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：批准必须记录家长与时间', app, `UPDATE redemptions SET status='approved' WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('家长批准 → 累计奖励余额 +30 分钟（获批入账流水）', app, `UPDATE redemptions SET status='approved', decided_at=NOW(3), decided_by_parent_id=1 WHERE id=1;
  INSERT INTO reward_balances (child_id,reward_option_id,family_id,balance) VALUES (1,1,1,30);
  INSERT INTO reward_ledger (family_id,child_id,reward_option_id,kind,delta,balance_after,redemption_id,local_date) VALUES (1,1,1,'grant',30,30,1,'2026-10-21')`);
await expectOk('孩子用掉 10 分钟、家长核销 10 分钟（带说明）', app, `INSERT INTO reward_ledger (family_id,child_id,reward_option_id,kind,delta,balance_after,local_date) VALUES (1,1,1,'consume',-10,20,'2026-10-21');
  INSERT INTO reward_ledger (family_id,child_id,reward_option_id,kind,delta,balance_after,actor_parent_id,reason,local_date) VALUES (1,1,1,'writeoff',-10,10,1,'周六玩了 10 分钟','2026-10-21')`);
await expectErr('CHECK：核销必须记录家长', app, `INSERT INTO reward_ledger (family_id,child_id,reward_option_id,kind,delta,balance_after,local_date) VALUES (1,1,1,'writeoff',-5,5,'2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：同一兑换单只入账一次', app, `INSERT INTO reward_ledger (family_id,child_id,reward_option_id,kind,delta,balance_after,redemption_id,local_date) VALUES (1,1,1,'grant',30,40,1,'2026-10-21')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：累计奖励余额不可为负', app, `INSERT INTO reward_ledger (family_id,child_id,reward_option_id,kind,delta,balance_after,local_date) VALUES (1,1,1,'consume',-20,-10,'2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能 UPDATE 累计奖励流水', app, `UPDATE reward_ledger SET delta=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);

// 12) 伙伴
await expectErr('CHECK：档位星价 1–5000', app, `INSERT INTO pet_tiers (name,sort_order,star_price,fragment_price) VALUES ('免费',0,0,10)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
{ const [[t]] = await app.query(`SELECT (SELECT COUNT(*) FROM pet_tiers) tiers, (SELECT COUNT(*) FROM pet_tier_stages) stages, (SELECT star_price FROM pet_tiers WHERE id=1) p1`);
  ok('默认档位 5 个（含唯一档）、成长阶段 20 个由迁移写入（初级 20 星）', Number(t.tiers) === 5 && Number(t.stages) === 20 && Number(t.p1) === 20, JSON.stringify(t)); }
{ const [tiers] = await app.query(`SELECT name, star_price s, fragment_price f, site_unique u FROM pet_tiers ORDER BY sort_order`);
  ok('档位价格照旧系统：20/80、50/160、100/320、250/800、唯一 600/2000（全站唯一）', tiers.map(t => `${t.s}/${t.f}/${t.u}`).join(' ') === '20/80/0 50/160/0 100/320/0 250/800/0 600/2000/1', JSON.stringify(tiers)); }
{ const [[dp]] = await app.query(`SELECT (SELECT value FROM system_settings WHERE setting_key='companion.den_slot_prices') p, (SELECT value FROM system_settings WHERE setting_key='companion.unlock_stars') u`);
  const pp = typeof dp.p === 'string' ? JSON.parse(dp.p) : dp.p; const uu = typeof dp.u === 'string' ? JSON.parse(dp.u) : dp.u;
  ok('营地扩建价格照旧系统 10/20/100/200/500，领养门槛默认 0', JSON.stringify(pp) === '[10,20,100,200,500]' && uu === 0, JSON.stringify(dp)); }
{ const [[c]] = await app.query(`SELECT MIN(max_level) mn, MAX(max_level) mx, MIN(xp_base) b, MIN(xp_step) st, MIN(xp_quad_div) q, (SELECT GROUP_CONCAT(min_level ORDER BY stage_no) FROM pet_tier_stages WHERE tier_id=1) lv FROM pet_tiers`);
  ok('默认档位最高 100 级、曲线 2/1/200（旧系统）、阶段 1/20/50/100', Number(c.mn) === 100 && Number(c.mx) === 100 && Number(c.b) === 2 && Number(c.st) === 1 && Number(c.q) === 200 && c.lv === '1,20,50,100', JSON.stringify(c)); }
await expectErr('CHECK：档位最高等级 ≤ 100', app, `UPDATE pet_tiers SET max_level=101 WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：曲线二次项除数 1–10000', app, `UPDATE pet_tiers SET xp_quad_div=0 WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：第 1 阶段从 1 级开始', app, `UPDATE pet_tier_stages SET min_level=3 WHERE tier_id=1 AND stage_no=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：上架的伙伴必须经过审核', app, `INSERT INTO pet_species (species_key,name,description,tier_id,status,design,created_by_admin_id,published_at) VALUES ('leafy','叶叶','x',1,'published','{}',1,NOW(3))`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO pet_species (id,species_key,name,description,tier_id,status,design,created_by_admin_id,reviewed_by_admin_id,published_at) VALUES (1,'leafy','叶叶','原创小叶精灵',1,'published','{}',1,1,NOW(3)),(2,'pebble','石石','原创小石头',1,'published','{}',1,1,NOW(3))`);
await expectOk('seeds:apply 导入旧系统宠物（seed 种类，无需工作室审核；单独定价）', mig, `INSERT INTO pet_species (id,species_key,name,description,origin,tier_id,star_price,fragment_price,status,design,published_at) VALUES (3,'rosalina','罗莎塔','旧系统唯一档宠物','seed',5,NULL,NULL,'published','{"image":"pub/pets/rosalina.svg"}',NOW(3)),(4,'mario','马里奥','旧系统中级宠物','seed',2,50,100,'published','{"image":"pub/pets/mario.svg"}',NOW(3))`);
await expectErr('CHECK：工作室种类必须记录创建人', app, `INSERT INTO pet_species (species_key,name,description,origin,tier_id,design) VALUES ('nobody','无名','x','studio',1,'{}')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：种类单独定价 1–5000 星', app, `UPDATE pet_species SET star_price=0 WHERE id=4`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('用碎片领养伙伴（第一只自动成为跟随伙伴）', app, `${led('fragment', 'pet_adopt', -5, 0, 'pet:adopt:leafy')};
  INSERT INTO child_pets (family_id,child_id,species_id,is_companion,adopted_with,price_paid,adopt_ledger_id) VALUES (1,1,1,1,'fragment',5,LAST_INSERT_ID())`);
await expectOk('用星星领养第二只', app, `${led('star', 'pet_adopt', -10, 3, 'pet:adopt:pebble')};
  INSERT INTO child_pets (family_id,child_id,species_id,is_companion,adopted_with,price_paid,adopt_ledger_id) VALUES (1,1,2,0,'star',10,LAST_INSERT_ID())`);
await expectErr('UNIQUE：每个孩子只有一只跟随伙伴', app, `UPDATE child_pets SET is_companion=1 WHERE species_id=2`, [], ['ER_DUP_ENTRY']);
await expectErr('UNIQUE：同种伙伴每人一只', app, `INSERT INTO child_pets (family_id,child_id,species_id,adopted_with,price_paid,adopt_ledger_id) SELECT 1,1,1,'star',10,MAX(id) FROM ledger`, [], ['ER_DUP_ENTRY']);
await expectErr('权限：app 不能物理删除伙伴', app, `DELETE FROM child_pets WHERE child_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('改名、亲密度（旧系统）', app, `UPDATE child_pets SET nickname='小叶子', affection=3 WHERE species_id=1 AND child_id=1`);
await expectErr('CHECK：伙伴名字 1–12 字', app, `UPDATE child_pets SET nickname='${'叶'.repeat(13)}' WHERE species_id=1 AND child_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DATA_TOO_LONG']);
await expectErr('CHECK：亲密度最高 100', app, `UPDATE child_pets SET affection=101 WHERE species_id=1 AND child_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('摸摸 / 点心各一次', app, `INSERT INTO pet_interactions (child_id,child_pet_id,local_date,action,family_id) SELECT 1,id,'2026-10-21','pet',1 FROM child_pets WHERE species_id=1 AND child_id=1; INSERT INTO pet_interactions (child_id,child_pet_id,local_date,action,family_id) SELECT 1,id,'2026-10-21','feed',1 FROM child_pets WHERE species_id=1 AND child_id=1`);
await expectErr('UNIQUE：同一伙伴同一动作每天一次', app, `INSERT INTO pet_interactions (child_id,child_pet_id,local_date,action,family_id) SELECT 1,id,'2026-10-21','pet',1 FROM child_pets WHERE species_id=1 AND child_id=1`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：退订必须有返还流水', app, `UPDATE child_pets SET status='refunded', ended_at=NOW(3) WHERE species_id=2 AND child_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('退订返还一半（星星 +5），之后可再领养同种', app, `${led('star', 'pet_refund', 5, 8, 'pet:refund:pebble')};
  UPDATE child_pets SET status='refunded', ended_at=NOW(3), refund_ledger_id=LAST_INSERT_ID() WHERE species_id=2 AND child_id=1;
  ${led('star', 'pet_adopt', -8, 0, 'pet:adopt:pebble:2')};
  INSERT INTO child_pets (family_id,child_id,species_id,adopted_with,price_paid,adopt_ledger_id) VALUES (1,1,2,'star',8,LAST_INSERT_ID())`);
await expectOk('赠送伙伴给兄弟姐妹（等级、亲密度、名字随之转移）', app, `UPDATE child_pets SET status='gifted', ended_at=NOW(3), is_companion=0 WHERE id=1;
  INSERT INTO child_pets (id,family_id,child_id,species_id,nickname,affection,acquired_via,adopted_with,price_paid,gifted_from_pet_id) VALUES (10,1,2,1,'小叶子',3,'gift','fragment',5,1);
  INSERT INTO pet_gifts (from_family_id,from_child_id,to_family_id,to_child_id,from_pet_id,to_pet_id) VALUES (1,1,1,2,1,10)`);
await expectErr('CHECK：受赠的伙伴不能退订（防止绕过每日赠星上限）', app, `UPDATE child_pets SET status='refunded', ended_at=NOW(3), refund_ledger_id=(SELECT MAX(id) FROM ledger) WHERE id=10`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_UPDATE_TABLE_USED']);
await expectErr('CHECK：跨家庭赠送伙伴必须关联好友关系', app, `INSERT INTO pet_gifts (from_family_id,from_child_id,to_family_id,to_child_id,from_pet_id,to_pet_id) VALUES (1,2,2,3,10,10)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_NO_REFERENCED_ROW_2']);
await expectOk('领养唯一档宠物（全站同时只能一人拥有）', app, `${led('star', 'pet_adopt', -1, 0, 'pet:adopt:rosalina')};
  INSERT INTO child_pets (family_id,child_id,species_id,site_unique,adopted_with,price_paid,adopt_ledger_id) VALUES (1,1,3,1,'star',600,LAST_INSERT_ID())`);
await expectErr('UNIQUE：唯一档宠物全站同时只有一个主人', app, `INSERT INTO ledger (family_id,child_id,currency,kind,delta,balance_after,source_key,local_date) VALUES (2,3,'star','streak',1,1,'streak:x','2026-10-21'); INSERT INTO child_pets (family_id,child_id,species_id,site_unique,adopted_with,price_paid,adopt_ledger_id) VALUES (2,3,3,1,'star',600,LAST_INSERT_ID())`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：营地扩建最多 10 格', app, `INSERT INTO pet_dens (child_id,family_id,extra_slots) VALUES (1,1,11)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 13) 呀哈哈发现：藏匿点由服务端在通关时决定，只能揭晓一次
await app.query(`INSERT INTO yahaha_sets (id,name,sort_order,status) VALUES (1,'森林',1,'listed');
  INSERT INTO yahaha_styles (id,style_key,name,set_id,rarity,total_stock,status,design,created_by_admin_id,reviewed_by_admin_id,published_at) VALUES (1,'leaf-hat','叶帽呀哈哈',1,'common',NULL,'published','{}',1,1,NOW(3)),(2,'gold-leaf','金叶呀哈哈',1,'legendary',2,'published','{}',1,1,NOW(3))`);
await expectErr('CHECK：放置数量不得超过全站库存', app, `UPDATE yahaha_styles SET placed_total=3 WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const spot = (att, no, style, seq, date = '2026-10-21') => `INSERT INTO hiding_spots (family_id,child_id,attempt_id,spot_no,spot_kind,local_date,style_id,daily_seq) VALUES (1,1,${att},${no},'leaf','${date}',${style},${seq})`;
await expectOk('通关打开 3 个藏匿点（1 个有呀哈哈家族成员）', app, `${spot(1, 1, 1, 1)}; ${spot(1, 2, 'NULL', 'NULL')}; ${spot(1, 3, 'NULL', 'NULL')}`);
await expectErr('UNIQUE：同一次通关同一藏匿点只记一次', app, spot(1, 1, 'NULL', 'NULL'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：每次通关最多 3 个藏匿点', app, spot(1, 4, 'NULL', 'NULL'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：当天放置序号不可重复（并发放置不会超额）', app, spot(2, 1, 1, 1), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：每孩子每天放置上限不超过 10', app, spot(2, 1, 1, 11), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：有呀哈哈家族成员的藏匿点必须占用当天序号', app, spot(2, 1, 1, 'NULL'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能改藏匿点内容（列级授权）', app, `UPDATE hiding_spots SET style_id=2 WHERE attempt_id=1 AND spot_no=2`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
const [r1] = await app.query(`UPDATE hiding_spots SET revealed_at=NOW(3) WHERE attempt_id=1 AND spot_no=1 AND child_id=1 AND revealed_at IS NULL`);
const [r2] = await app.query(`UPDATE hiding_spots SET revealed_at=NOW(3) WHERE attempt_id=1 AND spot_no=1 AND child_id=1 AND revealed_at IS NULL`);
ok('只能揭晓一次：第一次影响 1 行，重复点开影响 0 行', r1.affectedRows === 1 && r2.affectedRows === 0, `${r1.affectedRows}/${r2.affectedRows}`);
await expectOk('揭晓：图鉴 +1、碎片 +1', app, `${led('fragment', 'discovery', 1, 1, 'discovery:spot:1')};
  INSERT INTO yahaha_finds (family_id,child_id,spot_id,style_id,fragment_ledger_id) SELECT 1,1,id,style_id,LAST_INSERT_ID() FROM hiding_spots WHERE attempt_id=1 AND spot_no=1`);
await expectErr('复合外键：图鉴款式必须等于藏匿点中放置的款式', app, `INSERT INTO yahaha_finds (family_id,child_id,spot_id,style_id,fragment_ledger_id) SELECT 1,1,id,2,1 FROM hiding_spots WHERE attempt_id=1 AND spot_no=2`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('UNIQUE：同一藏匿点只能进一次图鉴', app, `INSERT INTO yahaha_finds (family_id,child_id,spot_id,style_id,fragment_ledger_id) SELECT 1,1,id,style_id,1 FROM hiding_spots WHERE attempt_id=1 AND spot_no=1`, [], ['ER_DUP_ENTRY']);
await expectErr('幂等：同一藏匿点碎片只发一次', app, led('fragment', 'discovery', 1, 2, 'discovery:spot:1'), [], ['ER_DUP_ENTRY']);
await expectErr('权限：app 不能删除图鉴', app, `DELETE FROM yahaha_finds`, [], ['ER_TABLEACCESS_DENIED_ERROR']);

// 13b) 单词本（ADR 0019，与旧系统“我的单词”一致）
await expectOk('单词本：词身份与词条（孩子 1：apple）', app, `INSERT INTO word_identities (id,family_id,child_id,normalized) VALUES (1,1,1,'apple'),(2,1,1,'banana'),(3,1,2,'apple');
  INSERT INTO word_entries (id,family_id,child_id,identity_id,word,normalized,meaning_zh,phrases,examples) VALUES (1,1,1,1,'Apple','apple','苹果','[{"en":"an apple","zh":"一个苹果"}]','[]')`);
await expectErr('UNIQUE：同一孩子同一个词只能有一条词条', app, `INSERT INTO word_entries (family_id,child_id,identity_id,word,normalized,phrases,examples) VALUES (1,1,1,'apple ','apple','[]','[]')`, [], ['ER_DUP_ENTRY']);
await expectErr('复合外键：词条的词身份必须属于同一孩子', app, `INSERT INTO word_entries (family_id,child_id,identity_id,word,normalized,phrases,examples) VALUES (1,1,3,'pear','pear','[]','[]')`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：短语最多 10 条', app, `INSERT INTO word_entries (family_id,child_id,identity_id,word,normalized,phrases,examples) VALUES (1,1,2,'banana','banana',JSON_ARRAY(1,2,3,4,5,6,7,8,9,10,11),'[]')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：单词不能超过 80 字符', app, `INSERT INTO word_entries (family_id,child_id,identity_id,word,normalized,phrases,examples) VALUES (1,1,2,REPEAT('a',81),'banana','[]','[]')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DATA_TOO_LONG']);
await expectOk('词身份按二进制比较：café 与 cafe 是两个词', app, `INSERT INTO word_identities (family_id,child_id,normalized) VALUES (1,1,'café'),(1,1,'cafe')`);
await expectErr('CHECK：词身份必须是归一化小写', app, `INSERT INTO word_identities (family_id,child_id,normalized) VALUES (1,1,'Pear')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：闯关最高进度 0–3', app, `UPDATE word_identities SET best_challenge=4 WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：未学习的词没有首次学会时间', app, `UPDATE word_identities SET first_passed_at=NOW(3) WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('首次学会：状态改为已掌握并记录时间', app, `UPDATE word_identities SET status='mastered', first_passed_at=NOW(3), best_challenge=3 WHERE id=1`);
await expectOk('删除词条（词身份保留）', app, `DELETE FROM word_entries WHERE id=1`);
{ const [[wi]] = await app.query(`SELECT status, best_challenge b FROM word_identities WHERE id=1`);
  ok('删除词条后学习状态与最高进度保留', wi.status === 'mastered' && Number(wi.b) === 3, JSON.stringify(wi)); }
await expectErr('权限：app 不能删除词身份', app, `DELETE FROM word_identities WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('CHECK：模式星星余量 0–4', app, `INSERT INTO word_book_progress (child_id,family_id,challenge_units) VALUES (1,1,5)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('星星余量行', app, `INSERT INTO word_book_progress (child_id,family_id,challenge_units,exam_units) VALUES (1,1,4,0)`);
const wtask = (id, mode, status, req, extra = '') => `INSERT INTO word_tasks (id,family_id,child_id,mode,status,word_count,question_count,snapshot,client_request_id,local_date${extra ? ',companion_level' : ''}) VALUES (${id},1,1,'${mode}','${status}',5,10,'{}','${uuid(req)}','2026-10-23'${extra ? ',' + extra : ''})`;
await expectOk('开始单词闯关（记录跟随伙伴等级）', app, wtask(1, 'challenge', 'quiz', 60, '12'));
await expectErr('UNIQUE：同一孩子同时只有一轮单词学习进行中', app, wtask(2, 'exam', 'quiz', 61), [], ['ER_DUP_ENTRY']);
await expectOk('结算后可开始下一轮', app, `UPDATE word_tasks SET status='completed', completed_at=NOW(3), result='{}', revision=revision+1 WHERE id=1; ${wtask(2, 'exam', 'quiz', 61)}`);
await expectErr('CHECK：完成必须同时有结果与完成时间', app, `UPDATE word_tasks SET status='completed' WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：只有学习模式有学习卡阶段', app, `UPDATE word_tasks SET status='study' WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：只有闯关记录跟随伙伴等级', app, `UPDATE word_tasks SET companion_level=5 WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：每轮最多 50 个词', app, `UPDATE word_tasks SET word_count=51 WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：同一请求 ID 只开始一轮', app, `UPDATE word_tasks SET status='abandoned' WHERE id=2; ${wtask(3, 'study', 'study', 61)}`, [], ['ER_DUP_ENTRY']);
await expectOk('随机判定记录', app, `INSERT INTO word_random_draws (child_id,draw_date,mode,identity_id,family_id,task_id) VALUES (1,'2026-10-23','challenge',1,1,1)`);
await expectErr('UNIQUE：同日同模式同一个词只判定一次', app, `INSERT INTO word_random_draws (child_id,draw_date,mode,identity_id,family_id,task_id) VALUES (1,'2026-10-23','challenge',1,1,2)`, [], ['ER_DUP_ENTRY']);
await expectErr('权限：app 不能删除随机判定记录', app, `DELETE FROM word_random_draws`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('单词闯关星 +3（学习星，用户 2026-10-22）与伙伴附赠积分', app, `${led('star', 'word_challenge', 3, 18, 'word:1')}; ${led('point', 'pet_bonus', 36, 86, 'petbonus:word:1')}`);
await expectErr('CHECK：单词闯关单次最多 30 星', app, led('star', 'word_challenge', 31, 49, 'word:9'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：单词考试单次最多 20 星', app, led('star', 'word_exam', 21, 39, 'word:8'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：单词星只发星星', app, led('fragment', 'word_challenge', 1, 6, 'word:7'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：伙伴附赠积分最多 30 星 × 1.00', app, led('point', 'pet_bonus', 3001, 3087, 'petbonus:word:9'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
{ const [[lw]] = await app.query(`SELECT counts_for_leaderboard c FROM ledger WHERE child_id=1 AND kind='word_challenge'`);
  ok('单词星算学习星（计入排行、伙伴经验与领养门槛；ADR 0019 修订）', Number(lw.c) === 1, JSON.stringify(lw)); }
const wspot = (cols, vals) => `INSERT INTO hiding_spots (family_id,child_id,spot_no,spot_kind,local_date,${cols}) VALUES (1,1,${vals})`;
await expectOk('单词闯关 ≥80 分中签：放置 1 个有呀哈哈的藏匿点', app, wspot('word_task_id,style_id,daily_seq', `1,'page','2026-10-23',1,1,1`));
await expectErr('CHECK：单词本来源只放有呀哈哈的藏匿点', app, wspot('word_task_id', `1,'page','2026-10-23',2`), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：单词本来源只有 1 号藏匿点', app, wspot('word_task_id,style_id,daily_seq', `2,'page','2026-10-23',2,1,2`), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：藏匿点只能有一个来源', app, wspot('attempt_id,word_task_id,style_id,daily_seq', `1,'page','2026-10-23',1,2,1,2`), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('单词本里程碑：每首次学会 5 个词必得 1 个', app, wspot('word_milestone_no,style_id,daily_seq', `1,'page','2026-10-23',1,1,2`));
await expectErr('UNIQUE：同一里程碑只放置一次', app, wspot('word_milestone_no,style_id,daily_seq', `1,'page','2026-10-23',1,1,3`), [], ['ER_DUP_ENTRY']);
await expectErr('UNIQUE：同一单词任务只放置一次', app, wspot('word_task_id,style_id,daily_seq', `1,'page','2026-10-23',1,1,4`), [], ['ER_DUP_ENTRY']);
await expectOk('单元首次全 3 星级必得 1 个（默认规则，旧系统）', app, wspot('unit_milestone_key,style_id,daily_seq', `1,'leaf','2026-10-23','en-g1-a:u01',1,5`));
await expectErr('UNIQUE：同一单元里程碑只放置一次', app, wspot('unit_milestone_key,style_id,daily_seq', `1,'leaf','2026-10-23','en-g1-a:u01',1,6`), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：单元里程碑只放有呀哈哈的藏匿点', app, wspot('unit_milestone_key', `1,'leaf','2026-10-23','en-g1-a:u02'`), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
{ const [cols] = await root.query(`SELECT column_name c FROM information_schema.columns WHERE table_schema='xingya' AND table_name='yahaha_sets' AND column_name='bonus_stars'`);
  ok('呀哈哈不发奖励星（旧系统）：套组没有奖励星列', cols.length === 0, JSON.stringify(cols)); }
{ const [[st]] = await app.query(`SELECT value v FROM system_settings WHERE setting_key='wordbook.random'`);
  const v = typeof st.v === 'string' ? JSON.parse(st.v) : st.v;
  ok('单词本随机默认：开启、2000 基点、每日 2 个（旧系统）', v.enabled === true && v.probability_bps === 2000 && v.daily_limit === 2, JSON.stringify(v)); }
await expectErr('CHECK：单词本随机概率 0–10000 基点', app, `UPDATE system_settings SET value=CAST('{"enabled":true,"probability_bps":10001,"daily_limit":2}' AS JSON) WHERE setting_key='wordbook.random'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 14) 投放规则边界（AI 只填写表单，数据库兜底）
const rule = (o) => `INSERT INTO drop_rules (name,rule_type,spec,trigger_type,effect,probability_pct,daily_cap,total_quantity,consumed_quantity,starts_at,ends_at,created_by_admin_id) VALUES ('r','${o.t ?? 'campaign'}','${o.spec ?? '{}'}','${o.trig ?? 'level_pass'}','${o.eff ?? 'raise_probability'}',${o.p ?? 50},${o.cap ?? 'NULL'},${o.total ?? 'NULL'},${o.used ?? 0},'2026-11-01',${o.end ?? "'2026-11-08'"},1)`;
await expectOk('合法的限时活动规则（概率 50%）', app, rule({}));
await expectErr('CHECK：概率不得低于 1%', app, rule({ p: 0 }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：概率不得高于 100%', app, rule({ p: 101 }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：每孩子每日上限不得超过 10', app, rule({ cap: 11 }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：限时活动必须有结束时间', app, rule({ end: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：课程设定规则必须绑定课程', app, rule({ t: 'course', trig: 'streak_days', eff: 'guaranteed', p: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const tgt = (t) => `{"scope":{"targets":${JSON.stringify(t)}}}`;
await expectOk('合法的课程设定规则（指向课程：单元首次全 3 星级必得）', app, rule({ t: 'course', trig: 'unit_first_all_three_star', eff: 'guaranteed', p: 'NULL', spec: tgt([{ courseId: 'en-g1-a' }]), end: 'NULL' }));
await expectOk('合法的课程设定规则（指向单元 u03：单元首次全 3 星级必得）', app, rule({ t: 'course', trig: 'unit_first_all_three_star', eff: 'guaranteed', p: 'NULL', spec: tgt([{ courseId: 'en-g1-a', unitKey: 'u03' }]), end: 'NULL' }));
await expectOk('合法的课程设定规则（指向关卡：指定关卡通关提高概率）', app, rule({ t: 'course', trig: 'specific_level_pass', p: 60, spec: tgt([{ courseId: 'en-g1-a', unitKey: 'u03', levelKey: 'l02' }]), end: 'NULL' }));
await expectErr('CHECK：范围中有关卡必须同时有单元', app, rule({ t: 'course', trig: 'level_pass', p: 60, spec: tgt([{ courseId: 'en-g1-a', levelKey: 'l02' }]), end: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：范围目标不允许未知字段', app, rule({ t: 'course', trig: 'level_pass', p: 60, spec: tgt([{ courseId: 'en-g1-a', grade: 1 }]), end: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：课程 ID 格式（范围目标）', app, rule({ t: 'course', trig: 'level_pass', p: 60, spec: tgt([{ courseId: 'EN G1' }]), end: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：单元首次全 3 星级不能指向关卡', app, rule({ t: 'course', trig: 'unit_first_all_three_star', eff: 'guaranteed', p: 'NULL', spec: tgt([{ courseId: 'en-g1-a', unitKey: 'u03', levelKey: 'l01' }]), end: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：指定关卡通关的每个目标都必须是关卡', app, rule({ t: 'course', trig: 'specific_level_pass', p: 60, spec: tgt([{ courseId: 'en-g1-a', unitKey: 'u03', levelKey: 'l01' }, { courseId: 'en-g1-a', unitKey: 'u04' }]), end: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：限定款式必须列出款式', app, rule({ eff: 'restrict_styles', p: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：已消耗数量不得超过总量', app, rule({ total: 5, used: 6 }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 15) 社交
await expectErr('CHECK：好友关系 low<high', app, `INSERT INTO family_friendships (family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (2,1,2,2)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO family_friendships (id,family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (1,1,2,1,1)`);
await expectErr('UNIQUE：同一对家庭只有一条进行中请求', app, `INSERT INTO family_friendships (family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (1,2,2,2)`, [], ['ER_DUP_ENTRY']);
await app.query(`UPDATE family_friendships SET status='declined', decided_by_parent_id=2, decided_at=NOW(3) WHERE id=1`);
await expectOk('拒绝后可重新申请', app, `INSERT INTO family_friendships (id,family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (2,1,2,2,2)`);
await expectErr('CHECK：跨家庭赠送必须关联好友关系', app, `INSERT INTO gifts (from_family_id,from_child_id,to_family_id,to_child_id,amount,sender_date) VALUES (1,1,2,3,5,'2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：不能送给自己', app, `INSERT INTO gifts (from_family_id,from_child_id,to_family_id,to_child_id,amount,sender_date) VALUES (1,1,1,1,5,'2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('家庭内赠送', app, `INSERT INTO gifts (from_family_id,from_child_id,to_family_id,to_child_id,amount,sender_date) VALUES (1,1,1,2,5,'2026-10-21')`);
await expectErr('权限：app 不能 DELETE 赠送记录', app, `DELETE FROM gifts`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DELETE 审计', app, `DELETE FROM audit_events`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('CHECK：跨家庭不能发自由文本', app, `INSERT INTO messages (sender_family_id,sender_child_id,recipient_family_id,recipient_child_id,kind,body) VALUES (1,1,2,3,'text','hi http://x')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('跨家庭预设短语', app, `INSERT INTO messages (id,sender_family_id,sender_child_id,recipient_family_id,recipient_child_id,kind,phrase_key) VALUES (1,1,1,2,3,'phrase','great-job')`);
await expectOk('家庭内自由文本（家长→孩子）', app, `INSERT INTO messages (sender_family_id,sender_parent_id,recipient_family_id,recipient_child_id,kind,body) VALUES (1,1,1,1,'text','今天真棒')`);
await expectOk('家庭内信件：标题 + 500 字以内内容（旧系统）', app, `INSERT INTO messages (sender_family_id,sender_child_id,recipient_family_id,recipient_child_id,kind,subject,body) VALUES (1,1,1,2,'text','周末一起玩','${'好'.repeat(500)}')`);
await expectErr('CHECK：信件内容不超过 500 字', app, `INSERT INTO messages (sender_family_id,sender_child_id,recipient_family_id,recipient_child_id,kind,body) VALUES (1,1,1,2,'text','${'好'.repeat(501)}')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DATA_TOO_LONG']);
await expectErr('CHECK：跨家庭预设短语不能带标题', app, `INSERT INTO messages (sender_family_id,sender_child_id,recipient_family_id,recipient_child_id,kind,phrase_key,subject) VALUES (1,1,2,3,'phrase','great-job','hi')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('信箱系统通知（兑换获批）', app, `INSERT INTO notifications (id,family_id,child_id,kind,title,body) VALUES (1,1,1,'redemption','兑换已批准','玩游戏机 30 分钟已放进累计奖励')`);
await expectErr('CHECK：通知只有一个收件人', app, `INSERT INTO notifications (family_id,child_id,parent_id,kind,title,body) VALUES (1,1,1,'system','x','y')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('标记通知已读', app, `UPDATE notifications SET read_at=NOW(3) WHERE id=1`);
await expectErr('权限：通知内容不可改（列级授权）', app, `UPDATE notifications SET body='x' WHERE id=1`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('复合外键：家长不能以别家身份发消息', app, `INSERT INTO messages (sender_family_id,sender_parent_id,recipient_family_id,recipient_child_id,kind,body) VALUES (2,1,2,3,'text','x')`, [], ['ER_NO_REFERENCED_ROW_2']);
await app.query(`INSERT INTO abuse_reports (reporter_family_id,reporter_child_id,message_id,reason) VALUES (2,3,1,'rude')`);
await expectErr('UNIQUE：同一家庭对同一消息只举报一次', app, `INSERT INTO abuse_reports (reporter_family_id,reporter_parent_id,message_id,reason) VALUES (2,2,1,'spam')`, [], ['ER_DUP_ENTRY']);
await app.query(`INSERT INTO blocks (blocker_family_id,blocked_family_id,blocked_child_id,created_by) VALUES (2,1,1,'parent')`);
await expectErr('UNIQUE：重复屏蔽', app, `INSERT INTO blocks (blocker_family_id,blocked_family_id,blocked_child_id,created_by) VALUES (2,1,1,'parent')`, [], ['ER_DUP_ENTRY']);

// 16) 管控、AI 聊天、幂等表、系统设置
await expectErr('CHECK：允许时段 start<end', app, `INSERT INTO child_controls (child_id,family_id,allowed_start,allowed_end) VALUES (1,1,'21:00','07:00')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('默认管控设置', app, `INSERT INTO child_controls (child_id,family_id) VALUES (1,1)`);
await expectErr('CHECK：加时以 15 分钟为单位', app, `INSERT INTO usage_days (child_id,usage_date,family_id,bonus_minutes) VALUES (1,'2026-10-21',1,10)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO ai_chat_usage (family_id,principal,child_id,client_request_id,local_date,model,input_chars) VALUES (1,'child',1,?,'2026-10-21','m',12)`, [uuid(20)]);
await expectErr('UNIQUE：聊天请求 ID 不可重放', app, `INSERT INTO ai_chat_usage (family_id,principal,child_id,client_request_id,local_date,model,input_chars) VALUES (1,'child',1,?,'2026-10-21','m',12)`, [uuid(20)], ['ER_DUP_ENTRY']);
await expectErr('CHECK：过滤命中必须记类别', app, `INSERT INTO ai_chat_usage (family_id,principal,child_id,client_request_id,local_date,model,status,input_chars) VALUES (1,'child',1,?,'2026-10-21','m','input_blocked',12)`, [uuid(21)], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO idempotency_requests (actor_type,actor_id,client_request_id,operation,request_hash,response_status,response_body) VALUES ('child',1,?,'stars.purchase',UNHEX(SHA2('b',256)),200,'{}')`, [uuid(30)]);
await expectErr('UNIQUE：幂等表同一行为者同一请求 ID', app, `INSERT INTO idempotency_requests (actor_type,actor_id,client_request_id,operation,request_hash,response_status,response_body) VALUES ('child',1,?,'stars.purchase',UNHEX(SHA2('c',256)),200,'{}')`, [uuid(30)], ['ER_DUP_ENTRY']);
await expectErr('CHECK：请求 ID 必须是小写 UUID', app, `INSERT INTO idempotency_requests (actor_type,actor_id,client_request_id,operation,request_hash,response_status,response_body) VALUES ('child',1,'not-a-uuid-not-a-uuid-not-a-uuid-xx','x',UNHEX(SHA2('c',256)),200,'{}')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能新增系统设置键', app, `INSERT INTO system_settings (setting_key,value) VALUES ('ai.enabled','false')`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('app 可切换 AI 总开关', app, `UPDATE system_settings SET value=CAST('false' AS JSON), version=version+1 WHERE setting_key='ai.enabled'`);
await expectErr('CHECK：全局每日上限 1–10', app, `UPDATE system_settings SET value=CAST('11' AS JSON) WHERE setting_key='discovery.daily_cap'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：全局藏匿点概率 1–100', app, `UPDATE system_settings SET value=CAST('0' AS JSON) WHERE setting_key='discovery.spot_probability_pct'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：注册模式设置已删除（永久只用邀请码，用户 2026-10-22）', mig, `INSERT INTO system_settings (setting_key,value) VALUES ('registration.mode','"open"')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：领养门槛 0–1000000', app, `UPDATE system_settings SET value=CAST('-1' AS JSON) WHERE setting_key='companion.unlock_stars'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：扩建价格阶梯最多 10 次', app, `UPDATE system_settings SET value=CAST('[1,2,3,4,5,6,7,8,9,10,11]' AS JSON) WHERE setting_key='companion.den_slot_prices'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：森林口袋收藏上限 1–100000', app, `UPDATE system_settings SET value=CAST('0' AS JSON) WHERE setting_key='discovery.collection_cap'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
{ const [[cc]] = await app.query(`SELECT value v FROM system_settings WHERE setting_key='discovery.collection_cap'`);
  ok('森林口袋收藏上限默认 1000（旧系统）', Number(typeof cc.v === 'string' ? JSON.parse(cc.v) : cc.v) === 1000, JSON.stringify(cc)); }
await expectErr('CHECK：单元关卡数范围 min ≤ max（默认 3–6）', app, `UPDATE system_settings SET value=CAST('{"min":6,"max":3}' AS JSON) WHERE setting_key='content.unit_levels'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：单元关卡数上限不超过 12', app, `UPDATE system_settings SET value=CAST('{"min":3,"max":20}' AS JSON) WHERE setting_key='content.unit_levels'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('app 可把单元关卡数调整为 4–8', app, `UPDATE system_settings SET value=CAST('{"min":4,"max":8}' AS JSON), version=version+1 WHERE setting_key='content.unit_levels'`);
await expectErr('CHECK：系统设置键白名单（migrator 也不能写入未知键）', mig, `INSERT INTO system_settings (setting_key,value) VALUES ('evil.key','1')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('app 可把全局概率改为 25%', app, `UPDATE system_settings SET value=CAST('25' AS JSON), version=version+1 WHERE setting_key='discovery.spot_probability_pct'`);
await expectErr('CHECK：周报去重键', app, `INSERT INTO email_outbox (kind,dedupe_key,to_email,subject,body_html) VALUES ('weekly_report','weekly:1:2026-W43','a@x.com','s','b'),('weekly_report','weekly:1:2026-W43','a@x.com','s','b')`, [], ['ER_DUP_ENTRY']);

// 16b) Skill 与 AI 角色（studio）：版本化技能、技能侧白名单、角色版本与挂载、运行记录、角色预算
{ const [[d]] = await app.query(`SELECT COUNT(*) n, SUM(audience='admin') a, SUM(audience='child') c, SUM(current_version_id IS NULL) unpub FROM agents`);
  const [[v]] = await app.query(`SELECT COUNT(*) n, SUM(status='draft') drafts, SUM(monthly_budget_fen) budget FROM agent_versions`);
  ok('默认 7 个角色（6 管理端 + 呀哈哈队长）由迁移写入，v1 为草稿、未发布，角色预算合计 = 全站默认 ¥200',
     Number(d.n) === 7 && Number(d.a) === 6 && Number(d.c) === 1 && Number(d.unpub) === 7 && Number(v.drafts) === 7 && Number(v.budget) === 20000, JSON.stringify({ d, v })); }
await expectErr('CHECK：系统技能 child-safety 不能停用', app, `UPDATE skills SET status='disabled' WHERE skill_key='child-safety'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const sv = (id, skillId, aud, no, out = '{"type":"object","properties":{"draftId":{"type":"integer"}}}') =>
  `INSERT INTO skill_versions (id,skill_id,audience,version_no,name,when_to_use,instructions,input_schema,output_schema,allowed_tools,source,content_sha256,created_by_admin_id) VALUES (${id},${skillId},'${aud}',${no},'n','w','steps','{"type":"object"}','${out}','["course.write_draft"]','editor',UNHEX(SHA2('${id}',256)),1)`;
await expectOk('新建技能与 v1 草稿（管理端、儿童端各一个）', app, `INSERT INTO skills (id,skill_key,audience,created_by_admin_id) VALUES (101,'course-generate','admin',1),(102,'english-practice','child',1);
  ${sv(1001, 101, 'admin', 1)}; ${sv(1002, 102, 'child', 1, '{"type":"object","properties":{"reply":{"type":"string","maxLength":300}}}')}`);
await expectErr('CHECK：输出模式必须是 object（结果要能校验）', app, sv(1003, 101, 'admin', 2, '{"type":"string"}'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：技能版本的受众必须与技能一致', app, sv(1003, 101, 'child', 2), [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('UNIQUE：同一技能版本号不重复', app, sv(1003, 101, 'admin', 1), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：发布技能版本必须有审核人', app, `UPDATE skill_versions SET status='published', published_at=NOW(3) WHERE id=1001`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('审核后发布管理端技能并设为当前版本', app, `UPDATE skill_versions SET status='published', published_at=NOW(3), reviewed_by_admin_id=1, reviewed_at=NOW(3) WHERE id=1001; UPDATE skills SET current_version_id=1001 WHERE id=101`);
await expectErr('CHECK：儿童端技能发布必须另做儿童安全审核', app, `UPDATE skill_versions SET status='published', published_at=NOW(3), reviewed_by_admin_id=1, reviewed_at=NOW(3) WHERE id=1002`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('儿童安全审核后发布儿童端技能', app, `UPDATE skill_versions SET status='published', published_at=NOW(3), reviewed_by_admin_id=1, reviewed_at=NOW(3), safety_reviewed_by_admin_id=1, safety_reviewed_at=NOW(3) WHERE id=1002`);
await expectErr('权限：已保存的技能版本内容不可改（编辑 = 新版本）', app, `UPDATE skill_versions SET instructions='改过的提示词' WHERE id=1001`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：技能受众不可改', app, `UPDATE skills SET audience='admin' WHERE id=102`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：技能不能物理删除', app, `DELETE FROM skills WHERE id=101`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('复合外键：技能当前版本必须属于本技能', app, `UPDATE skills SET current_version_id=1002 WHERE id=101`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectOk('技能侧白名单：允许课程设计师、呀哈哈队长', app, `INSERT INTO skill_allowed_agents (skill_id,agent_id,audience,added_by_admin_id) VALUES (101,1,'admin',1),(102,7,'child',1)`);
await expectErr('复合外键：儿童端技能不能进管理端角色的白名单（受众一致）', app, `INSERT INTO skill_allowed_agents (skill_id,agent_id,audience,added_by_admin_id) VALUES (102,1,'child',1)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('权限：白名单只能撤销不能删除', app, `DELETE FROM skill_allowed_agents WHERE skill_id=101`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('新的角色版本（课程设计师 v2）并挂载技能（固定 v1、覆盖参数、优先级 1）', app, `INSERT INTO agent_versions (id,agent_id,audience,version_no,name,description,allowed_tools,monthly_budget_fen,based_on_version_id,created_by_admin_id) VALUES (101,1,'admin',2,'课程设计师','d','["course.write_draft"]',6000,1,1);
  INSERT INTO agent_skills (agent_version_id,agent_id,skill_id,pinned_skill_version_id,priority,overrides) VALUES (101,1,101,1001,1,'{"levels":3}')`);
await expectErr('复合外键：挂载的技能必须在技能侧白名单中', app, `INSERT INTO agent_skills (agent_version_id,agent_id,skill_id,priority) VALUES (101,1,1,2)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('复合外键：固定的版本必须属于该技能', app, `INSERT INTO agent_skills (agent_version_id,agent_id,skill_id,pinned_skill_version_id,priority) VALUES (7,7,102,1001,1)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectOk('呀哈哈队长 v1 挂载英语陪练（跟随最新发布）', app, `INSERT INTO agent_skills (agent_version_id,agent_id,skill_id,priority) VALUES (7,7,102,2)`);
await expectErr('UNIQUE：同一角色版本内优先级不重复', app, `INSERT INTO skill_allowed_agents (skill_id,agent_id,audience) VALUES (1,7,'child'); INSERT INTO agent_skills (agent_version_id,agent_id,skill_id,priority) VALUES (7,7,1,2)`, [], ['ER_DUP_ENTRY']);
await expectErr('权限：已保存角色版本的技能挂载不可改（改 = 新版本）', app, `UPDATE agent_skills SET priority=3 WHERE agent_version_id=101`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('CHECK：发布角色版本必须有审核人', app, `UPDATE agent_versions SET status='published', published_at=NOW(3) WHERE id=101`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('审核发布课程设计师 v2 并切为当前版本', app, `UPDATE agent_versions SET status='published', published_at=NOW(3), reviewed_by_admin_id=1, reviewed_at=NOW(3) WHERE id=101; UPDATE agents SET current_version_id=101, version=version+1 WHERE id=1`);
await expectErr('CHECK：儿童角色发布必须另做儿童安全审核', app, `UPDATE agent_versions SET status='published', published_at=NOW(3), reviewed_by_admin_id=1, reviewed_at=NOW(3) WHERE id=7`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：角色当前版本必须属于本角色', app, `UPDATE agents SET current_version_id=7 WHERE id=1`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('权限：角色受众不可改', app, `UPDATE agents SET audience='child' WHERE id=1`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('角色月度预算（在全站预算月份之内）', app, `INSERT INTO agent_budget_months (agent_id,budget_month,cap_fen,reserved_fen) VALUES (1,'2026-10',6000,5000)`);
await expectErr('CHECK：角色预留 + 已花费不得超过角色月度预算', app, `UPDATE agent_budget_months SET reserved_fen=reserved_fen+2000 WHERE agent_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('外键：角色预算月份必须已有全站预算', app, `INSERT INTO agent_budget_months (agent_id,budget_month,cap_fen) VALUES (1,'2026-12',100)`, [], ['ER_NO_REFERENCED_ROW_2']);
const run = (id, extra) => `INSERT INTO agent_runs (id,kind,agent_id,agent_version_id,instruction,input,budget_month,created_by_admin_id${extra ? ',' + extra[0] : ''}) VALUES (${id},'task',1,101,'给三单元生成单词闯关课','{}','2026-10',1${extra ? ',' + extra[1] : ''})`;
await expectOk('单角色任务运行记录（课程设计师）', app, run(1));
await expectErr('复合外键：运行记录只能用管理端角色（孩子对话不进入运行记录）', app, `INSERT INTO agent_runs (kind,agent_id,agent_version_id,instruction,input,budget_month,created_by_admin_id) VALUES ('task',7,7,'x','{}','2026-10',1)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：工具循环最多 20 步', app, run(2, ['step_count', 21]), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：运行实际费用不得超过预估', app, run(2, ['estimated_cost_fen,actual_cost_fen', '10,11']), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：流水线最多 6 步', app, `INSERT INTO agent_runs (kind,plan,instruction,input,budget_month,created_by_admin_id) VALUES ('pipeline','[1,2,3,4,5,6,7]','x','{}','2026-10',1)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('多角色流水线 + 第 1 步', app, `INSERT INTO agent_runs (id,kind,plan,instruction,input,budget_month,created_by_admin_id,status) VALUES (10,'pipeline','[{"agentKey":"course-designer"},{"agentKey":"art-designer"},{"agentKey":"voice-artist"},{"agentKey":"qa-reviewer"}]','三单元完整课程','{}','2026-10',1,'waiting');
  INSERT INTO agent_runs (id,kind,agent_id,agent_version_id,parent_run_id,step_no,instruction,input,budget_month,created_by_admin_id) VALUES (11,'pipeline_step',1,101,10,1,'x','{}','2026-10',1)`);
await expectErr('UNIQUE：流水线同一步只有一条运行', app, `INSERT INTO agent_runs (kind,agent_id,agent_version_id,parent_run_id,step_no,instruction,input,budget_month,created_by_admin_id) VALUES ('pipeline_step',1,101,10,1,'x','{}','2026-10',1)`, [], ['ER_DUP_ENTRY']);
await expectOk('克隆历史任务重跑', app, run(3, ['cloned_from_run_id', 1]));
await expectOk('运行步骤记录', app, `INSERT INTO agent_run_steps (run_id,step_no,kind,model,status,latency_ms,cost_fen) VALUES (1,1,'route','m','ok',300,1); INSERT INTO agent_run_steps (run_id,step_no,kind,tool_name,status,latency_ms) VALUES (1,2,'tool','course.write_draft','ok',80)`);
await expectErr('CHECK：步骤号不超过 20', app, `INSERT INTO agent_run_steps (run_id,step_no,kind,model,status,latency_ms) VALUES (1,21,'llm','m','ok',1)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：工具步骤必须记录工具名', app, `INSERT INTO agent_run_steps (run_id,step_no,kind,status,latency_ms) VALUES (1,3,'tool','ok',1)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：运行步骤不可改', app, `UPDATE agent_run_steps SET status='error' WHERE run_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('技能试运行（样例输入）', app, `INSERT INTO agent_runs (kind,skill_version_id,instruction,input,budget_month,created_by_admin_id) VALUES ('test',1002,'试运行','{"text":"hello"}','2026-10',1)`);
await expectOk('快捷任务：单角色与流水线', app, `INSERT INTO quick_tasks (name,page,target,agent_id,instruction,created_by_admin_id) VALUES ('重写难题','courses','agent',1,'把这一题改简单',1);
  INSERT INTO quick_tasks (name,page,target,plan,instruction,created_by_admin_id) VALUES ('整课流水线','courses','pipeline','[{"agentKey":"course-designer"},{"agentKey":"qa-reviewer"}]','x',1)`);
await expectErr('复合外键：快捷任务不能指向儿童角色', app, `INSERT INTO quick_tasks (name,page,target,agent_id,instruction,created_by_admin_id) VALUES ('聊天','courses','agent',7,'x',1)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：快捷流水线至少 2 步', app, `INSERT INTO quick_tasks (name,page,target,plan,instruction,created_by_admin_id) VALUES ('单步','courses','pipeline','[{"agentKey":"qa-reviewer"}]','x',1)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('聊天元数据记录儿童角色版本与费用', app, `INSERT INTO ai_chat_usage (family_id,principal,child_id,client_request_id,local_date,model,input_chars,agent_version_id,cost_fen) VALUES (1,'child',1,?,'2026-10-21','m',10,7,1)`, [uuid(40)]);
await expectErr('复合外键：聊天只能使用儿童角色版本', app, `INSERT INTO ai_chat_usage (family_id,principal,child_id,client_request_id,local_date,model,input_chars,agent_version_id) VALUES (1,'child',1,?,'2026-10-21','m',10,101)`, [uuid(41)], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：工具循环上限设置不超过 20 步', app, `UPDATE system_settings SET value=JSON_SET(value,'$.max_steps',21) WHERE setting_key='agents.limits'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：运营分析最小分组 3–50', app, `UPDATE system_settings SET value=CAST('1' AS JSON) WHERE setting_key='agents.stats_min_group'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 17) 角色可重复执行（第二次应用已覆盖），账号锁定状态
const [[lk]] = await root.query(`SELECT COUNT(*) n FROM mysql.user WHERE user IN ('xingya_app_role','xingya_migrator_role') AND account_locked='Y'`);
ok('角色本身为锁定账号（不可登录）', lk.n === 2);

await app.end(); await mig.end();
// 清理：删库、删账号与角色
await root.query(`DROP DATABASE xingya; DROP USER IF EXISTS 'xingya_app'@'localhost','xingya_migrator'@'localhost'; DROP ROLE IF EXISTS 'xingya_app_role','xingya_migrator_role'`);
await root.end();
const failed = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? '  — ' + r.extra : ''}`);
console.log(`\n结构统计: ${JSON.stringify(c2)}\n合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
process.exit(failed.length ? 1 : 0);
