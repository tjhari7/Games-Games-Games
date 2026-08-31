import drawingIcon from '../assets/Drawing_01.svg';
import actOutIcon from '../assets/Act_Out_01.svg';
import cardIcon from '../assets/Card_01.svg';
import wordIcon from '../assets/Word_01.svg';
import challengeIcon from '../assets/Challenge_01.svg';
import deductionIcon from '../assets/Deduction_01.svg';
import drinkingIcon from '../assets/Drinking_01.svg';
import favoritesIcon from '../assets/Favorites_01.svg';
import guessingIcon from '../assets/Guessing_01.svg';
import questionIcon from '../assets/Question_01.svg';
import soundIcon from '../assets/Sound_01.svg';
import votingIcon from '../assets/Voting_01.svg';
import writingIcon from '../assets/Writing_01.svg';
import teamIcon from '../assets/Team_01.svg';
import improvIcon from '../assets/Improv_01.svg';
import taskmasterIcon from '../assets/Task Master_01.svg';

// Real per-type artwork, one file per type in src/assets/Icons/, each drawn into
// a 100x100 box with the subject ~64 units across its dominant axis and centred,
// so the toss arc and centre of rotation stay art-independent.
import tossActOut from '../assets/Icons/Games_Icon_ActOut_01.svg';
import tossImprov from '../assets/Icons/Games_Icon_Improv_01.svg';
import tossDrawing from '../assets/Icons/Games_Icon_Drawing_01.svg';
import tossCard from '../assets/Icons/Games_Icon_Card_01.svg';
import tossQuestion from '../assets/Icons/Games_Icon_Question_01.svg';
import tossTaskmaster from '../assets/Icons/Games_Icon_TaskMaster_01.svg';
import tossGuess from '../assets/Icons/Games_Icon_Guessing_01.svg';
import tossWord from '../assets/Icons/Games_Icon_Word_01.svg';
import tossDeduction from '../assets/Icons/Games_Icon_Deduction_01.svg';
import tossWrite from '../assets/Icons/Games_Icon_Writing_01.svg';
import tossSound from '../assets/Icons/Games_Icon_Sound_01.svg';
import tossVote from '../assets/Icons/Games_Icon_Voting_02.svg';
import tossTeam from '../assets/Icons/Games_Icon_Team_01.svg';
import tossChallenge from '../assets/Icons/Games_Icon_Challenge_01.svg';
import tossDrinking from '../assets/Icons/Games_Icon_Drinking_01.svg';
import tossFavorites from '../assets/Icons/Games_Icon_Favorites_01.svg';

// The types the wordmark artwork was drawn for. Everything else falls through to
// its name set as text, which is what the tiles render when there is no icon.
export const TYPE_ICONS = {
  Drawing: drawingIcon,
  'Act Out': actOutIcon,
  Card: cardIcon,
  Word: wordIcon,
  Improv: improvIcon,
  Taskmaster: taskmasterIcon,
  Challenge: challengeIcon,
  Deduction: deductionIcon,
  Drinking: drinkingIcon,
  Favorites: favoritesIcon,
  Guessing: guessingIcon,
  Question: questionIcon,
  Sound: soundIcon,
  Voting: votingIcon,
  Writing: writingIcon,
  Team: teamIcon,
};

// The square artwork thrown up behind Home's Play A Game button — a separate set
// from TYPE_ICONS above, which are the wide wordmarks the drawer tiles wear.
//
// Every entry now carries real per-type artwork (src/assets/Icons/), drawn into a
// 100x100 box with the subject ~64 units across its dominant axis and centred, so
// the arc and centre of rotation stay art-independent. Replacing one is just
// overwriting its file — nothing here or in HomeContent.jsx needs to change, and
// artwork can be any shape or number of colours (a King Card for Card, say),
// because the animation only ever positions and rotates a 100x100 box.
//
// The colour lives in the file, not in typeColors.js: recolouring a type in
// typeColors.js will not follow through to its icon, so the two are kept in step
// by hand.
export const TYPE_TOSS_ICONS = {
  'Act Out': tossActOut,
  Improv: tossImprov,
  Drawing: tossDrawing,
  Card: tossCard,
  Question: tossQuestion,
  Taskmaster: tossTaskmaster,
  Guessing: tossGuess,
  Word: tossWord,
  Deduction: tossDeduction,
  Writing: tossWrite,
  Sound: tossSound,
  Voting: tossVote,
  Team: tossTeam,
  Challenge: tossChallenge,
  Drinking: tossDrinking,
  Favorites: tossFavorites,
};

// The default toss spin magnitude, in degrees — the quarter-turn tumble the
// symmetric dice wear. buildThrows (HomeContent.jsx) picks the sign by launch
// side; this is only how far.
export const TOSS_SPIN_DEFAULT = 45;

// Per-type override of that magnitude. Anything unlisted falls back to
// TOSS_SPIN_DEFAULT. Dial an entry down toward 0 to land that icon closer to
// upright — useful now that the real (asymmetric) artwork rests visibly, unlike
// the four-fold-symmetric dice it replaced.
export const TYPE_TOSS_SPIN = {
  Card: 67,
  Drawing: 35,
  Challenge: 67,
  Favorites: 67,
  Taskmaster: 67,
  'Act Out': 60,
  Deduction: 45,
  Drinking: 67,
  Sound: 67,
  Voting: 45,
  Improv: 60,
  Guessing: 67,
  Question: 45,
  Team: 35,
  Word: 35,
  Writing: 67,
};

// The six wearing wordmark artwork, listed first in the sheet. Five spell their
// own name; Taskmaster rides with them, and Card/Word/Act Out fill the pair.
export const HOME_TYPE_ORDER = ['Drawing', 'Improv', 'Card', 'Word', 'Act Out', 'Taskmaster'];

// Everything, in the exact order the Game Types sheet lists it (Figma node
// 1865-1740). Explicit rather than alphabetical — the layout is designed, not
// sorted. Favorites is appended by the sheet itself, so it is not listed here.
export const ALL_TYPE_ORDER = [
  'Drawing',
  'Improv',
  'Card',
  'Word',
  'Act Out',
  'Taskmaster',
  'Writing',
  'Sound',
  'Team',
  'Guessing',
  'Drinking',
  'Question',
  'Deduction',
  'Voting',
  'Challenge',
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
