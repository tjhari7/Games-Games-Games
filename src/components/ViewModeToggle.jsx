import { CARD_VIEW, LIST_VIEW } from '../lib/useGameViewMode.js';

// Shows the view it will switch *to*, the way Letterboxd's does: a stack of
// cards while you're reading a list, a list while you're flicking through cards.
export default function ViewModeToggle({ mode, onChange }) {
  const cards = mode === CARD_VIEW;
  return (
    <button
      className="icon-btn"
      type="button"
      onClick={() => onChange(cards ? LIST_VIEW : CARD_VIEW)}
      aria-label={cards ? 'Switch to list view' : 'Switch to card view'}
    >
      <span className="material-symbols-outlined">{cards ? 'format_list_bulleted' : 'web_stories'}</span>
    </button>
  );
}
