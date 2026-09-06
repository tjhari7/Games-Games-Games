import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useMenuOverlaySwipe } from '../lib/pageSwipe.js';
import StarRating from '../components/StarRating.jsx';
import { metaFor, formatSaves } from '../lib/community.js';

function naIfEmpty(value) {
  return value && value.trim() ? value : 'N/A';
}

function DetailsHeader({ onBack }) {
  return (
    <div className="page-header page-header-tight">
      <button className="back-link" onClick={onBack} aria-label="Back">
        <Icon name="arrow_back" />
      </button>
    </div>
  );
}

// A read-only view of a "community" game — the same real game record the rest of
// the app shows, reusing the Game Details card layout, but framed as someone
// else's shared game: a community rating and saved count instead of the
// personal favorite/played/rating controls. The one action is Save (a real
// favorite), plus a link through to the game's normal detail page.
export default function CommunityGameDetail() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { swipeClass, startBack, rootProps } = useMenuOverlaySwipe('/discover');
  const { isFavorite, toggleFavorite } = useFavoriteGames();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getGame(gameId)
      .then(setGame)
      .catch((err) => setError(err.message));
  }, [gameId]);

  const goBack = startBack;

  if (error) {
    return (
      <div className={`page${swipeClass}`} {...rootProps}>
        <DetailsHeader onBack={goBack} />
        <p className="state-message">{error}</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className={`page${swipeClass}`} {...rootProps}>
        <DetailsHeader onBack={goBack} />
      </div>
    );
  }

  const meta = metaFor(game.title);
  const saved = isFavorite(game.id);
  const detailsStyle = { '--details-icon-color': typePillColor(game.type_name, game.type_bg) };

  return (
    <div className={`page${swipeClass}`} {...rootProps}>
      <DetailsHeader onBack={goBack} />

      <div className="details-card" style={detailsStyle}>
        <div className="carousel-card__top-left details-type-tag">
          <span
            className="type-tag"
            style={{ color: TYPE_TEXT_COLOR, background: typePillColor(game.type_name, game.type_bg) }}
          >
            {game.type_name}
          </span>
          {saved && (
            <Icon name="favorite" filled className="carousel-card__fav-icon" />
          )}
        </div>

        <h1 className="details-title">{game.title}</h1>

        <div className="community-detail-rating">
          <StarRating value={meta.communityRating} size={16} className="star-rating--muted" />
          <span>{formatSaves(meta.savedCount)} people saved this</span>
        </div>

        {game.description && <p className="details-desc">{game.description}</p>}

        <div className="details-stats">
          <div className="stat-row">
            <Icon name="group" />
            <div>
              <div className="stat-row-label">Players</div>
              <div className="stat-row-value">{naIfEmpty(game.players)}</div>
            </div>
          </div>
          <div className="stat-row">
            <Icon name="schedule" />
            <div>
              <div className="stat-row-label">Time</div>
              <div className="stat-row-value">{naIfEmpty(game.time)}</div>
            </div>
          </div>
          <div className="stat-row">
            <Icon name="inventory_2" />
            <div>
              <div className="stat-row-label">Materials</div>
              <div className="stat-row-value">{naIfEmpty(game.materials)}</div>
            </div>
          </div>
        </div>

        <div className="details-section">
          <div className="details-section-label">Rules</div>
          <div className="details-section-body">{naIfEmpty(game.rules)}</div>
        </div>

        <div className="details-section">
          <div className="details-section-label">Example</div>
          <div className="details-section-body">{naIfEmpty(game.example)}</div>
        </div>
      </div>

      <div className="draw-actions">
        <div className="community-detail-actions">
          <button
            type="button"
            className={`discover-save-btn discover-save-btn--wide${saved ? ' is-saved' : ''}`}
            aria-pressed={saved}
            onClick={() => toggleFavorite(game.id)}
          >
            <Icon name={saved ? 'bookmark_check' : 'bookmark'} filled={saved} />
            {saved ? 'Saved to your collection' : 'Save to my collection'}
          </button>
          <button type="button" className="community-detail-link" onClick={() => navigate(`/games/${game.id}`)}>
            Open in my collection
          </button>
        </div>
      </div>
    </div>
  );
}
