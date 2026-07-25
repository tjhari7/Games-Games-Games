import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './server/db.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// Parses flexible player-range text ("2-4", "3+", "1", "2 to 6") and tests
// whether a given player count fits within it.
function playersMatch(playersText, target) {
  if (!playersText) return false;
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
  const plusMatch = text.match(/(\d+)\s*(?:min|minutes)?\s*\+/);
  if (plusMatch) return [Number(plusMatch[1]), Infinity];
  const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) return [Number(rangeMatch[1]), Number(rangeMatch[2])];
  const singleMatch = text.match(/(\d+)/);
  if (singleMatch) return [Number(singleMatch[1]), Number(singleMatch[1])];
  return null;
}

function timeMatchesBucket(timeText, bucket) {
  const range = parseTimeRangeMinutes(timeText);
  if (!range) return false;
  const [lo, hi] = range;
  if (bucket === 'under10') return lo < 10;
  if (bucket === '10to30') return lo <= 30 && hi >= 10;
  if (bucket === 'over30') return hi > 30 || hi === Infinity;
  return true;
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

    const players = req.query.players ? Number(req.query.players) : null;
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

    const players = req.query.players ? Number(req.query.players) : null;
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

// Serve React app for all non-API routes (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
