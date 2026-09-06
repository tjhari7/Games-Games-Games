import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useMarkedPlayed } from '../lib/useMarkedPlayed.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import { shareGame } from '../lib/shareGame.js';
import { prefersReducedMotion } from '../lib/pageSwipe.js';
import StarRating from './StarRating.jsx';
import StarRatingPicker from './StarRatingPicker.jsx';

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

// The draw page's shuffle button doesn't step one card over — it spins. Each tap
// flies the deck past a fresh random number of cards in this inclusive range,
// then decelerates onto whatever it lands on.
const SPIN_MIN_CARDS = 3;
const SPIN_MAX_CARDS = 6;
// Total travel time for that spin, whatever the card count. ~300ms is a fast,
// slot-machine-ish blur across the high end of the range — bump this if it
// reads as too frantic.
const SPIN_MS = 300;

// y for x on cubic-bezier(0.77, 0, 0.18, 1) — a snappy ease-in-out: creeps off
// rest, accelerates through the middle, settles hard onto the landing card. CSS
// bezier strings don't apply to a JS-driven scrollLeft tween, so solve it here:
// Newton's method on the x component (a handful of iterations is plenty at
// 60fps), then evaluate the matching y.
function spinEase(x) {
  const cx = 3 * 0.77;
  const bx = 3 * (0.18 - 0.77) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * 0;
  const by = 3 * (1 - 0) - cy;
  const ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 5; i++) {
    const dx = ((ax * t + bx) * t + cx) * t - x;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(dx) < 1e-4 || d === 0) break;
    t -= dx / d;
  }
  return ((ay * t + by) * t + cy) * t;
}

function naIfEmpty(value) {
  return value && value.trim() ? value : 'N/A';
}

function CarouselCard({ game, rating, favorite, onOpen, onEdit }) {
  const pill = typePillColor(game.type_name, game.type_bg);

  return (
    <article className="carousel-card" onClick={() => onOpen(game)}>
      <div className="carousel-card__top">
        <div className="carousel-card__top-left">
          <span className="type-tag" style={{ color: TYPE_TEXT_COLOR, background: pill }}>
            {game.type_name}
          </span>
          {favorite && (
            <Icon name="favorite" filled className="carousel-card__fav-icon" />
          )}
        </div>
        <button
          className="icon-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(game);
          }}
          aria-label={`Edit ${game.title}`}
        >
          <Icon name="chevron_right" />
        </button>
      </div>

      <div className="carousel-card__body">
        <h2 className="carousel-card__title">{game.title}</h2>
        <StarRating value={rating} size={16} className="star-rating--muted" />
        {game.description && <p className="carousel-card__desc">{game.description}</p>}
      </div>

      {/* The same three stats the details page opens with, so the card carries
          everything needed to pick a game without tapping into it. Players and
          Time pair up on one row here — see the grid in index.css — and
          Materials, the only one that runs long, takes the row below. */}
      <div className="details-stats carousel-card__stats">
        <div className="stat-row">
          <Icon name="group" />
          <div>
            <div className="stat-row-label">Players</div>
            <div className="stat-row-value">{naIfEmpty(game.players)}</div>
          </div>
        </div>
        <div className="stat-row">
          <Icon name="schedule" />
          <div>
            <div className="stat-row-label">Time</div>
            <div className="stat-row-value">{naIfEmpty(game.time)}</div>
          </div>
        </div>
        <div className="stat-row stat-row--wide">
          <Icon name="inventory_2" />
          <div>
            <div className="stat-row-label">Materials</div>
            <div className="stat-row-value">{naIfEmpty(game.materials)}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

// `controls`, when passed, is a ref the carousel hangs its imperative moves off
// — currently just `spin()`, which the draw page's shuffle button calls: it
// flies the deck past a random handful of cards and eases onto a new one, a
// hand-driven scrollLeft tween rather than a native snap. See `spinEase` /
// `SPIN_MS` above.
//
// `loading` renders the whole shell — one blank card and a full, inert actions
// bar — before any games are in hand. It exists so the bar can mount on the
// first frame alongside the page header and ride the same entrance, instead of
// popping in whenever the API answers (which, against a ~300ms page slide, lands
// noticeably late). When the games arrive the shell fills in with no remount.
export default function GameCardCarousel({ games, onOpen, onEdit, controls, loading = false }) {
  const { isFavorite, toggleFavorite } = useFavoriteGames();
  const { isPlayed, togglePlayed } = useMarkedPlayed();
  const { getRating, setRating } = useGameRatings();
  const [ratingMode, setRatingMode] = useState(false);
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
  // The id of the in-flight shuffle-spin rAF, or 0 when nothing is spinning. A
  // second tap mid-spin reads this and bails; unmount reads it to cancel.
  const spinRef = useRef(0);
  // Backstop timer for the same spin: if rAF stalls (a backgrounded tab pauses
  // it mid-flight), this fires a little after the spin should have ended and
  // snaps straight to the landing card, so the track never stays frozen with
  // snapping still off.
  const spinFallback = useRef(0);

  const slides = wraps ? [games[games.length - 1], ...games, games[0]] : games;
  const gameIndex = wraps ? (slideIndex - 1 + games.length) % games.length : slideIndex;
  const currentGame = games[gameIndex] ?? null;

  // Swiping to another card while the picker is open would apply the next
  // pick to a game the user can no longer see, so close it back to the
  // regular actions first.
  useEffect(() => {
    setRatingMode(false);
  }, [gameIndex]);

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
      // A shuffle spin is already hand-driving scrollLeft; re-centring on top of
      // it would yank the track mid-flight. The spin lands on a snap point on
      // its own.
      if (spinRef.current) return;
      teleporting.current = true;
      scrollToSlide(slideIndexRef.current, 'auto');
      setTimeout(() => {
        teleporting.current = false;
      }, 0);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [scrollToSlide]);

  useEffect(() => {
    if (!controls) return undefined;
    controls.current = {
      // Fly past a random handful of cards and ease onto a new one. The order is
      // already shuffled, so which card that is doesn't matter — the point is
      // the motion, a draw rather than a step.
      spin: () => {
        const track = trackRef.current;
        // One-card deck (no wrap) has nowhere to spin, and a tap while a spin is
        // already running is ignored rather than stacked.
        if (!track || !wraps || spinRef.current) return;

        const cards =
          SPIN_MIN_CARDS + Math.floor(Math.random() * (SPIN_MAX_CARDS - SPIN_MIN_CARDS + 1));
        const finalIndex =
          firstReal + ((slideIndexRef.current - firstReal + cards) % games.length);

        // Reduced motion: keep the outcome (a fresh card), drop the fly-through.
        if (prefersReducedMotion()) {
          scrollToSlide(finalIndex, 'auto');
          return;
        }

        const { base, stride } = metrics();
        if (!stride) {
          // Track not measured yet — just step one card so the tap isn't inert.
          scrollToSlide(finalIndex, 'smooth');
          return;
        }

        // Hand-drive scrollLeft: snapping off for the flight (same hook the
        // mouse drag uses), and every frame's scroll event ignored the way a
        // teleport's is. The track stays inside the real cards the whole way —
        // the modulo folds it back over one full set rather than ever landing on
        // a wrap clone — so there's nothing to see at the seam.
        const realStart = base + stride * firstReal;
        const span = stride * games.length;
        const startLeft = track.scrollLeft;
        const distance = stride * cards;
        const t0 = performance.now();

        teleporting.current = true;
        track.classList.add('is-dragging');

        // Land on the snap point and put snapping back. Idempotent — whichever of
        // the final frame or the backstop timer gets here first wins, the other
        // finds `spinRef` already cleared and does nothing.
        const settle = () => {
          if (!spinRef.current) return;
          cancelAnimationFrame(spinRef.current);
          clearTimeout(spinFallback.current);
          spinRef.current = 0;
          spinFallback.current = 0;
          track.classList.remove('is-dragging');
          scrollToSlide(finalIndex, 'auto');
          setTimeout(() => {
            teleporting.current = false;
          }, 0);
        };

        const frame = (now) => {
          const t = Math.min((now - t0) / SPIN_MS, 1);
          const virtual = startLeft + distance * spinEase(t);
          track.scrollLeft = realStart + (((virtual - realStart) % span) + span) % span;
          if (t < 1) spinRef.current = requestAnimationFrame(frame);
          else settle();
        };

        spinRef.current = requestAnimationFrame(frame);
        spinFallback.current = setTimeout(settle, SPIN_MS + 250);
      },
    };
    return () => {
      controls.current = null;
    };
  }, [controls, games.length, firstReal, metrics, scrollToSlide, wraps]);

  useEffect(
    () => () => {
      clearTimeout(settleTimer.current);
      clearTimeout(spinFallback.current);
      if (spinRef.current) cancelAnimationFrame(spinRef.current);
    },
    [],
  );

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

  // No games yet (only a cold visit — Home usually warms the cache first): the
  // track stays empty and the bar below renders in full but inert, so it still
  // mounts on the first frame and rides the page's entrance with the header.
  // No stand-in card — the empty track keeps its height on its own.
  const showShell = loading && games.length === 0;

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
            <CarouselCard
              game={game}
              rating={getRating(game.id)}
              favorite={isFavorite(game.id)}
              onOpen={onOpen}
              onEdit={onEdit}
            />
          </div>
        ))}
      </div>

      <div className="card-carousel__counter">
        {showShell ? ' ' : `${gameIndex + 1} of ${games.length}`}
      </div>

      <div className="card-carousel__bar">
        {ratingMode && currentGame ? (
          <StarRatingPicker
            value={getRating(currentGame.id)}
            onChange={(value) => setRating(currentGame.id, value)}
            onBack={() => setRatingMode(false)}
          />
        ) : (
          <div className="card-carousel__actions">
            <button
              type="button"
              className={`card-carousel__action card-carousel__action--played${currentGame && isPlayed(currentGame.id) ? ' is-active' : ''}`}
              aria-pressed={!!currentGame && isPlayed(currentGame.id)}
              onClick={() => currentGame && togglePlayed(currentGame.id)}
              disabled={showShell}
              aria-label="Mark as played"
            >
              <Icon name="casino" filled={!!currentGame && isPlayed(currentGame.id)} />
              <span className="card-carousel__action-label">Played</span>
            </button>
            <button
              type="button"
              className={`card-carousel__action card-carousel__action--favorite${currentGame && isFavorite(currentGame.id) ? ' is-active' : ''}`}
              aria-pressed={!!currentGame && isFavorite(currentGame.id)}
              onClick={() => currentGame && toggleFavorite(currentGame.id)}
              disabled={showShell}
              aria-label="Favorite"
            >
              <Icon name="favorite" filled={!!currentGame && isFavorite(currentGame.id)} />
              <span className="card-carousel__action-label">Favorite</span>
            </button>
            <button
              type="button"
              className={`card-carousel__action card-carousel__action--rating${currentGame && getRating(currentGame.id) > 0 ? ' is-active' : ''}`}
              onClick={() => currentGame && setRatingMode(true)}
              disabled={showShell}
              aria-label="Rating"
            >
              <Icon name="star" filled={!!currentGame && getRating(currentGame.id) > 0} />
              <span className="card-carousel__action-text">
                <span className="card-carousel__action-label">Rating</span>
                {currentGame && getRating(currentGame.id) > 0 && (
                  <span className="card-carousel__action-sublabel">{getRating(currentGame.id).toFixed(1)}</span>
                )}
              </span>
            </button>
            <button
              type="button"
              className="card-carousel__action card-carousel__action--share"
              onClick={() => shareGame(currentGame)}
              disabled={showShell}
              aria-label="Share"
            >
              <Icon name="ios_share" />
              <span className="card-carousel__action-label">Share</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
