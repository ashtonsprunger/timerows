import {
  normalizeText,
  levenshteinDistance,
  searchCities,
  getCityById,
  findCitiesByTimezone,
  findPrimaryCityForTimezone,
} from './citySearch.js';

describe('citySearch Engine', () => {
  describe('normalizeText', () => {
    test('removes diacritics and converts to lowercase', () => {
      expect(normalizeText('São Paulo')).toBe('sao paulo');
      expect(normalizeText('Zürich')).toBe('zurich');
      expect(normalizeText('München')).toBe('munchen');
      expect(normalizeText('Montréal')).toBe('montreal');
      expect(normalizeText('  TOKYO  ')).toBe('tokyo');
      expect(normalizeText('')).toBe('');
      expect(normalizeText(null)).toBe('');
    });
  });

  describe('levenshteinDistance', () => {
    test('computes accurate edit distances', () => {
      expect(levenshteinDistance('tokyo', 'tokyo')).toBe(0);
      expect(levenshteinDistance('tokyo', 'tokio')).toBe(1);
      expect(levenshteinDistance('paris', 'priss')).toBe(2);
      expect(levenshteinDistance('', 'abc')).toBe(3);
    });
  });

  describe('searchCities', () => {
    test('finds exact name matches with highest ranking', () => {
      const results = searchCities('Tokyo');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Tokyo');
      expect(results[0].country).toBe('Japan');
    });

    test('finds cities by common alias (NYC, SF, BLR, BOM)', () => {
      const nycResults = searchCities('NYC');
      expect(nycResults[0].name).toBe('New York');

      const sfResults = searchCities('SF');
      expect(sfResults[0].name).toBe('San Francisco');

      const blrResults = searchCities('BLR');
      expect(blrResults[0].name).toBe('Bengaluru');

      const bomResults = searchCities('BOM');
      expect(bomResults[0].name).toBe('Mumbai');
    });

    test('prioritizes major global metropolis over smaller homonyms by population', () => {
      // London, UK (8.9M pop) must rank higher than London, Canada (422k pop)
      const results = searchCities('London');
      expect(results[0].name).toBe('London');
      expect(results[0].country).toBe('United Kingdom');
      expect(results[0].timeZone).toBe('Europe/London');

      // The second result can be London, Canada
      const canadaLondon = results.find((c) => c.country === 'Canada');
      expect(canadaLondon).toBeDefined();
    });

    test('handles prefix searches ("Lon", "San", "Tok")', () => {
      const lonResults = searchCities('Lon');
      expect(lonResults[0].name).toBe('London');

      const tokResults = searchCities('Tok');
      expect(tokResults[0].name).toBe('Tokyo');
    });

    test('handles typo tolerance ("Tokio" -> Tokyo, "Singapor" -> Singapore)', () => {
      const tokioResults = searchCities('Tokio');
      expect(tokioResults.some((c) => c.name === 'Tokyo')).toBe(true);

      const singaporResults = searchCities('Singapor');
      expect(singaporResults.some((c) => c.name === 'Singapore')).toBe(true);
    });

    test('searches by country name ("Japan", "Australia", "Germany")', () => {
      const japanResults = searchCities('Japan');
      expect(japanResults.some((c) => c.name === 'Tokyo')).toBe(true);
      expect(japanResults.some((c) => c.name === 'Osaka')).toBe(true);

      const ausResults = searchCities('Australia');
      expect(ausResults.some((c) => c.name === 'Sydney')).toBe(true);
      expect(ausResults.some((c) => c.name === 'Melbourne')).toBe(true);
    });

    test('searches by state or region ("California", "Texas")', () => {
      const calResults = searchCities('California');
      expect(calResults.some((c) => c.name === 'Los Angeles')).toBe(true);
      expect(calResults.some((c) => c.name === 'San Francisco')).toBe(true);
    });

    test('searches by timezone identifier ("America/New_York", "Asia/Kolkata")', () => {
      const nyTz = searchCities('America/New_York');
      expect(nyTz.some((c) => c.name === 'New York')).toBe(true);

      const kolkataTz = searchCities('Asia/Kolkata');
      expect(kolkataTz.some((c) => c.name === 'Mumbai' || c.name === 'Bengaluru')).toBe(true);
    });

    test('returns top global hubs by population when query is empty', () => {
      const topCities = searchCities('');
      expect(topCities.length).toBe(10);
      // Top populations should include mega-cities like Shanghai, Tokyo, Beijing, etc.
      expect(topCities[0].population).toBeGreaterThan(10000000);
    });

    test('respects limit and countryFilter options', () => {
      const limited = searchCities('a', { limit: 3 });
      expect(limited.length).toBe(3);

      const usOnly = searchCities('San', { countryFilter: 'US' });
      usOnly.forEach((city) => {
        expect(city.countryCode).toBe('US');
      });
    });
  });

  describe('Lookup & Index Helpers', () => {
    test('getCityById returns city object or null for invalid ID', () => {
      const nyc = getCityById('new-york-us');
      expect(nyc).toBeDefined();
      expect(nyc.name).toBe('New York');
      expect(nyc.timeZone).toBe('America/New_York');

      expect(getCityById('non-existent-id')).toBeNull();
    });

    test('findCitiesByTimezone returns all cities mapped to that zone', () => {
      const nyCities = findCitiesByTimezone('America/New_York');
      expect(nyCities.length).toBeGreaterThan(1);
      expect(nyCities.some((c) => c.name === 'New York')).toBe(true);
      expect(nyCities.some((c) => c.name === 'Boston')).toBe(true);
    });

    test('findPrimaryCityForTimezone selects highest population city in timezone', () => {
      const primaryNy = findPrimaryCityForTimezone('America/New_York');
      expect(primaryNy.name).toBe('New York');

      const primaryUk = findPrimaryCityForTimezone('Europe/London');
      expect(primaryUk.name).toBe('London');

      const primaryJapan = findPrimaryCityForTimezone('Asia/Tokyo');
      expect(primaryJapan.name).toBe('Tokyo');

      expect(findPrimaryCityForTimezone('Invalid/Zone')).toBeNull();
    });
  });
});
