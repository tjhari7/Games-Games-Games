import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Which games are favorited, keyed by game id. Used to live in localStorage,
// which ties it to one browser origin — a dev server coming up on a
// different port, or a cleared cache, silently wiped it. Persisted
// server-side now, in the same database the games themselves live in, as a
// single shared list (this app has no accounts to scope it to).
//
// Mirrored in a module variable, same reasoning as before: lets every
// mounted component read the current set without waiting on its own fetch.
// Loading is a network round trip now though, so every instance has to
// *subscribe* to be told when the shared fetch resolves or another instance
// toggles something — a plain module variable can't push a re-render to a
// component that didn't cause the change.
let current = new Set();
let loadPromise = null;
// True once anything has changed `current` locally (a toggle). Guards the one
// race this setup has: the initial load is still in flight, the user taps a
// favorite before it resolves (the optimistic update lands immediately), and
// the load's now-stale response would otherwise overwrite that change back
// out once it finally arrives.
let localMutated = false;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn(current));
}

function load() {
  if (loadPromise) return loadPromise;
  loadPromise = api
    .getFavorites()
    .then((ids) => {
      if (!localMutated) current = new Set(ids);
      notify();
    })
    .catch((err) => {
      console.error('Failed to load favorites', err);
      notify();
    });
  return loadPromise;
}

export function useFavoriteGames() {
  const [favorites, setFavorites] = useState(current);

  useEffect(() => {
    subscribers.add(setFavorites);
    load();
    return () => subscribers.delete(setFavorites);
  }, []);

  const isFavorite = useCallback((id) => favorites.has(id), [favorites]);

  const toggleFavorite = useCallback((id) => {
    localMutated = true;
    const next = new Set(current);
    const willFavorite = !next.has(id);
    if (willFavorite) next.add(id);
    else next.delete(id);
    current = next;
    notify();
    (willFavorite ? api.putFavorite(id) : api.deleteFavorite(id)).catch((err) => {
      console.error('Failed to persist favorite', err);
    });
  }, []);

  return { isFavorite, toggleFavorite };
}
