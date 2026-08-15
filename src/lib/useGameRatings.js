import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Star rating per game, keyed by game id, in half-star steps (0.5–5). Mirrors
// useFavoriteGames.js / useMarkedPlayed.js, but stores a number per id rather
// than membership in a set — see useFavoriteGames.js for why this is
// server-backed with a module-level cache and subscriber list rather than
// localStorage.
//
// The card carousel and the list view can both be mounted on the same page
// (view mode toggle), each with their own useState. A rating picked in one
// needs to show up in the other without a remount, so every mounted instance
// subscribes here and is pushed the new value on write.
let current = {};
let loadPromise = null;
let localMutated = false;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn(current));
}

function load() {
  if (loadPromise) return loadPromise;
  loadPromise = api
    .getRatings()
    .then((ratings) => {
      if (!localMutated) current = ratings && typeof ratings === 'object' ? ratings : {};
      notify();
    })
    .catch((err) => {
      console.error('Failed to load ratings', err);
      notify();
    });
  return loadPromise;
}

export function useGameRatings() {
  const [ratings, setRatings] = useState(current);

  useEffect(() => {
    subscribers.add(setRatings);
    load();
    return () => subscribers.delete(setRatings);
  }, []);

  const getRating = useCallback((id) => ratings[id] || 0, [ratings]);

  const setRating = useCallback((id, value) => {
    localMutated = true;
    const next = { ...current };
    if (value > 0) next[id] = value;
    else delete next[id];
    current = next;
    notify();
    (value > 0 ? api.putRating(id, value) : api.deleteRating(id)).catch((err) => {
      console.error('Failed to persist rating', err);
    });
  }, []);

  return { getRating, setRating };
}
