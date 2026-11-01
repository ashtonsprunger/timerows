import {
  slugify,
  unslugify,
  parseCityPairPath,
  buildCityPairPath,
  serializeShareQuery,
  deserializeShareQuery,
  parseCompactMeetingPath,
  generateShareUrl,
  generateCompactShareUrl,
  resolveCityFromToken,
  getCityUrlToken,
  extractCityTokensFromUrl,
  SLUG_TO_TIMEZONE,
} from './urlSync.js';

describe('urlSync', () => {
  describe('slugify & unslugify', () => {
    test('converts strings into clean URL-safe slugs', () => {
      expect(slugify('San Francisco')).toBe('san-francisco');
      expect(slugify('New York City')).toBe('new-york-city');
      expect(slugify('São Paulo')).toBe('sao-paulo');
      expect(slugify('London / UK')).toBe('london-uk');
      expect(slugify('   Tokyo   ')).toBe('tokyo');
      expect(slugify('')).toBe('');
      expect(slugify(null)).toBe('');
    });

    test('reverts slugs back to title case strings', () => {
      expect(unslugify('san-francisco')).toBe('San Francisco');
      expect(unslugify('london')).toBe('London');
      expect(unslugify('new-york')).toBe('New York');
      expect(unslugify('')).toBe('');
      expect(unslugify(null)).toBe('');
    });
  });

  describe('Programmatic SEO City-Pair Routes (/from/:cityA/to/:cityB)', () => {
    test('builds city-pair routes', () => {
      expect(buildCityPairPath('San Francisco', 'London')).toBe('/from/san-francisco/to/london');
      expect(buildCityPairPath('New York', 'Tokyo')).toBe('/from/new-york/to/tokyo');
      expect(buildCityPairPath('', 'London')).toBe('/');
    });

    test('parses city-pair pathnames correctly', () => {
      const parsed = parseCityPairPath('/from/san-francisco/to/london');
      expect(parsed).toEqual({
        fromSlug: 'san-francisco',
        toSlug: 'london',
        fromName: 'San Francisco',
        toName: 'London',
      });

      // Trailing slash
      const parsedWithSlash = parseCityPairPath('/from/new-york/to/tokyo/');
      expect(parsedWithSlash?.fromName).toBe('New York');
      expect(parsedWithSlash?.toName).toBe('Tokyo');

      // Invalid paths
      expect(parseCityPairPath('/about')).toBeNull();
      expect(parseCityPairPath('')).toBeNull();
      expect(parseCityPairPath(null)).toBeNull();
    });
  });

  describe('Share Query Serialization & Deserialization', () => {
    test('serializes state using short slugs when available', () => {
      const state = {
        cities: [
          { timeZone: 'America/New_York' },
          { timeZone: 'Europe/London' },
          { timeZone: 'Asia/Tokyo' },
        ],
        date: '2026-10-10',
        referenceTimezone: 'America/New_York',
        selectedSlotIndex: 14,
      };

      const query = serializeShareQuery(state);
      expect(query).toContain('c=nyc%2Clon%2Ctyo');
      expect(query).toContain('d=2026-10-10');
      expect(query).toContain('ref=nyc');
      expect(query).toContain('slot=14');
    });

    test('deserializes query back to timezone list and state parameters', () => {
      const queryString = '?c=nyc,lon,tyo&d=2026-10-10&ref=nyc&slot=14&end=16';
      const state = deserializeShareQuery(queryString);

      expect(state.timezones).toEqual([
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
      ]);
      expect(state.date).toBe('2026-10-10');
      expect(state.referenceTimezone).toBe('America/New_York');
      expect(state.selectedSlotIndex).toBe(14);
      expect(state.selectedEndSlotIndex).toBe(16);
    });

    test('supports unmapped raw IANA timezones', () => {
      const rawQuery = 'c=Pacific%2FAuckland,America%2FDenver';
      const state = deserializeShareQuery(rawQuery);

      expect(state.timezones).toEqual([
        'Pacific/Auckland',
        'America/Denver',
      ]);
    });

    test('handles empty or missing query inputs gracefully', () => {
      expect(serializeShareQuery(null)).toBe('');
      expect(serializeShareQuery({ cities: [] })).toBe('');

      expect(deserializeShareQuery('')).toEqual({
        timezones: [],
        date: null,
        referenceTimezone: null,
        selectedSlotIndex: null,
      });
      expect(deserializeShareQuery(null)).toEqual({
        timezones: [],
        date: null,
        referenceTimezone: null,
        selectedSlotIndex: null,
      });
    });
  });

  describe('Compact Meeting Path (/m/nyc+lon+tyo)', () => {
    test('parses compact meeting paths', () => {
      const tzs = parseCompactMeetingPath('/m/nyc+lon+tyo');
      expect(tzs).toEqual([
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
      ]);
    });

    test('returns null for non-compact meeting paths', () => {
      expect(parseCompactMeetingPath('/not-a-meeting')).toBeNull();
      expect(parseCompactMeetingPath('')).toBeNull();
      expect(parseCompactMeetingPath(null)).toBeNull();
    });
  });

  describe('City Identity Resolution & Compact URLs', () => {
    test('resolves distinct cities within the same timezone (San Francisco vs Los Angeles, Mumbai vs Bengaluru)', () => {
      const sfo = resolveCityFromToken('sfo');
      expect(sfo.name).toBe('San Francisco');
      expect(sfo.timeZone).toBe('America/Los_Angeles');

      const lax = resolveCityFromToken('lax');
      expect(lax.name).toBe('Los Angeles');
      expect(lax.timeZone).toBe('America/Los_Angeles');

      const bom = resolveCityFromToken('bom');
      expect(bom.name).toBe('Mumbai');
      expect(bom.timeZone).toBe('Asia/Kolkata');

      const blr = resolveCityFromToken('blr');
      expect(blr.name).toBe('Bengaluru');
      expect(blr.timeZone).toBe('Asia/Kolkata');

      const seoLondon = resolveCityFromToken('london');
      expect(seoLondon.name).toBe('London');
      expect(seoLondon.timeZone).toBe('Europe/London');

      const stJohns = resolveCityFromToken(slugify("St. John's"));
      expect(stJohns).not.toBeNull();
      expect(stJohns.name).toBe("St. John's");
      expect(stJohns.timeZone).toBe('America/St_Johns');

      const saoPaulo = resolveCityFromToken('sao-paulo-br');
      expect(saoPaulo.name).toBe('São Paulo');
      expect(getCityUrlToken(saoPaulo)).toBe('gru');
    });

    test('generates compact share URL preserving city tokens', () => {
      const cities = [
        { id: 'san-francisco-us', name: 'San Francisco', timeZone: 'America/Los_Angeles' },
        { id: 'london-gb', name: 'London', timeZone: 'Europe/London' },
        { id: 'mumbai-in', name: 'Mumbai', timeZone: 'Asia/Kolkata' },
      ];
      expect(generateCompactShareUrl('https://timerows.com', cities)).toBe(
        'https://timerows.com/m/sfo+lon+bom'
      );
      expect(extractCityTokensFromUrl('/m/sfo+lon+bom', '')).toEqual(['sfo', 'lon', 'bom']);
      expect(getCityUrlToken(cities[0])).toBe('sfo');
    });
  });

  describe('generateShareUrl', () => {
    test('generates full clean URL with query parameters', () => {
      const url = generateShareUrl('https://timerows.com', {
        cities: ['America/New_York', 'Europe/London'],
        date: '2026-10-10',
      });

      expect(url).toContain('https://timerows.com/?c=nyc%2Clon&d=2026-10-10');
    });

    test('handles trailing slashes on origin', () => {
      const url = generateShareUrl('https://timerows.com/', {
        cities: ['America/New_York'],
      });

      expect(url).toBe('https://timerows.com/?c=nyc');
    });

    test('serializes and deserializes custom workingHours (wh) parameter', () => {
      const query = serializeShareQuery({
        cities: ['America/New_York', 'Europe/London'],
        workingHours: { start: 8, end: 17 },
      });
      expect(query).toContain('wh=8-17');

      const parsed = deserializeShareQuery(query);
      expect(parsed.workingHours).toEqual({ start: 8, end: 17 });
    });
  });
});
