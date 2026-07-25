// Restores tables from backups/<table>.json back into the live database.
//
// Unlike backup.js (which discovers tables automatically), TABLE_ORDER is
// hardcoded here: a restore must delete children before parents and insert
// parents before children, and that ordering isn't recoverable from the
// dump files alone.
//
// Usage:
//   node scripts/restore.js                  dry run against backups/ on disk
//   node scripts/restore.js --confirm        actually restore from backups/ on disk
//   node scripts/restore.js --commit=<sha>   dry run against an older commit
//   node scripts/restore.js --commit=<sha> --confirm
//   node scripts/restore.js --list           show commits that touched backups/
//
// Find a commit to restore from with: git log --oneline -- backups/
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const TABLE_ORDER = ['game_types', 'games']; // parents before the children that reference them

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

if (args.includes('--list')) {
  console.log(execFileSync('git', ['log', '--oneline', '--', 'backups/'], { cwd: projectRoot, encoding: 'utf8' }));
  process.exit(0);
}

const confirm = args.includes('--confirm');
const commitArg = args.find((a) => a.startsWith('--commit='));
const commit = commitArg ? commitArg.split('=')[1] : null;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

function loadSnapshot(table) {
  if (commit) {
    const raw = execFileSync('git', ['show', `${commit}:backups/${table}.json`], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    return JSON.parse(raw);
  }
  return JSON.parse(readFileSync(join(projectRoot, 'backups', `${table}.json`), 'utf8'));
}

console.log(commit ? `Source: commit ${commit}` : 'Source: backups/ on disk');
console.log(confirm ? 'Mode: LIVE — this will overwrite the database\n' : 'Mode: DRY RUN — no changes will be made\n');

const snapshots = {};
let totalSnapshotRows = 0;
for (const table of TABLE_ORDER) {
  snapshots[table] = loadSnapshot(table);
  totalSnapshotRows += snapshots[table].length;
}

if (totalSnapshotRows === 0) {
  console.error('The snapshot has 0 rows across every table — refusing to restore from what is probably the wrong commit or an empty file.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

for (const table of TABLE_ORDER) {
  const { rows: currentRows } = await pool.query(`select id from "${table}"`);
  const currentIds = new Set(currentRows.map((r) => r.id));
  const snapshotIds = new Set(snapshots[table].map((r) => r.id));
  const toAdd = [...snapshotIds].filter((id) => !currentIds.has(id)).length;
  const toRemove = [...currentIds].filter((id) => !snapshotIds.has(id)).length;
  console.log(`${table}: currently ${currentRows.length} rows -> restoring to ${snapshots[table].length} rows (+${toAdd} new, -${toRemove} removed)`);
}

if (!confirm) {
  console.log('\nDry run only — no changes made. Re-run with --confirm to actually restore.');
  await pool.end();
  process.exit(0);
}

function toParamValue(value) {
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

const client = await pool.connect();
try {
  await client.query('begin');

  for (const table of [...TABLE_ORDER].reverse()) {
    await client.query(`delete from "${table}"`);
  }

  for (const table of TABLE_ORDER) {
    for (const row of snapshots[table]) {
      const columns = Object.keys(row);
      const columnList = columns.map((c) => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = columns.map((c) => toParamValue(row[c]));
      await client.query(`insert into "${table}" (${columnList}) values (${placeholders})`, values);
    }
  }

  await client.query('commit');
  console.log('\n✅ Restore complete.');
} catch (e) {
  await client.query('rollback');
  console.error('\n❌ Restore failed, rolled back — the database is unchanged:', e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
