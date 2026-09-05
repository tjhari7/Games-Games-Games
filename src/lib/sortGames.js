// Sort order for the two list pages that carry the filter drawer (All Games,
// Favorites). Alphabetical is the default everywhere — it is the order the A–Z
// rail and the letter headings are built around, so any other choice switches
// those off and shows one flat list instead.
//
// Every other option here is a *filter*, not just a ranking: a game that
// doesn't qualify — unrated, unplayed when sorting by Played, not favorited
// when sorting by Favorites — is left out of the list entirely rather than
// sinking to the bottom. Rating a couple of games and sorting by rating should
// show those games, not the whole library with the unrated ones tacked on.
export const SORT_ALPHA = 'alpha';
export const SORT_RATING_DESC = 'rating_desc';
export const SORT_RATING_ASC = 'rating_asc';
export const SORT_PLAYED = 'played';
export const SORT_UNPLAYED = 'unplayed';
export const SORT_FAVORITES = 'favorites';

export const SORT_OPTIONS = [
  { value: SORT_ALPHA, label: 'Alphabetical' },
  { value: SORT_RATING_DESC, label: 'Rating: High to Low' },
  { value: SORT_RATING_ASC, label: 'Rating: Low to High' },
  { value: SORT_PLAYED, label: 'Played' },
  { value: SORT_UNPLAYED, label: 'Unplayed' },
  // Favorites is only offered on All Games — on the Favorites page every game
  // already qualifies, so the option would filter nothing.
  { value: SORT_FAVORITES, label: 'Favorites' },
];

export const SORT_OPTIONS_NO_FAVORITES = SORT_OPTIONS.filter((o) => o.value !== SORT_FAVORITES);

export function sortLabel(value) {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? 'Alphabetical';
}

// Shown in place of the list when a filtering sort leaves nothing standing —
// distinct from "No games found.", which covers search/filter narrowing the
// set to zero. `null` for Alphabetical, which never filters.
export function sortEmptyMessage(value) {
  switch (value) {
    case SORT_RATING_DESC:
    case SORT_RATING_ASC:
      return 'No rated games yet. Rate a game to see it here.';
    case SORT_PLAYED:
      return 'No played games yet.';
    case SORT_UNPLAYED:
      return 'No unplayed games — nice work.';
    case SORT_FAVORITES:
      return 'No favorite games yet. Tap the heart on a game to add it here.';
    default:
      return null;
  }
}

// How many games each option would leave standing, so the dropdown can show
// "Favorites (8)" before it's picked rather than after. Read off the same
// pre-sort list `sortGames` filters — whatever search/type/players/time have
// already narrowed to — so the number always matches what tapping the option
// would actually produce.
export function sortOptionCounts(games, { getRating, isPlayed, isFavorite } = {}) {
  const ratedCount = games.filter((g) => getRating(g.id) > 0).length;
  return {
    [SORT_ALPHA]: games.length,
    [SORT_RATING_DESC]: ratedCount,
    [SORT_RATING_ASC]: ratedCount,
    [SORT_PLAYED]: games.filter((g) => isPlayed(g.id)).length,
    [SORT_UNPLAYED]: games.filter((g) => !isPlayed(g.id)).length,
    [SORT_FAVORITES]: games.filter((g) => isFavorite(g.id)).length,
  };
}

// `state` carries the three per-game lookups the sorts need — getRating,
// isPlayed, isFavorite — so this stays a plain function the pages can memoize
// rather than a hook subscribing to all three stores itself.
export function sortGames(games, sort, { getRating, isPlayed, isFavorite } = {}) {
  const byTitle = (a, b) => a.title.localeCompare(b.title);

  switch (sort) {
    case SORT_RATING_DESC:
      return games
        .filter((g) => getRating(g.id) > 0)
        .sort((a, b) => getRating(b.id) - getRating(a.id) || byTitle(a, b));
    case SORT_RATING_ASC:
      return games
        .filter((g) => getRating(g.id) > 0)
        .sort((a, b) => getRating(a.id) - getRating(b.id) || byTitle(a, b));
    case SORT_PLAYED:
      return games.filter((g) => isPlayed(g.id)).sort(byTitle);
    case SORT_UNPLAYED:
      return games.filter((g) => !isPlayed(g.id)).sort(byTitle);
    case SORT_FAVORITES:
      return games.filter((g) => isFavorite(g.id)).sort(byTitle);
    default:
      return [...games].sort(byTitle);
  }
}
