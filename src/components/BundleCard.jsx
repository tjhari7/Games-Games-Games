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
        <span className="material-symbols-outlined">chevron_right</span>
      </span>
      <span className="bundle-card__title">{bundle.title}</span>
      <span className="bundle-card__blurb">{bundle.blurb}</span>
      {(bundle.curator || onToggleSave) && (
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
              <span className="material-symbols-outlined">{isSaved ? 'check' : 'add'}</span>
              {isSaved ? 'Saved' : 'Save'}
            </button>
          )}
          {bundle.curator && <span className="bundle-card__curator">{bundle.curator}</span>}
        </div>
      )}
    </div>
  );
}
