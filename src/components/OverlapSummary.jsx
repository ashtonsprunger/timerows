import React, { useState } from 'react';
import { SparklesIcon, CopyIcon, CheckIcon, DownloadIcon } from './Icons.jsx';
import { OVERLAP_QUALITY, formatSlackSnippet } from '../engine/overlapEngine.js';
import { generateMeetingIcs, downloadIcsFile } from '../engine/icsExport.js';

export function OverlapSummary({
  meetingWindows,
  onSelectWindow,
  selectedWindowId,
  onShowToast,
  shareUrl = 'https://www.timerows.com',
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [downloadedId, setDownloadedId] = useState(null);

  if (!meetingWindows || meetingWindows.length === 0) {
    return (
      <div className="overlap-summary-container is-empty">
        <div className="empty-overlap-card">
          <p className="empty-overlap-text">
            No mutual working-hour overlap detected across all selected cities. Try adjusting meeting duration or selecting alternative cities.
          </p>
        </div>
      </div>
    );
  }

  const handleCopy = (window, e) => {
    e.stopPropagation();
    const snippet = formatSlackSnippet(window);
    navigator.clipboard.writeText(snippet).then(() => {
      setCopiedId(window.id);
      if (onShowToast) onShowToast('Meeting details copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleDownloadIcs = (window, e) => {
    e.stopPropagation();
    try {
      const icsString = generateMeetingIcs({
        title: `Team Sync (${window.durationHours} hr)`,
        startTimestamp: window.startTimestamp,
        endTimestamp: window.endTimestamp,
        citySummaries: window.citySummaries,
        url: shareUrl,
      });

      downloadIcsFile('team-sync.ics', icsString);
      setDownloadedId(window.id);
      if (onShowToast) onShowToast('Downloaded .ics calendar invite!');
      setTimeout(() => setDownloadedId(null), 2500);
    } catch (err) {
      console.error('Failed to download .ics:', err);
    }
  };

  return (
    <section className="overlap-summary-section">
      <div className="overlap-section-header">
        <div className="overlap-title-wrapper">
          <span className="overlap-icon-emerald">
            <SparklesIcon size={18} />
          </span>
          <div>
            <h2 className="overlap-section-title">Best Meeting Windows</h2>
            <p className="overlap-section-subtitle">
              Calculated automatically across all pinned timezones without sleep disruption
            </p>
          </div>
        </div>
      </div>

      <div className="overlap-cards-grid">
        {meetingWindows.map((win) => {
          const isSelected = selectedWindowId === win.id;
          const isGolden = win.quality === OVERLAP_QUALITY.GOLDEN;
          const isCopied = copiedId === win.id;
          const isDownloaded = downloadedId === win.id;

          return (
            <div
              key={win.id}
              className={`meeting-window-card ${isGolden ? 'card-golden' : 'card-standard'} ${
                isSelected ? 'is-window-selected' : ''
              }`}
              onClick={() => onSelectWindow(win)}
            >
              <div className="card-top-bar">
                <div className="window-badge-group">
                  <span className={`quality-pill ${isGolden ? 'pill-golden' : 'pill-good'}`}>
                    {isGolden ? 'Golden Overlap' : 'Viable Window'}
                  </span>
                  <span className="duration-pill">{win.durationHours} hr</span>
                </div>

                <div className="window-actions-group">
                  <button
                    type="button"
                    className="copy-slack-btn"
                    onClick={(e) => handleDownloadIcs(win, e)}
                    title="Download .ics Calendar Invite"
                  >
                    {isDownloaded ? <CheckIcon size={13} /> : <DownloadIcon size={13} />}
                    <span>{isDownloaded ? 'Downloaded' : '.ICS'}</span>
                  </button>

                  <button
                    type="button"
                    className="copy-slack-btn"
                    onClick={(e) => handleCopy(win, e)}
                    title="Copy Slack/Markdown Snippet"
                  >
                    {isCopied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                    <span>{isCopied ? 'Copied' : 'Slack'}</span>
                  </button>
                </div>
              </div>

              <div className="card-cities-list">
                {win.citySummaries.map((city) => (
                  <div key={city.cityId} className="city-time-entry">
                    <span className="city-name-label">{city.cityName}</span>
                    <span className="city-window-time">
                      {city.startTime} – {city.endTime}
                      {city.dayRollover && (
                        <span className="window-rollover-tag">{city.dayRollover}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
