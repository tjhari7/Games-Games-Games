import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';

function naIfEmpty(value) {
  return value && value.trim() ? value : 'N/A';
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
        <span
          className="type-tag details-type-tag"
          style={{ color: TYPE_TEXT_COLOR, background: typePillColor(game.type_name, game.type_bg) }}
        >
          {game.type_name}
        </span>
        <h1 className="details-title">{game.title}</h1>
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
    </div>
  );
}
