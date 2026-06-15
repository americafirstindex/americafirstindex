import { ENDORSED } from './endorsements';

const API_KEY = import.meta.env.VITE_CONGRESS_API_KEY;
const BASE    = 'https://api.congress.gov/v3';

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

/** Normalize a raw member object from the Congress API into a card shape. */
function normalizeMember(raw) {
  const state    = raw.state ?? '';
  const district = raw.district ?? null;
  const distKey  = district != null ? `${state}-${district}` : null;
  const endorsed = distKey ? ENDORSED[distKey] : null;
  return {
    bioguideId: raw.bioguideId,
    name:       parseName(raw.name),
    state,
    district,
    distKey,
    party:      raw.partyName ?? '',
    imageUrl:   raw.depiction?.imageUrl ?? null,
    status:     endorsed?.status ?? null,
    url:        raw.url ?? null,
  };
}

/**
 * Fetch the endorsed carousel members by bioguideId.
 * Fires one request per endorsed member in parallel.
 */
export async function fetchEndorsedMembers() {
  const entries = Object.entries(ENDORSED);
  const results = await Promise.allSettled(
    entries.map(async ([distKey, { bioguideId }]) => {
      const res = await fetch(`${BASE}/member/${bioguideId}?${qs()}`);
      if (!res.ok) throw new Error(`${res.status} for ${bioguideId}`);
      const json = await res.json();
      const raw  = json.member ?? json;
      return normalizeMember({ ...raw, bioguideId });
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
  const res = await fetch(
    `${BASE}/member/${encodeURIComponent(state)}/${encodeURIComponent(district)}?${qs()}`
  );
  if (!res.ok) throw new Error(`${res.status} fetching ${state}-${district}`);
  const json    = await res.json();
  const members = json.members ?? [];
  if (!members.length) return null;
  return normalizeMember(members[0]);
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
