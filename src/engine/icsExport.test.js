import { jest } from '@jest/globals';
import {
  formatIcsTimestamp,
  escapeIcsText,
  generateMeetingIcs,
  generateGoogleCalendarUrl,
  downloadIcsFile,
} from './icsExport.js';

describe('icsExport Engine', () => {
  describe('formatIcsTimestamp', () => {
    test('formats epoch timestamps to UTC YYYYMMDDTHHmmssZ', () => {
      // 2026-10-10 14:30:00 UTC
      const ts = Date.UTC(2026, 9, 10, 14, 30, 0);
      expect(formatIcsTimestamp(ts)).toBe('20261010T143000Z');

      // Date object
      const date = new Date(Date.UTC(2027, 0, 1, 9, 0, 0));
      expect(formatIcsTimestamp(date)).toBe('20270101T090000Z');
    });

    test('throws on invalid timestamp', () => {
      expect(() => formatIcsTimestamp('invalid-date')).toThrow('Invalid date/timestamp');
    });
  });

  describe('escapeIcsText', () => {
    test('escapes special RFC 5545 characters (commas, semicolons, newlines, backslashes)', () => {
      expect(escapeIcsText('Hello, World;')).toBe('Hello\\, World\\;');
      expect(escapeIcsText('Line 1\nLine 2')).toBe('Line 1\\nLine 2');
      expect(escapeIcsText('Path\\To\\File')).toBe('Path\\\\To\\\\File');
      expect(escapeIcsText('')).toBe('');
      expect(escapeIcsText(null)).toBe('');
    });
  });

  describe('generateMeetingIcs', () => {
    test('generates valid RFC 5545 VCALENDAR string with CRLF line endings', () => {
      const start = Date.UTC(2026, 9, 10, 14, 0, 0);
      const end = Date.UTC(2026, 9, 10, 16, 0, 0);

      const ics = generateMeetingIcs({
        title: 'Q4 Strategy Sync',
        startTimestamp: start,
        endTimestamp: end,
        citySummaries: [
          { cityName: 'New York', startTime: '10:00 AM', endTime: '12:00 PM', dayRollover: '' },
          { cityName: 'London', startTime: '3:00 PM', endTime: '5:00 PM', dayRollover: '' },
          { cityName: 'Tokyo', startTime: '11:00 PM', endTime: '1:00 AM', dayRollover: '+1 Day' },
        ],
        url: 'https://timerows.com/?c=nyc,lon,tyo',
        uid: 'test-event-12345@timerows.com',
      });

      // Verify RFC 5545 structure
      expect(ics).toContain('BEGIN:VCALENDAR\r\n');
      expect(ics).toContain('VERSION:2.0\r\n');
      expect(ics).toContain('PRODID:-//TimeRows//TimeRows Meeting Planner//EN\r\n');
      expect(ics).toContain('BEGIN:VEVENT\r\n');
      expect(ics).toContain('UID:test-event-12345@timerows.com\r\n');
      expect(ics).toContain('DTSTART:20261010T140000Z\r\n');
      expect(ics).toContain('DTEND:20261010T160000Z\r\n');
      expect(ics).toContain('SUMMARY:Q4 Strategy Sync\r\n');
      expect(ics).toContain('URL:https://timerows.com/?c=nyc,lon,tyo\r\n');
      expect(ics).toContain('END:VEVENT\r\n');
      expect(ics).toContain('END:VCALENDAR\r\n');

      // Verify that all lines end with CRLF (\r\n)
      const lines = ics.split('\r\n');
      expect(lines.length).toBeGreaterThan(10);
      expect(lines[lines.length - 1]).toBe(''); // trailing CRLF
    });

    test('throws if timestamps are missing or endTimestamp is before startTimestamp', () => {
      expect(() => generateMeetingIcs({ startTimestamp: null, endTimestamp: 1000 })).toThrow(
        'generateMeetingIcs requires startTimestamp and endTimestamp'
      );

      expect(() => generateMeetingIcs({ startTimestamp: 2000, endTimestamp: 1000 })).toThrow(
        'endTimestamp must be strictly after startTimestamp'
      );
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    test('generates valid Google Calendar web creation URL', () => {
      const start = Date.UTC(2026, 9, 10, 14, 0, 0);
      const end = Date.UTC(2026, 9, 10, 16, 0, 0);

      const url = generateGoogleCalendarUrl({
        title: 'Global Team Review',
        startTimestamp: start,
        endTimestamp: end,
        citySummaries: [
          { cityName: 'New York', startTime: '10:00 AM', endTime: '12:00 PM' },
        ],
      });

      expect(url).toContain('https://calendar.google.com/calendar/render?');
      expect(url).toContain('action=TEMPLATE');
      expect(url).toContain('text=Global+Team+Review');
      expect(url).toContain('dates=20261010T140000Z%2F20261010T160000Z');
    });
  });

  describe('downloadIcsFile', () => {
    test('handles node environment gracefully when window is undefined', () => {
      expect(() => {
        downloadIcsFile('test.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
      }).not.toThrow();
    });

    test('triggers browser download when DOM environment is simulated', () => {
      const clickMock = jest.fn();
      const appendChildMock = jest.fn();
      const removeChildMock = jest.fn();
      const createObjectURLMock = jest.fn(() => 'blob:mock-url');
      const revokeObjectURLMock = jest.fn();

      const origWindow = global.window;
      global.window = {
        Blob: global.Blob,
        URL: {
          createObjectURL: createObjectURLMock,
          revokeObjectURL: revokeObjectURLMock,
        },
      };

      const origDocument = global.document;
      global.document = {
        createElement: () => ({
          href: '',
          setAttribute: jest.fn(),
          click: clickMock,
        }),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
      };

      downloadIcsFile('meeting', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(appendChildMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');

      global.window = origWindow;
      global.document = origDocument;
    });
  });
});
