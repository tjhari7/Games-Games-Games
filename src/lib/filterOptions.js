import { playersMatchesAny, timeMatchesAnyBucket } from './gameMatch.js';

export const PLAYER_OPTIONS = [2, 3, 4, 5, 6, 7, '8+'];

export const TIME_OPTIONS = [
  { value: '5min', label: '5 min' },
  { value: '10min', label: '10 min' },
  { value: '15min', label: '15 min' },
  { value: '20min', label: '20 min' },
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

// The filter drawer disables — rather than hides — a Players or Time option
// that would return nothing given everything else currently selected. These
// count, per option, how many of `games` it would keep. Pass a `games` list
// already narrowed by the OTHER filter groups (type, the other of
// players/time, favorites) but NOT by this option's own group, so a chip that
// is already picked never reads as 0 and stays toggleable. A count of 0 tells
// the drawer to render that option disabled.
export function playerOptionCounts(games) {
  const counts = {};
  for (const n of PLAYER_OPTIONS) {
    const val = n === '8+' ? '8+' : n;
    counts[val] = games.filter((g) => playersMatchesAny(g.players, String(val))).length;
  }
  return counts;
}

export function timeOptionCounts(games) {
  const counts = {};
  for (const opt of TIME_OPTIONS) {
    counts[opt.value] = games.filter((g) => timeMatchesAnyBucket(g.time, opt.value)).length;
  }
  return counts;
}
