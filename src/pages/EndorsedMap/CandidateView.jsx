import { useEffect } from 'react';

export default function CandidateView({ card, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!card) return null;

  return (
    <div className="cv-backdrop" onClick={onClose}>
      <div className="cv-panel" onClick={(e) => e.stopPropagation()}>

        <div className="cv-accent" />

        <button className="cv-close" onClick={onClose} aria-label="Close">&times;</button>

        <div className="cv-body">
          <p className="cv-dist">
            {card.state}-{card.dist}&nbsp;&middot;&nbsp;{card.region}
          </p>

          <h2 className="cv-name">{card.name}</h2>

          <div className={`mp-badge ${card.status === 'won' ? 'won' : 'act'}`}>
            {card.status === 'won' ? '✓ Won Primary' : '● Active Race'}
          </div>

          <div className="cv-divider" />

          <p className="cv-bio">{card.desc}</p>
        </div>
      </div>
    </div>
  );
}
