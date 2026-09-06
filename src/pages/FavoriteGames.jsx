import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import FilterDrawer from '../components/FilterDrawer.jsx';
import GameCardCarousel from '../components/GameCardCarousel.jsx';
import ViewModeToggle from '../components/ViewModeToggle.jsx';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { useDebounced, SEARCH_DEBOUNCE_MS } from '../lib/useDebounced.js';
import { useLoaderGate } from '../lib/useLoaderGate.js';
import GamesLoader from '../components/GamesLoader.jsx';
import { TYPE_ICONS } from '../lib/gameTypes.js';
import { playersChipLabel, timeChipLabel, playerOptionCounts, timeOptionCounts } from '../lib/filterOptions.js';
import { playersMatchesAny, timeMatchesAnyBucket } from '../lib/gameMatch.js';
import { groupByLetter } from '../lib/alphabetIndex.js';
import { scrollPageTo } from '../lib/pageScroll.js';
import { useScrollRestoration } from '../lib/useScrollRestoration.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useHorizontalSwipeBack, useMenuOverlaySwipe } from '../lib/pageSwipe.js';
import { CARD_VIEW, useGameViewMode } from '../lib/useGameViewMode.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import { useMarkedPlayed } from '../lib/useMarkedPlayed.js';
import { SORT_ALPHA, SORT_OPTIONS_NO_FAVORITES, sortGames, sortLabel, sortEmptyMessage, sortOptionCounts } from '../lib/sortGames.js';
import StarRating from '../components/StarRating.jsx';

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function FavoriteGames() {
  const navigate = useNavigate();
  const location = useLocation();
  // Favorites can be opened from two places, and it animates to match each.
  // From the heart on Home it slides in from the left (back off to the left).
  // From the Favorites tile in the Game Types sheet it slides in from the right
  // over the sheet, like the pages launched from Home's ⋮ menu, and on the way
  // back slides straight off to the right while the sheet sits still underneath,
  // revealed as though it had only been covered up. The sheet stamps
  // `swipeForwardFromRight` + `backTo` into the history state; Home leaves both
  // unset. Frozen at mount, before the swipe hook clears the state. See
  // lib/pageSwipe.js.
  const [backTo] = useState(() => location.state?.backTo || '/');
  const [fromSheet] = useState(() => Boolean(location.state?.swipeForwardFromRight));
  const horizontalSwipe = useHorizontalSwipeBack(backTo);
  const overlaySwipe = useMenuOverlaySwipe(backTo);
  const { startBack, swipeClass, rootProps } = fromSheet ? overlaySwipe : horizontalSwipe;
  // Header, search and filter ride in one block that scrolls away downward and
  // comes back on any upward scroll. See lib/useScrollBackHeader.js.
  const { ref: headerRef } = useScrollBackHeader();
  const [viewMode, setViewMode] = useGameViewMode();
  const { isFavorite } = useFavoriteGames();
  const { getRating } = useGameRatings();
  const { isPlayed } = useMarkedPlayed();
  const [types, setTypes] = useState([]);
  // null until loaded, so the search placeholder below doesn't flash "0"
  // before the real count is known.
  // Seeded from the cache Home warms, so Favorites renders on the first frame.
  const [allGames, setAllGames] = useState(() => api.getCachedGames());
  const [games, setGames] = useState(() => api.getCachedGames() || []);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [playersFilter, setPlayersFilter] = useState([]);
  const [timeFilter, setTimeFilter] = useState([]);
  const [sort, setSort] = useState(SORT_ALPHA);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(() => api.getCachedGames() === null);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const { showLoader, contentReady } = useLoaderGate(loading);
  const recognitionRef = useRef(null);

  const cardView = viewMode === CARD_VIEW;

  // Favorites wears the same colored hero banner as the type pages. It isn't a
  // real game type, but it has an entry in typeColors.js and matching wordmark
  // artwork, so it can carry the treatment unchanged.
  const heroBg = typePillColor('Favorites');
  const heroLogo = TYPE_ICONS.Favorites;

  // Favorite membership lives in localStorage, not the API, so narrowing to
  // favorites is always the last, client-side step after the server has
  // applied search/type/players/time.
  const favoriteGames = useMemo(() => games.filter((g) => isFavorite(g.id)), [games, isFavorite]);
  // Letter headings only describe an alphabetical list, so any other sort drops
  // them for one flat run of cards. Same rule as All Games.
  const alphaSort = sort === SORT_ALPHA;
  const letterGroups = useMemo(() => groupByLetter(favoriteGames, (g) => g.title), [favoriteGames]);
  const sortedGames = useMemo(
    () =>
      alphaSort ? favoriteGames : sortGames(favoriteGames, sort, { getRating, isPlayed, isFavorite }),
    [favoriteGames, sort, alphaSort, getRating, isPlayed, isFavorite],
  );
  // What each option in the Sort By dropdown would leave standing, read off
  // this same pre-sort `favoriteGames` list — whatever search/type/players/time
  // have already narrowed to. Favorites isn't offered here (every game already
  // qualifies), so sortOptionCounts' entry for it is simply unused.
  const sortCounts = useMemo(
    () => sortOptionCounts(favoriteGames, { getRating, isPlayed, isFavorite }),
    [favoriteGames, getRating, isPlayed, isFavorite],
  );
  // The true favorite count, independent of any active search/filter — for the
  // search placeholder, same role totalCount plays on the other list pages.
  const totalCount = useMemo(
    () => (allGames ? allGames.filter((g) => isFavorite(g.id)).length : null),
    [allGames, isFavorite],
  );
  const hasActiveQuery =
    !!search.trim() || typeFilter.length > 0 || playersFilter.length > 0 || timeFilter.length > 0;

  // How many favorited games carry each type, narrowed by the current Players
  // and Time selections — so the number beside a Game Type chip previews what
  // picking that type would actually leave. Ignores the Game Type selection
  // itself and the search box. Shown greyed in parens in the filter drawer; a
  // type with no favorited game behind it (given the rest of the selection)
  // renders disabled there. Every type is seeded to 0 so the drawer can tell
  // "no matches" from "not computed yet"; before the list loads it returns {}
  // so nothing disables.
  const playersParam = playersFilter.join(',');
  const timeParam = timeFilter.join(',');
  const typeCounts = useMemo(() => {
    if (!allGames || !allGames.length) return {};
    const counts = Object.fromEntries(types.map((t) => [t.id, 0]));
    allGames.forEach((g) => {
      if (!isFavorite(g.id)) return;
      if (!playersMatchesAny(g.players, playersParam)) return;
      if (!timeMatchesAnyBucket(g.time, timeParam)) return;
      counts[g.type_id] = (counts[g.type_id] || 0) + 1;
    });
    return counts;
  }, [allGames, isFavorite, types, playersParam, timeParam]);

  // Players / Time options with no favorited game behind them get disabled in
  // the drawer rather than removed. Counted off the favorited slice of the
  // catalog, each group narrowed by the *other* two selections but never its
  // own — so a picked chip never reads as 0.
  const typeParam = typeFilter.join(',');
  const favoriteBase = useMemo(
    () => (allGames || []).filter((g) => isFavorite(g.id) && (!typeParam || typeParam.split(',').includes(g.type_id))),
    [allGames, isFavorite, typeParam],
  );
  const playersCounts = useMemo(
    () => playerOptionCounts(favoriteBase.filter((g) => timeMatchesAnyBucket(g.time, timeParam))),
    [favoriteBase, timeParam],
  );
  const timeCounts = useMemo(
    () => timeOptionCounts(favoriteBase.filter((g) => playersMatchesAny(g.players, playersParam))),
    [favoriteBase, playersParam],
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    typeFilter.forEach((id) => {
      const typeName = types.find((t) => t.id === id)?.name;
      if (typeName) {
        chips.push({
          key: `type-${id}`,
          label: typeName,
          onRemove: () => setTypeFilter((prev) => prev.filter((t) => t !== id)),
        });
      }
    });
    playersFilter.forEach((val) => {
      chips.push({
        key: `players-${val}`,
        label: playersChipLabel(val),
        onRemove: () => setPlayersFilter((prev) => prev.filter((v) => v !== val)),
      });
    });
    timeFilter.forEach((val) => {
      const timeLabel = timeChipLabel(val);
      if (timeLabel) {
        chips.push({
          key: `time-${val}`,
          label: timeLabel,
          onRemove: () => setTimeFilter((prev) => prev.filter((v) => v !== val)),
        });
      }
    });
    return chips;
  }, [typeFilter, playersFilter, timeFilter, types]);

  function clearAllFilters() {
    setTypeFilter([]);
    setPlayersFilter([]);
    setTimeFilter([]);
  }

  useScrollRestoration(!loading && !cardView);

  // Card view has nothing to scroll, so a position carried over from the list
  // would only leave the header block pulled up with nothing under it. It also
  // hides the search and filter row, so anything narrowing the set is dropped on
  // the way in — otherwise the deck would be missing games with nothing on
  // screen to explain it.
  useEffect(() => {
    if (!cardView) return;
    scrollPageTo(0);
    setSearch('');
    clearAllFilters();
  }, [cardView]);

  function toggleVoiceSearch() {
    if (!SpeechRecognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => setSearch(e.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  useEffect(() => {
    api.getGameTypes().then(setTypes).catch((err) => setError(err.message));
    // No games fetch here on purpose. Filters are always empty on mount, so the
    // effect below runs unfiltered and sets allGames from that same response —
    // fetching the 65KB list here as well just doubled every visit.
  }, []);


  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (typeFilter.length) params.type_id = typeFilter.join(',');
    if (playersFilter.length) params.players = playersFilter.join(',');
    if (timeFilter.length) params.time_bucket = timeFilter.join(',');
    const unfiltered = Object.keys(params).length === 0;

    // Derived from the cache rather than a one-shot ref so StrictMode's second
    // pass in dev doesn't put the loader back over a list already on screen.
    const cachedAll = unfiltered ? api.getCachedGames() : null;
    if (cachedAll) {
      setGames(cachedAll);
      setLoading(false);
    } else {
      setLoading(true);
    }

    api
      .getGames(params)
      .then((data) => {
        if (cancelled) return;
        setGames(data);
        // The unfiltered response is also the full list the count is drawn from.
        if (unfiltered) setAllGames(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, typeFilter.join(','), playersFilter.join(','), timeFilter.join(',')]);

  // One card, shared by the A–Z grouped render and the flat sorted one so the
  // two can never drift apart.
  function renderGameItem(g) {
    return (
      <div className="game-list-item" key={g.id} onClick={() => navigate(`/games/${g.id}`)}>
        <div className="game-list-item-header">
          <div className="game-list-item-header-left">
            <span
              className="type-tag game-list-item-type"
              style={{ color: TYPE_TEXT_COLOR, background: typePillColor(g.type_name, g.type_bg) }}
            >
              {g.type_name}
            </span>
            {isFavorite(g.id) && (
              <Icon name="favorite" filled className="game-list-item-fav-icon" />
            )}
          </div>
          <div className="game-list-item-actions">
            <span className="icon-btn" aria-hidden="true">
              <Icon name="chevron_right" />
            </span>
          </div>
        </div>
        <div className="game-list-item-main">
          <div className="game-list-item-title">{g.title}</div>
          <StarRating value={getRating(g.id)} size={16} className="star-rating--muted" />
          {g.description && <p className="game-list-item-description">{g.description}</p>}
          <div className="game-list-item-meta">
            {g.players && (
              <span className="meta-item">
                <Icon name="group" />
                {g.players}
              </span>
            )}
            {g.time && (
              <span className="meta-item">
                <Icon name="schedule" />
                {g.time}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page category-hero-page${swipeClass}`} {...rootProps}>
      <div
        className={`scroll-back-header category-hero-header${cardView ? ' category-hero-header-card' : ''}`}
        ref={headerRef}
        style={{ background: heroBg }}
      >
        <PageHeader
          title="Favorites"
          centered
          onBack={startBack}
          actions={<ViewModeToggle mode={viewMode} onChange={setViewMode} />}
          titleSlot={
            heroLogo ? (
              <img src={heroLogo} alt="Favorites" className="category-hero-logo" data-type="Favorites" />
            ) : null
          }
        />

        {error && <div className="error-message">{error}</div>}

        {/* Card view is a deck to swipe through, not a set to narrow down, so it
            drops the search and filter row the list view carries. */}
        {!cardView && (
          <div className="search-row">
            <div className="search-bar">
              <Icon name="search" />
              <input
                type="text"
                placeholder={totalCount != null ? `Search ${totalCount} favorite games…` : 'Search favorite games…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  type="button"
                >
                  <Icon name="close" />
                </button>
              )}
              {search && SpeechRecognition && <span className="search-divider" />}
              {SpeechRecognition && (
                <button
                  className={`mic-btn ${listening ? 'listening' : ''}`}
                  onClick={toggleVoiceSearch}
                  aria-label={listening ? 'Stop voice search' : 'Search by voice'}
                  type="button"
                >
                  <Icon name="mic" />
                </button>
              )}
            </div>

            <div className="filter-popover-wrapper icon-only">
              <button
                className="btn filter-toggle-btn-icon"
                onClick={() => setFilterOpen(true)}
                aria-label="Filter"
              >
                <Icon name="tune" />
                {activeFilterChips.length > 0 && (
                  <span className="filter-badge">{activeFilterChips.length}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        types={types}
        typeCounts={typeCounts}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        playersFilter={playersFilter}
        setPlayersFilter={setPlayersFilter}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        playersCounts={playersCounts}
        timeCounts={timeCounts}
        sort={sort}
        setSort={setSort}
        sortOptions={SORT_OPTIONS_NO_FAVORITES}
        sortCounts={sortCounts}
        resultCount={alphaSort ? favoriteGames.length : sortedGames.length}
        onClearAll={clearAllFilters}
      />

      {!cardView && (!alphaSort || activeFilterChips.length > 0) && (
        <div className="filter-chip-row">
          {/* Leads the row: it describes the whole list, not one value. Its ×
              restores the alphabetical default rather than removing a
              narrowing, which is what the spelled-out "Sort:" prefix signals. */}
          {!alphaSort && (
            <button
              className="filter-chip filter-chip--sort"
              onClick={() => setSort(SORT_ALPHA)}
              aria-label="Reset sort to alphabetical"
              type="button"
            >
              <span className="filter-chip__prefix">Sort:</span>
              {sortLabel(sort)}
              <span className="filter-chip__x" aria-hidden="true">
                <Icon name="close" />
              </span>
            </button>
          )}
          {activeFilterChips.map((chip) => (
            <button
              className="filter-chip"
              key={chip.key}
              onClick={chip.onRemove}
              aria-label={`Remove ${chip.label} filter`}
              type="button"
            >
              {chip.label}
              <span className="filter-chip__x" aria-hidden="true">
                <Icon name="close" />
              </span>
            </button>
          ))}
          {activeFilterChips.length >= 2 && (
            <button className="filter-clear-all" onClick={clearAllFilters} type="button">
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Outside .page-content on purpose: that wrapper is what the page-entrance
          animation slides, and an animated ancestor becomes the containing block
          for the loader's `position: fixed`, dragging it along. As a direct
          child of .page it resolves to the device frame and never moves. */}
      {/* Favorites' own pink, the same one its hero banner wears. */}
      {showLoader && <GamesLoader color={heroBg || undefined} />}

      <div className="page-content">
        {cardView && (
          <div className="category-hero-count">{totalCount != null ? `${totalCount} Games` : 'Games'}</div>
        )}

        {!contentReady ? null : favoriteGames.length === 0 ? (
          <p className="state-message">
            {hasActiveQuery ? 'No games found.' : 'No favorite games yet. Tap the heart on a game to add it here.'}
          </p>
        ) : !alphaSort && sortedGames.length === 0 ? (
          <p className="state-message">{sortEmptyMessage(sort)}</p>
        ) : cardView ? (
          <GameCardCarousel
            games={sortedGames}
            onOpen={(g) => navigate(`/games/${g.id}`)}
            onEdit={(g) => navigate(`/games/${g.id}`)}
          />
        ) : alphaSort ? (
          <div className="game-list">
            {letterGroups.map((group) => (
              <div key={group.letter} className="game-list-group">
                <div className="game-list-letter-heading">{group.letter}</div>
                {group.items.map(renderGameItem)}
              </div>
            ))}
          </div>
        ) : (
          <div className="game-list">{sortedGames.map(renderGameItem)}</div>
        )}
      </div>
    </div>
  );
}
