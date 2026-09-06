import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { createPortal } from 'react-dom';
import { PLAYER_OPTIONS, TIME_OPTIONS } from '../lib/filterOptions.js';
import { prefersReducedMotion } from '../lib/pageSwipe.js';
import SortSelect from './SortSelect.jsx';

// Full-height filter panel for the two list pages whose filter set — every game
// type, plus players and time — is too tall for the little popover the category
// pages share (All Games, Favorite Games).
//
// Two rules govern how it moves, and both are the reason it is built the way it
// is rather than with `motion` like the rest of the app:
//
// 1. The page behind it must not move at all. So the drawer is portalled OUT of
//    `.page` — as a child it sat inside `.page.swipe-* > *`, the selector that
//    animates every page child on a route change, and inside the subtree
//    useScrollBackHeader measures and the swipe machinery watches. Rendering it
//    beside the page instead leaves all of that untouched. It portals into
//    `.device-frame` rather than `<body>` so `position: fixed` keeps resolving
//    to the phone frame on desktop (the frame has a transform), exactly like
//    the FAB and the confirm modal.
// 2. It slides, and nothing fades. A plain CSS transform transition, the same
//    duration and curve in both directions, so closing retraces the opening.
//    The scrim is a hard cut — no opacity animation anywhere.
const SLIDE_MS = 300;

function useDrawerPresence(open) {
  // `mounted` outlives `open` by one slide so the exit can play. There is no
  // "now animate" flag to flip: the slide is a CSS keyframe animation, which
  // starts on its own the moment the element is inserted. Deferring a class to
  // a later frame — the usual transition dance — is what a throttled or hidden
  // tab silently swallows, leaving the drawer parked off-screen.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  // Whether the drawer is on screen right now, readable synchronously. A state
  // updater is not the place to decide this: updaters must stay pure, and React
  // may run them more than once, which would double-schedule the exit.
  const onScreenRef = useRef(open);

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (open) {
      onScreenRef.current = true;
      setClosing(false);
      setMounted(true);
      return undefined;
    }

    // Nothing to play out if it was never on screen.
    if (!onScreenRef.current) return undefined;

    if (prefersReducedMotion()) {
      onScreenRef.current = false;
      setMounted(false);
      return undefined;
    }

    setClosing(true);
    // Backstop for the exit: a frozen or throttled tab may never fire
    // animationend, and without this the drawer would stay mounted for good.
    timerRef.current = setTimeout(() => {
      onScreenRef.current = false;
      setMounted(false);
      setClosing(false);
    }, SLIDE_MS + 60);

    return () => clearTimeout(timerRef.current);
  }, [open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onExited = () => {
    clearTimeout(timerRef.current);
    onScreenRef.current = false;
    setMounted(false);
    setClosing(false);
  };

  return { mounted, closing, onExited };
}

export default function FilterDrawer({
  open,
  onClose,
  // Game Type is irrelevant on a single type's own page — you're already
  // looking at just that type — so a category page omits `types` and this
  // stays false, and the whole section (and its contribution to the active
  // count) drops out.
  showTypeFilter = true,
  types = [],
  // Per-type game count, keyed by type id — shown greyed in parens after each
  // Game Type chip. Defaults to empty so a caller that doesn't pass it just
  // renders the chips without a number.
  typeCounts = {},
  typeFilter = [],
  setTypeFilter = () => {},
  playersFilter,
  setPlayersFilter,
  timeFilter,
  setTimeFilter,
  // Per-option game counts for the Players / Time chips, keyed by option value
  // and each narrowed by the *other* filter groups. An option that would leave
  // nothing (count 0) renders disabled rather than gone, so the row still shows
  // what the category could offer. Omitted (empty) = every option stays live.
  playersCounts = {},
  timeCounts = {},
  sort,
  setSort,
  sortOptions,
  sortCounts,
  resultCount,
  onClearAll,
}) {
  const closeRef = useRef(null);
  const { mounted, closing, onExited } = useDrawerPresence(open);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    // preventScroll — see the matching note in KebabMenu: focusing a control
    // that is still parked outside the frame scrolls .device-frame to chase it.
    closeRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  // Players, time and game type are all multi-select — tapping a chip adds or
  // removes its value from the list, and a game matches if it fits any one of
  // them (the server ORs within each group).
  const toggleIn = (list, value) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  function toggleType(id) {
    setTypeFilter(toggleIn(typeFilter, id));
  }

  const activeCount = typeFilter.length + playersFilter.length + timeFilter.length;

  const drawer = (
    <div className={`filter-drawer-scrim ${closing ? 'is-closing' : ''}`} onClick={onClose}>
      <div
        className={`filter-drawer ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          if (e.animationName === 'filter-drawer-out') onExited();
        }}
      >
        <div className="filter-drawer-header">
          <h2>Filter</h2>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close filters">
            <Icon name="close" />
          </button>
        </div>

        <div className="filter-drawer-body">
          {/* Sort sits above the filters, and deliberately outside the active
              count and Clear All below: it reorders the list rather than
              narrowing it, so it isn't something to clear. */}
          <section className="filter-drawer-group">
            <h3>Sort By</h3>
            <SortSelect value={sort} onChange={setSort} options={sortOptions} counts={sortCounts} />
          </section>

          <section className="filter-drawer-group">
            <h3>Players</h3>
            <div className="filter-chip-options">
              {PLAYER_OPTIONS.map((n) => {
                const val = n === '8+' ? '8+' : n;
                const selected = playersFilter.includes(val);
                // A picked chip stays live so it can be toggled back off, even
                // once its own narrowing has emptied the list.
                const disabled = !selected && playersCounts[val] === 0;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`filter-chip-option ${selected ? 'is-selected' : ''}`}
                    disabled={disabled}
                    onClick={() => setPlayersFilter(toggleIn(playersFilter, val))}
                  >
                    {n}
                    {selected && (
                      <Icon name="close" className="filter-chip-option__x" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="filter-drawer-group">
            <h3>Time</h3>
            <div className="filter-chip-options">
              {TIME_OPTIONS.map((opt) => {
                const selected = timeFilter.includes(opt.value);
                const disabled = !selected && timeCounts[opt.value] === 0;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`filter-chip-option ${selected ? 'is-selected' : ''}`}
                    disabled={disabled}
                    onClick={() => setTimeFilter(toggleIn(timeFilter, opt.value))}
                  >
                    {opt.label}
                    {selected && (
                      <Icon name="close" className="filter-chip-option__x" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {showTypeFilter && (
            <section className="filter-drawer-group">
              <h3>Game Type</h3>
              <div className="filter-chip-options">
                {types.map((t) => {
                  const selected = typeFilter.includes(t.id);
                  // Same rule as Players / Time: a type with nothing behind it
                  // dims out rather than disappearing, and a picked chip stays
                  // live so it can be toggled back off.
                  const disabled = !selected && typeCounts[t.id] === 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`filter-chip-option ${selected ? 'is-selected' : ''}`}
                      disabled={disabled}
                      onClick={() => toggleType(t.id)}
                    >
                      {t.name}
                      {typeCounts[t.id] > 0 && (
                        <span className="filter-chip-option__count">
                          ({typeCounts[t.id]})
                        </span>
                      )}
                      {selected && (
                        <Icon name="close" className="filter-chip-option__x" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="filter-drawer-footer">
          {activeCount > 0 && (
            <button
              type="button"
              className="filter-clear-all filter-drawer-clear"
              onClick={onClearAll}
            >
              Clear All
            </button>
          )}
          <button className="btn btn-neutral" onClick={onClose}>
            Apply{typeof resultCount === 'number' ? ` (${resultCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );

  // The frame is the containing block for fixed chrome on desktop; on a phone it
  // is an inert wrapper and fixed resolves to the viewport either way.
  return createPortal(drawer, document.querySelector('.device-frame') || document.body);
}
