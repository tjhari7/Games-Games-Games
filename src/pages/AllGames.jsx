import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import FilterDrawer from '../components/FilterDrawer.jsx';
import AlphabetIndex from '../components/AlphabetIndex.jsx';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { playersChipLabel, timeChipLabel } from '../lib/filterOptions.js';
import { groupByLetter } from '../lib/alphabetIndex.js';
import { fastScrollTo } from '../lib/smoothScroll.js';
import { offsetWithinScroller } from '../lib/pageScroll.js';
import { useScrollRestoration } from '../lib/useScrollRestoration.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useMenuOverlaySwipe } from '../lib/pageSwipe.js';
import { useLoaderGate } from '../lib/useLoaderGate.js';
import { useDebounced, SEARCH_DEBOUNCE_MS } from '../lib/useDebounced.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import { useMarkedPlayed } from '../lib/useMarkedPlayed.js';
import { SORT_ALPHA, SORT_OPTIONS, sortGames, sortLabel, sortEmptyMessage, sortOptionCounts } from '../lib/sortGames.js';
import StarRating from '../components/StarRating.jsx';
import GamesLoader from '../components/GamesLoader.jsx';
import addIcon from '../assets/Add_Icon.svg';

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Breathing room between the bottom of the pinned header and the letter
// heading a jump lands on.
const JUMP_GAP = 16;

export default function AllGames() {
  const navigate = useNavigate();
  // Opened from the ⋮ menu on Home's right edge: slides in from the right, and its
  // back button slides it back off to the right over a Home that stays put, with
  // the ⋮ menu open again on arrival — same as Add Game / Edit Game Types. See
  // lib/pageSwipe.js.
  const { startBack, swipeClass, rootProps } = useMenuOverlaySwipe();
  // Header, search and filter ride in one block that scrolls away downward and
  // comes back on any upward scroll. See lib/useScrollBackHeader.js.
  const { ref: headerRef, pinOpen: pinHeaderOpen, releasePin: releaseHeaderPin } = useScrollBackHeader();
  const { isFavorite } = useFavoriteGames();
  const { getRating } = useGameRatings();
  const { isPlayed } = useMarkedPlayed();
  // Seeded from the module-level caches in api.js, which Home warms in the
  // background (HomeContent). A repeat visit renders its list on the first
  // frame instead of blocking on a fetch, so the loader never appears for data
  // already in memory. Same pattern as GameTypes and RandomGame.
  const [types, setTypes] = useState(() => api.getCachedGameTypes() || []);
  const [games, setGames] = useState(() => api.getCachedGames() || []);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [playersFilter, setPlayersFilter] = useState([]);
  const [timeFilter, setTimeFilter] = useState([]);
  const [sort, setSort] = useState(SORT_ALPHA);
  const [filterOpen, setFilterOpen] = useState(false);
  // Only a cold start blocks. Filters are always empty on mount, so the cached
  // unfiltered list is exactly what this first render wants.
  const [loading, setLoading] = useState(() => api.getCachedGames() === null);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  // The spinner is skipped entirely on fast fetches and always finishes its
  // rotation on slow ones. See lib/useLoaderGate.js.
  const { showLoader, contentReady } = useLoaderGate(loading);
  const [totalCount, setTotalCount] = useState(() => api.getCachedGames()?.length ?? null);
  // Search is debounced; filters and view changes stay immediate.
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const sectionRefs = useRef({});
  const recognitionRef = useRef(null);

  // A–Z headings and the index rail only describe an alphabetical list, so any
  // other sort renders one flat run of cards and drops both.
  const alphaSort = sort === SORT_ALPHA;
  const letterGroups = useMemo(() => groupByLetter(games, (g) => g.title), [games]);
  const presentLetters = useMemo(() => new Set(letterGroups.map((g) => g.letter)), [letterGroups]);
  const sortedGames = useMemo(
    () => (alphaSort ? games : sortGames(games, sort, { getRating, isPlayed, isFavorite })),
    [games, sort, alphaSort, getRating, isPlayed, isFavorite],
  );
  // What each option in the Sort By dropdown would leave standing, read off
  // this same pre-sort `games` list — whatever search/type/players/time have
  // already narrowed to.
  const sortCounts = useMemo(
    () => sortOptionCounts(games, { getRating, isPlayed, isFavorite }),
    [games, getRating, isPlayed, isFavorite],
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

  // While a filter is active, reflect the filtered result count; otherwise
  // show the unfiltered total (fetched once, unaffected by search-driven loading).
  const displayCount = activeFilterChips.length > 0 ? games.length : totalCount;

  useScrollRestoration(contentReady);

  function jumpToLetter(letter) {
    const el = sectionRefs.current[letter];
    if (!el) return;
    // Hold the chrome open for the length of the jump and land the section in
    // the gap below it. Scrolling the heading to the top of the scroller
    // instead would park it under the block, which stays on screen throughout.
    const headerSpace = pinHeaderOpen();
    fastScrollTo(offsetWithinScroller(el), headerSpace + JUMP_GAP, releaseHeaderPin);
  }

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
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (typeFilter.length) params.type_id = typeFilter.join(',');
    if (playersFilter.length) params.players = playersFilter.join(',');
    if (timeFilter.length) params.time_bucket = timeFilter.join(',');
    const unfiltered = Object.keys(params).length === 0;

    // Any unfiltered query is already answered by the cache Home warmed, so
    // paint it immediately and let the request refresh it underneath. Only a
    // cold start or a filtered query has nothing to show and needs the loader.
    //
    // Deliberately derived from the cache rather than a one-shot ref: StrictMode
    // runs this effect twice in dev, and a ref would be spent on the first pass,
    // putting the loader back on the second.
    const cachedAll = unfiltered ? api.getCachedGames() : null;
    if (cachedAll) {
      setGames(cachedAll);
      setTotalCount(cachedAll.length);
      setLoading(false);
    } else {
      setLoading(true);
    }

    api
      .getGames(params)
      .then((data) => {
        if (cancelled) return;
        setGames(data);
        // The unfiltered response *is* the total, so there's no second
        // full-list request just to count it.
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
    <div className={`page${swipeClass}`} {...rootProps}>
      <div className="scroll-back-header" ref={headerRef}>
        <PageHeader
          title="All Games"
          titleSlot={<span className="page-title-eesti">All Games</span>}
          centered
          onBack={startBack}
          actions={
            <button className="icon-btn all-games-types-btn" onClick={() => navigate('/types', { state: { backTo: '/games', swipeSheetUp: true } })} aria-label="Edit game types">
              <span className="material-symbols-outlined">category</span>
            </button>
          }
        />

        {error && <div className="error-message">{error}</div>}

        <div className="search-row">
          <div className="search-bar">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder={displayCount != null ? `Search ${displayCount} games…` : 'Search games…'}
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
      </div>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        types={types}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        playersFilter={playersFilter}
        setPlayersFilter={setPlayersFilter}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        sort={sort}
        setSort={setSort}
        sortOptions={SORT_OPTIONS}
        sortCounts={sortCounts}
        resultCount={alphaSort ? (displayCount ?? games.length) : sortedGames.length}
        onClearAll={clearAllFilters}
      />

      {(!alphaSort || activeFilterChips.length > 0) && (
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
          for the loader's `position: fixed`, dragging it along and then dropping
          it when the class comes off. As a direct child of .page it resolves to
          the device frame and never moves. */}
      {showLoader && <GamesLoader />}

      <div className="page-content">
        {!contentReady ? null : games.length === 0 ? (
          <p className="state-message">No games found.</p>
        ) : !alphaSort && sortedGames.length === 0 ? (
          <p className="state-message">{sortEmptyMessage(sort)}</p>
        ) : alphaSort ? (
          <div className="game-list game-list--indexed">
            {letterGroups.map((group) => (
              <div key={group.letter} className="game-list-group">
                <div
                  className="game-list-letter-heading"
                  ref={(el) => {
                    sectionRefs.current[group.letter] = el;
                  }}
                >
                  {group.letter}
                </div>
                {group.items.map(renderGameItem)}
              </div>
            ))}
          </div>
        ) : (
          <div className="game-list">{sortedGames.map(renderGameItem)}</div>
        )}
      </div>

      {/* The A-Z rail is `position: fixed`, so it stays out of .page-content:
          that wrapper carries a `translate` during the page entrance, which
          would make it the rail's containing block for those 300ms and shift
          the rail off the frame edge and back. */}
      {contentReady && alphaSort && games.length > 0 && (
        <AlphabetIndex presentLetters={presentLetters} onSelect={jumpToLetter} />
      )}

      <button className="fab" onClick={() => navigate('/games/new', { state: { backTo: '/games', swipeSheetUp: true } })} aria-label="Add Game">
        <img src={addIcon} alt="" className="fab-add-icon" />
        ADD GAME
      </button>
    </div>
  );
}
