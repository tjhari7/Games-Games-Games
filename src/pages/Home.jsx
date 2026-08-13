import { useSwipeFromHome } from '../lib/pageSwipe.js';
import HomeContent from '../components/HomeContent.jsx';

export default function Home() {
  // The menu and the six game type pages sit to Home's left: Home slides off to
  // the right, the destination comes in from the left, and Home returns from
  // the right on the way back. Play A Game is the one exception — the draw
  // still sits below Home on the vertical axis.
  const { startForward, swipeClass, rootProps } = useSwipeFromHome();

  return (
    <div className={`page${swipeClass}`} {...rootProps}>
      <HomeContent onGo={startForward} />
    </div>
  );
}
