// 在临时 PostgreSQL 16 上验证 db/migrations + db/roles.sql。
// 只用超级用户本机连接；会 DROP/CREATE 数据库 xingya 与 xingya_* 角色，切勿指向生产。
// 依赖：`pg` 包；环境变量见 README。
import fs from 'node:fs';
import process from 'node:process';
import pg from 'pg';

const adminUrl = {
  host: process.env.PGHOST || '/tmp',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  password: process.env.PGPASSWORD || undefined,
};

const SQL_FILES = process.argv.slice(2);
if (SQL_FILES.length === 0) {
  console.error('用法: PGHOST=... PGPORT=... node verify.mjs ../migrations/0001_init.sql ../roles.sql');
  process.exit(2);
}
const SQL = SQL_FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); };

const admin = new pg.Client(adminUrl);
await admin.connect();

async function recreateDb() {
  await admin.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = 'xingya' AND pid <> pg_backend_pid()`);
  await admin.query('DROP DATABASE IF EXISTS xingya');
  // 角色可能残留
  for (const r of ['xingya_app', 'xingya_migrator', 'xingya_app_role', 'xingya_migrator_role']) {
    try { await admin.query(`DROP ROLE IF EXISTS ${r}`); } catch (_) {}
  }
  await admin.query(`CREATE DATABASE xingya WITH ENCODING 'UTF8' LOCALE_PROVIDER=libc LC_COLLATE='C' LC_CTYPE='C' TEMPLATE template0`);
}

async function withDb(fn) {
  const c = new pg.Client({ ...adminUrl, database: 'xingya' });
  await c.connect();
  try { return await fn(c); }
  finally { await c.end(); }
}

async function fingerprint(c) {
  const q = async (sql) => JSON.stringify((await c.query(sql)).rows);
  const parts = await Promise.all([
    q(`SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`),
    q(`SELECT table_name, constraint_name, constraint_type
       FROM information_schema.table_constraints WHERE table_schema='public' ORDER BY 1,2`),
    q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1`),
  ]);
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

async function counts(c) {
  const tables = Number((await c.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows[0].n);
  const fks = Number((await c.query(`SELECT count(*)::int n FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='FOREIGN KEY'`)).rows[0].n);
  const checks = Number((await c.query(`SELECT count(*)::int n FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='CHECK'`)).rows[0].n);
  return { tables, fks, checks };
}

await recreateDb();
await withDb(async (c) => { await c.query(SQL); });
const fp1 = await withDb(fingerprint);
const c1 = await withDb(counts);
await recreateDb();
await withDb(async (c) => { await c.query(SQL); });
const fp2 = await withDb(fingerprint);
const c2 = await withDb(counts);
ok('从空库应用两次表数/外键/CHECK 数一致', c1.tables === c2.tables && c1.fks === c2.fks && c1.checks === c2.checks, JSON.stringify({c1,c2}));
ok('表数=82', c2.tables === 82, JSON.stringify(c2));
ok('结构指纹（列/约束/索引，供人工对照）', true, `${fp1.slice(0, 16)} … / ${fp2.slice(0, 16)} …`);

{
  const roles = (await admin.query(`SELECT rolname, rolsuper FROM pg_roles WHERE rolname LIKE 'xingya%' ORDER BY 1`)).rows;
  ok('存在 xingya_app / migrator 及其 _role', roles.length >= 4, JSON.stringify(roles));
  ok('xingya 角色都不是超级用户', roles.every((r) => !r.rolsuper), JSON.stringify(roles));
}

await admin.query(`ALTER ROLE xingya_app WITH PASSWORD 'test-app-pw-1' LOGIN`);
await admin.query(`ALTER ROLE xingya_migrator WITH PASSWORD 'test-mig-pw-1' LOGIN`);

const app = new pg.Client({ ...adminUrl, database: 'xingya', user: 'xingya_app', password: 'test-app-pw-1' });
const mig = new pg.Client({ ...adminUrl, database: 'xingya', user: 'xingya_migrator', password: 'test-mig-pw-1' });
await app.connect();
await mig.connect();
await app.query(`SET TIME ZONE 'UTC'`);
await mig.query(`SET TIME ZONE 'UTC'`);

const expectErr = async (name, conn, sql, codes) => {
  try {
    await conn.query(sql);
    ok(name, false, 'unexpectedly succeeded');
  } catch (e) {
    const code = e.code || '';
    ok(name, codes.includes(code), `${code}: ${String(e.message).slice(0, 100)}`);
  }
};
const expectOk = async (name, conn, sql) => {
  try { await conn.query(sql); ok(name, true); }
  catch (e) { ok(name, false, `${e.code}: ${String(e.message).slice(0, 120)}`); }
};

await expectOk('migrator 可在 public 建表（CREATE 权限）', mig, `CREATE TABLE zz_tmp (id INT PRIMARY KEY)`);
await expectOk('migrator 可删自有表', mig, `DROP TABLE zz_tmp`);
await expectOk('migrator 建系统管理员', mig, `INSERT INTO admin_accounts (id,username,password_hash,totp_secret_enc) VALUES (1,'ops','h',E'\\\\x00')`);

await expectOk('app 建家庭/家长/孩子', app, `
  INSERT INTO families (id,name) OVERRIDING SYSTEM VALUE VALUES (1,'王家'),(2,'李家');
  INSERT INTO parents (id,family_id,email,password_hash,display_name) OVERRIDING SYSTEM VALUE VALUES (1,1,'a@x.com','h','爸爸'),(2,2,'b@y.com','h','妈妈');
  INSERT INTO children (id,family_id,nickname,avatar_key,grade,pin_hash) OVERRIDING SYSTEM VALUE VALUES (1,1,'小明','sprout',1,'h'),(2,1,'小红','leaf',3,'h'),(3,2,'小李','sun',2,'h');
  INSERT INTO balances (child_id,currency,family_id,balance) VALUES (1,'star',1,0),(1,'fragment',1,0),(2,'star',1,0),(3,'star',2,0)`);

await expectErr('CHECK：家长邮箱必须小写', app,
  `INSERT INTO parents (family_id,email,password_hash,display_name) VALUES (1,'New@x.com','h','x')`,
  ['23514']);
await expectErr('CHECK：开启跨家庭须有好友码', app,
  `UPDATE families SET cross_family_enabled=TRUE WHERE id=1`,
  ['23514']);

await expectOk('任务队列：两个 running（槽位 1、2）', app, `
  INSERT INTO ai_jobs (id,kind,status,running_slot,needs_local,params,budget_month,started_at) OVERRIDING SYSTEM VALUE
  VALUES (1,'agent_run','running',1,TRUE,'{}','2026-10',NOW()),
         (2,'agent_run','running',2,FALSE,'{}','2026-10',NOW())`);
await expectErr('任务队列：第 3 个并发被拒（槽位唯一）', app,
  `INSERT INTO ai_jobs (id,kind,status,running_slot,needs_local,params,budget_month,started_at) OVERRIDING SYSTEM VALUE
   VALUES (3,'agent_run','running',1,FALSE,'{}','2026-10',NOW())`,
  ['23505']);
await expectErr('任务队列：本机进程类同时最多 1 个', app,
  `INSERT INTO ai_jobs (id,kind,status,running_slot,needs_local,params,budget_month,started_at) OVERRIDING SYSTEM VALUE
   VALUES (3,'agent_run','running',2,TRUE,'{}','2026-10',NOW())`,
  ['23505']);
await expectErr('CHECK：实际费用不得超过预估', app,
  `INSERT INTO ai_jobs (kind,params,budget_month,estimated_cost_fen,actual_cost_fen)
   VALUES ('agent_run','{}','2026-10',100,101)`,
  ['23514']);

await expectOk('月度预算行', app, `INSERT INTO ai_budget_months (budget_month,cap_fen,reserved_fen,spent_fen) VALUES ('2026-10',20000,500,1000)`);
await expectErr('CHECK：预留+已花费不得超过月度预算', app,
  `UPDATE ai_budget_months SET reserved_fen=reserved_fen+19000 WHERE budget_month='2026-10'`,
  ['23514']);

await expectOk('可入队 queued 任务', app,
  `INSERT INTO ai_jobs (id,kind,status,params,budget_month) OVERRIDING SYSTEM VALUE VALUES (10,'agent_run','queued','{}','2026-10')`);
{
  await app.query('BEGIN');
  const r = await app.query(`SELECT id FROM ai_jobs WHERE status='queued' ORDER BY queued_at FOR UPDATE SKIP LOCKED LIMIT 1`);
  ok('FOR UPDATE SKIP LOCKED 可抢排队任务', r.rows.length === 1 && Number(r.rows[0].id) === 10, JSON.stringify(r.rows));
  await app.query('ROLLBACK');
}

await expectErr('权限：app 不能 DROP 表', app, `DROP TABLE ledger`, ['42501']);

await app.end();
await mig.end();

await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='xingya' AND pid <> pg_backend_pid()`);
await admin.query('DROP DATABASE IF EXISTS xingya');
for (const r of ['xingya_app', 'xingya_migrator', 'xingya_app_role', 'xingya_migrator_role']) {
  try { await admin.query(`DROP ROLE IF EXISTS ${r}`); } catch (_) {}
}
await admin.end();

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? '  — ' + r.extra : ''}`);
console.log(`\n结构统计: ${JSON.stringify(c2)}\n合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
process.exit(failed.length ? 1 : 0);
