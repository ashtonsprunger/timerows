import React, { useMemo } from 'react';
import { buildCorridorSeoData } from '../engine/seoCorridors.js';

/**
 * Below-board Quick Reference & FAQ section rendered on `/from/:cityA/to/:cityB`
 * corridor pages. Gives searchers and crawlers instant answers for queries like
 * "10am nyc time in london", "1pm san francisco in uk", and "nyc to london time difference"
 * without cluttering the converter board above.
 */
export function CorridorSeoSection({ fromSlug, toSlug, selectedDate }) {
  const data = useMemo(() => {
    if (!fromSlug || !toSlug) return null;
    return buildCorridorSeoData(fromSlug, toSlug, selectedDate);
  }, [fromSlug, toSlug, selectedDate]);

  if (!data) return null;

  const {
    fromCity,
    toCity,
    fromDisplayTag,
    toDisplayTag,
    offsetBadge,
    offsetPhrase,
    overlapHeadline,
    quickConversions,
    faqs,
  } = data;

  return (
    <section
      className="wtb-corridor-seo"
      aria-label={`${fromCity.name} to ${toCity.name} time difference and quick reference`}
    >
      <div className="wtb-corridor-header">
        <h1 className="wtb-corridor-title">
          {fromDisplayTag} to {toDisplayTag} Time Difference
          <span className="wtb-corridor-badge">{offsetBadge}</span>
        </h1>
        <p className="wtb-corridor-lead">
          <strong>{toDisplayTag}</strong> ({toCity.timeZone}) is {offsetPhrase} (
          {fromCity.timeZone}). {overlapHeadline}
        </p>
      </div>

      {quickConversions.length > 0 && (
        <div className="wtb-corridor-quick-grid" aria-label="Common hour conversions">
          {quickConversions.map((item) => (
            <div key={item.text} className="wtb-corridor-quick-pill">
              <span className="wtb-quick-from">{item.fromLabel}</span>
              <span className="wtb-quick-arrow" aria-hidden="true">
                →
              </span>
              <span className="wtb-quick-to">{item.toLabel}</span>
            </div>
          ))}
        </div>
      )}

      <div className="wtb-corridor-faqs">
        {faqs.map((faq) => (
          <div key={faq.question} className="wtb-corridor-faq-card">
            <h2 className="wtb-corridor-faq-q">{faq.question}</h2>
            <p className="wtb-corridor-faq-a">{faq.answer}</p>
          </div>
        ))}
      </div>

      <div className="wtb-corridor-reverse">
        <a href={`/from/${toSlug}/to/${fromSlug}`}>
          Switch direction: {toDisplayTag} to {fromDisplayTag} time converter →
        </a>
      </div>
    </section>
  );
}
