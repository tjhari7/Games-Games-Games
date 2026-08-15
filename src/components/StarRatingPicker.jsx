import { useRef } from 'react';

// Interactive 5-star picker, half-star aware: tapping the left half of a star
// sets a half rating, the right half a full one. Also drag-aware — press down
// anywhere in the row and drag across the stars to sweep the rating live,
// landing on whatever star is under the finger at release. Takes over the
// spot the bottom action row normally sits in, so it's sized to match those
// icons.
const STAR_INDICES = [0, 1, 2, 3, 4];

function pick(e, index, onChange) {
  const rect = e.currentTarget.getBoundingClientRect();
  const isLeftHalf = e.clientX - rect.left < rect.width / 2;
  onChange(index + (isLeftHalf ? 0.5 : 1));
}

// Same half-star logic as pick(), but driven by a raw clientX against
// whichever star button that point falls under — used while dragging, since
// the finger isn't necessarily over the star it started on. The gap between
// buttons belongs to no rect, so a point there is assigned to whichever
// neighbor it's closer to (the midpoint of the gap), rather than falling
// through to a fixed default — that fallback used to always be the last
// star, which briefly filled every star while the pointer crossed any gap.
function valueFromPoint(container, clientX) {
  const buttons = container.querySelectorAll('.card-carousel__rating-star-btn');
  if (!buttons.length) return null;
  const rects = Array.from(buttons, (el) => el.getBoundingClientRect());
  const x = Math.min(Math.max(clientX, rects[0].left), rects[rects.length - 1].right);
  let i = rects.length - 1;
  for (let idx = 0; idx < rects.length; idx++) {
    const gapMidpoint = idx < rects.length - 1 ? (rects[idx].right + rects[idx + 1].left) / 2 : Infinity;
    if (x < gapMidpoint) {
      i = idx;
      break;
    }
  }
  const rect = rects[i];
  const isLeftHalf = x - rect.left < rect.width / 2;
  return i + (isLeftHalf ? 0.5 : 1);
}

export default function StarRatingPicker({ value, onChange, onBack }) {
  const starsRef = useRef(null);
  const draggingRef = useRef(false);

  function handlePointerDown(e) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = valueFromPoint(starsRef.current, e.clientX);
    if (next != null) onChange(next);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    const next = valueFromPoint(starsRef.current, e.clientX);
    if (next != null) onChange(next);
  }

  function handlePointerUp(e) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div className="card-carousel__rating-picker">
      <button
        type="button"
        className="card-carousel__rating-back"
        onClick={onBack}
        aria-label="Back to actions"
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <div
        className="card-carousel__rating-stars"
        ref={starsRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {STAR_INDICES.map((i) => {
          const filled = value - i;
          const icon = filled >= 1 ? 'star' : filled >= 0.5 ? 'star_half' : 'star';
          const className = filled >= 1 ? 'is-filled' : filled >= 0.5 ? 'is-half' : '';
          return (
            <button
              key={i}
              type="button"
              className={`card-carousel__rating-star-btn ${className}`.trim()}
              onClick={(e) => pick(e, i, onChange)}
              aria-label={`Rate ${i + 1} star${i === 0 ? '' : 's'}`}
            >
              <span className="material-symbols-outlined">{icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
