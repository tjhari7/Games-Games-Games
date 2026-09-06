import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearRiseSnapshot } from './riseSnapshot.js';

// Home sits on two strips. The Game Types sheet sits *below* it on a vertical
// one: opening it pans down — Home slides off the top while the destination
// rises from the bottom — and closing pans back. The menu (All Games), Surprise
// Me and the six game type pages sit to the *left* on a horizontal one: opening
// one pans right — Home slides off to the right while the page comes in from the
// left — and closing sends that page back off to the left as Home returns from
// the right.
//
// Either way the two halves run in sequence — the outgoing page finishes its
// slide, then the route changes and the incoming one slides in — so only ever
// one page is mounted.
//
// A few pages sit *over* an origin as an overlay rather than on a strip: All
// Games and Discover slide in from the right over a stationary Home
// (openedRightOverlay), and Add Game / Edit Game Types rise from below over a
// stationary Home-with-menu or All Games (openedBelowOverlay). Their exit hands
// out no entrance flag, so the origin is revealed in place rather than panned
// back in.
//
// Keep these in sync with the page-swipe-* keyframes in index.css.
export const LEAVE_MS = 150;
export const ENTER_MS = 300;
// A hidden tab freezes the animation timeline, so animationend may never
// arrive. Both halves keep a timer as a backstop: without one the leave would
// strand a page mid-slide, and the entrance would hold its clip on the
// scroller for the rest of the visit.
const FALLBACK_SLACK_MS = 100;

const LEAVE = {
  up: { className: 'swipe-leaving-up', animation: 'page-swipe-leave-up' },
  down: { className: 'swipe-leaving-down', animation: 'page-swipe-leave-down' },
  left: { className: 'swipe-leaving-left', animation: 'page-swipe-leave-left' },
  right: { className: 'swipe-leaving-right', animation: 'page-swipe-leave-right' },
};

const ENTER = {
  above: { className: 'swipe-entering-from-above', animation: 'page-swipe-enter-from-above' },
  below: { className: 'swipe-entering-from-below', animation: 'page-swipe-enter-from-below' },
  left: { className: 'swipe-entering-from-left', animation: 'page-swipe-enter-from-left' },
  right: { className: 'swipe-entering-from-right', animation: 'page-swipe-enter-from-right' },
};

// One end of a strip. `entrances` maps the flag the *other* end leaves in the
// history state to the side this page should arrive from — always the side the
// outgoing page vacated, so the pair reads as one continuous movement.
// `exits` names the axis the caller travels on; each one pairs the direction
// this page leaves in with the flag it hands the destination.
const END = {
  // Home: off the top for the vertical strip, off to the right for the
  // horizontal one.
  home: {
    entrances: { swipeBack: 'above', swipeBackFromRight: 'right', swipeBackFromLeft: 'left' },
    exits: {
      vertical: { leave: 'up', handOff: { swipeForward: true } },
      horizontal: { leave: 'right', handOff: { swipeForwardFromLeft: true } },
    },
  },
  // Below Home (the Game Types sheet): arrives from below, leaves downward.
  // It can also hand off sideways to a game type page, which sits on the
  // horizontal strip — and that page's own back returns here, entering from
  // the right as the mirror of the trip out.
  opened: {
    entrances: { swipeForward: 'below', swipeBackFromRight: 'right' },
    exits: {
      vertical: { leave: 'down', handOff: { swipeBack: true } },
      horizontal: { leave: 'right', handOff: { swipeForwardFromLeft: true } },
    },
  },
  // Left of Home (Surprise Me and the game type pages): arrives from the left,
  // leaves back off to the left.
  openedLeft: {
    entrances: { swipeForwardFromLeft: 'left' },
    exits: { horizontal: { leave: 'left', handOff: { swipeBackFromRight: true } } },
  },
  // Right of Home (the pages launched from the ⋮ menu, which lives on the right
  // edge — All Games and Discover): arrives from the right, over the menu, and
  // its back button sends it straight back off to the right as Home pans back
  // in from the left, the mirror of openedLeft.
  openedRight: {
    entrances: { swipeForwardFromRight: 'right' },
    exits: { horizontal: { leave: 'right', handOff: { swipeBackFromLeft: true } } },
  },
  // All Games and Discover, opened from the ⋮ menu on Home's right edge. They
  // arrive like openedRight — in from the right, over the menu — but on the way
  // back they read as an overlay lifting off rather than a stop on the strip:
  // the page slides off to the right over a Home that never moves. So the exit
  // hands out no entrance flag; Home just sits there and is revealed.
  openedRightOverlay: {
    // swipeForwardFromRight: opened fresh from the ⋮ menu. swipeBackFromRight:
    // a page that Discover itself opened (a game type page) closing back onto
    // it — Discover slides back in from the right as that page leaves left.
    entrances: { swipeForwardFromRight: 'right', swipeBackFromRight: 'right' },
    exits: { horizontal: { leave: 'right', handOff: {} } },
  },
  // The utility pages shown as a bottom sheet (Add Game, Edit Game Types),
  // opened from Home's ⋮ menu or the All Games list. The vertical-axis mirror of
  // openedRightOverlay: the page rises from below over a stationary origin, and
  // on the way back drops straight back down over it. The origin — Home with the
  // ⋮ menu, or All Games — never moves, so the exit hands out no entrance flag
  // and it is simply revealed.
  openedBelowOverlay: {
    entrances: { swipeSheetUp: 'below' },
    exits: { vertical: { leave: 'down', handOff: {} } },
  },
};

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function usePageSwipe(end) {
  const { entrances, exits } = END[end];
  const navigate = useNavigate();
  const location = useLocation();

  // Which direction this page is leaving in, once it starts; null while it sits
  // still.
  const [leaveSide, setLeaveSide] = useState(null);
  // Frozen at mount: clearing the history state below must not retract the
  // class mid-animation.
  const [enterSide, setEnterSide] = useState(() => {
    const flag = Object.keys(entrances).find((f) => location.state?.[f]);
    return flag ? entrances[flag] : null;
  });
  const timerRef = useRef(null);
  const targetRef = useRef(null);
  const doneRef = useRef(false);
  const handOffRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Drop the flag once consumed, so reloading the page or coming back to it by
  // some other route doesn't replay the entrance.
  useEffect(() => {
    if (enterSide) navigate(location.pathname + location.search, { replace: true, state: null });
    // Only ever runs on the entering mount; re-running on a later location
    // change would clobber state that navigation deliberately put there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(enterSide)]);

  // Backstop for the entrance, in case its animationend never lands.
  useEffect(() => {
    if (!enterSide) return undefined;
    const t = setTimeout(() => setEnterSide(null), ENTER_MS + FALLBACK_SLACK_MS);
    return () => clearTimeout(t);
  }, [enterSide]);

  const finish = useCallback(() => {
    // Every animated child fires animationend and the fallback timer may race
    // them, so only the first caller through here navigates.
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimeout(timerRef.current);
    navigate(targetRef.current, { state: handOffRef.current });
  }, [navigate]);

  const start = useCallback(
    (to, axis = 'vertical', extraState = null) => {
      if (leaveSide) return;
      const exit = exits[axis];
      targetRef.current = to;
      // `extraState` rides along in the history state next to the swipe flag, so
      // a destination that can be reached from more than one place (Favorites,
      // opened from either Home or the Game Types sheet) can be told which back
      // target to use.
      handOffRef.current = extraState ? { ...exit.handOff, ...extraState } : exit.handOff;
      if (prefersReducedMotion()) {
        navigate(to, { state: handOffRef.current });
        return;
      }
      setLeaveSide(exit.leave);
      timerRef.current = setTimeout(finish, LEAVE_MS + FALLBACK_SLACK_MS);
    },
    [leaveSide, exits, navigate, finish],
  );

  const handleAnimationEnd = useCallback(
    (e) => {
      // Card entries, skeleton shimmers and the like all bubble through here.
      if (leaveSide && e.animationName === LEAVE[leaveSide].animation) finish();
      // Take the entrance class back off once it has played: it is what makes
      // the page overflow its scroller while it is off-screen, and leaving it
      // on would keep that clip in force for the whole visit.
      else if (enterSide && e.animationName === ENTER[enterSide].animation) setEnterSide(null);
    },
    [leaveSide, enterSide, finish],
  );

  // Leaving wins over entering — an interrupted entrance must not keep its
  // class and swallow the exit animation.
  const swipeClass = leaveSide
    ? ` ${LEAVE[leaveSide].className}`
    : enterSide
      ? ` ${ENTER[enterSide].className}`
      : '';

  return { start, swipeClass, rootProps: { onAnimationEnd: handleAnimationEnd } };
}

/**
 * Home's end of both strips. `startForward(to)` slides Home off the top and
 * then opens `to`, and Home slides back in from above when that page closes;
 * `startForward(to, 'horizontal')` takes the other axis instead — Home slides
 * off to the right and returns from the right. Append `swipeClass` to the
 * `.page` root's className and spread `rootProps` onto it — index.css animates
 * the root's children, and their animationend bubbles up to it.
 */
export function useSwipeFromHome() {
  const { start, ...swipe } = usePageSwipe('home');
  return { ...swipe, startForward: start };
}

/**
 * The far end of the vertical strip, for a page that sits below Home: it rises
 * from below on arrival, and `startBack()` drops it off the bottom before
 * returning Home. Navigating rather than popping history is what lets the swipe
 * flag ride along; the browser's own back button just goes back without the
 * animation, which is the behaviour it should have anyway.
 *
 * `startForward(to, 'horizontal')` is the sideways door out — the same move Home
 * makes to open a game type page, so the two arrive identically.
 */
export function useSwipeToHome() {
  const { start, ...swipe } = usePageSwipe('opened');
  const startBack = useCallback(() => start('/'), [start]);
  return { ...swipe, startBack, startForward: start };
}

/**
 * The far end of the horizontal strip, for a page that sits to Home's left: it
 * comes in from the left on arrival, and `startBack()` sends it back off to the
 * left. `to` names where that lands — Home by default, but a page opened from
 * somewhere else on the strip (a game type page, opened from the Game Types
 * sheet rather than Home) can point back there instead.
 */
export function useHorizontalSwipeBack(to = '/') {
  const { start, ...swipe } = usePageSwipe('openedLeft');
  const startBack = useCallback(() => start(to, 'horizontal'), [start, to]);
  return { ...swipe, startBack };
}

/**
 * The ⋮-menu end of the horizontal strip: it slides in from the right on
 * arrival, and `startBack()` sends it back off to the right as Home returns from
 * the left — the mirror of useHorizontalSwipeToHome.
 *
 * Currently unused: All Games and Discover switched to useMenuOverlaySwipe so
 * their back button reopens the ⋮ menu (Home stays put and is revealed) rather
 * than panning Home back in over a closed menu. Kept for the strip-position
 * behaviour if a future ⋮ destination wants it.
 */
export function useMenuSwipeToHome() {
  const { start, ...swipe } = usePageSwipe('openedRight');
  const startBack = useCallback(() => start('/', 'horizontal'), [start]);
  return { ...swipe, startBack };
}

/**
 * All Games and Discover from the ⋮ menu, and Add Game / Edit Game Types from
 * either the ⋮ menu or the All Games header. They arrive sliding in from the
 * right, over a stationary origin; `startBack()` slides them back off to the
 * right and lands on `to`, revealing the origin where it was left. Pass
 * `{ reopenMenu: true }` as `extraState` when the origin is Home's ⋮ menu so the
 * drawer is open again the moment Home is revealed; omit it when Back lands on
 * All Games.
 */
export function useMenuOverlaySwipe(to = '/', extraState = null) {
  const { start, ...swipe } = usePageSwipe('openedRightOverlay');
  const startBack = useCallback(
    () => start(to, 'horizontal', extraState),
    [start, to, extraState],
  );
  return { ...swipe, startBack };
}

/**
 * The utility pages shown as a bottom sheet (Add Game, Edit Game Types). They
 * rise from below over a stationary origin on arrival, and `startBack()` drops
 * them straight back down to reveal it — the origin (Home with the ⋮ menu, or
 * All Games) never moved, so nothing pans in behind. `to` names where Back
 * lands; pass `reopenMenu` when the origin is Home's ⋮ menu so the drawer is
 * open again the moment Home is revealed.
 *
 * Currently unused: kept for the strip-position behaviour if a future
 * bottom-sheet page wants the expo-out feel.
 */
export function useSheetOverlaySwipe(to = '/', reopenMenu = false) {
  const { start, ...swipe } = usePageSwipe('openedBelowOverlay');
  const startBack = useCallback(
    () => start(to, 'vertical', reopenMenu ? { reopenMenu: true } : null),
    [start, to, reopenMenu],
  );
  return { ...swipe, startBack };
}

/**
 * The far end of the horizontal strip, for a page that sits to Home's left: it
 * comes in from the left on arrival, and `startBack()` sends it back off to the
 * left before returning Home.
 *
 * Currently unused: Surprise Me (its one caller) moved to useDiscoverRiseSwipe
 * so it rises up from the bottom over Home rather than sliding in from the left.
 * Kept for the strip-position behaviour if a future left-of-Home page wants it.
 */
export function useHorizontalSwipeToHome() {
  return useHorizontalSwipeBack('/');
}

// Surprise Me opens by sliding up from the bottom of the screen; Back drops it
// straight back down over a stationary Home. Both halves run at 300ms on the
// same easing curve. It gets its own tiny state machine rather than a slot in
// usePageSwipe (whose fallback timers are pinned to the 150/300ms strip
// durations and whose leave is half this length). Keep DISCOVER_RISE_MS in sync
// with the .discover-rise-* rules in index.css
// (300ms / cubic-bezier(0.22, 0.61, 0.36, 1)).
export const DISCOVER_RISE_MS = 300;

/**
 * Entrance + exit for a page that rises up from the bottom of the screen. Now
 * only Surprise Me, opened from Home — the Discover destinations moved to the
 * right-side overlay (useMenuOverlaySwipe) so every forward step reads the same.
 * Arrives sliding up from below when navigated to with
 * `{ state: { discoverRise: true } }`; `startBack()` slides it back down and
 * then lands on `to` (Discover by default), carrying `backState` in the history
 * state if given (e.g. `{ reopenMenu: true }` so Home's ⋮ drawer reopens).
 * Spread `rootProps` on the `.page` root and append `swipeClass` to its
 * className.
 */
export function useDiscoverRiseSwipe(to = '/discover', backState = null) {
  const navigate = useNavigate();
  const location = useLocation();

  const [entering, setEntering] = useState(() => Boolean(location.state?.discoverRise));
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Drop the flag once consumed so a reload or a return by some other route
  // doesn't replay the entrance.
  useEffect(() => {
    if (!entering) return;
    navigate(location.pathname + location.search, { replace: true, state: null });
    // The scroller carries its position across a route change, so a rising page
    // opened from a scrolled list would otherwise mount partway down. Reset it
    // so the page — and the frozen still behind it — start from the top.
    document.querySelector('.device-frame__scroll')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    // Only meaningful on the entering mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backstop: a hidden tab freezes the animation timeline, so animationend may
  // never arrive to clear the entrance clip.
  useEffect(() => {
    if (!entering) return undefined;
    const t = setTimeout(() => setEntering(false), DISCOVER_RISE_MS + 100);
    return () => clearTimeout(t);
  }, [entering]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimeout(timerRef.current);
    // The page has finished dropping back down — the frozen backdrop still it
    // travelled over (if any) has done its job.
    clearRiseSnapshot();
    navigate(to, backState ? { state: backState } : undefined);
  }, [navigate, to, backState]);

  const startBack = useCallback(() => {
    if (leaving) return;
    if (prefersReducedMotion()) {
      clearRiseSnapshot();
      navigate(to, backState ? { state: backState } : undefined);
      return;
    }
    setLeaving(true);
    timerRef.current = setTimeout(finish, DISCOVER_RISE_MS + 100);
  }, [leaving, navigate, to, backState, finish]);

  const handleAnimationEnd = useCallback(
    (e) => {
      if (leaving && e.animationName === 'discover-rise-out') finish();
      else if (entering && e.animationName === 'discover-rise-in') setEntering(false);
    },
    [leaving, entering, finish],
  );

  const swipeClass = leaving
    ? ' discover-rise-leaving'
    : entering
      ? ' discover-rise-entering'
      : '';

  // True while either half of the animation is running — the window in which the
  // destination page should render an inert Discover behind itself so the slide
  // reads as rising over the page it was opened from, not over a blank frame.
  const rising = Boolean(entering || leaving);

  return { swipeClass, rising, startBack, rootProps: { onAnimationEnd: handleAnimationEnd } };
}
