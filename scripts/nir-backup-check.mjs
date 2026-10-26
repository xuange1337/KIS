import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const compose = [
  'compose',
  '--env-file',
  '.env',
  '-f',
  'docs/nir/compose.experiment.yml',
  '-f',
  'docs/nir/compose.cached.yml',
];
const docker = (args, input) =>
  execFileSync('docker', [...compose, ...args], {
    input,
    maxBuffer: 100 * 1024 * 1024,
  });
const psql = (database, sql) =>
  docker(
    [
      'exec',
      '-T',
      'db',
      'sh',
      '-c',
      'exec psql -U "$POSTGRES_USER" -d "$1" -At -v ON_ERROR_STOP=1',
      'sh',
      database,
    ],
    sql,
  )
    .toString()
    .trim();
const dir = process.env.NIR_BACKUP_DIR ?? 'backups/nir-2026-10-08';
const restoreDatabase = 'crm_nir_restore';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const tables = [
  ['organizations', 'organization_id'],
  ['users', 'user_id'],
  ['organization_members', 'membership_id'],
  ['organization_invitations', 'invitation_id'],
  ['clients', 'client_id'],
  ['contacts', 'contact_id'],
  ['deals', 'deal_id'],
  ['deal_stage_history', 'id'],
  ['activities', 'activity_id'],
  ['commercial_offers', 'offer_id'],
  ['products', 'product_id'],
  ['offer_items', 'item_id'],
  ['audit_log', 'id'],
  ['refresh_sessions', 'session_id'],
  ['idempotency_keys', 'idempotency_id'],
  ['export_jobs', 'export_job_id'],
  ['password_resets', 'password_reset_id'],
  ['email_verifications', 'verification_id'],
  ['migrations', 'id'],
];
const snapshot = (database) =>
  Object.fromEntries(
    tables.map(([table, id]) => {
      const result = psql(
        database,
        `SELECT count(*)||'|'||COALESCE(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY ${id})),md5('')) FROM ${table} t;`,
      );
      const [count, digest] = result.split('|');
      return [table, { count: Number(count), logicalMd5: digest }];
    }),
  );
if (
  psql(
    'postgres',
    `SELECT count(*) FROM pg_database WHERE datname='${restoreDatabase}';`,
  ) !== '0'
) {
  throw new Error(
    'Restore target already exists; existing data will not be overwritten',
  );
}
await mkdir('backups', { recursive: true });
await mkdir(dir, { recursive: false });
// A known fixture proves file contents survive an archive/extraction, not just DB counts.
docker([
  'exec',
  '-T',
  'api',
  'sh',
  '-c',
  'printf "KIS NIR synthetic attachment 2026-10-08\\n" > /app/uploads/nir-integrity.txt',
]);
const fixture = docker([
  'exec',
  '-T',
  'api',
  'cat',
  '/app/uploads/nir-integrity.txt',
]);
const archive = docker([
  'exec',
  '-T',
  'api',
  'tar',
  '-cf',
  '-',
  '-C',
  '/app',
  'uploads',
]);
await writeFile(join(dir, 'uploads.tar'), archive);
// Stop the experiment API so its timers cannot mutate rows during comparison.
docker(['stop', 'api']);
const dump = docker([
  'exec',
  '-T',
  'db',
  'sh',
  '-c',
  'exec pg_dump -U "$POSTGRES_USER" -d crm_nir -Fc --no-owner',
]);
await writeFile(join(dir, 'database.dump'), dump);
const source = snapshot('crm_nir');
psql('postgres', `CREATE DATABASE ${restoreDatabase};`);
docker(
  [
    'exec',
    '-T',
    'db',
    'sh',
    '-c',
    'exec pg_restore -U "$POSTGRES_USER" -d crm_nir_restore --no-owner --exit-on-error',
  ],
  dump,
);
const restored = snapshot(restoreDatabase);
const restoredFiles = join(dir, 'restored-files');
await mkdir(restoredFiles);
execFileSync('tar', ['-xf', join(dir, 'uploads.tar'), '-C', restoredFiles]);
const restoredFixture = await readFile(
  join(restoredFiles, 'uploads/nir-integrity.txt'),
);
const files = {
  'database.dump': { bytes: dump.length, sha256: sha256(dump) },
  'uploads.tar': { bytes: archive.length, sha256: sha256(archive) },
};
const report = {
  date: new Date().toISOString(),
  backupDirectory: dir,
  sourceDatabase: 'crm_nir',
  restoredDatabase: restoreDatabase,
  files,
  source,
  restored,
  allTablesEqual: JSON.stringify(source) === JSON.stringify(restored),
  syntheticAttachmentEqual: fixture.equals(restoredFixture),
  attachmentSha256: sha256(restoredFixture),
  limitation:
    'Local synthetic database and synthetic attachment; not a production recovery test',
};
await writeFile(
  join(dir, 'SHA256SUMS'),
  Object.entries(files)
    .map(([name, value]) => `${value.sha256}  ${name}\n`)
    .join(''),
);
await writeFile(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ allTablesEqual: report.allTablesEqual, syntheticAttachmentEqual: report.syntheticAttachmentEqual, files })}\n`,
);
if (!report.allTablesEqual || !report.syntheticAttachmentEqual)
  process.exitCode = 1;
