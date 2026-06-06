// Maps geojson filename stem -> 2-letter state abbreviation
const STATE_ABBR = {
  alabama: 'AL',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  florida: 'FL',
  georgia: 'GA',
  idaho: 'ID',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  newhampshire: 'NH',
  newjersey: 'NJ',
  newmexico: 'NM',
  newyork: 'NY',
  northcarolina: 'NC',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  rhodeisland: 'RI',
  southcarolina: 'SC',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  virginia: 'VA',
  washington: 'WA',
  westvirginia: 'WV',
  wisconsin: 'WI',
};

const STATE_FILES = Object.keys(STATE_ABBR);

export async function loadGeo() {
  const allFeatures = [];

  await Promise.all(
    STATE_FILES.map(async (stem) => {
      try {
        const res = await fetch(`/geojson/${stem}.geojson`);
        if (!res.ok) return;
        const data = await res.json();
        const abbr = STATE_ABBR[stem];
        for (const feat of data.features) {
          allFeatures.push({
            ...feat,
            properties: { ...feat.properties, state: abbr },
          });
        }
      } catch {
        // skip unavailable files silently
      }
    })
  );

  return { type: 'FeatureCollection', features: allFeatures };
}
