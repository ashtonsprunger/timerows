/**
 * TimeRows - URL Sync & State Serializer Engine
 * 
 * Bidirectional URL slug and share-state serializer.
 * Supports:
 * - Share links: /m/nyc+lon+tyo or ?c=nyc,lon,tyo&d=YYYY-MM-DD&slot=14&dur=2
 * - Programmatic SEO city-pairs: /from/:cityA/to/:cityB
 * Zero React dependencies.
 */

import {
  getCityById,
  getCityBySlug,
  findPrimaryCityForTimezone,
  searchCities,
} from './citySearch.js';
import { isValidTimezone } from './timezoneEngine.js';

// Common city slug mappings for ultra-short shareable URLs (timerows.com/m/nyc+lon+tyo)
export const SLUG_TO_TIMEZONE = Object.freeze({
  nyc: 'America/New_York',
  lon: 'Europe/London',
  tyo: 'Asia/Tokyo',
  sfo: 'America/Los_Angeles',
  lax: 'America/Los_Angeles',
  chi: 'America/Chicago',
  par: 'Europe/Paris',
  ber: 'Europe/Berlin',
  syd: 'Australia/Sydney',
  mel: 'Australia/Melbourne',
  sgp: 'Asia/Singapore',
  sin: 'Asia/Singapore',
  hkg: 'Asia/Hong_Kong',
  dxb: 'Asia/Dubai',
  del: 'Asia/Kolkata',
  bom: 'Asia/Kolkata',
  blr: 'Asia/Kolkata',
  tor: 'America/Toronto',
  ams: 'Europe/Amsterdam',
  fra: 'Europe/Berlin',
  sea: 'America/Los_Angeles',
  bos: 'America/New_York',
  mia: 'America/New_York',
  atl: 'America/New_York',
  den: 'America/Denver',
  aus: 'America/Chicago',
  yvr: 'America/Vancouver',
  gru: 'America/Sao_Paulo',
  mex: 'America/Mexico_City',
  mad: 'Europe/Madrid',
  rom: 'Europe/Rome',
  zrh: 'Europe/Zurich',
  dub: 'Europe/Dublin',
  arn: 'Europe/Stockholm',
  waw: 'Europe/Warsaw',
  ist: 'Europe/Istanbul',
  icn: 'Asia/Seoul',
  tpe: 'Asia/Taipei',
  bkk: 'Asia/Bangkok',
  jkt: 'Asia/Jakarta',
  akl: 'Pacific/Auckland',
  utc: 'UTC',
});

// Direct mapping from short slug to exact city ID in cities.json so city identity is preserved
export const SLUG_TO_CITY_ID = Object.freeze({
  nyc: 'new-york-us',
  lon: 'london-gb',
  tyo: 'tokyo-jp',
  sfo: 'san-francisco-us',
  lax: 'los-angeles-us',
  chi: 'chicago-us',
  par: 'paris-fr',
  ber: 'berlin-de',
  syd: 'sydney-au',
  mel: 'melbourne-au',
  sgp: 'singapore-sg',
  sin: 'singapore-sg',
  hkg: 'hong-kong-hk',
  dxb: 'dubai-ae',
  del: 'new-delhi-in',
  bom: 'mumbai-in',
  blr: 'bengaluru-in',
  tor: 'toronto-ca',
  ams: 'amsterdam-nl',
  fra: 'frankfurt-de',
  sea: 'seattle-us',
  bos: 'boston-us',
  mia: 'miami-us',
  atl: 'atlanta-us',
  den: 'denver-us',
  aus: 'austin-us',
  yvr: 'vancouver-ca',
  gru: 'sao-paulo-br',
  mex: 'mexico-city-mx',
  mad: 'madrid-es',
  rom: 'rome-it',
  zrh: 'zurich-ch',
  dub: 'dublin-ie',
  arn: 'stockholm-se',
  waw: 'warsaw-pl',
  ist: 'istanbul-tr',
  icn: 'seoul-kr',
  tpe: 'taipei-tw',
  bkk: 'bangkok-th',
  jkt: 'jakarta-id',
  akl: 'auckland-nz',
  utc: 'utc-gmt',
});

const CITY_ID_TO_SLUG = Object.freeze(
  Object.entries(SLUG_TO_CITY_ID).reduce((acc, [slug, id]) => {
    if (!acc[id]) acc[id] = slug;
    return acc;
  }, {})
);

// Reverse mapping for timezone to short slug
const TIMEZONE_TO_SLUG = Object.freeze(
  Object.entries(SLUG_TO_TIMEZONE).reduce((acc, [slug, tz]) => {
    if (!acc[tz]) acc[tz] = slug;
    return acc;
  }, {})
);

/**
 * Converts a city or location name into a clean URL-safe slug.
 * e.g. "San Francisco" -> "san-francisco", "São Paulo" -> "sao-paulo"
 * 
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, '');        // Trim leading and trailing hyphens
}

/**
 * Reverts a slug to a capitalized title string.
 * e.g. "san-francisco" -> "San Francisco"
 * 
 * @param {string} slug
 * @returns {string}
 */
export function unslugify(slug) {
  if (!slug || typeof slug !== 'string') return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolves any URL token (short code like "sfo", city ID like "san-francisco-us",
 * slug like "san-francisco", or IANA timezone like "America/New_York") into a complete city object.
 *
 * @param {string} token
 * @param {number} [index=0]
 * @returns {{ id: string, name: string, country: string, timeZone: string } | null}
 */
export function resolveCityFromToken(token, index = 0) {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check short code -> exact city ID (e.g., 'sfo' -> San Francisco, 'bom' -> Mumbai)
  const mappedCityId = SLUG_TO_CITY_ID[lower];
  if (mappedCityId) {
    const cityFromSlug = getCityById(mappedCityId);
    if (cityFromSlug) {
      return {
        id: cityFromSlug.id,
        name: cityFromSlug.name,
        country: cityFromSlug.country || '',
        timeZone: cityFromSlug.timeZone,
      };
    }
  }

  // 2. Check exact city ID in database (e.g., 'philadelphia-us' or legacy 's-o-paulo-br')
  const exactCity = getCityById(lower);
  if (exactCity) {
    return {
      id: exactCity.id,
      name: exactCity.name,
      country: exactCity.country || '',
      timeZone: exactCity.timeZone,
    };
  }

  // 3. Check slugified city name in database (e.g., 'st-john-s', 'sao-paulo', 'san-francisco', 'xi-an')
  const slugCity = getCityBySlug(lower);
  if (slugCity) {
    return {
      id: slugCity.id,
      name: slugCity.name,
      country: slugCity.country || '',
      timeZone: slugCity.timeZone,
    };
  }

  // 4. Check short code -> timezone fallback
  if (SLUG_TO_TIMEZONE[lower]) {
    const tz = SLUG_TO_TIMEZONE[lower];
    const primary = findPrimaryCityForTimezone(tz);
    return {
      id: primary?.id || `city-${lower}-${index}`,
      name: primary?.name || tz.split('/').pop().replace(/_/g, ' '),
      country: primary?.country || '',
      timeZone: tz,
    };
  }

  // 5. Check if token is a raw valid IANA timezone (e.g., 'America/New_York' or 'Pacific/Auckland')
  if (trimmed.includes('/') || trimmed.toUpperCase() === 'UTC') {
    if (isValidTimezone(trimmed)) {
      const primary = findPrimaryCityForTimezone(trimmed);
      return {
        id: primary?.id || `tz-city-${index}`,
        name: primary?.name || trimmed.split('/').pop().replace(/_/g, ' '),
        country: primary?.country || '',
        timeZone: trimmed,
      };
    }
  }

  // 6. Search by unslugified city name (e.g., 'san-francisco' -> 'San Francisco', 'london' -> 'London')
  const searchQuery = unslugify(lower);
  const matches = searchCities(searchQuery, { limit: 1 });
  if (matches && matches.length > 0) {
    const best = matches[0];
    return {
      id: best.id,
      name: best.name,
      country: best.country || '',
      timeZone: best.timeZone,
    };
  }

  return null;
}

/**
 * Converts a city object or timezone string into its cleanest URL token.
 * Preserves city identity (e.g. San Francisco -> 'sfo', Mumbai -> 'bom', Philadelphia -> 'philadelphia-us').
 *
 * @param {Object|string} city
 * @returns {string}
 */
export function getCityUrlToken(city) {
  if (!city) return '';
  if (typeof city === 'string') {
    return TIMEZONE_TO_SLUG[city] || city;
  }

  // If city has a known short slug by ID, use it
  if (city.id && CITY_ID_TO_SLUG[city.id]) {
    return CITY_ID_TO_SLUG[city.id];
  }

  // If city ID exists in cities.json (including legacy ID resolution), use its short slug or canonical ID
  if (city.id) {
    const dbCity = getCityById(city.id);
    if (dbCity) {
      return CITY_ID_TO_SLUG[dbCity.id] || dbCity.id;
    }
  }

  // If city name matches a known city in searchCities with the same timezone, use its slug
  if (city.name) {
    const cleanName = city.name.replace(/\s*\(Local\)\s*$/i, '').trim();
    const matched = searchCities(cleanName, { limit: 1 })[0];
    if (matched && matched.timeZone === city.timeZone) {
      return CITY_ID_TO_SLUG[matched.id] || matched.id;
    }
  }

  const tz = city.timeZone || 'UTC';
  return TIMEZONE_TO_SLUG[tz] || tz;
}

/**
 * Parse programmatic SEO city-pair routes (/from/:cityA/to/:cityB).
 * 
 * @param {string} pathname - URL pathname
 * @returns {{ fromSlug: string, toSlug: string, fromName: string, toName: string, fromCity?: Object, toCity?: Object } | null}
 */
export function parseCityPairPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return null;

  // Regex matches /from/:cityA/to/:cityB with optional trailing slash
  const match = pathname.match(/^\/?from\/([a-z0-9-]+)\/to\/([a-z0-9-]+)\/?$/i);
  if (!match) return null;

  const fromSlug = match[1].toLowerCase();
  const toSlug = match[2].toLowerCase();

  return {
    fromSlug,
    toSlug,
    fromName: unslugify(fromSlug),
    toName: unslugify(toSlug),
  };
}

/**
 * Build programmatic SEO path for a pair of cities.
 * 
 * @param {string} cityA - City name or slug
 * @param {string} cityB - City name or slug
 * @returns {string} e.g. "/from/san-francisco/to/london"
 */
export function buildCityPairPath(cityA, cityB) {
  const slugA = slugify(cityA);
  const slugB = slugify(cityB);
  if (!slugA || !slugB) return '/';
  return `/from/${slugA}/to/${slugB}`;
}

/**
 * Serializes application share state into query parameters.
 * 
 * @param {Object} state
 * @param {Array<{ id?: string, name?: string, timeZone: string }|string>} state.cities - Array of timezone strings or city objects
 * @param {string} [state.date] - Reference date 'YYYY-MM-DD'
 * @param {number} [state.selectedSlotIndex] - Currently highlighted/selected start slot column
 * @param {number} [state.selectedEndSlotIndex] - Optional end slot column for multi-hour range
 * @param {string} [state.referenceTimezone] - Primary reference timezone
 * @returns {string} Query string without leading '?' (e.g. "c=nyc,lon,tyo&d=2026-10-10")
 */
export function serializeShareQuery(state) {
  if (!state || !state.cities || !Array.isArray(state.cities) || state.cities.length === 0) {
    return '';
  }

  const params = new URLSearchParams();

  const cityTokens = state.cities.map((city) => getCityUrlToken(city)).filter(Boolean);
  params.set('c', cityTokens.join(','));

  if (state.date) {
    params.set('d', state.date);
  }

  if (state.referenceTimezone) {
    const refToken = TIMEZONE_TO_SLUG[state.referenceTimezone] || state.referenceTimezone;
    params.set('ref', refToken);
  }

  if (typeof state.selectedSlotIndex === 'number' && state.selectedSlotIndex >= 0) {
    params.set('slot', String(state.selectedSlotIndex));
    if (
      typeof state.selectedEndSlotIndex === 'number' &&
      state.selectedEndSlotIndex !== state.selectedSlotIndex
    ) {
      params.set('end', String(state.selectedEndSlotIndex));
    }
  }

  if (
    state.workingHours &&
    typeof state.workingHours.start === 'number' &&
    typeof state.workingHours.end === 'number' &&
    (state.workingHours.start !== 9 || state.workingHours.end !== 17)
  ) {
    params.set('wh', `${state.workingHours.start}-${state.workingHours.end}`);
  }

  return params.toString();
}

/**
 * Deserializes URL query parameters back into an application state object.
 * 
 * @param {string|URLSearchParams} search - Query string or URLSearchParams instance
 * @returns {{
 *   timezones: string[],
 *   cityTokens?: string[],
 *   date: string | null,
 *   referenceTimezone: string | null,
 *   selectedSlotIndex: number | null,
 *   selectedEndSlotIndex?: number | null
 * }}
 */
export function deserializeShareQuery(search) {
  const result = {
    timezones: [],
    date: null,
    referenceTimezone: null,
    selectedSlotIndex: null,
  };

  if (!search) return result;

  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;

  const rawCities = params.get('c') || params.get('cities');
  if (rawCities) {
    const tokens = rawCities
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);

    result.timezones = tokens.map((token) => {
      const lower = token.toLowerCase();
      if (SLUG_TO_TIMEZONE[lower]) return SLUG_TO_TIMEZONE[lower];
      const byId = getCityById(lower);
      if (byId) return byId.timeZone;
      return token;
    });
  }

  const rawDate = params.get('d') || params.get('date');
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    result.date = rawDate;
  }

  const rawRef = params.get('ref');
  if (rawRef) {
    const lowerRef = rawRef.toLowerCase();
    result.referenceTimezone =
      SLUG_TO_TIMEZONE[lowerRef] || getCityById(lowerRef)?.timeZone || rawRef;
  }

  const rawSlot = params.get('slot');
  if (rawSlot !== null && !isNaN(Number(rawSlot))) {
    result.selectedSlotIndex = parseFloat(rawSlot);
  }

  const rawEnd = params.get('end');
  if (rawEnd !== null && !isNaN(Number(rawEnd))) {
    result.selectedEndSlotIndex = parseFloat(rawEnd);
  }

  const rawWh = params.get('wh');
  if (rawWh && /^(\d{1,2})-(\d{1,2})$/.test(rawWh)) {
    const [, sStr, eStr] = rawWh.match(/^(\d{1,2})-(\d{1,2})$/);
    const start = Number(sStr);
    const end = Number(eStr);
    if (start >= 0 && end <= 24 && start < end) {
      result.workingHours = { start, end };
    }
  }

  return result;
}

/**
 * Parse ultra-compact meeting path (e.g. /m/nyc+lon+tyo)
 * 
 * @param {string} pathname
 * @returns {string[] | null} Array of resolved timezones or null
 */
export function parseCompactMeetingPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return null;

  const match = pathname.match(/^\/?m\/([a-z0-9+_-]+)\/?$/i);
  if (!match) return null;

  const tokens = match[1].split('+').filter(Boolean);
  const timezones = tokens.map((t) => {
    const lower = t.toLowerCase();
    if (SLUG_TO_TIMEZONE[lower]) return SLUG_TO_TIMEZONE[lower];
    const byId = getCityById(lower);
    if (byId) return byId.timeZone;
    return t;
  });

  return timezones.length > 0 ? timezones : null;
}

/**
 * Extract raw city tokens from a compact meeting path (/m/sfo+lon+bom -> ['sfo', 'lon', 'bom'])
 * or query string (?c=sfo,lon,bom -> ['sfo', 'lon', 'bom']).
 *
 * @param {string} pathname
 * @param {string} search
 * @returns {string[]}
 */
export function extractCityTokensFromUrl(pathname = '', search = '') {
  const compactMatch = pathname && pathname.match(/^\/?m\/([a-z0-9+_-]+)\/?$/i);
  if (compactMatch) {
    return compactMatch[1].split('+').map((t) => t.trim()).filter(Boolean);
  }

  if (search) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const raw = params.get('c') || params.get('cities');
    if (raw) {
      return raw.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  return [];
}

/**
 * Generate full shareable meeting URL.
 * 
 * @param {string} origin - Base URL (e.g. "https://timerows.com")
 * @param {Object} state - State to serialize
 * @returns {string} Full URL
 */
export function generateShareUrl(origin = 'https://timerows.com', state) {
  const query = serializeShareQuery(state);
  const base = origin.replace(/\/+$/, '');
  return query ? `${base}/?${query}` : base;
}

/**
 * Generate ultra-short PLG meeting link (e.g. "https://timerows.com/m/sfo+lon+tyo").
 *
 * @param {string} origin
 * @param {Array<Object|string>} cities
 * @returns {string}
 */
export function generateCompactShareUrl(origin = 'https://timerows.com', cities = []) {
  const base = origin.replace(/\/+$/, '');
  if (!cities || cities.length === 0) return base;
  const tokens = cities.map((c) => getCityUrlToken(c)).filter(Boolean);
  return `${base}/m/${tokens.join('+')}`;
}
