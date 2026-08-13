import drawingIcon from '../assets/Drawing_01.svg';
import actOutIcon from '../assets/Act_Out_01.svg';
import cardIcon from '../assets/Card_01.svg';
import improvIcon from '../assets/Improv_01.svg';
import talkingIcon from '../assets/Talking_01.svg';
import taskmasterIcon from '../assets/Task Master_01.svg';

// The types the wordmark artwork was drawn for. Everything else falls through to
// its name set as text, which is what the tiles render when there is no icon.
export const TYPE_ICONS = {
  Drawing: drawingIcon,
  'Act Out': actOutIcon,
  Card: cardIcon,
  Improv: improvIcon,
  Talking: talkingIcon,
  Taskmaster: taskmasterIcon,
};

// The six on Home's grid — the ones with artwork.
export const HOME_TYPE_ORDER = ['Act Out', 'Improv', 'Drawing', 'Card', 'Talking', 'Taskmaster'];

// Everything, in the order the Game Types sheet lists it: the six from Home
// first, then the rest. Pinned rather than alphabetical, which would interleave
// the two groups.
export const ALL_TYPE_ORDER = [
  ...HOME_TYPE_ORDER,
  'Guess',
  'Word',
  'Deduce',
  'Write',
  'Sound',
  'Vote',
  'Team',
  'Sense',
  'Endure',
  'Rank',
  'Persona',
];

/**
 * Picks the types named in `order` out of the API's list, in that order.
 * `includeUnlisted` appends anything left over — custom types the user has
 * added since — so a page meant to show everything doesn't quietly drop them.
 */
export function orderTypes(types, order, { includeUnlisted = false } = {}) {
  const byName = new Map(types.map((t) => [t.name, t]));
  const listed = order.map((name) => byName.get(name)).filter(Boolean);
  if (!includeUnlisted) return listed;
  return [...listed, ...types.filter((t) => !order.includes(t.name))];
}
