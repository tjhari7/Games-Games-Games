import { useMenuOverlaySwipe } from '../lib/pageSwipe.js';
import DiscoverContent from '../components/DiscoverContent.jsx';

// Discover's page shell: the swipe wiring and nothing else. The contents live
// in DiscoverContent so the Game Types sheet can render a second, inert copy of
// them one screen up and pull it down on close — see the note there.
export default function Discover() {
  // Opened from the ⋮ menu on Home's right edge: back slides it off to the right
  // over a stationary Home with the ⋮ menu open again — same as Add Game / Edit
  // Game Types.
  const { startBack, swipeClass, rootProps } = useMenuOverlaySwipe('/', { reopenMenu: true });

  return <DiscoverContent swipeClass={swipeClass} rootProps={rootProps} onBack={startBack} />;
}
