import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';

const MAX_HISTORY = 5;

function naIfEmpty(value) {
  return value && value.trim() ? value : 'N/A';
}

function RandomGameHeader({ onBack, onCycle, cycling }) {
  return (
    <div className="page-header page-header-tight">
      <button className="back-link" onClick={onBack} aria-label="Back">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <div className="details-header-actions">
        <button className="icon-btn icon-btn-cycle" onClick={onCycle} disabled={cycling} aria-label="Draw another random game">
          <span className="material-symbols-outlined">autorenew</span>
        </button>
      </div>
    </div>
  );
}

export default function RandomGame() {
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [history, setHistory] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [error, setError] = useState(null);

  // Draw immediately on arrival.
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function draw() {
    setDrawing(true);
    setError(null);
    setNoMatch(false);
    try {
      let result = await api.drawRandomGame({ exclude: history.join(',') });

      if (!result.game && history.length > 0) {
        // Exclusion list exhausted the pool — reset and try again from the full pool.
        result = await api.drawRandomGame();
        if (result.game) {
          setHistory([result.game.id]);
          setGame(result.game);
          setDrawing(false);
          return;
        }
      }

      if (!result.game) {
        setNoMatch(true);
        setGame(null);
        setDrawing(false);
        return;
      }

      setGame(result.game);
      setHistory((h) => [result.game.id, ...h].slice(0, MAX_HISTORY));
    } catch (err) {
      setError(err.message);
    } finally {
      setDrawing(false);
    }
  }

  const themeStyle = game ? { '--accent': game.type_accent, '--bg': game.type_bg } : {};

  return (
    <div className="page" style={themeStyle}>
      <RandomGameHeader onBack={() => navigate(-1)} onCycle={draw} cycling={drawing} />

      {error && <div className="error-message">{error}</div>}

      <div className="draw-stage">
        {noMatch && <p className="state-message">No games found.</p>}

        {!game && !noMatch && !drawing && (
          <button className="btn btn-neutral btn-block" onClick={draw}>
            Draw a Game
          </button>
        )}

        {game && (
          <div
            key={game.id}
            className="details-card"
            style={{ '--details-icon-color': typePillColor(game.type_name, game.type_bg) }}
          >
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
        )}
      </div>
    </div>
  );
}
