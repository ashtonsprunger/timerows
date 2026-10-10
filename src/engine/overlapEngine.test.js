import {
  evaluateColumnOverlap,
  calculateTimelineOverlaps,
  findBestMeetingWindows,
  formatSlackSnippet,
  formatCompactMeetingSummary,
  getPairwiseOverlapMetrics,
  OVERLAP_QUALITY,
} from './overlapEngine.js';
import { generateCityRowSlots, generateDayIntervals } from './timezoneEngine.js';

describe('overlapEngine', () => {
  describe('evaluateColumnOverlap', () => {
    test('identifies a Golden Overlap when all cities are in working hours', () => {
      const mockSlots = [
        {
          cityId: 'nyc',
          cityName: 'New York',
          timeZone: 'America/New_York',
          phase: 'work',
          isWorkingHour: true,
          formattedTime12: '10:00 AM',
          timestamp: 1791561600000,
        },
        {
          cityId: 'lon',
          cityName: 'London',
          timeZone: 'Europe/London',
          phase: 'work',
          isWorkingHour: true,
          formattedTime12: '3:00 PM',
          timestamp: 1791561600000,
        },
      ];

      const evaluated = evaluateColumnOverlap(mockSlots, 10);
      expect(evaluated.isGolden).toBe(true);
      expect(evaluated.isViable).toBe(true);
      expect(evaluated.quality).toBe(OVERLAP_QUALITY.GOLDEN);
      expect(evaluated.workingCount).toBe(2);
      expect(evaluated.sleepCount).toBe(0);
      expect(evaluated.score).toBe(100);
    });

    test('identifies Good Overlap when all are awake and majority working', () => {
      const mockSlots = [
        { cityId: 'c1', phase: 'work', isWorkingHour: true },
        { cityId: 'c2', phase: 'work', isWorkingHour: true },
        { cityId: 'c3', phase: 'awake', isWorkingHour: false },
      ];

      const evaluated = evaluateColumnOverlap(mockSlots, 5);
      expect(evaluated.isGolden).toBe(false);
      expect(evaluated.isViable).toBe(true);
      expect(evaluated.quality).toBe(OVERLAP_QUALITY.GOOD);
      expect(evaluated.workingCount).toBe(2);
      expect(evaluated.awakeCount).toBe(1);
      expect(evaluated.sleepCount).toBe(0);
      expect(evaluated.score).toBeGreaterThan(60);
    });

    test('identifies Compromise Overlap when all awake but less than half working', () => {
      const mockSlots = [
        { cityId: 'c1', phase: 'work', isWorkingHour: true },
        { cityId: 'c2', phase: 'awake', isWorkingHour: false },
        { cityId: 'c3', phase: 'awake', isWorkingHour: false },
      ];

      const evaluated = evaluateColumnOverlap(mockSlots, 7);
      expect(evaluated.isGolden).toBe(false);
      expect(evaluated.isViable).toBe(true);
      expect(evaluated.quality).toBe(OVERLAP_QUALITY.COMPROMISE);
      expect(evaluated.workingCount).toBe(1);
      expect(evaluated.awakeCount).toBe(2);
    });

    test('marks column as Poor / non-viable when any city is sleeping', () => {
      const mockSlots = [
        { cityId: 'c1', phase: 'work', isWorkingHour: true },
        { cityId: 'c2', phase: 'sleep', isWorkingHour: false, isSleepHour: true },
      ];

      const evaluated = evaluateColumnOverlap(mockSlots, 2);
      expect(evaluated.isGolden).toBe(false);
      expect(evaluated.isViable).toBe(false);
      expect(evaluated.quality).toBe(OVERLAP_QUALITY.POOR);
      expect(evaluated.sleepCount).toBe(1);
      expect(evaluated.score).toBeLessThanOrEqual(20);
    });

    test('handles empty or missing column slots gracefully', () => {
      const evaluated = evaluateColumnOverlap([], 0);
      expect(evaluated.totalCities).toBe(0);
      expect(evaluated.isGolden).toBe(false);
      expect(evaluated.isViable).toBe(false);
      expect(evaluated.score).toBe(0);
    });
  });

  describe('calculateTimelineOverlaps', () => {
    test('computes timeline overlaps for New York and London over 24 hours', () => {
      const refDate = '2026-10-10';
      const refTz = 'America/New_York';
      const timestamps = generateDayIntervals(refDate, refTz);

      const nySlots = generateCityRowSlots({
        targetTimezone: 'America/New_York',
        timestamps,
        referenceDate: refDate,
      });

      const londonSlots = generateCityRowSlots({
        targetTimezone: 'Europe/London',
        timestamps,
        referenceDate: refDate,
      });

      const cityRows = [
        { id: 'nyc', name: 'New York', timeZone: 'America/New_York', slots: nySlots },
        { id: 'lon', name: 'London', timeZone: 'Europe/London', slots: londonSlots },
      ];

      const evaluatedColumns = calculateTimelineOverlaps(cityRows);
      expect(evaluatedColumns.length).toBe(24);

      // In NY: 9:00 AM is index 9 (London is 2:00 PM / 14:00 BST) -> both in [9, 17] working hours
      const slot9 = evaluatedColumns[9];
      expect(slot9.isGolden).toBe(true);
      expect(slot9.quality).toBe(OVERLAP_QUALITY.GOLDEN);
      expect(slot9.workingCount).toBe(2);

      // In NY: 10:00 AM (idx 10), 11:00 AM (idx 11) should also be golden
      expect(evaluatedColumns[10].isGolden).toBe(true);
      expect(evaluatedColumns[11].isGolden).toBe(true);

      // In NY: 12:00 PM (idx 12), London is 17:00 (5 PM), which transitions to off-hours/awake
      expect(evaluatedColumns[12].isGolden).toBe(false);
      expect(evaluatedColumns[12].isViable).toBe(true);
      expect(evaluatedColumns[12].quality).toBe(OVERLAP_QUALITY.GOOD);

      // In NY: 3:00 AM (idx 3), NY is sleeping -> poor
      expect(evaluatedColumns[3].isViable).toBe(false);
      expect(evaluatedColumns[3].quality).toBe(OVERLAP_QUALITY.POOR);
    });

    test('supports raw 2D array of slots', () => {
      const slotsA = [
        { timeZone: 'UTC', phase: 'work', isWorkingHour: true, timestamp: 1000 },
        { timeZone: 'UTC', phase: 'sleep', isWorkingHour: false, timestamp: 2000 },
      ];
      const slotsB = [
        { timeZone: 'UTC', phase: 'work', isWorkingHour: true, timestamp: 1000 },
        { timeZone: 'UTC', phase: 'work', isWorkingHour: true, timestamp: 2000 },
      ];

      const evaluated = calculateTimelineOverlaps([slotsA, slotsB]);
      expect(evaluated.length).toBe(2);
      expect(evaluated[0].isGolden).toBe(true);
      expect(evaluated[1].isViable).toBe(false);
    });
  });

  describe('findBestMeetingWindows', () => {
    test('identifies and ranks top meeting windows for New York + London', () => {
      const refDate = '2026-10-10';
      const refTz = 'America/New_York';
      const timestamps = generateDayIntervals(refDate, refTz);

      const nySlots = generateCityRowSlots({
        targetTimezone: 'America/New_York',
        timestamps,
        referenceDate: refDate,
      });

      const lonSlots = generateCityRowSlots({
        targetTimezone: 'Europe/London',
        timestamps,
        referenceDate: refDate,
      });

      const cityRows = [
        { id: 'nyc', name: 'New York', timeZone: 'America/New_York', slots: nySlots },
        { id: 'lon', name: 'London', timeZone: 'Europe/London', slots: lonSlots },
      ];

      const timeline = calculateTimelineOverlaps(cityRows);
      const windows = findBestMeetingWindows(timeline, { maxResults: 3, minDurationHours: 1 });

      expect(windows.length).toBeGreaterThan(0);
      expect(windows.length).toBeLessThanOrEqual(3);

      // Best window should be Golden quality
      const topWindow = windows[0];
      expect(topWindow.quality).toBe(OVERLAP_QUALITY.GOLDEN);
      expect(topWindow.rank).toBe(1);

      // Verify that the window contains valid start/end times in citySummaries
      expect(topWindow.citySummaries.length).toBe(2);
      const nySummary = topWindow.citySummaries.find((c) => c.cityName === 'New York');
      const lonSummary = topWindow.citySummaries.find((c) => c.cityName === 'London');

      expect(nySummary).toBeDefined();
      expect(lonSummary).toBeDefined();
      expect(nySummary.isWorkingHours).toBe(true);
      expect(lonSummary.isWorkingHours).toBe(true);
    });

    test('supports targetDurationHours filter (e.g. exactly 2-hour meetings)', () => {
      const refDate = '2026-10-10';
      const timestamps = generateDayIntervals(refDate, 'America/New_York');

      const nySlots = generateCityRowSlots({
        targetTimezone: 'America/New_York',
        timestamps,
        referenceDate: refDate,
      });

      const lonSlots = generateCityRowSlots({
        targetTimezone: 'Europe/London',
        timestamps,
        referenceDate: refDate,
      });

      const timeline = calculateTimelineOverlaps([
        { name: 'New York', slots: nySlots },
        { name: 'London', slots: lonSlots },
      ]);

      const windows = findBestMeetingWindows(timeline, { targetDurationHours: 2, maxResults: 3 });

      windows.forEach((win) => {
        expect(win.durationHours).toBe(2);
      });
    });

    test('never recommends a meeting window where someone is sleeping', () => {
      // Create artificial timeline where Tokyo is asleep during New York work hours
      const refDate = '2026-10-10';
      const timestamps = generateDayIntervals(refDate, 'America/New_York');

      const nySlots = generateCityRowSlots({
        targetTimezone: 'America/New_York',
        timestamps,
        referenceDate: refDate,
      });

      const tokyoSlots = generateCityRowSlots({
        targetTimezone: 'Asia/Tokyo',
        timestamps,
        referenceDate: refDate,
      });

      const timeline = calculateTimelineOverlaps([
        { name: 'New York', slots: nySlots },
        { name: 'Tokyo', slots: tokyoSlots },
      ]);

      const windows = findBestMeetingWindows(timeline, { maxResults: 5 });

      // Every returned window must have viable slots (no sleep)
      windows.forEach((win) => {
        const slotsInWindow = timeline.slice(win.startIndex, win.endIndex + 1);
        slotsInWindow.forEach((slot) => {
          expect(slot.isViable).toBe(true);
          expect(slot.sleepCount).toBe(0);
        });
      });
    });
  });

  describe('Meeting Formatting & Slack Export', () => {
    test('formatSlackSnippet generates clean markdown formatted text', () => {
      const mockWindow = {
        durationHours: 2,
        citySummaries: [
          { cityName: 'New York', startTime: '10:00 AM', endTime: '12:00 PM', dayRollover: '' },
          { cityName: 'London', startTime: '3:00 PM', endTime: '5:00 PM', dayRollover: '' },
          { cityName: 'Tokyo', startTime: '11:00 PM', endTime: '1:00 AM', dayRollover: '+1 Day' },
        ],
      };

      const snippet = formatSlackSnippet(mockWindow);
      expect(snippet).toContain('*Proposed Meeting Time* (2 hours)');
      expect(snippet).toContain('• *New York*: 10:00 AM – 12:00 PM');
      expect(snippet).toContain('• *London*: 3:00 PM – 5:00 PM');
      expect(snippet).toContain('• *Tokyo*: 11:00 PM – 1:00 AM (+1 Day)');
    });

    test('formatCompactMeetingSummary produces single-line summary', () => {
      const mockWindow = {
        citySummaries: [
          { cityName: 'New York', startTime: '10:00 AM', endTime: '11:00 AM', dayRollover: '' },
          { cityName: 'London', startTime: '3:00 PM', endTime: '4:00 PM', dayRollover: '' },
        ],
      };

      const summary = formatCompactMeetingSummary(mockWindow);
      expect(summary).toBe('New York: 10:00 AM–11:00 AM | London: 3:00 PM–4:00 PM');
    });

    test('format functions handle null or invalid input gracefully', () => {
      expect(formatSlackSnippet(null)).toBe('');
      expect(formatSlackSnippet({})).toBe('');
      expect(formatCompactMeetingSummary(null)).toBe('');
      expect(formatCompactMeetingSummary({})).toBe('');
    });
  });

  describe('Pairwise Overlap Metrics (Programmatic SEO City-Pairs)', () => {
    test('calculates exact overlap hours and ratios between New York and London', () => {
      const refDate = '2026-10-10';
      const timestamps = generateDayIntervals(refDate, 'America/New_York');

      const nySlots = generateCityRowSlots({
        targetTimezone: 'America/New_York',
        timestamps,
        referenceDate: refDate,
      });

      const lonSlots = generateCityRowSlots({
        targetTimezone: 'Europe/London',
        timestamps,
        referenceDate: refDate,
      });

      const metrics = getPairwiseOverlapMetrics(nySlots, lonSlots);

      // Both NY (9am-5pm) and London (9am-5pm) overlap from 9am-12pm NY time (2pm-5pm London time)
      // Exactly 3 hours of mutual working hours
      expect(metrics.hasGoldenOverlap).toBe(true);
      expect(metrics.overlapHours).toBe(3);
      expect(metrics.goldenSlotIndices).toEqual([9, 10, 11]);
      expect(metrics.overlapRatioA).toBeGreaterThan(0.3); // 3 / 8 working hours = ~0.38
    });

    test('correctly handles non-overlapping city pairs', () => {
      // Honolulu (UTC-10) vs Dubai (UTC+4): 14 hours apart
      const refDate = '2026-10-10';
      const timestamps = generateDayIntervals(refDate, 'Pacific/Honolulu');

      const hnlSlots = generateCityRowSlots({
        targetTimezone: 'Pacific/Honolulu',
        timestamps,
        referenceDate: refDate,
      });

      const dxbSlots = generateCityRowSlots({
        targetTimezone: 'Asia/Dubai',
        timestamps,
        referenceDate: refDate,
      });

      const metrics = getPairwiseOverlapMetrics(hnlSlots, dxbSlots);
      // Working hours 9am-5pm in Honolulu do not overlap with working hours 9am-5pm in Dubai
      expect(metrics.hasGoldenOverlap).toBe(false);
      expect(metrics.overlapHours).toBe(0);
      expect(metrics.goldenSlotIndices.length).toBe(0);
    });
  });
});
