import PageHeader from '../components/PageHeader.jsx';
import { useHorizontalSwipeToHome } from '../lib/pageSwipe.js';

export default function FavoriteGames() {
  // Sits to Home's left, same as the menu: in from the left, back off to the
  // left. See lib/pageSwipe.js.
  const { startBack, swipeClass, rootProps } = useHorizontalSwipeToHome();

  return (
    <div className={`page${swipeClass}`} {...rootProps}>
      <PageHeader title="Favorite Games" centered onBack={startBack} />
    </div>
  );
}
