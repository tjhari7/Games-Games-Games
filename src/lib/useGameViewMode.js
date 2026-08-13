import { useCallback, useState } from 'react';

// How the game lists are drawn: a scrolling list, or one card at a time in a
// swipeable carousel. One preference for the whole app — flipping Act Out to
// cards means Talking opens in cards too.
export const LIST_VIEW = 'list';
export const CARD_VIEW = 'cards';

const STORAGE_KEY = 'games:viewMode';

// Mirrored in a module variable as well as localStorage so a page can render in
// the right view on its very first paint, rather than flashing the list and
// switching after mount.
let current = null;

function read() {
  if (current) return current;
  try {
    current = localStorage.getItem(STORAGE_KEY) === CARD_VIEW ? CARD_VIEW : LIST_VIEW;
  } catch {
    // Storage can be unavailable (private browsing, blocked cookies). The
    // preference just doesn't outlive the session then.
    current = LIST_VIEW;
  }
  return current;
}

export function useGameViewMode() {
  const [mode, setMode] = useState(read);

  const change = useCallback((next) => {
    current = next;
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* see read() */
    }
  }, []);

  return [mode, change];
}
