import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Parses flexible player-range text ("2-4", "3+", "1", "2 to 6") and tests
// whether a given player count fits within it.
function playersMatch(playersText, target) {
  if (!playersText) return false;
  // "8+" means "supports a group of 8 or more" — match games whose range
  // reaches 8 or beyond, rather than requiring an exact player count.
  if (target === '8+') {
    const text = playersText.trim();
    const plusMatch = text.match(/^(\d+)\s*\+/);
    if (plusMatch) return true;
    const rangeMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
    if (rangeMatch) return Number(rangeMatch[2]) >= 8;
    const singleMatch = text.match(/^(\d+)$/);
    if (singleMatch) return Number(singleMatch[1]) >= 8;
    return false;
  }
  const text = playersText.trim();
  const plusMatch = text.match(/^(\d+)\s*\+/);
  if (plusMatch) return target >= Number(plusMatch[1]);
  const rangeMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
  if (rangeMatch) {
    const [, lo, hi] = rangeMatch;
    return target >= Number(lo) && target <= Number(hi);
  }
  const singleMatch = text.match(/^(\d+)$/);
  if (singleMatch) return target === Number(singleMatch[1]);
  return false;
}

// Parses flexible time text ("5 min", "10-20 min", "30 min+") into a rough
// [min, max] range in minutes, then tests whether it overlaps a bucket.
function parseTimeRangeMinutes(timeText) {
  if (!timeText) return null;
  const text = timeText.toLowerCase();
  // "Under 10 min" is a ceiling, not a single value — without this it would
  // fall through to singleMatch and parse as exactly 10.
  const underMatch = text.match(/^\s*(?:under|less than|up to)\s*(\d+)/);
  if (underMatch) return [0, Number(underMatch[1])];
  const plusMatch = text.match(/(\d+)\s*(?:min|minutes)?\s*\+/);
  if (plusMatch) return [Number(plusMatch[1]), Infinity];
  const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) return [Number(rangeMatch[1]), Number(rangeMatch[2])];
  const singleMatch = text.match(/(\d+)/);
  if (singleMatch) return [Number(singleMatch[1]), Number(singleMatch[1])];
  return null;
}

const TIME_BUCKET_RANGES = {
  '5min': [0, 7],
  '10min': [8, 12],
  '15min': [13, 20],
  '30plus': [21, Infinity],
};

// Matches on the game's minimum stated time only, so a game only shows up
// under one bucket rather than every bucket its range could reach into.
function timeMatchesBucket(timeText, bucket) {
  const range = parseTimeRangeMinutes(timeText);
  if (!range) return false;
  const [lo] = range;
  const bucketRange = TIME_BUCKET_RANGES[bucket];
  if (!bucketRange) return true;
  const [bucketLo, bucketHi] = bucketRange;
  return lo >= bucketLo && lo <= bucketHi;
}

async function getUnassignedTypeId() {
  const { rows } = await pool.query('select id from game_types where name = $1', ['Unassigned']);
  return rows[0]?.id;
}

// Game Types routes
app.get('/api/game-types', async (req, res) => {
  try {
    const { rows } = await pool.query('select * from game_types order by protected asc, name asc');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/game-types', async (req, res) => {
  try {
    const { name, accent, bg } = req.body;
    if (!name || !accent || !bg) {
      return res.status(400).json({ error: 'name, accent, and bg are required' });
    }
    const { rows } = await pool.query(
      'insert into game_types (name, accent, bg) values ($1, $2, $3) returning *',
      [name, accent, bg]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A game type with that name already exists' });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.put('/api/game-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existingRows } = await pool.query('select * from game_types where id = $1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const name = existing.protected ? existing.name : req.body.name ?? existing.name;
    const accent = req.body.accent ?? existing.accent;
    const bg = req.body.bg ?? existing.bg;

    const { rows } = await pool.query(
      'update game_types set name = $1, accent = $2, bg = $3 where id = $4 returning *',
      [name, accent, bg, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A game type with that name already exists' });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.delete('/api/game-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existingRows } = await pool.query('select * from game_types where id = $1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.protected) return res.status(400).json({ error: 'The Unassigned type cannot be deleted' });

    const unassignedId = await getUnassignedTypeId();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('update games set type_id = $1 where type_id = $2', [unassignedId, id]);
      await client.query('delete from game_types where id = $1', [id]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Games routes
app.get('/api/games', async (req, res) => {
  try {
    const conditions = [];
    const values = [];

    if (req.query.search) {
      values.push(`%${req.query.search}%`);
      conditions.push(`g.title ilike $${values.length}`);
    }
    if (req.query.type_id) {
      values.push(req.query.type_id);
      conditions.push(`g.type_id = $${values.length}`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const { rows } = await pool.query(
      `select g.*, gt.name as type_name, gt.accent as type_accent, gt.bg as type_bg
       from games g join game_types gt on gt.id = g.type_id
       ${where}
       order by g.title asc`,
      values
    );

    const players = req.query.players ? (req.query.players === '8+' ? '8+' : Number(req.query.players)) : null;
    const timeBucket = req.query.time_bucket;

    let filtered = rows;
    if (players) filtered = filtered.filter((g) => playersMatch(g.players, players));
    if (timeBucket) filtered = filtered.filter((g) => timeMatchesBucket(g.time, timeBucket));

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('/api/games/random', async (req, res) => {
  try {
    const conditions = [];
    const values = [];

    if (req.query.type_id) {
      values.push(req.query.type_id);
      conditions.push(`g.type_id = $${values.length}`);
    }
    if (req.query.exclude) {
      const excludeIds = req.query.exclude.split(',').filter(Boolean);
      if (excludeIds.length) {
        values.push(excludeIds);
        conditions.push(`g.id != all($${values.length}::uuid[])`);
      }
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const { rows } = await pool.query(
      `select g.*, gt.name as type_name, gt.accent as type_accent, gt.bg as type_bg
       from games g join game_types gt on gt.id = g.type_id
       ${where}`,
      values
    );

    const players = req.query.players ? (req.query.players === '8+' ? '8+' : Number(req.query.players)) : null;
    const timeBucket = req.query.time_bucket;

    let pool_ = rows;
    if (players) pool_ = pool_.filter((g) => playersMatch(g.players, players));
    if (timeBucket) pool_ = pool_.filter((g) => timeMatchesBucket(g.time, timeBucket));

    if (pool_.length === 0) return res.json({ game: null, poolSize: 0 });

    const picked = pool_[Math.floor(Math.random() * pool_.length)];
    res.json({ game: picked, poolSize: pool_.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('/api/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `select g.*, gt.name as type_name, gt.accent as type_accent, gt.bg as type_bg
       from games g join game_types gt on gt.id = g.type_id
       where g.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/games', async (req, res) => {
  try {
    const { title, type_id, description, players, time, materials, rules, example } = req.body;
    if (!title || !type_id) {
      return res.status(400).json({ error: 'title and type_id are required' });
    }
    const { rows } = await pool.query(
      `insert into games (type_id, title, description, players, time, materials, rules, example)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [type_id, title, description || null, players || null, time || null, materials || null, rules || null, example || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.put('/api/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type_id, description, players, time, materials, rules, example } = req.body;
    if (!title || !type_id) {
      return res.status(400).json({ error: 'title and type_id are required' });
    }
    const { rows } = await pool.query(
      `update games set type_id = $1, title = $2, description = $3, players = $4, time = $5, materials = $6, rules = $7, example = $8
       where id = $9 returning *`,
      [type_id, title, description || null, players || null, time || null, materials || null, rules || null, example || null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.delete('/api/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('delete from games where id = $1 returning id', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Per-game user state: favorited, played, and rated. No accounts in this app,
// so these are single shared lists rather than scoped to a user — same as
// games and game_types. Each table cascades off games(id), so deleting a game
// quietly cleans up its state here too.

app.get('/api/favorites', async (req, res) => {
  try {
    const { rows } = await pool.query('select game_id from game_favorites');
    res.json(rows.map((r) => r.game_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.put('/api/favorites/:gameId', async (req, res) => {
  try {
    await pool.query('insert into game_favorites (game_id) values ($1) on conflict (game_id) do nothing', [
      req.params.gameId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.delete('/api/favorites/:gameId', async (req, res) => {
  try {
    await pool.query('delete from game_favorites where game_id = $1', [req.params.gameId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('/api/played', async (req, res) => {
  try {
    const { rows } = await pool.query('select game_id from game_played');
    res.json(rows.map((r) => r.game_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.put('/api/played/:gameId', async (req, res) => {
  try {
    await pool.query('insert into game_played (game_id) values ($1) on conflict (game_id) do nothing', [
      req.params.gameId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.delete('/api/played/:gameId', async (req, res) => {
  try {
    await pool.query('delete from game_played where game_id = $1', [req.params.gameId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('/api/ratings', async (req, res) => {
  try {
    const { rows } = await pool.query('select game_id, rating from game_ratings');
    res.json(Object.fromEntries(rows.map((r) => [r.game_id, Number(r.rating)])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.put('/api/ratings/:gameId', async (req, res) => {
  try {
    const { rating } = req.body;
    if (typeof rating !== 'number' || rating < 0.5 || rating > 5) {
      return res.status(400).json({ error: 'rating must be a number between 0.5 and 5' });
    }
    await pool.query(
      `insert into game_ratings (game_id, rating) values ($1, $2)
       on conflict (game_id) do update set rating = excluded.rating`,
      [req.params.gameId, rating]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.delete('/api/ratings/:gameId', async (req, res) => {
  try {
    await pool.query('delete from game_ratings where game_id = $1', [req.params.gameId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;
