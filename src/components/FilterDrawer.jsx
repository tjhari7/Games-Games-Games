import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLAYER_OPTIONS, TIME_OPTIONS } from '../lib/filterOptions.js';
import { prefersReducedMotion } from '../lib/pageSwipe.js';

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
  types,
  typeFilter,
  setTypeFilter,
  playersFilter,
  setPlayersFilter,
  timeFilter,
  setTimeFilter,
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
    closeRef.current?.focus();
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
          <h2>Filters</h2>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close filters">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="filter-drawer-body">
          <section className="filter-drawer-group">
            <h3>Players</h3>
            <div className="filter-chip-options">
              {PLAYER_OPTIONS.map((n) => {
                const val = n === '8+' ? '8+' : n;
                const selected = playersFilter.includes(val);
                return (
                  <button
                    key={n}
                    type="button"
                    className={`filter-chip-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => setPlayersFilter(toggleIn(playersFilter, val))}
                  >
                    {n}
                    {selected && (
                      <span
                        className="material-symbols-outlined filter-chip-option__x"
                        aria-hidden="true"
                      >
                        close
                      </span>
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
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`filter-chip-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => setTimeFilter(toggleIn(timeFilter, opt.value))}
                  >
                    {opt.label}
                    {selected && (
                      <span
                        className="material-symbols-outlined filter-chip-option__x"
                        aria-hidden="true"
                      >
                        close
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="filter-drawer-group">
            <h3>Game Type</h3>
            <div className="filter-chip-options">
              {types.map((t) => {
                const selected = typeFilter.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`filter-chip-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleType(t.id)}
                  >
                    {t.name}
                    {selected && (
                      <span
                        className="material-symbols-outlined filter-chip-option__x"
                        aria-hidden="true"
                      >
                        close
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
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
