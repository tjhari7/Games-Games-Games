import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DiscoverGameCard from '../components/DiscoverGameCard.jsx';
import DiscoverRiseBackdrop from '../components/DiscoverRiseBackdrop.jsx';
import { api } from '../lib/api.js';
import { useFavoriteGames } from '../lib/useFavoriteGames.js';
import { useDiscoverRiseSwipe } from '../lib/pageSwipe.js';
import { getBundle, bundleGames, metaFor, isTypeBundleId, typeBundle, TYPE_BUNDLE_PREFIX } from '../lib/community.js';

// A single curated bundle: a bright hero wearing the bundle's accent, the
// curator's note, a "Save all" button, then the bundle's games as Discover
// cards. Every game here is a real record; "Save all" favorites the ones not
// already saved.
export default function BundleDetail() {
  const { bundleId } = useParams();
  const navigate = useNavigate();
  const { swipeClass, rising, startBack, rootProps } = useDiscoverRiseSwipe('/discover');
  const { isFavorite, toggleFavorite } = useFavoriteGames();
  const [games, setGames] = useState(() => api.getCachedGames() || []);
  const [types, setTypes] = useState(() => api.getCachedGameTypes() || []);

  useEffect(() => {
    api.getGames().then(setGames).catch(() => {});
    api.getGameTypes().then(setTypes).catch(() => {});
  }, []);

  // A curated bundle resolves straight from the id; a "Game Type Bundle" id
  // (type-<typeId>) is built from the live types list.
  const isTypeBundle = isTypeBundleId(bundleId);
  const bundle = useMemo(() => {
    if (isTypeBundle) {
      const t = types.find((x) => x.id === bundleId.slice(TYPE_BUNDLE_PREFIX.length));
      return t ? typeBundle(t) : null;
    }
    return getBundle(bundleId);
  }, [bundleId, isTypeBundle, types]);

  const list = useMemo(() => (bundle ? bundleGames(bundle.id, games) : []), [bundle, games]);
  const unsavedCount = list.filter((g) => !isFavorite(g.id)).length;

  const goBack = startBack;

  if (!bundle) {
    // A type bundle can't resolve until the types list has loaded — hold the
    // "not found" message until then so it isn't shown on a slow first paint.
    const stillLoading = isTypeBundle && types.length === 0;
    return (
      <div className={`page discover-rise-page${swipeClass}`} {...rootProps}>
        {rising && <DiscoverRiseBackdrop />}
        <PageHeader title="Bundle" centered onBack={goBack} />
        {!stillLoading && <p className="state-message">Bundle not found.</p>}
      </div>
    );
  }

  function saveAll() {
    list.forEach((g) => {
      if (!isFavorite(g.id)) toggleFavorite(g.id);
    });
  }

  return (
    <div className={`page discover-rise-page${swipeClass}`} {...rootProps}>
      {rising && <DiscoverRiseBackdrop />}
      <div
        className="scroll-back-header category-hero-header bundle-hero-header"
        style={{ background: bundle.accent }}
      >
        <PageHeader
          titleSlot={<span className="page-title-eesti">Bundle</span>}
          centered
          onBack={goBack}
        />
      </div>

      <div className="page-content">
        <div className="bundle-detail-intro">
          <p className="bundle-detail-title">{bundle.title}</p>
          <p className="bundle-detail-blurb">{bundle.blurb}</p>
          <p className="bundle-detail-curator">
            {isTypeBundle
              ? `${list.length} ${list.length === 1 ? 'game' : 'games'} · the whole game type`
              : `Curated by ${bundle.curator} · ${list.length} ${list.length === 1 ? 'game' : 'games'}`}
          </p>
          <button
            type="button"
            className="discover-save-btn discover-save-btn--wide"
            onClick={saveAll}
            disabled={unsavedCount === 0}
          >
            <span className="material-symbols-outlined">{unsavedCount === 0 ? 'check' : 'playlist_add'}</span>
            {unsavedCount === 0 ? 'All saved to your collection' : `Save all ${unsavedCount} to my collection`}
          </button>
        </div>

        <div className="game-list">
          {list.map((g) => (
            <DiscoverGameCard
              key={g.id}
              game={g}
              meta={metaFor(g.title)}
              isSaved={isFavorite(g.id)}
              onToggleSave={toggleFavorite}
              onOpen={() => navigate(`/discover/games/${g.id}`, { state: { discoverRise: true } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
