/**
 * TimeRows - RFC 5545 Calendar Generator (.ics)
 * 
 * Generates standards-compliant iCalendar (.ics) files and calendar deep links
 * for 1-click meeting export to Apple Calendar, Google Calendar, Outlook, and Notion.
 * Zero React dependencies.
 */

/**
 * Format a Date or timestamp into RFC 5545 UTC timestamp format (YYYYMMDDTHHmmssZ).
 * 
 * @param {Date|number|string} dateOrTimestamp
 * @returns {string}
 */
export function formatIcsTimestamp(dateOrTimestamp) {
  const date = typeof dateOrTimestamp === 'number'
    ? new Date(dateOrTimestamp)
    : (dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp));

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date/timestamp: ${dateOrTimestamp}`);
  }

  const pad = (n) => String(n).padStart(2, '0');

  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text characters according to RFC 5545 specification.
 * Backslashes, semicolons, commas, and newlines must be properly escaped.
 * 
 * @param {string} text
 * @returns {string}
 */
export function escapeIcsText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Generate a valid RFC 5545 iCalendar string (.ics) for a meeting window.
 * 
 * @param {Object} params
 * @param {string} [params.title='Team Sync'] - Event summary
 * @param {number} params.startTimestamp - Start UTC timestamp (ms)
 * @param {number} params.endTimestamp - End UTC timestamp (ms)
 * @param {string} [params.description] - Custom event description
 * @param {Array<Object>} [params.citySummaries] - City names and local times
 * @param {string} [params.url] - TimeRows meeting share URL
 * @param {string} [params.uid] - Unique event ID
 * @returns {string} RFC 5545 VCALENDAR string with CRLF line breaks
 */
export function generateMeetingIcs({
  title = 'Team Sync — TimeRows Overlap',
  startTimestamp,
  endTimestamp,
  description = '',
  citySummaries = [],
  url = 'https://timerows.com',
  uid = null,
}) {
  if (!startTimestamp || !endTimestamp) {
    throw new Error('generateMeetingIcs requires startTimestamp and endTimestamp');
  }

  if (endTimestamp <= startTimestamp) {
    throw new Error('endTimestamp must be strictly after startTimestamp');
  }

  const dtStart = formatIcsTimestamp(startTimestamp);
  const dtEnd = formatIcsTimestamp(endTimestamp);
  const dtStamp = formatIcsTimestamp(Date.now());
  const eventUid = uid || `timerows-${startTimestamp}-${Math.random().toString(36).substr(2, 8)}@timerows.com`;

  // Build rich participant timezone summary for description
  let detailedDescription = description;
  if (citySummaries && citySummaries.length > 0) {
    const cityLines = citySummaries.map((c) => {
      const rollover = c.dayRollover ? ` (${c.dayRollover})` : '';
      return `• ${c.cityName}: ${c.startTime} – ${c.endTime}${rollover}`;
    });

    detailedDescription = [
      description ? `${description}\n` : '',
      'Participant Local Times:',
      ...cityLines,
      '',
      `Planned via TimeRows: ${url}`,
    ].filter(Boolean).join('\n');
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TimeRows//TimeRows Meeting Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${eventUid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(detailedDescription)}`,
    `URL:${url}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // RFC 5545 mandates CRLF line breaks
  return lines.join('\r\n') + '\r\n';
}

/**
 * Generate a 1-click Google Calendar web creation URL.
 * 
 * @param {Object} params
 * @param {string} params.title
 * @param {number} params.startTimestamp
 * @param {number} params.endTimestamp
 * @param {string} [params.details]
 * @param {Array<Object>} [params.citySummaries]
 * @returns {string} URL string
 */
export function generateGoogleCalendarUrl({
  title = 'Team Sync — TimeRows Overlap',
  startTimestamp,
  endTimestamp,
  details = '',
  citySummaries = [],
}) {
  const dtStart = formatIcsTimestamp(startTimestamp);
  const dtEnd = formatIcsTimestamp(endTimestamp);

  let fullDetails = details;
  if (citySummaries && citySummaries.length > 0) {
    const list = citySummaries.map(
      (c) => `• ${c.cityName}: ${c.startTime} - ${c.endTime}${c.dayRollover ? ` (${c.dayRollover})` : ''}`
    ).join('\n');
    fullDetails = `${details ? `${details}\n\n` : ''}Participant Times:\n${list}\n\nPlanned with TimeRows`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${dtStart}/${dtEnd}`,
    details: fullDetails,
    location: 'TimeRows Online Meeting',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Triggers browser download of an .ics file.
 * 
 * @param {string} filename - e.g. "team-sync.ics"
 * @param {string} icsContent - RFC 5545 content
 */
export function downloadIcsFile(filename = 'meeting.ics', icsContent) {
  if (typeof window === 'undefined' || !window.Blob) return;

  const cleanFilename = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const downloadUrl = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
