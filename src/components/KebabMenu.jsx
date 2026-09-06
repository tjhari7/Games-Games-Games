import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../lib/pageSwipe.js';

// The same right-side drawer as FilterDrawer — same slide-in, same scrim, same
// mount/exit model — but its body is just a short list of navigation links (no
// "Filters" heading, no controls). Opened by the ⋮ button on All Games.
const SLIDE_MS = 300;

// True only for the first render, and only when the menu mounts already open —
// which happens when Home lands here from a utility sheet (Add Game / Edit Game
// Types) dropping back down. This menu was showing, frozen, behind that sheet
// the whole way down, so it must appear in place: no slide-in, no scrim fade,
// no re-animating into a position it never left. Once the menu has closed once,
// later opens animate normally again.
function useArrivedOpen(open) {
  const [instant, setInstant] = useState(open);
  useEffect(() => {
    if (!open) setInstant(false);
  }, [open]);
  return instant;
}

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
  const instant = useArrivedOpen(open);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    // preventScroll, for the same reason as Discover's search input: the drawer
    // starts its slide parked off the frame's right edge, so a plain focus()
    // makes the browser scroll .device-frame sideways to reveal this button —
    // shoving the whole framed app over on desktop and cancelling the slide.
    closeRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const drawer = (
    <div
      className={`filter-drawer-scrim ${closing ? 'is-closing' : ''}${instant ? ' is-instant' : ''}`}
      onClick={onClose}
    >
      <div
        className={`filter-drawer ${closing ? 'is-closing' : ''}${instant ? ' is-instant' : ''}`}
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
            <Icon name="close" />
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
              <Icon name={item.icon} className="kebab-menu-link__lead" />
              <span className="kebab-menu-link__label">{item.label}</span>
              <Icon name="chevron_right" className="kebab-menu-link__chevron" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.querySelector('.device-frame') || document.body);
}
