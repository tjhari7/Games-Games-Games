import { getPageScroller, getScrollTop, scrollPageTo } from './pageScroll.js';

// Native `scrollIntoView({behavior:'smooth'})` duration can't be tuned and
// feels sluggish for jump-to-letter navigation. This animates the scroll
// with a short, distance-scaled duration so short jumps feel near-instant
// and long jumps stay quick instead of drifting.
//
// Scrolls whichever container is live — the window on phones, the device
// frame's inner scroller on desktop/tablet. See lib/pageScroll.js.
export function fastScrollTo(targetY, offset = 0) {
  const scroller = getPageScroller();
  const startY = getScrollTop(scroller);
  const diff = targetY - offset - startY;
  if (Math.abs(diff) < 1) return;

  const duration = Math.min(300, Math.max(120, Math.abs(diff) * 0.25));
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    scrollPageTo(startY + diff * eased, scroller);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
