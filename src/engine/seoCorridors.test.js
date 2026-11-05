import {
  SEO_CORRIDORS,
  formatRelativeOffset,
  buildCorridorSeoData,
  buildSitemapXml,
} from './seoCorridors.js';

describe('seoCorridors engine', () => {
  describe('formatRelativeOffset', () => {
    test('formats zero offset as same time', () => {
      const res = formatRelativeOffset(0, 'London');
      expect(res.badge).toBe('0h');
      expect(res.phrase).toBe('the same time as London');
    });

    test('formats positive integer hour offset', () => {
      const res = formatRelativeOffset(240, 'New York');
      expect(res.badge).toBe('+4h');
      expect(res.phrase).toBe('4 hours ahead of New York');
    });

    test('formats negative integer hour offset', () => {
      const res = formatRelativeOffset(-300, 'London');
      expect(res.badge).toBe('-5h');
      expect(res.phrase).toBe('5 hours behind London');
    });

    test('formats fractional offset (India +5:30 / +9:30)', () => {
      const res = formatRelativeOffset(570, 'New York');
      expect(res.badge).toBe('+9:30');
      expect(res.phrase).toBe('9:30 hours ahead of New York');
    });
  });

  describe('buildCorridorSeoData', () => {
    test('builds complete metadata, colloquial search tags, quick conversions, and 24h table for new-york to london', () => {
      const data = buildCorridorSeoData('new-york', 'london', '2026-10-30');
      expect(data).not.toBeNull();
      expect(data.fromCity.name).toBe('New York');
      expect(data.toCity.name).toBe('London');
      expect(data.canonicalPath).toBe('/from/new-york/to/london');
      expect(data.canonicalUrl).toBe('https://timerows.com/from/new-york/to/london');
      expect(data.title).toContain('New York (NYC) to London (UK) Time Difference');
      expect(data.description).toContain('London (UK) is 4 hours ahead of New York');
      expect(data.overlapHeadline).toContain('9 am–1 pm in New York');
      expect(data.quickConversions.length).toBeGreaterThanOrEqual(5);
      expect(data.hourlyRows[0].fromTime).toBeTruthy();
      expect(data.hourlyRows[0].toTime).toBeTruthy();
      expect(data.hourlyRows.length).toBeGreaterThanOrEqual(24);
      expect(data.faqs).toHaveLength(3);
    });

    test('returns null for unresolvable city slug', () => {
      expect(buildCorridorSeoData('', 'london')).toBeNull();
    });

    test('resolves all curated SEO_CORRIDORS cleanly', () => {
      expect(SEO_CORRIDORS.length).toBeGreaterThanOrEqual(80);
      SEO_CORRIDORS.forEach((pair) => {
        const data = buildCorridorSeoData(pair.from, pair.to, '2026-06-15');
        expect(data).not.toBeNull();
        expect(data.fromCity.timeZone).toBeTruthy();
        expect(data.toCity.timeZone).toBeTruthy();
        expect(data.hourlyRows.length).toBe(24);
      });
    });
  });

  describe('buildSitemapXml', () => {
    test('produces valid XML with lastmod and all corridor URLs', () => {
      const xml = buildSitemapXml(
        [
          { from: 'new-york', to: 'london', priority: '0.9' },
          { from: 'san-francisco', to: 'tokyo', priority: '0.8' },
        ],
        '2026-11-05'
      );
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<loc>https://timerows.com/</loc>');
      expect(xml).toContain('<loc>https://timerows.com/from/new-york/to/london</loc>');
      expect(xml).toContain('<loc>https://timerows.com/from/san-francisco/to/tokyo</loc>');
      expect(xml).toContain('<loc>https://timerows.com/about.html</loc>');
      expect(xml).toContain('<loc>https://timerows.com/privacy.html</loc>');
      expect(xml).toContain('<lastmod>2026-11-05</lastmod>');
    });
  });
});
