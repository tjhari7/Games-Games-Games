import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import FilterPopover from '../components/FilterPopover.jsx';
import GameCardCarousel from '../components/GameCardCarousel.jsx';
import ViewModeToggle from '../components/ViewModeToggle.jsx';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { TIME_OPTIONS } from '../lib/filterOptions.js';
import { groupByLetter } from '../lib/alphabetIndex.js';
import { scrollPageTo } from '../lib/pageScroll.js';
import { useScrollRestoration } from '../lib/useScrollRestoration.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useHorizontalSwipeToHome } from '../lib/pageSwipe.js';
import { CARD_VIEW, useGameViewMode } from '../lib/useGameViewMode.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import StarRating from '../components/StarRating.jsx';

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function FavoriteGames() {
  const navigate = useNavigate();
  // Sits to Home's left, same as the menu: in from the left, back off to the
  // left. See lib/pageSwipe.js.
  const { startBack, swipeClass, rootProps } = useHorizontalSwipeToHome();
  // Header, search and filter ride in one block that scrolls away downward and
  // comes back on any upward scroll. See lib/useScrollBackHeader.js.
  const { ref: headerRef } = useScrollBackHeader();
  const [viewMode, setViewMode] = useGameViewMode();
  const { isFavorite } = useFavoriteGames();
  const { getRating } = useGameRatings();
  const [types, setTypes] = useState([]);
  // null until loaded, so the search placeholder below doesn't flash "0"
  // before the real count is known.
  const [allGames, setAllGames] = useState(null);
  const [games, setGames] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [playersFilter, setPlayersFilter] = useState(null);
  const [timeFilter, setTimeFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const cardView = viewMode === CARD_VIEW;

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
  const hasActiveQuery = !!search.trim() || !!typeFilter || !!playersFilter || !!timeFilter;

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (typeFilter) {
      const typeName = types.find((t) => t.id === typeFilter)?.name;
      if (typeName) chips.push({ key: 'type', label: typeName, onRemove: () => setTypeFilter(null) });
    }
    if (playersFilter) {
      chips.push({ key: 'players', label: `${playersFilter} Players`, onRemove: () => setPlayersFilter(null) });
    }
    if (timeFilter) {
      const timeLabel = TIME_OPTIONS.find((o) => o.value === timeFilter)?.label;
      if (timeLabel) chips.push({ key: 'time', label: timeLabel, onRemove: () => setTimeFilter(null) });
    }
    return chips;
  }, [typeFilter, playersFilter, timeFilter, types]);

  function clearAllFilters() {
    setTypeFilter(null);
    setPlayersFilter(null);
    setTimeFilter(null);
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
    api.getGames().then(setAllGames).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (typeFilter) params.type_id = typeFilter;
    if (playersFilter) params.players = playersFilter;
    if (timeFilter) params.time_bucket = timeFilter;

    api
      .getGames(params)
      .then((data) => {
        if (!cancelled) setGames(data);
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
  }, [search, typeFilter, playersFilter, timeFilter]);

  return (
    <div className={`page${swipeClass}`} {...rootProps}>
      <div className="scroll-back-header" ref={headerRef}>
        <PageHeader
          title="Favorite Games"
          centered
          tight
          onBack={startBack}
          actions={<ViewModeToggle mode={viewMode} onChange={setViewMode} />}
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

            <FilterPopover
              types={types}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              playersFilter={playersFilter}
              setPlayersFilter={setPlayersFilter}
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
              fields={['type', 'players', 'time']}
              iconOnly
            />
          </div>
        )}
      </div>

      {!cardView && activeFilterChips.length > 0 && (
        <div className="filter-chip-row">
          {activeFilterChips.map((chip) => (
            <span className="filter-chip" key={chip.key}>
              {chip.label}
              <button onClick={chip.onRemove} aria-label={`Remove ${chip.label} filter`} type="button">
                <span className="material-symbols-outlined">close</span>
              </button>
            </span>
          ))}
          {activeFilterChips.length >= 2 && (
            <button className="filter-clear-all" onClick={clearAllFilters} type="button">
              Clear All
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="state-message">Loading…</p>
      ) : favoriteGames.length === 0 ? (
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
  );
}
