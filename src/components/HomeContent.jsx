import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { ALL_TYPE_ORDER, TYPE_TOSS_ICONS } from '../lib/gameTypes.js';
import g1 from '../assets/G1.svg';
import a1 from '../assets/A1.svg';
import m1 from '../assets/M1.svg';
import e1 from '../assets/E1.svg';
import s1 from '../assets/S1.svg';
import bang1 from '../assets/Exclamation1.svg';
import g2 from '../assets/G2.svg';
import a2 from '../assets/A2.svg';
import m2 from '../assets/M2.svg';
import e2 from '../assets/E2.svg';
import s2 from '../assets/S2.svg';
import bang2 from '../assets/Exclamation2.svg';
import g3 from '../assets/G3.svg';
import a3 from '../assets/A3.svg';
import m3 from '../assets/M3.svg';
import e3 from '../assets/E3.svg';
import s3 from '../assets/S3.svg';
import bang3 from '../assets/Exclamation3.svg';

const NOOP = () => {};

// Games_Logo_Color.svg was viewBox="0 0 291 173": three stacked "GAMES!" rows,
// used only as an alignment reference while building the per-letter overlay
// below (not rendered - the letters now fully reconstruct the logo on their
// own). Each row's 6 letter SVGs are exact 0-gap, 0-overlap horizontal slices
// of that row (verified by matching shared path coordinates against the
// reference file) - offsets/heights below are exact, not estimated. Rows
// aren't uniform height, so each row tracks its own native height/top.
const LOGO_NATIVE_WIDTH = 291;
const LOGO_NATIVE_HEIGHT = 173;
const LOGO_DISPLAY_WIDTH = 280;
const LOGO_SCALE = LOGO_DISPLAY_WIDTH / LOGO_NATIVE_WIDTH;

// The icons thrown up from behind Play A Game. Motion is reproduced from an
// After Effects reference (Games_SVG_Animation_1.mp4 and its 120-frame PNG
// sequence, both in src/assets) - the arc's easing and the 1deg/frame rotation
// are measured off those frames and baked into .home-toss's keyframes.
//
// Every icon renders into the same 100x100 box, so artwork that isn't square
// still throws and rotates about the same centre. Games_Icon_Dice_01.svg is a
// 0 0 100 100 viewBox whose path runs x/y 18->82, i.e. a 64x64 die with its own
// 18px transparent padding - which is why a die takes ~2 frames to clear the
// button's edge rather than appearing at once.
//
// One icon per tile in the Game Types sheet, in the order the sheet lists them -
// GameTypes.jsx builds its tiles the same way, as `[...ordered, FAVORITES_TILE]`.
// Deliberately the static order rather than the API's, so the toss never waits on
// a fetch. 17 types + Favorites = 18, which is exactly 9 pairs.
//
// Artwork (and its colour) comes from TYPE_TOSS_ICONS, one file per type, so new
// art is a file swap rather than a code change.
const TOSS_ICONS = [...ALL_TYPE_ORDER, 'Favorites'].map((name) => ({
  name,
  src: TYPE_TOSS_ICONS[name],
}));

// Timing, all measured off the reference at 60fps.
const TOSS_FLIGHT_MS = 1500; // 45 frames up, 45 down
const TOSS_REST_MS = 500; // its 30-frame beat between throws
// Lag between the dice inside a group. Small numbers go a long way here: the
// curve is so front-loaded that 200ms is already ~72% of the climb, so the
// stagger reads hard at launch and landing and barely at all through the hang -
// which is the shape you want, two objects thrown together rather than two
// separate throws.
const TOSS_STAGGER_MS = 200;
// A beat after Home mounts before the first throw, so it doesn't launch into the
// tail of the page transition. Shifts the whole schedule once; the loop itself
// is unaffected.
const TOSS_ENTER_DELAY_MS = 100;

const TOSS_GROUP_SIZE = 2;
// px either side of centre. 64 is not arbitrary: the artwork is 64px wide inside
// its 100px box, so centres 128px apart leave exactly 64px of clear space between
// the pair at rest. That gap closes to ~43px at the apex, where a 64px square
// measures 85px across the diagonal - the artwork turning, not the spacing moving.
const TOSS_SPREAD = 64;
const TOSS_DROP = 40; // px shaved off the follower's throw

// A group owns the screen until its *last* die has landed and the beat has
// played out - that's what stops the next throw from starting over a die still
// in the air. So the period is the last die's start offset plus a whole throw,
// not just one throw.
const TOSS_GROUP_MS =
  TOSS_STAGGER_MS * (TOSS_GROUP_SIZE - 1) + TOSS_FLIGHT_MS + TOSS_REST_MS;
const TOSS_CYCLE_MS = (TOSS_ICONS.length / TOSS_GROUP_SIZE) * TOSS_GROUP_MS;

// Mirrors the two percentages hard-coded into home-toss-arc in index.css, which
// encode flight / cycle. A stale pair doesn't error, it just silently stretches
// the arc over the wrong span, so say so out loud instead.
if (import.meta.env.DEV) {
  const apex = +(((TOSS_FLIGHT_MS / 2) / TOSS_CYCLE_MS) * 100).toFixed(4);
  const land = +((TOSS_FLIGHT_MS / TOSS_CYCLE_MS) * 100).toFixed(4);
  if (apex !== 3.7879 || land !== 7.5758) {
    console.warn(
      `[toss] home-toss-arc's keyframes in index.css are stale - this timing needs ${apex}% and ${land}%`,
    );
  }
}

/**
 * Position, spin and lag for each die, derived from where it sits in the running
 * order rather than hand-written per icon - which is what keeps the mirror exact
 * across all nine groups, and means shuffling can only ever change *which* colour
 * lands in a slot, never the choreography.
 *
 * Within a group the leader is always the tall throw and the follower the short
 * one; the pair swaps sides every group, and the spin direction follows the side.
 */
function buildThrows(icons) {
  return icons.map(({ name, src }, index) => {
    const groupIndex = Math.floor(index / TOSS_GROUP_SIZE);
    const iconIndex = index % TOSS_GROUP_SIZE;
    const x = (groupIndex + iconIndex) % 2 === 0 ? -TOSS_SPREAD : TOSS_SPREAD;

    return {
      name,
      src,
      x,
      spin: x < 0 ? 90 : -90,
      drop: iconIndex === 0 ? 0 : TOSS_DROP,
      delay:
        TOSS_ENTER_DELAY_MS + groupIndex * TOSS_GROUP_MS + iconIndex * TOSS_STAGGER_MS,
    };
  });
}

// Permutes the whole set rather than picking at random, so every icon still
// appears exactly once per cycle - none repeated, none skipped - while the
// pairings and the opening pair differ on every visit to Home.
function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Gap left between the subtitle's bottom edge and the icon *box* at its apex.
// The one knob for how high the throw goes; every other number is measured at
// runtime. Note the box is 100px but the die inside it only reaches 42.6px from
// centre at 45deg, so 40 here reads as ~47px of clearance under the visible die
// - tune against what you see, not against this number.
const TOSS_CLEARANCE = 40;

// Landscape and very short viewports would otherwise compute a travel that's
// tiny or negative, which reads as a twitch rather than a throw.
const TOSS_MIN_TRAVEL = 120;

// Spring is keyed by concentric "layer" (not by letter identity) and shared
// off one drag value across every row, so every letter in a given layer gets
// the exact same input and the exact same spring, and moves in lockstep with
// the rest of its layer automatically.
//
// Layers are rings, not letters: G and ! (the outermost characters in every
// row) are one layer; A and S (next ring in) are another; M and E split by
// row - row 1/row 3 (outer instances) are one layer, row 2 (dead center,
// M2/E2) is the innermost. Solved by matching target lag/period pairs against
// Motion's own spring formulas (lag = damping*V/stiffness, period =
// 2*pi/(sqrt(stiffness)*sqrt(1-zeta^2))), not guessed.
//
// PREVIOUS (letter-keyed, cascading stiffness G->!) - kept here to revert to:
//   G: { stiffness: 400, damping: 12 },   A: { stiffness: 340, damping: 11.8 },
//   M: { stiffness: 280, damping: 11.4 }, E: { stiffness: 220, damping: 11.3 },
//   S: { stiffness: 160, damping: 10.6 }, '!': { stiffness: 100, damping: 9 },
//
// PREVIOUS (layer-keyed, first pass) - the ring got stiffer toward the
// center (zeta 0.30 -> 0.42), which read as increasingly dead on A/S/M/E next
// to G/!. Kept here to revert to:
//   outer: { stiffness: 218, damping: 8.7 },  mid: { stiffness: 222, damping: 11.1 },
//   inner: { stiffness: 219, damping: 12 },   innermost: { stiffness: 212, damping: 12.2 },
//
// PREVIOUS (layer-keyed, second pass) - one ring per concentric position,
// still splitting M/E together by row. Kept here to revert to:
//   outer: { stiffness: 218, damping: 8.7 },  mid: { stiffness: 190, damping: 8.3 },
//   inner: { stiffness: 165, damping: 7.5 },  innermost: { stiffness: 145, damping: 6.8 },
//
// Don't reach for `visualDuration`/`bounce` here, tempting as it is (Motion
// maps them as zeta = 1 - bounce): getSpringOptions() hard-sets velocity to 0
// for the duration-based keys, and useSpring restarts its animation on every
// source change - every frame of the pan - so that would throw away the
// carried-over velocity each frame and make the whole logo mushier, not
// bouncier. Stiffness/damping keeps the velocity handoff intact.
//
// PREVIOUS (layer-keyed, third pass) - M2 pushed too far toward stiff, and E
// was freestanding (own zeta/stiffness, unrelated to M) which let it overshoot
// more than anything else in the logo, including the loosened G/!. Kept here
// to revert to:
//   mCenter: { stiffness: 260, damping: 14.8 }, e: { stiffness: 140, damping: 5.4 } (single group for all of E1/E2/E3)
//
// PREVIOUS (layer-keyed, fourth pass) - A and S shared one flat "mid" spring
// across all three rows. Kept here to revert to:
//   mid: { stiffness: 190, damping: 8.3 } (single group for A1/A2/A3/S1/S2/S3)
//
// Groups no longer nest cleanly by ring - G/! split by row (the two edge
// instances are looser than the center one), M splits by row (M2 is
// the stiffest, least bouncy spring in the logo - it's the exact center of
// the word and reads as the anchor everything else moves around, but only
// moderately stiffer, not maximally), E is built directly off mOuter
// (M1/M3's spring) rather than freestanding, then nudged - E1/E3 slightly
// bouncier than M1, E2 slightly stiffer than E1/E3 - and A/S split the same
// way: A2/S2 keep the original "mid" spring as the reference, A1/A3 are
// built off it slightly looser, and S1/S3 off A1/A3 looser again - so every
// row-2 (dead-center) instance anchors its family and the row-1/row-3 edges
// get progressively bouncier moving outward from there.
const LAYER_SPRINGS = {
  outerCenter: { stiffness: 218, damping: 8.7 }, // zeta 0.30 - G2/!2, unchanged
  outerEdge: { stiffness: 185, damping: 6.5 }, // zeta 0.24 - G1/G3/!1/!3, looser
  mid: { stiffness: 190, damping: 8.3 }, // zeta 0.30 - A2/S2, unchanged, the reference A1/A3/S1/S3 are built from
  aEdge: { stiffness: 185, damping: 7.3 }, // zeta 0.27 - A1/A3, slightly looser than A2
  sEdge: { stiffness: 180, damping: 6.4 }, // zeta 0.24 - S1/S3, bouncier than A1/A3
  mOuter: { stiffness: 165, damping: 7.5 }, // zeta 0.29 - M1/M3, unchanged, the reference E is built from
  mCenter: { stiffness: 200, damping: 9.9 }, // zeta 0.35 - M2, dialed back from a first pass that was too stiff
  eEdge: { stiffness: 165, damping: 6.4 }, // zeta 0.25 - E1/E3, mOuter's stiffness, nudged bouncier
  eCenter: { stiffness: 175, damping: 7.4 }, // zeta 0.28 - E2, slightly stiffer than E1/E3
};

const LOGO_ROWS = [
  {
    top: 0,
    height: 58,
    letters: [
      { key: 'G', src: g1, x: 0, width: 78, layer: 'outerEdge' },
      { key: 'A', src: a1, x: 78, width: 69, layer: 'aEdge' },
      { key: 'M', src: m1, x: 147, width: 23, layer: 'mOuter' },
      { key: 'E', src: e1, x: 170, width: 36, layer: 'eEdge' },
      { key: 'S', src: s1, x: 206, width: 68, layer: 'sEdge' },
      { key: '!', src: bang1, x: 274, width: 18, layer: 'outerEdge' },
    ],
  },
  {
    top: 58,
    height: 56,
    letters: [
      { key: 'G', src: g2, x: 0, width: 67, layer: 'outerCenter' },
      { key: 'A', src: a2, x: 67, width: 31, layer: 'mid' },
      { key: 'M', src: m2, x: 98, width: 100, layer: 'mCenter' },
      { key: 'E', src: e2, x: 198, width: 38, layer: 'eCenter' },
      { key: 'S', src: s2, x: 236, width: 36, layer: 'mid' },
      { key: '!', src: bang2, x: 272, width: 20, layer: 'outerCenter' },
    ],
  },
  // Row 3's replacement files tile edge-to-edge with zero gap/overlap, same as
  // rows 1/2 - offsets below came from cross-referencing the shared G-shape
  // (#E4FFBB) and A-shape (#C0F2FF) landmark paths bundled into every one of
  // these 6 files, and the two landmarks agree exactly (58+21+70+50+74+18=291,
  // the full master width). `top` carries over the previous cross-correlation
  // finding against the master's actual pixels (~y=118 native).
  {
    top: 118,
    height: 54,
    letters: [
      { key: 'G', src: g3, x: 0, width: 58, layer: 'outerEdge' },
      { key: 'A', src: a3, x: 58, width: 21, layer: 'aEdge' },
      { key: 'M', src: m3, x: 79, width: 70, layer: 'mOuter' },
      { key: 'E', src: e3, x: 149, width: 50, layer: 'eEdge' },
      { key: 'S', src: s3, x: 199, width: 74, layer: 'sEdge' },
      { key: '!', src: bang3, x: 273, width: 18, layer: 'outerEdge' },
    ],
  },
];

// max, not sum: rows no longer necessarily tile with zero gap (row 3 sits a
// few px below row 2's bottom edge), so summing heights would clip it.
const LOGO_TOTAL_HEIGHT = Math.max(...LOGO_ROWS.map((row) => row.top + row.height));

function LogoLetter({ letter, top, height, rawX, rawY }) {
  const spring = LAYER_SPRINGS[letter.layer];
  const springX = useSpring(rawX, spring);
  const springY = useSpring(rawY, spring);

  return (
    <motion.img
      src={letter.src}
      alt=""
      className="home-logo-letter"
      style={{
        left: letter.x * LOGO_SCALE,
        top: top * LOGO_SCALE,
        width: letter.width * LOGO_SCALE,
        height: height * LOGO_SCALE,
        x: springX,
        y: springY,
      }}
    />
  );
}

// One shared raw pan position for the whole block, so dragging any single
// letter (anywhere in any row) moves every row together - each letter's own
// spring (keyed by concentric layer, see LAYER_SPRINGS) is what gives
// lockstep same-layer letters their matching motion and different layers
// their ring-by-ring cascade.
function LogoLetters() {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  return (
    <motion.div
      className="home-logo-letters"
      style={{ top: 0, height: LOGO_TOTAL_HEIGHT * LOGO_SCALE }}
      onPan={(_e, info) => {
        rawX.set(info.offset.x);
        rawY.set(info.offset.y);
      }}
      onPanEnd={() => {
        rawX.set(0);
        rawY.set(0);
      }}
    >
      {LOGO_ROWS.map((row) =>
        row.letters.map((letter) => (
          <LogoLetter
            key={`${row.top}-${letter.key}`}
            letter={letter}
            top={row.top}
            height={row.height}
            rawX={rawX}
            rawY={rawY}
          />
        )),
      )}
    </motion.div>
  );
}

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
  const subtitleRef = useRef(null);
  const actionsRef = useRef(null);

  // Once per mount, so each visit to Home opens on a different pair.
  const throws = useMemo(() => buildThrows(shuffle(TOSS_ICONS)), []);

  // How far the icon travels can't be a constant or a dvh calc. .home-actions is
  // position: fixed, so its top edge moves with viewport height - and on desktop
  // it resolves against .device-frame's fixed 812px box (that's what the
  // translateZ(0) in the >=601px media query does), so viewport units would be
  // measuring the wrong box there. Measuring both ends covers every case,
  // including the safe-area inset the buttons sit above.
  //
  // Safe to read mid-swipe: the page transition translates every .page > *, so
  // .home and .home-actions shift together and their difference is unchanged.
  const measureToss = useCallback(() => {
    const subtitle = subtitleRef.current;
    const actions = actionsRef.current;
    if (!subtitle || !actions) return;

    const travel = Math.max(
      actions.getBoundingClientRect().top -
        subtitle.getBoundingClientRect().bottom -
        TOSS_CLEARANCE,
      TOSS_MIN_TRAVEL,
    );
    actions.style.setProperty('--toss-travel', `${travel}px`);
  }, []);

  useLayoutEffect(() => {
    measureToss();

    // The mount measurement runs against fallback metrics, and the subtitle grows
    // ~4px taller once the real face swaps in - measured, not hypothetical. This
    // is the exact signal for that, rather than inferring it from a reflow.
    document.fonts?.ready.then(measureToss);

    // Viewport height changes move .home-actions (it's fixed to the bottom edge)
    // without changing anything's size, so an observer can't see them.
    window.addEventListener('resize', measureToss);

    // And the converse: the subtitle reflowing - a copy change, or wrapping at a
    // width the <br /> didn't anticipate - moves its bottom edge without the
    // viewport changing at all.
    const observer = new ResizeObserver(measureToss);
    if (subtitleRef.current) observer.observe(subtitleRef.current);

    return () => {
      window.removeEventListener('resize', measureToss);
      observer.disconnect();
    };
  }, [measureToss]);

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

        <div className="home-logo-wrap" role="img" aria-label="Games Games Games" style={{ height: LOGO_NATIVE_HEIGHT * LOGO_SCALE }}>
          <LogoLetters />
        </div>
        <p className="home-subtitle" ref={subtitleRef}>
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
      <div className="home-actions" ref={actionsRef}>
        {/* First child on purpose: both buttons are position: relative at
            z-index auto, so DOM order alone paints the thrown icon behind them
            without a negative z-index that .home-actions' own stacking context
            would trap anyway. */}
        <div className="home-toss" aria-hidden="true">
          {throws.map((icon) => (
            <img
              key={icon.name}
              className="home-toss__icon"
              src={icon.src}
              alt=""
              style={{
                '--toss-spin': `${icon.spin}deg`,
                '--toss-drop': `${icon.drop}px`,
                '--toss-x': `${icon.x}px`,
                '--toss-delay': `${icon.delay}ms`,
                '--toss-cycle': `${TOSS_CYCLE_MS}ms`,
              }}
            />
          ))}
        </div>

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
