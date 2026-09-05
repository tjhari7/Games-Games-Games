import DiscoverContent from './DiscoverContent.jsx';

// The two extra layers a Discover destination page (a bundle, All Bundles, a
// community game) renders as its first children *only while it is sliding in or
// out* — see useDiscoverRiseSwipe / the .discover-rise-* rules in index.css:
//
//   .discover-rise-under  — an inert, non-interactive copy of Discover, held
//                           still behind everything, so the page rises over the
//                           screen it was opened from instead of a blank frame.
//   .discover-rise-shade  — an opaque full-bleed panel that travels with the
//                           real content, so what slides up reads as one solid
//                           page rather than a stack of transparent bands.
//
// Both are dropped the moment the animation ends, so a settled detail page is
// exactly as before.
export default function DiscoverRiseBackdrop() {
  return (
    <>
      <div className="discover-rise-under" aria-hidden="true">
        <DiscoverContent />
      </div>
      <div className="discover-rise-shade" aria-hidden="true" />
    </>
  );
}
