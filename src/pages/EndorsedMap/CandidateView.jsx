import { useEffect } from 'react';

function Spinner() {
  return <span className="cv-spinner" aria-label="Loading" />;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function CandidateView({ card, loading, legislation, loadingLegislation, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="cv-backdrop" onClick={onClose}>
      <div className="cv-panel" onClick={(e) => e.stopPropagation()}>

        <div className="cv-accent" />
        <button className="cv-close" onClick={onClose} aria-label="Close">&times;</button>

        {loading ? (
          <div className="cv-loading">
            <Spinner />
            <span>Loading member data&hellip;</span>
          </div>
        ) : card ? (
          <div className="cv-body">
            <div className="cv-header-row">
              {card.imageUrl && (
                <img className="cv-photo" src={card.imageUrl} alt={card.name} />
              )}
              <div className="cv-header-meta">
                <p className="cv-dist">
                  {card.state}{card.district != null ? `-${card.district}` : ''}
                  {card.party && <> &middot; {card.party}</>}
                </p>
                <h2 className="cv-name">{card.name}</h2>
                {card.status && (
                  <div className={`mp-badge ${card.status === 'won' ? 'won' : 'act'}`}>
                    {card.status === 'won' ? '✓ Won Primary' : '● Active Race'}
                  </div>
                )}
              </div>
            </div>

            <div className="cv-divider" />

            <div className="cv-leg-section">
              <p className="cv-leg-title">Sponsored Legislation</p>
              {loadingLegislation ? (
                <div className="cv-leg-loading">
                  <Spinner /> <span>Loading bills&hellip;</span>
                </div>
              ) : legislation.length === 0 ? (
                <p className="cv-leg-empty">No sponsored legislation found.</p>
              ) : (
                <ul className="cv-leg-list">
                  {legislation.map((bill, i) => (
                    <li key={i} className="cv-leg-item">
                      <div className="cv-leg-meta">
                        <span className="cv-leg-num">{bill.type} {bill.number}</span>
                        {bill.introducedDate && (
                          <span className="cv-leg-date">{formatDate(bill.introducedDate)}</span>
                        )}
                      </div>
                      {bill.url ? (
                        <a
                          className="cv-leg-link"
                          href={bill.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {bill.title}
                        </a>
                      ) : (
                        <span className="cv-leg-link">{bill.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
