#!/usr/bin/env node
/**
 * Build-time script: reads all per-state geojson files, simplifies geometry
 * with Douglas-Peucker, truncates coordinate precision to 4 d.p., injects
 * properties.state, and writes a single merged public/geo.json.
 *
 * Run automatically via prebuild / predev npm hooks.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import simplify from 'simplify-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GEO_DIR = join(ROOT, 'geojson');
const OUT = join(ROOT, 'public', 'geo.json');

// Tolerance for Douglas-Peucker (in lon/lat degrees).
// 0.002° ≈ ~220 m — visually lossless at district scale on a 1100px canvas.
const TOLERANCE = 0.002;
const HIGH_QUALITY = false; // faster Radial Distance pre-pass is fine here

const STATE_ABBR = {
  alabama: 'AL', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', florida: 'FL', georgia: 'GA',
  idaho: 'ID', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  newhampshire: 'NH', newjersey: 'NJ', newmexico: 'NM', newyork: 'NY',
  northcarolina: 'NC', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', rhodeisland: 'RI', southcarolina: 'SC',
  tennessee: 'TN', texas: 'TX', utah: 'UT', virginia: 'VA',
  washington: 'WA', westvirginia: 'WV', wisconsin: 'WI',
};

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function simplifyRing(ring) {
  if (ring.length < 3) return ring;
  const pts = ring.map(([x, y]) => ({ x, y }));
  const simplified = simplify(pts, TOLERANCE, HIGH_QUALITY);
  // Ensure ring is still closed
  if (simplified.length < 3) return ring.slice(0, 1);
  const out = simplified.map(({ x, y }) => [round4(x), round4(y)]);
  // Close the ring if simplification opened it
  const last = out[out.length - 1];
  const first = out[0];
  if (last[0] !== first[0] || last[1] !== first[1]) out.push(first);
  return out;
}

function simplifyPolygon(rings) {
  return rings.map(simplifyRing).filter((r) => r.length >= 4);
}

function simplifyGeometry(geom) {
  if (geom.type === 'Polygon') {
    const simplified = simplifyPolygon(geom.coordinates);
    if (!simplified.length) return null;
    return { type: 'Polygon', coordinates: simplified };
  }
  if (geom.type === 'MultiPolygon') {
    const simplified = geom.coordinates
      .map(simplifyPolygon)
      .filter((p) => p.length > 0);
    if (!simplified.length) return null;
    return { type: 'MultiPolygon', coordinates: simplified };
  }
  return geom;
}

const allFeatures = [];
let totalIn = 0;
let totalOut = 0;

const files = readdirSync(GEO_DIR).filter((f) => f.endsWith('.geojson'));

for (const file of files) {
  const stem = file.replace('.geojson', '');
  const abbr = STATE_ABBR[stem];
  if (!abbr) {
    console.warn(`  [warn] No state abbreviation for "${stem}", skipping`);
    continue;
  }

  const raw = JSON.parse(readFileSync(join(GEO_DIR, file), 'utf8'));

  for (const feat of raw.features) {
    totalIn += countVertices(feat.geometry);
    const simplified = simplifyGeometry(feat.geometry);
    if (!simplified) continue;
    totalOut += countVertices(simplified);
    allFeatures.push({
      type: 'Feature',
      properties: { NAME: feat.properties.NAME, state: abbr },
      geometry: simplified,
    });
  }
}

function countVertices(geom) {
  if (!geom) return 0;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let n = 0;
  for (const poly of polys) for (const ring of poly) n += ring.length;
  return n;
}

const merged = { type: 'FeatureCollection', features: allFeatures };
writeFileSync(OUT, JSON.stringify(merged));

const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(merged)) / 1024);
console.log(`[simplify-geo] ${files.length} states → ${allFeatures.length} features`);
console.log(`[simplify-geo] vertices: ${totalIn.toLocaleString()} → ${totalOut.toLocaleString()} (${Math.round((1 - totalOut/totalIn)*100)}% reduction)`);
console.log(`[simplify-geo] output: public/geo.json  ${sizeKB} KB`);
