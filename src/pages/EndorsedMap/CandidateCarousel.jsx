import { useEffect, useRef, useState } from 'react';

function PartyBadge({ party }) {
  if (!party) return null;
  const isRep = party.toLowerCase().startsWith('rep');
  const isDem = party.toLowerCase().startsWith('dem');
  const cls   = isRep ? 'pb-rep' : isDem ? 'pb-dem' : 'pb-ind';
  return <span className={`mp-party-badge ${cls}`}>{party}</span>;
}

function SkeletonCard() {
  return (
    <div className="mp-card mp-card-skeleton" aria-hidden="true">
      <div className="mp-sk-photo" />
      <div className="mp-sk-line mp-sk-name" />
      <div className="mp-sk-line mp-sk-dist" />
      <div className="mp-sk-line mp-sk-desc" />
    </div>
  );
}

export default function CandidateCarousel({ cards, activeCard, onCardClick }) {
  const containerRef = useRef(null);
  const trackRef     = useRef(null);
  const [revolving, setRevolving] = useState(false);
  const [duration,  setDuration]  = useState(20);

  const loading = cards.length === 0;

  useEffect(() => {
    if (loading) return;
    const container = containerRef.current;
    const track     = trackRef.current;
    if (!container || !track) return;

    function measure() {
      track.style.animation = 'none';
      track.style.transform = 'none';

      const singleSetWidth = cards.reduce((acc, _, i) => {
        const el = track.children[i];
        return acc + (el ? el.getBoundingClientRect().width + 16 : 0);
      }, 0);

      const containerWidth = container.getBoundingClientRect().width;
      const shouldRevolve  = singleSetWidth > containerWidth;

      track.style.animation = '';
      track.style.transform = '';

      setRevolving(shouldRevolve);
      if (shouldRevolve) {
        setDuration(Math.max(10, singleSetWidth / 60));
      }
    }

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    measure();

    return () => ro.disconnect();
  }, [cards, loading]);

  const displayCards = revolving ? [...cards, ...cards] : cards;

  return (
    <div className="map-panel">
      <div className="mp-carousel-header">
        <h3>Endorsed Races</h3>
        <p className="mp-sub">
          {loading
            ? 'Loading endorsed candidates\u2026'
            : `${cards.length} candidate${cards.length !== 1 ? 's' : ''} fighting for America First values in Congress.`}
        </p>
      </div>

      <div className="mp-scroll-area" ref={containerRef}>
        {loading ? (
          <div className="mp-track">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div
            ref={trackRef}
            className={`mp-track${revolving ? ' revolving' : ''}`}
            style={revolving ? { animationDuration: `${duration}s` } : undefined}
          >
            {displayCards.map((card, idx) => (
              <div
                key={`${card.bioguideId}-${idx}`}
                id={idx < cards.length ? card.distKey : undefined}
                className={`mp-card${activeCard === card.distKey ? ' active' : ''}`}
                onClick={() => onCardClick(card)}
              >
                <div className="mp-card-inner">
                  {card.imageUrl && (
                    <img
                      className="mp-photo"
                      src={card.imageUrl}
                      alt={card.name}
                      loading="lazy"
                    />
                  )}
                  <div className="mp-card-text">
                    <h4>{card.name}</h4>
                    <p className="mp-dist">
                      {card.state}-{card.district}
                      {card.party && <> &middot; <PartyBadge party={card.party} /></>}
                    </p>
                    {card.status && (
                      <div className={`mp-badge ${card.status === 'won' ? 'won' : 'act'}`}>
                        {card.status === 'won' ? '✓ Won Primary' : '● Active Race'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
