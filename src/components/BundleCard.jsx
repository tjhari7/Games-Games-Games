import Icon from './Icon.jsx';
import { formatSaves } from '../lib/community.js';
// A compact card for the horizontal Bundles rail on Discover. Wears the
// bundle's bright accent as its fill with dark ink, the way the category hero
// headers do. The root is a div, not a button, so the Save control can be a real
// nested button (no button-in-button); Enter/Space on the card still opens it.
export default function BundleCard({ bundle, count, onOpen, isSaved, onToggleSave }) {
  return (
    <div
      className="bundle-card"
      style={{ background: bundle.accent }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(bundle)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(bundle);
        }
      }}
    >
      <span className="bundle-card__count">{count} {count === 1 ? 'game' : 'games'}</span>
      <span className="bundle-card__chevron" aria-hidden="true">
        <Icon name="chevron_right" />
      </span>
      <span className="bundle-card__title">{bundle.title}</span>
      <span className="bundle-card__blurb">{bundle.blurb}</span>
      {(bundle.saves != null || onToggleSave) && (
        <div className="bundle-card__footer">
          {onToggleSave && (
            <button
              type="button"
              className={`discover-save-btn${isSaved ? ' is-saved' : ''}`}
              aria-pressed={isSaved}
              aria-label={isSaved ? `${bundle.title} saved` : `Save ${bundle.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave();
              }}
            >
              <Icon name={isSaved ? 'bookmark_check' : 'bookmark'} filled={isSaved} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
          )}
          {bundle.saves != null && <span className="bundle-card__saves">{formatSaves(bundle.saves)} saves</span>}
        </div>
      )}
    </div>
  );
}
