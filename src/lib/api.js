async function request(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Game types rarely change but are fetched on nearly every page (Home, All
// Games, Category). Cache them in memory so repeat visits render instantly
// instead of flashing an empty grid while a fresh request resolves.
let gameTypesCache = null;

// The full, unfiltered games list backs Play A Game and All Games. It's the
// app's biggest payload — a cold fetch runs ~half a second against Supabase —
// so cache it in memory the same way, and let Home warm it on load so the draw
// is ready before the button is even pressed. Only the no-params list is
// cached; filtered/searched queries always go to the server.
let gamesCache = null;

export const api = {
  getGameTypes: async () => {
    const data = await request('/api/game-types');
    gameTypesCache = data;
    return data;
  },
  // Synchronous peek at the cache (null if not loaded yet) so components can
  // seed their initial state and avoid a loading flash on repeat mounts.
  getCachedGameTypes: () => gameTypesCache,
  createGameType: async (body) => {
    const data = await request('/api/game-types', { method: 'POST', body: JSON.stringify(body) });
    gameTypesCache = null;
    return data;
  },
  updateGameType: async (id, body) => {
    const data = await request(`/api/game-types/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    gameTypesCache = null;
    return data;
  },
  deleteGameType: async (id) => {
    const data = await request(`/api/game-types/${id}`, { method: 'DELETE' });
    gameTypesCache = null;
    return data;
  },

  getGames: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const data = await request(`/api/games${qs ? `?${qs}` : ''}`);
    if (!qs) gamesCache = data;
    return data;
  },
  // Synchronous peek at the unfiltered games list (null until loaded once) so
  // Play A Game can seed its deck and skip the loading state on repeat visits.
  getCachedGames: () => gamesCache,
  // The full list carries every game's type_id, so a type page can be answered
  // straight from it — the same rows /api/games?type_id= would return, in the
  // same title order — instead of waiting on a request of its own. Null (not
  // an empty array) when the list hasn't been fetched yet, so callers can tell
  // "no cache" from "this type has no games".
  getCachedGamesByType: (typeId) =>
    gamesCache ? gamesCache.filter((g) => g.type_id === typeId) : null,
  getGame: (id) => request(`/api/games/${id}`),
  drawRandomGame: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/games/random${qs ? `?${qs}` : ''}`);
  },
  createGame: async (body) => {
    const data = await request('/api/games', { method: 'POST', body: JSON.stringify(body) });
    gamesCache = null;
    return data;
  },
  updateGame: async (id, body) => {
    const data = await request(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    gamesCache = null;
    return data;
  },
  deleteGame: async (id) => {
    const data = await request(`/api/games/${id}`, { method: 'DELETE' });
    gamesCache = null;
    return data;
  },

  // Per-game user state — favorited/played/rated. Single shared lists (no
  // accounts in this app), persisted server-side so they survive a dev server
  // restart on a different port or a browser data wipe, unlike the
  // localStorage they used to live in.
  getFavorites: () => request('/api/favorites'),
  putFavorite: (gameId) => request(`/api/favorites/${gameId}`, { method: 'PUT' }),
  deleteFavorite: (gameId) => request(`/api/favorites/${gameId}`, { method: 'DELETE' }),

  getPlayed: () => request('/api/played'),
  putPlayed: (gameId) => request(`/api/played/${gameId}`, { method: 'PUT' }),
  deletePlayed: (gameId) => request(`/api/played/${gameId}`, { method: 'DELETE' }),

  getRatings: () => request('/api/ratings'),
  putRating: (gameId, rating) => request(`/api/ratings/${gameId}`, { method: 'PUT', body: JSON.stringify({ rating }) }),
  deleteRating: (gameId) => request(`/api/ratings/${gameId}`, { method: 'DELETE' }),
};
