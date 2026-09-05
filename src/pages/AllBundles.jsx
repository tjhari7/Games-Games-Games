import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import BundleCard from '../components/BundleCard.jsx';
import DiscoverRiseBackdrop from '../components/DiscoverRiseBackdrop.jsx';
import { api } from '../lib/api.js';
import { useBundleSave } from '../lib/useBundleSave.js';
import { useDiscoverRiseSwipe } from '../lib/pageSwipe.js';
import { BUNDLES, bundleGames } from '../lib/community.js';

// Every curated bundle in one place — the full-list companion to Discover's
// horizontal Bundles rail. Same BundleCard, stacked full-width; tapping one
// opens its detail page, back returns to Discover.
export default function AllBundles() {
  const navigate = useNavigate();
  const { swipeClass, rising, startBack, rootProps } = useDiscoverRiseSwipe('/discover');
  const [games, setGames] = useState(() => api.getCachedGames() || []);
  const { isBundleSaved, toggleBundleSave } = useBundleSave();

  useEffect(() => {
    api.getGames().then(setGames).catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const out = {};
    BUNDLES.forEach((b) => {
      out[b.id] = bundleGames(b.id, games).length;
    });
    return out;
  }, [games]);

  return (
    <div className={`page discover-rise-page${swipeClass}`} {...rootProps}>
      {rising && <DiscoverRiseBackdrop />}
      <div className="scroll-back-header">
        <PageHeader title="Bundles" centered onBack={startBack} />
      </div>

      <div className="page-content">
        <div className="bundle-list">
          {BUNDLES.map((b) => (
            <BundleCard
              key={b.id}
              bundle={b}
              count={counts[b.id] || 0}
              isSaved={isBundleSaved(b.id)}
              onToggleSave={() => toggleBundleSave(b.id)}
              onOpen={() => navigate(`/discover/bundles/${b.id}`, { state: { discoverRise: true } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
