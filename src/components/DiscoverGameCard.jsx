import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { formatSaves } from '../lib/community.js';
import Icon from './Icon.jsx';
import StarRating from './StarRating.jsx';

// The All Games list card, reused nearly verbatim so Discover matches the rest
// of the app, with three swaps: the star rating shows the community rating (not
// a personal one), a footer carries a "saves" count plus a Save button, and
// the favorited-heart the real list cards show is deliberately dropped here —
// Discover's "Save" is its own gesture and shouldn't stamp a heart on the card.
// Save is still a real favorite toggle (useFavoriteGames), passed in by the
// parent.
export default function DiscoverGameCard({ game, meta, isSaved, onToggleSave, onOpen }) {
  return (
    <div className="game-list-item discover-card" onClick={() => onOpen(game)}>
      <div className="game-list-item-header">
        <div className="game-list-item-header-left">
          <span
            className="type-tag game-list-item-type"
            style={{ color: TYPE_TEXT_COLOR, background: typePillColor(game.type_name, game.type_bg) }}
          >
            {game.type_name}
          </span>
        </div>
        <div className="game-list-item-actions">
          <span className="icon-btn" aria-hidden="true">
            <Icon name="chevron_right" />
          </span>
        </div>
      </div>
      <div className="game-list-item-main">
        <div className="game-list-item-title">{game.title}</div>
        <StarRating value={meta.communityRating} size={16} className="star-rating--muted" />
        {game.description && <p className="game-list-item-description">{game.description}</p>}
        <div className="game-list-item-meta">
          {game.players && (
            <span className="meta-item">
              <Icon name="group" />
              {game.players}
            </span>
          )}
          {game.time && (
            <span className="meta-item">
              <Icon name="schedule" />
              {game.time}
            </span>
          )}
        </div>
        <div className="discover-card-footer">
          <button
            type="button"
            className={`discover-save-btn${isSaved ? ' is-saved' : ''}`}
            aria-pressed={isSaved}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(game.id);
            }}
          >
            <Icon name={isSaved ? 'bookmark_check' : 'bookmark'} filled={isSaved} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
          <span className="discover-card-saves">{formatSaves(meta.savedCount)} saves</span>
        </div>
      </div>
    </div>
  );
}
