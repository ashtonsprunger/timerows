/**
 * TimeRows - Overlap Engine
 * 
 * Algorithmic engine for multi-city working-hour overlap detection,
 * meeting window scoring, ranking, and formatting.
 * Zero React dependencies.
 */

import { PHASE_TYPES, getTimeParts } from './timezoneEngine.js';

/**
 * Computes how many local calendar days later `endTimestamp` falls compared to
 * `startTimestamp` in `timeZone`. Uses `endTimestamp - 1` so an exact midnight
 * boundary (00:00) at the end of an evening meeting stays on the same day,
 * whereas any span continuing past midnight into the next day returns >= 1.
 */
function computeSpanDayDelta(startTimestamp, endTimestamp, timeZone) {
  if (!startTimestamp || !endTimestamp || !timeZone) return 0;
  try {
    const startParts = getTimeParts(startTimestamp, timeZone);
    const endParts = getTimeParts(Math.max(startTimestamp, endTimestamp - 1), timeZone);
    const startUtcMidnight = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
    const endUtcMidnight = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
    return Math.max(0, Math.round((endUtcMidnight - startUtcMidnight) / 86400000));
  } catch {
    return 0;
  }
}

export const OVERLAP_QUALITY = Object.freeze({
  GOLDEN: 'golden',        // All cities in core working hours
  GOOD: 'good',            // All cities awake, majority in working hours
  COMPROMISE: 'compromise',// All cities awake, but some in off-hours
  POOR: 'poor',            // At least one city is in sleep phase
});

/**
 * Normalizes city input to extract slot array and metadata.
 * @param {Array<Object>|Object} cityInput
 * @returns {{ id: string, name: string, timeZone: string, slots: Array<Object> }}
 */
function normalizeCityRow(cityInput, index) {
  if (Array.isArray(cityInput)) {
    const firstSlot = cityInput[0] || {};
    return {
      id: `city-${index}`,
      name: firstSlot.timeZone || `City ${index + 1}`,
      timeZone: firstSlot.timeZone || 'UTC',
      isPrimary: index === 0,
      slots: cityInput,
    };
  }

  return {
    id: cityInput.id || `city-${index}`,
    name: cityInput.name || cityInput.cityName || cityInput.timeZone || `City ${index + 1}`,
    timeZone: cityInput.timeZone || (cityInput.slots?.[0]?.timeZone) || 'UTC',
    isPrimary: Boolean(cityInput.isPrimary),
    slots: cityInput.slots || [],
  };
}

/**
 * Evaluates the overlap status of a single time column across all cities.
 * 
 * @param {Array<Object>} columnSlots - The slot descriptor from each city at this column index
 * @param {number} columnIndex - Index of this column in the timeline
 * @returns {Object} Column overlap evaluation
 */
export function evaluateColumnOverlap(columnSlots, columnIndex = 0) {
  if (!columnSlots || columnSlots.length === 0) {
    return {
      slotIndex: columnIndex,
      timestamp: 0,
      totalCities: 0,
      workingCount: 0,
      awakeCount: 0,
      sleepCount: 0,
      isGolden: false,
      isViable: false,
      quality: OVERLAP_QUALITY.POOR,
      score: 0,
      cityStatuses: [],
    };
  }

  const totalCities = columnSlots.length;
  let workingCount = 0;
  let awakeCount = 0;
  let sleepCount = 0;
  const timestamp = columnSlots[0]?.timestamp || 0;

  const cityStatuses = columnSlots.map((slot) => {
    const phase = slot.phase || (slot.isWorkingHour ? PHASE_TYPES.WORK : (slot.isSleepHour ? PHASE_TYPES.SLEEP : PHASE_TYPES.AWAKE));
    if (phase === PHASE_TYPES.WORK) workingCount++;
    else if (phase === PHASE_TYPES.SLEEP) sleepCount++;
    else awakeCount++;

    return {
      cityId: slot.cityId,
      cityName: slot.cityName,
      timeZone: slot.timeZone,
      isPrimary: Boolean(slot.isPrimary),
      hour: slot.hour,
      decimalHour: slot.decimalHour,
      phase,
      isWorkingHour: phase === PHASE_TYPES.WORK,
      isSleepHour: phase === PHASE_TYPES.SLEEP,
      isAwakeHour: phase === PHASE_TYPES.AWAKE,
      formattedTime12: slot.formattedTime12,
      formattedTime24: slot.formattedTime24,
      hourDisplay: slot.hourDisplay,
      dayRollover: slot.dayRollover || '',
      dateDifference: slot.dateDifference || 0,
      dateStr: slot.dateStr,
    };
  });

  const isGolden = workingCount === totalCities;
  const isViable = sleepCount === 0;

  let quality = OVERLAP_QUALITY.POOR;
  let score = 0;

  if (isGolden) {
    quality = OVERLAP_QUALITY.GOLDEN;
    score = 100;
  } else if (isViable) {
    const workingRatio = workingCount / totalCities;
    if (workingRatio >= 0.5) {
      quality = OVERLAP_QUALITY.GOOD;
    } else {
      quality = OVERLAP_QUALITY.COMPROMISE;
    }
    // Viable score range: 40 to 95
    score = Math.round(40 + (workingCount / totalCities) * 50 + (awakeCount / totalCities) * 5);
  } else {
    quality = OVERLAP_QUALITY.POOR;
    // Penalty for each sleeping city
    score = Math.max(0, 20 - sleepCount * 10);
  }

  return {
    slotIndex: columnIndex,
    timestamp,
    totalCities,
    workingCount,
    awakeCount,
    sleepCount,
    isGolden,
    isViable,
    quality,
    score,
    cityStatuses,
  };
}

/**
 * Evaluates overlap across all columns for a set of city rows.
 * 
 * @param {Array<Object|Array<Object>>} cityRows - Array of city objects with `slots` or array of slot arrays
 * @returns {Array<Object>} Evaluated column descriptors
 */
export function calculateTimelineOverlaps(cityRows) {
  if (!cityRows || cityRows.length === 0) return [];

  const normalized = cityRows.map(normalizeCityRow);
  const columnCount = normalized[0]?.slots?.length || 0;
  const evaluatedColumns = [];

  for (let colIdx = 0; colIdx < columnCount; colIdx++) {
    const columnSlots = normalized.map((city) => {
      const slot = city.slots[colIdx];
      return {
        ...slot,
        cityId: city.id,
        cityName: city.name,
        isPrimary: city.isPrimary,
      };
    });

    evaluatedColumns.push(evaluateColumnOverlap(columnSlots, colIdx));
  }

  return evaluatedColumns;
}

/**
 * Find the best meeting windows across evaluated timeline columns.
 * Identifies contiguous blocks of viable slots and ranks the top windows.
 * 
 * @param {Array<Object>} evaluatedColumns - Output from calculateTimelineOverlaps
 * @param {Object} [options]
 * @param {number} [options.minDurationHours=1] - Minimum meeting duration in hours
 * @param {number} [options.maxDurationHours=4] - Maximum window size to consider
 * @param {number} [options.targetDurationHours] - If specified, returns windows of exact duration
 * @param {number} [options.maxResults=3] - Maximum number of top windows to return
 * @param {string} [options.referenceCityId] - Optional ID of reference city
 * @param {string} [options.referenceTimezone] - Optional IANA timezone of reference city
 * @returns {Array<Object>} Ranked meeting window objects
 */
export function findBestMeetingWindows(evaluatedColumns, options = {}) {
  const {
    minDurationHours = 1,
    maxDurationHours = 4,
    targetDurationHours = null,
    maxResults = 3,
    referenceCityId = null,
    referenceTimezone = null,
  } = options;

  if (!evaluatedColumns || evaluatedColumns.length === 0) return [];

  const candidateWindows = [];
  const minDur = targetDurationHours || minDurationHours;
  const maxDur = targetDurationHours || maxDurationHours;

  // Scan all contiguous sub-arrays of duration between minDur and maxDur
  for (let start = 0; start < evaluatedColumns.length; start++) {
    for (let dur = minDur; dur <= maxDur; dur++) {
      const end = start + dur - 1;
      if (end >= evaluatedColumns.length) break;

      const windowSlots = evaluatedColumns.slice(start, end + 1);
      
      // A meeting window cannot have any participant asleep
      const hasSleep = windowSlots.some((slot) => !slot.isViable);
      if (hasSleep) continue;

      const allGolden = windowSlots.every((slot) => slot.isGolden);
      const allGoodOrGolden = windowSlots.every((slot) => slot.isGolden || slot.quality === OVERLAP_QUALITY.GOOD);

      let quality = OVERLAP_QUALITY.COMPROMISE;
      if (allGolden) {
        quality = OVERLAP_QUALITY.GOLDEN;
      } else if (allGoodOrGolden) {
        quality = OVERLAP_QUALITY.GOOD;
      }

      // Calculate aggregate score
      const avgScore = windowSlots.reduce((sum, s) => sum + s.score, 0) / dur;
      let windowScore = avgScore;
      if (allGolden) windowScore += 25;
      else if (allGoodOrGolden) windowScore += 10;

      // Small bonus for reasonable local meeting hours (10:00 to 16:00 in reference city)
      const firstSlot = windowSlots[0];
      const matchedById = referenceCityId
        ? firstSlot.cityStatuses?.find((c) => c.cityId === referenceCityId)
        : null;
      const matchedByTz = referenceTimezone
        ? firstSlot.cityStatuses?.find((c) => c.timeZone === referenceTimezone)
        : null;
      const refStatus =
        matchedById ||
        matchedByTz ||
        (!referenceTimezone &&
          (firstSlot.cityStatuses?.find((c) => c.isPrimary) || firstSlot.cityStatuses?.[0])) ||
        null;

      let refHour;
      if (typeof refStatus?.decimalHour === 'number') {
        refHour = refStatus.decimalHour;
      } else if (typeof refStatus?.hour === 'number') {
        refHour = refStatus.hour;
      } else {
        const fallbackTz =
          refStatus?.timeZone ||
          referenceTimezone ||
          firstSlot.cityStatuses?.find((c) => c.isPrimary)?.timeZone ||
          firstSlot.cityStatuses?.[0]?.timeZone;
        if (fallbackTz && firstSlot.timestamp) {
          try {
            const parts = getTimeParts(firstSlot.timestamp, fallbackTz);
            refHour = parts.hour + parts.minute / 60;
          } catch {
            refHour = new Date(firstSlot.timestamp).getUTCHours();
          }
        } else {
          refHour = new Date(firstSlot.timestamp).getUTCHours();
        }
      }

      if (refHour >= 10 && refHour <= 16) {
        windowScore += 2;
      }

      const startTimestamp = windowSlots[0].timestamp;
      // Window ends 1 hour after the last slot starts
      const endTimestamp = windowSlots[windowSlots.length - 1].timestamp + 3600000;

      candidateWindows.push({
        startIndex: start,
        endIndex: end,
        durationHours: dur,
        startTimestamp,
        endTimestamp,
        quality,
        score: Math.round(windowScore * 10) / 10,
        slots: windowSlots,
      });
    }
  }

  // Sort candidates by:
  // 1. Quality tier (Golden > Good > Compromise)
  // 2. Score (descending)
  // 3. Duration (longer preferred if scores similar)
  const qualityWeight = {
    [OVERLAP_QUALITY.GOLDEN]: 300,
    [OVERLAP_QUALITY.GOOD]: 200,
    [OVERLAP_QUALITY.COMPROMISE]: 100,
    [OVERLAP_QUALITY.POOR]: 0,
  };

  candidateWindows.sort((a, b) => {
    const tierA = qualityWeight[a.quality] || 0;
    const tierB = qualityWeight[b.quality] || 0;
    if (tierA !== tierB) return tierB - tierA;
    if (Math.abs(b.score - a.score) >= 1) return b.score - a.score;
    return b.durationHours - a.durationHours;
  });

  // Filter out redundant overlapping windows to keep distinct suggestions
  const selectedWindows = [];
  for (const candidate of candidateWindows) {
    if (selectedWindows.length >= maxResults) break;

    // Check overlap with already selected windows
    const overlaps = selectedWindows.some((selected) => {
      // Overlap if ranges intersect
      return Math.max(selected.startIndex, candidate.startIndex) <=
             Math.min(selected.endIndex, candidate.endIndex);
    });

    if (!overlaps) {
      selectedWindows.push(candidate);
    }
  }

  // If strict non-overlapping filtering yielded fewer results than maxResults,
  // allow highest scoring alternatives that don't have identical start and end
  if (selectedWindows.length < maxResults) {
    for (const candidate of candidateWindows) {
      if (selectedWindows.length >= maxResults) break;
      const alreadyPresent = selectedWindows.some(
        (s) => s.startIndex === candidate.startIndex && s.endIndex === candidate.endIndex
      );
      if (!alreadyPresent) {
        selectedWindows.push(candidate);
      }
    }
  }

  // Enrich with per-city summary strings
  return selectedWindows.map((win, idx) => {
    const firstCol = win.slots[0];
    const lastCol = win.slots[win.slots.length - 1];

    const citySummaries = firstCol.cityStatuses.map((cityStart, cIdx) => {
      const cityEnd = lastCol.cityStatuses[cIdx];
      // Format start and end times in local time
      const startTime = cityStart.formattedTime12;
      
      // Calculate end time string (start of next hour after last slot)
      const endLocalParts12 = new Intl.DateTimeFormat('en-US', {
        timeZone: cityStart.timeZone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(win.endTimestamp));

      const endLocalParts24 = new Intl.DateTimeFormat('en-US', {
        timeZone: cityStart.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23',
      }).format(new Date(win.endTimestamp));

      const isAllWorking = win.slots.every(
        (s) => s.cityStatuses[cIdx]?.isWorkingHour
      );

      return {
        cityId: cityStart.cityId,
        cityName: cityStart.cityName,
        timeZone: cityStart.timeZone,
        startTime: startTime,
        endTime: endLocalParts12,
        startTime24: cityStart.formattedTime24 || startTime,
        endTime24: endLocalParts24,
        dayRollover: cityStart.dayRollover,
        endDayDelta: computeSpanDayDelta(win.startTimestamp, win.endTimestamp, cityStart.timeZone),
        isWorkingHours: isAllWorking,
        phase: cityStart.phase,
      };
    });

    return {
      id: `meeting-window-${idx + 1}`,
      rank: idx + 1,
      startIndex: win.startIndex,
      endIndex: win.endIndex,
      durationHours: win.durationHours,
      startTimestamp: win.startTimestamp,
      endTimestamp: win.endTimestamp,
      quality: win.quality,
      score: win.score,
      citySummaries,
    };
  });
}

/**
 * Builds a complete meeting window descriptor for any user-selected slot range [startIndex, endIndex].
 * Works for both viable and compromise/off-hour selections so users can export any range.
 *
 * @param {Array<Object>} evaluatedColumns - Output from calculateTimelineOverlaps
 * @param {number} startIndex - Starting column index
 * @param {number} [endIndex=startIndex] - Ending column index (inclusive)
 * @returns {Object|null} Complete meeting window object
 */
export function buildCustomMeetingWindow(evaluatedColumns, startIndex, endIndex = startIndex) {
  if (!evaluatedColumns || evaluatedColumns.length === 0) return null;
  if (typeof startIndex !== 'number' || startIndex < 0) return null;

  const totalCols = evaluatedColumns.length;
  const rawEndArg = endIndex ?? startIndex;

  // Support both reversed integer calls (e.g. startIndex=5, endIndex=3) and 0.5h windows (startIndex=10, endIndex=9.5)
  const isReversedRange = rawEndArg < startIndex - 0.5;
  const rawStart = isReversedRange ? Math.min(startIndex, rawEndArg) : startIndex;
  const rawEnd = isReversedRange ? Math.max(startIndex, rawEndArg) : rawEndArg;

  const startEdge = Math.max(0, Math.min(totalCols - 0.5, Math.round(rawStart * 2) / 2));
  const endEdge = Math.max(startEdge + 0.5, Math.min(totalCols, Math.round((rawEnd + 1) * 2) / 2));
  const normStart = startEdge;
  const normEnd = endEdge - 1;

  const firstColIdx = Math.min(totalCols - 1, Math.floor(startEdge));
  const lastColIdx = Math.min(totalCols - 1, Math.max(firstColIdx, Math.ceil(endEdge) - 1));

  const windowSlots = evaluatedColumns.slice(firstColIdx, lastColIdx + 1);
  if (windowSlots.length === 0) return null;

  const dur = Math.round((endEdge - startEdge) * 100) / 100;
  const hasSleep = windowSlots.some((s) => !s.isViable);
  const allGolden = windowSlots.every((s) => s.isGolden);
  const allGoodOrGolden = windowSlots.every(
    (s) => s.isGolden || s.quality === OVERLAP_QUALITY.GOOD
  );

  let quality = OVERLAP_QUALITY.COMPROMISE;
  if (hasSleep) {
    quality = OVERLAP_QUALITY.POOR;
  } else if (allGolden) {
    quality = OVERLAP_QUALITY.GOLDEN;
  } else if (allGoodOrGolden) {
    quality = OVERLAP_QUALITY.GOOD;
  }

  const avgScore = windowSlots.reduce((sum, s) => sum + s.score, 0) / windowSlots.length;
  const firstCol = evaluatedColumns[firstColIdx];
  const lastCol = evaluatedColumns[lastColIdx];
  const startTimestamp = firstCol.timestamp + (startEdge - firstColIdx) * 3600000;
  const endTimestamp = lastCol.timestamp + (endEdge - lastColIdx) * 3600000;

  const citySummaries = (firstCol.cityStatuses || []).map((cityStart, cIdx) => {
    const startLocalParts12 =
      startEdge === firstColIdx
        ? cityStart.formattedTime12
        : new Intl.DateTimeFormat('en-US', {
            timeZone: cityStart.timeZone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(new Date(startTimestamp));

    const startLocalParts24 =
      startEdge === firstColIdx
        ? cityStart.formattedTime24 || cityStart.formattedTime12
        : new Intl.DateTimeFormat('en-US', {
            timeZone: cityStart.timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            hourCycle: 'h23',
          }).format(new Date(startTimestamp));

    const endLocalParts12 = new Intl.DateTimeFormat('en-US', {
      timeZone: cityStart.timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(endTimestamp));

    const endLocalParts24 = new Intl.DateTimeFormat('en-US', {
      timeZone: cityStart.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).format(new Date(endTimestamp));

    const isAllWorking = windowSlots.every((s) => s.cityStatuses[cIdx]?.isWorkingHour);

    return {
      cityId: cityStart.cityId,
      cityName: cityStart.cityName,
      timeZone: cityStart.timeZone,
      startTime: startLocalParts12,
      endTime: endLocalParts12,
      startTime24: startLocalParts24,
      endTime24: endLocalParts24,
      dayRollover: cityStart.dayRollover,
      endDayDelta: computeSpanDayDelta(startTimestamp, endTimestamp, cityStart.timeZone),
      isWorkingHours: isAllWorking,
      phase: cityStart.phase,
    };
  });

  return {
    id: `custom-window-${normStart}-${normEnd}`,
    isCustom: true,
    rank: 0,
    startIndex: normStart,
    endIndex: normEnd,
    durationHours: dur,
    startTimestamp,
    endTimestamp,
    quality,
    score: Math.round(avgScore * 10) / 10,
    citySummaries,
  };
}

/**
 * Finds the best compromise 1-hour window when a global team has zero sleep-free overlap.
 * Maximizes working + awake cities and minimizes sleeping participants.
 *
 * @param {Array<Object>} evaluatedColumns
 * @returns {Object|null}
 */
export function findBestCompromiseWindow(evaluatedColumns) {
  if (!evaluatedColumns || evaluatedColumns.length === 0) return null;

  let bestIdx = 0;
  let bestMetric = -Infinity;

  evaluatedColumns.forEach((col, idx) => {
    const metric = col.workingCount * 30 + col.awakeCount * 15 - col.sleepCount * 25;
    if (metric > bestMetric) {
      bestMetric = metric;
      bestIdx = idx;
    }
  });

  return buildCustomMeetingWindow(evaluatedColumns, bestIdx, bestIdx);
}

/**
 * Format a meeting window into a clean multi-line Slack or Markdown snippet.
 * 
 * @param {Object} window - Window object from findBestMeetingWindows or buildCustomMeetingWindow
 * @param {Object} [options]
 * @param {string} [options.title] - Optional custom meeting title
 * @param {boolean} [options.use24Hour=false] - Format times in 24h
 * @param {string} [options.shareUrl] - Optional URL to append
 * @returns {string} Markdown/Slack formatted text
 */
export function formatSlackSnippet(window, options = {}) {
  if (!window || !window.citySummaries) return '';

  const { title, use24Hour = false, shareUrl } = options;
  const durationStr = `${window.durationHours} ${window.durationHours === 1 ? 'hour' : 'hours'}`;
  const headerTitle = title ? `*${title}*` : '*Proposed Meeting Time*';
  const lines = [
    `${headerTitle} (${durationStr})`,
  ];

  window.citySummaries.forEach((city) => {
    const rollover =
      city.endDayDelta > 0
        ? ` (+${city.endDayDelta}d)`
        : city.dayRollover
          ? ` (${city.dayRollover})`
          : '';
    const rawStart = use24Hour && city.startTime24 ? city.startTime24 : city.startTime;
    const rawEnd = use24Hour && city.endTime24 ? city.endTime24 : city.endTime;
    const start = use24Hour ? rawStart : String(rawStart || '').toLowerCase();
    const end = use24Hour ? rawEnd : String(rawEnd || '').toLowerCase();
    lines.push(`• *${city.cityName}*: ${start} – ${end}${rollover}`);
  });

  if (shareUrl) {
    lines.push(`🔗 ${shareUrl}`);
  }

  return lines.join('\n');
}

/**
 * Format a meeting window into a compact inline one-liner.
 * @param {Object} window
 * @returns {string}
 */
export function formatCompactMeetingSummary(window) {
  if (!window || !window.citySummaries) return '';
  return window.citySummaries
    .map((c) => `${c.cityName}: ${c.startTime}–${c.endTime}${c.dayRollover ? ` (${c.dayRollover})` : ''}`)
    .join(' | ');
}

/**
 * Calculate the pairwise overlap metrics between two cities.
 * Powers programmatic SEO city-pair routes (/from/:cityA/to/:cityB).
 * 
 * @param {Array<Object>} citySlotsA - Slots for city A
 * @param {Array<Object>} citySlotsB - Slots for city B
 * @returns {{
 *   overlapHours: number,
 *   overlapRatioA: number,
 *   overlapRatioB: number,
 *   goldenSlotIndices: number[],
 *   hasGoldenOverlap: boolean
 * }}
 */
export function getPairwiseOverlapMetrics(citySlotsA, citySlotsB) {
  if (!citySlotsA || !citySlotsB || citySlotsA.length === 0 || citySlotsB.length === 0) {
    return {
      overlapHours: 0,
      overlapRatioA: 0,
      overlapRatioB: 0,
      goldenSlotIndices: [],
      hasGoldenOverlap: false,
    };
  }

  const length = Math.min(citySlotsA.length, citySlotsB.length);
  let overlapHours = 0;
  let totalWorkA = 0;
  let totalWorkB = 0;
  const goldenSlotIndices = [];

  for (let i = 0; i < length; i++) {
    const isWorkA = Boolean(citySlotsA[i]?.isWorkingHour);
    const isWorkB = Boolean(citySlotsB[i]?.isWorkingHour);

    if (isWorkA) totalWorkA++;
    if (isWorkB) totalWorkB++;

    if (isWorkA && isWorkB) {
      overlapHours++;
      goldenSlotIndices.push(i);
    }
  }

  return {
    overlapHours,
    overlapRatioA: totalWorkA > 0 ? Math.round((overlapHours / totalWorkA) * 100) / 100 : 0,
    overlapRatioB: totalWorkB > 0 ? Math.round((overlapHours / totalWorkB) * 100) / 100 : 0,
    goldenSlotIndices,
    hasGoldenOverlap: overlapHours > 0,
  };
}
