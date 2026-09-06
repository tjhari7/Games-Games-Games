import { useLayoutEffect, useRef } from 'react';
import { getRiseSnapshot } from '../lib/riseSnapshot.js';

// The two layers a page that rises up from the bottom of the screen — Play A
// Game, Add Game, Edit Game Types — renders as its first children *only while it
// is sliding in or out*. The same trick DiscoverRiseBackdrop uses for Discover's
// destinations; see useDiscoverRiseSwipe and the .discover-rise-* rules in
// index.css:
//
//   .discover-rise-under  — a frozen clone of the screen the page was opened
//                           from: Home with its ⋮ menu open, or the All Games
//                           list at its current scroll position. Held dead
//                           still behind everything so the new page travels over
//                           that screen rather than over a blank frame. It is
//                           detached DOM captured at navigation time
//                           (riseSnapshot.js) — no React, no scrolling, no
//                           animation.
//   .discover-rise-shade  — an opaque full-bleed panel that travels up with the
//                           real content, so what slides in reads as one solid
//                           page rather than a stack of transparent bands.
//
// Both are dropped the moment the animation ends.
export default function RiseBackdrop() {
  const hostRef = useRef(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const snap = getRiseSnapshot();
    if (!host || !snap) return undefined;

    snap.layers.forEach((layer) => host.appendChild(layer.cloneNode(true)));

    // cloneNode doesn't carry scroll position — restore it once so a list
    // opened from partway down stays where it was.
    if (snap.scrollTop) {
      const scroller = host.querySelector('.device-frame__scroll');
      if (scroller) scroller.scrollTop = snap.scrollTop;
    }

    return () => host.replaceChildren();
  }, []);

  return (
    <>
      <div className="discover-rise-under" aria-hidden="true" ref={hostRef} />
      <div className="discover-rise-shade" aria-hidden="true" />
    </>
  );
}
