import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSwipeToHome, prefersReducedMotion, ENTER_MS } from '../lib/pageSwipe.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { TYPE_ICONS, ALL_TYPE_ORDER, orderTypes } from '../lib/gameTypes.js';
import HomeContent from '../components/HomeContent.jsx';

// How far the sheet has to be pulled down before letting go closes it, and the
// flick speed that closes it whatever distance it covered.
const CLOSE_DISTANCE = 72; // px
const CLOSE_VELOCITY = 0.5; // px per ms
// Under this much travel the gesture was a tap on the grab bar, not a drag —
// which closes the sheet too. Measured against the furthest the finger ever got
// from where it went down, so a pull that returns to the top isn't mistaken for
// one.
const TAP_SLOP = 6; // px
// Velocity is measured over at least a frame. Pointer events can arrive
// coalesced, well under a millisecond apart, and dividing by that interval
// yields a bogus speed that reads every small nudge as a flick.
const VELOCITY_SAMPLE_MS = 16;
// There is nothing above the sheet to reveal, so an upward pull only stretches.
const RUBBER_BAND = 0.3;
const SPRING_BACK_MS = 220;
// Home's own return curve, borrowed for the close so a pull that the finger
// started is finished in the same motion — and so tapping to close looks
// exactly like dragging all the way down.
const CLOSE_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Drives the strip: the sheet and the copy of Home sitting one screen above it
 * move together, so pulling the sheet down slides Home back into view behind it
 * rather than opening onto a bare backdrop.
 *
 * Both transforms are written straight to the DOM rather than going through
 * state — a React render per pointermove would cost frames.
 *
 * Closing is a pan rather than the shared leave animation. That animation drops
 * the page off the bottom and lets the *next* page play its own entrance, which
 * would snap Home from wherever the drag had pulled it back up off-screen to
 * start again. Panning the strip to its end and then landing on Home with no
 * entrance keeps one continuous movement, however the close was triggered.
 */
function useSheetStrip() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const sheetRef = useRef(null);
  const behindRef = useRef(null);
  const dragRef = useRef(null);
  const closingRef = useRef(false);
  const timerRef = useRef(null);
  // Home is only mounted once something is going to reveal it. Left mounted from
  // the start it would catch the sheet's own entrance animation — which moves
  // every child of the page — and flash a whole screen of Home on the way in.
  const [revealing, setRevealing] = useState(false);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const applyPull = useCallback((dy) => {
    if (sheetRef.current) sheetRef.current.style.transform = dy ? `translateY(${dy}px)` : '';
    // -100% parks Home exactly one screen up, so its bottom edge always meets
    // the sheet's top edge and the two read as one strip.
    if (behindRef.current) behindRef.current.style.transform = `translateY(calc(-100% + ${dy}px))`;
  }, []);

  const setTransition = useCallback((value) => {
    for (const el of [sheetRef.current, behindRef.current]) {
      if (el) el.style.transition = value;
    }
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) {
      navigate('/');
      return;
    }
    // Mount Home before measuring, so a close that did not come from a drag
    // still has something to pull down. flushSync rather than an effect: the
    // transforms below need the node in the DOM this tick.
    flushSync(() => setRevealing(true));
    const travel = pageRef.current?.getBoundingClientRect().height ?? window.innerHeight;
    // Pin both ends of the strip where they are now — mid-pull for a drag, at
    // rest for a tap — and force the browser to take those values up before the
    // transition exists. Skip it and a tap-close computes the freshly mounted
    // backdrop's transform once, at its destination, and nothing eases.
    // Deliberately no requestAnimationFrame anywhere here: rAF is frozen in a
    // hidden tab, which would strand the sheet half closed.
    applyPull(dragRef.current?.dy ?? 0);
    void pageRef.current?.offsetHeight;
    setTransition(`transform ${ENTER_MS}ms ${CLOSE_EASE}`);
    applyPull(travel);
    // Landing with no history state is what stops Home replaying its own
    // entrance: by now the copy above has already brought it into place.
    timerRef.current = setTimeout(() => navigate('/'), ENTER_MS);
  }, [navigate, applyPull, setTransition]);

  const springBack = useCallback(() => {
    setTransition(`transform ${SPRING_BACK_MS}ms ${CLOSE_EASE}`);
    applyPull(0);
    timerRef.current = setTimeout(() => setRevealing(false), SPRING_BACK_MS);
  }, [applyPull, setTransition]);

  const onPointerDown = useCallback(
    (e) => {
      if (e.button > 0 || closingRef.current) return;
      // Keeps the drag alive if the finger wanders off the strip. Not worth
      // failing the gesture over: the pointer can already be gone by the time
      // this runs, and the move handler works either way.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* no active pointer */
      }
      clearTimeout(timerRef.current);
      dragRef.current = {
        id: e.pointerId,
        startY: e.clientY,
        dy: 0,
        travelled: 0,
        lastY: e.clientY,
        lastT: e.timeStamp,
        velocity: 0,
      };
      setRevealing(true);
      setTransition('none');
    },
    [setTransition],
  );

  const onPointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== e.pointerId) return;
      const travelled = e.clientY - drag.startY;
      drag.dy = travelled > 0 ? travelled : travelled * RUBBER_BAND;
      drag.travelled = Math.max(drag.travelled, Math.abs(travelled));
      const elapsed = e.timeStamp - drag.lastT;
      if (elapsed >= VELOCITY_SAMPLE_MS) {
        drag.velocity = (e.clientY - drag.lastY) / elapsed;
        drag.lastY = e.clientY;
        drag.lastT = e.timeStamp;
      }
      applyPull(drag.dy);
    },
    [applyPull],
  );

  const onPointerUp = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== e.pointerId) return;
      const tapped = drag.travelled < TAP_SLOP;
      if (tapped || drag.dy > CLOSE_DISTANCE || drag.velocity > CLOSE_VELOCITY) close();
      else springBack();
      dragRef.current = null;
    },
    [close, springBack],
  );

  const onPointerCancel = useCallback(
    (e) => {
      if (!dragRef.current || dragRef.current.id !== e.pointerId) return;
      dragRef.current = null;
      springBack();
    },
    [springBack],
  );

  return {
    pageRef,
    sheetRef,
    behindRef,
    revealing,
    close,
    grabProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

// Not a type from the API — a shortcut tile pinned after everything else, so
// it's always last. Text only: there's no artwork for it yet, same as any
// custom type the user has added.
const FAVORITES_TILE = { id: '__favorites__', name: 'Favorites' };

export default function GameTypes() {
  // The sheet sits below Home on the vertical strip: it rises from the bottom
  // as Home slides off the top. Closing is handled by the strip below, which
  // brings Home back down over the top of the departing sheet.
  const { startForward, swipeClass, rootProps } = useSwipeToHome();
  const { pageRef, sheetRef, behindRef, revealing, close, grabProps } = useSheetStrip();

  // Seed from the in-memory cache so arriving from Home renders the full grid
  // immediately rather than animating a sheet of skeletons into place.
  const [types, setTypes] = useState(() => api.getCachedGameTypes() || []);
  const [loading, setLoading] = useState(() => api.getCachedGameTypes() === null);

  useEffect(() => {
    let cancelled = false;
    api
      .getGameTypes()
      .then((data) => {
        if (!cancelled) setTypes(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Everything the design names, then any type the user has added since — but
  // never the protected "Unassigned" bucket, which is where the server parks
  // games whose type was deleted rather than a category anyone browses.
  const browsable = types.filter((t) => !t.protected);
  const ordered = orderTypes(browsable, ALL_TYPE_ORDER, { includeUnlisted: true });
  const showSkeleton = loading && ordered.length === 0;
  const tiles = [...ordered, FAVORITES_TILE];

  return (
    <div className={`page page-sheet${swipeClass}`} ref={pageRef} {...rootProps}>
      {revealing && (
        <div className="page sheet-behind" ref={behindRef} aria-hidden="true">
          <HomeContent />
        </div>
      )}

      <div className="sheet" ref={sheetRef}>
        <div className="sheet-grab" {...grabProps}>
          <span className="sheet-grab-handle" />
        </div>

        <div className="sheet-panel">
          {/* No visible heading: the button that opens this sheet already names
              it, and a title here would scroll away before it could orient
              anyone. Kept for screen readers, which get no such button. */}
          <h2 className="sr-only">Game Types</h2>

          <div className="home-type-grid sheet-grid">
            {showSkeleton
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="btn-tertiary home-type-skeleton" aria-hidden="true" />
                ))
              : tiles.map((t) => (
                  <button
                    key={t.id}
                    className="btn-tertiary"
                    style={{ background: typePillColor(t.name, t.bg), color: TYPE_TEXT_COLOR }}
                    onClick={() =>
                      startForward(t.id === FAVORITES_TILE.id ? '/favorites' : `/games/type/${t.id}`, 'horizontal')
                    }
                  >
                    {TYPE_ICONS[t.name] ? (
                      <img
                        src={TYPE_ICONS[t.name]}
                        alt={t.name}
                        className={t.name === 'Taskmaster' ? 'home-type-icon home-type-icon-lg' : 'home-type-icon'}
                      />
                    ) : (
                      t.name
                    )}
                  </button>
                ))}
          </div>
        </div>

        <button className="sheet-close" onClick={close} aria-label="Close game types">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}
