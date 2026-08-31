import { useEffect, useRef, useState } from 'react';

// Timing for the spinning "G" loader. These must stay in sync with the
// games-loader-spin keyframes in index.css — the hook does the maths that
// lets the swap to content land exactly on the 360deg mark.
export const LOADER_GRACE_MS = 120;
export const LOADER_SPIN_MS = 500;
export const LOADER_HOLD_MS = 500;
// Beat of stillness after the spin finishes before the cards appear, so the
// swap reads as a deliberate pause rather than the glyph cutting out the
// instant it lands. Meant to be tuned.
export const LOADER_SETTLE_MS = 200;
const CYCLE_MS = LOADER_SPIN_MS + LOADER_HOLD_MS;
// The pause can only run as long as the hold — past that the glyph is rotating
// again, and the swap would land mid-spin. A longer settle therefore caps at
// the end of the hold; to actually wait longer, raise LOADER_HOLD_MS too.
const SETTLE_MS = Math.min(LOADER_SETTLE_MS, LOADER_HOLD_MS);
// Where in the cycle the swap happens: the end of the spin plus the pause.
const SWAP_POINT_MS = LOADER_SPIN_MS + SETTLE_MS;

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// How long to keep the loader up once the data is in. Exported so the timing
// can be checked on its own. Before the swap point we wait the rest of it out;
// past it the glyph has already been still for the full pause, so: no wait.
export function msToSwap(elapsed) {
  const intoCycle = elapsed % CYCLE_MS;
  return intoCycle < SWAP_POINT_MS ? SWAP_POINT_MS - intoCycle : 0;
}

// Gates a spinner on a `loading` flag so it never flashes and never cuts a
// rotation in half:
//   - data lands inside the grace period -> the loader never mounts at all
//   - data lands after it -> the loader stays up until the spin completes,
//     plus LOADER_SETTLE_MS of stillness
// Returns showLoader (render the spinner) and contentReady (render the list).
// Both are false in the gap between them, which renders as nothing.
export function useLoaderGate(loading) {
  const [showLoader, setShowLoader] = useState(false);
  // True while the data is in but we are finishing the rotation and its pause.
  const [settling, setSettling] = useState(false);
  const visibleRef = useRef(false);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (loading) {
      setSettling(false);
      // Already spinning from an earlier fetch — let it keep going rather
      // than restarting the clock.
      if (visibleRef.current) return undefined;
      const graceTimer = setTimeout(() => {
        shownAtRef.current = performance.now();
        visibleRef.current = true;
        setShowLoader(true);
      }, LOADER_GRACE_MS);
      return () => clearTimeout(graceTimer);
    }

    // The fetch beat the grace period: the loader never appeared, so there is
    // no rotation to finish.
    if (!visibleRef.current) return undefined;

    const hide = () => {
      visibleRef.current = false;
      setShowLoader(false);
      setSettling(false);
    };

    // With reduced motion the glyph is static (see index.css), so holding it
    // on screen would just be dead time.
    const remaining = reducedMotion() ? 0 : msToSwap(performance.now() - shownAtRef.current);
    if (remaining === 0) {
      hide();
      return undefined;
    }
    setSettling(true);
    const spinTimer = setTimeout(hide, remaining);
    return () => clearTimeout(spinTimer);
  }, [loading]);

  return { showLoader, contentReady: !loading && !settling };
}
