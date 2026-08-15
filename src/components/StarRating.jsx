// Read-only 5-star display, half-star aware. Renders nothing for an unrated
// game rather than a row of empty stars, so it doesn't add weight to cards
// that have no rating yet.
const STAR_INDICES = [0, 1, 2, 3, 4];

export default function StarRating({ value, size = 12, className = '' }) {
  if (!value) return null;

  return (
    <div className={`star-rating ${className}`.trim()} style={{ '--star-size': `${size}px` }}>
      {STAR_INDICES.map((i) => {
        const filled = value - i;
        const icon = filled >= 1 ? 'star' : filled >= 0.5 ? 'star_half' : 'star';
        // The "FILL" axis only makes sense on a full star — star_half already
        // draws its own half-solid shape at FILL 0, and filling it in would
        // just turn it into a solid star.
        const className = filled >= 1 ? 'is-filled' : filled >= 0.5 ? 'is-half' : '';
        return (
          <span key={i} className={`material-symbols-outlined star-rating__star ${className}`.trim()}>
            {icon}
          </span>
        );
      })}
    </div>
  );
}
