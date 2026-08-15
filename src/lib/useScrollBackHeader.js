import { useCallback, useEffect, useRef } from 'react';
import { getPageScroller, getScrollTop, offsetWithinScroller } from './pageScroll.js';

// "Scroll back" page chrome, the pattern patagonia.com uses. A list page keeps
// its header, back button, overflow menu, search bar and filter in one sticky
// block: on the way down the block travels off the top with the content, and
// any upward scroll brings it straight back, however deep in the list the
// reader is.
//
// The two halves are deliberately asymmetric. Hiding tracks the scroll 1:1 and
// untransitioned, so it reads as the block simply scrolling away rather than as
// chrome animating out. Revealing is direction-triggered, so a short flick up
// returns the whole block rather than the sliver of it that was scrolled past.
//
// Put `ref` on the block — it must be a direct child of `.page` and carry
// .scroll-back-header from index.css, which turns the distance written into
// --scroll-back-shift into the pull-up. Call `pinOpen()` just before an
// animated programmatic scroll: it holds the block fully on screen for the
// length of the scroll — whichever way the page is moving — and returns the
// space it occupies at the top, so the caller can land its target just below
// the block rather than underneath it.
//
// Reads and writes whichever container actually scrolls — the window on phones,
// the device frame's inner scroller on desktop/tablet. See lib/pageScroll.js.

// Upward travel before the block returns: enough to absorb the jitter of a
// finger resting on a momentum scroll, short enough to still feel immediate.
const REVEAL_THRESHOLD = 8;
// The pin is held for as long as the caller's scroll is actually running and
// released by hand, rather than expiring on a timer — a hidden tab freezes the
// requestAnimationFrame the scroll is driven by while the clock keeps running,
// which would drop the pin before the page had moved at all.
// Past this much travel in a single frame the page was moved, not scrolled —
// a restored position, or a jump-to-letter that landed in one step. Neither is
// a gesture, so neither should drive the hide/reveal logic.
const JUMP_DELTA = 400;

const px = (value) => parseFloat(value) || 0;

export function useScrollBackHeader() {
  const ref = useRef(null);
  const pinOpenRef = useRef(null);
  const releasePinRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const scroller = getPageScroller();

    let shift = 0; // px the block is currently pulled up by
    let sliding = false; // a transition is in flight, so the drawn value leads `shift`
    let lastY = Math.max(0, getScrollTop(scroller));
    let upTravel = 0; // upward scroll accumulated since the last reversal
    let pinned = false; // a jump-to-letter is running; hold the block open
    let frame = 0;
    let height = el.offsetHeight;
    let flowTop = 0;

    // A stuck element no longer reports its own resting position, so measure it
    // off `.page`: the page's content-box top, raised by the block's negative
    // top margin (it breaks out of the gutter to fill the full width).
    function measureFlowTop() {
      const page = el.parentElement;
      flowTop =
        offsetWithinScroller(page, scroller) +
        px(getComputedStyle(page).paddingTop) +
        px(getComputedStyle(el).marginTop);
    }

    function setShift(next, animate) {
      if (animate !== sliding) {
        sliding = animate;
        el.classList.toggle('is-sliding', animate);
      }
      if (next === shift) return;
      shift = next;
      el.style.setProperty('--scroll-back-shift', `${next}px`);
    }

    // Mid-transition the drawn position leads `shift`; picking tracking back up
    // from where the block actually is keeps a reversal from snapping.
    function drawnShift() {
      if (!sliding) return shift;
      const matrix = getComputedStyle(el).transform;
      return matrix && matrix !== 'none' ? -new DOMMatrixReadOnly(matrix).f : shift;
    }

    function update() {
      frame = 0;
      const y = Math.max(0, getScrollTop(scroller));
      const delta = y - lastY;
      lastY = y;

      // How far the block would have travelled up with the content if it were
      // never sticky. That is the ceiling on how far it may hide: near the top
      // of the page it must not run ahead of the content it sits above.
      const gone = Math.min(Math.max(y - flowTop, 0), height);

      if (pinned) {
        // A jump-to-letter is running with the block pinned open. Hold it fully
        // on screen for the length of the scroll whichever way the page is
        // moving — a downward jump would otherwise hide it, an upward one would
        // ease it back in — so the section lands in the space the caller
        // measured rather than under a block that is still moving.
        upTravel = 0;
        setShift(0, false);
      } else if (Math.abs(delta) > JUMP_DELTA) {
        // The page was moved rather than scrolled — a restored position. Put
        // the block exactly where the content has left it, untransitioned: a
        // gesture-speed reveal here would slide it in over a page the reader
        // has not actually scrolled.
        upTravel = 0;
        setShift(gone, false);
      } else if (delta > 0) {
        upTravel = 0;
        setShift(Math.min(drawnShift() + delta, gone), false);
      } else if (delta < 0) {
        upTravel -= delta;
        if (upTravel >= REVEAL_THRESHOLD) setShift(0, true);
        // Otherwise hold position, except where the page has scrolled back far
        // enough that the block would be hiding past its own resting place.
        else if (shift > gone) setShift(gone, sliding);
      }
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    function onResize() {
      height = el.offsetHeight;
      measureFlowTop();
      onScroll();
    }

    pinOpenRef.current = () => {
      pinned = true;
      // Open it in this tick rather than waiting for the first scroll frame, so
      // the height returned is the space the block will actually be occupying
      // by the time the caller's scroll lands.
      height = el.offsetHeight;
      upTravel = 0;
      setShift(0, false);
      return height;
    };

    releasePinRef.current = () => {
      pinned = false;
      // The jump's whole travel is behind us. Take it as the new baseline so
      // the next real scroll measures a gesture-sized delta from where the page
      // actually is, rather than reading the jump itself as one.
      lastY = Math.max(0, getScrollTop(scroller));
      upTravel = 0;
    };

    measureFlowTop();
    update();

    // Keeps the measurements honest when the block itself changes height — an
    // error banner appearing, or a long title wrapping to a second line.
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      pinOpenRef.current = null;
      releasePinRef.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Returns the height the block now occupies at the top of the scroller, or 0
  // if it is not mounted yet.
  const pinOpen = useCallback(() => pinOpenRef.current?.() ?? 0, []);
  const releasePin = useCallback(() => releasePinRef.current?.(), []);

  return { ref, pinOpen, releasePin };
}
