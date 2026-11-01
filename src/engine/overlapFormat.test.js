import {
  compactTimeStr,
  formatSmartTimeSpan,
  groupCitySummariesByTime,
  pickAlternativeWindow,
  getReferenceSummary,
} from './overlapFormat.js';

describe('overlapFormat', () => {
  describe('compactTimeStr', () => {
    test('drops :00 and lowercases 12h strings', () => {
      expect(compactTimeStr('8:00 AM')).toBe('8 am');
      expect(compactTimeStr('12:00 PM')).toBe('12 pm');
    });

    test('keeps non-zero minutes', () => {
      expect(compactTimeStr('9:30 AM')).toBe('9:30 am');
    });

    test('returns 24h strings untouched', () => {
      expect(compactTimeStr('08:00', true)).toBe('08:00');
    });

    test('handles empty input', () => {
      expect(compactTimeStr('')).toBe('');
      expect(compactTimeStr(undefined)).toBe('');
    });
  });

  describe('formatSmartTimeSpan', () => {
    test('collapses a shared meridiem when end is later in the same half-day', () => {
      expect(formatSmartTimeSpan('12:00 PM', '5:00 PM')).toBe('12–5 pm');
      expect(formatSmartTimeSpan('8:00 AM', '11:30 AM')).toBe('8–11:30 am');
    });

    test('keeps both meridiems when they differ', () => {
      expect(formatSmartTimeSpan('8:00 AM', '1:00 PM')).toBe('8 am–1 pm');
    });

    test('never collapses shared meridiem when span wraps across midnight into the next day', () => {
      expect(formatSmartTimeSpan('7:30 AM', '1:30 AM')).toBe('7:30 am–1:30 am');
      expect(formatSmartTimeSpan('9:00 AM', '9:00 AM')).toBe('9 am–9 am');
      expect(formatSmartTimeSpan('2:00 PM', '12:00 PM')).toBe('2 pm–12 pm');
    });

    test('formats 24h spans verbatim', () => {
      expect(formatSmartTimeSpan('08:00', '13:00', true)).toBe('08:00–13:00');
    });
  });

  describe('groupCitySummariesByTime', () => {
    const summaries = [
      { cityId: 'nyc', cityName: 'New York', startTime: '8:00 AM', endTime: '1:00 PM', startTime24: '08:00', endTime24: '13:00' },
      { cityId: 'lon', cityName: 'London', startTime: '12:00 PM', endTime: '5:00 PM', startTime24: '12:00', endTime24: '17:00' },
      { cityId: 'utc', cityName: 'UTC / GMT', startTime: '12:00 PM', endTime: '5:00 PM', startTime24: '12:00', endTime24: '17:00' },
    ];

    test('merges cities that share an identical local span', () => {
      expect(groupCitySummariesByTime(summaries)).toEqual([
        { spanStr: '8 am–1 pm', cities: ['New York'] },
        { spanStr: '12–5 pm', cities: ['London', 'UTC'] },
      ]);
    });

    test('appends (+1d) when endDayDelta indicates the window crosses midnight locally', () => {
      const overnightSummaries = [
        {
          cityId: 'nyc',
          cityName: 'New York',
          startTime: '3:30 AM',
          endTime: '9:30 PM',
          startTime24: '03:30',
          endTime24: '21:30',
          endDayDelta: 0,
        },
        {
          cityId: 'utc',
          cityName: 'UTC',
          startTime: '7:30 AM',
          endTime: '1:30 AM',
          startTime24: '07:30',
          endTime24: '01:30',
          endDayDelta: 1,
        },
        {
          cityId: 'lon',
          cityName: 'London',
          startTime: '7:30 AM',
          endTime: '1:30 AM',
          startTime24: '07:30',
          endTime24: '01:30',
          endDayDelta: 1,
        },
      ];

      expect(groupCitySummariesByTime(overnightSummaries)).toEqual([
        { spanStr: '3:30 am–9:30 pm', cities: ['New York'] },
        { spanStr: '7:30 am–1:30 am (+1d)', cities: ['UTC', 'London'] },
      ]);
    });

    test('supports 24h output', () => {
      const groups = groupCitySummariesByTime(summaries, true);
      expect(groups[1]).toEqual({ spanStr: '12:00–17:00', cities: ['London', 'UTC'] });
    });

    test('returns an empty array for missing input', () => {
      expect(groupCitySummariesByTime()).toEqual([]);
    });
  });

  describe('pickAlternativeWindow', () => {
    const primary = { startIndex: 8, endIndex: 12, quality: 'golden' };

    test('rejects windows that are directly adjacent to the primary window', () => {
      const adjacentBefore = { startIndex: 7, endIndex: 7, quality: 'good' };
      const adjacentAfter = { startIndex: 13, endIndex: 13, quality: 'good' };
      expect(pickAlternativeWindow(primary, [adjacentBefore, adjacentAfter])).toBeNull();
    });

    test('rejects windows that overlap the primary window', () => {
      const subset = { startIndex: 10, endIndex: 12, quality: 'golden' };
      expect(pickAlternativeWindow(primary, [subset])).toBeNull();
    });

    test('rejects compromise and poor windows even when separated', () => {
      const compromise = { startIndex: 16, endIndex: 17, quality: 'compromise' };
      const poor = { startIndex: 20, endIndex: 21, quality: 'poor' };
      expect(pickAlternativeWindow(primary, [compromise, poor])).toBeNull();
    });

    test('accepts a separated golden or good window', () => {
      const separate = { startIndex: 15, endIndex: 16, quality: 'good' };
      expect(pickAlternativeWindow(primary, [separate])).toBe(separate);
    });

    test('respects a custom minimum gap', () => {
      const oneHourGap = { startIndex: 14, endIndex: 15, quality: 'golden' };
      expect(pickAlternativeWindow(primary, [oneHourGap])).toBe(oneHourGap);
      expect(pickAlternativeWindow(primary, [oneHourGap], { minGapHours: 2 })).toBeNull();
    });

    test('returns null without a primary window', () => {
      expect(pickAlternativeWindow(null, [{ startIndex: 1, endIndex: 2, quality: 'golden' }])).toBeNull();
    });
  });

  describe('getReferenceSummary', () => {
    const win = {
      citySummaries: [
        { cityId: 'lon', cityName: 'London' },
        { cityId: 'nyc', cityName: 'New York' },
      ],
    };

    test('returns the summary for the reference city', () => {
      expect(getReferenceSummary(win, 'nyc').cityName).toBe('New York');
    });

    test('falls back to the first summary', () => {
      expect(getReferenceSummary(win, 'tyo').cityName).toBe('London');
    });

    test('returns null for an empty window', () => {
      expect(getReferenceSummary(null, 'nyc')).toBeNull();
    });
  });
});
