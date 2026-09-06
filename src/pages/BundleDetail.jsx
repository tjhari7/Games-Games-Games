import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import DiscoverGameCard from '../components/DiscoverGameCard.jsx';
import { api } from '../lib/api.js';
import { useDiscoverSaves } from '../lib/discoverSaves.js';
import { useMenuOverlaySwipe } from '../lib/pageSwipe.js';
import {
  getBundle,
  bundleGames,
  metaFor,
  formatSaves,
  isTypeBundleId,
  typeBundle,
  TYPE_BUNDLE_PREFIX,
} from '../lib/community.js';

// A single curated bundle: a bright hero wearing the bundle's accent, a line of
// context (saves + game count), a "Save Bundle" button, then the bundle's games
// as Discover cards. Save is the same front-of-house gesture as the Discover
// cards — shared per-visit state in lib/discoverSaves.js, so this page and the
// bundle's card always agree — and never touches the real favorites list.
export default function BundleDetail() {
  const { bundleId } = useParams();
  const navigate = useNavigate();
  const { swipeClass, startBack, rootProps } = useMenuOverlaySwipe('/discover');
  const { isGameSaved, toggleGameSave, isBundleSaved, toggleBundleSave } = useDiscoverSaves();
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
  const gameIds = useMemo(() => list.map((g) => g.id), [list]);

  const goBack = startBack;

  if (!bundle) {
    // A type bundle can't resolve until the types list has loaded — hold the
    // "not found" message until then so it isn't shown on a slow first paint.
    const stillLoading = isTypeBundle && types.length === 0;
    return (
      <div className={`page${swipeClass}`} {...rootProps}>
        <PageHeader title="Bundle" centered onBack={goBack} />
        {!stillLoading && <p className="state-message">Bundle not found.</p>}
      </div>
    );
  }

  // "Save Bundle" is a Save All: the bundle reads as saved only while every game
  // in it is saved, so ticking one game card off below drops the button back to
  // "Save Bundle" — and tapping the button saves or clears the whole list. Same
  // derivation runs on the bundle's Discover card, so the two always agree.
  const saved = isBundleSaved(gameIds);

  return (
    <div className={`page${swipeClass}`} {...rootProps}>
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
        <div className="bundle-detail-intro" style={{ background: bundle.accent }}>
          <span className="bundle-detail-count">
            {list.length} {list.length === 1 ? 'game' : 'games'}
          </span>
          <p className="bundle-detail-title">{bundle.title}</p>
          <p className="bundle-detail-blurb">{bundle.blurb}</p>
          <p className="bundle-detail-curator">
            {isTypeBundle
              ? `${formatSaves(bundle.saves)} saves · the whole game type`
              : `${formatSaves(bundle.saves)} saves · ${list.length} ${list.length === 1 ? 'game' : 'games'}`}
          </p>
          <button
            type="button"
            className={`discover-save-btn discover-save-btn--block${saved ? ' is-saved' : ''}`}
            aria-pressed={saved}
            onClick={() => toggleBundleSave(gameIds)}
          >
            <Icon name={saved ? 'bookmark_check' : 'bookmark'} filled={saved} />
            {saved ? 'Saved Bundle' : 'Save Bundle'}
          </button>
        </div>

        <div className="game-list bundle-detail-games">
          {list.map((g) => (
            <DiscoverGameCard
              key={g.id}
              game={g}
              meta={metaFor(g.title)}
              isSaved={isGameSaved(g.id)}
              onToggleSave={toggleGameSave}
              onOpen={() => navigate(`/discover/games/${g.id}`, { state: { swipeForwardFromRight: true } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
