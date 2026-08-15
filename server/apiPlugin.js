import { pool } from './db.js';

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

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

const routes = [
  {
    method: 'GET',
    pattern: /^\/api\/game-types$/,
    handler: async (req, res) => {
      const { rows } = await pool.query('select * from game_types order by protected asc, name asc');
      sendJson(res, 200, rows);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/game-types$/,
    handler: async (req, res) => {
      const body = await readBody(req);
      const { name, accent, bg } = body;
      if (!name || !accent || !bg) return sendJson(res, 400, { error: 'name, accent, and bg are required' });
      try {
        const { rows } = await pool.query(
          'insert into game_types (name, accent, bg) values ($1, $2, $3) returning *',
          [name, accent, bg]
        );
        sendJson(res, 201, rows[0]);
      } catch (err) {
        if (err.code === '23505') return sendJson(res, 409, { error: 'A game type with that name already exists' });
        throw err;
      }
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/game-types\/([^/]+)$/,
    handler: async (req, res, [id]) => {
      const body = await readBody(req);
      const { rows: existingRows } = await pool.query('select * from game_types where id = $1', [id]);
      const existing = existingRows[0];
      if (!existing) return sendJson(res, 404, { error: 'Not found' });

      const name = existing.protected ? existing.name : body.name ?? existing.name;
      const accent = body.accent ?? existing.accent;
      const bg = body.bg ?? existing.bg;

      try {
        const { rows } = await pool.query(
          'update game_types set name = $1, accent = $2, bg = $3 where id = $4 returning *',
          [name, accent, bg, id]
        );
        sendJson(res, 200, rows[0]);
      } catch (err) {
        if (err.code === '23505') return sendJson(res, 409, { error: 'A game type with that name already exists' });
        throw err;
      }
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/game-types\/([^/]+)$/,
    handler: async (req, res, [id]) => {
      const { rows: existingRows } = await pool.query('select * from game_types where id = $1', [id]);
      const existing = existingRows[0];
      if (!existing) return sendJson(res, 404, { error: 'Not found' });
      if (existing.protected) return sendJson(res, 400, { error: 'The Unassigned type cannot be deleted' });

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
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/games$/,
    handler: async (req, res, _params, query) => {
      const conditions = [];
      const values = [];

      if (query.get('search')) {
        values.push(`%${query.get('search')}%`);
        conditions.push(`g.title ilike $${values.length}`);
      }
      if (query.get('type_id')) {
        values.push(query.get('type_id'));
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

      const players = query.get('players') ? (query.get('players') === '8+' ? '8+' : Number(query.get('players'))) : null;
      const timeBucket = query.get('time_bucket');

      let filtered = rows;
      if (players) filtered = filtered.filter((g) => playersMatch(g.players, players));
      if (timeBucket) filtered = filtered.filter((g) => timeMatchesBucket(g.time, timeBucket));

      sendJson(res, 200, filtered);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/games\/random$/,
    handler: async (req, res, _params, query) => {
      const conditions = [];
      const values = [];

      if (query.get('type_id')) {
        values.push(query.get('type_id'));
        conditions.push(`g.type_id = $${values.length}`);
      }
      if (query.get('exclude')) {
        const excludeIds = query.get('exclude').split(',').filter(Boolean);
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

      const players = query.get('players') ? (query.get('players') === '8+' ? '8+' : Number(query.get('players'))) : null;
      const timeBucket = query.get('time_bucket');

      let pool_ = rows;
      if (players) pool_ = pool_.filter((g) => playersMatch(g.players, players));
      if (timeBucket) pool_ = pool_.filter((g) => timeMatchesBucket(g.time, timeBucket));

      if (pool_.length === 0) return sendJson(res, 200, { game: null, poolSize: 0 });

      const picked = pool_[Math.floor(Math.random() * pool_.length)];
      sendJson(res, 200, { game: picked, poolSize: pool_.length });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/games\/([^/]+)$/,
    handler: async (req, res, [id]) => {
      const { rows } = await pool.query(
        `select g.*, gt.name as type_name, gt.accent as type_accent, gt.bg as type_bg
         from games g join game_types gt on gt.id = g.type_id
         where g.id = $1`,
        [id]
      );
      if (!rows[0]) return sendJson(res, 404, { error: 'Not found' });
      sendJson(res, 200, rows[0]);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/games$/,
    handler: async (req, res) => {
      const b = await readBody(req);
      if (!b.title || !b.type_id) return sendJson(res, 400, { error: 'title and type_id are required' });
      const { rows } = await pool.query(
        `insert into games (type_id, title, description, players, time, materials, rules, example)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
        [b.type_id, b.title, b.description || null, b.players || null, b.time || null, b.materials || null, b.rules || null, b.example || null]
      );
      sendJson(res, 201, rows[0]);
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/games\/([^/]+)$/,
    handler: async (req, res, [id]) => {
      const b = await readBody(req);
      if (!b.title || !b.type_id) return sendJson(res, 400, { error: 'title and type_id are required' });
      const { rows } = await pool.query(
        `update games set type_id = $1, title = $2, description = $3, players = $4, time = $5, materials = $6, rules = $7, example = $8
         where id = $9 returning *`,
        [b.type_id, b.title, b.description || null, b.players || null, b.time || null, b.materials || null, b.rules || null, b.example || null, id]
      );
      if (!rows[0]) return sendJson(res, 404, { error: 'Not found' });
      sendJson(res, 200, rows[0]);
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/games\/([^/]+)$/,
    handler: async (req, res, [id]) => {
      const { rows } = await pool.query('delete from games where id = $1 returning id', [id]);
      if (!rows[0]) return sendJson(res, 404, { error: 'Not found' });
      sendJson(res, 200, { ok: true });
    },
  },

  // Per-game user state: favorited, played, and rated. No accounts in this
  // app, so these are single shared lists rather than scoped to a user — same
  // as games and game_types. Each table cascades off games(id).
  {
    method: 'GET',
    pattern: /^\/api\/favorites$/,
    handler: async (req, res) => {
      const { rows } = await pool.query('select game_id from game_favorites');
      sendJson(res, 200, rows.map((r) => r.game_id));
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/favorites\/([^/]+)$/,
    handler: async (req, res, [gameId]) => {
      await pool.query('insert into game_favorites (game_id) values ($1) on conflict (game_id) do nothing', [gameId]);
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/favorites\/([^/]+)$/,
    handler: async (req, res, [gameId]) => {
      await pool.query('delete from game_favorites where game_id = $1', [gameId]);
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/played$/,
    handler: async (req, res) => {
      const { rows } = await pool.query('select game_id from game_played');
      sendJson(res, 200, rows.map((r) => r.game_id));
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/played\/([^/]+)$/,
    handler: async (req, res, [gameId]) => {
      await pool.query('insert into game_played (game_id) values ($1) on conflict (game_id) do nothing', [gameId]);
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/played\/([^/]+)$/,
    handler: async (req, res, [gameId]) => {
      await pool.query('delete from game_played where game_id = $1', [gameId]);
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/ratings$/,
    handler: async (req, res) => {
      const { rows } = await pool.query('select game_id, rating from game_ratings');
      sendJson(res, 200, Object.fromEntries(rows.map((r) => [r.game_id, Number(r.rating)])));
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/ratings\/([^/]+)$/,
    handler: async (req, res, [gameId]) => {
      const { rating } = await readBody(req);
      if (typeof rating !== 'number' || rating < 0.5 || rating > 5) {
        return sendJson(res, 400, { error: 'rating must be a number between 0.5 and 5' });
      }
      await pool.query(
        `insert into game_ratings (game_id, rating) values ($1, $2)
         on conflict (game_id) do update set rating = excluded.rating`,
        [gameId, rating]
      );
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/ratings\/([^/]+)$/,
    handler: async (req, res, [gameId]) => {
      await pool.query('delete from game_ratings where game_id = $1', [gameId]);
      sendJson(res, 200, { ok: true });
    },
  },
];

export function apiMiddlewarePlugin() {
  return {
    name: 'games-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost');
        const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));

        if (!route) return sendJson(res, 404, { error: 'No such route' });

        try {
          const match = url.pathname.match(route.pattern);
          const params = match.slice(1);
          await route.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: err.message || 'Internal server error' });
        }
      });
    },
  };
}
