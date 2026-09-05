import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader.jsx';
import DiscoverGameCard from './DiscoverGameCard.jsx';
import BundleCard from './BundleCard.jsx';
import { api } from '../lib/api.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useDebounced, SEARCH_DEBOUNCE_MS } from '../lib/useDebounced.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { TYPE_ICONS, ALL_TYPE_ORDER, orderTypes } from '../lib/gameTypes.js';
import { BUNDLES, featuredGames, topRatedGames, bundleGames, metaFor, typeBundle } from '../lib/community.js';

// How many games the default "Top N Games" list shows.
const TOP_N = 10;

// The horizontal scope chips under the search bar. "Games" is the default —
// searching then matches game titles; "Types" matches on the game type name;
// "Bundles" searches every bundle on the page — the curated packs and the
// one-per-type Game Type Bundles — instead of individual games.
const SEARCH_SCOPES = [
  { id: 'games', label: 'Games' },
  { id: 'types', label: 'Game Types' },
  { id: 'bundles', label: 'Bundles' },
];

// The Browse Game Types carousel shows one 2x2 grid at a time; a swipe advances
// to the next four. Every game type is included, in the Game Types sheet's order.
const TYPES_PER_PAGE = 4;

// The empty search view (nothing typed yet) shows a short list of "recent
// searches". Nothing is actually tracked — Discover records nothing — so this
// is dressing: three terms are drawn at random from this pool, reshuffled every
// time the search view opens. Tapping one drops it into the search box.
const RECENT_SEARCH_POOL = [
  'Charades',
  'Mafia / Werewolf',
  'Fishbowl',
  'Pictionary',
  'Two Truths and a Lie',
  'Would You Rather',
  'Kings Cup',
  'Telephone Pictionary',
  'Fake Artist',
  '20 Questions',
  'Hot Seat',
  'Categories',
  'Wink Murder',
  'Icebreakers',
  'Voice Only',
];
const RECENT_SEARCH_COUNT = 3;

// Fisher–Yates over a copy; returns `n` random elements (or fewer if the source
// is short).
function sampleN(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// The Discover / Community page's contents, with the page shell and its swipe
// wiring left to the caller — the same split as Home / HomeContent, and for the
// same reason: the Game Types sheet renders a second, inert copy of the page it
// was opened from one screen above itself, so dragging the sheet down reveals
// that page instead of a bare backdrop. That copy passes no `onBack` and no
// swipe props, which makes it pure scenery; `aria-hidden` on the wrapper keeps
// it out of the tree.
//
// The list is the faked "community" catalog (real games wearing a social layer,
// see lib/community.js) and a rail of curated bundles sits above it. Search
// hides behind an icon in the header; opening it reveals a search bar that
// filters across every shared game, and the default list is just the ten
// highest-rated.
//
// "Save" here is a front-of-house gesture only: it's per-visit state held on
// this component, so the page opens with every game and bundle unsaved and
// resets the moment you leave. It never writes to the real favorites list.
export default function DiscoverContent({ swipeClass = '', rootProps = {}, onBack }) {
  const navigate = useNavigate();

  // Per-visit "saved" sets — start empty on every mount (see note above).
  const [savedGames, setSavedGames] = useState(() => new Set());
  const [savedBundles, setSavedBundles] = useState(() => new Set());

  const toggleGameSave = useCallback((id) => {
    setSavedGames((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBundleSave = useCallback((id) => {
    setSavedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [games, setGames] = useState(() => api.getCachedGames() || []);
  const [types, setTypes] = useState(() => api.getCachedGameTypes() || []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchScope, setSearchScope] = useState('games');
  const [listening, setListening] = useState(false);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const searchInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Locked while the search view is open — the top bar and search bar stay put
  // instead of scrolling away with the results.
  const { ref: headerRef } = useScrollBackHeader(!searchOpen);

  useEffect(() => {
    api.getGames().then(setGames).catch(() => {});
    api.getGameTypes().then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Every browsable type (never the protected "Unassigned" bucket), in the Game
  // Types sheet's order.
  const orderedTypes = useMemo(
    () =>
      orderTypes(
        types.filter((t) => !t.protected),
        ALL_TYPE_ORDER,
        { includeUnlisted: true },
      ),
    [types],
  );

  // The same types sliced into pages of four for the swipeable Browse grid.
  const typePages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < orderedTypes.length; i += TYPES_PER_PAGE) {
      pages.push(orderedTypes.slice(i, i + TYPES_PER_PAGE));
    }
    return pages;
  }, [orderedTypes]);

  // One "Game Type Bundle" per type — the type's whole catalog as a bundle
  // card. Types with no games yet are dropped rather than shown as empty.
  const typeBundleList = useMemo(
    () =>
      orderedTypes
        .map((t) => ({
          bundle: typeBundle(t),
          count: games.filter((g) => g.type_id === t.id).length,
        }))
        .filter((x) => x.count > 0),
    [orderedTypes, games],
  );

  // Everything shared, for search to run over; and the default top-rated slice.
  const allShared = useMemo(() => featuredGames(games), [games]);
  const topRated = useMemo(() => topRatedGames(games, TOP_N), [games]);

  // Empty-search dressing — three random terms, re-rolled every time the search
  // view opens (the dep intentionally includes `searchOpen` so a close/reopen
  // picks a fresh set).
  const recentSearches = useMemo(
    () => (searchOpen ? sampleN(RECENT_SEARCH_POOL, RECENT_SEARCH_COUNT) : []),
    [searchOpen],
  );

  const query = debouncedSearch.trim();
  const searching = query.length > 0;

  const filtered = useMemo(() => {
    if (!searching) return topRated;
    if (searchScope === 'bundles') return [];
    const q = query.toLowerCase();
    // "Types" scope matches only on the game type name (a type word pulls in
    // every game of that type); "Games" scope matches only on the title.
    return allShared.filter((g) =>
      searchScope === 'types'
        ? (g.type_name || '').toLowerCase().includes(q)
        : g.title.toLowerCase().includes(q),
    );
  }, [allShared, topRated, searching, query, searchScope]);

  const bundleCounts = useMemo(() => {
    const counts = {};
    BUNDLES.forEach((b) => {
      counts[b.id] = bundleGames(b.id, games).length;
    });
    return counts;
  }, [games]);

  // "Bundles" scope searches by name and blurb across both kinds of bundle:
  // the curated packs first, then the Game Type Bundles (same order as the
  // rails on the un-searched page). Each entry carries its own game count.
  const filteredBundles = useMemo(() => {
    if (!searching || searchScope !== 'bundles') return [];
    const q = query.toLowerCase();
    const curated = BUNDLES.map((b) => ({ bundle: b, count: bundleCounts[b.id] || 0 }));
    return [...curated, ...typeBundleList].filter(
      ({ bundle }) =>
        bundle.title.toLowerCase().includes(q) ||
        bundle.blurb.toLowerCase().includes(q),
    );
  }, [searching, searchScope, query, bundleCounts, typeBundleList]);

  function closeSearch() {
    setSearch('');
    setSearchScope('games');
    setSearchOpen(false);
  }

  // Same Web Speech dictation as the All Games search bar: tap to start, tap
  // again (or let it time out) to stop; the transcript drops straight into the
  // query.
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

  return (
    <div className={`page discover-page${searchOpen ? ' discover-search-open' : ''}${swipeClass}`} {...rootProps}>
      <div className="scroll-back-header" ref={headerRef}>
        <PageHeader
          title={searchOpen ? 'Search' : 'Discover'}
          titleSlot={<span className="page-title-eesti">{searchOpen ? 'Search' : 'Discover'}</span>}
          centered
          onBack={onBack}
          hideBack={searchOpen || !onBack}
          actions={
            <button
              className="icon-btn"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              aria-label={searchOpen ? 'Close search' : 'Search shared games'}
              aria-pressed={searchOpen}
            >
              <span className="material-symbols-outlined">{searchOpen ? 'close' : 'search'}</span>
            </button>
          }
        />

        {searchOpen && (
          <>
          <div className="search-row">
            <div className="search-bar">
              <span className="material-symbols-outlined">search</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by game, type, or bundle…"
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
          </div>

          <div className="discover-scope-chips" role="group" aria-label="Search scope">
            {SEARCH_SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip${searchScope === s.id ? ' active' : ''}`}
                aria-pressed={searchScope === s.id}
                onClick={() => setSearchScope(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          </>
        )}
      </div>

      {!searchOpen && (
        <div className="discover-section discover-bundles">
          <button
            className="discover-section__heading discover-section__heading-btn"
            onClick={() => navigate('/discover/bundles', { state: { discoverRise: true } })}
          >
            Bundles
            <span className="material-symbols-outlined discover-section__chevron">chevron_right</span>
          </button>
          <div className="bundle-rail">
            {BUNDLES.map((b) => (
              <BundleCard
                key={b.id}
                bundle={b}
                count={bundleCounts[b.id] || 0}
                isSaved={savedBundles.has(b.id)}
                onToggleSave={() => toggleBundleSave(b.id)}
                onOpen={() => navigate(`/discover/bundles/${b.id}`, { state: { discoverRise: true } })}
              />
            ))}
          </div>
        </div>
      )}

      {!searchOpen && typePages.length > 0 && (
        <div className="discover-section discover-types">
          <button
            className="discover-section__heading discover-section__heading-btn"
            onClick={() =>
              navigate('/game-types', {
                state: { swipeForward: true, sheetBackTo: '/discover' },
              })
            }
          >
            Browse Game Types
            <span className="material-symbols-outlined discover-section__chevron">chevron_right</span>
          </button>
          <div className="discover-type-rail">
            {typePages.map((page, i) => (
              <div className="discover-type-page" key={i}>
                {page.map((t) => (
                  <button
                    key={t.id}
                    className="btn-tertiary discover-type-tile"
                    style={{ background: typePillColor(t.name, t.bg), color: TYPE_TEXT_COLOR }}
                    onClick={() =>
                      navigate(`/games/type/${t.id}`, { state: { discoverRise: true } })
                    }
                  >
                    {TYPE_ICONS[t.name] ? (
                      <img
                        src={TYPE_ICONS[t.name]}
                        alt={t.name}
                        className={
                          t.name === 'Sound' || t.name === 'Guessing'
                            ? 'home-type-icon home-type-icon-taller'
                            : t.name === 'Writing'
                              ? 'home-type-icon home-type-icon-writing'
                              : 'home-type-icon'
                        }
                      />
                    ) : (
                      t.name
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!searchOpen && typeBundleList.length > 0 && (
        <div className="discover-section discover-type-bundles">
          <h2 className="discover-section__heading">Game Type Bundles</h2>
          <div className="bundle-rail">
            {typeBundleList.map(({ bundle, count }) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                count={count}
                isSaved={savedBundles.has(bundle.id)}
                onToggleSave={() => toggleBundleSave(bundle.id)}
                onOpen={() => navigate(`/discover/bundles/${bundle.id}`, { state: { discoverRise: true } })}
              />
            ))}
          </div>
        </div>
      )}

      <div className="page-content discover-page-content">
        {!searchOpen && <h2 className="discover-section__heading">Top 10 Games</h2>}

        {/* Nothing typed yet: show the (faked) recent searches. Starts 32px
            below the scope chips. */}
        {searchOpen && !searching && (
          <div className="discover-search-suggestions">
            <section className="discover-suggest">
              <h3 className="discover-suggest__label">Recent searches</h3>
              <ul className="discover-recent-list">
                {recentSearches.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      className="discover-recent-row"
                      onClick={() => {
                        setSearchScope('games');
                        setSearch(term);
                        searchInputRef.current?.focus();
                      }}
                    >
                      <span className="material-symbols-outlined discover-recent-row__icon">history</span>
                      <span className="discover-recent-row__text">{term}</span>
                      <span className="material-symbols-outlined discover-recent-row__go">north_west</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* Search view stays empty until there's a query — then it's just the
            matching results, no bundles/types/Top 5 chrome. The "Bundles" scope
            chip swaps the game results for matching bundles — the curated packs
            and the Game Type Bundles together. */}
        {searchOpen && searching && searchScope === 'bundles' ? (
          filteredBundles.length === 0 ? (
            <p className="state-message">No bundles match “{query}”.</p>
          ) : (
            <div className="bundle-list">
              {filteredBundles.map(({ bundle, count }) => (
                <BundleCard
                  key={bundle.id}
                  bundle={bundle}
                  count={count}
                  isSaved={savedBundles.has(bundle.id)}
                  onToggleSave={() => toggleBundleSave(bundle.id)}
                  onOpen={() => navigate(`/discover/bundles/${bundle.id}`, { state: { discoverRise: true } })}
                />
              ))}
            </div>
          )
        ) : (
          (!searchOpen || searching) &&
          (filtered.length === 0 ? (
            <p className="state-message">No shared games match “{query}”.</p>
          ) : (
            <div className={`game-list${searching ? '' : ' discover-top-rail'}`}>
              {filtered.map((g) => (
                <DiscoverGameCard
                  key={g.id}
                  game={g}
                  meta={metaFor(g.title)}
                  isSaved={savedGames.has(g.id)}
                  onToggleSave={() => toggleGameSave(g.id)}
                  onOpen={() => navigate(`/discover/games/${g.id}`, { state: { discoverRise: true } })}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
