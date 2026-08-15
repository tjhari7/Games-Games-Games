import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import FilterPopover from '../components/FilterPopover.jsx';
import AlphabetIndex from '../components/AlphabetIndex.jsx';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { TIME_OPTIONS } from '../lib/filterOptions.js';
import { groupByLetter } from '../lib/alphabetIndex.js';
import { fastScrollTo } from '../lib/smoothScroll.js';
import { offsetWithinScroller } from '../lib/pageScroll.js';
import { useScrollRestoration } from '../lib/useScrollRestoration.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useHorizontalSwipeToHome } from '../lib/pageSwipe.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import StarRating from '../components/StarRating.jsx';

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Breathing room between the bottom of the pinned header and the letter
// heading a jump lands on.
const JUMP_GAP = 16;

export default function AllGames() {
  const navigate = useNavigate();
  // The menu sits to Home's left, so it comes in from the left and leaves back
  // off to the left. See lib/pageSwipe.js.
  const { startBack, swipeClass, rootProps } = useHorizontalSwipeToHome();
  // Header, search and filter ride in one block that scrolls away downward and
  // comes back on any upward scroll. See lib/useScrollBackHeader.js.
  const { ref: headerRef, pinOpen: pinHeaderOpen, releasePin: releaseHeaderPin } = useScrollBackHeader();
  const { isFavorite } = useFavoriteGames();
  const { getRating } = useGameRatings();
  const [types, setTypes] = useState([]);
  const [games, setGames] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [playersFilter, setPlayersFilter] = useState(null);
  const [timeFilter, setTimeFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const sectionRefs = useRef({});
  const recognitionRef = useRef(null);

  const letterGroups = useMemo(() => groupByLetter(games, (g) => g.title), [games]);
  const presentLetters = useMemo(() => new Set(letterGroups.map((g) => g.letter)), [letterGroups]);

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

  // While a filter is active, reflect the filtered result count; otherwise
  // show the unfiltered total (fetched once, unaffected by search-driven loading).
  const displayCount = activeFilterChips.length > 0 ? games.length : totalCount;

  useScrollRestoration(!loading);

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
    api
      .getGames()
      .then((data) => setTotalCount(data.length))
      .catch((err) => setError(err.message));
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
          title="All Games"
          centered
          onBack={startBack}
          actions={
            <button className="icon-btn" onClick={() => navigate('/types')} aria-label="Edit Game Types">
              <span className="material-symbols-outlined">more_vert</span>
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
      </div>

      {activeFilterChips.length > 0 && (
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
      ) : (
        <>
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

          <AlphabetIndex presentLetters={presentLetters} onSelect={jumpToLetter} />
        </>
      )}

      <button className="fab" onClick={() => navigate('/games/new')} aria-label="Add Game">
        <span className="material-symbols-outlined">add</span>
        ADD
      </button>
    </div>
  );
}
