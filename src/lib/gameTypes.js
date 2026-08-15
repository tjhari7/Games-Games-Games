import drawingIcon from '../assets/Drawing_01.svg';
import actOutIcon from '../assets/Act_Out_01.svg';
import cardIcon from '../assets/Card_01.svg';
import improvIcon from '../assets/Improv_01.svg';
import talkingIcon from '../assets/Talking_01.svg';
import taskmasterIcon from '../assets/Task Master_01.svg';

import tossActOut from '../assets/Games_Icon_Act_Out_01.svg';
import tossImprov from '../assets/Games_Icon_Improv_01.svg';
import tossDrawing from '../assets/Games_Icon_Drawing_01.svg';
import tossCard from '../assets/Games_Icon_Card_01.svg';
import tossTalking from '../assets/Games_Icon_Talking_01.svg';
import tossTaskmaster from '../assets/Games_Icon_Taskmaster_01.svg';
import tossGuess from '../assets/Games_Icon_Guess_01.svg';
import tossWord from '../assets/Games_Icon_Word_01.svg';
import tossDeduce from '../assets/Games_Icon_Deduce_01.svg';
import tossWrite from '../assets/Games_Icon_Write_01.svg';
import tossSound from '../assets/Games_Icon_Sound_01.svg';
import tossVote from '../assets/Games_Icon_Vote_01.svg';
import tossTeam from '../assets/Games_Icon_Team_01.svg';
import tossSense from '../assets/Games_Icon_Sense_01.svg';
import tossEndure from '../assets/Games_Icon_Endure_01.svg';
import tossRank from '../assets/Games_Icon_Rank_01.svg';
import tossPersona from '../assets/Games_Icon_Persona_01.svg';
import tossFavorites from '../assets/Games_Icon_Favorites_01.svg';

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

// The square artwork thrown up behind Home's Play A Game button — a separate set
// from TYPE_ICONS above, which are the wide wordmarks the drawer tiles wear.
//
// Every entry is currently a placeholder: the die from Games_Icon_Dice_01.svg
// recoloured to match that type's drawer tile, so the throw reads as the app's
// palette until real per-type artwork exists. Replacing one is just overwriting
// its file — nothing here or in HomeContent.jsx needs to change, and artwork can
// be any shape or number of colours (a King Card for Card, say), because the
// animation only ever positions and rotates a 100x100 box.
//
// The colour lives in the file, not in typeColors.js: recolouring a drawer tile
// will not follow through to its icon, so the two are kept in step by hand while
// these remain stand-ins.
export const TYPE_TOSS_ICONS = {
  'Act Out': tossActOut,
  Improv: tossImprov,
  Drawing: tossDrawing,
  Card: tossCard,
  Talking: tossTalking,
  Taskmaster: tossTaskmaster,
  Guess: tossGuess,
  Word: tossWord,
  Deduce: tossDeduce,
  Write: tossWrite,
  Sound: tossSound,
  Vote: tossVote,
  Team: tossTeam,
  Sense: tossSense,
  Endure: tossEndure,
  Rank: tossRank,
  Persona: tossPersona,
  Favorites: tossFavorites,
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
