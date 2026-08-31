import { useEffect, useRef, useState } from 'react';
import { PLAYER_OPTIONS, TIME_OPTIONS } from '../lib/filterOptions.js';

export default function FilterPopover({
  types,
  typeFilter = [],
  setTypeFilter = () => {},
  playersFilter = [],
  setPlayersFilter = () => {},
  timeFilter = [],
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

  const typeCount = fields.includes('type') ? typeFilter.length : 0;
  const activeCount =
    typeCount +
    (fields.includes('players') ? playersFilter.length : 0) +
    (fields.includes('time') ? timeFilter.length : 0);

  // Every group here is multi-select: a tap adds or removes the value, and a
  // game matches if it fits any one of the chosen values.
  const toggleIn = (list, value) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  function toggleType(id) {
    setTypeFilter(toggleIn(typeFilter, id));
  }

  function clearAll() {
    if (fields.includes('type')) setTypeFilter([]);
    if (fields.includes('players')) setPlayersFilter([]);
    if (fields.includes('time')) setTimeFilter([]);
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
              <label>Game Type</label>
              <div className="filter-checkbox-list" role="group" aria-label="Game Type">
                {types.map((t) => (
                  <label className="filter-checkbox" key={t.id}>
                    <input
                      type="checkbox"
                      checked={typeFilter.includes(t.id)}
                      onChange={() => toggleType(t.id)}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {fields.includes('players') && (
            <div className="filter-popover-field">
              <label>Players</label>
              <div className="filter-checkbox-list" role="group" aria-label="Players">
                {PLAYER_OPTIONS.map((n) => {
                  const val = n === '8+' ? '8+' : n;
                  return (
                    <label className="filter-checkbox" key={n}>
                      <input
                        type="checkbox"
                        checked={playersFilter.includes(val)}
                        onChange={() => setPlayersFilter(toggleIn(playersFilter, val))}
                      />
                      <span>{n}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {fields.includes('time') && (
            <div className="filter-popover-field">
              <label>Time</label>
              <div className="filter-checkbox-list" role="group" aria-label="Time">
                {TIME_OPTIONS.map((opt) => (
                  <label className="filter-checkbox" key={opt.value}>
                    <input
                      type="checkbox"
                      checked={timeFilter.includes(opt.value)}
                      onChange={() => setTimeFilter(toggleIn(timeFilter, opt.value))}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeCount > 0 && (
            <div className="filter-popover-actions">
              <button className="btn btn-ghost btn-sm" onClick={clearAll}>
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
