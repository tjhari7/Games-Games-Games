import { CARD_VIEW, LIST_VIEW } from '../lib/useGameViewMode.js';
import CardsHorizontal from '../assets/cards_horizontal.svg?react';
import CardsVertical from '../assets/cards_vertical.svg?react';

// Shows the view it will switch *to*, the way Letterboxd's does: a stack of
// cards while you're reading a list, a list while you're flicking through cards.
//
// Uses the hand-drawn cards_horizontal / cards_vertical pair (24px, inherits
// `currentColor` via the .icon class) on every screen that carries the toggle —
// the game type pages and Favorites.
export default function ViewModeToggle({ mode, onChange }) {
  const cards = mode === CARD_VIEW;
  const Glyph = cards ? CardsHorizontal : CardsVertical;
  return (
    <button
      className="icon-btn"
      type="button"
      onClick={() => onChange(cards ? LIST_VIEW : CARD_VIEW)}
      aria-label={cards ? 'Switch to list view' : 'Switch to card view'}
    >
      <Glyph className="icon" aria-hidden="true" />
    </button>
  );
}
