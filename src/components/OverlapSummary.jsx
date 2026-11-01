import React, { useState } from 'react';
import {
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  CalendarIcon,
  CloseIcon,
} from './Icons.jsx';
import { BestOverlapHeadline } from './BestOverlapHeadline.jsx';
import { formatSlackSnippet } from '../engine/overlapEngine.js';
import { groupCitySummariesByTime } from '../engine/overlapFormat.js';
import {
  generateMeetingIcs,
  downloadIcsFile,
  generateGoogleCalendarUrl,
} from '../engine/icsExport.js';

const LEGEND_ITEMS = [
  { key: 'golden', label: 'Overlap' },
  { key: 'work', label: 'Work' },
  { key: 'awake', label: 'Off-hours' },
  { key: 'sleep', label: 'Night' },
];

function PhaseLegend() {
  return (
    <div className="wtb-legend" aria-label="Color legend">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.key} className="wtb-legend-item">
          <span className={`wtb-legend-swatch swatch-${item.key}`} />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Single answer row directly above the grid. One fixed-height row that swaps state
 * (zero CLS, no footer):
 *  - Idle:     ● Best overlap … 5h            ▢ Overlap ▢ Work ▢ Off-hours ▢ Night
 *  - Selected: Selected 3h  9–12 pm New York …   [Google Cal] [.ics] [Copy] [✕]
 */
export function OverlapSummary({
  customWindow,
  goldenWindows = [],
  meetingWindows = [],
  compromiseWindow = null,
  referenceCityId,
  onSelectWindow,
  onClearSelection,
  onShowToast,
  shareUrl = 'https://timerows.com',
  use24Hour = false,
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const activeWindow = customWindow || null;

  const handleCopySlack = (win) => {
    if (!win) return;
    const snippet = formatSlackSnippet(win, { use24Hour, shareUrl });
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      if (onShowToast) onShowToast('Copied meeting times to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadIcs = (win) => {
    if (!win) return;
    try {
      const icsString = generateMeetingIcs({
        title: `Team Sync (${win.durationHours} hr)`,
        startTimestamp: win.startTimestamp,
        endTimestamp: win.endTimestamp,
        citySummaries: win.citySummaries,
        url: shareUrl,
      });
      downloadIcsFile('team-sync.ics', icsString);
      setDownloaded(true);
      if (onShowToast) onShowToast('Downloaded .ics calendar invite');
      setTimeout(() => setDownloaded(false), 2000);
    } catch (err) {
      console.error('Failed to download .ics:', err);
    }
  };

  if (activeWindow) {
    const groupedSummaries = groupCitySummariesByTime(activeWindow.citySummaries, use24Hour);
    const googleCalUrl = generateGoogleCalendarUrl({
      title: `Team Sync (${activeWindow.durationHours} hr)`,
      startTimestamp: activeWindow.startTimestamp,
      endTimestamp: activeWindow.endTimestamp,
      citySummaries: activeWindow.citySummaries,
    });

    return (
      <div className="wtb-headline is-selection">
        <div className="wtb-selection-summary">
          <span className="wtb-selection-label">Selected {activeWindow.durationHours}h</span>
          {groupedSummaries.map((grp, idx) => (
            <React.Fragment key={`${grp.spanStr}-${idx}`}>
              {idx > 0 && <span className="wtb-pill-sep">·</span>}
              <span className="wtb-selection-city-item">
                <strong>{grp.spanStr}</strong> {grp.cities.join(' / ')}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div className="wtb-selection-actions">
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wtb-action-btn"
          >
            <CalendarIcon size={13} />
            <span>Google Cal</span>
          </a>

          <button
            type="button"
            className="wtb-action-btn"
            onClick={() => handleDownloadIcs(activeWindow)}
          >
            {downloaded ? <CheckIcon size={13} /> : <DownloadIcon size={13} />}
            <span>.ics</span>
          </button>

          <button
            type="button"
            className="wtb-action-btn"
            onClick={() => handleCopySlack(activeWindow)}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            className="wtb-action-btn is-icon"
            onClick={onClearSelection}
            title="Clear selection (Esc)"
            aria-label="Clear selection"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wtb-headline">
      <BestOverlapHeadline
        goldenWindows={goldenWindows}
        meetingWindows={meetingWindows}
        compromiseWindow={compromiseWindow}
        referenceCityId={referenceCityId}
        onSelectWindow={onSelectWindow}
        use24Hour={use24Hour}
      />
      <PhaseLegend />
    </div>
  );
}
