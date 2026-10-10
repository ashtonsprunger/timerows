import {
  isValidTimezone,
  getUserLocalTimezone,
  canonicalizeTimezone,
  getTimeParts,
  getTimezoneOffset,
  formatTimezoneOffset,
  getTimezoneAbbreviation,
  isDST,
  getTimePhase,
  getDateDifference,
  formatDateDifference,
  getZonedMidnight,
  getDayHourCount,
  generateDayIntervals,
  generateSlot,
  generateCityRowSlots,
  PHASE_TYPES,
  DEFAULT_WORKING_HOURS,
  DEFAULT_SLEEP_HOURS,
} from './timezoneEngine.js';

describe('timezoneEngine', () => {
  describe('IANA Timezone Validation & Canonicalization', () => {
    test('validates standard IANA timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidTimezone('Australia/Sydney')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    test('rejects invalid timezones and non-string inputs', () => {
      expect(isValidTimezone('Moon/Base')).toBe(false);
      expect(isValidTimezone('Invalid/Zone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone(null)).toBe(false);
      expect(isValidTimezone(undefined)).toBe(false);
      expect(isValidTimezone(12345)).toBe(false);
    });

    test('canonicalizes legacy or alias timezone names', () => {
      expect(canonicalizeTimezone('America/New_York')).toBe('America/New_York');
      expect(canonicalizeTimezone('UTC')).toBe('UTC');
      // US/Eastern canonicalizes to America/New_York
      expect(canonicalizeTimezone('US/Eastern')).toBe('America/New_York');
    });

    test('throws error when canonicalizing invalid timezone', () => {
      expect(() => canonicalizeTimezone('Fake/Zone')).toThrow('Invalid IANA timezone identifier');
    });
  });

  describe('Time Parts & Formatting', () => {
    test('extracts exact calendar and clock parts in target timezone', () => {
      // 2026-10-10 14:30:00 UTC
      const utcTimestamp = Date.UTC(2026, 9, 10, 14, 30, 0);

      // In New York (EDT, UTC-4), this is 10:30 AM
      const nyParts = getTimeParts(utcTimestamp, 'America/New_York');
      expect(nyParts.year).toBe(2026);
      expect(nyParts.month).toBe(10);
      expect(nyParts.day).toBe(10);
      expect(nyParts.hour).toBe(10);
      expect(nyParts.minute).toBe(30);
      expect(nyParts.isoDate).toBe('2026-10-10');
      expect(nyParts.timeString24).toBe('10:30');
      expect(nyParts.timeString12).toBe('10:30 AM');
      expect(nyParts.dayOfWeek).toBe('Sat');

      // In London (BST, UTC+1), this is 15:30 (3:30 PM)
      const lonParts = getTimeParts(utcTimestamp, 'Europe/London');
      expect(lonParts.hour).toBe(15);
      expect(lonParts.minute).toBe(30);
      expect(lonParts.timeString12).toBe('3:30 PM');

      // In Tokyo (JST, UTC+9), this is 23:30 (11:30 PM)
      const tyoParts = getTimeParts(utcTimestamp, 'Asia/Tokyo');
      expect(tyoParts.hour).toBe(23);
      expect(tyoParts.minute).toBe(30);
      expect(tyoParts.timeString12).toBe('11:30 PM');
    });

    test('correctly handles fractional offset timezones (India +5:30, Nepal +5:45)', () => {
      // 2026-10-10 12:00:00 UTC
      const utcTimestamp = Date.UTC(2026, 9, 10, 12, 0, 0);

      // India is UTC+5:30 -> 17:30
      const kolkataParts = getTimeParts(utcTimestamp, 'Asia/Kolkata');
      expect(kolkataParts.hour).toBe(17);
      expect(kolkataParts.minute).toBe(30);
      expect(kolkataParts.timeString24).toBe('17:30');
      expect(kolkataParts.timeString12).toBe('5:30 PM');

      // Nepal is UTC+5:45 -> 17:45
      const nepalParts = getTimeParts(utcTimestamp, 'Asia/Kathmandu');
      expect(nepalParts.hour).toBe(17);
      expect(nepalParts.minute).toBe(45);
      expect(nepalParts.timeString24).toBe('17:45');
      expect(nepalParts.timeString12).toBe('5:45 PM');
    });

    test('correctly formats midnight (12:00 AM) and noon (12:00 PM)', () => {
      // Midnight in London (2026-01-15 00:00:00 UTC)
      const midnightUtc = Date.UTC(2026, 0, 15, 0, 0, 0);
      const midnightParts = getTimeParts(midnightUtc, 'Europe/London');
      expect(midnightParts.hour).toBe(0);
      expect(midnightParts.hour12).toBe(12);
      expect(midnightParts.ampm).toBe('AM');
      expect(midnightParts.timeString12).toBe('12:00 AM');

      // Noon in London
      const noonUtc = Date.UTC(2026, 0, 15, 12, 0, 0);
      const noonParts = getTimeParts(noonUtc, 'Europe/London');
      expect(noonParts.hour).toBe(12);
      expect(noonParts.hour12).toBe(12);
      expect(noonParts.ampm).toBe('PM');
      expect(noonParts.timeString12).toBe('12:00 PM');
    });
  });

  describe('Timezone Offsets & Abbreviations', () => {
    test('computes accurate minute offsets across standard and fractional timezones', () => {
      // Summer date: 2026-07-01 12:00:00 UTC
      const summerUtc = Date.UTC(2026, 6, 1, 12, 0, 0);
      expect(getTimezoneOffset('UTC', summerUtc)).toBe(0);
      expect(getTimezoneOffset('America/New_York', summerUtc)).toBe(-240); // EDT is UTC-4
      expect(getTimezoneOffset('Europe/London', summerUtc)).toBe(60);     // BST is UTC+1
      expect(getTimezoneOffset('Asia/Tokyo', summerUtc)).toBe(540);       // JST is UTC+9
      expect(getTimezoneOffset('Asia/Kolkata', summerUtc)).toBe(330);     // IST is UTC+5:30
      expect(getTimezoneOffset('Asia/Kathmandu', summerUtc)).toBe(345);   // NPT is UTC+5:45
      expect(getTimezoneOffset('America/St_Johns', summerUtc)).toBe(-150);// NDT is UTC-2:30

      // Winter date: 2026-01-01 12:00:00 UTC
      const winterUtc = Date.UTC(2026, 0, 1, 12, 0, 0);
      expect(getTimezoneOffset('America/New_York', winterUtc)).toBe(-300); // EST is UTC-5
      expect(getTimezoneOffset('Europe/London', winterUtc)).toBe(0);       // GMT is UTC+0
      expect(getTimezoneOffset('America/St_Johns', winterUtc)).toBe(-210); // NST is UTC-3:30
    });

    test('formats timezone offset strings nicely', () => {
      expect(formatTimezoneOffset(0)).toBe('+00:00');
      expect(formatTimezoneOffset(-240)).toBe('-04:00');
      expect(formatTimezoneOffset(-300)).toBe('-05:00');
      expect(formatTimezoneOffset(60)).toBe('+01:00');
      expect(formatTimezoneOffset(330)).toBe('+05:30');
      expect(formatTimezoneOffset(345)).toBe('+05:45');
      expect(formatTimezoneOffset(-210)).toBe('-03:30');
    });

    test('retrieves correct timezone abbreviations', () => {
      const summerUtc = Date.UTC(2026, 6, 1, 12, 0, 0);
      const winterUtc = Date.UTC(2026, 0, 1, 12, 0, 0);

      // New York
      expect(getTimezoneAbbreviation('America/New_York', summerUtc)).toBe('EDT');
      expect(getTimezoneAbbreviation('America/New_York', winterUtc)).toBe('EST');

      // London
      expect(getTimezoneAbbreviation('Europe/London', summerUtc)).toBe('BST');
      expect(getTimezoneAbbreviation('Europe/London', winterUtc)).toBe('GMT');

      // Tokyo
      expect(getTimezoneAbbreviation('Asia/Tokyo', summerUtc)).toBe('JST');
      expect(getTimezoneAbbreviation('Asia/Tokyo', winterUtc)).toBe('JST');
    });
  });

  describe('DST Detection & Transition Days (Rule 2 Compliance)', () => {
    test('detects DST active status correctly for Northern Hemisphere', () => {
      const summerDate = Date.UTC(2026, 6, 15, 12, 0, 0);
      const winterDate = Date.UTC(2026, 0, 15, 12, 0, 0);

      expect(isDST('America/New_York', summerDate)).toBe(true);
      expect(isDST('America/New_York', winterDate)).toBe(false);

      expect(isDST('Europe/London', summerDate)).toBe(true);
      expect(isDST('Europe/London', winterDate)).toBe(false);
    });

    test('detects DST active status correctly for Southern Hemisphere (Sydney)', () => {
      // In Sydney, summer/DST occurs around January, winter/Standard is around July
      const sydneySummer = Date.UTC(2026, 0, 15, 12, 0, 0); // January: AEDT (UTC+11)
      const sydneyWinter = Date.UTC(2026, 6, 15, 12, 0, 0); // July: AEST (UTC+10)

      expect(isDST('Australia/Sydney', sydneySummer)).toBe(true);
      expect(isDST('Australia/Sydney', sydneyWinter)).toBe(false);
    });

    test('detects non-DST observing timezones', () => {
      const summerDate = Date.UTC(2026, 6, 15, 12, 0, 0);
      const winterDate = Date.UTC(2026, 0, 15, 12, 0, 0);

      expect(isDST('Asia/Tokyo', summerDate)).toBe(false);
      expect(isDST('Asia/Tokyo', winterDate)).toBe(false);

      expect(isDST('Asia/Kolkata', summerDate)).toBe(false);
      expect(isDST('Asia/Kolkata', winterDate)).toBe(false);

      expect(isDST('America/Phoenix', summerDate)).toBe(false);
      expect(isDST('America/Phoenix', winterDate)).toBe(false);
    });

    test('calculates 23-hour day on US Spring Forward transition (2026-03-08)', () => {
      // In 2026, US Spring Forward is Sunday, March 8
      const hoursCount = getDayHourCount('2026-03-08', 'America/New_York');
      expect(hoursCount).toBe(23);

      const intervals = generateDayIntervals('2026-03-08', 'America/New_York');
      expect(intervals.length).toBe(23);

      // Verify that local hour 2 AM does NOT exist (jumps from 1:00 EST to 3:00 EDT)
      const hours = intervals.map((ts) => getTimeParts(ts, 'America/New_York').hour);
      expect(hours).not.toContain(2);
      expect(hours).toContain(1);
      expect(hours).toContain(3);
    });

    test('calculates 25-hour day on US Fall Back transition (2026-11-01)', () => {
      // In 2026, US Fall Back is Sunday, November 1
      const hoursCount = getDayHourCount('2026-11-01', 'America/New_York');
      expect(hoursCount).toBe(25);

      const intervals = generateDayIntervals('2026-11-01', 'America/New_York');
      expect(intervals.length).toBe(25);

      // Verify that local hour 1 AM occurs twice (first 1:00 EDT, then 1:00 EST)
      const hour1Instances = intervals.filter((ts) => getTimeParts(ts, 'America/New_York').hour === 1);
      expect(hour1Instances.length).toBe(2);

      // First 1 AM is EDT (UTC-4), second 1 AM is EST (UTC-5)
      expect(getTimezoneOffset('America/New_York', hour1Instances[0])).toBe(-240);
      expect(getTimezoneOffset('America/New_York', hour1Instances[1])).toBe(-300);
    });

    test('calculates standard 24-hour day on normal days', () => {
      const hoursCount = getDayHourCount('2026-10-10', 'America/New_York');
      expect(hoursCount).toBe(24);

      const intervals = generateDayIntervals('2026-10-10', 'America/New_York');
      expect(intervals.length).toBe(24);
    });
  });

  describe('Daily Rhythms & Phase Calculation (Sleep, Awake, Work)', () => {
    test('classifies core working hours (9:00 AM to 5:00 PM)', () => {
      expect(getTimePhase(9)).toBe(PHASE_TYPES.WORK);
      expect(getTimePhase(12)).toBe(PHASE_TYPES.WORK);
      expect(getTimePhase(16)).toBe(PHASE_TYPES.WORK);
      expect(getTimePhase(16.99)).toBe(PHASE_TYPES.WORK);
      // 17:00 (5 PM) is end of working hours -> awake/off-hours
      expect(getTimePhase(17)).toBe(PHASE_TYPES.AWAKE);
    });

    test('classifies sleep phase (11:00 PM to 7:00 AM)', () => {
      expect(getTimePhase(23)).toBe(PHASE_TYPES.SLEEP);
      expect(getTimePhase(0)).toBe(PHASE_TYPES.SLEEP);
      expect(getTimePhase(3)).toBe(PHASE_TYPES.SLEEP);
      expect(getTimePhase(6.5)).toBe(PHASE_TYPES.SLEEP);
      // 7:00 AM is end of sleep -> awake
      expect(getTimePhase(7)).toBe(PHASE_TYPES.AWAKE);
    });

    test('classifies awake / off-hours (7 AM - 9 AM & 5 PM - 11 PM)', () => {
      expect(getTimePhase(7)).toBe(PHASE_TYPES.AWAKE);
      expect(getTimePhase(8)).toBe(PHASE_TYPES.AWAKE);
      expect(getTimePhase(8.5)).toBe(PHASE_TYPES.AWAKE);
      expect(getTimePhase(17)).toBe(PHASE_TYPES.AWAKE);
      expect(getTimePhase(19)).toBe(PHASE_TYPES.AWAKE);
      expect(getTimePhase(22)).toBe(PHASE_TYPES.AWAKE);
    });

    test('handles custom working hours and sleep hours', () => {
      const customWork = { start: 10, end: 18 };
      const customSleep = { start: 0, end: 8 };

      expect(getTimePhase(9, customWork, customSleep)).toBe(PHASE_TYPES.AWAKE);
      expect(getTimePhase(10, customWork, customSleep)).toBe(PHASE_TYPES.WORK);
      expect(getTimePhase(17.5, customWork, customSleep)).toBe(PHASE_TYPES.WORK);
      expect(getTimePhase(18, customWork, customSleep)).toBe(PHASE_TYPES.AWAKE);
      expect(getTimePhase(1, customWork, customSleep)).toBe(PHASE_TYPES.SLEEP);
    });
  });

  describe('Date Difference & Rollover Indicators', () => {
    test('computes date differences accurately', () => {
      expect(getDateDifference('2026-10-10', '2026-10-10')).toBe(0);
      expect(getDateDifference('2026-10-11', '2026-10-10')).toBe(1);
      expect(getDateDifference('2026-10-09', '2026-10-10')).toBe(-1);
    });

    test('handles month and year rollover in date difference', () => {
      // Month boundary
      expect(getDateDifference('2026-11-01', '2026-10-31')).toBe(1);
      expect(getDateDifference('2026-10-31', '2026-11-01')).toBe(-1);

      // Year boundary
      expect(getDateDifference('2027-01-01', '2026-12-31')).toBe(1);
      expect(getDateDifference('2026-12-31', '2027-01-01')).toBe(-1);

      // Leap year boundary (2028 is leap year)
      expect(getDateDifference('2028-03-01', '2028-02-29')).toBe(1);
      expect(getDateDifference('2028-02-29', '2028-02-28')).toBe(1);
    });

    test('formats rollover labels correctly', () => {
      expect(formatDateDifference(0)).toBe('');
      expect(formatDateDifference(1)).toBe('+1 Day');
      expect(formatDateDifference(-1)).toBe('-1 Day');
      expect(formatDateDifference(2)).toBe('+2 Days');
    });
  });

  describe('Local Midnight & Slot Generation', () => {
    test('getZonedMidnight resolves accurate epoch for midnight in any timezone', () => {
      const midnightEpoch = getZonedMidnight('2026-10-10', 'America/New_York');
      const parts = getTimeParts(midnightEpoch, 'America/New_York');

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(10);
      expect(parts.hour).toBe(0);
      expect(parts.minute).toBe(0);
      expect(parts.second).toBe(0);
    });

    test('generateSlot generates complete slot descriptor with rollover', () => {
      // Midnight in New York: 2026-10-10 04:00:00 UTC
      const midnightUtc = Date.UTC(2026, 9, 10, 4, 0, 0);

      // Slot for Tokyo at that moment
      const tokyoSlot = generateSlot({
        targetTimezone: 'Asia/Tokyo',
        timestamp: midnightUtc,
        index: 0,
        referenceDateStr: '2026-10-10',
      });

      expect(tokyoSlot.timeZone).toBe('Asia/Tokyo');
      // At 04:00 UTC, Tokyo (UTC+9) is 13:00 (1:00 PM) on the same day
      expect(tokyoSlot.hour).toBe(13);
      expect(tokyoSlot.formattedTime12).toBe('1:00 PM');
      expect(tokyoSlot.hourDisplay).toBe('1 PM');
      expect(tokyoSlot.phase).toBe(PHASE_TYPES.WORK);
      expect(tokyoSlot.isWorkingHour).toBe(true);
      expect(tokyoSlot.dateDifference).toBe(0);
      expect(tokyoSlot.dayRollover).toBe('');

      // Slot for Honolulu (UTC-10) at that moment (2026-10-09 18:00 HST -> Yesterday / -1 Day)
      const honoluluSlot = generateSlot({
        targetTimezone: 'Pacific/Honolulu',
        timestamp: midnightUtc,
        index: 0,
        referenceDateStr: '2026-10-10',
      });

      expect(honoluluSlot.hour).toBe(18); // 6:00 PM
      expect(honoluluSlot.dateDifference).toBe(-1);
      expect(honoluluSlot.dayRollover).toBe('-1 Day');
      expect(honoluluSlot.phase).toBe(PHASE_TYPES.AWAKE);
    });

    test('generateCityRowSlots produces aligned 24 slots across cities', () => {
      const refDate = '2026-10-10';
      const refTz = 'America/New_York';
      const timestamps = generateDayIntervals(refDate, refTz);

      expect(timestamps.length).toBe(24);

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

      const tokyoSlots = generateCityRowSlots({
        targetTimezone: 'Asia/Tokyo',
        timestamps,
        referenceDate: refDate,
      });

      expect(nySlots.length).toBe(24);
      expect(londonSlots.length).toBe(24);
      expect(tokyoSlots.length).toBe(24);

      // In NY: slot 0 is 00:00 (midnight), slot 9 is 09:00
      expect(nySlots[0].hour).toBe(0);
      expect(nySlots[9].hour).toBe(9);
      expect(nySlots[9].phase).toBe(PHASE_TYPES.WORK);

      // In London (EDT+5h): slot 0 is 05:00 BST, slot 9 is 14:00 BST (2 PM)
      expect(londonSlots[0].hour).toBe(5);
      expect(londonSlots[9].hour).toBe(14);
      expect(londonSlots[9].phase).toBe(PHASE_TYPES.WORK);

      // In Tokyo (EDT+13h): slot 0 is 13:00 JST, slot 9 is 22:00 JST
      expect(tokyoSlots[0].hour).toBe(13);
      expect(tokyoSlots[9].hour).toBe(22);
      expect(tokyoSlots[9].phase).toBe(PHASE_TYPES.AWAKE);
    });

    test('generateCityRowSlots auto-generates timestamps when none are provided', () => {
      const slots = generateCityRowSlots({
        targetTimezone: 'Europe/Paris',
        referenceDate: '2026-05-15',
        referenceTimezone: 'Europe/Paris',
      });
      expect(slots.length).toBe(24);
      expect(slots[0].dateStr).toBe('2026-05-15');
      expect(slots[0].timeZone).toBe('Europe/Paris');
    });

    test('generateCityRowSlots handles missing referenceDate and timestamps gracefully', () => {
      const slots = generateCityRowSlots({
        targetTimezone: 'UTC',
      });
      expect(slots.length).toBe(24);
      expect(slots[0].timeZone).toBe('UTC');
    });

    test('generateCityRowSlots throws on invalid target timezone', () => {
      expect(() => generateCityRowSlots({ targetTimezone: 'Not/Real' })).toThrow('Invalid target timezone');
    });

    test('generateDayIntervals supports fixedCount option', () => {
      const intervals = generateDayIntervals('2026-10-10', 'UTC', { fixedCount: 12 });
      expect(intervals.length).toBe(12);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('getUserLocalTimezone returns a valid timezone string', () => {
      const tz = getUserLocalTimezone();
      expect(typeof tz).toBe('string');
      expect(isValidTimezone(tz)).toBe(true);
    });

    test('getTimeParts throws on invalid timezone or invalid date input', () => {
      expect(() => getTimeParts(Date.now(), 'Fake/Zone')).toThrow('Invalid IANA timezone');
      expect(() => getTimeParts('invalid-date-string', 'UTC')).toThrow('Invalid date/timestamp provided');
    });

    test('getTimezoneAbbreviation throws on invalid timezone', () => {
      expect(() => getTimezoneAbbreviation('Invalid/Tz', Date.now())).toThrow('Invalid IANA timezone');
    });

    test('getTimezoneAbbreviation falls back gracefully for timezones outside curated list', () => {
      // Atlantic/Reykjavik (UTC, no DST)
      const abbr = getTimezoneAbbreviation('Atlantic/Reykjavik', Date.UTC(2026, 6, 1));
      expect(abbr).toBeDefined();
      expect(abbr.length).toBeGreaterThan(0);
    });

    test('getZonedMidnight throws on invalid timezone or malformed date string', () => {
      expect(() => getZonedMidnight('2026-10-10', 'Invalid/Zone')).toThrow('Invalid IANA timezone');
      expect(() => getZonedMidnight('bad-date', 'UTC')).toThrow('Invalid date string');
    });

    test('getTimePhase handles overnight work schedules and custom sleep spans', () => {
      const nightShift = { start: 22, end: 6 }; // 10 PM to 6 AM work
      const daySleep = { start: 8, end: 16 };   // 8 AM to 4 PM sleep

      expect(getTimePhase(23, nightShift, daySleep)).toBe(PHASE_TYPES.WORK);
      expect(getTimePhase(3, nightShift, daySleep)).toBe(PHASE_TYPES.WORK);
      expect(getTimePhase(10, nightShift, daySleep)).toBe(PHASE_TYPES.SLEEP);
      expect(getTimePhase(18, nightShift, daySleep)).toBe(PHASE_TYPES.AWAKE);
    });

    test('formatDateDifference handles multi-day offsets (>1 and <-1)', () => {
      expect(formatDateDifference(3)).toBe('+3 Days');
      expect(formatDateDifference(-3)).toBe('-3 Days');
    });
  });
});

