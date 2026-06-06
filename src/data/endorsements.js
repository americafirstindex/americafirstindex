// District key -> endorsement metadata  (state-DISTNUM, matching geojson properties.NAME)
export const ENDORSED = {
  'MT-1':  { name: 'John Paulsen',      cardId: 'card-mt1',  status: 'active' },
  'TX-1':  { name: 'Tyler Briscoe',     cardId: 'card-tx1',  status: 'won'    },
  'FL-2':  { name: 'Keith Gross',       cardId: 'card-fl2',  status: 'active' },
  'AZ-1':  { name: 'Rachel Hawkins',    cardId: 'card-az1',  status: 'active' },
  'GA-1':  { name: 'Marcus Webb',       cardId: 'card-ga1',  status: 'won'    },
  'OH-1':  { name: 'Daniel Strickland', cardId: 'card-oh1',  status: 'active' },
};

export const CARDS = [
  {
    id: 'card-mt1',
    state: 'MT', dist: '1', distKey: 'MT-1',
    name: 'John Paulsen',
    region: 'Western Montana',
    desc: 'Army veteran. Rancher. Fighting to restore American energy independence and border security.',
    status: 'active',
  },
  {
    id: 'card-tx1',
    state: 'TX', dist: '1', distKey: 'TX-1',
    name: 'Tyler Briscoe',
    region: 'East Texas',
    desc: 'Marine Corps veteran. Small business owner. Trump-endorsed America First champion.',
    status: 'won',
  },
  {
    id: 'card-fl2',
    state: 'FL', dist: '2', distKey: 'FL-2',
    name: 'Keith Gross',
    region: 'Florida Panhandle',
    desc: 'Army National Guard veteran. Businessman. America First fighter for the Panhandle.',
    status: 'active',
  },
  {
    id: 'card-az1',
    state: 'AZ', dist: '1', distKey: 'AZ-1',
    name: 'Rachel Hawkins',
    region: 'Northern Arizona',
    desc: 'Nurse and community leader. Fighting for secure borders and lower healthcare costs.',
    status: 'active',
  },
  {
    id: 'card-ga1',
    state: 'GA', dist: '1', distKey: 'GA-1',
    name: 'Marcus Webb',
    region: 'Coastal Georgia',
    desc: 'Navy veteran. Sheriff. Trump-endorsed conservative ready to fight the radical agenda.',
    status: 'won',
  },
  {
    id: 'card-oh1',
    state: 'OH', dist: '1', distKey: 'OH-1',
    name: 'Daniel Strickland',
    region: 'Greater Cincinnati',
    desc: 'Manufacturing executive. Former prosecutor. Putting Ohio workers and families first.',
    status: 'active',
  },
];
