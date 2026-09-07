// District key -> endorsed candidate metadata (state-DISTNUM, matching geojson properties)
// bioguideId maps to the Congress.gov member record for the incumbent in this district
// Photos: src/assets/endorsements/{distKey}.{jpg|jpeg|png|webp}

const photoModules = import.meta.glob('../assets/endorsements/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
});

const PHOTO_BY_KEY = Object.fromEntries(
  Object.entries(photoModules).map(([path, url]) => {
    const file = path.split('/').pop() ?? '';
    const key  = file.replace(/\.(jpe?g|png|webp)$/i, '');
    return [key, url];
  })
);

export const ENDORSED = {
  'LA-5': {
    name: 'Blake Miguez',
    party: 'Republican',
    role: 'Candidate for U.S. House',
    bio: 'Freedom Caucus conservative and former Louisiana House Majority Leader. School choice, term limits, balanced budgets, and no tolerance for Republicans who fold.',
    status: 'active',
    bioguideId: 'L000595', // incumbent Julia Letlow
  },
  'TX-23': {
    name: 'Brandon Herrera',
    party: 'Republican',
    role: 'Candidate for U.S. House',
    bio: 'Second Amendment absolutist and self-made manufacturer who beat the establishment’s man twice. Gun rights without exceptions, borders without excuses.',
    status: 'won',
    bioguideId: 'G000594', // incumbent Tony Gonzales
  },
  'TX-32': {
    name: 'Jace Yarbrough',
    party: 'Republican',
    role: 'Candidate for U.S. House',
    bio: 'Constitutional lawyer who sued the Pentagon over its mandates and DEI regime. Religious liberty, parental rights, an America First judiciary.',
    status: 'won',
    bioguideId: 'J000310', // incumbent Julie Johnson
  },
};

/** Build carousel / EndorsedView cards from ENDORSED + local photos (sync). */
export function getEndorsedCards() {
  return Object.entries(ENDORSED).map(([distKey, meta]) => {
    const dash = distKey.indexOf('-');
    const state = dash === -1 ? distKey : distKey.slice(0, dash);
    const distRaw = dash === -1 ? null : distKey.slice(dash + 1);
    const district = distRaw != null && !Number.isNaN(Number(distRaw))
      ? Number(distRaw)
      : distRaw;

    return {
      distKey,
      state,
      district,
      name: meta.name,
      party: meta.party,
      role: meta.role,
      bio: meta.bio,
      status: meta.status,
      bioguideId: meta.bioguideId,
      imageUrl: PHOTO_BY_KEY[distKey] ?? null,
    };
  });
}
