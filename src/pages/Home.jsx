import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { typePillColor, TYPE_TEXT_COLOR } from '../lib/typeColors.js';
import logo from '../assets/Games_Logo_Color.svg';
import drawingIcon from '../assets/Drawing_01.svg';
import actOutIcon from '../assets/Act_Out_01.svg';
import cardIcon from '../assets/Card_01.svg';
import improvIcon from '../assets/Improv_01.svg';
import talkingIcon from '../assets/Talking_01.svg';
import taskmasterIcon from '../assets/Task Master_01.svg';

const TYPE_ICONS = {
  Drawing: drawingIcon,
  'Act Out': actOutIcon,
  Card: cardIcon,
  Improv: improvIcon,
  Talking: talkingIcon,
  Taskmaster: taskmasterIcon,
};

export default function Home() {
  const navigate = useNavigate();
  // Seed from the in-memory cache so repeat visits render instantly instead of
  // flashing an empty grid while the request resolves.
  const [types, setTypes] = useState(() => api.getCachedGameTypes() || []);
  const [loading, setLoading] = useState(() => api.getCachedGameTypes() === null);

  useEffect(() => {
    let cancelled = false;
    api
      .getGameTypes()
      .then((data) => {
        if (!cancelled) setTypes(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleTypes = types.filter((t) => !t.protected);
  const showSkeleton = loading && visibleTypes.length === 0;

  // Homepage grid order swaps Card and Improv (visually swapping their
  // column positions) while every other page keeps the API's alphabetical order.
  const homeTypes = [...visibleTypes];
  const cardIndex = homeTypes.findIndex((t) => t.name === 'Card');
  const improvIndex = homeTypes.findIndex((t) => t.name === 'Improv');
  if (cardIndex !== -1 && improvIndex !== -1) {
    [homeTypes[cardIndex], homeTypes[improvIndex]] = [homeTypes[improvIndex], homeTypes[cardIndex]];
  }

  return (
    <div className="page">
      <div className="home">
        <img src={logo} alt="Games Games Games" className="home-logo" />
        <p className="home-subtitle">
          All your favorite games in one place.
          <br />
          Perfect for a good laugh or killing time.
        </p>

        <div className="home-type-grid">
          {showSkeleton
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="btn-tertiary home-type-skeleton" aria-hidden="true" />
              ))
            : homeTypes.map((t) => (
                <button
                  key={t.id}
                  className="btn-tertiary"
                  style={{ background: typePillColor(t.name, t.bg), color: TYPE_TEXT_COLOR }}
                  onClick={() => navigate(`/games/type/${t.id}`)}
                >
                  {TYPE_ICONS[t.name] ? (
                    <img
                      src={TYPE_ICONS[t.name]}
                      alt={t.name}
                      className={t.name === 'Taskmaster' ? 'home-type-icon home-type-icon-lg' : 'home-type-icon'}
                    />
                  ) : (
                    t.name
                  )}
                </button>
              ))}
        </div>

        <div className="home-bottom-row home-bottom-row-stacked">
          <button className="btn btn-neutral" onClick={() => navigate('/random')}>
            Play Random Game
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/games')}>
            View All Games
          </button>
        </div>
      </div>
    </div>
  );
}
