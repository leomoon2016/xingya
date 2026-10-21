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
ok('表数=65', c2.tables === 65, JSON.stringify(c2));
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

// 3) migrator：DDL；管理员账号（课程与工作室数据需要）
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

// 6) 词库与课程：草稿 → 发布（插入不可变版本行）
await expectOk('词库：词与义项', app, `INSERT INTO words (id,subject,text,audio_asset_id,status) VALUES ('en.apple','english','apple',2,'active'),('en.pear','english','pear',NULL,'active'),('en.bat','english','bat',NULL,'active');
  INSERT INTO word_senses (id,word_id,meaning_zh,image_asset_id,status) VALUES ('en.apple.fruit','en.apple','苹果',1,'active'),('en.pear.fruit','en.pear','梨',NULL,'active'),('en.bat.animal','en.bat','蝙蝠',NULL,'active')`);
await expectErr('CHECK：词 ID 格式', app, `INSERT INTO words (id,subject,text) VALUES ('Apple','english','Apple2')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：义项 ID 必须以所属词 ID 为前缀', app, `INSERT INTO word_senses (id,word_id,meaning_zh) VALUES ('en.pear.x','en.apple','错')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：同学科同拼写只有一个词', app, `INSERT INTO words (id,subject,text) VALUES ('en.apple-2','english','apple')`, [], ['ER_DUP_ENTRY']);
await expectErr('权限：app 不能改义项释义（列级授权）', app, `UPDATE word_senses SET meaning_zh='香蕉' WHERE id='en.apple.fruit'`, [], ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR']);
await expectOk('app 可更新义项图片', app, `UPDATE word_senses SET image_asset_id=1 WHERE id='en.pear.fruit'`);
await expectOk('建课程与草稿', app, `INSERT INTO courses (id,subject,grade,sort_order,template_id,created_by_admin_id) VALUES ('en-g1-u01','english',1,101,'word-quest',1),('en-g1-u02','english',1,102,'word-quest',1);
  INSERT INTO course_drafts (id,course_id,template_id,template_version,document,created_by_admin_id) VALUES (1,'en-g1-u01','word-quest',1,'{}',1)`);
await expectErr('UNIQUE：每门课同时只有一份未完成草稿', app, `INSERT INTO course_drafts (course_id,template_id,template_version,document,created_by_admin_id) VALUES ('en-g1-u01','word-quest',1,'{}',1)`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：未通过自动检查不能提交审核', app, `UPDATE course_drafts SET status='in_review', submitted_at=NOW(3) WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：发布前必须有审核人', app, `UPDATE course_drafts SET check_passed=1, status='publishing', submitted_at=NOW(3) WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('发布：插入版本、关卡、题目（可见部分）与答案', app, `UPDATE course_drafts SET check_passed=1, status='publishing', submitted_at=NOW(3), reviewed_by_admin_id=1 WHERE id=1;
  INSERT INTO course_versions (id,course_id,version_no,draft_id,template_id,template_version,title,published_by_admin_id) VALUES (1,'en-g1-u01',1,1,'word-quest',1,'Unit 1 Fruits',1);
  INSERT INTO levels (id,course_version_id,level_key,seq,title,hiding_spots) VALUES (1,1,'l01',1,'认识水果','[{"kind":"leaf","x":0.2,"y":0.6},{"kind":"rock","x":0.5,"y":0.8},{"kind":"cloud","x":0.8,"y":0.2}]');
  INSERT INTO questions (id,level_id,question_key,seq,type,scored,sense_id,visible) VALUES
    (1,1,'q1',1,'pick_image',1,'en.apple.fruit','{"imageAssetId":1,"options":[{"id":"o1","senseId":"en.apple.fruit"},{"id":"o2","senseId":"en.pear.fruit"}]}'),
    (2,1,'q2',2,'read_aloud',0,'en.apple.fruit','{"text":"I like apples."}');
  INSERT INTO question_answers (question_id,answer,explanation) VALUES (1,'{"optionId":"o1"}','apple 是苹果');
  UPDATE courses SET current_version_id=1, version=version+1 WHERE id='en-g1-u01';
  UPDATE course_drafts SET status='published', published_version_id=1 WHERE id=1`);
await expectErr('CHECK：每关必须定义 3 个藏匿点', app, `INSERT INTO levels (course_version_id,level_key,seq,title,hiding_spots) VALUES (1,'l02',2,'x','[]')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：课程的当前版本必须属于本课程', app, `UPDATE courses SET current_version_id=1 WHERE id='en-g1-u02'`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：题目可见部分不得含答案字段', app, `INSERT INTO questions (level_id,question_key,seq,type,scored,visible) VALUES (1,'q3',3,'listen_choose',1,'{"options":[],"answer":"o1"}')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：read_aloud 不能计分', app, `INSERT INTO questions (level_id,question_key,seq,type,scored,visible) VALUES (1,'q4',4,'read_aloud',1,'{}')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const [qcols] = await root.query(`SELECT column_name c FROM information_schema.columns WHERE table_schema='xingya' AND table_name='questions'`);
ok('题目表不含答案/解析列（答案在 question_answers）', !qcols.some(r => /answer|explanation|accept/i.test(r.c)), qcols.map(r => r.c).join(','));
await expectErr('不可变：app 不能修改已发布题目', app, `UPDATE questions SET visible='{}' WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('不可变：app 不能修改已发布答案', app, `UPDATE question_answers SET answer='{"optionId":"o2"}' WHERE question_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('不可变：app 不能修改已发布关卡', app, `UPDATE levels SET title='x' WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('不可变：app 不能删除已发布版本', app, `DELETE FROM course_versions WHERE id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('UNIQUE：同一草稿只能发布一次', app, `INSERT INTO course_versions (course_id,version_no,draft_id,template_id,template_version,title,published_by_admin_id) VALUES ('en-g1-u01',2,1,'word-quest',1,'x',1)`, [], ['ER_DUP_ENTRY']);

// 7) 作答与闯关记录：生成列与幂等
await expectOk('开始作答（play）', app, `INSERT INTO plays (id,family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items,expires_at) VALUES (1,1,1,'level',1,1,?,'2026-10-21','[]',NOW()+INTERVAL 2 HOUR),(2,1,1,'level',1,1,?,'2026-10-21','[]',NOW()+INTERVAL 2 HOUR),(3,1,1,'level',1,1,?,'2026-10-21','[]',NOW()+INTERVAL 2 HOUR),(4,1,1,'level',1,1,?,'2026-10-21','[]',NOW()+INTERVAL 2 HOUR)`, [uuid(1), uuid(2), uuid(3), uuid(4)]);
await expectErr('UNIQUE：同一请求 ID 只开始一次作答', app, `INSERT INTO plays (family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items,expires_at) VALUES (1,1,'level',1,1,?,'2026-10-21','[]',NOW()+INTERVAL 2 HOUR)`, [uuid(1)], ['ER_DUP_ENTRY']);
await expectErr('复合外键：作答的关卡必须属于所记录的版本', app, `INSERT INTO plays (family_id,child_id,kind,course_version_id,level_id,client_request_id,local_date,items,expires_at) VALUES (1,1,'level',99,1,?,'2026-10-21','[]',NOW()+INTERVAL 2 HOUR)`, [uuid(9)], ['ER_NO_REFERENCED_ROW_2']);
const att = (play, s, c, aw) => `INSERT INTO attempts (id,family_id,child_id,play_id,course_version_id,level_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (${play},1,1,${play},1,1,'2026-10-21',${s},${c},${aw},'[]')`;
await expectOk('提交闯关 4/5', app, att(1, 5, 4, 1));
const [[a1]] = await app.query(`SELECT accuracy_pct,stars,passed FROM attempts WHERE id=1`);
ok('生成列：4/5 => 80%、1 星、通过', a1.accuracy_pct === 80 && a1.stars === 1 && a1.passed === 1, JSON.stringify(a1));
await app.query(`${att(2, 8, 7, 0)}; ${att(3, 4, 3, 0)}; ${att(4, 5, 5, 2)}`);
const [rows] = await app.query(`SELECT accuracy_pct, stars, passed FROM attempts ORDER BY id`);
ok('生成列：7/8=87%→1 星；3/4=75%→未通过；5/5→3 星', rows[1].stars === 1 && rows[2].passed === 0 && rows[2].stars === 0 && rows[3].stars === 3, JSON.stringify(rows.map(r => [r.accuracy_pct, r.stars, r.passed])));
await expectErr('幂等：同一次作答只产生一条闯关记录', app, `INSERT INTO attempts (family_id,child_id,play_id,course_version_id,level_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,1,1,1,'2026-10-21',5,4,1,'[]')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：每关计分题至少 4 道', app, `INSERT INTO attempts (family_id,child_id,play_id,course_version_id,level_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,2,1,1,'2026-10-21',3,3,0,'[]')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DUP_ENTRY']);
await expectErr('CHECK：通关进度星数与首次通过时间一致', app, `INSERT INTO level_progress (family_id,child_id,course_id,level_key,best_stars,last_attempt_at) VALUES (1,1,'en-g1-u01','l01',2,NOW())`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能 UPDATE 闯关记录', app, `UPDATE attempts SET correct_count=5`, [], ['ER_TABLEACCESS_DENIED_ERROR']);

// 8) 复习（绑定义项）
await expectOk('复习条目（义项）', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,due_date) VALUES (1,1,'sense','en.apple.fruit','2026-10-22')`);
await expectErr('UNIQUE：同一孩子同一义项只有一条复习条目', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,due_date) VALUES (1,1,'sense','en.apple.fruit','2026-10-23')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：复习盒 1..6', app, `UPDATE review_items SET box=7 WHERE child_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：义项条目不能带题目 ID', app, `INSERT INTO review_items (family_id,child_id,item_type,sense_id,question_id,due_date) VALUES (1,1,'sense','en.pear.fruit',1,'2026-10-22')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO plays (id,family_id,child_id,kind,client_request_id,local_date,items,expires_at) VALUES (10,1,1,'review',?,'2026-10-22','[]',NOW()+INTERVAL 2 HOUR),(11,1,1,'review',?,'2026-10-22','[]',NOW()+INTERVAL 2 HOUR),(12,1,1,'review',?,'2026-10-22','[]',NOW()+INTERVAL 2 HOUR)`, [uuid(10), uuid(11), uuid(12)]);
await app.query(`INSERT INTO review_sessions (family_id,child_id,play_id,review_date,item_count,correct_count,completes_day,results) VALUES (1,1,10,'2026-10-22',10,9,0,'[]'),(1,1,11,'2026-10-22',10,10,1,'[]')`);
await expectErr('UNIQUE：每天最多一次“今日复习完成”', app, `INSERT INTO review_sessions (family_id,child_id,play_id,review_date,item_count,correct_count,completes_day,results) VALUES (1,1,12,'2026-10-22',1,1,1,'[]')`, [], ['ER_DUP_ENTRY']);

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
await expectOk('碎片：通关 +3、复习 +2', app, `${led('fragment', 'level_pass', 3, 3, 'frag:level:en-g1-u01:l01:2026-10-21')}; ${led('fragment', 'review_day', 2, 5, 'review:2026-10-21')}`);
await expectOk('同一 source_key 在不同币种下各记一次', app, led('star', 'review_day', 2, 43, 'review:2026-10-21'));
await expectErr('幂等：碎片同一 source_key 只入账一次', app, led('fragment', 'review_day', 2, 7, 'review:2026-10-21'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：碎片不能用于购买装扮（币种与类型匹配）', app, led('fragment', 'purchase', -1, 4, 'purchase:hat-x'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：碎片不能由家长奖励（无被动或人工来源）', app, led('fragment', 'parent_award', 5, 10, 'award:f', '1'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：每个呀哈哈只给 1 片碎片', app, led('fragment', 'discovery', 2, 7, 'discovery:spot:9'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：复习完成碎片固定 2 片', app, led('fragment', 'review_day', 3, 8, 'review:2026-10-20'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：碎片余额不可为负', app, led('fragment', 'pet_adopt', -40, -35, 'pet:adopt:1'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('权限：app 不能 UPDATE 碎片流水', app, `UPDATE ledger SET delta=3 WHERE currency='fragment'`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DELETE 碎片流水', app, `DELETE FROM ledger WHERE currency='fragment'`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
const [[fsum]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND currency='fragment'`);
ok('碎片余额 = SUM(delta) = 5（与星星分开计算）', Number(fsum.s) === 5);
const [[ls]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND counts_for_leaderboard=1`);
ok('“学习星”只统计星星的 level_pass/review_day/streak', Number(ls.s) === 3, String(ls.s));

// 11) 商店、现实奖励
await app.query(`INSERT INTO shop_items (id,slot,name,price,image_asset_id,sort_order,status) VALUES ('hat-leaf','head','叶子帽',30,1,1,'listed'),('hat-star','head','星星帽',40,1,2,'listed')`);
await expectErr('权限：app 不能 DROP 表', app, `DROP TABLE ledger`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能建账号', app, `CREATE USER 'evil'@'%' IDENTIFIED BY 'x'`, [], ['ER_SPECIFIC_ACCESS_DENIED_ERROR']);
await expectErr('CHECK：余额缓存不可为负', app, `UPDATE balances SET balance=-1 WHERE child_id=1 AND currency='star'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('购买并持有物品', app, `${led('star', 'purchase', -30, 13, 'purchase:hat-leaf')};
  INSERT INTO child_items (family_id,child_id,item_id,slot,equipped,purchase_ledger_id) VALUES (1,1,'hat-leaf','head',1,LAST_INSERT_ID())`);
await expectErr('UNIQUE：同一物品只能买一次', app, `INSERT INTO child_items (family_id,child_id,item_id,slot,purchase_ledger_id) SELECT 1,1,'hat-leaf','head',MAX(id) FROM ledger`, [], ['ER_DUP_ENTRY']);
await app.query(`INSERT INTO child_items (family_id,child_id,item_id,slot,equipped,purchase_ledger_id) SELECT 1,1,'hat-star','head',0,MAX(id) FROM ledger`);
await expectErr('UNIQUE：同一槽位只能穿戴一件', app, `UPDATE child_items SET equipped=1 WHERE item_id='hat-star'`, [], ['ER_DUP_ENTRY']);
const [[ss]] = await app.query(`SELECT SUM(delta) s FROM ledger WHERE child_id=1 AND currency='star'`);
ok('星星余额 = SUM(delta) = 最后一行 balance_after', Number(ss.s) === 13, String(ss.s));
await app.query(`INSERT INTO reward_options (id,family_id,title,star_price,created_by_parent_id) VALUES (1,1,'周末看电影',10,1),(2,2,'吃冰淇淋',5,2)`);
await expectErr('复合外键：只能兑换本家庭的奖励', app, `INSERT INTO redemptions (family_id,child_id,reward_option_id,title_snapshot,price) VALUES (1,1,2,'吃冰淇淋',5)`, [], ['ER_NO_REFERENCED_ROW_2']);
await app.query(`INSERT INTO redemptions (id,family_id,child_id,reward_option_id,title_snapshot,price) VALUES (1,1,1,1,'周末看电影',10)`);
await expectErr('CHECK：批准必须记录家长与时间', app, `UPDATE redemptions SET status='approved' WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 12) 学习伙伴
await expectErr('CHECK：档位星价 1–5000', app, `INSERT INTO pet_tiers (name,sort_order,star_price,fragment_price) VALUES ('免费',0,0,10)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
{ const [[t]] = await app.query(`SELECT (SELECT COUNT(*) FROM pet_tiers) tiers, (SELECT COUNT(*) FROM pet_tier_stages) stages, (SELECT star_price FROM pet_tiers WHERE id=1) p1`);
  ok('默认档位 4 个、成长阶段 16 个由迁移写入（初级 20 星）', Number(t.tiers) === 4 && Number(t.stages) === 16 && Number(t.p1) === 20, JSON.stringify(t)); }
await expectErr('CHECK：第 1 阶段从 1 级开始', app, `UPDATE pet_tier_stages SET min_level=3 WHERE tier_id=1 AND stage_no=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：上架的伙伴必须经过审核', app, `INSERT INTO pet_species (species_key,name,description,tier_id,status,design,created_by_admin_id,published_at) VALUES ('leafy','叶叶','x',1,'published','{}',1,NOW(3))`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO pet_species (id,species_key,name,description,tier_id,status,design,created_by_admin_id,reviewed_by_admin_id,published_at) VALUES (1,'leafy','叶叶','原创小叶精灵',1,'published','{}',1,1,NOW(3)),(2,'pebble','石石','原创小石头',1,'published','{}',1,1,NOW(3))`);
await expectOk('用碎片领养伙伴（第一只自动成为学习陪伴）', app, `${led('fragment', 'pet_adopt', -5, 0, 'pet:adopt:leafy')};
  INSERT INTO child_pets (family_id,child_id,species_id,is_companion,adopted_with,price_paid,adopt_ledger_id) VALUES (1,1,1,1,'fragment',5,LAST_INSERT_ID())`);
await expectOk('用星星领养第二只', app, `${led('star', 'pet_adopt', -10, 3, 'pet:adopt:pebble')};
  INSERT INTO child_pets (family_id,child_id,species_id,is_companion,adopted_with,price_paid,adopt_ledger_id) VALUES (1,1,2,0,'star',10,LAST_INSERT_ID())`);
await expectErr('UNIQUE：每个孩子只有一只学习陪伴', app, `UPDATE child_pets SET is_companion=1 WHERE species_id=2`, [], ['ER_DUP_ENTRY']);
await expectErr('UNIQUE：同种伙伴每人一只', app, `INSERT INTO child_pets (family_id,child_id,species_id,adopted_with,price_paid,adopt_ledger_id) SELECT 1,1,1,'star',10,MAX(id) FROM ledger`, [], ['ER_DUP_ENTRY']);
await expectErr('权限：app 不能物理删除伙伴', app, `DELETE FROM child_pets WHERE child_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('CHECK：营地扩建最多 10 格', app, `INSERT INTO pet_dens (child_id,family_id,extra_slots) VALUES (1,1,11)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 13) 呀哈哈发现：藏匿点由服务端在通关时决定，只能揭晓一次
await app.query(`INSERT INTO yahaha_sets (id,name,sort_order,status) VALUES (1,'森林',1,'listed');
  INSERT INTO yahaha_styles (id,style_key,name,set_id,rarity,total_stock,status,design,created_by_admin_id,reviewed_by_admin_id,published_at) VALUES (1,'leaf-hat','叶帽呀哈哈',1,'common',NULL,'published','{}',1,1,NOW(3)),(2,'gold-leaf','金叶呀哈哈',1,'legendary',2,'published','{}',1,1,NOW(3))`);
await expectErr('CHECK：放置数量不得超过全站库存', app, `UPDATE yahaha_styles SET placed_total=3 WHERE id=2`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
const spot = (att, no, style, seq, date = '2026-10-21') => `INSERT INTO hiding_spots (family_id,child_id,attempt_id,spot_no,spot_kind,local_date,style_id,daily_seq) VALUES (1,1,${att},${no},'leaf','${date}',${style},${seq})`;
await expectOk('通关打开 3 个藏匿点（1 个有呀哈哈）', app, `${spot(1, 1, 1, 1)}; ${spot(1, 2, 'NULL', 'NULL')}; ${spot(1, 3, 'NULL', 'NULL')}`);
await expectErr('UNIQUE：同一次通关同一藏匿点只记一次', app, spot(1, 1, 'NULL', 'NULL'), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：每次通关最多 3 个藏匿点', app, spot(1, 4, 'NULL', 'NULL'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：当天放置序号不可重复（并发放置不会超额）', app, spot(2, 1, 1, 1), [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：每孩子每天放置上限不超过 10', app, spot(2, 1, 1, 11), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：有呀哈哈的藏匿点必须占用当天序号', app, spot(2, 1, 1, 'NULL'), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
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

// 14) 投放规则边界（AI 只填写表单，数据库兜底）
const rule = (o) => `INSERT INTO drop_rules (name,rule_type,spec,trigger_type,effect,probability_pct,daily_cap,total_quantity,consumed_quantity,starts_at,ends_at,created_by_admin_id) VALUES ('r','${o.t ?? 'campaign'}','${o.spec ?? '{}'}','${o.trig ?? 'level_pass'}','${o.eff ?? 'raise_probability'}',${o.p ?? 50},${o.cap ?? 'NULL'},${o.total ?? 'NULL'},${o.used ?? 0},'2026-11-01',${o.end ?? "'2026-11-08'"},1)`;
await expectOk('合法的限时活动规则（概率 50%）', app, rule({}));
await expectErr('CHECK：概率不得低于 1%', app, rule({ p: 0 }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：概率不得高于 100%', app, rule({ p: 101 }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：每孩子每日上限不得超过 10', app, rule({ cap: 11 }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：限时活动必须有结束时间', app, rule({ end: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：课程设定规则必须绑定课程', app, rule({ t: 'course', trig: 'streak_days', eff: 'guaranteed', p: 'NULL' }), [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('合法的课程设定规则（单元首次全三星必得）', app, rule({ t: 'course', trig: 'unit_first_all_three_star', eff: 'guaranteed', p: 'NULL', spec: '{"scope":{"courseIds":["en-g1-u01"]}}', end: 'NULL' }));
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
await expectErr('CHECK：作答有效期 30–720 分钟', app, `UPDATE system_settings SET value=CAST('5' AS JSON) WHERE setting_key='learning.play_ttl_minutes'`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
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
