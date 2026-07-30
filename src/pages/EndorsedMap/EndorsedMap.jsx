import { useEffect, useRef, useState } from 'react';
import { loadGeo } from '../../data/loadGeo';
import {
  fetchEndorsedMembers,
  fetchMemberByDistrict,
  fetchSponsoredLegislation,
  loadHouseRatings,
  finalColorBucket,
} from '../../data/congress';
import logoSrc from '../../assets/logo.jpg';
import CandidateCarousel from './CandidateCarousel';
import CandidateView from './CandidateView';
import './EndorsedMap.css';

const RATING_COLORS = {
  green:  { r: 92,  g: 200, b: 64  },
  orange: { r: 232, g: 140, b: 40  },
  red:    { r: 232, g: 80,  b: 62  },
};

function rgba(c, a) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

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

function pointInPolyNorm(nx, ny, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > ny) !== (yj > ny) && nx < (xj - xi) * (ny - yi) / (yj - yi) + xi) inside = !inside;
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
    minLon, maxLon, minLat, maxLat,
    geoW: maxLon - minLon,
    geoH: maxLat - minLat,
    geoCx: (minLon + maxLon) / 2,
    geoCy: (minLat + maxLat) / 2,
  };
}

/**
 * Build Path2D objects in normalized [0,1] space once at load time.
 * nx = (lon - minLon) / geoW   (0 = west edge, 1 = east edge)
 * ny = (maxLat - lat) / geoH   (0 = north edge, 1 = south edge)
 *
 * At draw time a single ctx.setTransform call maps this space to the canvas,
 * so no per-vertex projection happens in the animation loop.
 */
function buildFeaturePaths(features, bounds, ratings) {
  const { minLon, maxLat, geoW, geoH } = bounds;

  return features.map((feat) => {
    const key    = getDistrictKey(feat);
    const rating = ratings?.[key] ?? null;
    const bucket = rating?.final != null ? finalColorBucket(rating.final) : null;
    const polys = feat.geometry.type === 'Polygon'
      ? [feat.geometry.coordinates]
      : feat.geometry.coordinates;

    const path = new Path2D();
    let hitRing = null;
    let bNx0 = 1, bNy0 = 1, bNx1 = 0, bNy1 = 0;

    for (let pi = 0; pi < polys.length; pi++) {
      for (let ri = 0; ri < polys[pi].length; ri++) {
        const ring     = polys[pi][ri];
        const normRing = new Array(ring.length);
        for (let i = 0; i < ring.length; i++) {
          const nx = (ring[i][0] - minLon) / geoW;
          const ny = (maxLat - ring[i][1]) / geoH;
          normRing[i] = [nx, ny];
          if (nx < bNx0) bNx0 = nx; if (nx > bNx1) bNx1 = nx;
          if (ny < bNy0) bNy0 = ny; if (ny > bNy1) bNy1 = ny;
        }
        if (pi === 0 && ri === 0) hitRing = normRing;
        for (let i = 0; i < normRing.length; i++) {
          const [nx, ny] = normRing[i];
          if (i === 0) path.moveTo(nx, ny); else path.lineTo(nx, ny);
        }
        path.closePath();
      }
    }

    return {
      key, path, hitRing,
      rating, bucket,
      isRated:     !!bucket,
      lonLatBbox:  getBBox(feat),
      bNx0, bNy0, bNx1, bNy1,
      bCnx: (bNx0 + bNx1) / 2,
      bCny: (bNy0 + bNy1) / 2,
      bNWidth: bNx1 - bNx0,
    };
  });
}

export default function EndorsedMap() {
  const canvasRef = useRef(null);
  const [activeCard,    setActiveCard]    = useState(null);   // member object
  const [legislation,   setLegislation]   = useState([]);
  const [loadingCard,   setLoadingCard]   = useState(false);
  const [loadingLeg,    setLoadingLeg]    = useState(false);
  const [carouselCards, setCarouselCards] = useState([]);
  const [geo,           setGeo]           = useState(null);
  const [ratings,       setRatings]       = useState(null);

  const camRef         = useRef({ x: 0, y: 0, zoom: 1 });
  const targetCamRef   = useRef({ x: 0, y: 0, zoom: 1 });
  const selectedKeyRef = useRef(null);
  const zoomFnRef      = useRef(null);

  // Load geo + house ratings + endorsed carousel members on mount
  useEffect(() => {
    Promise.all([loadGeo(), loadHouseRatings()]).then(([g, r]) => {
      setGeo(g);
      setRatings(r);
    });
    fetchEndorsedMembers().then(setCarouselCards);
  }, []);

  useEffect(() => {
    if (!geo || !ratings) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const bounds = computeGeoBounds(geo.features);
    const { geoW, geoH, geoCx, geoCy } = bounds;

    const prebuilt = buildFeaturePaths(geo.features, bounds, ratings);

    let hoveredKey = null;
    let needsRedraw = true;
    let rafLoop = null;
    let rafAnim = null;

    const cam       = camRef.current;
    const targetCam = targetCamRef.current;

    function markDirty() { needsRedraw = true; }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width  = rect.width  + 'px';
      canvas.style.height = rect.height + 'px';
      markDirty();
    }

    function getTransform() {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const scale      = Math.min(w / geoW, h / geoH) * 0.85 * cam.zoom;
      const scaleX     = geoW * scale;
      const scaleY     = geoH * scale;
      const pixelScale = Math.min(scaleX, scaleY);
      const transX     = w / 2 + cam.x - 0.5 * geoW * scale;
      const transY     = h / 2 + cam.y - 0.5 * geoH * scale;
      return { w, h, scale, scaleX, scaleY, pixelScale, transX, transY };
    }

    function draw() {
      const t = getTransform();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, t.w, t.h);

      ctx.setTransform(t.scaleX * dpr, 0, 0, t.scaleY * dpr, t.transX * dpr, t.transY * dpr);

      for (const feat of prebuilt) {
        const { key, path, isRated, bucket } = feat;
        const isHovered  = key === hoveredKey;
        const isSelected = key === selectedKeyRef.current;
        const color      = bucket ? RATING_COLORS[bucket] : null;

        // --- Fill ---
        if (isRated && color) {
          ctx.fillStyle = rgba(color, isSelected ? 0.25 : isHovered ? 0.18 : 0.1);
        } else {
          ctx.fillStyle = isHovered ? 'rgba(212,173,82,0.1)' : 'rgba(212,173,82,0.04)';
        }
        ctx.fill(path, 'evenodd');

        // --- Stroke (keep hairline width; color carries the rating signal) ---
        if (isRated && color) {
          ctx.strokeStyle = rgba(color, isSelected ? 0.65 : isHovered ? 0.4 : 0.22);
        } else {
          ctx.strokeStyle = isSelected ? 'rgba(212,173,82,0.4)' : 'rgba(212,173,82,0.12)';
        }
        ctx.lineWidth   = (isSelected ? 1.25 : 0.5) / t.pixelScale;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur  = 0;
        ctx.stroke(path);
      }
    }

    function loop() {
      if (needsRedraw) {
        draw();
        needsRedraw = false;
      }
      rafLoop = requestAnimationFrame(loop);
    }

    function animateCam() {
      const sp = 0.08;
      cam.x    += (targetCam.x    - cam.x)    * sp;
      cam.y    += (targetCam.y    - cam.y)    * sp;
      cam.zoom += (targetCam.zoom - cam.zoom) * sp;
      markDirty();
      if (
        Math.abs(cam.x    - targetCam.x)    > 0.1 ||
        Math.abs(cam.y    - targetCam.y)    > 0.1 ||
        Math.abs(cam.zoom - targetCam.zoom) > 0.01
      ) {
        rafAnim = requestAnimationFrame(animateCam);
      }
    }

    function zoomToFeat(feat) {
      const bb  = feat.lonLatBbox;
      const w   = canvas.width  / dpr;
      const h   = canvas.height / dpr;
      const baseScale = Math.min(w / geoW, h / geoH) * 0.85;
      const tz  = Math.min(
        (w * 0.6) / ((bb.maxLon - bb.minLon) * baseScale),
        (h * 0.6) / ((bb.maxLat - bb.minLat) * baseScale),
        14
      );
      const cx2 = (bb.minLon + bb.maxLon) / 2;
      const cy2 = (bb.minLat + bb.maxLat) / 2;
      targetCam.zoom = tz;
      targetCam.x    = -(cx2 - geoCx) * baseScale * tz;
      targetCam.y    =  (cy2 - geoCy) * baseScale * tz;
      cancelAnimationFrame(rafAnim);
      rafAnim = requestAnimationFrame(animateCam);
    }

    zoomFnRef.current = (distKey) => {
      const feat = prebuilt.find((f) => f.key === distKey);
      if (feat) {
        selectedKeyRef.current = distKey;
        zoomToFeat(feat);
        markDirty();
      }
    };

    function resetView() {
      targetCam.x = 0; targetCam.y = 0; targetCam.zoom = 1;
      cam.x = 0;       cam.y = 0;       cam.zoom = 1;
      selectedKeyRef.current = null;
      setActiveCard(null);
      setLegislation([]);
      markDirty();
    }

    function screenToNorm(sx, sy) {
      const t = getTransform();
      return [(sx - t.transX) / t.scaleX, (sy - t.transY) / t.scaleY];
    }

    function hitTest(mx, my) {
      const [nx, ny] = screenToNorm(mx, my);
      for (let fi = prebuilt.length - 1; fi >= 0; fi--) {
        const feat = prebuilt[fi];
        if (nx < feat.bNx0 || nx > feat.bNx1 || ny < feat.bNy0 || ny > feat.bNy1) continue;
        if (feat.hitRing && pointInPolyNorm(nx, ny, feat.hitRing)) return feat;
      }
      return null;
    }

    function selectDistrictAt(sx, sy) {
      const feat = hitTest(sx, sy);
      if (!feat) return;

      const [stateAbbr, distNum] = feat.key.split('-');
      selectedKeyRef.current = feat.key;
      zoomToFeat(feat);
      markDirty();

      setLoadingCard(true);
      setActiveCard(null);
      setLegislation([]);
      setLoadingLeg(false);

      fetchMemberByDistrict(stateAbbr, distNum)
        .then((member) => {
          setActiveCard(member);
          setLoadingCard(false);
          if (member?.bioguideId) {
            setLoadingLeg(true);
            fetchSponsoredLegislation(member.bioguideId)
              .then((bills) => {
                setLegislation(bills);
                setLoadingLeg(false);
              })
              .catch(() => setLoadingLeg(false));
          }
        })
        .catch(() => setLoadingCard(false));
    }

    /** Zoom while keeping the map point under (sx, sy) fixed on screen. */
    function zoomAt(sx, sy, nextZoom) {
      const z = Math.max(0.5, Math.min(15, nextZoom));
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const baseScale = Math.min(w / geoW, h / geoH) * 0.85;

      const oldScale  = baseScale * cam.zoom;
      const oldScaleX = geoW * oldScale;
      const oldScaleY = geoH * oldScale;
      const oldTransX = w / 2 + cam.x - 0.5 * oldScaleX;
      const oldTransY = h / 2 + cam.y - 0.5 * oldScaleY;
      const nx = (sx - oldTransX) / oldScaleX;
      const ny = (sy - oldTransY) / oldScaleY;

      const newScale  = baseScale * z;
      const newScaleX = geoW * newScale;
      const newScaleY = geoH * newScale;
      const newCamX = sx - w / 2 - (nx - 0.5) * newScaleX;
      const newCamY = sy - h / 2 - (ny - 0.5) * newScaleY;

      cancelAnimationFrame(rafAnim);
      cam.zoom = z;       cam.x = newCamX;       cam.y = newCamY;
      targetCam.zoom = z; targetCam.x = newCamX; targetCam.y = newCamY;
      markDirty();
    }

    function onWheel(e) {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      zoomAt(sx, sy, cam.zoom * factor);
    }

    // --- Unified pointer gestures (mouse + touch) ---
    const DRAG_THRESHOLD = 6;
    const activePointers = new Map();
    let gestureMode = null; // null | 'pan' | 'pinch'
    let didDrag = false;
    let panOrigin = null;   // { x, y, camX, camY }
    let pinchOrigin = null; // { dist, midX, midY, zoom, camX, camY }

    function canvasPoint(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function pointerEntries() {
      return [...activePointers.values()];
    }

    function pointerDistance(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y;
      return Math.hypot(dx, dy);
    }

    function pointerMidpoint(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function beginPinch() {
      const [a, b] = pointerEntries();
      if (!a || !b) return;
      const mid = pointerMidpoint(a, b);
      gestureMode = 'pinch';
      didDrag = true;
      pinchOrigin = {
        dist: Math.max(1, pointerDistance(a, b)),
        midX: mid.x,
        midY: mid.y,
        zoom: cam.zoom,
        camX: cam.x,
        camY: cam.y,
      };
      if (hoveredKey !== null) {
        hoveredKey = null;
        markDirty();
      }
      canvas.style.cursor = 'grabbing';
    }

    function beginPanFrom(pt) {
      gestureMode = 'pan';
      panOrigin = { x: pt.x, y: pt.y, camX: cam.x, camY: cam.y };
      pinchOrigin = null;
      canvas.style.cursor = 'grabbing';
    }

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const pt = canvasPoint(e);
      activePointers.set(e.pointerId, pt);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }

      if (activePointers.size === 1) {
        didDrag = false;
        gestureMode = null;
        panOrigin = { x: pt.x, y: pt.y, camX: cam.x, camY: cam.y };
      } else if (activePointers.size === 2) {
        beginPinch();
      }
    }

    function onPointerMove(e) {
      if (!activePointers.has(e.pointerId)) {
        // Hover only for mouse when not interacting
        if (e.pointerType === 'mouse' && activePointers.size === 0) {
          const pt = canvasPoint(e);
          const feat = hitTest(pt.x, pt.y);
          const key  = feat ? feat.key : null;
          if (key !== hoveredKey) {
            hoveredKey = key;
            canvas.style.cursor = feat ? 'pointer' : 'grab';
            markDirty();
          }
        }
        return;
      }

      e.preventDefault();
      activePointers.set(e.pointerId, canvasPoint(e));

      if (activePointers.size >= 2 || gestureMode === 'pinch') {
        const pts = pointerEntries();
        if (pts.length < 2 || !pinchOrigin) {
          if (pts.length >= 2) beginPinch();
          return;
        }
        const [a, b] = pts;
        const mid = pointerMidpoint(a, b);
        const dist = Math.max(1, pointerDistance(a, b));

        // Restore camera to pinch start, then zoom at original midpoint,
        // then pan by midpoint delta so the pinch feels natural.
        cancelAnimationFrame(rafAnim);
        cam.x = pinchOrigin.camX;
        cam.y = pinchOrigin.camY;
        cam.zoom = pinchOrigin.zoom;
        targetCam.x = cam.x;
        targetCam.y = cam.y;
        targetCam.zoom = cam.zoom;

        zoomAt(pinchOrigin.midX, pinchOrigin.midY, pinchOrigin.zoom * (dist / pinchOrigin.dist));

        const dx = mid.x - pinchOrigin.midX;
        const dy = mid.y - pinchOrigin.midY;
        cam.x += dx; cam.y += dy;
        targetCam.x = cam.x; targetCam.y = cam.y;
        markDirty();
        return;
      }

      // Single-pointer pan (after threshold) or pending tap
      const pt = activePointers.get(e.pointerId);
      if (!panOrigin) return;
      const dx = pt.x - panOrigin.x;
      const dy = pt.y - panOrigin.y;

      if (!didDrag && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      if (!didDrag) {
        didDrag = true;
        gestureMode = 'pan';
        if (hoveredKey !== null) {
          hoveredKey = null;
          markDirty();
        }
        canvas.style.cursor = 'grabbing';
      }

      cancelAnimationFrame(rafAnim);
      cam.x = panOrigin.camX + (pt.x - panOrigin.x);
      cam.y = panOrigin.camY + (pt.y - panOrigin.y);
      targetCam.x = cam.x;
      targetCam.y = cam.y;
      markDirty();
    }

    function onPointerUp(e) {
      const wasTracked = activePointers.has(e.pointerId);
      if (!wasTracked) return;

      const pt = canvasPoint(e);
      activePointers.delete(e.pointerId);
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

      if (gestureMode === 'pinch') {
        if (activePointers.size === 1) {
          beginPanFrom(pointerEntries()[0]);
        } else if (activePointers.size === 0) {
          gestureMode = null;
          pinchOrigin = null;
          panOrigin = null;
          didDrag = false;
          canvas.style.cursor = 'grab';
        }
        return;
      }

      if (activePointers.size === 0) {
        const wasTap = !didDrag;
        gestureMode = null;
        panOrigin = null;
        pinchOrigin = null;
        canvas.style.cursor = 'grab';

        if (wasTap) {
          selectDistrictAt(pt.x, pt.y);
        }
        didDrag = false;
      }
    }

    function onPointerCancel(e) {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        gestureMode = null;
        panOrigin = null;
        pinchOrigin = null;
        didDrag = false;
        canvas.style.cursor = 'grab';
      } else if (activePointers.size === 1 && gestureMode === 'pinch') {
        beginPanFrom(pointerEntries()[0]);
      }
    }

    const zoomInBtn  = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomRstBtn = document.getElementById('zoomReset');
    const onZoomIn   = () => { targetCam.zoom = Math.min(targetCam.zoom * 1.5, 15); cancelAnimationFrame(rafAnim); rafAnim = requestAnimationFrame(animateCam); };
    const onZoomOut  = () => { targetCam.zoom = Math.max(targetCam.zoom / 1.5, 0.5); cancelAnimationFrame(rafAnim); rafAnim = requestAnimationFrame(animateCam); };

    canvas.addEventListener('pointerdown',   onPointerDown);
    canvas.addEventListener('pointermove',   onPointerMove);
    canvas.addEventListener('pointerup',     onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel',         onWheel, { passive: false });
    zoomInBtn?.addEventListener('click',  onZoomIn);
    zoomOutBtn?.addEventListener('click', onZoomOut);
    zoomRstBtn?.addEventListener('click', resetView);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    resize();
    loop();

    return () => {
      cancelAnimationFrame(rafLoop);
      cancelAnimationFrame(rafAnim);
      canvas.removeEventListener('pointerdown',   onPointerDown);
      canvas.removeEventListener('pointermove',   onPointerMove);
      canvas.removeEventListener('pointerup',     onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel',         onWheel);
      zoomInBtn?.removeEventListener('click',  onZoomIn);
      zoomOutBtn?.removeEventListener('click', onZoomOut);
      zoomRstBtn?.removeEventListener('click', resetView);
      ro.disconnect();
    };
  }, [geo, ratings]);

  function handleCardClick(card) {
    setActiveCard(card);
    selectedKeyRef.current = card.distKey;
    zoomFnRef.current?.(card.distKey);
    if (card.bioguideId) {
      setLoadingLeg(true);
      setLegislation([]);
      fetchSponsoredLegislation(card.bioguideId)
        .then((bills) => {
          setLegislation(bills);
          setLoadingLeg(false);
        })
        .catch(() => setLoadingLeg(false));
    }
  }

  return (
    <div className="em-page">
      <div className="em-page-inner">
        <header className="hdr">
          <a href="/" className="hdr-left">
            <img src={logoSrc} alt="America First Index" />
            <span>America First Index</span>
          </a>
          <div className="hdr-right">
            <a href="/" className="hdr-back">&larr; Home</a>
          </div>
        </header>

        <section className="title-sec">
          <p className="lbl">Endorsed Candidates</p>
          <h1>Where We&rsquo;re <span style={{ color: '#F0D060' }}>Fighting</span></h1>
          <p>
            Our endorsed candidates are running in congressional districts across America. We&rsquo;re on the
            ground organizing, producing content, and pushing them across the finish line. Click any district
            to see the current representative.
          </p>
        </section>

        <div className="map-wrap">
          <CandidateCarousel
            cards={carouselCards}
            activeCard={activeCard?.distKey ?? null}
            onCardClick={handleCardClick}
          />
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

          <div className="legend">
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'rgba(212,173,82,.15)' }}></div>
              Unrated
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'rgba(232,80,62,.6)' }}></div>
              0–50%
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'rgba(232,140,40,.7)' }}></div>
              50–80%
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'rgba(92,200,64,.6)' }}></div>
              80–100%
            </div>
          </div>
        </div>

        <footer className="pg-ft">
          <p>&copy; 2026 America First Index &middot; <a href="/">americafirstindex.us</a></p>
        </footer>
      </div>

      {(loadingCard || activeCard) && (
        <CandidateView
          card={activeCard}
          loading={loadingCard}
          legislation={legislation}
          loadingLegislation={loadingLeg}
          onClose={() => {
            setActiveCard(null);
            setLegislation([]);
            selectedKeyRef.current = null;
          }}
        />
      )}
    </div>
  );
}
