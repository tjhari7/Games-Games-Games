import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Card view is being tried out on one type page before it goes to the rest of
// them. Set to null to offer it on every type page.
const CARD_VIEW_TYPES = ['act out'];

export default function CategoryGames() {
  const navigate = useNavigate();
  // Sits to Home's left, so it comes in from the left and leaves back off to
  // the left. See lib/pageSwipe.js.
  const { startBack, swipeClass, rootProps } = useHorizontalSwipeToHome();
  // Header, search and filter ride in one block that scrolls away downward and
  // comes back on any upward scroll. See lib/useScrollBackHeader.js.
  const { ref: headerRef } = useScrollBackHeader();
  const [viewMode, setViewMode] = useGameViewMode();
  const { typeId } = useParams();
  const [type, setType] = useState(null);
  const [games, setGames] = useState([]);
  const [search, setSearch] = useState('');
  const [playersFilter, setPlayersFilter] = useState(null);
  const [timeFilter, setTimeFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const recognitionRef = useRef(null);

  const letterGroups = useMemo(() => groupByLetter(games, (g) => g.title), [games]);

  const cardViewOffered = !!type && (!CARD_VIEW_TYPES || CARD_VIEW_TYPES.includes(type.name.toLowerCase()));
  const cardView = cardViewOffered && viewMode === CARD_VIEW;

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (playersFilter) {
      chips.push({ key: 'players', label: `${playersFilter} Players`, onRemove: () => setPlayersFilter(null) });
    }
    if (timeFilter) {
      const timeLabel = TIME_OPTIONS.find((o) => o.value === timeFilter)?.label;
      if (timeLabel) chips.push({ key: 'time', label: timeLabel, onRemove: () => setTimeFilter(null) });
    }
    return chips;
  }, [playersFilter, timeFilter]);

  function clearAllFilters() {
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
    api
      .getGameTypes()
      .then((types) => setType(types.find((t) => t.id === typeId) || null))
      .catch((err) => setError(err.message));
    api
      .getGames({ type_id: typeId })
      .then((data) => setTotalCount(data.length))
      .catch((err) => setError(err.message));
  }, [typeId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { type_id: typeId };
    if (search.trim()) params.search = search.trim();
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
  }, [typeId, search, playersFilter, timeFilter]);

  return (
    <div className={`page${swipeClass}`} {...rootProps}>
      <div className="scroll-back-header" ref={headerRef}>
        <PageHeader
          title={type ? `${type.name} Games` : 'Games'}
          centered
          tight
          onBack={startBack}
          actions={cardViewOffered ? <ViewModeToggle mode={viewMode} onChange={setViewMode} /> : null}
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

            <FilterPopover
              playersFilter={playersFilter}
              setPlayersFilter={setPlayersFilter}
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
              fields={['players', 'time']}
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
      ) : games.length === 0 ? (
        <p className="state-message">No games found.</p>
      ) : cardView ? (
        <GameCardCarousel
          games={games}
          onOpen={(g) => navigate(`/games/${g.id}`)}
          onEdit={(g) => navigate(`/games/${g.id}`)}
        />
      ) : (
        <div className="game-list">
          {letterGroups.map((group) => (
            <div key={group.letter} className="game-list-group">
              <div className="game-list-letter-heading">{group.letter}</div>
              {group.items.map((g) => (
                <div className="game-list-item" key={g.id}>
                  <div className="game-list-item-header">
                    <span
                      className="type-tag game-list-item-type"
                      style={{ color: TYPE_TEXT_COLOR, background: typePillColor(g.type_name, g.type_bg) }}
                    >
                      {g.type_name}
                    </span>
                    <div className="game-list-item-actions">
                      <button className="icon-btn" onClick={() => navigate(`/games/${g.id}`)} aria-label="View">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                  <div className="game-list-item-main" onClick={() => navigate(`/games/${g.id}`)}>
                    <div className="game-list-item-title">{g.title}</div>
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
