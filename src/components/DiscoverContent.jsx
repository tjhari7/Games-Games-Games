import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader.jsx';
import DiscoverGameCard from './DiscoverGameCard.jsx';
import BundleCard from './BundleCard.jsx';
import { api } from '../lib/api.js';
import { useScrollBackHeader } from '../lib/useScrollBackHeader.js';
import { useDebounced, SEARCH_DEBOUNCE_MS } from '../lib/useDebounced.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { TYPE_ICONS, ALL_TYPE_ORDER, orderTypes } from '../lib/gameTypes.js';
import { BUNDLES, featuredGames, topRatedGames, bundleGames, metaFor, typeBundle, TOP_SAVES } from '../lib/community.js';
import { prefersReducedMotion } from '../lib/pageSwipe.js';
import { useDiscoverSaves } from '../lib/discoverSaves.js';

// How many games the default "Top N Games" list shows.
const TOP_N = 10;

// Search rises up from the bottom of the screen over a static Discover and drops
// back down the same way on close — a 300ms /
// cubic-bezier(0.17, 0.84, 0.44, 1) overlay (see .discover-search-panel in
// index.css; keep this in sync). `closing` outlives `open` by one slide so the
// exit keyframe can play, with a timer backstop for a throttled tab that never
// fires animationend.
const SEARCH_RISE_MS = 300;

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
// "Save" here is a front-of-house gesture only: per-visit state kept in
// lib/discoverSaves.js (shared with the bundle detail page so the two never
// disagree), reset only when navigation leaves /discover. It never writes to the
// real favorites list.
export default function DiscoverContent({ swipeClass = '', rootProps = {}, onBack }) {
  const navigate = useNavigate();

  // Per-visit "saved" state, shared with the bundle detail page and reset only
  // when navigation leaves /discover (see lib/discoverSaves.js).
  const { isGameSaved, isBundleSaved, toggleGameSave, toggleBundleSave } = useDiscoverSaves();

  const [games, setGames] = useState(() => api.getCachedGames() || []);
  const [types, setTypes] = useState(() => api.getCachedGameTypes() || []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  // Drops the entrance keyframe once it has played, so the class isn't left on.
  const [searchEntered, setSearchEntered] = useState(false);
  const [search, setSearch] = useState('');
  const [searchScope, setSearchScope] = useState('games');
  const [listening, setListening] = useState(false);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const searchInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const searchCloseTimer = useRef(null);
  const searchEnterTimer = useRef(null);

  // The search panel is on screen while it is open or still sliding shut.
  const searchMounted = searchOpen || searchClosing;

  useEffect(
    () => () => {
      clearTimeout(searchCloseTimer.current);
      clearTimeout(searchEnterTimer.current);
    },
    [],
  );

  // Backstop the entrance keyframe's animationend, which a throttled or hidden
  // tab may never deliver — the class must still come back off.
  useEffect(() => {
    if (!searchOpen || searchEntered) return undefined;
    searchEnterTimer.current = setTimeout(() => setSearchEntered(true), SEARCH_RISE_MS + 60);
    return () => clearTimeout(searchEnterTimer.current);
  }, [searchOpen, searchEntered]);

  // Locked while the search view is open — the top bar and search bar stay put
  // instead of scrolling away with the results.
  const { ref: headerRef } = useScrollBackHeader(true);

  useEffect(() => {
    api.getGames().then(setGames).catch(() => {});
    api.getGameTypes().then(setTypes).catch(() => {});
  }, []);

  // `preventScroll` is load-bearing on desktop, not a nicety. The panel starts
  // its rise parked a full frame below the screen, so focusing the input inside
  // it asks the browser to scroll that input into view — and the only scrollport
  // above it is .device-frame, which is `overflow: hidden` but still scrollable
  // programmatically *and* carries the translateZ(0) that makes it the
  // containing block for the fixed .discover-search-scrim. Scrolling it drags
  // the scrim up by exactly as much as the keyframe moves the panel down, so the
  // slide cancels out 1:1 and search appears in a hard cut. Closing has no
  // focus() and so always looked right; phones have no framed scrollport at all,
  // which is why this only ever showed up above 600px.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus({ preventScroll: true });
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
  // picks a fresh set). Held through the close slide so the list doesn't vanish
  // a frame before the panel does.
  const recentSearches = useMemo(
    () => (searchMounted ? sampleN(RECENT_SEARCH_POOL, RECENT_SEARCH_COUNT) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Each bundle's game ids, for both kinds of bundle (curated + one-per-type).
  // "Saved" for a bundle is derived from these — every game in it saved — so the
  // card and the detail page always agree. `bundleCounts` reads off the same map.
  const bundleGameIds = useMemo(() => {
    const map = {};
    BUNDLES.forEach((b) => {
      map[b.id] = bundleGames(b.id, games).map((g) => g.id);
    });
    typeBundleList.forEach(({ bundle }) => {
      map[bundle.id] = bundleGames(bundle.id, games).map((g) => g.id);
    });
    return map;
  }, [games, typeBundleList]);

  const bundleCounts = useMemo(() => {
    const counts = {};
    BUNDLES.forEach((b) => {
      counts[b.id] = (bundleGameIds[b.id] || []).length;
    });
    return counts;
  }, [bundleGameIds]);

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

  function openSearch() {
    clearTimeout(searchCloseTimer.current);
    setSearchClosing(false);
    // With motion, the entrance keyframe's animationend drops this; without it
    // there is no event, so settle immediately.
    setSearchEntered(prefersReducedMotion());
    setSearchOpen(true);
  }

  // Clears the query only once the panel is gone, so results don't blank out
  // mid-slide.
  function finishSearchClose() {
    clearTimeout(searchCloseTimer.current);
    setSearchClosing(false);
    setSearch('');
    setSearchScope('games');
  }

  function closeSearch() {
    setSearchOpen(false);
    if (prefersReducedMotion()) {
      finishSearchClose();
      return;
    }
    setSearchClosing(true);
    searchCloseTimer.current = setTimeout(finishSearchClose, SEARCH_RISE_MS + 60);
  }

  // Only the panel's own rise keyframes land here; the page's swipe animation
  // (useMenuOverlaySwipe) uses different names and is handled on the root.
  function onSearchPanelAnimEnd(e) {
    if (e.animationName === 'discover-rise-out') finishSearchClose();
    else if (e.animationName === 'discover-rise-in') setSearchEntered(true);
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
    <div className={`page discover-page${swipeClass}`} {...rootProps}>
      <div className="scroll-back-header" ref={headerRef}>
        <PageHeader
          title="Discover"
          titleSlot={<span className="page-title-eesti">Discover</span>}
          centered
          onBack={onBack}
          hideBack={!onBack}
          actions={
            <button
              className="icon-btn"
              onClick={openSearch}
              aria-label="Search shared games"
            >
              <Icon name="search" />
            </button>
          }
        />
      </div>

      <div className="discover-section discover-bundles">
        <button
          className="discover-section__heading discover-section__heading-btn"
          onClick={() => navigate('/discover/bundles', { state: { swipeForwardFromRight: true } })}
        >
          Bundles
          <Icon name="chevron_right" className="discover-section__chevron" />
        </button>
        <div className="bundle-rail">
          {BUNDLES.map((b) => (
            <BundleCard
              key={b.id}
              bundle={b}
              count={bundleCounts[b.id] || 0}
              isSaved={isBundleSaved(bundleGameIds[b.id] || [])}
              onToggleSave={() => toggleBundleSave(bundleGameIds[b.id] || [])}
              onOpen={() => navigate(`/discover/bundles/${b.id}`, { state: { swipeForwardFromRight: true } })}
            />
          ))}
        </div>
      </div>

      <div className="discover-section discover-page-content">
        <h2 className="discover-section__heading">Top 10 Games</h2>
        {topRated.length > 0 && (
          <div className="game-list discover-top-rail">
            {topRated.map((g, i) => (
              <DiscoverGameCard
                key={g.id}
                game={g}
                meta={{ ...metaFor(g.title), savedCount: TOP_SAVES[i] ?? metaFor(g.title).savedCount }}
                isSaved={isGameSaved(g.id)}
                onToggleSave={() => toggleGameSave(g.id)}
                onOpen={() => navigate(`/discover/games/${g.id}`, { state: { swipeForwardFromRight: true } })}
              />
            ))}
          </div>
        )}
      </div>

      {typePages.length > 0 && (
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
            <Icon name="chevron_right" className="discover-section__chevron" />
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
                      navigate(`/games/type/${t.id}`, {
                        state: { swipeForwardFromRight: true, backTo: '/discover' },
                      })
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

      {typeBundleList.length > 0 && (
        <div className="discover-section discover-type-bundles">
          <h2 className="discover-section__heading">Game Type Bundles</h2>
          <div className="bundle-rail">
            {typeBundleList.map(({ bundle, count }) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                count={count}
                isSaved={isBundleSaved(bundleGameIds[bundle.id] || [])}
                onToggleSave={() => toggleBundleSave(bundleGameIds[bundle.id] || [])}
                onOpen={() => navigate(`/discover/bundles/${bundle.id}`, { state: { swipeForwardFromRight: true } })}
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="discover-view-all-btn"
        onClick={() => navigate('/games', { state: { swipeForwardFromRight: true, backTo: '/discover' } })}
      >
        View All Games
      </button>

      {/* Search over a Discover that never moves: a full-screen dim that only
          fades its opacity up (already in final position), and the opaque search
          panel sliding up from below to cover it — and so the whole page —
          entirely. Both on the 300ms search timing. */}
      {searchMounted && (
        <div
          className={`discover-search-scrim${searchClosing ? ' discover-search-scrim--closing' : ''}`}
        >
          <div
            className={`discover-search-panel${
              searchClosing ? ' discover-rise-leaving' : searchEntered ? '' : ' discover-rise-entering'
            }`}
            onAnimationEnd={onSearchPanelAnimEnd}
          >
          <div className="scroll-back-header">
            <PageHeader
              title="Search"
              titleSlot={<span className="page-title-eesti">Search</span>}
              centered
              hideBack
              actions={
                <button
                  className="icon-btn"
                  onClick={closeSearch}
                  aria-label="Close search"
                >
                  <Icon name="close" />
                </button>
              }
            />

            <div className="search-row">
              <div className="search-bar">
                <Icon name="search" />
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
          </div>

          <div className="page-content discover-page-content">
            {/* Nothing typed yet: show the (faked) recent searches. Starts 32px
                below the scope chips. */}
            {!searching && (
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
                          <Icon name="history" className="discover-recent-row__icon" />
                          <span className="discover-recent-row__text">{term}</span>
                          <Icon name="north_west" className="discover-recent-row__go" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {/* Search view stays empty until there's a query — then it's just the
                matching results, no bundles/types/Top 5 chrome. The "Bundles"
                scope chip swaps the game results for matching bundles — the
                curated packs and the Game Type Bundles together. */}
            {searching && searchScope === 'bundles' ? (
              filteredBundles.length === 0 ? (
                <p className="state-message">No bundles match “{query}”.</p>
              ) : (
                <div className="bundle-list">
                  {filteredBundles.map(({ bundle, count }) => (
                    <BundleCard
                      key={bundle.id}
                      bundle={bundle}
                      count={count}
                      isSaved={isBundleSaved(bundleGameIds[bundle.id] || [])}
                      onToggleSave={() => toggleBundleSave(bundleGameIds[bundle.id] || [])}
                      onOpen={() => navigate(`/discover/bundles/${bundle.id}`, { state: { swipeForwardFromRight: true } })}
                    />
                  ))}
                </div>
              )
            ) : (
              searching &&
              (filtered.length === 0 ? (
                <p className="state-message">No shared games match “{query}”.</p>
              ) : (
                <div className="game-list">
                  {filtered.map((g) => (
                    <DiscoverGameCard
                      key={g.id}
                      game={g}
                      meta={metaFor(g.title)}
                      isSaved={isGameSaved(g.id)}
                      onToggleSave={() => toggleGameSave(g.id)}
                      onOpen={() => navigate(`/discover/games/${g.id}`, { state: { swipeForwardFromRight: true } })}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
