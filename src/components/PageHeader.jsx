import { useNavigate } from 'react-router-dom';

// `onBack` takes over the button entirely, for pages that animate on the way
// out and so have to run the navigation themselves once the swipe lands.
export default function PageHeader({ title, backTo = '/', centered = false, tight = false, actions = null, onBack }) {
  const navigate = useNavigate();
  const goBack = onBack || (() => (backTo === 'history' ? navigate(-1) : navigate(backTo)));
  return (
    <div className={`page-header ${centered ? 'page-header-centered' : ''} ${tight ? 'page-header-tight' : ''}`}>
      <button className="back-link" onClick={goBack} aria-label="Back">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 className="page-title">{title}</h1>
      {actions && <div className="details-header-actions">{actions}</div>}
    </div>
  );
}
