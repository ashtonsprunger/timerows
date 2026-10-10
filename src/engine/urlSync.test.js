import {
  slugify,
  unslugify,
  parseCityPairPath,
  buildCityPairPath,
  serializeShareQuery,
  deserializeShareQuery,
  parseCompactMeetingPath,
  generateShareUrl,
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
      const queryString = '?c=nyc,lon,tyo&d=2026-10-10&ref=nyc&slot=14';
      const state = deserializeShareQuery(queryString);

      expect(state.timezones).toEqual([
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
      ]);
      expect(state.date).toBe('2026-10-10');
      expect(state.referenceTimezone).toBe('America/New_York');
      expect(state.selectedSlotIndex).toBe(14);
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

  describe('generateShareUrl', () => {
    test('generates full clean URL with query parameters', () => {
      const url = generateShareUrl('https://www.timerows.com', {
        cities: ['America/New_York', 'Europe/London'],
        date: '2026-10-10',
      });

      expect(url).toContain('https://www.timerows.com/?c=nyc%2Clon&d=2026-10-10');
    });

    test('handles trailing slashes on origin', () => {
      const url = generateShareUrl('https://www.timerows.com/', {
        cities: ['America/New_York'],
      });

      expect(url).toBe('https://www.timerows.com/?c=nyc');
    });
  });
});
