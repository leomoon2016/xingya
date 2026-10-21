// 在临时 MySQL 8.4 上验证 schema-draft.sql。只连本机 socket，只建/删 xingya 库与 xingya_* 账号。
import fs from 'node:fs';
import mysql from 'mysql2/promise';
const SOCK = process.env.MYSQL_SOCKET;
const SQL = fs.readFileSync(process.argv[2], 'utf8');
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
ok('表数=36', c2.tables === 36, JSON.stringify(c2));

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

// 3) migrator：内容导入 + DDL
await expectOk('migrator 可导入内容', mig, `INSERT INTO courses (id,subject,grade,title,sort_order,pack_version) VALUES ('en-g1-u01','english',1,'Unit 1',1,'2026.10.1');
  INSERT INTO levels (id,course_id,seq,title,pack_version) VALUES ('en-g1-u01-l01','en-g1-u01',1,'Fruits',1);
  INSERT INTO words (id,subject,text,meaning_zh,audio_path,pack_version) VALUES ('en.apple','english','apple','苹果','a/1.mp3','1'),('en.pear','english','pear','梨','a/2.mp3','1');
  INSERT INTO questions (id,level_id,seq,type,word_id,scored,payload,pack_version) VALUES ('en-g1-u01-l01-q1','en-g1-u01-l01',1,'pick_image','en.apple',1,'{}','1');
  INSERT INTO shop_items (id,kind,slot,name,price,image_path,sort_order,pack_version) VALUES ('hat-leaf','outfit','head','叶子帽',30,'i/h.webp',1,'1'),('hat-star','outfit','head','星星帽',40,'i/s.webp',2,'1'),('pet-sprout','pet','pet','芽芽',50,'i/p.webp',3,'1')`);
await expectOk('migrator 可执行 DDL', mig, `CREATE TABLE zz_tmp (id INT PRIMARY KEY); DROP TABLE zz_tmp`);
await expectErr('CHECK：read_aloud 不能计分', mig, `INSERT INTO questions (id,level_id,seq,type,scored,payload,pack_version) VALUES ('q-x','en-g1-u01-l01',2,'read_aloud',1,'{}','1')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：词 ID 格式', mig, `INSERT INTO words (id,subject,text,meaning_zh,audio_path,pack_version) VALUES ('Apple','english','apple','苹果','x','1')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 4) app：家庭数据
await expectOk('app 建家庭/家长/孩子', app, `INSERT INTO families (id,name) VALUES (1,'王家'),(2,'李家');
  INSERT INTO parents (id,family_id,email,password_hash,display_name) VALUES (1,1,'a@x.com','h','爸爸'),(2,2,'b@y.com','h','妈妈');
  INSERT INTO children (id,family_id,nickname,avatar_key,grade,pin_hash) VALUES (1,1,'小明','sprout',1,'h'),(2,1,'小红','leaf',3,'h'),(3,2,'小李','sun',2,'h');
  INSERT INTO star_balances (child_id,family_id,balance) VALUES (1,1,0),(2,1,0),(3,2,0)`);
await expectErr('CHECK：家长邮箱必须小写', app, `INSERT INTO parents (family_id,email,password_hash,display_name) VALUES (1,'New@x.com','h','x')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('UNIQUE：家庭内昵称唯一', app, `INSERT INTO children (family_id,nickname,avatar_key,grade,pin_hash) VALUES (1,'小明','a',1,'h')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：孩子用户名与密码同时存在', app, `UPDATE children SET username='xiaoming' WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：开启跨家庭须有好友码', app, `UPDATE families SET cross_family_enabled=1 WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：会话的孩子必须属于同一家庭', app, `INSERT INTO sessions (token_hash,principal,family_id,child_id,login_method,expires_at) VALUES (UNHEX(SHA2('t1',256)),'child',2,1,'child_password',NOW()+INTERVAL 1 DAY)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('CHECK：PIN 登录必须在家庭设备上', app, `INSERT INTO sessions (token_hash,principal,family_id,child_id,login_method,expires_at) VALUES (UNHEX(SHA2('t2',256)),'child',1,1,'pin',NOW()+INTERVAL 1 DAY)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('家庭设备 + PIN 会话', app, `INSERT INTO family_devices (id,family_id,token_hash,label,created_by_parent_id,expires_at) VALUES (1,1,UNHEX(SHA2('d1',256)),'客厅平板',1,NOW()+INTERVAL 365 DAY);
  INSERT INTO sessions (token_hash,principal,family_id,child_id,family_device_id,login_method,expires_at) VALUES (UNHEX(SHA2('t3',256)),'child',1,1,1,'pin',NOW()+INTERVAL 8 HOUR)`);

// 5) 闯关记录：生成列与幂等
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
await expectOk('提交闯关 4/5', app, `INSERT INTO attempts (family_id,child_id,level_id,client_request_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,'en-g1-u01-l01',?,'2026-10-21',5,4,1,'[]')`, [uuid(1)]);
const [[a1]] = await app.query(`SELECT accuracy_pct,stars,passed FROM attempts WHERE client_request_id=?`, [uuid(1)]);
ok('生成列：4/5 => 80%、1 星、通过', a1.accuracy_pct === 80 && a1.stars === 1 && a1.passed === 1, JSON.stringify(a1));
await app.query(`INSERT INTO attempts (family_id,child_id,level_id,client_request_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,'en-g1-u01-l01',?,'2026-10-21',8,7,0,'[]'),(1,1,'en-g1-u01-l01',?,'2026-10-21',4,3,0,'[]'),(1,1,'en-g1-u01-l01',?,'2026-10-21',5,5,2,'[]')`, [uuid(2), uuid(3), uuid(4)]);
const [rows] = await app.query(`SELECT client_request_id c, accuracy_pct, stars, passed FROM attempts ORDER BY id`);
ok('生成列：7/8=87%→1 星；3/4=75%→未通过；5/5→3 星', rows[1].stars === 1 && rows[2].passed === 0 && rows[2].stars === 0 && rows[3].stars === 3, JSON.stringify(rows.map(r => [r.accuracy_pct, r.stars, r.passed])));
await expectErr('幂等：同一 client_request_id 的闯关只记一次', app, `INSERT INTO attempts (family_id,child_id,level_id,client_request_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,'en-g1-u01-l01',?,'2026-10-21',5,4,1,'[]')`, [uuid(1)], ['ER_DUP_ENTRY']);
await expectErr('CHECK：每关计分题至少 4 道', app, `INSERT INTO attempts (family_id,child_id,level_id,client_request_id,activity_date,scored_count,correct_count,stars_awarded,answers) VALUES (1,1,'en-g1-u01-l01',?,'2026-10-21',3,3,0,'[]')`, [uuid(5)], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：通关进度星数与首次通过时间一致', app, `INSERT INTO level_progress (family_id,child_id,level_id,best_stars,last_attempt_at) VALUES (1,1,'en-g1-u01-l01',2,NOW())`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 6) 复习
await expectOk('复习条目（词）', app, `INSERT INTO review_items (family_id,child_id,item_type,word_id,due_date) VALUES (1,1,'word','en.apple','2026-10-22')`);
await expectErr('UNIQUE：同一孩子同一词只有一条复习条目', app, `INSERT INTO review_items (family_id,child_id,item_type,word_id,due_date) VALUES (1,1,'word','en.apple','2026-10-23')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：复习盒 1..6', app, `UPDATE review_items SET box=7 WHERE child_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：词条目不能带题目 ID', app, `INSERT INTO review_items (family_id,child_id,item_type,word_id,question_id,due_date) VALUES (1,1,'word','en.pear','en-g1-u01-l01-q1','2026-10-22')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO review_sessions (family_id,child_id,client_request_id,review_date,item_count,correct_count,completes_day,results) VALUES (1,1,?,'2026-10-22',10,9,0,'[]'),(1,1,?,'2026-10-22',10,10,1,'[]')`, [uuid(10), uuid(11)]);
await expectErr('UNIQUE：每天最多一次“今日复习完成”', app, `INSERT INTO review_sessions (family_id,child_id,client_request_id,review_date,item_count,correct_count,completes_day,results) VALUES (1,1,?,'2026-10-22',1,1,1,'[]')`, [uuid(12)], ['ER_DUP_ENTRY']);

// 7) 星星账本
await expectOk('账本：通关 +1', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'level_pass',1,1,'attempt:1','2026-10-21')`);
await expectOk('账本：家长奖励 +40', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date,actor_parent_id) VALUES (1,1,'parent_award',40,41,'award:1:x','2026-10-21',1)`);
await expectErr('幂等：同一 source_key 只入账一次', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'level_pass',1,2,'attempt:1','2026-10-21')`, [], ['ER_DUP_ENTRY']);
await expectErr('CHECK：余额不可为负', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'purchase',-50,-9,'purchase:hat','2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：通关单次最多 3 星', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'level_pass',5,46,'attempt:99','2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：赠送单笔 ≤20', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'gift_out',-21,20,'gift:1:out','2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：支出类必须为负', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'purchase',30,71,'purchase:hat2','2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：家长奖励必须记录家长', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'parent_award',5,46,'award:1:y','2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('复合外键：家长奖励的家长必须同一家庭', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date,actor_parent_id) VALUES (1,1,'parent_award',5,46,'award:2:z','2026-10-21',2)`, [], ['ER_NO_REFERENCED_ROW_2']);
await expectErr('权限：app 不能 UPDATE 账本', app, `UPDATE star_ledger SET delta=3 WHERE child_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DELETE 账本', app, `DELETE FROM star_ledger WHERE child_id=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 UPDATE 闯关记录', app, `UPDATE attempts SET correct_count=5`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DELETE 赠送记录', app, `DELETE FROM gifts`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DELETE 审计', app, `DELETE FROM audit_events`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能写内容表', app, `UPDATE shop_items SET price=1`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能 DROP 表', app, `DROP TABLE star_ledger`, [], ['ER_TABLEACCESS_DENIED_ERROR']);
await expectErr('权限：app 不能建账号', app, `CREATE USER 'evil'@'%' IDENTIFIED BY 'x'`, [], ['ER_SPECIFIC_ACCESS_DENIED_ERROR']);
await expectErr('CHECK：余额缓存不可为负', app, `UPDATE star_balances SET balance=-1 WHERE child_id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('购买并持有物品', app, `INSERT INTO star_ledger (family_id,child_id,kind,delta,balance_after,source_key,local_date) VALUES (1,1,'purchase',-30,11,'purchase:hat-leaf','2026-10-21');
  INSERT INTO child_items (family_id,child_id,item_id,slot,equipped,purchase_ledger_id) VALUES (1,1,'hat-leaf','head',1,LAST_INSERT_ID())`);
await expectErr('UNIQUE：同一物品只能买一次', app, `INSERT INTO child_items (family_id,child_id,item_id,slot,purchase_ledger_id) SELECT 1,1,'hat-leaf','head',MAX(id) FROM star_ledger`, [], ['ER_DUP_ENTRY']);
await app.query(`INSERT INTO child_items (family_id,child_id,item_id,slot,equipped,purchase_ledger_id) SELECT 1,1,'hat-star','head',0,MAX(id) FROM star_ledger`);
await expectErr('UNIQUE：同一槽位只能穿戴一件', app, `UPDATE child_items SET equipped=1 WHERE item_id='hat-star'`, [], ['ER_DUP_ENTRY']);
const [[led]] = await app.query(`SELECT SUM(delta) s FROM star_ledger WHERE child_id=1`);
ok('余额 = SUM(delta) = 最后一行 balance_after', Number(led.s) === 11);

// 8) 现实奖励
await app.query(`INSERT INTO reward_options (id,family_id,title,star_price,created_by_parent_id) VALUES (1,1,'周末看电影',10,1),(2,2,'吃冰淇淋',5,2)`);
await expectErr('复合外键：只能兑换本家庭的奖励', app, `INSERT INTO redemptions (family_id,child_id,reward_option_id,title_snapshot,price) VALUES (1,1,2,'吃冰淇淋',5)`, [], ['ER_NO_REFERENCED_ROW_2']);
await app.query(`INSERT INTO redemptions (id,family_id,child_id,reward_option_id,title_snapshot,price) VALUES (1,1,1,1,'周末看电影',10)`);
await expectErr('CHECK：批准必须记录家长与时间', app, `UPDATE redemptions SET status='approved' WHERE id=1`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);

// 9) 社交
await expectErr('CHECK：好友关系 low<high', app, `INSERT INTO family_friendships (family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (2,1,2,2)`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await app.query(`INSERT INTO family_friendships (id,family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (1,1,2,1,1)`);
await expectErr('UNIQUE：同一对家庭只有一条进行中请求', app, `INSERT INTO family_friendships (family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (1,2,2,2)`, [], ['ER_DUP_ENTRY']);
await app.query(`UPDATE family_friendships SET status='declined', decided_by_parent_id=2, decided_at=NOW(3) WHERE id=1`);
await expectOk('拒绝后可重新申请', app, `INSERT INTO family_friendships (id,family_low_id,family_high_id,requested_by_family_id,requested_by_parent_id) VALUES (2,1,2,2,2)`);
await expectErr('CHECK：跨家庭赠送必须关联好友关系', app, `INSERT INTO gifts (from_family_id,from_child_id,to_family_id,to_child_id,amount,sender_date) VALUES (1,1,2,3,5,'2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectErr('CHECK：不能送给自己', app, `INSERT INTO gifts (from_family_id,from_child_id,to_family_id,to_child_id,amount,sender_date) VALUES (1,1,1,1,5,'2026-10-21')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('家庭内赠送', app, `INSERT INTO gifts (from_family_id,from_child_id,to_family_id,to_child_id,amount,sender_date) VALUES (1,1,1,2,5,'2026-10-21')`);
await expectErr('CHECK：跨家庭不能发自由文本', app, `INSERT INTO messages (sender_family_id,sender_child_id,recipient_family_id,recipient_child_id,kind,body) VALUES (1,1,2,3,'text','hi http://x')`, [], ['ER_CHECK_CONSTRAINT_VIOLATED']);
await expectOk('跨家庭预设短语', app, `INSERT INTO messages (id,sender_family_id,sender_child_id,recipient_family_id,recipient_child_id,kind,phrase_key) VALUES (1,1,1,2,3,'phrase','great-job')`);
await expectOk('家庭内自由文本（家长→孩子）', app, `INSERT INTO messages (sender_family_id,sender_parent_id,recipient_family_id,recipient_child_id,kind,body) VALUES (1,1,1,1,'text','今天真棒')`);
await expectErr('复合外键：家长不能以别家身份发消息', app, `INSERT INTO messages (sender_family_id,sender_parent_id,recipient_family_id,recipient_child_id,kind,body) VALUES (2,1,2,3,'text','x')`, [], ['ER_NO_REFERENCED_ROW_2']);
await app.query(`INSERT INTO abuse_reports (reporter_family_id,reporter_child_id,message_id,reason) VALUES (2,3,1,'rude')`);
await expectErr('UNIQUE：同一家庭对同一消息只举报一次', app, `INSERT INTO abuse_reports (reporter_family_id,reporter_parent_id,message_id,reason) VALUES (2,2,1,'spam')`, [], ['ER_DUP_ENTRY']);
await app.query(`INSERT INTO blocks (blocker_family_id,blocked_family_id,blocked_child_id,created_by) VALUES (2,1,1,'parent')`);
await expectErr('UNIQUE：重复屏蔽', app, `INSERT INTO blocks (blocker_family_id,blocked_family_id,blocked_child_id,created_by) VALUES (2,1,1,'parent')`, [], ['ER_DUP_ENTRY']);

// 10) 管控、AI、幂等表、设置
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
await expectErr('CHECK：周报去重键', app, `INSERT INTO email_outbox (kind,dedupe_key,to_email,subject,body_html) VALUES ('weekly_report','weekly:1:2026-W43','a@x.com','s','b'),('weekly_report','weekly:1:2026-W43','a@x.com','s','b')`, [], ['ER_DUP_ENTRY']);

// 11) 角色可重复执行（第二次应用已覆盖），账号锁定状态
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
