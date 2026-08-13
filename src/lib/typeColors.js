// Bright display colors for game-type pills and the homepage category buttons.
// Keyed by type name (case-insensitive). Falls back to the type's stored bg
// color for any custom types not listed here.
const TYPE_PILL_COLORS = {
  'act out': '#E4FFBB',
  improv: '#FFCF75',
  drawing: '#C0F2FF',
  card: '#FFA3E3',
  talking: '#B1BFFF',
  taskmaster: '#FE9CA4',
  'task master': '#FE9CA4',
  guess: '#A8E6D4',
  word: '#F5C99B',
  deduce: '#C4B5E8',
  write: '#9BC9F0',
  sound: '#F2A9C4',
  vote: '#D4E89B',
  team: '#8FD4E8',
  sense: '#E8B5D4',
  // Nudged yellower than the spec's #F0D48A wheat, which sat 5° off Improv's
  // amber at the same lightness and read as the same colour beside it.
  endure: '#F2E3A2',
  rank: '#B5D9A8',
  persona: '#E0A9F0',
};

// Black text sits on the bright pill/button backgrounds.
export const TYPE_TEXT_COLOR = '#1a1816';

export function typePillColor(name, fallback = null) {
  if (!name) return fallback;
  return TYPE_PILL_COLORS[name.trim().toLowerCase()] || fallback;
}
