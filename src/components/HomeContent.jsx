import logo from '../assets/Games_Logo_Color.svg';

const NOOP = () => {};

/**
 * Home's contents, with the page shell and the routing left to the caller.
 *
 * Split out because the Game Types sheet renders a second, inert copy one
 * screen above itself: pulling the sheet down slides that copy back into view,
 * so the gesture reveals the page it is returning to rather than a bare
 * backdrop. That copy passes no `onGo`, which makes every control a no-op —
 * it is scenery, and `aria-hidden` on the wrapper keeps it out of the tree
 * twice over.
 *
 * `onGo` takes the same (to, axis) pair as the page swipe hooks' start
 * functions, so Home hands its `startForward` straight through.
 */
export default function HomeContent({ onGo = NOOP }) {
  return (
    <>
      <div className="home">
        <div className="home-topbar home-topbar-left">
          <button className="icon-btn" onClick={() => onGo('/favorites', 'horizontal')} aria-label="View favorite games">
            <span className="material-symbols-outlined">favorite</span>
          </button>
        </div>
        <div className="home-topbar">
          <button className="icon-btn" onClick={() => onGo('/games', 'horizontal')} aria-label="View all games">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>

        <img src={logo} alt="Games Games Games" className="home-logo" />
        <p className="home-subtitle">
          All your favorite games together,
          <br />
          now you never have to remember.
        </p>
      </div>

      {/* A direct sibling of .home, not a descendant: it's position: fixed and
          pinned against .device-frame's containing block. Nesting it inside
          .home would let .home's page-swipe translate hijack that containing
          block the instant the animation starts, snapping these buttons to a
          different width/position a frame before the slide itself is visible.
          Sitting alongside .home instead means it gets the same translate
          directly (like AllGames' .fab), so it travels with the page without
          ever changing containing block. */}
      <div className="home-actions">
        <button className="btn btn-neutral home-play-btn" onClick={() => onGo('/random')}>
          Play A Game
        </button>

        <button className="btn home-viewall-btn" onClick={() => onGo('/game-types')}>
          Browse Game Types
        </button>
      </div>
    </>
  );
}
