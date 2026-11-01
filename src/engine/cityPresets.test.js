import { isSameCitySet } from './cityPresets.js';

describe('cityPresets', () => {
  describe('isSameCitySet', () => {
    const preset = [
      { name: 'New York', timeZone: 'America/New_York' },
      { name: 'London', timeZone: 'Europe/London' },
      { name: 'UTC', timeZone: 'UTC' },
    ];

    test('matches the same cities in the same order', () => {
      expect(isSameCitySet(preset, preset)).toBe(true);
    });

    test('matches the same cities in a different order', () => {
      const reordered = [preset[0], preset[2], preset[1]];
      expect(isSameCitySet(reordered, preset)).toBe(true);
    });

    test('ignores extra fields such as ids, isPrimary, and custom work hours', () => {
      const pinned = [
        { id: 'x', name: 'London', timeZone: 'Europe/London', workingHours: { start: 8, end: 16 } },
        { id: 'y', name: 'UTC / GMT', timeZone: 'UTC' },
        { id: 'z', name: 'New York', timeZone: 'America/New_York', isPrimary: true },
      ];
      expect(isSameCitySet(pinned, preset)).toBe(true);
    });

    test('rejects a different number of cities', () => {
      expect(isSameCitySet(preset.slice(0, 2), preset)).toBe(false);
    });

    test('rejects a different city set of the same size', () => {
      const other = [preset[0], preset[1], { name: 'Tokyo', timeZone: 'Asia/Tokyo' }];
      expect(isSameCitySet(other, preset)).toBe(false);
    });

    test('treats duplicate timezones as a multiset', () => {
      const a = [
        { timeZone: 'America/New_York' },
        { timeZone: 'America/New_York' },
        { timeZone: 'UTC' },
      ];
      const b = [
        { timeZone: 'America/New_York' },
        { timeZone: 'UTC' },
        { timeZone: 'UTC' },
      ];
      expect(isSameCitySet(a, b)).toBe(false);
    });

    test('handles empty or missing input', () => {
      expect(isSameCitySet([], [])).toBe(false);
      expect(isSameCitySet(null, preset)).toBe(false);
      expect(isSameCitySet(preset, undefined)).toBe(false);
    });
  });
});
