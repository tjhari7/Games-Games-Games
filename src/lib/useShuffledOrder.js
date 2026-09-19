import { useCallback, useRef } from 'react';
import { useNavigationType } from 'react-router-dom';

// A random order for the card view, so opening a game type doesn't always start
// on the same game. The list view stays alphabetical; this is only ever applied
// to the cards.
//
// The order is decided when the page opens and then held for as long as it is
// open — flipping between list and cards, or rating and favouriting, never
// reshuffles. Closing the page and opening it again does. Coming *back* to it
// from a game's details (a history POP) keeps the same order, so a card tapped
// into and read is still in the same place in the deck afterwards.
//
// Kept per page (`key`) in a module-level map because a page's own state does not
// survive the trip into a game and back.
const saved = new Map();

function shuffle(items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Returns a function that puts a list of games into this visit's order. Games
// the order has not seen yet — the list arriving after the first render, or a
// game added meanwhile — are shuffled in at the end instead of reshuffling the
// deck under the reader.
export function useShuffledOrder(key) {
  const navigationType = useNavigationType();
  const orderRef = useRef(null);

  if (orderRef.current === null) {
    orderRef.current = navigationType === 'POP' && saved.has(key) ? saved.get(key) : [];
    saved.set(key, orderRef.current);
  }

  return useCallback((games) => {
    const order = orderRef.current;
    const known = new Set(order);
    const unseen = games.filter((g) => !known.has(g.id));
    if (unseen.length > 0) order.push(...shuffle(unseen).map((g) => g.id));
    const rank = new Map(order.map((id, i) => [id, i]));
    return games.slice().sort((a, b) => rank.get(a.id) - rank.get(b.id));
  }, []);
}
