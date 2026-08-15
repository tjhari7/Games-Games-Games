import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useMarkedPlayed } from '../lib/useMarkedPlayed.js';
import { useGameRatings } from '../lib/useGameRatings.js';
import StarRatingPicker from '../components/StarRatingPicker.jsx';
import StarRating from '../components/StarRating.jsx';

function naIfEmpty(value) {
  return value && value.trim() ? value : 'N/A';
}

async function shareGame(game) {
  const shareData = { title: game.title, text: game.description || undefined, url: window.location.href };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Failed to share', err);
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(window.location.href).catch((err) => console.error('Failed to copy link', err));
  }
}

function DetailsHeader({ onBack, onEdit }) {
  return (
    <div className="page-header page-header-tight">
      <button className="back-link" onClick={onBack} aria-label="Back">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      {onEdit && (
        <div className="details-header-actions">
          <button className="icon-btn icon-btn-label" onClick={onEdit}>
            <span className="material-symbols-outlined">edit</span>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

export default function GameDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isFavorite, toggleFavorite } = useFavoriteGames();
  const { isPlayed, togglePlayed } = useMarkedPlayed();
  const { getRating, setRating } = useGameRatings();
  const [ratingMode, setRatingMode] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getGame(id)
      .then(setGame)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <DetailsHeader onBack={() => navigate(-1)} />
        <p className="state-message">Loading…</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="page">
        <DetailsHeader onBack={() => navigate(-1)} />
        <p className="state-message">{error || 'Game not found.'}</p>
      </div>
    );
  }

  const detailsStyle = { '--details-icon-color': typePillColor(game.type_name, game.type_bg) };

  return (
    <div className="page">
      <DetailsHeader onBack={() => navigate(-1)} onEdit={() => navigate(`/games/${game.id}/edit`)} />

      {error && <div className="error-message">{error}</div>}

      <div className="details-card" style={detailsStyle}>
        <div className="carousel-card__top-left details-type-tag">
          <span
            className="type-tag"
            style={{ color: TYPE_TEXT_COLOR, background: typePillColor(game.type_name, game.type_bg) }}
          >
            {game.type_name}
          </span>
          {isFavorite(game.id) && (
            <span
              className="material-symbols-outlined carousel-card__fav-icon"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              favorite
            </span>
          )}
        </div>
        <h1 className="details-title">{game.title}</h1>
        <StarRating value={getRating(game.id)} size={16} className="star-rating--muted" />
        {game.description && <p className="details-desc">{game.description}</p>}

        <div className="details-stats">
          <div className="stat-row">
            <span className="material-symbols-outlined">group</span>
            <div>
              <div className="stat-row-label">Players</div>
              <div className="stat-row-value">{naIfEmpty(game.players)}</div>
            </div>
          </div>
          <div className="stat-row">
            <span className="material-symbols-outlined">schedule</span>
            <div>
              <div className="stat-row-label">Time</div>
              <div className="stat-row-value">{naIfEmpty(game.time)}</div>
            </div>
          </div>
          <div className="stat-row">
            <span className="material-symbols-outlined">inventory_2</span>
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

      {ratingMode ? (
        <StarRatingPicker
          value={getRating(game.id)}
          onChange={(value) => setRating(game.id, value)}
          onBack={() => setRatingMode(false)}
        />
      ) : (
        <div className="card-carousel__actions">
          <button
            type="button"
            className={`card-carousel__action card-carousel__action--played${isPlayed(game.id) ? ' is-active' : ''}`}
            aria-pressed={isPlayed(game.id)}
            onClick={() => togglePlayed(game.id)}
            aria-label="Mark as played"
          >
            <span className="material-symbols-outlined">casino</span>
            <span className="card-carousel__action-label">Played</span>
          </button>
          <button
            type="button"
            className={`card-carousel__action card-carousel__action--favorite${isFavorite(game.id) ? ' is-active' : ''}`}
            aria-pressed={isFavorite(game.id)}
            onClick={() => toggleFavorite(game.id)}
            aria-label="Favorite"
          >
            <span className="material-symbols-outlined">favorite</span>
            <span className="card-carousel__action-label">Favorite</span>
          </button>
          <button
            type="button"
            className={`card-carousel__action card-carousel__action--rating${getRating(game.id) > 0 ? ' is-active' : ''}`}
            onClick={() => setRatingMode(true)}
            aria-label="Rating"
          >
            <span className="material-symbols-outlined">star</span>
            <span className="card-carousel__action-text">
              <span className="card-carousel__action-label">Rating</span>
              {getRating(game.id) > 0 && (
                <span className="card-carousel__action-sublabel">{getRating(game.id).toFixed(1)}</span>
              )}
            </span>
          </button>
          <button
            type="button"
            className="card-carousel__action card-carousel__action--share"
            onClick={() => shareGame(game)}
            aria-label="Share"
          >
            <span className="material-symbols-outlined">ios_share</span>
            <span className="card-carousel__action-label">Share</span>
          </button>
        </div>
      )}
    </div>
  );
}
