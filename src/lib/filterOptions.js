export const PLAYER_OPTIONS = [2, 3, 4, 5, 6, 7, '8+'];

export const TIME_OPTIONS = [
  { value: '5min', label: '5 min' },
  { value: '10min', label: '10 min' },
  { value: '15min', label: '15 min' },
  { value: '30plus', label: '30+ min' },
];

// Players and time are both multi-select: the state is an array of chosen
// values (empty = no filter), and a game matches if it fits *any* one of them.
// These format a single chosen value for the active-filter chip row, shared by
// the three list pages so the wording stays identical.
export function playersChipLabel(value) {
  return value === '8+' ? '8+ Players' : `${value} Players`;
}

export function timeChipLabel(value) {
  return TIME_OPTIONS.find((o) => o.value === value)?.label;
}
