import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../lib/api.js';
import { useSwipeToHome } from '../lib/pageSwipe.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';

// How many drawn games stay swipe-back-able. Doubles as the exclusion list for
// new draws, so a deeper deck also means fewer near-term repeats.
const MAX_DECK = 20;
// Release past this share of the card's width and the swipe commits, capped so
// a wide card doesn't demand an unreasonably long drag.
const COMMIT_FRACTION = 0.25;
const COMMIT_CEILING = 90;
// A quick flick commits even when it never travelled the distance threshold.
const FLICK_VELOCITY = 0.5; // px per ms
// Velocity is measured over at least a frame. Pointer events can arrive
// coalesced, well under a millisecond apart, and dividing by that interval
// yields an enormous bogus speed that reads every small nudge as a flick.
const VELOCITY_SAMPLE_MS = 16;
// Speed from before a pause is meaningless: holding still and then letting go
// is not a flick, however fast the drag was up to that point.
const VELOCITY_STALE_MS = 100;
// Slack before a drag takes over, so a jittery tap doesn't nudge the card.
const AXIS_LOCK = 8;
// Resistance when dragging toward an end with nothing behind it.
const RUBBER_BAND = 0.35;
const SETTLE_MS = 260;
// Backstop in case transitionend never lands (an interrupted or non-rendering
// transition). Without it a lost event would strand the deck mid-swipe.
const SETTLE_FALLBACK_MS = SETTLE_MS + 150;
// The moving card tilts as it's dragged, straightening as it reaches rest.
const MAX_ROTATION = 10; // deg
const ROTATION_RANGE = 240; // px of travel to reach full tilt
// The resting stack, three layers deep. Keep in sync with .draw-stack in
// index.css — the drag interpolates each layer toward the pose of the one in
// front of it, so both places need the same numbers.
const BEHIND_SCALE = 0.95;
const BEHIND_OFFSET_Y = -12; // px, negative so it peeks above the top card
const BEHIND_2_SCALE = 0.9;
const BEHIND_2_OFFSET_Y = -24;
// A fourth layer, hidden at rest. A forward drag lifts every layer one place,
// which would empty the deepest slot and shallow the stack out mid-gesture; this
// one fades in to fill it and steps into the third layer's pose as the drag
// commits, so the stack still reads three deep the whole way through.
const BEHIND_3_SCALE = 0.85;
const BEHIND_3_OFFSET_Y = -36;
// How far past the edge a dismissed card travels, with room for its tilt.
const EXIT_MARGIN = 80;

function naIfEmpty(value) {
  return value && value.trim() ? value : 'N/A';
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function RandomGameHeader({ onBack }) {
  return (
    <div className="page-header page-header-tight">
      <button className="back-link" onClick={onBack} aria-label="Back">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
    </div>
  );
}

function DrawCard({ game, className = '', ariaHidden, cardRef }) {
  const pill = typePillColor(game.type_name, game.type_bg);

  return (
    <div
      ref={cardRef}
      className={`details-card draw-card${className ? ` ${className}` : ''}`}
      aria-hidden={ariaHidden || undefined}
      style={{ '--details-icon-color': pill }}
    >
      <span className="type-tag details-type-tag" style={{ color: TYPE_TEXT_COLOR, background: pill }}>
        {game.type_name}
      </span>
      <h1 className="details-title">{game.title}</h1>
      {game.description && <p className="details-desc">{game.description}</p>}

      <div className="details-stats">
        <div className="stat-row">
          <span className="material-symbols-outlined">group</span>
          <div>
            <div className="stat-row-label">Players</div>
            <div className="stat-row-value">{naIfEmpty(game.players)}</div>
          </div>
        </div>
        <div className="stat-row">
          <span className="material-symbols-outlined">schedule</span>
          <div>
            <div className="stat-row-label">Time</div>
            <div className="stat-row-value">{naIfEmpty(game.time)}</div>
          </div>
        </div>
        <div className="stat-row">
          <span className="material-symbols-outlined">inventory_2</span>
          <div>
            <div className="stat-row-label">Materials</div>
            <div className="stat-row-value">{naIfEmpty(game.materials)}</div>
          </div>
        </div>
      </div>

      <div className="details-section">
        <div className="details-section-label">Rules</div>
        <div className="details-section-body">{naIfEmpty(game.rules)}</div>
      </div>

      <div className="details-section">
        <div className="details-section-label">Example</div>
        <div className="details-section-body">{naIfEmpty(game.example)}</div>
      </div>
    </div>
  );
}

export default function RandomGame() {
  // Opened from Home, so it rises from the bottom on the way in and drops back
  // down on the way out. See lib/pageSwipe.js.
  const { startBack, swipeClass, rootProps } = useSwipeToHome();

  // The deck holds every game drawn this visit, oldest first, with `index`
  // pointing at the card on top. Swiping back walks the deck rather than
  // redrawing, so coming forward again retraces the same games in order.
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(-1);
  // Drawn ahead of time so it can sit behind the current card as a real stack.
  // It joins the deck only once the user commits to it.
  const [nextGame, setNextGame] = useState(null);

  const [drawing, setDrawing] = useState(true);
  const [noMatch, setNoMatch] = useState(false);
  const [error, setError] = useState(null);
  // The card being un-dismissed only mounts mid-gesture — the rest of the time
  // it would just be an off-screen copy of a card already in the deck.
  const [gesturing, setGesturing] = useState(false);

  const stackRef = useRef(null);
  const topRef = useRef(null);
  const behindRef = useRef(null);
  const behind2Ref = useRef(null);
  const behind3Ref = useRef(null);
  const incomingRef = useRef(null);
  const drag = useRef(null);
  const settling = useRef(false);
  const prefetching = useRef(false);

  const game = index >= 0 ? deck[index] ?? null : null;
  const prevGame = index > 0 ? deck[index - 1] : null;
  // Either a game already behind us in the deck, or the prefetched draw.
  const forwardGame = index >= 0 && index < deck.length - 1 ? deck[index + 1] : nextGame;

  // Draw the opening card. The ref guards against StrictMode's double effect
  // invocation, which would otherwise draw twice and flash two cards.
  const drawnOnArrival = useRef(false);
  useEffect(() => {
    if (drawnOnArrival.current) return;
    drawnOnArrival.current = true;
    drawFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function drawFirst() {
    setDrawing(true);
    setError(null);
    try {
      const result = await api.drawRandomGame();
      if (!result.game) {
        setNoMatch(true);
        return;
      }
      // No entrance of its own: the whole page has just swiped up from the
      // bottom, and a card sliding in on top of that would be a second,
      // competing movement. It lands already in place.
      setDeck([result.game]);
      setIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setDrawing(false);
    }
  }

  // Keep one draw in hand whenever we're sitting at the front of the deck, so
  // there is always a card underneath the one on top.
  useEffect(() => {
    if (index < 0 || index < deck.length - 1 || nextGame || prefetching.current) return;

    let cancelled = false;
    prefetching.current = true;

    (async () => {
      try {
        const exclude = deck.map((g) => g.id).join(',');
        let result = await api.drawRandomGame({ exclude });
        // Exclusions exhausted the pool — fall back to the full one.
        if (!result.game && deck.length > 0) result = await api.drawRandomGame();
        if (!cancelled) setNextGame(result.game ?? null);
      } catch {
        // A failed prefetch isn't worth an error banner: the stack just shows a
        // single card and the forward swipe rubber-bands until one lands.
      } finally {
        prefetching.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deck, index, nextGame]);

  function goForward() {
    if (index < deck.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    if (!nextGame) return;
    // Appending can push the oldest card out, which shifts every index down one.
    setDeck((d) => [...d, nextGame].slice(-MAX_DECK));
    setIndex((i) => Math.min(i + 1, MAX_DECK - 1));
    setNextGame(null);
  }

  function goBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  /* ---- stack transforms ----------------------------------------------- */

  function commitThreshold(width) {
    return Math.min(width * COMMIT_FRACTION, COMMIT_CEILING);
  }

  function rotationFor(offset) {
    const ratio = Math.max(-1, Math.min(1, offset / ROTATION_RANGE));
    return ratio * MAX_ROTATION;
  }

  // As the top card is dragged away the whole stack steps forward one place:
  // each layer travels to the pose of the layer ahead of it, so the depth stays
  // three cards the moment the swipe commits.
  function stackPose(fromY, fromScale, toY, toScale, progress) {
    const y = fromY + (toY - fromY) * progress;
    const scale = fromScale + (toScale - fromScale) * progress;
    return `translateY(${y}px) scale(${scale})`;
  }

  function behindTransform(progress) {
    return stackPose(BEHIND_OFFSET_Y, BEHIND_SCALE, 0, 1, progress);
  }

  function behind2Transform(progress) {
    return stackPose(BEHIND_2_OFFSET_Y, BEHIND_2_SCALE, BEHIND_OFFSET_Y, BEHIND_SCALE, progress);
  }

  function behind3Transform(progress) {
    return stackPose(BEHIND_3_OFFSET_Y, BEHIND_3_SCALE, BEHIND_2_OFFSET_Y, BEHIND_2_SCALE, progress);
  }

  // Show or hide the deepest layer. Its fade is a CSS transition on the layer
  // itself mid-drag, and rides the settle's timing once one is running, so it
  // never snaps except when clearInlineStyles deliberately resets everything.
  function setDeepVisible(visible) {
    if (behind3Ref.current) behind3Ref.current.style.opacity = visible ? '1' : '';
  }

  const layerRefs = [topRef, behindRef, behind2Ref, behind3Ref, incomingRef];

  function setTransition(ms) {
    const value = ms
      ? `transform ${ms}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${ms}ms ease`
      : '';
    for (const ref of layerRefs) {
      if (ref.current) ref.current.style.transition = value;
    }
  }

  function clearInlineStyles() {
    for (const ref of layerRefs) {
      if (!ref.current) continue;
      ref.current.style.transition = 'none';
      ref.current.style.transform = '';
      ref.current.style.opacity = '';
    }
    // Flush the reset so restoring transitions can't animate it.
    if (stackRef.current) void stackRef.current.offsetWidth;
    for (const ref of layerRefs) {
      if (ref.current) ref.current.style.transition = '';
    }
  }

  // Animate to the end state, apply `commit` while the swapped card is still
  // out of position, then drop every inline style so the CSS resting state wins.
  function runSettle(primary, applyEndState, commit) {
    const finish = () => {
      // flushSync so the index change lands in the DOM before the reset —
      // otherwise the cards paint one frame in their pre-swap positions.
      flushSync(commit);
      clearInlineStyles();
      settling.current = false;
      setGesturing(false);
      drag.current = null;
    };

    if (!primary || prefersReducedMotion()) {
      finish();
      return;
    }

    settling.current = true;
    let done = false;
    const complete = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      primary.removeEventListener('transitionend', onEnd);
      finish();
    };
    const onEnd = (e) => {
      if (e.target !== primary || e.propertyName !== 'transform') return;
      complete();
    };
    // The timer is a backstop only; transitionend normally gets there first.
    const fallback = setTimeout(complete, SETTLE_FALLBACK_MS);
    primary.addEventListener('transitionend', onEnd);

    setTransition(SETTLE_MS);
    applyEndState();
  }

  function dismissTop(fromDx) {
    const width = stackRef.current?.offsetWidth ?? 0;
    const tilt = rotationFor(fromDx);
    runSettle(
      topRef.current,
      () => {
        if (topRef.current) topRef.current.style.transform = `translateX(${-(width + EXIT_MARGIN)}px) rotate(${tilt}deg)`;
        if (behindRef.current) behindRef.current.style.transform = behindTransform(1);
        if (behind2Ref.current) behind2Ref.current.style.transform = behind2Transform(1);
        // Stays visible: it lands exactly on the third layer's resting pose, so
        // when clearInlineStyles hides it again the real third layer — an
        // identical blank shell — is already sitting there.
        if (behind3Ref.current) behind3Ref.current.style.transform = behind3Transform(1);
        setDeepVisible(true);
      },
      goForward,
    );
  }

  function restoreIncoming() {
    runSettle(
      incomingRef.current,
      () => {
        if (incomingRef.current) incomingRef.current.style.transform = 'translateX(0px) rotate(0deg)';
      },
      goBack,
    );
  }

  function cancelDrag() {
    const mode = drag.current?.mode;
    runSettle(
      mode === 'back' ? incomingRef.current : topRef.current,
      () => {
        if (topRef.current) topRef.current.style.transform = 'translateX(0px) rotate(0deg)';
        if (behindRef.current) behindRef.current.style.transform = behindTransform(0);
        if (behind2Ref.current) behind2Ref.current.style.transform = behind2Transform(0);
        // The swipe was abandoned, so nothing is stepping forward: the extra
        // layer sinks back and fades out over the same settle.
        if (behind3Ref.current) behind3Ref.current.style.transform = behind3Transform(0);
        setDeepVisible(false);
        // Back to the parked pose in .draw-stack__incoming, clear of the stage's
        // gutter — settling to a flat -100% would flash its edge there instead.
        if (incomingRef.current) incomingRef.current.style.transform = `translateX(calc(-100% - ${EXIT_MARGIN}px)) rotate(0deg)`;
      },
      () => {},
    );
  }

  /* ---- drag ------------------------------------------------------------ */

  // Every layer under the top card, posed for how far the stack has stepped
  // forward. Always called, even for the gestures that move nothing behind, so
  // that a drag racing across zero in one event can't strand a layer part-way.
  function setStackProgress(progress) {
    if (behindRef.current) behindRef.current.style.transform = behindTransform(progress);
    if (behind2Ref.current) behind2Ref.current.style.transform = behind2Transform(progress);
    if (behind3Ref.current) behind3Ref.current.style.transform = behind3Transform(progress);
    // Revealed for the whole of a forward drag rather than faded in by
    // distance: the point is that the stack never looks shallower than it does
    // at rest, and a proportional fade would show the gap it exists to fill.
    setDeepVisible(progress > 0);
  }

  function applyDrag(dx) {
    const width = stackRef.current?.offsetWidth ?? 0;
    const progressOver = commitThreshold(width) || 1;

    if (dx <= 0) {
      // Dismissing the top card; the next one rises behind it.
      const eff = forwardGame ? dx : dx * RUBBER_BAND;
      if (topRef.current) topRef.current.style.transform = `translateX(${eff}px) rotate(${rotationFor(eff)}deg)`;
      // With nothing in hand the swipe only rubber-bands, so the stack behind
      // stays put — there is no card to uncover.
      setStackProgress(forwardGame ? Math.min(Math.abs(eff) / progressOver, 1) : 0);
      return 'advance';
    }

    setStackProgress(0);

    if (prevGame) {
      // Pulling the last dismissed card back in over the top, from the side it
      // left by. It straightens as it nears its resting position.
      //
      // The element only mounts once the gesture's first render lands, so on
      // that opening frame there is nothing to move yet. Claim the mode anyway:
      // falling through would rubber-band the top card instead and leave a
      // stray offset on it for the rest of the drag.
      if (incomingRef.current) {
        const fromRest = -width + dx;
        incomingRef.current.style.transform = `translateX(calc(-100% + ${dx}px)) rotate(${rotationFor(fromRest)}deg)`;
      }
      return 'back';
    }

    // Nothing to bring back — let the top card stretch and spring home.
    const eff = dx * RUBBER_BAND;
    if (topRef.current) topRef.current.style.transform = `translateX(${eff}px) rotate(${rotationFor(eff)}deg)`;
    return 'stretch';
  }

  function handlePointerDown(e) {
    if (!game || settling.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = {
      startX: e.clientX,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
      dx: 0,
      locked: false,
      mode: null,
      pointerId: e.pointerId,
    };
  }

  function handlePointerMove(e) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId || settling.current) return;

    let dx = e.clientX - d.startX;

    if (!d.locked) {
      if (Math.abs(dx) < AXIS_LOCK) return;
      d.locked = true;
      // Subtract the slack so the card starts from under the finger, not ahead.
      d.startX += Math.sign(dx) * AXIS_LOCK;
      dx = e.clientX - d.startX;
      stackRef.current?.setPointerCapture(e.pointerId);
      setGesturing(true);
    }

    const now = performance.now();
    const dt = now - d.lastT;
    if (dt >= VELOCITY_SAMPLE_MS) {
      d.velocity = (e.clientX - d.lastX) / dt;
      d.lastX = e.clientX;
      d.lastT = now;
    }
    d.dx = dx;
    d.mode = applyDrag(dx);
  }

  function handlePointerUp(e) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.locked) {
      // Never locked on: this was a tap, not a drag.
      drag.current = null;
      return;
    }

    stackRef.current?.releasePointerCapture?.(e.pointerId);

    const width = stackRef.current?.offsetWidth ?? 0;
    const threshold = commitThreshold(width);
    // A flick counts only when it's recent and still travelling the way the
    // card moved — a stale sample means the finger had already come to rest.
    const fresh = performance.now() - d.lastT <= VELOCITY_STALE_MS;
    const flicked = fresh && Math.abs(d.velocity) > FLICK_VELOCITY && Math.sign(d.velocity) === Math.sign(d.dx);
    const past = Math.abs(d.dx) > threshold || flicked;

    if (d.mode === 'advance' && forwardGame && past) dismissTop(d.dx);
    else if (d.mode === 'back' && prevGame && past) restoreIncoming();
    else cancelDrag();
  }

  function handlePointerCancel(e) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.locked) cancelDrag();
    else drag.current = null;
  }

  /* ---------------------------------------------------------------------- */

  const themeStyle = game ? { '--accent': game.type_accent, '--bg': game.type_bg } : {};

  return (
    <div className={`page${swipeClass}`} style={themeStyle} {...rootProps}>
      <RandomGameHeader onBack={startBack} />

      {error && <div className="error-message">{error}</div>}

      <div className="draw-stage">
        {noMatch && <p className="state-message">No games found.</p>}

        {!game && !noMatch && !drawing && (
          <button className="btn btn-neutral btn-block" onClick={drawFirst}>
            Draw a Game
          </button>
        )}

        {game && (
          <div
            ref={stackRef}
            className={`draw-stack draw-stack--grabbable${gesturing ? ' draw-stack--dragging' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {/* The stack always reads three deep. Only the second layer is ever
                more than an edge, so the third is a blank shell — and so is the
                second whenever no draw is in hand, where a forward swipe
                rubber-bands and nothing behind is uncovered anyway. */}
            <div ref={behind3Ref} className="draw-stack__layer draw-stack__behind-3 draw-stack__shell" aria-hidden />
            <div ref={behind2Ref} className="draw-stack__layer draw-stack__behind-2 draw-stack__shell" aria-hidden />

            {forwardGame ? (
              <DrawCard
                key={`behind-${forwardGame.id}`}
                game={forwardGame}
                cardRef={behindRef}
                className="draw-stack__layer draw-stack__behind"
                ariaHidden
              />
            ) : (
              <div ref={behindRef} className="draw-stack__layer draw-stack__behind draw-stack__shell" aria-hidden />
            )}

            <DrawCard key={game.id} game={game} cardRef={topRef} className="draw-stack__top" />

            {gesturing && prevGame && (
              <DrawCard
                key={`incoming-${prevGame.id}`}
                game={prevGame}
                cardRef={incomingRef}
                className="draw-stack__layer draw-stack__incoming"
                ariaHidden
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
