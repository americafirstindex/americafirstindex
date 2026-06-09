import { useEffect, useRef, useState } from 'react';

export default function CandidateCarousel({ cards, activeCard, onCardClick }) {
  const containerRef = useRef(null);
  const trackRef     = useRef(null);
  const [revolving, setRevolving] = useState(false);
  const [duration,  setDuration]  = useState(20);

  useEffect(() => {
    const container = containerRef.current;
    const track     = trackRef.current;
    if (!container || !track) return;

    function measure() {
      // Temporarily collapse animation so we measure natural (single-set) width
      track.style.animation = 'none';
      track.style.transform = 'none';

      // Use first half of track children if already doubled
      const singleSetWidth = cards.reduce((acc, _, i) => {
        const el = track.children[i];
        return acc + (el ? el.getBoundingClientRect().width + 16 : 0); // 16 = 1rem gap
      }, 0);

      const containerWidth = container.getBoundingClientRect().width;
      const shouldRevolve  = singleSetWidth > containerWidth;

      track.style.animation = '';
      track.style.transform = '';

      setRevolving(shouldRevolve);
      if (shouldRevolve) {
        // duration in seconds: full single-set width / 60 px-per-second
        setDuration(Math.max(10, singleSetWidth / 60));
      }
    }

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    measure();

    return () => ro.disconnect();
  }, [cards]);

  const displayCards = revolving ? [...cards, ...cards] : cards;

  return (
    <div className="map-panel">
      <div className="mp-carousel-header">
        <h3>Endorsed Races</h3>
        <p className="mp-sub">Six candidates fighting for America First values in Congress.</p>
      </div>

      <div className="mp-scroll-area" ref={containerRef}>
        <div
          ref={trackRef}
          className={`mp-track${revolving ? ' revolving' : ''}`}
          style={revolving ? { animationDuration: `${duration}s` } : undefined}
        >
          {displayCards.map((card, idx) => (
            <div
              key={`${card.id}-${idx}`}
              id={idx < cards.length ? card.id : undefined}
              className={`mp-card${activeCard === card.id ? ' active' : ''}`}
              onClick={() => onCardClick(card)}
            >
              <h4>{card.name}</h4>
              <p className="mp-dist">{card.state}-{card.dist} &middot; {card.region}</p>
              <p className="mp-desc">{card.desc}</p>
              <div className={`mp-badge ${card.status === 'won' ? 'won' : 'act'}`}>
                {card.status === 'won' ? '✓ Won Primary' : '● Active Race'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
