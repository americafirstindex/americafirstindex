import { useEffect, useRef, useState } from 'react';
import { loadGeo } from '../../data/loadGeo';
import { ENDORSED, CARDS } from '../../data/endorsements';
import logoSrc from '../../assets/logo.jpg';
import './EndorsedMap.css';

function getDistrictKey(feat) {
  return feat.properties.state + '-' + feat.properties.NAME;
}

function getBBox(feat) {
  let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
  const coords = feat.geometry.type === 'Polygon'
    ? [feat.geometry.coordinates]
    : feat.geometry.coordinates;
  for (const poly of coords)
    for (const ring of poly)
      for (const [lon, lat] of ring) {
        mn[0] = Math.min(mn[0], lon); mn[1] = Math.min(mn[1], lat);
        mx[0] = Math.max(mx[0], lon); mx[1] = Math.max(mx[1], lat);
      }
  return { minLon: mn[0], minLat: mn[1], maxLon: mx[0], maxLat: mx[1] };
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function computeGeoBounds(features) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feat of features) {
    const coords = feat.geometry.type === 'Polygon'
      ? [feat.geometry.coordinates]
      : feat.geometry.coordinates;
    for (const poly of coords)
      for (const ring of poly)
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        }
  }
  return {
    geoW: maxLon - minLon,
    geoH: maxLat - minLat,
    geoCx: (minLon + maxLon) / 2,
    geoCy: (minLat + maxLat) / 2,
  };
}

export default function EndorsedMap() {
  const canvasRef = useRef(null);
  const [activeCard, setActiveCard] = useState(null);
  const [geo, setGeo] = useState(null);

  // Mutable refs shared between card-click handler and the draw loop
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const targetCamRef = useRef({ x: 0, y: 0, zoom: 1 });
  const selectedKeyRef = useRef(null);
  const zoomFnRef = useRef(null);

  // Load GEO data once
  useEffect(() => {
    loadGeo().then(setGeo);
  }, []);

  // Canvas effect runs once GEO is ready
  useEffect(() => {
    if (!geo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const bounds = computeGeoBounds(geo.features);
    const { geoW, geoH, geoCx, geoCy } = bounds;

    let hoveredKey = null;
    let drawTime = 0;
    let rafDraw = null;
    let rafAnim = null;

    const cam = camRef.current;
    const targetCam = targetCamRef.current;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    }

    function lonLatToScreen(lon, lat) {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const scale = Math.min(w / geoW, h / geoH) * 0.85 * cam.zoom;
      return [
        (lon - geoCx) * scale + w / 2 + cam.x,
        -(lat - geoCy) * scale + h / 2 + cam.y,
      ];
    }

    function draw() {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawTime += 0.016;

      for (const feat of geo.features) {
        const key = getDistrictKey(feat);
        const isEndorsed = key in ENDORSED;
        const isHovered = key === hoveredKey;
        const isSelected = key === selectedKeyRef.current;
        const coords = feat.geometry.type === 'Polygon'
          ? [feat.geometry.coordinates]
          : feat.geometry.coordinates;

        for (const poly of coords) {
          for (let ri = 0; ri < poly.length; ri++) {
            const ring = poly[ri];
            ctx.beginPath();
            for (let i = 0; i < ring.length; i++) {
              const [x, y] = lonLatToScreen(ring[i][0], ring[i][1]);
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();

            if (ri === 0) {
              if (isEndorsed) {
                if (ENDORSED[key].status === 'active') {
                  const pulse = 0.5 + 0.5 * Math.sin(drawTime * 1.5);
                  const baseA = isSelected ? 0.2 : isHovered ? 0.15 : 0.05;
                  const pulseA = isSelected ? 0.2 : isHovered ? 0.15 : 0.1;
                  ctx.fillStyle = `rgba(232,80,62,${baseA + pulse * pulseA})`;
                } else {
                  ctx.fillStyle = `rgba(92,200,64,${isSelected ? 0.25 : isHovered ? 0.18 : 0.1})`;
                }
              } else {
                ctx.fillStyle = isHovered ? 'rgba(212,173,82,0.1)' : 'rgba(212,173,82,0.04)';
              }
              ctx.fill();
            }

            if (isEndorsed) {
              if (ENDORSED[key].status === 'active') {
                const pulse = 0.5 + 0.5 * Math.sin(drawTime * 1.5);
                ctx.strokeStyle = `rgba(232,80,62,${isSelected ? 0.6 + pulse * 0.4 : 0.2 + pulse * 0.35})`;
                ctx.lineWidth = isSelected ? 2.5 : 1.5;
                ctx.shadowColor = `rgba(232,80,62,${isSelected ? 0.1 + pulse * 0.25 : 0.03 + pulse * 0.15})`;
                ctx.shadowBlur = isSelected ? 6 + pulse * 10 : 3 + pulse * 7;
              } else {
                ctx.strokeStyle = isSelected ? 'rgba(92,200,64,0.7)' : 'rgba(92,200,64,0.35)';
                ctx.lineWidth = isSelected ? 2.5 : 1.5;
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
              }
            } else {
              ctx.strokeStyle = 'rgba(212,173,82,0.12)';
              ctx.lineWidth = 0.5;
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
        }

        if (isEndorsed && cam.zoom > 1.5) {
          const bb = getBBox(feat);
          const [cx2, cy2] = lonLatToScreen((bb.minLon + bb.maxLon) / 2, (bb.minLat + bb.maxLat) / 2);
          const [x1] = lonLatToScreen(bb.minLon, bb.minLat);
          const [x2] = lonLatToScreen(bb.maxLon, bb.maxLat);
          const fontSize = Math.max(8, Math.min(Math.abs(x2 - x1) * 0.18, 16));
          ctx.font = `bold ${fontSize}px "Source Serif 4", serif`;
          ctx.fillStyle = 'rgba(212,173,82,0.8)';
          ctx.textAlign = 'center';
          ctx.fillText(key, cx2, cy2);
        }
      }

      rafDraw = requestAnimationFrame(draw);
    }

    function animateCam() {
      const sp = 0.08;
      cam.x += (targetCam.x - cam.x) * sp;
      cam.y += (targetCam.y - cam.y) * sp;
      cam.zoom += (targetCam.zoom - cam.zoom) * sp;
      if (
        Math.abs(cam.x - targetCam.x) > 0.1 ||
        Math.abs(cam.y - targetCam.y) > 0.1 ||
        Math.abs(cam.zoom - targetCam.zoom) > 0.01
      ) {
        rafAnim = requestAnimationFrame(animateCam);
      }
    }

    function zoomToFeat(feat) {
      const bb = getBBox(feat);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const baseScale = Math.min(w / geoW, h / geoH) * 0.85;
      const tz = Math.min(
        (w * 0.6) / ((bb.maxLon - bb.minLon) * baseScale),
        (h * 0.6) / ((bb.maxLat - bb.minLat) * baseScale),
        14
      );
      const cx2 = (bb.minLon + bb.maxLon) / 2;
      const cy2 = (bb.minLat + bb.maxLat) / 2;
      targetCam.zoom = tz;
      targetCam.x = -(cx2 - geoCx) * baseScale * tz;
      targetCam.y = (cy2 - geoCy) * baseScale * tz;
      cancelAnimationFrame(rafAnim);
      rafAnim = requestAnimationFrame(animateCam);
    }

    // Expose zoomToFeat for card clicks
    zoomFnRef.current = (distKey) => {
      const feat = geo.features.find((f) => getDistrictKey(f) === distKey);
      if (feat) {
        selectedKeyRef.current = distKey;
        zoomToFeat(feat);
      }
    };

    function resetView() {
      targetCam.x = 0; targetCam.y = 0; targetCam.zoom = 1;
      cam.x = 0; cam.y = 0; cam.zoom = 1;
      selectedKeyRef.current = null;
      setActiveCard(null);
    }

    function hitTest(mx, my) {
      for (let fi = geo.features.length - 1; fi >= 0; fi--) {
        const feat = geo.features[fi];
        const coords = feat.geometry.type === 'Polygon'
          ? [feat.geometry.coordinates]
          : feat.geometry.coordinates;
        for (const poly of coords) {
          const pts = poly[0].map(([lon, lat]) => lonLatToScreen(lon, lat));
          if (pointInPoly(mx, my, pts)) return feat;
        }
      }
      return null;
    }

    function onMouseMove(e) {
      const r = canvas.getBoundingClientRect();
      const feat = hitTest(e.clientX - r.left, e.clientY - r.top);
      hoveredKey = feat ? getDistrictKey(feat) : null;
      canvas.style.cursor = feat && getDistrictKey(feat) in ENDORSED ? 'pointer' : 'default';
    }

    function onClick(e) {
      const r = canvas.getBoundingClientRect();
      const feat = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (!feat) return;
      const key = getDistrictKey(feat);
      if (key in ENDORSED) {
        selectedKeyRef.current = key;
        zoomToFeat(feat);
        setActiveCard(ENDORSED[key].cardId);
      }
    }

    function onWheel(e) {
      e.preventDefault();
      targetCam.zoom = Math.max(0.5, Math.min(15, targetCam.zoom * (e.deltaY > 0 ? 0.85 : 1.18)));
      cancelAnimationFrame(rafAnim);
      rafAnim = requestAnimationFrame(animateCam);
    }

    let dragging = false, dragStart = { x: 0, y: 0 }, camStart = { x: 0, y: 0 };
    function onMouseDown(e) {
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      camStart = { x: targetCam.x, y: targetCam.y };
    }
    function onWindowMove(e) {
      if (!dragging) return;
      targetCam.x = camStart.x + e.clientX - dragStart.x;
      targetCam.y = camStart.y + e.clientY - dragStart.y;
      cam.x = targetCam.x;
      cam.y = targetCam.y;
    }
    function onMouseUp() { dragging = false; }

    const zoomInBtn  = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomRstBtn = document.getElementById('zoomReset');
    const onZoomIn  = () => { targetCam.zoom = Math.min(targetCam.zoom * 1.5, 15); cancelAnimationFrame(rafAnim); rafAnim = requestAnimationFrame(animateCam); };
    const onZoomOut = () => { targetCam.zoom = Math.max(targetCam.zoom / 1.5, 0.5); cancelAnimationFrame(rafAnim); rafAnim = requestAnimationFrame(animateCam); };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onMouseUp);
    zoomInBtn?.addEventListener('click', onZoomIn);
    zoomOutBtn?.addEventListener('click', onZoomOut);
    zoomRstBtn?.addEventListener('click', resetView);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    resize();
    draw();

    return () => {
      cancelAnimationFrame(rafDraw);
      cancelAnimationFrame(rafAnim);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onMouseUp);
      zoomInBtn?.removeEventListener('click', onZoomIn);
      zoomOutBtn?.removeEventListener('click', onZoomOut);
      zoomRstBtn?.removeEventListener('click', resetView);
      ro.disconnect();
    };
  }, [geo]);

  function handleCardClick(card) {
    setActiveCard(card.id);
    selectedKeyRef.current = card.distKey;
    zoomFnRef.current?.(card.distKey);
  }

  return (
    <div className="em-page">
      <div className="em-page-inner">
        {/* Header */}
        <header className="hdr">
          <a href="/" className="hdr-left">
            <img src={logoSrc} alt="America First Index" />
            <span>America First Index</span>
          </a>
          <div className="hdr-right">
            <a href="/" className="hdr-back">&larr; Home</a>
          </div>
        </header>

        {/* Title */}
        <section className="title-sec">
          <p className="lbl">Endorsed Candidates</p>
          <h1>Where We&rsquo;re <span style={{ color: '#F0D060' }}>Fighting</span></h1>
          <p>
            Our endorsed candidates are running in congressional districts across America. We&rsquo;re on the
            ground organizing, producing content, and pushing them across the finish line. Click a candidate to
            zoom to their district on the map.
          </p>
        </section>

        {/* Map */}
        <div className="map-wrap">
          <div className="map-row">
            <div className="map-main">
              {geo ? (
                <canvas id="mapCanvas" ref={canvasRef} />
              ) : (
                <div className="map-loading">Loading map&hellip;</div>
              )}
              <div className="map-controls">
                <button id="zoomIn">+</button>
                <button id="zoomOut">&minus;</button>
                <button id="zoomReset">&#8634;</button>
              </div>
            </div>
            <div className="map-panel">
              <div>
                <h3>Endorsed Races</h3>
                <p className="mp-sub">Six candidates fighting for America First values in Congress.</p>
              </div>
              {CARDS.map((card) => (
                <div
                  key={card.id}
                  id={card.id}
                  className={`mp-card${activeCard === card.id ? ' active' : ''}`}
                  onClick={() => handleCardClick(card)}
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

          <div className="legend">
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'rgba(212,173,82,.15)' }}></div>
              Other Districts
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'rgba(92,200,64,.6)' }}></div>
              Won Primary
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--red)', opacity: .6 }}></div>
              Active Race
            </div>
          </div>
        </div>

        <footer className="pg-ft">
          <p>&copy; 2026 America First Index &middot; <a href="/">americafirstindex.us</a></p>
        </footer>
      </div>
    </div>
  );
}
