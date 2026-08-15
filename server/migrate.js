import { pool } from './db.js';

// Schema-only counterpart to seed.js: provisions the per-game user-state
// tables (favorited/played/rated) without touching game_types or games —
// seed.js's game_types loop unconditionally overwrites accent/bg on every
// run, which would be a bad surprise to trigger just to add these tables to
// an already-seeded database.
async function main() {
  await pool.query(`
    create table if not exists game_favorites (
      game_id uuid primary key references games(id) on delete cascade
    );

    create table if not exists game_played (
      game_id uuid primary key references games(id) on delete cascade
    );

    create table if not exists game_ratings (
      game_id uuid primary key references games(id) on delete cascade,
      rating numeric(2,1) not null
    );
  `);

  console.log('game_favorites, game_played, game_ratings ready.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
