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
};

// Black text sits on the bright pill/button backgrounds.
export const TYPE_TEXT_COLOR = '#1a1816';

export function typePillColor(name, fallback = null) {
  if (!name) return fallback;
  return TYPE_PILL_COLORS[name.trim().toLowerCase()] || fallback;
}
