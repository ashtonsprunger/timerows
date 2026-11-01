import { getUserLocalTimezone } from '../engine/timezoneEngine.js';
import { findPrimaryCityForTimezone } from '../engine/citySearch.js';

export function getDefaultCities() {
  const localTz = getUserLocalTimezone();
  const primaryMatch = findPrimaryCityForTimezone(localTz);

  const cityName = primaryMatch
    ? primaryMatch.name
    : localTz.split('/').pop().replace(/_/g, ' ') || 'My Location';

  const candidatePresets = [
    { id: 'new-york-us', name: 'New York', country: 'United States', timeZone: 'America/New_York' },
    { id: 'london-gb', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
    { id: 'tokyo-jp', name: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo' },
    { id: 'san-francisco-us', name: 'San Francisco', country: 'United States', timeZone: 'America/Los_Angeles' },
    { id: 'sydney-au', name: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney' },
  ];

  const defaultRows = [
    {
      id: primaryMatch?.id || 'city-local',
      name: cityName,
      country: primaryMatch?.country || 'Local Timezone',
      timeZone: localTz,
      isLocal: true,
    },
  ];

  for (const preset of candidatePresets) {
    if (defaultRows.length >= 4) break;
    const alreadyExists = defaultRows.some(
      (row) => row.timeZone === preset.timeZone || row.id === preset.id
    );
    if (!alreadyExists) {
      defaultRows.push({ ...preset, isLocal: false });
    }
  }

  return defaultRows;
}

export const TEAM_PRESETS = [
  {
    id: 'preset-transatlantic',
    label: 'NYC · London · UTC',
    cities: [
      { id: 'new-york-us', name: 'New York', country: 'United States', timeZone: 'America/New_York', isPrimary: true },
      { id: 'london-gb', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
      { id: 'utc-gmt', name: 'UTC', country: 'Coordinated Universal Time', timeZone: 'UTC' },
    ],
  },
  {
    id: 'preset-us-eu',
    label: 'SF · NYC · London · Berlin',
    cities: [
      { id: 'san-francisco-us', name: 'San Francisco', country: 'United States', timeZone: 'America/Los_Angeles', isPrimary: true },
      { id: 'new-york-us', name: 'New York', country: 'United States', timeZone: 'America/New_York' },
      { id: 'london-gb', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
      { id: 'berlin-de', name: 'Berlin', country: 'Germany', timeZone: 'Europe/Berlin' },
    ],
  },
  {
    id: 'preset-us-india',
    label: 'NYC · London · Bengaluru',
    cities: [
      { id: 'new-york-us', name: 'New York', country: 'United States', timeZone: 'America/New_York', isPrimary: true },
      { id: 'london-gb', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
      { id: 'bengaluru-in', name: 'Bengaluru', country: 'India', timeZone: 'Asia/Kolkata' },
    ],
  },
  {
    id: 'preset-global-hubs',
    label: 'NYC · London · Tokyo · Sydney',
    cities: [
      { id: 'new-york-us', name: 'New York', country: 'United States', timeZone: 'America/New_York', isPrimary: true },
      { id: 'london-gb', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
      { id: 'tokyo-jp', name: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo' },
      { id: 'sydney-au', name: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney' },
    ],
  },
];

