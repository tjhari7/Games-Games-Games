// The favicon "G" reused as a loading indicator. Pure-CSS spin (see
// .games-loader in index.css): one snappy clockwise turn, a pause, repeat.
// Rendered while a list is fetching and removed on the beat after the spin
// lands — see lib/useLoaderGate.js, which also keeps it off screen entirely
// when the data arrives fast enough that a spinner would only flash.
//
// The glyph is painted as a CSS mask rather than an <img> so `color` can tint
// it: the type pages pass their own colour so the G matches the page it is
// loading. Omit it for the default lavender.
export default function GamesLoader({ color, className = '' }) {
  return (
    <div className={`games-loader ${className}`.trim()} role="status" aria-label="Loading games">
      <span className="games-loader__g" style={color ? { backgroundColor: color } : undefined} />
    </div>
  );
}
