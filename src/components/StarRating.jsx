// Read-only 5-star display, half-star aware. Renders nothing for an unrated
// game rather than a row of empty stars, so it doesn't add weight to cards
// that have no rating yet.
import Icon from './Icon.jsx';

const STAR_INDICES = [0, 1, 2, 3, 4];

export default function StarRating({ value, size = 12, className = '' }) {
  if (!value) return null;

  return (
    <div className={`star-rating ${className}`.trim()} style={{ '--star-size': `${size}px` }}>
      {STAR_INDICES.map((i) => {
        const filled = value - i;
        const icon = filled >= 0.5 && filled < 1 ? 'star_half' : 'star';
        // Only a full star gets the solid variant — star_half already draws its
        // own half-solid shape, and filling it would just make it a solid star.
        const className = filled >= 1 ? 'is-filled' : filled >= 0.5 ? 'is-half' : '';
        return (
          <Icon
            key={i}
            name={icon}
            filled={filled >= 1}
            className={`star-rating__star ${className}`.trim()}
          />
        );
      })}
    </div>
  );
}
