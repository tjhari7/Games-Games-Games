import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import BundleCard from '../components/BundleCard.jsx';
import { api } from '../lib/api.js';
import { useDiscoverSaves } from '../lib/discoverSaves.js';
import { useMenuOverlaySwipe } from '../lib/pageSwipe.js';
import { BUNDLES, bundleGames } from '../lib/community.js';

// Every curated bundle in one place — the full-list companion to Discover's
// horizontal Bundles rail. Same BundleCard, stacked full-width. Opened from
// Discover, it slides in from the right over a stationary Discover; tapping a
// bundle opens its detail page the same way, and back slides straight off to
// the right — the same motion as the pages launched from Home's ⋮ menu.
export default function AllBundles() {
  const navigate = useNavigate();
  const { swipeClass, startBack, rootProps } = useMenuOverlaySwipe('/discover');
  const [games, setGames] = useState(() => api.getCachedGames() || []);
  const { isBundleSaved, toggleBundleSave } = useDiscoverSaves();

  useEffect(() => {
    api.getGames().then(setGames).catch(() => {});
  }, []);

  // Each bundle's game ids — "saved" is derived from these (every game saved),
  // matching the Discover rail and the bundle detail page. `counts` reads the
  // same map.
  const bundleGameIds = useMemo(() => {
    const map = {};
    BUNDLES.forEach((b) => {
      map[b.id] = bundleGames(b.id, games).map((g) => g.id);
    });
    return map;
  }, [games]);

  return (
    <div className={`page${swipeClass}`} {...rootProps}>
      <div className="scroll-back-header">
        <PageHeader
          title="Bundles"
          titleSlot={<span className="page-title-eesti">Bundles</span>}
          centered
          onBack={startBack}
        />
      </div>

      <div className="page-content">
        <div className="bundle-list">
          {BUNDLES.map((b) => (
            <BundleCard
              key={b.id}
              bundle={b}
              count={(bundleGameIds[b.id] || []).length}
              isSaved={isBundleSaved(bundleGameIds[b.id] || [])}
              onToggleSave={() => toggleBundleSave(bundleGameIds[b.id] || [])}
              onOpen={() => navigate(`/discover/bundles/${b.id}`, { state: { swipeForwardFromRight: true } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
