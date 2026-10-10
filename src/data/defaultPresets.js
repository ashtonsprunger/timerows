import { getUserLocalTimezone } from '../engine/timezoneEngine.js';
import { findPrimaryCityForTimezone } from '../engine/citySearch.js';

export function getDefaultCities() {
  const localTz = getUserLocalTimezone();
  const primaryMatch = findPrimaryCityForTimezone(localTz);

  // Friendly city name
  const cityName = primaryMatch ? primaryMatch.name : (localTz.split('/').pop().replace(/_/g, ' ') || 'My Location');

  // Primary hubs
  const candidatePresets = [
    { id: 'city-nyc', name: 'New York', country: 'United States', timeZone: 'America/New_York' },
    { id: 'city-lon', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
    { id: 'city-tyo', name: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo' },
    { id: 'city-sfo', name: 'San Francisco', country: 'United States', timeZone: 'America/Los_Angeles' },
    { id: 'city-syd', name: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney' },
  ];

  const defaultRows = [
    {
      id: 'city-local',
      name: `${cityName} (Local)`,
      country: primaryMatch?.country || '',
      timeZone: localTz,
      isPrimary: true,
    },
  ];

  // Add NYC, London, Tokyo (ensuring no duplicate timezone with local)
  for (const preset of candidatePresets) {
    if (defaultRows.length >= 4) break;
    const alreadyExists = defaultRows.some((row) => row.timeZone === preset.timeZone);
    if (!alreadyExists) {
      defaultRows.push({ ...preset, isPrimary: false });
    }
  }

  return defaultRows;
}
