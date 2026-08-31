import { useEffect, useMemo, useRef, useState } from 'react';
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
import { playersChipLabel, timeChipLabel } from '../lib/filterOptions.js';
import { groupByLetter } from '../lib/alphabetIndex.js';
import { scrollPageTo } from '../lib/pageScroll.js';
import { useScrollRestoration } from '../lib/useScrollRestoration.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useHorizontalSwipeBack } from '../lib/pageSwipe.js';
import { CARD_VIEW, useGameViewMode } from '../lib/useGameViewMode.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import StarRating from '../components/StarRating.jsx';

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function FavoriteGames() {
  const navigate = useNavigate();
  const location = useLocation();
  // Sits to Home's left, same as the menu: in from the left, back off to the
  // left. Favorites can be opened from two places, though — the heart on Home,
  // or the Favorites tile in the Game Types sheet — so back returns to whichever
  // one sent us here (the sheet stamps `backTo` into the history state; Home
  // leaves it unset). Frozen at mount, before the swipe hook clears the state.
  // See lib/pageSwipe.js.
  const [backTo] = useState(() => location.state?.backTo || '/');
  const { startBack, swipeClass, rootProps } = useHorizontalSwipeBack(backTo);
  // Header, search and filter ride in one block that scrolls away downward and
  // comes back on any upward scroll. See lib/useScrollBackHeader.js.
  const { ref: headerRef } = useScrollBackHeader();
  const [viewMode, setViewMode] = useGameViewMode();
  const { isFavorite } = useFavoriteGames();
  const { getRating } = useGameRatings();
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
  const letterGroups = useMemo(() => groupByLetter(favoriteGames, (g) => g.title), [favoriteGames]);
  // The true favorite count, independent of any active search/filter — for the
  // search placeholder, same role totalCount plays on the other list pages.
  const totalCount = useMemo(
    () => (allGames ? allGames.filter((g) => isFavorite(g.id)).length : null),
    [allGames, isFavorite],
  );
  const hasActiveQuery =
    !!search.trim() || typeFilter.length > 0 || playersFilter.length > 0 || timeFilter.length > 0;

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
              <span className="material-symbols-outlined">search</span>
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
        resultCount={favoriteGames.length}
        onClearAll={clearAllFilters}
      />

      {!cardView && activeFilterChips.length > 0 && (
        <div className="filter-chip-row">
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
        ) : cardView ? (
          <GameCardCarousel
            games={favoriteGames}
            onOpen={(g) => navigate(`/games/${g.id}`)}
            onEdit={(g) => navigate(`/games/${g.id}`)}
          />
        ) : (
          <div className="game-list">
            {letterGroups.map((group) => (
              <div key={group.letter} className="game-list-group">
                <div className="game-list-letter-heading">{group.letter}</div>
                {group.items.map((g) => (
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
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
