import React from 'react';
import {
  formatSmartTimeSpan,
  groupCitySummariesByTime,
  pickAlternativeWindow,
  getReferenceSummary,
} from '../engine/overlapFormat.js';

const MAX_VISIBLE_GROUPS = 3;

/**
 * Idle-state answer (left side of the answer row above the grid):
 * "● Best overlap  8 am–1 pm New York · 12–5 pm London / UTC  5h   Also 3–4 pm New York"
 */
export function BestOverlapHeadline({
  goldenWindows = [],
  meetingWindows = [],
  compromiseWindow = null,
  referenceCityId,
  onSelectWindow,
  use24Hour = false,
}) {
  const primaryWindow = goldenWindows[0] || meetingWindows[0] || compromiseWindow || null;
  const isGoldenPrimary = Boolean(goldenWindows[0] || meetingWindows[0]?.quality === 'golden');

  const altWindow = pickAlternativeWindow(primaryWindow, [
    ...goldenWindows.slice(1),
    ...meetingWindows,
  ]);

  const groups = primaryWindow
    ? groupCitySummariesByTime(primaryWindow.citySummaries, use24Hour)
    : [];

  const altRef = getReferenceSummary(altWindow, referenceCityId);
  const altSpan = altRef
    ? use24Hour
      ? formatSmartTimeSpan(altRef.startTime24, altRef.endTime24, true)
      : formatSmartTimeSpan(altRef.startTime, altRef.endTime, false)
    : '';
  const altCity = altRef ? (altRef.cityName === 'UTC / GMT' ? 'UTC' : altRef.cityName) : '';

  return (
    <div className="wtb-headline-main" aria-live="polite">
      {primaryWindow && groups.length > 0 ? (
        <>
          <button
            type="button"
            className="wtb-headline-answer"
            onClick={() => onSelectWindow && onSelectWindow(primaryWindow)}
            title="Select this window on the grid"
          >
            <span className={`wtb-best-dot ${isGoldenPrimary ? 'is-golden' : 'is-compromise'}`} />
            <span className="wtb-headline-label">
              {isGoldenPrimary ? 'Best overlap' : 'Closest overlap'}
            </span>
            {groups.slice(0, MAX_VISIBLE_GROUPS).map((grp, idx) => (
              <React.Fragment key={`${grp.spanStr}-${idx}`}>
                {idx > 0 && <span className="wtb-pill-sep">·</span>}
                <span className="wtb-pill-city-span">
                  <strong>{grp.spanStr}</strong> {grp.cities.join(' / ')}
                </span>
              </React.Fragment>
            ))}
            {groups.length > MAX_VISIBLE_GROUPS && (
              <span className="wtb-pill-more">+{groups.length - MAX_VISIBLE_GROUPS}</span>
            )}
            <span className={`wtb-pill-dur ${isGoldenPrimary ? '' : 'is-compromise'}`}>
              {primaryWindow.durationHours}h
            </span>
          </button>

          {altWindow && altSpan && (
            <button
              type="button"
              className="wtb-headline-alt"
              onClick={() => onSelectWindow && onSelectWindow(altWindow)}
              title="Select this separate alternative window"
            >
              Also <strong>{altSpan}</strong> {altCity} · {altWindow.durationHours}h
            </button>
          )}
        </>
      ) : (
        <span className="wtb-headline-empty">
          No shared working hours on this date — click or drag hours on the grid to pick a time.
        </span>
      )}
    </div>
  );
}
