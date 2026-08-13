import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';

// One game per card, swiped through left and right, with the cards either side
// hanging off the screen edges as a hint that there are more.
//
// The track is a native scroll-snap container rather than a hand-driven
// transform: the finger keeps the browser's own momentum and rubber-band
// physics, and every card is a real, already-rendered DOM node, so a swipe never
// waits on a mount. Games arrive from the API in one payload and carry no
// images, so "preloaded" costs nothing more than leaving them all in the track.
//
// It loops: a clone of the last game sits before the first and a clone of the
// first sits after the last. Landing on a clone teleports the track to the real
// card at the opposite end — invisible, since the clone it replaces is
// pixel-identical — so swiping forward from the last game reaches the first with
// no seam and no arithmetic on the caller's side.

// Quiet time before the track counts as settled. `scrollend` would say so
// exactly, but it is too new to rely on, and snap animations emit scroll events
// the whole way, so a short idle gap after the last one means the same thing.
const SETTLE_MS = 120;
// Slack before a mouse drag takes over, so a jittery click still opens the card.
const DRAG_LOCK = 6;

function naIfEmpty(value) {
  return value && value.trim() ? value : 'N/A';
}

function CarouselCard({ game, onOpen, onEdit }) {
  const pill = typePillColor(game.type_name, game.type_bg);

  return (
    <article className="carousel-card" onClick={() => onOpen(game)}>
      <div className="carousel-card__top">
        <span className="type-tag" style={{ color: TYPE_TEXT_COLOR, background: pill }}>
          {game.type_name}
        </span>
        <button
          className="icon-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(game);
          }}
          aria-label={`Edit ${game.title}`}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="carousel-card__body">
        <h2 className="carousel-card__title">{game.title}</h2>
        {game.description && <p className="carousel-card__desc">{game.description}</p>}
      </div>

      {/* The same three stats the details page opens with, so the card carries
          everything needed to pick a game without tapping into it. */}
      <div className="details-stats carousel-card__stats">
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
    </article>
  );
}

export default function GameCardCarousel({ games, onOpen, onEdit }) {
  const trackRef = useRef(null);
  // Which slide of the track is centred, clones included. The game showing is
  // derived from it; the ref is what the scroll and resize handlers read, since
  // they run outside React's render.
  const wraps = games.length > 1;
  const firstReal = wraps ? 1 : 0;
  const [slideIndex, setSlideIndex] = useState(firstReal);
  const slideIndexRef = useRef(firstReal);
  const settleTimer = useRef(0);
  const teleporting = useRef(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);

  const slides = wraps ? [games[games.length - 1], ...games, games[0]] : games;
  const gameIndex = wraps ? (slideIndex - 1 + games.length) % games.length : slideIndex;

  /* ---- geometry --------------------------------------------------------- */

  // Where the track must be scrolled to for slide `i` to sit centred, and how
  // far apart consecutive slides are. Measured rather than assumed so the gutter
  // and gap only have to be right in one place, the stylesheet.
  const metrics = useCallback(() => {
    const track = trackRef.current;
    const first = track?.children[0];
    if (!track || !first) return { base: 0, stride: 0 };
    const second = track.children[1];
    return {
      base: first.offsetLeft + first.offsetWidth / 2 - track.clientWidth / 2,
      stride: second ? second.offsetLeft - first.offsetLeft : 0,
    };
  }, []);

  const nearestSlide = useCallback(() => {
    const track = trackRef.current;
    const { base, stride } = metrics();
    if (!track || !stride) return 0;
    const i = Math.round((track.scrollLeft - base) / stride);
    return Math.max(0, Math.min(i, track.children.length - 1));
  }, [metrics]);

  const scrollToSlide = useCallback(
    (i, behavior) => {
      const track = trackRef.current;
      const { base, stride } = metrics();
      if (!track) return;
      const left = base + stride * i;
      if (behavior === 'smooth') track.scrollTo({ left, behavior });
      else track.scrollLeft = left;
      slideIndexRef.current = i;
      setSlideIndex(i);
    },
    [metrics],
  );

  /* ---- settling and the wrap ------------------------------------------- */

  const onSettled = useCallback(() => {
    const i = nearestSlide();

    // A clone: hop to the real card at the far end. Unanimated and mid-gesture-
    // free — the track is at rest and the two cards look the same, so there is
    // nothing to see.
    if (wraps && (i === 0 || i === slides.length - 1)) {
      teleporting.current = true;
      scrollToSlide(i === 0 ? games.length : 1, 'auto');
      // Cleared on the next tick: the assignment above fires one more scroll
      // event, and that one must not be read as the user arriving somewhere.
      // setTimeout rather than requestAnimationFrame — rAF is paused for a
      // backgrounded tab, which would leave the flag stuck and the carousel
      // stalled until the tab is foregrounded again.
      setTimeout(() => {
        teleporting.current = false;
      }, 0);
      return;
    }

    slideIndexRef.current = i;
    setSlideIndex(i);
  }, [games.length, nearestSlide, scrollToSlide, slides.length, wraps]);

  function handleScroll() {
    if (teleporting.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(onSettled, SETTLE_MS);
  }

  // Open on the first game, and start over whenever the set changes underneath
  // us — a search or a filter leaves the old position meaningless.
  useLayoutEffect(() => {
    scrollToSlide(firstReal, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  // Keep the centred card centred when the track changes width: the desktop
  // device frame resizing, or the chrome above it wrapping to another line.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const observer = new ResizeObserver(() => {
      teleporting.current = true;
      scrollToSlide(slideIndexRef.current, 'auto');
      setTimeout(() => {
        teleporting.current = false;
      }, 0);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [scrollToSlide]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  /* ---- mouse drag ------------------------------------------------------ */

  // Touch and trackpad scroll the track natively. A mouse can't, so drag it
  // instead: snapping goes off for the length of the drag — left on, the browser
  // would fight every scrollLeft we write — and the release glides to the
  // nearest card, which is where the snap picks back up.

  function handlePointerDown(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: trackRef.current.scrollLeft,
      locked: false,
    };
  }

  function handlePointerMove(e) {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || e.pointerId !== d.pointerId || !track) return;

    const dx = e.clientX - d.startX;
    if (!d.locked) {
      if (Math.abs(dx) < DRAG_LOCK) return;
      d.locked = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
    }
    track.scrollLeft = d.startScroll - dx;
  }

  function endDrag(e) {
    const d = drag.current;
    const track = trackRef.current;
    drag.current = null;
    if (!d || !track || e.pointerId !== d.pointerId || !d.locked) return;

    track.releasePointerCapture?.(e.pointerId);
    // The card under the cursor was dragged, not clicked.
    suppressClick.current = true;
    scrollToSlide(nearestSlide(), 'smooth');
    // Snapping comes back once the glide has landed on a snap point, so
    // restoring it is a no-op rather than a jump.
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      track.classList.remove('is-dragging');
      onSettled();
    }, SETTLE_MS * 3);
  }

  function handleClickCapture(e) {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  /* ---------------------------------------------------------------------- */

  return (
    <div className="card-carousel">
      <div
        className="card-carousel__track"
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
      >
        {slides.map((game, i) => (
          <div
            // Clones share their game with a real slide, so the index has to be
            // part of the key.
            key={`${i}-${game.id}`}
            className="card-carousel__slide"
            aria-hidden={i !== slideIndex || undefined}
            onClickCapture={(e) => {
              // A tap on a card hanging off the edge brings it to the middle
              // rather than opening it.
              if (i === slideIndex) return;
              e.stopPropagation();
              e.preventDefault();
              scrollToSlide(i, 'smooth');
            }}
          >
            <CarouselCard game={game} onOpen={onOpen} onEdit={onEdit} />
          </div>
        ))}
      </div>

      <div className="card-carousel__counter">
        {gameIndex + 1} of {games.length}
      </div>

      <div className="card-carousel__actions">
        <button type="button" className="card-carousel__action" aria-label="Mark as played">
          <span className="material-symbols-outlined">visibility</span>
          <span className="card-carousel__action-label">Played</span>
        </button>
        <button type="button" className="card-carousel__action" aria-label="Favorite">
          <span className="material-symbols-outlined">favorite</span>
          <span className="card-carousel__action-label">Favorite</span>
        </button>
        <button type="button" className="card-carousel__action" aria-label="Share">
          <span className="material-symbols-outlined">ios_share</span>
          <span className="card-carousel__action-label">Share</span>
        </button>
      </div>
    </div>
  );
}
