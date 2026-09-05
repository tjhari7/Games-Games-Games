import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../lib/pageSwipe.js';

// The same right-side drawer as FilterDrawer — same slide-in, same scrim, same
// mount/exit model — but its body is just a short list of navigation links (no
// "Filters" heading, no controls). Opened by the ⋮ button on All Games.
const SLIDE_MS = 300;

// Copied from FilterDrawer: `mounted` outlives `open` by one slide so the exit
// keyframe can play, with a timer backstop for a throttled/hidden tab that never
// fires animationend.
function useDrawerPresence(open) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const onScreenRef = useRef(open);

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (open) {
      onScreenRef.current = true;
      setClosing(false);
      setMounted(true);
      return undefined;
    }

    if (!onScreenRef.current) return undefined;

    if (prefersReducedMotion()) {
      onScreenRef.current = false;
      setMounted(false);
      return undefined;
    }

    setClosing(true);
    timerRef.current = setTimeout(() => {
      onScreenRef.current = false;
      setMounted(false);
      setClosing(false);
    }, SLIDE_MS + 60);

    return () => clearTimeout(timerRef.current);
  }, [open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onExited = () => {
    clearTimeout(timerRef.current);
    onScreenRef.current = false;
    setMounted(false);
    setClosing(false);
  };

  return { mounted, closing, onExited };
}

export default function KebabMenu({ open, onClose, items = [] }) {
  const closeRef = useRef(null);
  const { mounted, closing, onExited } = useDrawerPresence(open);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const drawer = (
    <div className={`filter-drawer-scrim ${closing ? 'is-closing' : ''}`} onClick={onClose}>
      <div
        className={`filter-drawer ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="More options"
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          if (e.animationName === 'filter-drawer-out') onExited();
        }}
      >
        <div className="filter-drawer-header kebab-menu-header">
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close menu">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="filter-drawer-body kebab-menu-body">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="kebab-menu-link"
              onClick={() => {
                onClose();
                item.onClick();
              }}
            >
              <span className="material-symbols-outlined kebab-menu-link__lead" aria-hidden="true">
                {item.icon}
              </span>
              <span className="kebab-menu-link__label">{item.label}</span>
              <span className="material-symbols-outlined kebab-menu-link__chevron" aria-hidden="true">
                chevron_right
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.querySelector('.device-frame') || document.body);
}
