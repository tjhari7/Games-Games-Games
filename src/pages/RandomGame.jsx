import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useDiscoverRiseSwipe } from '../lib/pageSwipe.js';
import GameCardCarousel from '../components/GameCardCarousel.jsx';
import RiseBackdrop from '../components/RiseBackdrop.jsx';

// Play A Game is the card view with the browsing taken out of it: the same
// swipeable deck and the same actions bar, but the order is shuffled on arrival
// so the card in front of you is a draw rather than a place in an alphabet.
// Swiping sideways is the next draw; the shuffle button is a bigger one — it
// spins the deck past a random handful of cards and eases onto a new one (see
// the carousel's `spin` control).

// Fisher-Yates, on a copy: the games come back in title order and this page is
// the one place that must not show them that way.
function shuffled(games) {
  const out = [...games];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function RandomGameHeader({ onBack, onShuffle }) {
  return (
    // Same two-part structure as the type pages' hero banner: the outer strip
    // carries the fill and the padding, the header inside it stays unpadded so
    // its absolutely-positioned close and shuffle land inside that padding
    // rather than on the screen edge. See .random-game-banner in index.css.
    <div className="random-game-banner">
      <div className="page-header page-header-centered random-game-header">
        {/* Close, not back — this page rises from the bottom over Home, so
            dismissing it is the modal-close gesture (matches GameTypes'
            sheet-close). Back arrow here would suggest a hierarchy the page
            isn't part of. */}
        <button className="back-link" onClick={onBack} aria-label="Close">
          <Icon name="close" />
        </button>

        {/* "PLAY" in GT Eesti Ultra Bold — the same centred title treatment the
            All Games / Add Game / Discover headers use (.page-title-eesti).
            .page-header-centered pins the close and shuffle buttons left and
            right, so the h1 spans the full width and the word lands dead centre
            between them. */}
        <h1 className="page-title">
          <span className="page-title-eesti">Play</span>
        </h1>

        <div className="details-header-actions">
          {/* The swipe's tappable equivalent. Not optional politeness: a
              gesture that traces a path needs a single-pointer alternative
              (WCAG 2.5.1), and without one the draw is unreachable by keyboard
              or with a pointing device. Shuffle rather than a refresh arrow —
              refresh reads as "reload this", not "give me a different one".
              Always rendered, disabled until the deck is in hand, so the top
              bar arrives whole rather than growing a second button once the
              games land. */}
          <button
            className="icon-btn"
            onClick={onShuffle}
            disabled={!onShuffle}
            aria-label="Draw another game"
          >
            <Icon name="shuffle" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RandomGame() {
  // Opened from Home's Play A Game button: it rises up from the bottom of the
  // screen over Home and drops straight back down on close. See
  // useDiscoverRiseSwipe in lib/pageSwipe.js.
  const { startBack, swipeClass, rising, rootProps } = useDiscoverRiseSwipe('/');
  const navigate = useNavigate();

  // Seed straight from the cache Home warmed, so the real deck is on screen from
  // the first frame and there's no loading state at all. Only a genuinely cold
  // visit — cache never populated — falls back to fetching here.
  const [deck, setDeck] = useState(() => {
    const cached = api.getCachedGames();
    return cached ? shuffled(cached) : [];
  });
  const [loading, setLoading] = useState(() => !api.getCachedGames());
  const [error, setError] = useState(null);
  // How the shuffle button reaches into the carousel to trigger a spin. See its
  // `controls` prop.
  const carousel = useRef(null);

  // Shuffled once, on arrival: re-drawing the order under a deck the reader is
  // part-way through would move cards they had already passed. A warm cache
  // seeded the deck above, so this only runs on a cold visit.
  useEffect(() => {
    if (!loading) return undefined;

    let cancelled = false;
    api
      .getGames()
      .then((games) => {
        if (!cancelled) setDeck(shuffled(games));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading]);

  const openGame = (game) => navigate(`/games/${game.id}`);

  return (
    <div className={`page random-game-page discover-rise-page${swipeClass}`} {...rootProps}>
      {rising && <RiseBackdrop />}
      <RandomGameHeader onBack={startBack} onShuffle={deck.length > 1 ? () => carousel.current?.spin() : null} />

      {/* One wrapper, mounted from the first frame, so the deck and its bar
          ride in on the same clock as the header instead of starting their
          own slide whenever the games land. See .page-content in index.css.

          The carousel itself is mounted from the first frame too, in its
          `loading` shell — a blank card and a full, inert actions bar. The
          games take ~half a second to arrive, longer than the page's slide-in,
          so mounting the deck only once they land dropped the bottom bar in
          well after the header had finished animating. Now the bar rides up
          with the header and fills in silently when the draw is ready. */}
      <div className="page-content">
        {error && <div className="error-message">{error}</div>}

        {!loading && deck.length === 0 ? (
          <p className="state-message">No games found.</p>
        ) : (
          <GameCardCarousel
            games={deck}
            loading={loading}
            onOpen={openGame}
            onEdit={openGame}
            controls={carousel}
          />
        )}
      </div>
    </div>
  );
}
