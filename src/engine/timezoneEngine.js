/**
 * TimeRows - Timezone Engine
 * 
 * Pure mathematical and algorithmic engine for canonical IANA timezone operations,
 * DST transition detection, solar/day-night phase assignment, and slot generation.
 * Zero React dependencies.
 */

export const PHASE_TYPES = Object.freeze({
  SLEEP: 'sleep',
  AWAKE: 'awake',
  WORK: 'work',
});

export const DEFAULT_WORKING_HOURS = Object.freeze({
  start: 9, // 9:00 AM (inclusive)
  end: 17,  // 5:00 PM (exclusive: 9:00 to 16:59:59 is work, 17:00 is off-hours)
});

export const DEFAULT_SLEEP_HOURS = Object.freeze({
  start: 23, // 11:00 PM (inclusive)
  end: 7,    // 7:00 AM (exclusive: 23:00 to 06:59:59 is sleep, 07:00 is awake)
});

/**
 * Cache for Intl.DateTimeFormat formatters to ensure ultra-fast slot generation
 */
const formatterCache = new Map();

function getFormatter(timeZone, optionsKey, optionsFactory) {
  const cacheKey = `${timeZone}|${optionsKey}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = optionsFactory();
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

/**
 * Check if a timezone identifier is a valid IANA timezone string.
 * @param {string} timeZone
 * @returns {boolean}
 */
export function isValidTimezone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the user's host environment timezone identifier.
 * @returns {string}
 */
export function getUserLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Returns canonical resolved IANA timezone name.
 * @param {string} timeZone
 * @returns {string}
 */
export function canonicalizeTimezone(timeZone) {
  if (!isValidTimezone(timeZone)) {
    throw new Error(`Invalid IANA timezone identifier: "${timeZone}"`);
  }
  return new Intl.DateTimeFormat(undefined, { timeZone }).resolvedOptions().timeZone;
}

/**
 * Extract zoned calendar date and clock time parts for a given timestamp.
 * 
 * @param {Date|number|string} dateOrTimestamp - UTC timestamp or Date object
 * @param {string} timeZone - IANA timezone identifier
 * @returns {{
 *   year: number,
 *   month: number,
 *   day: number,
 *   hour: number,
 *   minute: number,
 *   second: number,
 *   dayOfWeek: string,
 *   dayOfWeekIndex: number,
 *   isoDate: string,
 *   timeString24: string,
 *   timeString12: string,
 *   hour12: number,
 *   ampm: 'AM'|'PM'
 * }}
 */
export function getTimeParts(dateOrTimestamp, timeZone) {
  if (!isValidTimezone(timeZone)) {
    throw new Error(`Invalid IANA timezone: "${timeZone}"`);
  }

  const date = typeof dateOrTimestamp === 'number'
    ? new Date(dateOrTimestamp)
    : (dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp));

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date/timestamp provided: ${dateOrTimestamp}`);
  }

  const formatter = getFormatter(timeZone, 'parts-h23', () => (
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hour12: false,
      hourCycle: 'h23',
    })
  ));

  const parts = formatter.formatToParts(date);
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let dayOfWeek = 'Sun';

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    switch (p.type) {
      case 'year':
        year = parseInt(p.value, 10);
        break;
      case 'month':
        month = parseInt(p.value, 10);
        break;
      case 'day':
        day = parseInt(p.value, 10);
        break;
      case 'hour':
        hour = parseInt(p.value, 10);
        if (hour === 24) hour = 0;
        break;
      case 'minute':
        minute = parseInt(p.value, 10);
        break;
      case 'second':
        second = parseInt(p.value, 10);
        break;
      case 'weekday':
        dayOfWeek = p.value;
        break;
      default:
        break;
    }
  }

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeekIndex = weekdayMap[dayOfWeek] ?? 0;

  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;
  const timeString24 = `${pad(hour)}:${pad(minute)}`;

  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const timeString12 = `${hour12}:${pad(minute)} ${ampm}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek,
    dayOfWeekIndex,
    isoDate,
    timeString24,
    timeString12,
    hour12,
    ampm,
  };
}

/**
 * Calculates the exact UTC offset (in minutes) for a timezone at a given UTC timestamp.
 * Positive for zones east of UTC (e.g. +330 for IST), negative for west (e.g. -240 for EDT).
 * 
 * @param {string} timeZone - IANA timezone
 * @param {Date|number|string} dateOrTimestamp - UTC timestamp
 * @returns {number} Offset in minutes
 */
export function getTimezoneOffset(timeZone, dateOrTimestamp) {
  const parts = getTimeParts(dateOrTimestamp, timeZone);
  const date = typeof dateOrTimestamp === 'number'
    ? new Date(dateOrTimestamp)
    : (dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp));

  const utcTimestamp = date.getTime();
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return Math.round((localAsUtc - utcTimestamp) / 60000);
}

/**
 * Format minutes offset to standard ISO representation (e.g. "+05:30", "-04:00", "+00:00").
 * @param {number} offsetMinutes
 * @returns {string}
 */
export function formatTimezoneOffset(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Format relative minute offset from the primary/reference city into a compact badge string.
 * Whole hours -> "+5h", "-3h", "0h"
 * 30-min offsets -> "+5.5h", "-3.5h"
 * 15/45-min offsets (e.g. Asia/Kathmandu UTC+5:45) -> "+5:45", "+9:45" (never rounds 5.75 to "+5.8h")
 *
 * @param {number} diffMins
 * @returns {string}
 */
export function formatRelativeOffset(diffMins) {
  if (!diffMins) return '0h';
  const sign = diffMins > 0 ? '+' : '-';
  const absMins = Math.abs(Math.round(diffMins));
  const rem = absMins % 60;
  if (rem === 0) {
    return `${sign}${absMins / 60}h`;
  }
  if (rem === 30) {
    return `${sign}${(absMins / 60).toFixed(1)}h`;
  }
  const wholeHours = Math.floor(absMins / 60);
  return `${sign}${wholeHours}:${String(rem).padStart(2, '0')}`;
}

// Map of canonical timezone abbreviations for major global hubs
const TIMEZONE_ABBREVIATIONS = {
  'America/New_York': { standard: 'EST', daylight: 'EDT' },
  'America/Detroit': { standard: 'EST', daylight: 'EDT' },
  'America/Toronto': { standard: 'EST', daylight: 'EDT' },
  'America/Chicago': { standard: 'CST', daylight: 'CDT' },
  'America/Mexico_City': { standard: 'CST', daylight: 'CST' },
  'America/Denver': { standard: 'MST', daylight: 'MDT' },
  'America/Phoenix': { standard: 'MST', daylight: 'MST' },
  'America/Los_Angeles': { standard: 'PST', daylight: 'PDT' },
  'America/Vancouver': { standard: 'PST', daylight: 'PDT' },
  'America/Anchorage': { standard: 'AKST', daylight: 'AKDT' },
  'Pacific/Honolulu': { standard: 'HST', daylight: 'HST' },
  'America/Halifax': { standard: 'AST', daylight: 'ADT' },
  'America/Havana': { standard: 'CST', daylight: 'CDT' },
  'America/St_Johns': { standard: 'NST', daylight: 'NDT' },
  'America/Sao_Paulo': { standard: 'BRT', daylight: 'BRT' },
  'America/Buenos_Aires': { standard: 'ART', daylight: 'ART' },
  'America/Santiago': { standard: 'CLT', daylight: 'CLST' },
  'Europe/London': { standard: 'GMT', daylight: 'BST' },
  'Europe/Dublin': { standard: 'GMT', daylight: 'IST' },
  'Europe/Lisbon': { standard: 'WET', daylight: 'WEST' },
  'Europe/Paris': { standard: 'CET', daylight: 'CEST' },
  'Europe/Berlin': { standard: 'CET', daylight: 'CEST' },
  'Europe/Amsterdam': { standard: 'CET', daylight: 'CEST' },
  'Europe/Rome': { standard: 'CET', daylight: 'CEST' },
  'Europe/Madrid': { standard: 'CET', daylight: 'CEST' },
  'Europe/Brussels': { standard: 'CET', daylight: 'CEST' },
  'Europe/Vienna': { standard: 'CET', daylight: 'CEST' },
  'Europe/Stockholm': { standard: 'CET', daylight: 'CEST' },
  'Europe/Oslo': { standard: 'CET', daylight: 'CEST' },
  'Europe/Copenhagen': { standard: 'CET', daylight: 'CEST' },
  'Europe/Warsaw': { standard: 'CET', daylight: 'CEST' },
  'Europe/Zurich': { standard: 'CET', daylight: 'CEST' },
  'Europe/Athens': { standard: 'EET', daylight: 'EEST' },
  'Europe/Helsinki': { standard: 'EET', daylight: 'EEST' },
  'Europe/Bucharest': { standard: 'EET', daylight: 'EEST' },
  'Europe/Kyiv': { standard: 'EET', daylight: 'EEST' },
  'Europe/Istanbul': { standard: 'TRT', daylight: 'TRT' },
  'Europe/Moscow': { standard: 'MSK', daylight: 'MSK' },
  'Africa/Cairo': { standard: 'EET', daylight: 'EEST' },
  'Asia/Beirut': { standard: 'EET', daylight: 'EEST' },
  'Asia/Jerusalem': { standard: 'IST', daylight: 'IDT' },
  'Asia/Dubai': { standard: 'GST', daylight: 'GST' },
  'Asia/Tokyo': { standard: 'JST', daylight: 'JST' },
  'Asia/Seoul': { standard: 'KST', daylight: 'KST' },
  'Asia/Shanghai': { standard: 'CST', daylight: 'CST' },
  'Asia/Hong_Kong': { standard: 'HKT', daylight: 'HKT' },
  'Asia/Singapore': { standard: 'SGT', daylight: 'SGT' },
  'Asia/Taipei': { standard: 'CST', daylight: 'CST' },
  'Asia/Bangkok': { standard: 'ICT', daylight: 'ICT' },
  'Asia/Jakarta': { standard: 'WIB', daylight: 'WIB' },
  'Asia/Kolkata': { standard: 'IST', daylight: 'IST' },
  'Asia/Calcutta': { standard: 'IST', daylight: 'IST' },
  'Asia/Kathmandu': { standard: 'NPT', daylight: 'NPT' },
  'Australia/Sydney': { standard: 'AEST', daylight: 'AEDT' },
  'Australia/Melbourne': { standard: 'AEST', daylight: 'AEDT' },
  'Australia/Hobart': { standard: 'AEST', daylight: 'AEDT' },
  'Australia/Brisbane': { standard: 'AEST', daylight: 'AEST' },
  'Australia/Adelaide': { standard: 'ACST', daylight: 'ACDT' },
  'Australia/Darwin': { standard: 'ACST', daylight: 'ACST' },
  'Australia/Perth': { standard: 'AWST', daylight: 'AWST' },
  'Pacific/Auckland': { standard: 'NZST', daylight: 'NZDT' },
  'UTC': { standard: 'UTC', daylight: 'UTC' },
};

/**
 * Returns short abbreviation for a timezone at a given timestamp (e.g. "EDT", "EST", "BST", "GMT", "JST").
 * @param {string} timeZone
 * @param {Date|number|string} dateOrTimestamp
 * @returns {string}
 */
export function getTimezoneAbbreviation(timeZone, dateOrTimestamp) {
  if (!isValidTimezone(timeZone)) {
    throw new Error(`Invalid IANA timezone: "${timeZone}"`);
  }

  const date = typeof dateOrTimestamp === 'number'
    ? new Date(dateOrTimestamp)
    : (dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp));

  // Check curated canonical map first
  const canonical = canonicalizeTimezone(timeZone);
  const mapped = TIMEZONE_ABBREVIATIONS[canonical] || TIMEZONE_ABBREVIATIONS[timeZone];
  if (mapped) {
    const dst = isDST(canonical, date);
    return dst ? mapped.daylight : mapped.standard;
  }

  // Fallback to Intl.DateTimeFormat (try en-US first, then en-GB if en-US gives GMT+X)
  const usFormatter = getFormatter(canonical, 'short-tz-us', () => (
    new Intl.DateTimeFormat('en-US', { timeZone: canonical, timeZoneName: 'short' })
  ));
  const usParts = usFormatter.formatToParts(date);
  const usTz = usParts.find((p) => p.type === 'timeZoneName')?.value;

  if (usTz && !usTz.startsWith('GMT') && !usTz.startsWith('UTC')) {
    return usTz;
  }

  const gbFormatter = getFormatter(canonical, 'short-tz-gb', () => (
    new Intl.DateTimeFormat('en-GB', { timeZone: canonical, timeZoneName: 'short' })
  ));
  const gbParts = gbFormatter.formatToParts(date);
  const gbTz = gbParts.find((p) => p.type === 'timeZoneName')?.value;

  if (gbTz && !gbTz.startsWith('GMT') && !gbTz.startsWith('UTC')) {
    return gbTz;
  }

  return usTz || gbTz || '';
}

/**
 * Cache for yearly timezone offset profiles (min/max offset across the calendar year)
 */
const yearOffsetCache = new Map();

function getYearOffsetProfile(timeZone, year) {
  const canonical = canonicalizeTimezone(timeZone);
  const cacheKey = `${canonical}|${year}`;
  let profile = yearOffsetCache.get(cacheKey);
  if (!profile) {
    let minOffset = Infinity;
    let maxOffset = -Infinity;
    // Sample the 1st, 10th, and 20th of all 12 months (36 samples/year) so timezones
    // whose transitions do not span Jan 1 vs Jul 1 (e.g. Africa/Casablanca Ramadan shifts)
    // are accurately detected.
    const sampleDays = [1, 10, 20];
    for (let month = 0; month < 12; month++) {
      for (let i = 0; i < sampleDays.length; i++) {
        const sampleUtc = Date.UTC(year, month, sampleDays[i], 12, 0, 0);
        const offset = getTimezoneOffset(canonical, sampleUtc);
        if (offset < minOffset) minOffset = offset;
        if (offset > maxOffset) maxOffset = offset;
      }
    }
    profile = {
      minOffset,
      maxOffset,
      hasDST: minOffset !== maxOffset,
    };
    yearOffsetCache.set(cacheKey, profile);
  }
  return profile;
}

/**
 * Determine if Daylight Saving Time (DST) / advanced offset is active for the timezone at the given timestamp.
 * Detects whether the current offset is shifted ahead of the timezone's minimum baseline offset for that year.
 * 
 * @param {string} timeZone
 * @param {Date|number|string} dateOrTimestamp
 * @returns {boolean}
 */
export function isDST(timeZone, dateOrTimestamp) {
  const parts = getTimeParts(dateOrTimestamp, timeZone);
  const currentOffset = getTimezoneOffset(timeZone, dateOrTimestamp);
  const profile = getYearOffsetProfile(timeZone, parts.year);

  // If the offset is constant year-round, timezone does not observe DST
  if (!profile.hasDST) {
    return false;
  }

  // DST shifts the clock forward (greater offset) relative to the baseline offset
  return currentOffset > profile.minOffset;
}

/**
 * Classify a time slot into a human rhythm phase: 'sleep', 'work', or 'awake' (off-hours).
 * 
 * Rules:
 * - Work: between workingHours.start and workingHours.end
 * - Sleep: between sleepHours.start and sleepHours.end
 * - Awake: off-hours outside sleep and core working hours
 * 
 * @param {number} hourOrDecimal - Hour of the day (0-23.99)
 * @param {{ start: number, end: number }} [workingHours=DEFAULT_WORKING_HOURS]
 * @param {{ start: number, end: number }} [sleepHours=DEFAULT_SLEEP_HOURS]
 * @returns {'sleep'|'awake'|'work'}
 */
export function getTimePhase(
  hourOrDecimal,
  workingHours = DEFAULT_WORKING_HOURS,
  sleepHours = DEFAULT_SLEEP_HOURS
) {
  const workStart = workingHours.start ?? DEFAULT_WORKING_HOURS.start;
  const workEnd = workingHours.end ?? DEFAULT_WORKING_HOURS.end;
  const sleepStart = sleepHours.start ?? DEFAULT_SLEEP_HOURS.start;
  const sleepEnd = sleepHours.end ?? DEFAULT_SLEEP_HOURS.end;

  // Check working hours
  let isWork = false;
  if (workStart <= workEnd) {
    isWork = hourOrDecimal >= workStart && hourOrDecimal < workEnd;
  } else {
    // Non-standard night shift work schedule (e.g. 20:00 to 04:00)
    isWork = hourOrDecimal >= workStart || hourOrDecimal < workEnd;
  }
  if (isWork) return PHASE_TYPES.WORK;

  // Check sleep hours (standard is 23:00 to 07:00, spanning midnight)
  let isSleep = false;
  if (sleepStart > sleepEnd) {
    isSleep = hourOrDecimal >= sleepStart || hourOrDecimal < sleepEnd;
  } else {
    isSleep = hourOrDecimal >= sleepStart && hourOrDecimal < sleepEnd;
  }
  if (isSleep) return PHASE_TYPES.SLEEP;

  return PHASE_TYPES.AWAKE;
}

/**
 * Calculate the calendar day difference between a target local date string and reference date string.
 * Returns -1 (Yesterday), 0 (Same day), or +1 (Tomorrow), or larger differences if multi-day.
 * 
 * @param {string} targetDateStr - 'YYYY-MM-DD'
 * @param {string} referenceDateStr - 'YYYY-MM-DD'
 * @returns {number}
 */
export function getDateDifference(targetDateStr, referenceDateStr) {
  if (targetDateStr === referenceDateStr) return 0;

  const [tY, tM, tD] = targetDateStr.split('-').map(Number);
  const [rY, rM, rD] = referenceDateStr.split('-').map(Number);

  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const refUtc = Date.UTC(rY, rM - 1, rD);

  const diffMs = targetUtc - refUtc;
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Format a calendar day difference into a user-facing rollover badge string.
 * @param {number} diffDays
 * @returns {string} e.g. "+1 Day", "-1 Day", or ""
 */
export function formatDateDifference(diffDays) {
  if (diffDays === 0) return '';
  if (diffDays === 1) return '+1 Day';
  if (diffDays === -1) return '-1 Day';
  if (diffDays > 1) return `+${diffDays} Days`;
  return `${diffDays} Days`;
}

/**
 * Get the UTC timestamp corresponding to the start of a local calendar day (00:00:00, or 01:00:00
 * if a midnight Spring Forward transition skips 00:00) for a date in a timezone.
 * 
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeZone - IANA timezone identifier
 * @returns {number} UTC epoch milliseconds
 */
export function getZonedMidnight(dateStr, timeZone) {
  if (!isValidTimezone(timeZone)) {
    throw new Error(`Invalid IANA timezone: "${timeZone}"`);
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date string: "${dateStr}". Expected YYYY-MM-DD.`);
  }

  // Initial guess assuming UTC midnight
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);

  // Compute offset at this guess
  const offset1 = getTimezoneOffset(timeZone, utcGuess);
  let resolvedUtc = utcGuess - offset1 * 60000;

  // Re-check offset at the resolved time to ensure consistency across DST jumps near midnight
  const offset2 = getTimezoneOffset(timeZone, resolvedUtc);
  if (offset2 !== offset1) {
    const candidate2 = utcGuess - offset2 * 60000;
    // Adopt candidate2 if it falls on dateStr; in West-of-UTC midnight Spring Forward zones
    // (e.g. America/Havana jumping 00:00 -> 01:00), subtracting the post-transition offset
    // would land at 23:00 on the previous day.
    if (getTimeParts(candidate2, timeZone).isoDate === dateStr) {
      resolvedUtc = candidate2;
    }
  }

  // If resolvedUtc landed on the previous calendar day (e.g. East-of-UTC midnight Spring Forward),
  // step forward to the first hour of dateStr.
  let safety = 0;
  while (getTimeParts(resolvedUtc, timeZone).isoDate < dateStr && safety < 4) {
    resolvedUtc += 3600000;
    safety++;
  }

  // If there is an earlier hour on the same calendar date (e.g. East-of-UTC midnight Fall Back
  // where 00:00 occurs twice), step back to the very first hour of dateStr.
  while (getTimeParts(resolvedUtc - 3600000, timeZone).isoDate === dateStr && safety < 8) {
    resolvedUtc -= 3600000;
    safety++;
  }

  return resolvedUtc;
}

/**
 * Return the number of local hours in a given day for a timezone (23 for spring-forward, 25 for fall-back, 24 normal).
 * 
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeZone - IANA timezone identifier
 * @returns {number} 23, 24, or 25
 */
export function getDayHourCount(dateStr, timeZone) {
  const intervals = generateDayIntervals(dateStr, timeZone, { dstAware: true });
  return intervals.length;
}

/**
 * Generate sequence of UTC timestamps representing the hours of a given local day.
 * DST-safe:
 * - Standard day: 24 timestamps
 * - Spring-forward day (23h): exactly 23 timestamps (skips missing local hour)
 * - Fall-back day (25h): exactly 25 timestamps (includes both instances of repeated hour)
 * 
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeZone - IANA timezone identifier
 * @param {{ dstAware?: boolean, fixedCount?: number }} [options]
 * @returns {number[]} Array of UTC timestamps (ms)
 */
export function generateDayIntervals(dateStr, timeZone, options = {}) {
  const { dstAware = true, fixedCount } = options;

  if (fixedCount !== undefined && fixedCount > 0) {
    const midnight = getZonedMidnight(dateStr, timeZone);
    const result = [];
    for (let i = 0; i < fixedCount; i++) {
      result.push(midnight + i * 3600000);
    }
    return result;
  }

  const midnightUtc = getZonedMidnight(dateStr, timeZone);
  const result = [];
  let currentUtc = midnightUtc;

  // Iterate hourly and collect all timestamps that fall within the specified local date
  while (true) {
    const parts = getTimeParts(currentUtc, timeZone);
    if (parts.isoDate !== dateStr) {
      break;
    }
    result.push(currentUtc);
    currentUtc += 3600000; // Step +1 hour in physical time

    // Safety guard to prevent runaway loops (no Earth day exceeds 26 hours)
    if (result.length >= 30) {
      break;
    }
  }

  // If dstAware is false, ensure exactly 24 hours are returned starting from midnight
  if (!dstAware && result.length !== 24) {
    const fixed = [];
    for (let i = 0; i < 24; i++) {
      fixed.push(midnightUtc + i * 3600000);
    }
    return fixed;
  }

  return result;
}

/**
 * Generate a single rich slot object for a given timezone and timestamp.
 * 
 * @param {Object} params
 * @param {string} params.targetTimezone - IANA timezone of the city row
 * @param {number} params.timestamp - UTC timestamp in milliseconds
 * @param {number} [params.index=0] - Column index in the grid
 * @param {string} [params.referenceDateStr] - Reference city's ISO date string ('YYYY-MM-DD')
 * @param {{ start: number, end: number }} [params.workingHours=DEFAULT_WORKING_HOURS]
 * @param {{ start: number, end: number }} [params.sleepHours=DEFAULT_SLEEP_HOURS]
 * @returns {Object} Complete slot descriptor
 */
export function generateSlot({
  targetTimezone,
  timestamp,
  index = 0,
  referenceDateStr = null,
  workingHours = DEFAULT_WORKING_HOURS,
  sleepHours = DEFAULT_SLEEP_HOURS,
}) {
  const parts = getTimeParts(timestamp, targetTimezone);
  const offsetMinutes = getTimezoneOffset(targetTimezone, timestamp);
  const offsetFormatted = formatTimezoneOffset(offsetMinutes);
  const abbreviation = getTimezoneAbbreviation(targetTimezone, timestamp);

  // Decimal hour accounts for fractional timezones (e.g. 9:30 AM = 9.5)
  const decimalHour = parts.hour + parts.minute / 60;
  const phase = getTimePhase(decimalHour, workingHours, sleepHours);
  const isWorkingHour = phase === PHASE_TYPES.WORK;
  const isSleepHour = phase === PHASE_TYPES.SLEEP;
  const isAwakeHour = phase === PHASE_TYPES.AWAKE;

  const refDate = referenceDateStr || parts.isoDate;
  const dateDifference = getDateDifference(parts.isoDate, refDate);
  const dayRollover = formatDateDifference(dateDifference);
  const dstActive = isDST(targetTimezone, timestamp);

  // Format compact hour string for row headers (e.g. "9 AM", "12 PM", "9:30 AM")
  const hourDisplay = parts.minute === 0
    ? `${parts.hour12} ${parts.ampm}`
    : `${parts.hour12}:${String(parts.minute).padStart(2, '0')} ${parts.ampm}`;

  return {
    index,
    timestamp,
    timeZone: targetTimezone,
    dateStr: parts.isoDate,
    referenceDateStr: refDate,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    hour12: parts.hour12,
    ampm: parts.ampm,
    minute: parts.minute,
    decimalHour,
    dayOfWeek: parts.dayOfWeek,
    dayOfWeekIndex: parts.dayOfWeekIndex,
    formattedTime12: parts.timeString12,
    formattedTime24: parts.timeString24,
    hourDisplay,
    offsetMinutes,
    offsetFormatted,
    abbreviation,
    phase,
    isWorkingHour,
    isSleepHour,
    isAwakeHour,
    dateDifference,
    dayRollover,
    isDST: dstActive,
  };
}

/**
 * Generate the full row of time slots for a city.
 * 
 * Can accept either an explicit array of UTC timestamps (aligned across all rows by the reference city),
 * or generate them dynamically from a reference date and reference timezone.
 * 
 * @param {Object} options
 * @param {string} options.targetTimezone - City timezone
 * @param {number[]} [options.timestamps] - Aligned UTC timestamps
 * @param {string} [options.referenceDate] - 'YYYY-MM-DD'
 * @param {string} [options.referenceTimezone] - Reference timezone
 * @param {{ start: number, end: number }} [options.workingHours]
 * @param {{ start: number, end: number }} [options.sleepHours]
 * @param {boolean} [options.dstAware=true]
 * @returns {Array<Object>} Array of slot descriptors
 */
export function generateCityRowSlots({
  targetTimezone,
  timestamps,
  referenceDate,
  referenceTimezone,
  workingHours = DEFAULT_WORKING_HOURS,
  sleepHours = DEFAULT_SLEEP_HOURS,
  dstAware = true,
}) {
  if (!isValidTimezone(targetTimezone)) {
    throw new Error(`Invalid target timezone: "${targetTimezone}"`);
  }

  let finalTimestamps = timestamps;
  let refDateStr = referenceDate;

  if (!finalTimestamps) {
    const baseTz = referenceTimezone || targetTimezone;
    refDateStr = referenceDate || getTimeParts(Date.now(), baseTz).isoDate;
    finalTimestamps = generateDayIntervals(refDateStr, baseTz, { dstAware });
  }

  if (!refDateStr && finalTimestamps.length > 0) {
    const baseTz = referenceTimezone || targetTimezone;
    refDateStr = getTimeParts(finalTimestamps[0], baseTz).isoDate;
  }

  return finalTimestamps.map((ts, idx) =>
    generateSlot({
      targetTimezone,
      timestamp: ts,
      index: idx,
      referenceDateStr: refDateStr,
      workingHours,
      sleepHours,
    })
  );
}

/**
 * Determines whether a slot in a city row should be rendered as a midnight date-change cell.
 *
 * Rules:
 * - Subsequent columns (`idx > 0`) with a preceding slot: true if and only if the local
 *   calendar date changed from the preceding slot (`slots[idx - 1].dateStr !== slot.dateStr`).
 * - Column 0 (`idx === 0`, or when `prevSlot` is unavailable): if `slot.timestamp`,
 *   `slot.timeZone`, and `slot.dateStr` are present, true if and only if the preceding
 *   physical hour (`slot.timestamp - 3600000`) fell on a different local calendar date.
 *   This handles both midnight Spring Forward transitions at column 0 (where `00:00` is
 *   skipped to `01:00`, e.g. America/Havana on 2026-03-08 or Asia/Beirut on 2026-03-29)
 *   and midnight Fall Back transitions at column 0 (where a secondary city is on the
 *   second `00:00` of a date that already started an hour earlier).
 *   Falls back to `slot.hour === 0` for lightweight mock objects without timestamps.
 *
 * @param {Object} slot
 * @param {number} [idx=0]
 * @param {Array<Object>} [slots=[]]
 * @returns {boolean}
 */
export function isMidnightSlot(slot, idx = 0, slots = []) {
  if (!slot) return false;
  if (idx > 0) {
    const prevSlot = slots?.[idx - 1];
    if (prevSlot && prevSlot.dateStr && slot.dateStr) {
      return prevSlot.dateStr !== slot.dateStr;
    }
  }
  if (typeof slot.timestamp === 'number' && slot.timeZone && slot.dateStr) {
    try {
      const prevHourDateStr = getTimeParts(slot.timestamp - 3600000, slot.timeZone).isoDate;
      return prevHourDateStr !== slot.dateStr;
    } catch {
      // fall through to slot.hour === 0
    }
  }
  return slot.hour === 0;
}

/**
 * Resolves the active/representative column index for header badges, relative offsets,
 * and timezone abbreviations across a city row.
 *
 * Priority:
 * 1. Explicit `activeColumnIndex` if provided
 * 2. Locked `selectedRange.startIndex`
 * 3. Active `hoveredIndex`
 * 4. Live `nowColumnIndex` (when viewing Today)
 * 5. Midday slot (`Math.floor(totalSlots / 2)`, i.e. ~12:00 PM in the reference city,
 *    which is safely past early-morning 00:00/01:00/02:00 DST transitions)
 *
 * @param {number} totalSlots
 * @param {Object} [options]
 * @param {number|null} [options.activeColumnIndex]
 * @param {number|null} [options.hoveredIndex]
 * @param {{ startIndex: number, endIndex?: number }|null} [options.selectedRange]
 * @param {number|null} [options.nowColumnIndex]
 * @returns {number} Clamped slot index in [0, Math.max(0, totalSlots - 1)]
 */
export function getRepresentativeSlotIndex(totalSlots, options = {}) {
  if (!totalSlots || totalSlots <= 0) return 0;
  const maxIdx = totalSlots - 1;
  const { activeColumnIndex, hoveredIndex, selectedRange, nowColumnIndex } = options;

  if (typeof activeColumnIndex === 'number' && !Number.isNaN(activeColumnIndex)) {
    return Math.min(maxIdx, Math.max(0, Math.floor(activeColumnIndex)));
  }
  if (
    selectedRange &&
    typeof selectedRange.startIndex === 'number' &&
    !Number.isNaN(selectedRange.startIndex)
  ) {
    return Math.min(maxIdx, Math.max(0, Math.floor(selectedRange.startIndex)));
  }
  if (typeof hoveredIndex === 'number' && !Number.isNaN(hoveredIndex)) {
    return Math.min(maxIdx, Math.max(0, Math.floor(hoveredIndex)));
  }
  if (typeof nowColumnIndex === 'number' && !Number.isNaN(nowColumnIndex)) {
    return Math.min(maxIdx, Math.max(0, Math.floor(nowColumnIndex)));
  }
  return Math.min(maxIdx, Math.max(0, Math.floor(totalSlots / 2)));
}

/**
 * Returns the representative slot object from a city's slot array for header badges
 * (offset and timezone abbreviation).
 *
 * @param {Array<Object>} slots
 * @param {Object} [options]
 * @returns {Object|null}
 */
export function getRepresentativeSlot(slots, options = {}) {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const idx = getRepresentativeSlotIndex(slots.length, options);
  return slots[idx] || slots[0] || null;
}

/**
 * Sorts an array of city objects by their UTC offset at the given reference timestamp,
 * preserving the primary/home city flag (`isPrimary`) and relative order on ties.
 *
 * @param {Array<Object>} cities
 * @param {'asc'|'desc'} [direction='asc'] - 'asc' (West -> East) or 'desc' (East -> West)
 * @param {Date|number|string} [referenceTimestamp=Date.now()]
 * @returns {Array<Object>}
 */
export function sortCitiesByOffset(cities, direction = 'asc', referenceTimestamp = Date.now()) {
  if (!Array.isArray(cities) || cities.length <= 1) {
    return Array.isArray(cities) ? [...cities] : [];
  }
  const currentPrimaryId = (cities.find((c) => c.isPrimary) || cities[0])?.id;
  const ts = referenceTimestamp ?? Date.now();

  return cities
    .map((c, idx) => {
      let offset = 0;
      try {
        offset = getTimezoneOffset(c.timeZone, ts);
      } catch {
        offset = 0;
      }
      return {
        city: {
          ...c,
          isPrimary: c.id === currentPrimaryId,
        },
        offset,
        idx,
      };
    })
    .sort((a, b) => {
      const diff = direction === 'desc' ? b.offset - a.offset : a.offset - b.offset;
      if (diff !== 0) return diff;
      return a.idx - b.idx;
    })
    .map((item) => item.city);
}

