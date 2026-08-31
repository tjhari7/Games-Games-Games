import { useEffect, useState } from 'react';

// Pause in typing before a search hits the server. Shared by All Games,
// the type pages and Favorites so they all feel the same.
export const SEARCH_DEBOUNCE_MS = 250;

// Trails `value` by `delay`, so a search box drives one request per pause in
// typing rather than one per keystroke. Filters and view toggles are left
// undebounced on purpose — they change in single, deliberate steps.
export function useDebounced(value, delay) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
