import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageScroller, getScrollTop, scrollPageTo } from './pageScroll.js';

// Restores scroll position for list pages when navigating back from a
// details/edit page. `ready` should flip to true once the list's data has
// loaded and rendered, since the saved offset may exceed the page height
// while a loading placeholder is showing.
//
// Listens on whichever container actually scrolls — the window on phones, the
// device frame's inner scroller on desktop/tablet. See lib/pageScroll.js.
export function useScrollRestoration(ready) {
  const { pathname } = useLocation();
  const key = `scroll:${pathname}`;
  const restored = useRef(false);

  useEffect(() => {
    const scroller = getPageScroller();
    function onScroll() {
      sessionStorage.setItem(key, String(getScrollTop(scroller)));
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [key]);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      requestAnimationFrame(() => {
        scrollPageTo(parseInt(saved, 10));
      });
    }
  }, [ready, key]);
}
