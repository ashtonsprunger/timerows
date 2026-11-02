/**
 * TimeRows - Programmatic SEO Corridor Metadata & Pre-render Data Engine
 *
 * Pure functions (zero React dependency) that compute accurate IANA timezone
 * comparisons, working-hour overlap summaries, 24-hour conversion tables,
 * JSON-LD structured data, and XML sitemaps for `/from/:cityA/to/:cityB` routes.
 */

import {
  generateDayIntervals,
  generateCityRowSlots,
  getTimezoneOffset,
  DEFAULT_WORKING_HOURS,
} from './timezoneEngine.js';
import {
  calculateTimelineOverlaps,
  findBestMeetingWindows,
  findBestCompromiseWindow,
  buildCustomMeetingWindow,
} from './overlapEngine.js';
import { formatSmartTimeSpan } from './overlapFormat.js';
import { resolveCityFromToken, buildCityPairPath } from './urlSync.js';

export const SEO_CORRIDORS = Object.freeze([
  { from: 'new-york', to: 'london', priority: '0.9' },
  { from: 'san-francisco', to: 'london', priority: '0.9' },
  { from: 'new-york', to: 'tokyo', priority: '0.9' },
  { from: 'london', to: 'singapore', priority: '0.9' },
  { from: 'san-francisco', to: 'bengaluru', priority: '0.9' },
  { from: 'new-york', to: 'berlin', priority: '0.8' },
  { from: 'san-francisco', to: 'tokyo', priority: '0.8' },
  { from: 'london', to: 'new-york', priority: '0.8' },
  { from: 'london', to: 'sydney', priority: '0.8' },
  { from: 'new-york', to: 'paris', priority: '0.8' },
  { from: 'new-york', to: 'bengaluru', priority: '0.8' },
  { from: 'san-francisco', to: 'singapore', priority: '0.8' },
  { from: 'london', to: 'dubai', priority: '0.8' },
  { from: 'new-york', to: 'sydney', priority: '0.8' },
  { from: 'chicago', to: 'london', priority: '0.8' },
  { from: 'toronto', to: 'london', priority: '0.8' },
  { from: 'london', to: 'tokyo', priority: '0.8' },
  { from: 'berlin', to: 'new-york', priority: '0.8' },
  { from: 'san-francisco', to: 'berlin', priority: '0.8' },
  { from: 'new-york', to: 'sao-paulo', priority: '0.8' },
]);

/**
 * Formats a minute difference into a human-readable relative offset phrase.
 *
 * @param {number} diffMinutes - Target offset minus reference offset in minutes
 * @param {string} fromName
 * @returns {{ badge: string, phrase: string }}
 */
export function formatRelativeOffset(diffMinutes, fromName) {
  if (!Number.isFinite(diffMinutes) || diffMinutes === 0) {
    return {
      badge: '0h',
      phrase: `the same time as ${fromName}`,
    };
  }
  const absMinutes = Math.abs(diffMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  const sign = diffMinutes > 0 ? '+' : '-';
  const direction = diffMinutes > 0 ? 'ahead of' : 'behind';

  const hoursLabel =
    mins === 0
      ? `${hours} ${hours === 1 ? 'hour' : 'hours'}`
      : `${hours}:${String(mins).padStart(2, '0')} hours`;
  const badge =
    mins === 0 ? `${sign}${hours}h` : `${sign}${hours}:${String(mins).padStart(2, '0')}`;

  return {
    badge,
    phrase: `${hoursLabel} ${direction} ${fromName}`,
  };
}

/**
 * Computes full SEO metadata, overlap summary, 24-hour comparison rows, and FAQ items
 * for a city-pair route (`/from/:fromSlug/to/:toSlug`).
 *
 * @param {string} fromSlug
 * @param {string} toSlug
 * @param {string} [referenceDate='2026-10-31']
 * @returns {Object | null}
 */
export function buildCorridorSeoData(fromSlug, toSlug, referenceDate = '2026-10-31') {
  const fromCity = resolveCityFromToken(fromSlug, 0);
  const toCity = resolveCityFromToken(toSlug, 1);
  if (!fromCity || !toCity) return null;

  const canonicalPath = buildCityPairPath(fromSlug, toSlug);
  const canonicalUrl = `https://timerows.com${canonicalPath}`;

  const timestamps = generateDayIntervals(referenceDate, fromCity.timeZone, { dstAware: true });
  const fromSlots = generateCityRowSlots({
    targetTimezone: fromCity.timeZone,
    timestamps,
    referenceDate,
    referenceTimezone: fromCity.timeZone,
    workingHours: DEFAULT_WORKING_HOURS,
  });
  const toSlots = generateCityRowSlots({
    targetTimezone: toCity.timeZone,
    timestamps,
    referenceDate,
    referenceTimezone: fromCity.timeZone,
    workingHours: DEFAULT_WORKING_HOURS,
  });

  const timelineOverlaps = calculateTimelineOverlaps([
    {
      id: fromCity.id,
      name: fromCity.name,
      timeZone: fromCity.timeZone,
      isPrimary: true,
      slots: fromSlots,
    },
    { id: toCity.id, name: toCity.name, timeZone: toCity.timeZone, slots: toSlots },
  ]);

  // Find longest contiguous golden overlap window
  let longestGoldenSpan = null;
  let currentSpan = null;
  for (let i = 0; i < timelineOverlaps.length; i++) {
    if (timelineOverlaps[i]?.isGolden) {
      if (!currentSpan) {
        currentSpan = { startIndex: i, endIndex: i };
      } else {
        currentSpan.endIndex = i;
      }
    } else if (currentSpan) {
      if (
        !longestGoldenSpan ||
        currentSpan.endIndex - currentSpan.startIndex >
          longestGoldenSpan.endIndex - longestGoldenSpan.startIndex
      ) {
        longestGoldenSpan = currentSpan;
      }
      currentSpan = null;
    }
  }
  if (
    currentSpan &&
    (!longestGoldenSpan ||
      currentSpan.endIndex - currentSpan.startIndex >
        longestGoldenSpan.endIndex - longestGoldenSpan.startIndex)
  ) {
    longestGoldenSpan = currentSpan;
  }

  const goldenWindow = longestGoldenSpan
    ? buildCustomMeetingWindow(
        timelineOverlaps,
        longestGoldenSpan.startIndex,
        longestGoldenSpan.endIndex
      )
    : null;
  const bestWindows = findBestMeetingWindows(timelineOverlaps, {
    maxResults: 1,
    minDurationHours: 1,
    referenceCityId: fromCity.id,
    referenceTimezone: fromCity.timeZone,
  });
  const compromiseWindow = findBestCompromiseWindow(timelineOverlaps);
  const primaryWindow = goldenWindow || bestWindows[0] || compromiseWindow;

  const sampleTimestamp = timestamps[12] || timestamps[0] || Date.now();
  const fromOffsetMin = getTimezoneOffset(fromCity.timeZone, sampleTimestamp);
  const toOffsetMin = getTimezoneOffset(toCity.timeZone, sampleTimestamp);
  const diffMinutes = toOffsetMin - fromOffsetMin;
  const { badge: offsetBadge, phrase: offsetPhrase } = formatRelativeOffset(
    diffMinutes,
    fromCity.name
  );

  let overlapHeadline = `Compare 24-hour working hours between ${fromCity.name} and ${toCity.name}.`;
  let overlapHours = 0;

  if (primaryWindow && Array.isArray(primaryWindow.citySummaries)) {
    const fromSum = primaryWindow.citySummaries[0];
    const toSum = primaryWindow.citySummaries[1];
    if (fromSum && toSum) {
      const fromSpan = formatSmartTimeSpan(fromSum.startTime, fromSum.endTime);
      const toSpan = formatSmartTimeSpan(toSum.startTime, toSum.endTime);
      overlapHours = goldenWindow ? goldenWindow.durationHours : 0;
      if (goldenWindow) {
        overlapHeadline = `Best working-hours overlap (${overlapHours}h): ${fromSpan} in ${fromCity.name} (${toSpan} in ${toCity.name}).`;
      } else {
        overlapHeadline = `Suggested meeting window: ${fromSpan} in ${fromCity.name} (${toSpan} in ${toCity.name}).`;
      }
    }
  }

  const title = `${fromCity.name} to ${toCity.name} Time Converter & Overlap — TimeRows`;
  const description = `Convert time between ${fromCity.name} (${fromCity.timeZone}) and ${toCity.name} (${toCity.timeZone}). ${toCity.name} is ${offsetPhrase}. ${overlapHeadline}`;

  const hourlyRows = fromSlots.map((fromSlot, idx) => {
    const toSlot = toSlots[idx] || fromSlot;
    const overlap = timelineOverlaps[idx];
    return {
      fromTime: fromSlot.hourDisplay || fromSlot.formattedTime12,
      toTime: toSlot.hourDisplay || toSlot.formattedTime12,
      fromPhase: fromSlot.phase,
      toPhase: toSlot.phase,
      dayDelta: toSlot.dateDifference || 0,
      isGolden: Boolean(overlap?.isGolden),
    };
  });

  const faqs = [
    {
      question: `What is the time difference between ${fromCity.name} and ${toCity.name}?`,
      answer: `${toCity.name} (${toCity.timeZone}) is ${offsetPhrase} (${fromCity.timeZone}), a difference of ${offsetBadge}. TimeRows uses official IANA timezone rules so Daylight Saving Time transitions are applied automatically.`,
    },
    {
      question: `What is the best time to schedule a meeting between ${fromCity.name} and ${toCity.name}?`,
      answer: overlapHeadline,
    },
    {
      question: `How do I share a ${fromCity.name} and ${toCity.name} meeting invite?`,
      answer: `Click or drag across any hours on the TimeRows timeline above to select a meeting window, then click Share to copy a permalink, Slack snippet, Google Calendar link, or RFC 5545 .ics calendar file.`,
    },
  ];

  return {
    fromSlug,
    toSlug,
    fromCity,
    toCity,
    canonicalPath,
    canonicalUrl,
    title,
    description,
    offsetBadge,
    offsetPhrase,
    overlapHours,
    overlapHeadline,
    hourlyRows,
    faqs,
  };
}

/**
 * Generates a valid XML sitemap for the homepage, all curated city-pair corridors,
 * and static documentation/legal pages.
 *
 * @param {Array<{ from: string, to: string, priority?: string }>} [corridors=SEO_CORRIDORS]
 * @param {string} [lastmod='2026-10-31']
 * @returns {string}
 */
export function buildSitemapXml(corridors = SEO_CORRIDORS, lastmod = '2026-10-31') {
  const entries = [
    {
      loc: 'https://timerows.com/',
      lastmod,
      changefreq: 'daily',
      priority: '1.0',
    },
    ...corridors.map((pair) => ({
      loc: `https://timerows.com${buildCityPairPath(pair.from, pair.to)}`,
      lastmod,
      changefreq: 'weekly',
      priority: pair.priority || '0.8',
    })),
    {
      loc: 'https://timerows.com/about.html',
      lastmod,
      changefreq: 'monthly',
      priority: '0.5',
    },
    {
      loc: 'https://timerows.com/privacy.html',
      lastmod,
      changefreq: 'yearly',
      priority: '0.4',
    },
  ];

  const urlsXml = entries
    .map(
      (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;
}
