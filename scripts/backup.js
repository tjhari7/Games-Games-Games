// Dumps every table in the public schema to backups/<table>.json.
//
// Filenames are stable rather than dated on purpose: git history becomes the
// backup timeline, so `git log -p backups/games.json` shows exactly what
// changed and when, and any past version can be restored with `git show`.
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'backups');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Locally it comes from .env; in CI it comes from the DATABASE_URL secret.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const { rows: tables } = await pool.query(
  `select tablename from pg_tables where schemaname = 'public' order by tablename`
);

if (tables.length === 0) {
  console.error('No tables found in the public schema — refusing to write an empty backup.');
  await pool.end();
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

let totalRows = 0;

for (const { tablename } of tables) {
  // Sort by a real column so the JSON byte-for-byte matches between runs when
  // nothing changed. Without this, Postgres row order can drift and every
  // backup would look like a change.
  const { rows: cols } = await pool.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1 and column_name = 'id'`,
    [tablename]
  );
  const orderBy = cols.length ? '"id"' : '1';

  // tablename comes from pg_tables, not from user input, but quote it anyway.
  const { rows } = await pool.query(`select * from "${tablename}" order by ${orderBy}`);
  await writeFile(join(outDir, `${tablename}.json`), `${JSON.stringify(rows, null, 2)}\n`);

  console.log(`  ${tablename}: ${rows.length} rows`);
  totalRows += rows.length;
}

await pool.end();

// A backup that "succeeds" with nothing in it is worse than a failed one, because
// it overwrites the good copy and still reports green.
if (totalRows === 0) {
  console.error(`Dumped 0 rows across ${tables.length} tables — treating this as a failure.`);
  process.exit(1);
}

console.log(`Backed up ${totalRows} rows from ${tables.length} tables.`);
