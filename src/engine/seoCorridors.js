/**
 * TimeRows - Programmatic SEO Corridor Metadata & Pre-render Data Engine
 *
 * Pure functions (zero React dependency) that compute accurate IANA timezone
 * comparisons, working-hour overlap summaries, 24-hour conversion tables,
 * quick hour-lookup callouts, JSON-LD structured data, and XML sitemaps
 * for `/from/:cityA/to/:cityB` routes.
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
import { formatSmartTimeSpan, compactTimeStr } from './overlapFormat.js';
import { resolveCityFromToken, buildCityPairPath } from './urlSync.js';

// Search-intent colloquial labels (matches how users search: "NYC", "SF", "UK", "Bangalore", etc.)
const CITY_SEARCH_TAG = Object.freeze({
  'new-york': 'New York (NYC)',
  'san-francisco': 'San Francisco (SF)',
  'los-angeles': 'Los Angeles (LA)',
  washington: 'Washington (DC)',
  london: 'London (UK)',
  bengaluru: 'Bengaluru (Bangalore)',
  'ho-chi-minh-city': 'Ho Chi Minh City (Saigon)',
});

const CITY_SHORT_NAME = Object.freeze({
  'new-york': 'NYC',
  'san-francisco': 'SF',
  'los-angeles': 'LA',
  washington: 'DC',
  london: 'London',
  bengaluru: 'Bangalore',
});

export const SEO_CORRIDORS = Object.freeze([
  // Tier 1: Highest global search volume corridors (bidirectional)
  { from: 'new-york', to: 'london', priority: '0.9' },
  { from: 'london', to: 'new-york', priority: '0.9' },
  { from: 'san-francisco', to: 'london', priority: '0.9' },
  { from: 'london', to: 'san-francisco', priority: '0.9' },
  { from: 'new-york', to: 'tokyo', priority: '0.9' },
  { from: 'tokyo', to: 'new-york', priority: '0.9' },
  { from: 'new-york', to: 'paris', priority: '0.9' },
  { from: 'paris', to: 'new-york', priority: '0.8' },
  { from: 'new-york', to: 'berlin', priority: '0.9' },
  { from: 'berlin', to: 'new-york', priority: '0.8' },
  { from: 'london', to: 'singapore', priority: '0.9' },
  { from: 'singapore', to: 'london', priority: '0.8' },
  { from: 'san-francisco', to: 'bengaluru', priority: '0.9' },
  { from: 'bengaluru', to: 'san-francisco', priority: '0.8' },
  { from: 'new-york', to: 'san-francisco', priority: '0.9' },
  { from: 'san-francisco', to: 'new-york', priority: '0.9' },

  // US <-> Europe corridors
  { from: 'los-angeles', to: 'london', priority: '0.8' },
  { from: 'london', to: 'los-angeles', priority: '0.8' },
  { from: 'chicago', to: 'london', priority: '0.8' },
  { from: 'london', to: 'chicago', priority: '0.8' },
  { from: 'toronto', to: 'london', priority: '0.8' },
  { from: 'boston', to: 'london', priority: '0.8' },
  { from: 'seattle', to: 'london', priority: '0.8' },
  { from: 'austin', to: 'london', priority: '0.8' },
  { from: 'miami', to: 'london', priority: '0.8' },
  { from: 'denver', to: 'london', priority: '0.8' },
  { from: 'vancouver', to: 'london', priority: '0.8' },
  { from: 'new-york', to: 'dublin', priority: '0.8' },
  { from: 'new-york', to: 'amsterdam', priority: '0.8' },
  { from: 'new-york', to: 'zurich', priority: '0.8' },
  { from: 'new-york', to: 'madrid', priority: '0.8' },
  { from: 'new-york', to: 'rome', priority: '0.8' },
  { from: 'new-york', to: 'stockholm', priority: '0.8' },
  { from: 'new-york', to: 'warsaw', priority: '0.8' },
  { from: 'san-francisco', to: 'berlin', priority: '0.8' },
  { from: 'san-francisco', to: 'paris', priority: '0.8' },
  { from: 'san-francisco', to: 'amsterdam', priority: '0.8' },
  { from: 'san-francisco', to: 'dublin', priority: '0.8' },
  { from: 'san-francisco', to: 'zurich', priority: '0.8' },

  // US <-> Asia-Pacific & India corridors
  { from: 'san-francisco', to: 'tokyo', priority: '0.8' },
  { from: 'tokyo', to: 'san-francisco', priority: '0.8' },
  { from: 'los-angeles', to: 'tokyo', priority: '0.8' },
  { from: 'new-york', to: 'bengaluru', priority: '0.8' },
  { from: 'bengaluru', to: 'new-york', priority: '0.8' },
  { from: 'new-york', to: 'mumbai', priority: '0.8' },
  { from: 'san-francisco', to: 'mumbai', priority: '0.8' },
  { from: 'san-francisco', to: 'hyderabad', priority: '0.8' },
  { from: 'new-york', to: 'new-delhi', priority: '0.8' },
  { from: 'san-francisco', to: 'singapore', priority: '0.8' },
  { from: 'singapore', to: 'san-francisco', priority: '0.8' },
  { from: 'new-york', to: 'singapore', priority: '0.8' },
  { from: 'new-york', to: 'hong-kong', priority: '0.8' },
  { from: 'san-francisco', to: 'hong-kong', priority: '0.8' },
  { from: 'san-francisco', to: 'seoul', priority: '0.8' },
  { from: 'new-york', to: 'seoul', priority: '0.8' },
  { from: 'san-francisco', to: 'taipei', priority: '0.8' },
  { from: 'new-york', to: 'manila', priority: '0.8' },
  { from: 'los-angeles', to: 'manila', priority: '0.8' },
  { from: 'new-york', to: 'sydney', priority: '0.8' },
  { from: 'sydney', to: 'new-york', priority: '0.8' },
  { from: 'san-francisco', to: 'sydney', priority: '0.8' },
  { from: 'los-angeles', to: 'sydney', priority: '0.8' },
  { from: 'san-francisco', to: 'auckland', priority: '0.8' },

  // Europe <-> Asia-Pacific & Middle East corridors
  { from: 'london', to: 'tokyo', priority: '0.8' },
  { from: 'tokyo', to: 'london', priority: '0.8' },
  { from: 'london', to: 'sydney', priority: '0.8' },
  { from: 'sydney', to: 'london', priority: '0.8' },
  { from: 'london', to: 'dubai', priority: '0.8' },
  { from: 'dubai', to: 'london', priority: '0.8' },
  { from: 'london', to: 'bengaluru', priority: '0.8' },
  { from: 'london', to: 'mumbai', priority: '0.8' },
  { from: 'london', to: 'hong-kong', priority: '0.8' },
  { from: 'berlin', to: 'tokyo', priority: '0.8' },
  { from: 'singapore', to: 'sydney', priority: '0.8' },
  { from: 'tokyo', to: 'singapore', priority: '0.8' },

  // Middle East, Americas & UTC corridors
  { from: 'new-york', to: 'tel-aviv', priority: '0.8' },
  { from: 'san-francisco', to: 'tel-aviv', priority: '0.8' },
  { from: 'new-york', to: 'dubai', priority: '0.8' },
  { from: 'new-york', to: 'sao-paulo', priority: '0.8' },
  { from: 'new-york', to: 'mexico-city', priority: '0.8' },
  { from: 'new-york', to: 'toronto', priority: '0.8' },
  { from: 'new-york', to: 'chicago', priority: '0.8' },
  { from: 'new-york', to: 'utc', priority: '0.8' },
  { from: 'san-francisco', to: 'utc', priority: '0.8' },
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
 * Computes full SEO metadata, overlap summary, quick hour conversions, 24-hour comparison rows,
 * and FAQ items for a city-pair route (`/from/:fromSlug/to/:toSlug`).
 *
 * @param {string} fromSlug
 * @param {string} toSlug
 * @param {string} [referenceDate='2026-11-05']
 * @returns {Object | null}
 */
export function buildCorridorSeoData(fromSlug, toSlug, referenceDate = '2026-11-05') {
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
    { id: fromCity.id, name: fromCity.name, timeZone: fromCity.timeZone, slots: fromSlots },
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

  const fromDisplayTag = CITY_SEARCH_TAG[fromSlug] || fromCity.name;
  const toDisplayTag = CITY_SEARCH_TAG[toSlug] || toCity.name;
  const fromShort = CITY_SHORT_NAME[fromSlug] || fromCity.name;
  const toShort = CITY_SHORT_NAME[toSlug] || toCity.name;

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

  const hourlyRows = fromSlots.map((fromSlot, idx) => {
    const toSlot = toSlots[idx] || fromSlot;
    const overlap = timelineOverlaps[idx];
    return {
      hour: fromSlot.hour,
      fromTime: compactTimeStr(fromSlot.hourDisplay || fromSlot.formattedTime12),
      toTime: compactTimeStr(toSlot.hourDisplay || toSlot.formattedTime12),
      fromPhase: fromSlot.phase,
      toPhase: toSlot.phase,
      dayDelta: toSlot.dateDifference || 0,
      isGolden: Boolean(overlap?.isGolden),
    };
  });

  // Extract common business-hour lookups (9am, 10am, 12pm, 1pm, 3pm, 5pm) that people type into Google
  const keyHours = [9, 10, 12, 13, 15, 17];
  const quickConversions = keyHours
    .map((h) => hourlyRows.find((r) => r.hour === h))
    .filter(Boolean)
    .map((r) => {
      const dTag = r.dayDelta > 0 ? ' (+1d)' : r.dayDelta < 0 ? ' (-1d)' : '';
      return {
        fromLabel: `${r.fromTime} ${fromShort}`,
        toLabel: `${r.toTime}${dTag} ${toShort}`,
        text: `${r.fromTime} ${fromShort} = ${r.toTime}${dTag} ${toShort}`,
      };
    });

  const sampleConversionsInline = quickConversions
    .slice(0, 3)
    .map((q) => q.text)
    .join(', ');

  const title = `${fromDisplayTag} to ${toDisplayTag} Time Difference (${offsetBadge}) & Converter — TimeRows`;
  const description = `${toDisplayTag} is ${offsetPhrase} (${offsetBadge}). ${overlapHeadline}${
    sampleConversionsInline ? ` Quick reference: ${sampleConversionsInline}.` : ''
  }`;

  const faqs = [
    {
      question: `What is the time difference between ${fromDisplayTag} and ${toDisplayTag}?`,
      answer: `${toDisplayTag} (${toCity.timeZone}) is ${offsetPhrase} (${fromCity.timeZone}), an offset of ${offsetBadge}. TimeRows calculates conversions using official IANA timezone rules so Daylight Saving Time transitions are handled automatically.`,
    },
    {
      question: `What is the best time to schedule a meeting between ${fromCity.name} and ${toCity.name}?`,
      answer: `${overlapHeadline}${
        sampleConversionsInline ? ` Common times: ${sampleConversionsInline}.` : ''
      }`,
    },
    {
      question: `What time is 9 am, 10 am, and 1 pm ${fromShort} time in ${toCity.name}?`,
      answer: quickConversions.length
        ? quickConversions.map((q) => q.text).join(' · ')
        : `Use the 24-hour visual track above to convert any hour between ${fromCity.name} and ${toCity.name}.`,
    },
  ];

  return {
    fromSlug,
    toSlug,
    fromCity,
    toCity,
    fromDisplayTag,
    toDisplayTag,
    canonicalPath,
    canonicalUrl,
    title,
    description,
    offsetBadge,
    offsetPhrase,
    overlapHours,
    overlapHeadline,
    quickConversions,
    hourlyRows,
    faqs,
  };
}

/**
 * Generates a valid XML sitemap for the homepage, all curated city-pair corridors,
 * and static documentation/legal pages.
 *
 * @param {Array<{ from: string, to: string, priority?: string }>} [corridors=SEO_CORRIDORS]
 * @param {string} [lastmod='2026-11-05']
 * @returns {string}
 */
export function buildSitemapXml(corridors = SEO_CORRIDORS, lastmod = '2026-11-05') {
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
