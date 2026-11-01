/**
 * TimeRows - Overlap Formatting Helpers
 *
 * Pure presentation helpers for meeting-window summaries (compact time spans,
 * grouping cities that share a local span, and choosing a genuine alternative
 * window). Zero React dependencies.
 */

const ALT_ELIGIBLE_QUALITIES = new Set(['golden', 'good']);

/**
 * Compacts a 12h time string: "8:00 AM" -> "8 am", "9:30 AM" -> "9:30 am".
 * 24h strings are returned untouched.
 */
export function compactTimeStr(timeStr, use24Hour = false) {
  if (!timeStr) return '';
  if (use24Hour) return timeStr;
  return timeStr
    .replace(/:00\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Parses a compact or raw 12h time string ("8 am", "12:30 pm", "12 am") into
 * minutes since midnight (0..1439), or null if it cannot be parsed.
 */
function parse12hMinutes(str) {
  const m = String(str || '')
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3];
  if (hour === 12) {
    hour = meridiem === 'am' ? 0 : 12;
  } else if (meridiem === 'pm') {
    hour += 12;
  }
  return hour * 60 + min;
}

/**
 * Formats a start/end pair, collapsing a shared meridiem only when end is
 * strictly later within the same half-day: "12–5 pm", "8 am–1 pm",
 * "7:30 am–1:30 am".
 */
export function formatSmartTimeSpan(startRaw, endRaw, use24Hour = false) {
  if (use24Hour) return `${startRaw}–${endRaw}`;
  const s = compactTimeStr(startRaw, false);
  const e = compactTimeStr(endRaw, false);
  const sMatch = s.match(/^(.+?)\s*(am|pm)$/);
  const eMatch = e.match(/^(.+?)\s*(am|pm)$/);
  if (sMatch && eMatch && sMatch[2] === eMatch[2]) {
    const startMin = parse12hMinutes(s);
    const endMin = parse12hMinutes(e);
    if (startMin !== null && endMin !== null && endMin > startMin) {
      return `${sMatch[1]}–${eMatch[1]} ${sMatch[2]}`;
    }
  }
  return `${s}–${e}`;
}

/**
 * Groups city summaries that share an identical local span so the headline
 * reads "12–5 pm London / UTC" instead of repeating the same span.
 * Appends (+1d) when a city's window crosses midnight into the next local day.
 */
export function groupCitySummariesByTime(citySummaries = [], use24Hour = false) {
  const groups = [];
  for (const c of citySummaries || []) {
    const baseSpan = use24Hour
      ? formatSmartTimeSpan(c.startTime24, c.endTime24, true)
      : formatSmartTimeSpan(c.startTime, c.endTime, false);
    const rolloverSuffix = c.endDayDelta > 0 ? ` (+${c.endDayDelta}d)` : '';
    const spanStr = `${baseSpan}${rolloverSuffix}`;
    const displayCity = c.cityName === 'UTC / GMT' ? 'UTC' : c.cityName;
    const existing = groups.find((g) => g.spanStr === spanStr);
    if (existing) {
      if (!existing.cities.includes(displayCity)) {
        existing.cities.push(displayCity);
      }
    } else {
      groups.push({ spanStr, cities: [displayCity] });
    }
  }
  return groups;
}

/**
 * Picks a genuine alternative meeting window: it must be Golden/Good quality and
 * separated from the primary window by at least `minGapHours` (adjacent windows
 * are just extensions of the primary window, not alternatives).
 *
 * @param {Object|null} primary - Primary window ({ startIndex, endIndex })
 * @param {Array<Object>} candidates - Candidate windows in priority order
 * @param {{ minGapHours?: number }} [options]
 * @returns {Object|null}
 */
export function pickAlternativeWindow(primary, candidates = [], options = {}) {
  const { minGapHours = 1 } = options;
  if (!primary || !Array.isArray(candidates)) return null;

  return (
    candidates.find((w) => {
      if (!w || !ALT_ELIGIBLE_QUALITIES.has(w.quality)) return false;
      const gapAfter = w.startIndex - primary.endIndex - 1;
      const gapBefore = primary.startIndex - w.endIndex - 1;
      return gapAfter >= minGapHours || gapBefore >= minGapHours;
    }) || null
  );
}

/**
 * Returns the reference (Home) city's summary from a window, falling back to the first city.
 */
export function getReferenceSummary(win, referenceCityId) {
  const summaries = win?.citySummaries;
  if (!Array.isArray(summaries) || summaries.length === 0) return null;
  return summaries.find((s) => s.cityId === referenceCityId) || summaries[0];
}
