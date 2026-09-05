import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import taskmasterSingleLogo from '../assets/TaskMaster_Single_01.svg';
import { playersChipLabel, timeChipLabel } from '../lib/filterOptions.js';
import { groupByLetter } from '../lib/alphabetIndex.js';
import { scrollPageTo } from '../lib/pageScroll.js';
import { useScrollRestoration } from '../lib/useScrollRestoration.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useHorizontalSwipeBack, useDiscoverRiseSwipe } from '../lib/pageSwipe.js';
import DiscoverRiseBackdrop from '../components/DiscoverRiseBackdrop.jsx';
import { CARD_VIEW, useGameViewMode } from '../lib/useGameViewMode.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import { useMarkedPlayed } from '../lib/useMarkedPlayed.js';
import { SORT_ALPHA, SORT_OPTIONS, sortGames, sortLabel, sortEmptyMessage, sortOptionCounts } from '../lib/sortGames.js';
import StarRating from '../components/StarRating.jsx';

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function CategoryGames() {
  const navigate = useNavigate();
  const location = useLocation();
  // Sits to Home's left, so it comes in from the left — but unlike the menu
  // and favorites, it's opened from the Game Types sheet, so back returns
  // there instead of all the way to Home. Captured at mount — the swipe hook
  // wipes the history state a tick later. See lib/pageSwipe.js.
  const [backTo] = useState(() => location.state?.backTo || '/game-types');
  // Opened from Discover's type tiles instead: it rises up from the bottom over
  // a copy of Discover and drops back down onto it, like the bundle and
  // community-game pages. Both swipe hooks are called (hooks can't be
  // conditional); only the matching one's controls are used.
  const [fromDiscover] = useState(() => Boolean(location.state?.discoverRise));
  const horizontalSwipe = useHorizontalSwipeBack(backTo);
  const riseSwipe = useDiscoverRiseSwipe('/discover');
  const { startBack, swipeClass, rootProps } = fromDiscover ? riseSwipe : horizontalSwipe;
  const rising = fromDiscover && riseSwipe.rising;
  // Header, search and filter ride in one block that scrolls away downward and
  // comes back on any upward scroll. See lib/useScrollBackHeader.js.
  const { ref: headerRef } = useScrollBackHeader();
  const [viewMode, setViewMode] = useGameViewMode();
  const { isFavorite } = useFavoriteGames();
  const { getRating } = useGameRatings();
  const { isPlayed } = useMarkedPlayed();
  const { typeId } = useParams();
  // Seeded from the caches Home warms, so a type page renders its banner and
  // its list on the first frame. The full games list carries every game's
  // type_id, so it answers this page directly — no per-type request needed to
  // show something. See api.getCachedGamesByType.
  const [type, setType] = useState(() => api.getCachedGameTypes()?.find((t) => t.id === typeId) || null);
  const [games, setGames] = useState([]);
  const [search, setSearch] = useState('');
  const [playersFilter, setPlayersFilter] = useState([]);
  const [timeFilter, setTimeFilter] = useState([]);
  const [sort, setSort] = useState(SORT_ALPHA);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(() => api.getCachedGamesByType(typeId) === null);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [totalCount, setTotalCount] = useState(() => api.getCachedGamesByType(typeId)?.length ?? null);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const { showLoader, contentReady } = useLoaderGate(loading);
  const recognitionRef = useRef(null);

  // A–Z headings only describe an alphabetical list, so any other sort renders
  // one flat run of cards instead. Same rule as All Games and Favorites.
  const alphaSort = sort === SORT_ALPHA;
  const letterGroups = useMemo(() => groupByLetter(games, (g) => g.title), [games]);
  const sortedGames = useMemo(
    () => (alphaSort ? games : sortGames(games, sort, { getRating, isPlayed, isFavorite })),
    [games, sort, alphaSort, getRating, isPlayed, isFavorite],
  );
  // What each option in the Sort By dropdown would leave standing, read off
  // this same pre-sort `games` list — whatever search/players/time have
  // already narrowed to.
  const sortCounts = useMemo(
    () => sortOptionCounts(games, { getRating, isPlayed, isFavorite }),
    [games, getRating, isPlayed, isFavorite],
  );

  const cardView = !!type && viewMode === CARD_VIEW;

  // The colored hero banner (type wordmark + rounded-bottom bar) every designed
  // type page wears. It needs the type loaded to know its color, so it waits
  // for that rather than flashing a plain header first. Types with wordmark
  // artwork show it; the rest fall back to their name as text.
  //
  // No `type.bg` fallback on purpose: the banner's chrome is dark ink meant for
  // the bright colors in typeColors.js, and a type stored with a dark bg (the
  // "Unassigned" bucket, say) would swallow it. Anything not listed there keeps
  // the plain dark header until it gets a color of its own.
  const heroBg = type ? typePillColor(type.name) : null;
  const isHeroType = !!heroBg;
  // Taskmaster's drawer tile wears the two-line lockup (TYPE_ICONS), but the
  // hero banner uses a single-line cut so it sits like every other one-line
  // wordmark in the 48px title row.
  const heroLogo = isHeroType
    ? type.name === 'Taskmaster'
      ? taskmasterSingleLogo
      : TYPE_ICONS[type.name]
    : null;

  const activeFilterChips = useMemo(() => {
    const chips = [];
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
  }, [playersFilter, timeFilter]);

  function clearAllFilters() {
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
    // Re-seed on a typeId change too — the initialiser above only covers the
    // first mount, and the route param can change under the same component.
    const cachedTypes = api.getCachedGameTypes();
    if (cachedTypes) setType(cachedTypes.find((t) => t.id === typeId) || null);
    api
      .getGameTypes()
      .then((types) => setType(types.find((t) => t.id === typeId) || null))
      .catch((err) => setError(err.message));
  }, [typeId]);

  useEffect(() => {
    let cancelled = false;
    const params = { type_id: typeId };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (playersFilter.length) params.players = playersFilter.join(',');
    if (timeFilter.length) params.time_bucket = timeFilter.join(',');
    // type_id is always present, so "unfiltered" here means nothing beyond it.
    const unfiltered = Object.keys(params).length === 1;

    // Derived from the cache rather than a one-shot ref so StrictMode's second
    // pass in dev doesn't put the loader back over a list already on screen.
    const cachedForType = unfiltered ? api.getCachedGamesByType(typeId) : null;
    if (cachedForType) {
      setGames(cachedForType);
      setTotalCount(cachedForType.length);
      setLoading(false);
    } else {
      setLoading(true);
    }

    api
      .getGames(params)
      .then((data) => {
        if (cancelled) return;
        setGames(data);
        // The unfiltered response is this type's total — no second request.
        if (unfiltered) setTotalCount(data.length);
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
  }, [typeId, debouncedSearch, playersFilter.join(','), timeFilter.join(',')]);

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
              <span
                className="material-symbols-outlined game-list-item-fav-icon"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
              >
                favorite
              </span>
            )}
          </div>
          <div className="game-list-item-actions">
            <span className="icon-btn" aria-hidden="true">
              <span className="material-symbols-outlined">chevron_right</span>
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
                <span className="material-symbols-outlined">group</span>
                {g.players}
              </span>
            )}
            {g.time && (
              <span className="meta-item">
                <span className="material-symbols-outlined">schedule</span>
                {g.time}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page${swipeClass}${isHeroType ? ' category-hero-page' : ''}`} {...rootProps}>
      {rising && <DiscoverRiseBackdrop />}
      <div
        className={`scroll-back-header${isHeroType ? ' category-hero-header' : ''}${isHeroType && cardView ? ' category-hero-header-card' : ''}`}
        ref={headerRef}
        style={isHeroType ? { background: heroBg } : undefined}
      >
        <PageHeader
          title={type ? (heroLogo ? `${type.name} Games` : type.name) : 'Games'}
          centered
          onBack={startBack}
          actions={type ? <ViewModeToggle mode={viewMode} onChange={setViewMode} /> : null}
          titleSlot={
            heroLogo ? (
              <img
                src={heroLogo}
                alt={type.name}
                className="category-hero-logo"
                data-type={type.name}
              />
            ) : null
          }
        />

        {error && <div className="error-message">{error}</div>}

        {/* Card view is a deck to swipe through, not a set to narrow down, so it
            drops the search and filter row the list view carries. */}
        {!cardView && (
          <div className="search-row">
            <div className="search-bar">
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                placeholder={
                  type && totalCount != null
                    ? `Search ${totalCount} ${type.name.toLowerCase()} games…`
                    : 'Search by game title…'
                }
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
                  <span className="material-symbols-outlined">close</span>
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
                  <span className="material-symbols-outlined">mic</span>
                </button>
              )}
            </div>

            <div className="filter-popover-wrapper icon-only">
              <button
                className="btn filter-toggle-btn-icon"
                onClick={() => setFilterOpen(true)}
                aria-label="Filter"
              >
                <span className="material-symbols-outlined">tune</span>
                {activeFilterChips.length > 0 && (
                  <span className="filter-badge">{activeFilterChips.length}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Game Type is deliberately omitted here (no `types` passed, defaulting
          `showTypeFilter` off) — this page already is one type, so filtering by
          it would filter by itself. */}
      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        showTypeFilter={false}
        playersFilter={playersFilter}
        setPlayersFilter={setPlayersFilter}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        sort={sort}
        setSort={setSort}
        sortOptions={SORT_OPTIONS}
        sortCounts={sortCounts}
        resultCount={alphaSort ? (totalCount ?? games.length) : sortedGames.length}
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
                <span className="material-symbols-outlined">close</span>
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
                <span className="material-symbols-outlined">close</span>
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
      {/* The G wears this type's colour, the same one the hero banner uses. */}
      {showLoader && <GamesLoader color={heroBg || undefined} />}

      <div className="page-content">
        {isHeroType && cardView && (
          <div className="category-hero-count">{totalCount != null ? `${totalCount} Games` : 'Games'}</div>
        )}

        {!contentReady ? null : games.length === 0 ? (
          <p className="state-message">No games found.</p>
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
