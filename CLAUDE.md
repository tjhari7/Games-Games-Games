# Games! Games! Games!

A personal games database — browse party games by type, favorite them, rate them,
or get a random one. React + Vite front end, Express API, Supabase Postgres.
Built and reviewed prototype-first: TJ is designing in the browser, not writing code.

## How to talk about this project

TJ is a designer, not a developer. Explain git, deploys, and infrastructure in
plain language and skip the jargon. When something needs a decision, give a
recommendation rather than a menu of options. When a change is made, say which
screens it lands on — that is what gets reviewed.

## Running it

`npm run dev` starts **both** halves at once via `concurrently`:

- `api` — `node server.js`, port **3000**, talks to Supabase Postgres
- `web` — Vite, port **5173** (`autoPort`, may land higher)

Vite proxies `/api` → `localhost:3000`. **Never start Vite alone** for a review
session — the UI loads but every screen is empty, which is the recurring
"I can't see the content or images" bug. Use the `/start` skill.

If the API returns nothing, the usual cause is the **Supabase project having been
paused** for inactivity, not a code bug. Check that before debugging.

## Layout

- `src/pages/` — nine screens: `Home`, `RandomGame` (Surprise Me), `GameTypes`
  (the drawer menu), `AllGames`, `CategoryGames` (per-type list), `GameDetails`,
  `FavoriteGames`, `AddEditGame`, `ManageTypes`
- `src/components/` — shared UI (`PageHeader`, `GameCardCarousel`, `StarRating`,
  `FilterPopover`, `AlphabetIndex`, `ViewModeToggle`)
- `src/lib/` — data + hooks (`typeColors.js`, `gameTypes.js`, `api.js`, plus the
  `use*` hooks for favorites, ratings, played, view mode, scroll behavior)
- `server/app.js` — all API routes
- **`src/index.css` — every style in the app.** One 2900-line file, no CSS
  modules, no Tailwind. All spacing and sizing changes happen here.

## What "globally" means

TJ says "globally" or "do a global check" constantly, and it always means the
same thing: **all nine pages, and both view modes.** Most list screens have a
list view *and* a card view (`useGameViewMode`) that are styled separately — a
change to one that skips the other is an incomplete change. Search `src/index.css`
for every occurrence rather than fixing the one screen that prompted the request,
and report back which screens were touched.

## Design tokens

Defined as CSS variables at the top of `src/index.css`. Use the variables, not
raw hex, for anything already tokenized.

- App background `#262626` (`--neutral-bg`) · card and bottom-bar fill `#1A1816`
- Text on dark `#f2f0ed` · text on bright pills `#1a1816`
- Muted UI (rating stars, card hearts) = the dark brown at **50% opacity** —
  change the opacity, not the color, so it stays consistent
- Card radius 16px (`--radius-card`) · pills 999px (`--radius-pill`)

**Game type colors live in `src/lib/typeColors.js`** — one bright color per type,
sampled from the Figma sheet. Each has a matching recolored icon SVG in
`src/assets/`, so changing a color there means changing the SVG too. The file's
comments track why individual values are what they are; keep them current.

## Type

- Headers: `Bogart Compressed` (`--font-header`)
- Body: `DM Sans` (`--font-sans`)
- Buttons (Play A Game, Browse Game Types, ADD): `GT Eesti` Ultra Bold, **22px**
- H1 = 40px · **minimum size anywhere is 12px** — 11px was globally eliminated
  once already, do not reintroduce it

## Spacing conventions

Settled over many passes; match these unless told otherwise:

- Cards: 16px padding on all four sides
- Card side margins: 16px (except `AllGames`, narrower to clear the A–Z index)
- Top bar icons: 48×48px, matching the filter buttons
- Bottom bar: full-bleed, 18px top padding, 16px top corner radius, `#1A1816`
- Elements shifting position when a rating or favorite is set is a bug — reserve
  the space so the layout never jumps during interaction

## Animation

Uses `motion` (Motion One / Framer successor). Two areas carry hand-tuned values:

- **The logo** — per-letter spring physics, individually dialed. Outer elements
  (G, !) are loosest and bounciest; the center M is stiffest. Never normalize
  these to one value.
- **The homepage die toss** — 18 icons in 9 alternating pairs, colored to match
  the game type menu.

When adjusting springs, **show a before/after table of the values** — that is how
these get reviewed, and it prevents losing a good setting to an experiment.

## Data

Favorites, ratings, and played state are server-side (`/api/favorites`,
`/api/ratings`, `/api/played`), so restarting the dev server does not lose them.
84 games across 18 types. `npm run backup` snapshots to `backups/games.json`.

## Shipping

GitHub: `tjhari7/Games-Games-Games`, branch `main`.
Netlify: `games-games-games` → https://games-games-games.netlify.app

**The Netlify site is not connected to the GitHub repo.** Pushing to main does
*not* deploy. Deploying is a separate manual step. Use the `/ship` skill; never
tell TJ a change is live because it was pushed.
