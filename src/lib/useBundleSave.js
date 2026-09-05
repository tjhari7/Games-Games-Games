import { useCallback, useEffect, useState } from 'react';

// "Saving" a bundle on Discover is a front-of-house gesture only. Discover is a
// faked social surface laid over the real catalog, so this deliberately does NOT
// favorite the bundle's games or write anything to the server — the heart on a
// game card never moves because a bundle was saved. It just remembers, for this
// session, which bundle cards have been tapped, so the button reads the same on
// both Discover rails and the full Bundles list. A reload resets it.
//
// Same module-singleton + subscriber shape as useFavoriteGames (minus the
// network), so every mounted card re-renders when any one of them toggles.
let saved = new Set();
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn(saved));
}

export function useBundleSave() {
  const [savedIds, setSavedIds] = useState(saved);

  useEffect(() => {
    subscribers.add(setSavedIds);
    return () => subscribers.delete(setSavedIds);
  }, []);

  const isBundleSaved = useCallback((bundleId) => savedIds.has(bundleId), [savedIds]);

  const toggleBundleSave = useCallback((bundleId) => {
    const next = new Set(saved);
    if (next.has(bundleId)) next.delete(bundleId);
    else next.add(bundleId);
    saved = next;
    notify();
  }, []);

  return { isBundleSaved, toggleBundleSave };
}
