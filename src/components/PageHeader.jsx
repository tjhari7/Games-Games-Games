import { useNavigate } from 'react-router-dom';

// `onBack` takes over the button entirely, for pages that animate on the way
// out and so have to run the navigation themselves once the swipe lands.
// `titleSlot` swaps the plain text title for custom markup (e.g. a type's
// wordmark logo) while keeping the same back-link/actions positioning — see
// CategoryGames' hero header.
export default function PageHeader({
  title,
  backTo = '/',
  centered = false,
  tight = false,
  actions = null,
  onBack,
  titleSlot = null,
  hideBack = false,
}) {
  const navigate = useNavigate();
  const goBack = onBack || (() => (backTo === 'history' ? navigate(-1) : navigate(backTo)));
  return (
    <div className={`page-header ${centered ? 'page-header-centered' : ''} ${tight ? 'page-header-tight' : ''}`}>
      {!hideBack && (
        <button className="back-link" onClick={goBack} aria-label="Back">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      )}
      <h1 className="page-title">{titleSlot || title}</h1>
      {actions && <div className="details-header-actions">{actions}</div>}
    </div>
  );
}
