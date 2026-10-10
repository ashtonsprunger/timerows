/**
 * TimeRows - URL Sync & State Serializer Engine
 * 
 * Bidirectional URL slug and share-state serializer.
 * Supports:
 * - Share links: /m/nyc+lon+tyo or ?cities=America/New_York,Europe/London&date=YYYY-MM-DD
 * - Programmatic SEO city-pairs: /from/:cityA/to/:cityB
 * Zero React dependencies.
 */

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
  tor: 'America/Toronto',
  ams: 'Europe/Amsterdam',
  fra: 'Europe/Berlin',
  utc: 'UTC',
});

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
 * Parse programmatic SEO city-pair routes (/from/:cityA/to/:cityB).
 * 
 * @param {string} pathname - URL pathname
 * @returns {{ fromSlug: string, toSlug: string, fromName: string, toName: string } | null}
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
 * Serializes application share state into query parameters or a short path.
 * 
 * @param {Object} state
 * @param {Array<{ id?: string, timeZone: string }|string>} state.cities - Array of timezone strings or city objects
 * @param {string} [state.date] - Reference date 'YYYY-MM-DD'
 * @param {number} [state.selectedSlotIndex] - Currently highlighted/selected slot column
 * @param {string} [state.referenceTimezone] - Primary reference timezone
 * @returns {string} Query string without leading '?' (e.g. "c=nyc,lon,tyo&d=2026-10-10")
 */
export function serializeShareQuery(state) {
  if (!state || !state.cities || !Array.isArray(state.cities) || state.cities.length === 0) {
    return '';
  }

  const params = new URLSearchParams();

  // Compress timezones: use short slugs if known, or raw IANA identifiers
  const cityTokens = state.cities.map((city) => {
    const tz = typeof city === 'string' ? city : city.timeZone;
    return TIMEZONE_TO_SLUG[tz] || tz;
  });

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
  }

  return params.toString();
}

/**
 * Deserializes URL query parameters back into an application state object.
 * 
 * @param {string|URLSearchParams} search - Query string or URLSearchParams instance
 * @returns {{
 *   timezones: string[],
 *   date: string | null,
 *   referenceTimezone: string | null,
 *   selectedSlotIndex: number | null
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
    result.timezones = rawCities
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => SLUG_TO_TIMEZONE[token.toLowerCase()] || token);
  }

  const rawDate = params.get('d') || params.get('date');
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    result.date = rawDate;
  }

  const rawRef = params.get('ref');
  if (rawRef) {
    result.referenceTimezone = SLUG_TO_TIMEZONE[rawRef.toLowerCase()] || rawRef;
  }

  const rawSlot = params.get('slot');
  if (rawSlot !== null && !isNaN(Number(rawSlot))) {
    result.selectedSlotIndex = parseInt(rawSlot, 10);
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
  const timezones = tokens.map((t) => SLUG_TO_TIMEZONE[t.toLowerCase()] || t);

  return timezones.length > 0 ? timezones : null;
}

/**
 * Generate full shareable meeting URL.
 * 
 * @param {string} origin - Base URL (e.g. "https://www.timerows.com")
 * @param {Object} state - State to serialize
 * @returns {string} Full URL
 */
export function generateShareUrl(origin = 'https://www.timerows.com', state) {
  const query = serializeShareQuery(state);
  const base = origin.replace(/\/+$/, '');
  return query ? `${base}/?${query}` : base;
}
