// Bright display colors for game-type pills and the homepage category buttons.
// Keyed by type name (case-insensitive). Falls back to the type's stored bg
// color for any custom types not listed here.
// Sampled straight from the Game Types design (Figma node 1865-1740). Listed in
// the sheet's display order; the die thrown behind Home's Play A Game button is
// recoloured to match each entry (one file per type in src/assets), so any
// change here has a matching change in Games_Icon_<type>_01.svg.
const TYPE_PILL_COLORS = {
  drawing: '#E4FFBB',
  improv: '#FFCF75',
  card: '#C0F2FF',
  word: '#FFA3E3',
  'act out': '#B1CEFF',
  taskmaster: '#FE9CA4',
  'task master': '#FE9CA4',
  writing: '#FFE4B3',
  sound: '#B9FFBB',
  team: '#8DD9FF',
  guessing: '#FFF9B5',
  drinking: '#85E8D9',
  question: '#FFC1AA',
  challenge: '#D9B8FE',
  voting: '#AAB0FF',
  // A hair more olive than Drawing's #E4FFBB, so the grid's two greens read as
  // distinct rather than a repeat.
  deduction: '#E4F3AA',
  // Not a real game type — the shortcut tile pinned last on the Game Types
  // sheet.
  favorites: '#FFC2E8',
};

// Black text sits on the bright pill/button backgrounds.
export const TYPE_TEXT_COLOR = '#1a1816';

export function typePillColor(name, fallback = null) {
  if (!name) return fallback;
  return TYPE_PILL_COLORS[name.trim().toLowerCase()] || fallback;
}
