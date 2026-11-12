import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const require = createRequire(
  new URL('../server/package.json', import.meta.url),
);
const { DataSource } = require('typeorm');
const bcrypt = require('bcryptjs');
const {
  buildDataSourceOptions,
} = require('../server/dist/database/data-source');
const options = buildDataSourceOptions();
const seed = Number(process.env.NIR_SEED ?? 20261008);
const referenceDate = '2026-10-08T12:00:00+03:00';

// Never populate a working database. Repeated runs require a fresh experiment DB.
if (
  options.database !== 'crm_nir' ||
  options.host !== 'localhost' ||
  options.port !== 55432 ||
  process.env.NIR_ALLOW_SEED !== '1'
) {
  throw new Error('Use localhost:55432/crm_nir and NIR_ALLOW_SEED=1 only');
}
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 1_000_000_000) {
  throw new Error('NIR_SEED must be an integer from 0 to 1000000000');
}

const db = new DataSource({
  ...options,
  migrationsRun: false,
  logging: ['error'],
});
await db.initialize();
try {
  await db.transaction(async (tx) => {
    await tx.query(
      'LOCK TABLE users, clients, organizations IN EXCLUSIVE MODE',
    );
    const [state] = await tx.query(`SELECT
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM clients)::int AS clients,
      (SELECT count(*) FROM organizations)::int AS organizations`);
    if (state.users || state.clients || state.organizations !== 1) {
      throw new Error(
        'Experiment database must contain only migration defaults',
      );
    }
    await tx.query(
      `UPDATE organizations SET name='НИР Организация 1', created_at=$1
       WHERE organization_id=1`,
      [referenceDate],
    );
    await tx.query(
      `INSERT INTO organizations (organization_id,name,created_at)
       SELECT g,'НИР Организация '||g,$1 FROM generate_series(2,3) g`,
      [referenceDate],
    );
    await tx.query(
      `INSERT INTO users (user_id,login,password_hash,full_name,created_at)
       SELECT g,'nir_'||g,$1,'Тестовый сотрудник '||g,$2
       FROM generate_series(1,30) g`,
      [bcrypt.hashSync('nir-test-only', 10), referenceDate],
    );
    await tx.query(`INSERT INTO organization_members (organization_id,user_id,role,created_at)
      SELECT (user_id-1)/10+1,user_id,
      (CASE (user_id-1)%10 WHEN 0 THEN 'admin' WHEN 1 THEN 'head' ELSE 'manager' END)::users_role_enum,
      created_at FROM users`);
    await tx.query(
      `INSERT INTO clients (client_id,organization_id,name,inn,industry,status,source,owner_user_id,created_at)
       SELECT g,(g-1)%3+1,'НИР Клиент '||g,lpad(g::text,10,'0'),'Синтетическая отрасль',
       (ARRAY['lead','in_work','active'])[(g-1)/3%3+1]::clients_status_enum,
       'website'::clients_source_enum,((g-1)%3)*10+3+(g-1)/3%8,
       $2::timestamptz-(180+(g*7919+$1::bigint)%180)*interval '1 day'
       FROM generate_series(1,10000) g`,
      [seed, referenceDate],
    );
    await tx.query(`INSERT INTO contacts (organization_id,client_id,full_name,email,preferred_channel)
      SELECT c.organization_id,c.client_id,'Тестовый контакт '||g,'contact'||g||'@nir.example',
      'email'::contacts_preferred_channel_enum
      FROM generate_series(1,15000) g JOIN clients c ON c.client_id=(g-1)%10000+1`);
    await tx.query(
      `INSERT INTO deals (deal_id,organization_id,client_id,title,stage,amount,currency,probability,
       planned_close,owner_user_id,closed_at,created_at)
       SELECT g,c.organization_id,c.client_id,'НИР Сделка '||g,
       (ARRAY['new','qualification','proposal','negotiation','won','lost'])[(g-1)/3%6+1]::deals_stage_enum,
       ((g*7919+$1::bigint)%900000+10000)::numeric/100,'RUB'::deals_currency_enum,
       (ARRAY[10,30,50,70,100,0])[(g-1)/3%6+1],
       ($2::timestamptz+((g-1)/3%30)*interval '1 day')::date,c.owner_user_id,
       CASE WHEN (g-1)/3%6>=4 THEN $2::timestamptz-((g-1)/3%60)*interval '1 day' END,
       $2::timestamptz-(180+(g*7919+$1::bigint)%180)*interval '1 day'
       FROM generate_series(1,20000) g JOIN clients c ON c.client_id=(g-1)%10000+1`,
      [seed, referenceDate],
    );
    await tx.query(`INSERT INTO deal_stage_history (organization_id,deal_id,to_stage,changed_by,changed_at)
      SELECT organization_id,deal_id,stage::text::deal_stage_history_to_stage_enum,owner_user_id,created_at FROM deals`);
    await tx.query(
      `INSERT INTO activities (organization_id,client_id,deal_id,type,subject,planned_at,done_at,status,result,owner_user_id)
       SELECT d.organization_id,d.client_id,d.deal_id,
       (ARRAY['call','meeting','email'])[(g-1)/3%3+1]::activities_type_enum,'НИР Активность '||g,
       $1::timestamptz+(CASE WHEN (g-1)/3%3=1 THEN (g-1)/3%30-30 ELSE (g-1)/3%60-30 END)*interval '1 day',
       CASE WHEN (g-1)/3%3=1 THEN $1::timestamptz END,
       (ARRAY['planned','done','canceled'])[(g-1)/3%3+1]::activities_status_enum,
       CASE WHEN (g-1)/3%3=1 THEN 'Синтетический результат' END,d.owner_user_id
       FROM generate_series(1,50000) g JOIN deals d ON d.deal_id=(g-1)%20000+1`,
      [referenceDate],
    );
    await tx.query(
      `INSERT INTO commercial_offers (organization_id,deal_id,number,date,total_amount,status,currency)
       SELECT d.organization_id,d.deal_id,'NIR-'||g,$1::timestamptz::date,d.amount,
       (ARRAY['draft','sent','accepted','rejected'])[(g-1)/3%4+1]::commercial_offers_status_enum,'RUB'
       FROM generate_series(1,5000) g JOIN deals d ON d.deal_id=g`,
      [referenceDate],
    );
    // Explicit IDs must leave serial sequences ready for subsequent UI scenarios.
    for (const [table, column] of [
      ['organizations', 'organization_id'],
      ['users', 'user_id'],
      ['clients', 'client_id'],
      ['deals', 'deal_id'],
    ]) {
      await tx.query(
        `SELECT setval(pg_get_serial_sequence('${table}','${column}'),(SELECT max(${column}) FROM ${table}))`,
      );
    }
  });
  await db.query('ANALYZE');
  const counts = {};
  for (const table of [
    'organizations',
    'users',
    'organization_members',
    'clients',
    'contacts',
    'deals',
    'activities',
    'commercial_offers',
    'deal_stage_history',
  ]) {
    counts[table] = Number(
      (await db.query(`SELECT count(*) AS n FROM ${table}`))[0].n,
    );
  }
  const rows = await db.query(
    `SELECT client_id,organization_id,name,owner_user_id,created_at FROM clients ORDER BY client_id`,
  );
  const datasetSha256 = createHash('sha256')
    .update(JSON.stringify(rows))
    .digest('hex');
  const report = {
    seed,
    referenceDate,
    counts,
    clientProjectionSha256: datasetSha256,
    fingerprintScope:
      'clients: id, organization, name, owner, created_at; credentials excluded',
    fixtureLogin: 'nir_3',
    fixturePassword: 'nir-test-only',
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.env.NIR_DATASET_REPORT)
    await writeFile(process.env.NIR_DATASET_REPORT, json);
  process.stdout.write(json);
} finally {
  await db.destroy();
}
