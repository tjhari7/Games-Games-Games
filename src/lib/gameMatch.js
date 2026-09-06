// Player-range and play-time matching for the Players / Time filters.
//
// The game's `players` and `time` fields are free text ("2-4", "3+", "10-20
// min", "Under 10 min"), so matching a filter value means parsing that text
// into a rough numeric range and testing for overlap. This lived inline in
// server/app.js; it now also runs in the browser so the filter drawer can show
// a live per-type count that reacts to the Players and Time selections. Keep it
// dependency-free — it is imported by both the API and the front end.

// Parses flexible player-range text ("2-4", "3+", "1", "2 to 6") and tests
// whether a given player count fits within it.
export function playersMatch(playersText, target) {
  if (!playersText) return false;
  // "8+" means "supports a group of 8 or more" — match games whose range
  // reaches 8 or beyond, rather than requiring an exact player count.
  if (target === '8+') {
    const text = playersText.trim();
    const plusMatch = text.match(/^(\d+)\s*\+/);
    if (plusMatch) return true;
    const rangeMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
    if (rangeMatch) return Number(rangeMatch[2]) >= 8;
    const singleMatch = text.match(/^(\d+)$/);
    if (singleMatch) return Number(singleMatch[1]) >= 8;
    return false;
  }
  const text = playersText.trim();
  const plusMatch = text.match(/^(\d+)\s*\+/);
  if (plusMatch) return target >= Number(plusMatch[1]);
  const rangeMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
  if (rangeMatch) {
    const [, lo, hi] = rangeMatch;
    return target >= Number(lo) && target <= Number(hi);
  }
  const singleMatch = text.match(/^(\d+)$/);
  if (singleMatch) return target === Number(singleMatch[1]);
  return false;
}

// Parses flexible time text ("5 min", "10-20 min", "30 min+") into a rough
// [min, max] range in minutes, then tests whether it overlaps a bucket.
export function parseTimeRangeMinutes(timeText) {
  if (!timeText) return null;
  const text = timeText.toLowerCase();
  // "Under 10 min" is a ceiling, not a single value — without this it would
  // fall through to singleMatch and parse as exactly 10.
  const underMatch = text.match(/^\s*(?:under|less than|up to)\s*(\d+)/);
  if (underMatch) return [0, Number(underMatch[1])];
  const plusMatch = text.match(/(\d+)\s*(?:min|minutes)?\s*\+/);
  if (plusMatch) return [Number(plusMatch[1]), Infinity];
  const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) return [Number(rangeMatch[1]), Number(rangeMatch[2])];
  const singleMatch = text.match(/(\d+)/);
  if (singleMatch) return [Number(singleMatch[1]), Number(singleMatch[1])];
  return null;
}

const TIME_BUCKET_RANGES = {
  '5min': [0, 9],
  '10min': [10, 14],
  '15min': [15, 19],
  '20min': [20, 29],
  '30plus': [30, Infinity],
};

// Matches on the game's minimum stated time only, so a game only shows up
// under one bucket rather than every bucket its range could reach into — a
// "15 to 30 min" game rounds down to its floor and lands in the 15-min bucket.
export function timeMatchesBucket(timeText, bucket) {
  const range = parseTimeRangeMinutes(timeText);
  if (!range) return false;
  const [lo] = range;
  const bucketRange = TIME_BUCKET_RANGES[bucket];
  if (!bucketRange) return true;
  const [bucketLo, bucketHi] = bucketRange;
  return lo >= bucketLo && lo <= bucketHi;
}

// The `players` and `time_bucket` selections are comma-separated lists (the
// filter UI is multi-select). A game passes if it fits *any* one of the chosen
// values — an OR within each group. An empty selection matches everything.
export function playersMatchesAny(playersText, param) {
  if (!param) return true;
  const targets = param.split(',').map((p) => (p === '8+' ? '8+' : Number(p)));
  return targets.some((t) => playersMatch(playersText, t));
}

export function timeMatchesAnyBucket(timeText, param) {
  if (!param) return true;
  return param.split(',').some((b) => timeMatchesBucket(timeText, b));
}
