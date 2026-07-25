import { pool } from './db.js';

const GAME_TYPES = [
  { name: 'Improv', accent: '#BA2C2C', bg: '#3A1818', protected: false },
  { name: 'Act Out', accent: '#BA7F2C', bg: '#3A2C18', protected: false },
  { name: 'Drawing', accent: '#BAAE2C', bg: '#3A3718', protected: false },
  { name: 'Talking', accent: '#2CBA5B', bg: '#183A23', protected: false },
  { name: 'Card', accent: '#2C73BA', bg: '#18293A', protected: false },
  { name: 'Taskmaster', accent: '#7F2CBA', bg: '#2C183A', protected: false },
  { name: 'Unassigned', accent: '#E8DA59', bg: '#3A3718', protected: true },
];

const GAMES = [
  {
    type: 'Improv',
    title: 'Freeze',
    description: 'Two players improvise a scene until someone freezes the action and jumps in with a new one.',
    players: '4+',
    time: '10-20 min',
    materials: 'None',
    rules:
      'Two players start improvising a short scene. At any point, someone watching yells "Freeze!" — the two actors immediately stop moving, holding their exact positions. The person who called freeze taps one actor out, takes their exact physical position, and starts a brand new scene justified by that pose (it should have nothing to do with the scene before it). Keep going, swapping people in and out on freezes.',
    example:
      'Two players are frozen mid-argument, one pointing at the other. A new player taps in, takes the pointing pose, and starts a scene as a tour guide pointing out a museum exhibit.',
  },
  {
    type: 'Improv',
    title: 'Yes, And',
    description: 'A group scene where every player must accept and build on whatever the last person said.',
    players: '3-8',
    time: '10-15 min',
    materials: 'None',
    rules:
      'Someone starts a scene with a simple statement about where they are or what is happening. Each next player must respond starting conceptually with "yes, and" — accepting what was just established and adding something new to it. No one is allowed to deny, block, or contradict what came before. Keep the scene going for a few minutes before wrapping up.',
    example:
      'Player 1: "Wow, this rowboat is really taking on water." Player 2: "Yes, and I think it is because of the shark I stabbed earlier." Player 3: "Yes, and now the shark is going to be a issue too."',
  },
  {
    type: 'Act Out',
    title: 'Charades',
    description: 'Act out a word or phrase without speaking while your team races to guess it.',
    players: '4-12',
    time: '20-30 min',
    materials: 'Paper slips and a pen, a hat or bowl',
    rules:
      'Split into two teams and write down movie, book, or phrase ideas on slips of paper, folded up in a bowl. Teams alternate sending one actor to draw a slip and act it out silently for their own team within a time limit (60-90 seconds), using only gestures — no talking, mouthing words, or props. Standard signals apply (number of words, "sounds like", syllable count). Correct guesses within time win the point; unguessed slips go back in the bowl.',
    example:
      'The slip says "Titanic." The actor mimes standing at the front of a ship with arms out, then mimes an iceberg collision — teammates shout guesses until someone lands on it.',
  },
  {
    type: 'Act Out',
    title: 'Reverse Charades',
    description: 'The whole team acts out the clue together while one lone guesser tries to name it.',
    players: '5+',
    time: '15-25 min',
    materials: 'Paper slips and a pen, a hat or bowl',
    rules:
      'Same clue pool as regular charades, but flipped: one player is the guesser, and everyone else on the team acts out the clue together, at the same time, silently. The guesser watches the chaos and tries to shout the answer before time runs out. Rotate the guesser each round.',
    example:
      'The clue is "Jurassic Park." The whole team scatters, some stomping like dinosaurs, others miming screaming and running — the guesser has to piece it together fast.',
  },
  {
    type: 'Drawing',
    title: 'Pictionary',
    description: 'Draw a secret word for your team to guess before the timer runs out — no letters or numbers allowed.',
    players: '4-12',
    time: '20-30 min',
    materials: 'Paper or whiteboard, markers, a timer, word list or slips',
    rules:
      'Split into teams. One player from the drawing team picks a word and has 60-90 seconds to draw clues (no letters, numbers, or verbal hints) while their team shouts guesses. If the team guesses correctly before time is up, they score a point. Rotate the artist each round and alternate between teams.',
    example:
      'The word is "volcano." The artist draws a triangle mountain with squiggly lines shooting out the top — teammates yell "mountain! eruption! volcano!"',
  },
  {
    type: 'Drawing',
    title: 'Telephone Pictionary',
    description: 'A folded chain of alternating drawings and written guesses that gets delightfully wrong by the end.',
    players: '4-10',
    time: '20-30 min',
    materials: 'One notepad per player, pens',
    rules:
      'Each player writes a short phrase on the first page of their notepad, then passes it to the next player. That player draws a picture of the phrase (no peeking at earlier pages), folds the paper to hide everything but their drawing, and passes it on. The next player writes a guess of what the drawing shows based only on the picture, folds it, and passes it on. Keep alternating draw/guess until the notepads are full, then unfold each one and read the chain aloud from start to finish.',
    example:
      'Starting phrase: "A cat riding a skateboard." Six passes later the final guess reads "A furry burrito on wheels."',
  },
  {
    type: 'Talking',
    title: 'Two Truths and a Lie',
    description: 'Everyone shares three personal statements — two true, one false — and the group votes on the lie.',
    players: '3+',
    time: '10-20 min',
    materials: 'None',
    rules:
      'Each player in turn says three statements about themselves: two true facts and one made-up lie, in any order. The rest of the group discusses and votes on which statement they believe is the lie. The player then reveals the truth. Rotate until everyone has gone.',
    example:
      '"I have run a marathon. I have met a celebrity. I am afraid of birds." The group debates, votes on the marathon claim, and finds out the celebrity meeting was the lie.',
  },
  {
    type: 'Talking',
    title: 'Would You Rather',
    description: 'Answer absurd or tough hypothetical dilemmas and debate your reasoning with the group.',
    players: '2+',
    time: '10-20 min',
    materials: 'A list of prompts (optional)',
    rules:
      'One player reads a "Would you rather" question with two options. Everyone answers and explains their reasoning, and the group can debate or push back before moving to the next question. Rotate who reads the question.',
    example:
      '"Would you rather be able to fly but only 3 feet off the ground, or be invisible but only when no one is looking?" Sparks immediate, heated debate.',
  },
  {
    type: 'Card',
    title: 'Go Fish',
    description: 'Collect matching sets of four by asking opponents for cards, or dive into the deck when they say no.',
    players: '2-6',
    time: '15-20 min',
    materials: 'A standard deck of cards',
    rules:
      'Deal 5-7 cards to each player; the rest forms the draw pile ("the pond"). On your turn, ask a specific opponent for a rank you already hold at least one of ("Do you have any 7s?"). If they have it, they must hand over all cards of that rank and you go again. If not, they say "Go fish" and you draw from the pond. Collecting all four of a rank lets you lay that set down. First to lay down all their cards (or have the most sets when the pond runs out) wins.',
    example:
      'You hold two 7s and ask an opponent for 7s. They hand over their one 7, completing your set of four, and you get to ask again.',
  },
  {
    type: 'Card',
    title: 'Spoons',
    description: 'Collect four of a kind and race to grab a spoon before you get left without one.',
    players: '3-8',
    time: '10-15 min',
    materials: 'A standard deck of cards, spoons (one fewer than the number of players)',
    rules:
      'Place spoons in the center, one fewer than the number of players. Deal four cards to each player. Everyone simultaneously picks up one extra card from a dealer-controlled draw and passes one card to their left, continuously, trying to collect four of a kind. As soon as any player gets four of a kind, they quietly grab a spoon — everyone else scrambles to grab a spoon too. The player left without one is out (or gets a letter, spelling S-P-O-O-N-S over multiple rounds before elimination). Remove a spoon each round and keep playing until one player remains.',
    example:
      'You quietly collect four queens and slide a spoon off the table — a beat later the whole table is diving for the remaining spoons.',
  },
  {
    type: 'Taskmaster',
    title: 'Tallest Tower',
    description: 'Build the tallest freestanding tower using only what is already on the table, against the clock.',
    players: '2-6',
    time: '5-10 min',
    materials: 'Whatever is on the table (cups, books, utensils, etc.), a timer',
    rules:
      'Give everyone 2 minutes and free rein over whatever is within reach on the table (no outside items). At "go," everyone builds the tallest freestanding structure they can. When time is up, hands off — no touching to keep it standing. Measure each tower; if one collapses during measurement, it is scored at its last stable height. Tallest standing tower wins.',
    example:
      'One player stacks books into a pyramid topped with a precariously balanced spoon for extra height, and it holds just long enough to be measured.',
  },
  {
    type: 'Taskmaster',
    title: 'Paper Airplane Distance',
    description: 'Fold and fly a paper airplane for maximum distance, one shot, no do-overs.',
    players: '2-8',
    time: '5-10 min',
    materials: 'Paper (one sheet per player), a tape measure or marked-off distance',
    rules:
      'Give each player one sheet of paper and a strict fold-and-throw time limit (e.g. 3 minutes to fold, one single throw each from the same starting line). Mark where each plane lands and measure the distance from the throw line. Longest distance wins. No re-throws, no redesigns after the first throw.',
    example:
      'A carefully folded dart-style plane sails past everyone else’s efforts and lands nearly a full room-length away.',
  },
];

async function main() {
  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists game_types (
      id uuid primary key default gen_random_uuid(),
      name text unique not null,
      accent text not null,
      bg text not null,
      protected boolean not null default false,
      created_at timestamptz not null default now()
    );

    create table if not exists games (
      id uuid primary key default gen_random_uuid(),
      type_id uuid not null references game_types(id),
      title text not null,
      description text,
      players text,
      time text,
      materials text,
      rules text,
      example text,
      created_at timestamptz not null default now()
    );
  `);

  for (const t of GAME_TYPES) {
    await pool.query(
      `insert into game_types (name, accent, bg, protected)
       values ($1, $2, $3, $4)
       on conflict (name) do update set accent = excluded.accent, bg = excluded.bg`,
      [t.name, t.accent, t.bg, t.protected]
    );
  }

  const { rows: existingGames } = await pool.query('select count(*)::int as count from games');
  if (existingGames[0].count === 0) {
    const { rows: types } = await pool.query('select id, name from game_types');
    const typeIdByName = Object.fromEntries(types.map((t) => [t.name, t.id]));

    for (const g of GAMES) {
      await pool.query(
        `insert into games (type_id, title, description, players, time, materials, rules, example)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [typeIdByName[g.type], g.title, g.description, g.players, g.time, g.materials, g.rules, g.example]
      );
    }
    console.log(`Seeded ${GAMES.length} games.`);
  } else {
    console.log('Games table already has data — skipped game seeding.');
  }

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
