import { typePillColor } from './typeColors.js';

// The "Discover" experience is a faked social layer over the real catalog. There
// are no accounts and nothing is published anywhere — every community game below
// is one of the games already in the database, wearing a made-up "community
// rating" and a made-up "saved by N" count. Bundles are curated groupings of
// those same real games; Game Type Bundles are one bundle per game type, holding
// that type's whole catalog.
//
// Discover surfaces the ENTIRE catalog (all ~85 games). A few dozen titles have
// a hand-tuned rating in COMMUNITY_RATING below; every other game gets a
// deterministic synthesized one (see metaFor) so the page has plenty to work
// with. Saved counts are always synthesized (1.1k–3.5k). The numbers being a bit
// duplicative is fine — this is a case-study prototype, not real data.
//
// The one genuinely real thing Discover does is Save: that calls the existing
// server-backed favorites endpoint (see useFavoriteGames), so a saved game shows
// up on the Favorite Games page and survives a server restart.
//
// Everything here is keyed by game TITLE, not id — the backup/seed data carries
// no stable shared ids across environments, but titles are unique and stable.
// Selectors take the live games array (from api.getGames) and join by title.

// Hand-tuned "community rating" for the "hero" titles — the ones most likely to
// be looked at closely. Every other game falls through to a synthesized rating
// in metaFor(); saved counts are always synthesized.
const COMMUNITY_RATING = {
  Charades: 4.5,
  'Fishbowl (aka Salad Bowl)': 5,
  'Two Truths and a Lie': 4,
  'Wink Murder': 4.5,
  'Mafia / Werewolf': 5,
  'Fake Artist': 4.5,
  'The Thing': 4,
  'Word Imposter': 4.5,
  Psychiatrist: 3.5,
  '20 Questions': 4,
  Contact: 4.5,
  Categories: 4,
  'Fake Definitions': 4.5,
  'Exquisite Corpse': 4.5,
  'Telephone Pictionary': 5,
  'Written Consequences': 4,
  Pictionary: 4.5,
  'One Minute Movie': 4,
  Freeze: 4.5,
  'Yes, And': 4,
  'The Expert': 4,
  'Sit, Stand, Bend': 3.5,
  'Hot Seat': 4,
  'Would You Rather': 4,
  'Most Likely To': 4.5,
  Superlatives: 4,
  'Tier List': 4.5,
  Spectrum: 4,
  'Rank The Room': 3.5,
  'Kings Cup': 4,
  Spoons: 4.5,
  'Snort, Raspberry, Whistle': 3.5,
  'Make Me Laugh': 4,
  'Keep Talking': 4,
  'Blind Taste': 4,
  'Mind Melt': 4.5,
  'Fifteen Seconds': 4,
  'Air Draw': 3.5,
  'Who Am I?': 4,
  'Hold The Pose': 3.5,
};

// Curated packs. `gameTitles` reference real titles; anything not currently in
// the database is skipped by bundleGames(). `accent` is a bright fill the bundle
// hero wears with dark ink (matches the .category-hero-header treatment).
//
// Every game title below appears in exactly ONE curated bundle — the list is a
// clean partition of the whole 85-game catalog, no repeats across bundles. (The
// Game Type Bundles are generated separately and still hold each type's full
// catalog, so a game does show up there too — that's the one intended overlap.)
export const BUNDLES = [
  // Pinned first on Discover. Mostly Act Out with a few Improv games mixed in;
  // it wears the Act Out type colour (typeColors.js `act out`) by request even
  // though it isn't a single-type bundle.
  {
    id: 'onfeet',
    title: 'Up On Your Feet',
    blurb: 'Off the couch and into the middle of the room. Act it out, big gestures, no sitting still.',
    accent: '#B1CEFF',
    saves: 1900,
    gameTitles: ['Charades (Reverse)', 'Scene Switch', 'Half Life', 'Sit, Stand, Bend', "Yes, Let's"],
  },
  {
    id: 'penpaper',
    title: 'Pen & Paper',
    blurb: 'Hand out a pen and a few sheets and you are ready. Great for tables and trains.',
    // Every game in this bundle is a Drawing type, so the hero wears Drawing's
    // green (typeColors.js `drawing`) rather than a bundle-only blue.
    accent: '#E4FFBB',
    saves: 2400,
    gameTitles: ['3 Words Pass', 'Blind Contour', 'Connect The Doodles', 'Draw On Back Draw On Paper', 'Draw What You Hear', 'Exquisite Corpse'],
  },
  {
    id: 'crowd',
    title: 'Icebreakers',
    blurb: 'Big group openers that need zero setup and get everyone talking in the first minute.',
    accent: '#F5C99B',
    saves: 3500,
    gameTitles: ['Two Truths and a Lie', 'Would You Rather', 'Call The Room', 'Most Likely To', 'Superlatives'],
  },
  {
    id: 'sleuths',
    title: 'For Sleuths & Liars',
    blurb: 'Hidden roles, bluffing and quiet accusations. Best with a group that likes to argue.',
    // All six are Deduction games, so the hero takes the Deduction type colour
    // (typeColors.js `deduction`).
    accent: '#E4F3AA',
    saves: 2100,
    gameTitles: ['Wink Murder', 'Mafia / Werewolf', 'Fake Artist', 'Word Imposter', 'The Thing', 'Psychiatrist'],
  },
  {
    id: 'twoplayer',
    title: 'Two Player Night',
    blurb: 'Just the two of you, no teams, no minimum, still a full game.',
    accent: '#B5D9A8',
    saves: 1600,
    gameTitles: ['20 Questions', 'Mind Melt', 'Air Draw', 'Who Am I?', 'Headphones'],
  },
  {
    id: 'novoice',
    title: 'Voice Only',
    blurb: 'No props, no paper, no phones. Works in a car, on a walk, or with the lights off.',
    accent: '#F2A9C4',
    saves: 1300,
    gameTitles: ['Yes, And', 'The Expert', 'Fortunately / Unfortunately', 'Keep Talking', 'Celebrity Interview'],
  },

  // ---- Five more curated packs ("Up On Your Feet" moved to the top) -----
  {
    id: 'table',
    title: 'Around The Table',
    blurb: 'Low-key group games you can play with a fork in one hand and a drink in the other.',
    accent: '#AEB8F0',
    saves: 2800,
    gameTitles: ['Go Fish', 'Spoons', 'Rank The Room', 'Tier List', 'Categories'],
  },
  {
    id: 'deepend',
    title: 'Deep End',
    blurb: 'Questions that actually go somewhere. For groups that would rather talk than compete.',
    accent: '#93D9D0',
    saves: 1200,
    gameTitles: ['Hot Seat', 'I Think, I Feel, I Want, I Need', 'Emotional Rollercoaster', 'Spectrum', 'Two or Three Headed Interview'],
  },
  {
    id: 'nolaugh',
    title: 'Try Not To Laugh',
    blurb: 'Comedy games with one rule: crack up and you are out. You will be out.',
    accent: '#F2B8C8',
    saves: 3100,
    gameTitles: ['Make Me Laugh', "Don't Laugh", 'Movie Plot', 'Bad Haiku', 'Gibberish Interpreter', 'Slide Show'],
  },
  {
    id: 'winddown',
    title: 'Wind Down',
    blurb: 'Slower, quieter games for the end of the night, when nobody wants to stand up again.',
    accent: '#C9C2E8',
    saves: 1500,
    gameTitles: ['One Word Story', 'One Line', 'Last Letter, First Letter', 'Written Consequences', 'Anonymous Answers'],
  },
  {
    id: 'bigroom',
    title: 'The More The Merrier',
    blurb: 'Built for a packed room. The bigger the group gets, the better these ones play.',
    accent: '#F0D68C',
    saves: 3300,
    gameTitles: ['Fishbowl (aka Salad Bowl)', 'Human Knot', 'Match Categories Team Game', 'Hum That Tune', 'Contact'],
  },

  // ---- Length series (kept last) -----------------------------------------
  // One bundle per rough play-time bucket, so "we've got about X minutes" maps
  // straight to a shelf. Runs shortest to longest, ending on 30 min.
  {
    id: 'time5',
    title: '5 min Games',
    blurb: 'Quick hits for the time left over, each one wrapping up in five minutes or less.',
    accent: '#A8E6D4',
    saves: 2600,
    gameTitles: ['One Minute Movie', 'Snort, Raspberry, Whistle', 'Fifteen Seconds', 'Hold The Pose', 'Paper Airplane Distance', 'Tallest Tower'],
  },
  {
    id: 'time10',
    title: '10 min Games',
    blurb: 'One round, ten minutes, done — the sweet spot when you want a game but not a commitment.',
    accent: '#B8E0C8',
    saves: 1800,
    gameTitles: ['Mystery Monster', 'Kings Cup', 'Foley', 'Best Use Of', 'Volcano'],
  },
  {
    id: 'time15',
    title: '15 min Games',
    blurb: 'Long enough to get good at, short enough to play three. The default group length.',
    accent: '#EFE196',
    saves: 2900,
    gameTitles: ['Knuckle Tattoos', 'Mystery Box', 'Smell Test', 'Guess The Noise', 'Banned Words'],
  },
  {
    id: 'time20',
    title: '20 min Games',
    blurb: 'A proper round with room to build. Good for once the night has actually settled in.',
    accent: '#F6BE9C',
    saves: 1400,
    gameTitles: ['Blind Taste', 'Endowment', 'Describe It', 'Match The Majority', 'Freeze'],
  },
  {
    id: 'time30',
    title: '30 min Games',
    blurb: 'The long haul — teams, scoring and a real arc. Start these early in the night.',
    accent: '#D6B3E0',
    saves: 1100,
    gameTitles: ['Charades', 'Pictionary', 'Telephone Pictionary', 'Character Swap', 'Secret Trait', 'Fake Definitions'],
  },
];

// Deterministic FNV-1a hash of a title, so a game's synthesized social numbers
// are stable from render to render (and run to run) rather than jumping around.
function hashTitle(title) {
  let h = 2166136261;
  for (let i = 0; i < title.length; i += 1) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Weighted toward the 4–4.5 middle so the synthesized part of the catalog still
// reads as plausibly curated rather than uniformly five stars.
const SYNTH_RATINGS = [3.5, 4, 4, 4, 4.5, 4.5, 4.5, 5];

// A game's made-up "community rating" (hand-tuned when we have one, otherwise a
// stable synthesized pick) and its made-up saved count (always synthesized,
// 1100–3499 so it renders as 1.1k–3.5k).
export function metaFor(title) {
  const h = hashTitle(title);
  return {
    communityRating: COMMUNITY_RATING[title] ?? SYNTH_RATINGS[(h >>> 3) % SYNTH_RATINGS.length],
    savedCount: 1100 + ((h >>> 6) % 2400),
  };
}

// Render a saved count as a short "1.1k" style string (always one decimal).
export function formatSaves(count) {
  return `${(count / 1000).toFixed(1)}k`;
}

// Displayed saved counts for the Top 10 Games list — a clean descending ladder
// (index 0 = most saved) so the list reads as a ranking, not a pile.
export const TOP_SAVES = [3500, 3300, 3000, 2700, 2500, 2200, 2000, 1700, 1400, 1100];

// Prefix marking a synthetic "one whole game type" bundle. getBundle can't build
// one on its own (it has no types list) — the caller passes the type in via
// typeBundle(); bundleGames resolves the games straight off the id.
export const TYPE_BUNDLE_PREFIX = 'type-';

export function isTypeBundleId(id) {
  return typeof id === 'string' && id.startsWith(TYPE_BUNDLE_PREFIX);
}

// The blurb on a Game Type Bundle card — a taste of what that kind of game
// actually plays like, second person and a little loud, not an inventory note.
// Keyed by type name; a custom type the user has added since falls back to the
// generic line in typeBundle().
export const TYPE_BUNDLE_BLURBS = {
  Drawing: "Grab a pen and some paper — you're about to draw your heart out, badly and proudly.",
  Improv: 'No script, no plan. Say yes, jump in, and build the scene as you go.',
  Card: 'Shuffle up. A deck, a handful of rules, and a table full of people ready to bluff.',
  Word: "Clues, letters and near-misses, all played in the gap between what you can and can't say.",
  'Act Out': 'Off the couch. You play these with your whole body and not a single word.',
  Taskmaster: 'Silly missions, strict judging, points that make no sense. Do the task, defend your answer.',
  Writing: 'Everyone gets a pen and a secret. Fold it over, pass it on, read it back later and howl.',
  Sound: 'Hums, buzzes and dodgy accents — games you play with your ears instead of your eyes.',
  Team: 'Pick sides. These only click when a partner can read your mind from across the room.',
  Guessing: 'One person knows, everyone else is fishing. Ask, narrow it down, blurt it out first.',
  Drinking: 'House rules, forfeits and a drink in hand. Best played loud and a little reckless.',
  Question: "Just questions — nosy ones, tricky ones, the ones you'd never ask sober. Answer honestly.",
  Deduction: 'Someone at the table is lying. Watch faces, trade accusations, hope you pick right.',
  Voting: 'Everyone points at once. Most likely to, best of, worst of — the group decides and you live with it.',
  Challenge: 'A dare, a timer, and a room watching. Pull it off or take the forfeit.',
};

// Build the pseudo-bundle for one game type: its entire catalog, wearing the
// type's bright pill colour like a curated bundle wears its accent.
export function typeBundle(type) {
  return {
    id: `${TYPE_BUNDLE_PREFIX}${type.id}`,
    typeId: type.id,
    title: `${type.name} Games`,
    blurb:
      TYPE_BUNDLE_BLURBS[type.name] ||
      `A stack of ${type.name.toLowerCase()} games to work through.`,
    accent: typePillColor(type.name, type.bg) || '#E9E4DC',
    // No real popularity number exists for a whole-type shelf; synthesize a
    // stable one from the name (1100–3499 → 1.1k–3.5k) so its card matches the
    // curated bundles.
    saves: 1100 + (hashTitle(type.name) % 2400),
  };
}

export function getBundle(id) {
  return BUNDLES.find((b) => b.id === id) || null;
}

// The pool Discover's search and lists run over: the whole catalog, in title
// order (matching how the list pages sort).
export function featuredGames(allGames) {
  return allGames.slice().sort((a, b) => a.title.localeCompare(b.title));
}

// The exact games, in order, that head up Discover's "Top 10 Games" rail. This
// is a hand-set ranking (index 0 = #1), keyed by title. Any title not currently
// in the database is skipped; if fewer than `limit` survive, topRatedGames()
// fills the rest with the most-saved of what's left.
export const TOP_10_TITLES = [
  'Exquisite Corpse',
  "Don't Laugh",
  'Mind Melt',
  'Best Use Of',
  'Knuckle Tattoos',
  'Movie Plot',
  'Snort, Raspberry, Whistle',
  'Charades',
  'Slide Show',
  'Would You Rather',
];

// The "Top N Games" list Discover shows by default. Honours the hand-set
// TOP_10_TITLES order first; if any of those titles are missing (or the list is
// shorter than `limit`), the remaining slots fall back to most-saved first, ties
// breaking by community rating then title. (The displayed counts come from
// TOP_SAVES, not the synthesized savedCount.)
export function topRatedGames(allGames, limit = 10) {
  const byTitle = new Map(allGames.map((g) => [g.title, g]));
  const picked = TOP_10_TITLES.map((t) => byTitle.get(t)).filter(Boolean);
  const pickedTitles = new Set(picked.map((g) => g.title));

  const filler = featuredGames(allGames)
    .filter((g) => !pickedTitles.has(g.title))
    .map((g) => ({ game: g, m: metaFor(g.title) }))
    .sort(
      (a, b) =>
        b.m.savedCount - a.m.savedCount ||
        b.m.communityRating - a.m.communityRating ||
        a.game.title.localeCompare(b.game.title),
    )
    .map((x) => x.game);

  return [...picked, ...filler].slice(0, limit);
}

// The real games in a bundle. Curated bundles keep their listed order (titles
// missing from the database are dropped); a Game Type Bundle is every game of
// that type, in title order.
export function bundleGames(bundleId, allGames) {
  if (isTypeBundleId(bundleId)) {
    const typeId = bundleId.slice(TYPE_BUNDLE_PREFIX.length);
    return allGames
      .filter((g) => g.type_id === typeId)
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  const bundle = getBundle(bundleId);
  if (!bundle) return [];
  const byTitle = new Map(allGames.map((g) => [g.title, g]));
  return bundle.gameTitles.map((t) => byTitle.get(t)).filter(Boolean);
}
