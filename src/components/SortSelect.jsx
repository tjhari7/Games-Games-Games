import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { sortLabel } from '../lib/sortGames.js';

// Appends the live count to a label — "Favorites (8)" — so the number is
// visible before the option is picked, not just after. The count rides in its
// own span so it can sit a size smaller than the label. Falls back to the bare
// label if a count wasn't supplied for this value.
function labelWithCount(label, count) {
  return (
    <>
      {label}
      {typeof count === 'number' && <span className="sort-select-count"> ({count})</span>}
    </>
  );
}

// The sort control at the top of the filter drawer. Custom rather than a native
// <select> for the same reason the rest of the drawer is: a native picker opens
// the OS wheel on iOS, which covers the drawer and can't carry the app's type or
// the circular chevron.
//
// The menu is absolutely positioned inside the drawer's scrolling body. That is
// safe only because this control sits at the very top of it — a dropdown lower
// down would open past the body's bottom edge and be clipped.
export default function SortSelect({ value, onChange, options, counts }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      // Stopped here so Escape closes the menu without also closing the drawer
      // underneath it — the drawer has its own Escape handler on document.
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="sort-select" ref={wrapperRef}>
      <button
        type="button"
        className={`sort-select-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="sort-select-value">{labelWithCount(sortLabel(value), counts?.[value])}</span>
        <span className="sort-select-chevron" aria-hidden="true">
          <Icon name="expand_more" />
        </span>
      </button>

      {open && (
        <div className="sort-select-menu" role="listbox" aria-label="Sort by">
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`sort-select-option ${selected ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{labelWithCount(opt.label, counts?.[opt.value])}</span>
                {selected && (
                  <Icon name="check" className="sort-select-check" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
