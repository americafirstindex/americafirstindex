import { ENDORSED } from './endorsements';

const API_KEY = import.meta.env.VITE_CONGRESS_API_KEY;
const BASE    = 'https://api.congress.gov/v3';

/** Cached map: distKey → { role, final } */
let houseRatingsCache = null;

function qs(params) {
  return new URLSearchParams({ format: 'json', api_key: API_KEY, ...params }).toString();
}

/** "Last, First M." → "First M. Last" */
function parseName(raw) {
  if (!raw) return '';
  const comma = raw.indexOf(',');
  if (comma === -1) return raw.trim();
  const last  = raw.slice(0, comma).trim();
  const first = raw.slice(comma + 1).trim();
  return first ? `${first} ${last}` : last;
}

/** CSV District ("AZ-05", "WY-AL") → map key ("AZ-5", "WY-1"). */
export function toMapDistKey(csvDistrict) {
  if (!csvDistrict) return null;
  const [state, dist] = csvDistrict.split('-');
  if (!state || dist == null) return null;
  if (dist === 'AL') return `${state}-1`;
  const n = Number(dist);
  if (Number.isNaN(n)) return `${state}-${dist}`;
  return `${state}-${n}`;
}

/**
 * Parse a single CSV line, respecting double-quoted fields.
 * Returns an array of string cells.
 */
function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseHouseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return {};

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const di = headers.indexOf('District');
  const ri = headers.indexOf('Role');
  const fi = headers.indexOf('Final');
  if (di === -1 || ri === -1 || fi === -1) return {};

  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const csvKey = (cells[di] ?? '').trim();
    if (!csvKey) continue;
    const key = toMapDistKey(csvKey);
    if (!key) continue;
    const finalRaw = (cells[fi] ?? '').trim();
    const final = finalRaw === '' || finalRaw === '-' ? null : Number(finalRaw);
    map[key] = {
      role:  (cells[ri] ?? '').trim() || null,
      final: Number.isFinite(final) ? final : null,
    };
  }
  return map;
}

/**
 * Load and cache house ratings from /ratings/house.csv.
 * Returns { [distKey]: { role, final } }.
 */
export async function loadHouseRatings() {
  if (houseRatingsCache) return houseRatingsCache;
  const res = await fetch('/ratings/house.csv');
  if (!res.ok) throw new Error(`Failed to load house.csv: ${res.status}`);
  const text = await res.text();
  houseRatingsCache = parseHouseCsv(text);
  return houseRatingsCache;
}

/** Lookup a cached rating by map distKey (e.g. "FL-1"). */
export function getHouseRating(distKey) {
  if (!distKey || !houseRatingsCache) return null;
  return houseRatingsCache[distKey] ?? null;
}

/**
 * Final score → color bucket.
 * Green: 0–0.5 | Orange: 0.5001–0.8 | Red: 0.8001–1
 */
export function finalColorBucket(final) {
  if (final == null || !Number.isFinite(final)) return null;
  if (final <= 0.5) return 'red';
  if (final <= 0.8) return 'orange';
  return 'green';
}

/** Normalize a raw member object from the Congress API into a card shape. */
function normalizeMember(raw, overrideDistKey = null) {
  const state    = raw.state ?? '';
  let district   = raw.district ?? null;
  if (district != null && district !== '' && !Number.isNaN(Number(district))) {
    district = Number(district);
  }
  const distKey  = overrideDistKey
    ?? (district != null ? `${state}-${district}` : null);
  const endorsed = distKey ? ENDORSED[distKey] : null;
  const rating   = distKey ? getHouseRating(distKey) : null;
  return {
    bioguideId: raw.bioguideId,
    name:       parseName(raw.name),
    state,
    district,
    distKey,
    party:      raw.partyName ?? '',
    imageUrl:   raw.depiction?.imageUrl ?? null,
    status:     endorsed?.status ?? null,
    role:       rating?.role ?? null,
    final:      rating?.final ?? null,
    url:        raw.url ?? null,
  };
}

/**
 * Fetch the endorsed carousel members by bioguideId.
 * Fires one request per endorsed member in parallel.
 */
export async function fetchEndorsedMembers() {
  await loadHouseRatings();
  const entries = Object.entries(ENDORSED);
  const results = await Promise.allSettled(
    entries.map(async ([distKey, { bioguideId }]) => {
      const res = await fetch(`${BASE}/member/${bioguideId}?${qs()}`);
      if (!res.ok) throw new Error(`${res.status} for ${bioguideId}`);
      const json = await res.json();
      const raw  = json.member ?? json;
      return normalizeMember({ ...raw, bioguideId }, distKey);
    })
  );
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Fetch a single member by state abbreviation + district number.
 * Uses the path-based /member/{stateCode}/{district} endpoint.
 */
export async function fetchMemberByDistrict(state, district) {
  await loadHouseRatings();
  const res = await fetch(
    `${BASE}/member/${encodeURIComponent(state)}/${encodeURIComponent(district)}?${qs()}`
  );
  if (!res.ok) throw new Error(`${res.status} fetching ${state}-${district}`);
  const json    = await res.json();
  const members = json.members ?? [];
  if (!members.length) return null;
  const mapKey = toMapDistKey(`${state}-${district}`) ?? `${state}-${district}`;
  return normalizeMember(
    { ...members[0], state: members[0].state ?? state, district: members[0].district ?? district },
    mapKey
  );
}

/**
 * Fetch recent sponsored legislation for a member.
 * Returns an array of bill objects: { title, type, number, introducedDate, url }
 */
export async function fetchSponsoredLegislation(bioguideId, limit = 10) {
  const res = await fetch(
    `${BASE}/member/${bioguideId}/sponsored-legislation?${qs({ limit })}`
  );
  if (!res.ok) throw new Error(`${res.status} fetching legislation for ${bioguideId}`);
  const json  = await res.json();
  const bills = json.sponsoredLegislation ?? [];
  return bills.map((b) => ({
    title:          b.title ?? '(No title)',
    type:           b.type  ?? '',
    number:         b.number ?? '',
    introducedDate: b.introducedDate ?? '',
    url:            b.url ?? null,
  }));
}
