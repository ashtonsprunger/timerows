/**
 * TimeRows - City Search Engine
 * 
 * Fast fuzzy autocomplete search engine with alias resolution,
 * timezone abbreviation lookup, diacritic normalization,
 * population-weighted scoring, and timezone indexing.
 * Zero React dependencies.
 */

import citiesData from '../data/cities.json';

/**
 * Remove diacritics/accents, strip apostrophes/periods, and normalize to lowercase.
 * e.g. "São Paulo" -> "sao paulo", "Zürich" -> "zurich", "Xi'an" -> "xian", "St. John's" -> "st johns"
 * 
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’.\u2018\u2019]/g, '')
    .replace(/-/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert a string into a URL-safe slug for slug-index lookups.
 * @param {string} text
 * @returns {string}
 */
function toSlugKey(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Canonical timezone abbreviation to IANA timezones mapping.
 * Ordered with the primary timezone first so major hubs rank highest.
 */
export const TIMEZONE_ABBR_TO_ZONES = Object.freeze({
  utc: ['UTC'],
  gmt: ['UTC', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Atlantic/Reykjavik'],
  z: ['UTC'],
  est: ['America/New_York', 'America/Toronto', 'America/Detroit', 'America/Indiana/Indianapolis', 'America/Cancun', 'America/Panama'],
  edt: ['America/New_York', 'America/Toronto', 'America/Detroit', 'America/Indiana/Indianapolis'],
  et: ['America/New_York', 'America/Toronto', 'America/Detroit'],
  cst: ['America/Chicago', 'America/Mexico_City', 'America/Winnipeg', 'America/Costa_Rica', 'America/Guatemala'],
  cdt: ['America/Chicago', 'America/Winnipeg', 'America/Monterrey'],
  ct: ['America/Chicago', 'America/Mexico_City', 'America/Winnipeg'],
  mst: ['America/Denver', 'America/Phoenix', 'America/Edmonton', 'America/Boise'],
  mdt: ['America/Denver', 'America/Edmonton', 'America/Boise'],
  mt: ['America/Denver', 'America/Phoenix', 'America/Edmonton'],
  pst: ['America/Los_Angeles', 'America/Vancouver', 'America/Tijuana'],
  pdt: ['America/Los_Angeles', 'America/Vancouver', 'America/Tijuana'],
  pt: ['America/Los_Angeles', 'America/Vancouver'],
  akst: ['America/Anchorage'],
  akdt: ['America/Anchorage'],
  akt: ['America/Anchorage'],
  hst: ['Pacific/Honolulu'],
  ast: ['America/Halifax', 'America/Puerto_Rico', 'America/Santo_Domingo'],
  adt: ['America/Halifax'],
  nst: ['America/St_Johns'],
  ndt: ['America/St_Johns'],
  brt: ['America/Sao_Paulo', 'America/Bahia'],
  art: ['America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza'],
  clt: ['America/Santiago'],
  clst: ['America/Santiago'],
  cot: ['America/Bogota'],
  pet: ['America/Lima'],
  ect: ['America/Guayaquil'],
  vet: ['America/Caracas'],
  uyt: ['America/Montevideo'],
  bst: ['Europe/London'],
  wet: ['Europe/Lisbon', 'Atlantic/Reykjavik'],
  west: ['Europe/Lisbon'],
  cet: [
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/Vienna',
    'Europe/Zurich',
    'Europe/Stockholm',
    'Europe/Oslo',
    'Europe/Copenhagen',
    'Europe/Warsaw',
    'Europe/Prague',
    'Europe/Budapest',
  ],
  cest: [
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/Vienna',
    'Europe/Zurich',
    'Europe/Stockholm',
    'Europe/Oslo',
    'Europe/Copenhagen',
    'Europe/Warsaw',
    'Europe/Prague',
    'Europe/Budapest',
  ],
  eet: ['Europe/Athens', 'Europe/Helsinki', 'Europe/Bucharest', 'Europe/Kyiv', 'Africa/Cairo'],
  eest: ['Europe/Athens', 'Europe/Helsinki', 'Europe/Bucharest', 'Europe/Kyiv'],
  msk: ['Europe/Moscow'],
  trt: ['Europe/Istanbul'],
  ist: ['Asia/Kolkata', 'Asia/Jerusalem', 'Europe/Dublin'],
  pkt: ['Asia/Karachi'],
  npt: ['Asia/Kathmandu'],
  bdt: ['Asia/Dhaka'],
  ict: ['Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'Asia/Phnom_Penh'],
  wib: ['Asia/Jakarta'],
  wita: ['Asia/Makassar'],
  sgt: ['Asia/Singapore'],
  myt: ['Asia/Kuala_Lumpur'],
  pht: ['Asia/Manila'],
  hkt: ['Asia/Hong_Kong'],
  jst: ['Asia/Tokyo'],
  kst: ['Asia/Seoul'],
  aest: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Hobart'],
  aedt: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Hobart'],
  aet: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane'],
  acst: ['Australia/Adelaide', 'Australia/Darwin'],
  acdt: ['Australia/Adelaide'],
  awst: ['Australia/Perth'],
  nzst: ['Pacific/Auckland'],
  nzdt: ['Pacific/Auckland'],
  nzt: ['Pacific/Auckland'],
  gst: ['Asia/Dubai', 'Asia/Muscat'],
  sast: ['Africa/Johannesburg'],
  eat: ['Africa/Nairobi', 'Africa/Addis_Ababa', 'Africa/Dar_es_Salaam', 'Africa/Kampala'],
  wat: ['Africa/Lagos', 'Africa/Tunis', 'Africa/Algiers'],
});

// Backward-compatible legacy ID map for previously malformed diacritic IDs
const LEGACY_ID_MAP = Object.freeze({
  's-o-paulo-br': 'sao-paulo-br',
  'bras-lia-br': 'brasilia-br',
  'canc-n-mx': 'cancun-mx',
  'san-jos--cr': 'san-jose-cr',
  'c-rdoba-ar': 'cordoba-ar',
  'bogot--co': 'bogota-co',
  'medell-n-co': 'medellin-co',
  'd-sseldorf-de': 'dusseldorf-de',
  'krak-w-pl': 'krakow-pl',
});

/**
 * Calculate Levenshtein edit distance between two strings.
 * Used for typo tolerance.
 * 
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Pre-indexes cities by ID, slug, and timezone for O(1) lookups.
 * Also augments the curated cities.json list with any valid IANA timezones
 * supported by the runtime environment (`Intl.supportedValuesOf('timeZone')`)
 * so 100% of global IANA zones and cities are searchable.
 */
const fullCityDataset = [...citiesData];
const cityMapById = new Map();
const cityMapBySlug = new Map();
const citiesByTz = new Map();

function indexCityEntry(city) {
  cityMapById.set(city.id, city);

  const nameSlug = toSlugKey(city.name);
  if (nameSlug) {
    const existing = cityMapBySlug.get(nameSlug);
    if (!existing || (city.population || 0) > (existing.population || 0)) {
      cityMapBySlug.set(nameSlug, city);
    }
  }

  const tzList = citiesByTz.get(city.timeZone) || [];
  tzList.push(city);
  citiesByTz.set(city.timeZone, tzList);
}

for (const city of citiesData) {
  indexCityEntry(city);
}

try {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    const supportedZones = Intl.supportedValuesOf('timeZone');
    for (const tz of supportedZones) {
      if (!tz || !tz.includes('/') || tz.startsWith('Etc/')) continue;
      const parts = tz.split('/');
      const rawCity = parts[parts.length - 1].replace(/_/g, ' ');
      const region = parts[0].replace(/_/g, ' ');
      const nameSlug = toSlugKey(rawCity);
      if (!nameSlug || cityMapBySlug.has(nameSlug)) continue;

      const ianaEntry = {
        id: `iana-${toSlugKey(tz)}`,
        name: rawCity,
        country: region,
        countryCode: '',
        state: parts.length > 2 ? parts[1].replace(/_/g, ' ') : '',
        timeZone: tz,
        population: 25000,
        aliases: [tz],
      };
      fullCityDataset.push(ianaEntry);
      indexCityEntry(ianaEntry);
    }
  }
} catch {
  // Ignore if Intl.supportedValuesOf is unavailable in an older environment
}

/**
 * Get city by its unique ID (supports legacy diacritic IDs transparently).
 * @param {string} id
 * @returns {Object|null}
 */
export function getCityById(id) {
  if (!id || typeof id !== 'string') return null;
  const lower = id.toLowerCase();
  const resolvedId = LEGACY_ID_MAP[lower] || lower;
  return cityMapById.get(resolvedId) || null;
}

/**
 * Get highest-population city matching a slugified city name (e.g. "st-john-s" -> St. John's).
 * @param {string} slug
 * @returns {Object|null}
 */
export function getCityBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const clean = toSlugKey(slug);
  return cityMapBySlug.get(clean) || null;
}

/**
 * Find all cities in a specific IANA timezone.
 * @param {string} timeZone
 * @returns {Array<Object>}
 */
export function findCitiesByTimezone(timeZone) {
  return citiesByTz.get(timeZone) || [];
}

/**
 * Returns the highest population city for a timezone.
 * Ideal for mapping detected local timezones to friendly city names.
 * 
 * @param {string} timeZone
 * @returns {Object|null}
 */
export function findPrimaryCityForTimezone(timeZone) {
  const matches = findCitiesByTimezone(timeZone);
  if (!matches || matches.length === 0) return null;
  return matches.reduce((highest, current) => {
    return (current.population || 0) > (highest.population || 0) ? current : highest;
  }, matches[0]);
}

/**
 * Search cities using fast multi-factor scoring:
 * - Exact name / alias match
 * - Timezone abbreviation match (EST, PST, CET, IST, JST, AEST, etc.)
 * - Prefix match
 * - Word boundary match
 * - Substring match on country, state, or timezone
 * - Typo tolerance via edit distance (guarded against short-acronym false positives)
 * - Population weighting (logarithmic)
 * 
 * @param {string} query - Search input
 * @param {Object} [options]
 * @param {number} [options.limit=10] - Maximum results
 * @param {Array<Object>} [options.dataset] - Optional custom cities list
 * @param {string} [options.countryFilter] - 2-letter ISO country code
 * @returns {Array<Object>}
 */
export function searchCities(query, options = {}) {
  const { limit = 10, dataset = fullCityDataset, countryFilter = null } = options;
  const q = normalizeText(query);

  // If query is empty, return top global hubs ranked by population
  if (!q) {
    const list = countryFilter
      ? dataset.filter((c) => c.countryCode.toLowerCase() === countryFilter.toLowerCase())
      : dataset;
    return [...list]
      .sort((a, b) => (b.population || 0) - (a.population || 0))
      .slice(0, limit);
  }

  const abbrZones = TIMEZONE_ABBR_TO_ZONES[q] || null;
  const scoredResults = [];

  for (let i = 0; i < dataset.length; i++) {
    const city = dataset[i];

    if (countryFilter && city.countryCode.toLowerCase() !== countryFilter.toLowerCase()) {
      continue;
    }

    const normName = normalizeText(city.name);
    const normCountry = normalizeText(city.country);
    const normState = normalizeText(city.state);
    const normTz = normalizeText(city.timeZone);
    const zoneIndexInAbbr = abbrZones ? abbrZones.indexOf(city.timeZone) : -1;

    let matchScore = 0;

    // 1. Exact match on city name
    if (normName === q) {
      matchScore += 1000;
    }
    // 2. Exact match on primary canonical timezone abbreviation (e.g. "EST", "PST", "CET", "IST", "HKT", "AEST")
    else if (zoneIndexInAbbr === 0) {
      matchScore += 920;
    }
    // 3. Exact match on aliases (e.g. "NYC", "SF", "SFO", "LAX", "BLR")
    else if (city.aliases && city.aliases.some((a) => normalizeText(a) === q)) {
      matchScore += 900;
    }
    // 4. Secondary timezone in canonical abbreviation list
    else if (zoneIndexInAbbr > 0) {
      matchScore += 810;
    }
    // 4. Name starts with query (Prefix match)
    else if (normName.startsWith(q)) {
      matchScore += 600;
    }
    // 5. Alias starts with query (only for queries >= 2 chars)
    else if (q.length >= 2 && city.aliases && city.aliases.some((a) => normalizeText(a).startsWith(q))) {
      matchScore += 500;
    }
    // 6. Word boundary match in city name (e.g. "York" in "New York")
    else if (normName.includes(` ${q}`)) {
      matchScore += 400;
    }
    // 7. Substring match on city name (skip if query is a known TZ abbreviation so "MST" doesn't pull "Amsterdam" or "AEST" pull unrelated cities)
    else if (!abbrZones && normName.includes(q)) {
      matchScore += 300;
    }
    // 8. Substring match on state / province
    else if (!abbrZones && normState && normState.includes(q)) {
      matchScore += 200;
    }
    // 9. Substring match on country name
    else if (!abbrZones && normCountry.includes(q)) {
      matchScore += 150;
    }
    // 10. Substring match on timezone name (e.g. "America/New_York", "Asia/Kolkata")
    else if (normTz.includes(q)) {
      matchScore += 100;
    }
    // 11. Typo tolerance: same starting letter, bounded length difference, no TZ-abbreviation false positives
    else if (
      !abbrZones &&
      q.length >= 4 &&
      normName.length >= 4 &&
      normName[0] === q[0] &&
      Math.abs(normName.length - q.length) <= 2
    ) {
      const dist = levenshteinDistance(q, normName);
      if (dist === 1) {
        matchScore += 180;
      } else if (dist === 2 && q.length >= 6) {
        matchScore += 90;
      }
    }

    // Only include if there was a match
    if (matchScore > 0) {
      // Add logarithmic population bonus so "London, UK" beats "London, Canada"
      const pop = city.population || 10000;
      const popScore = Math.log10(pop) * 15;
      const totalScore = matchScore + popScore;

      scoredResults.push({
        city,
        score: totalScore,
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.slice(0, limit).map((item) => item.city);
}
