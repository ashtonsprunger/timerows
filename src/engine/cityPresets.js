/**
 * TimeRows - City Preset Helpers
 *
 * Pure helpers for team presets. Zero React dependencies.
 */

/**
 * Returns true when two city lists contain the same IANA timezones,
 * regardless of order (multiset comparison). Ids, names, primary flags,
 * and custom working hours are ignored so reordering rows or renaming
 * "UTC / GMT" to "UTC" never breaks the match.
 *
 * @param {Array<{ timeZone: string }>} cities
 * @param {Array<{ timeZone: string }>} presetCities
 * @returns {boolean}
 */
export function isSameCitySet(cities, presetCities) {
  if (!Array.isArray(cities) || !Array.isArray(presetCities)) return false;
  if (cities.length === 0 || cities.length !== presetCities.length) return false;

  const counts = new Map();
  for (const c of cities) {
    const tz = c?.timeZone;
    if (!tz) return false;
    counts.set(tz, (counts.get(tz) || 0) + 1);
  }
  for (const p of presetCities) {
    const tz = p?.timeZone;
    const remaining = counts.get(tz);
    if (!remaining) return false;
    counts.set(tz, remaining - 1);
  }
  return true;
}
