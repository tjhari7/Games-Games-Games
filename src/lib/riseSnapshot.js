// A frozen still of the screen a rising page (Play A Game, Add Game, Edit Game
// Types) is opened from — the whole framed view, including an open ⋮ menu and
// the list's scroll position — taken the instant before navigation so the
// rising page has something completely static to travel up over, instead of the
// origin blanking out or animating away.
//
// It is captured as detached DOM: a clone runs no React, no springs, no
// intervals, and .discover-rise-under freezes its CSS animations too. RiseBackdrop
// reads it on the way in and again on the way back; useDiscoverRiseSwipe clears
// it once the page has finished dropping back down.

let snapshot = null;

// Call this synchronously in the click handler that navigates to a rising page,
// before anything (a closing menu, a route change) has had a chance to mutate
// the DOM.
export function captureRiseSnapshot() {
  const scroller = document.querySelector('.device-frame__scroll');
  if (!scroller) {
    snapshot = null;
    return;
  }

  const layers = [scroller.cloneNode(true)];
  // The ⋮ menu / any drawer portals out to .device-frame, a sibling of the
  // scroller, so it has to be collected on its own to stay in the picture.
  document.querySelectorAll('.filter-drawer-scrim').forEach((scrim) => {
    layers.push(scrim.cloneNode(true));
  });

  snapshot = {
    layers,
    // cloneNode doesn't carry scroll position; grab it so a list opened from
    // partway down doesn't snap to the top behind the rising page.
    scrollTop:
      scroller.scrollTop ||
      window.scrollY ||
      document.scrollingElement?.scrollTop ||
      0,
  };
}

export function getRiseSnapshot() {
  return snapshot;
}

export function clearRiseSnapshot() {
  snapshot = null;
}
