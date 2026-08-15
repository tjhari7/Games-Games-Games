import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Which games have been marked as played, keyed by game id. Mirrors
// useFavoriteGames.js — see that file for why this is server-backed with a
// module-level cache and subscriber list rather than localStorage.
let current = new Set();
let loadPromise = null;
let localMutated = false;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn(current));
}

function load() {
  if (loadPromise) return loadPromise;
  loadPromise = api
    .getPlayed()
    .then((ids) => {
      if (!localMutated) current = new Set(ids);
      notify();
    })
    .catch((err) => {
      console.error('Failed to load played games', err);
      notify();
    });
  return loadPromise;
}

export function useMarkedPlayed() {
  const [played, setPlayed] = useState(current);

  useEffect(() => {
    subscribers.add(setPlayed);
    load();
    return () => subscribers.delete(setPlayed);
  }, []);

  const isPlayed = useCallback((id) => played.has(id), [played]);

  const togglePlayed = useCallback((id) => {
    localMutated = true;
    const next = new Set(current);
    const willPlay = !next.has(id);
    if (willPlay) next.add(id);
    else next.delete(id);
    current = next;
    notify();
    (willPlay ? api.putPlayed(id) : api.deletePlayed(id)).catch((err) => {
      console.error('Failed to persist played state', err);
    });
  }, []);

  return { isPlayed, togglePlayed };
}
