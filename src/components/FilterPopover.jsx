import { useEffect, useRef, useState } from 'react';
import { PLAYER_OPTIONS, TIME_OPTIONS } from '../lib/filterOptions.js';

export default function FilterPopover({
  types,
  typeFilter,
  setTypeFilter,
  playersFilter = null,
  setPlayersFilter = () => {},
  timeFilter = null,
  setTimeFilter = () => {},
  fields = ['type', 'players', 'time'],
  fullWidth = false,
  iconOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const activeValues = [
    fields.includes('type') && typeFilter,
    fields.includes('players') && playersFilter,
    fields.includes('time') && timeFilter,
  ];
  const activeCount = activeValues.filter(Boolean).length;

  function clearAll() {
    if (fields.includes('type')) setTypeFilter(null);
    if (fields.includes('players')) setPlayersFilter(null);
    if (fields.includes('time')) setTimeFilter(null);
  }

  return (
    <div
      className={`filter-popover-wrapper ${fullWidth ? 'full-width' : ''} ${iconOnly ? 'icon-only' : ''}`}
      ref={wrapperRef}
    >
      {iconOnly ? (
        <button
          className="btn filter-toggle-btn-icon"
          onClick={() => setOpen((o) => !o)}
          aria-label="Filter"
        >
          <span className="material-symbols-outlined">tune</span>
          {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
        </button>
      ) : (
        <button className="btn filter-toggle-btn" onClick={() => setOpen((o) => !o)}>
          <span className="material-symbols-outlined">tune</span>
          Filter
          {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
        </button>
      )}

      {open && (
        <div className="filter-popover">
          {fields.includes('type') && (
            <div className="filter-popover-field">
              <label htmlFor="filter-type">Game Type</label>
              <select
                id="filter-type"
                value={typeFilter || ''}
                onChange={(e) => setTypeFilter(e.target.value || null)}
              >
                <option value="">All Types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {fields.includes('players') && (
            <div className="filter-popover-field">
              <label htmlFor="filter-players">Players</label>
              <select
                id="filter-players"
                value={playersFilter || ''}
                onChange={(e) => setPlayersFilter(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Any</option>
                {PLAYER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}

          {fields.includes('time') && (
            <div className="filter-popover-field">
              <label htmlFor="filter-time">Time</label>
              <select
                id="filter-time"
                value={timeFilter || ''}
                onChange={(e) => setTimeFilter(e.target.value || null)}
              >
                <option value="">Any</option>
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-popover-actions">
            <button className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear All
            </button>
            <button className="btn btn-neutral btn-sm" onClick={() => setOpen(false)}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
