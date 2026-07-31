import { useEffect } from 'react';
import { finalColorBucket } from '../../data/congress';

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

const RING_COLORS = {
  green:  '#5cc840',
  orange: '#e88c28',
  red:    '#e8503e',
};

function FinalProgress({ value }) {
  if (value == null || !Number.isFinite(value)) return null;
  const pct    = Math.round(value * 100);
  const bucket = finalColorBucket(value) ?? 'orange';
  const color  = RING_COLORS[bucket];
  const size   = 72;
  const stroke = 6;
  const r      = (size - stroke) / 2;
  const c      = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, value)));

  return (
    <div className="cv-final" aria-label={`Final score ${pct}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="cv-final-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="cv-final-ring"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="cv-final-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}

function LegislationList({ legislation, loading }) {
  return (
    <div className="cv-leg-section">
      <p className="cv-leg-title">Sponsored Legislation</p>
      {loading ? (
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
  );
}

export default function EndorsedView({
  endorsed,
  incumbent,
  loadingIncumbent,
  legislation,
  loadingLegislation,
  onClose,
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="cv-backdrop" onClick={onClose}>
      <div className="ev-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cv-accent" />
        <button className="cv-close" onClick={onClose} aria-label="Close">&times;</button>

        <div className="ev-columns">
          <div className="ev-col ev-col-endorsed">
            <p className="ev-col-label">Endorsed Candidate</p>
            {endorsed && (
              <div className="cv-body">
                <div className="cv-header-row">
                  <div className="cv-photo-col">
                    {endorsed.imageUrl && (
                      <img className="cv-photo" src={endorsed.imageUrl} alt={endorsed.name} />
                    )}
                    {endorsed.role && <p className="cv-role">{endorsed.role}</p>}
                  </div>
                  <div className="cv-header-meta">
                    <p className="cv-dist">
                      {endorsed.state}{endorsed.district != null ? `-${endorsed.district}` : ''}
                      {endorsed.party && <> &middot; {endorsed.party}</>}
                    </p>
                    <h2 className="cv-name">{endorsed.name}</h2>
                    {endorsed.status && (
                      <div className={`mp-badge ${endorsed.status === 'won' ? 'won' : 'act'}`}>
                        {endorsed.status === 'won' ? '✓ Won Primary' : '● Active Race'}
                      </div>
                    )}
                  </div>
                </div>
                {endorsed.bio && (
                  <>
                    <div className="cv-divider" />
                    <p className="cv-bio">{endorsed.bio}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="ev-divider-v" aria-hidden="true" />

          <div className="ev-col ev-col-incumbent">
            <p className="ev-col-label">Current Representative</p>
            {loadingIncumbent ? (
              <div className="cv-loading">
                <Spinner />
                <span>Loading member data&hellip;</span>
              </div>
            ) : incumbent ? (
              <div className="cv-body">
                <div className="cv-header-row">
                  <div className="cv-photo-col">
                    {incumbent.imageUrl && (
                      <img className="cv-photo" src={incumbent.imageUrl} alt={incumbent.name} />
                    )}
                    {incumbent.role && <p className="cv-role">{incumbent.role}</p>}
                  </div>
                  <div className="cv-header-meta">
                    <p className="cv-dist">
                      {incumbent.state}{incumbent.district != null ? `-${incumbent.district}` : ''}
                      {incumbent.party && <> &middot; {incumbent.party}</>}
                    </p>
                    <h2 className="cv-name">{incumbent.name}</h2>
                  </div>
                  <FinalProgress value={incumbent.final} />
                </div>
                <div className="cv-divider" />
                <LegislationList legislation={legislation} loading={loadingLegislation} />
              </div>
            ) : (
              <div className="cv-loading">
                <span>Could not load incumbent data.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
