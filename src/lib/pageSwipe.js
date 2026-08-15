import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Home sits on two strips. Surprise Me sits *below* it on a vertical one:
// opening it pans down — Home slides off the top while the destination rises
// from the bottom — and closing pans back. The menu (All Games) and the six
// game type pages sit to the *left* on a horizontal one: opening one pans
// right — Home slides off to the right while the page comes in from the left —
// and closing sends that page back off to the left as Home returns from the
// right.
//
// Either way the two halves run in sequence — the outgoing page finishes its
// slide, then the route changes and the incoming one slides in — so only ever
// one page is mounted.
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
    entrances: { swipeBack: 'above', swipeBackFromRight: 'right' },
    exits: {
      vertical: { leave: 'up', handOff: { swipeForward: true } },
      horizontal: { leave: 'right', handOff: { swipeForwardFromLeft: true } },
    },
  },
  // Below Home (Surprise Me, Game Types): arrives from below, leaves downward.
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
  // Left of Home (the menu and the game type pages): arrives from the left,
  // leaves back off to the left.
  openedLeft: {
    entrances: { swipeForwardFromLeft: 'left' },
    exits: { horizontal: { leave: 'left', handOff: { swipeBackFromRight: true } } },
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
    (to, axis = 'vertical') => {
      if (leaveSide) return;
      const exit = exits[axis];
      targetRef.current = to;
      handOffRef.current = exit.handOff;
      if (prefersReducedMotion()) {
        navigate(to, { state: exit.handOff });
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
 * The far end of the horizontal strip, for a page that sits to Home's left: it
 * comes in from the left on arrival, and `startBack()` sends it back off to the
 * left before returning Home.
 */
export function useHorizontalSwipeToHome() {
  return useHorizontalSwipeBack('/');
}
