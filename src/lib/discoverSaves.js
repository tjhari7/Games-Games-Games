import { useCallback, useEffect, useState } from 'react';

// The shared "saved" state for the whole Discover flow — the Bundles rails, the
// full Bundles list, a bundle's detail page, and the game cards on all of them.
//
// Discover is a faked social surface laid over the real catalog, so this
// deliberately does NOT favorite anything or write to the server — the heart on
// a real game card never moves because something was saved here. It just
// remembers, for one visit, which game cards have been tapped.
//
// Only games are tracked. A bundle counts as "saved" when every game in it is
// saved — "Save Bundle" is a Save All. So saving a bundle ticks all its game
// cards, and unsaving any one of them drops the bundle back to unsaved, on the
// card and its detail page alike.
//
// It lives at module scope (not in a component) so the state survives the route
// change from /discover to /discover/bundles/:id and back. `resetDiscoverSaves`
// is called when navigation leaves the /discover subtree — that's the only
// thing that clears it (see <DiscoverSavesReset> in App.jsx). A reload clears it
// too, since the module reloads.
//
// Same module-singleton + subscriber shape as useFavoriteGames (minus the
// network), so every mounted card re-renders when any one of them toggles.
let savedGames = new Set();
const subscribers = new Set();

function notify() {
  // Hand out a fresh Set so useState identity checks see the change.
  subscribers.forEach((fn) => fn(savedGames));
}

export function resetDiscoverSaves() {
  if (savedGames.size === 0) return;
  savedGames = new Set();
  notify();
}

export function useDiscoverSaves() {
  const [saved, setSaved] = useState(savedGames);

  useEffect(() => {
    subscribers.add(setSaved);
    // Re-sync in case a reset landed between render and subscribe.
    setSaved(savedGames);
    return () => subscribers.delete(setSaved);
  }, []);

  const isGameSaved = useCallback((id) => saved.has(id), [saved]);

  const toggleGameSave = useCallback((id) => {
    const next = new Set(savedGames);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    savedGames = next;
    notify();
  }, []);

  // A bundle is saved when it has games and all of them are saved.
  const isBundleSaved = useCallback(
    (gameIds) => gameIds.length > 0 && gameIds.every((id) => saved.has(id)),
    [saved],
  );

  // Save All / clear all, in one notify: if the bundle is already fully saved,
  // tapping removes every one of its games; otherwise it adds the missing ones.
  const toggleBundleSave = useCallback((gameIds) => {
    if (gameIds.length === 0) return;
    const next = new Set(savedGames);
    const allSaved = gameIds.every((id) => next.has(id));
    gameIds.forEach((id) => (allSaved ? next.delete(id) : next.add(id)));
    savedGames = next;
    notify();
  }, []);

  return { isGameSaved, isBundleSaved, toggleGameSave, toggleBundleSave };
}
