// Keeps the reader's place while the "Turn your phone upright" cover is up.
//
// Turning a phone sideways re-lays the whole app out at the wider width — at
// 601px and up it even swaps into the desktop device frame, where the window no
// longer scrolls at all — so by the time the phone comes back upright the page
// has been clamped or reset to the top. This remembers where the window was
// while the phone was upright and puts it back on the way out of landscape.
//
// The cover is a CSS media query (.rotate-lock in index.css); QUERY must match
// it exactly, or the app would decide it is covered when it is not.
const QUERY = '(orientation: landscape) and (pointer: coarse) and (max-height: 500px)';

// Layout is not always settled on the first frame back in portrait — fonts, the
// carousel re-centring — so the position is put back a few times over the first
// third of a second, the retries stopping the moment the reader moves the page.
const RETRY_DELAYS = [0, 60, 150, 300];

const mq = window.matchMedia(QUERY);
const restoredListeners = new Set();

let savedY = 0;
let restoring = false;
let lastSet = 0;
let timers = [];

// True from the moment the phone goes sideways until the position is back. While
// it is true, scroll and resize are side effects of the rotation rather than
// something the reader did, so anything that reacts to them should hold still.
export function isRotationCovered() {
  return mq.matches || restoring;
}

// Runs `cb` once the position has been put back, so scroll-linked state can take
// the restored position as its new baseline. Returns the unsubscribe.
export function onRotationRestored(cb) {
  restoredListeners.add(cb);
  return () => restoredListeners.delete(cb);
}

function finish() {
  timers = [];
  restoring = false;
  savedY = Math.max(0, window.scrollY);
  restoredListeners.forEach((cb) => cb());
}

function attempt(i) {
  // Something else moved the page since our last write: the reader has taken
  // over, so stop fighting them.
  if (i > 0 && Math.abs(window.scrollY - lastSet) > 4) {
    finish();
    return;
  }
  window.scrollTo(0, savedY);
  lastSet = window.scrollY;
  if (i < RETRY_DELAYS.length - 1) {
    timers.push(setTimeout(() => attempt(i + 1), RETRY_DELAYS[i + 1] - RETRY_DELAYS[i]));
  } else {
    finish();
  }
}

// Only while upright: a scroll that arrives after the phone has gone sideways is
// the layout being clamped, and would overwrite the position worth keeping.
window.addEventListener(
  'scroll',
  () => {
    if (!isRotationCovered()) savedY = Math.max(0, window.scrollY);
  },
  { passive: true },
);

mq.addEventListener('change', () => {
  timers.forEach(clearTimeout);
  timers = [];
  if (mq.matches) {
    restoring = false;
    return;
  }
  restoring = true;
  attempt(0);
});
