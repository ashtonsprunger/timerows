import React, { useState } from 'react';
import {
  CopyIcon,
  CheckIcon,
  ShareIcon,
  CalendarIcon,
  DownloadIcon,
  ExternalLinkIcon,
} from './Icons.jsx';
import { generateShareUrl } from '../engine/urlSync.js';
import { formatSlackSnippet } from '../engine/overlapEngine.js';
import {
  generateMeetingIcs,
  downloadIcsFile,
  generateGoogleCalendarUrl,
} from '../engine/icsExport.js';

export function ShareModal({
  isOpen,
  onClose,
  cities,
  selectedDate,
  selectedSlotIndex,
  bestWindow,
  onShowToast,
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSlack, setCopiedSlack] = useState(false);
  const [downloadedIcs, setDownloadedIcs] = useState(false);

  if (!isOpen) return null;

  const shareUrl = generateShareUrl(window.location.origin, {
    cities: cities.map((c) => c.timeZone),
    date: selectedDate,
    selectedSlotIndex,
    referenceTimezone: cities[0]?.timeZone,
  });

  const slackSnippet = bestWindow ? formatSlackSnippet(bestWindow) : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      if (onShowToast) onShowToast('Shareable link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopySlack = () => {
    if (!slackSnippet) return;
    navigator.clipboard.writeText(slackSnippet).then(() => {
      setCopiedSlack(true);
      if (onShowToast) onShowToast('Slack snippet copied to clipboard!');
      setTimeout(() => setCopiedSlack(false), 2000);
    });
  };

  const handleDownloadIcs = () => {
    if (!bestWindow) return;
    try {
      const icsString = generateMeetingIcs({
        title: `Team Sync across ${cities.map((c) => c.name).join(', ')}`,
        startTimestamp: bestWindow.startTimestamp,
        endTimestamp: bestWindow.endTimestamp,
        citySummaries: bestWindow.citySummaries,
        url: shareUrl,
      });

      downloadIcsFile('timerows-meeting.ics', icsString);
      setDownloadedIcs(true);
      if (onShowToast) onShowToast('Downloaded .ics calendar invite!');
      setTimeout(() => setDownloadedIcs(false), 2500);
    } catch (e) {
      console.error('Error generating .ics:', e);
    }
  };

  const googleCalUrl = bestWindow
    ? generateGoogleCalendarUrl({
        title: `Team Sync across ${cities.map((c) => c.name).join(', ')}`,
        startTimestamp: bestWindow.startTimestamp,
        endTimestamp: bestWindow.endTimestamp,
        citySummaries: bestWindow.citySummaries,
      })
    : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-group">
            <ShareIcon size={18} />
            <h3 className="modal-title">Share Meeting & Calendar Invite</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="share-modal-body">
          {/* Shareable Link Box */}
          <div className="share-input-group">
            <label className="share-field-label">1-Click Shareable Link</label>
            <div className="share-input-wrapper">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="share-url-input"
              />
              <button
                type="button"
                className="share-copy-btn btn-primary"
                onClick={handleCopyLink}
              >
                {copiedLink ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Calendar Export Actions */}
          {bestWindow && (
            <div className="share-input-group">
              <label className="share-field-label">Add to Calendar</label>
              <div className="calendar-export-actions">
                <button
                  type="button"
                  className="cal-export-btn btn-secondary"
                  onClick={handleDownloadIcs}
                >
                  {downloadedIcs ? <CheckIcon size={15} /> : <DownloadIcon size={15} />}
                  <span>Download .ICS (Apple / Outlook)</span>
                </button>

                <a
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cal-export-btn btn-secondary"
                >
                  <CalendarIcon size={15} />
                  <span>Google Calendar</span>
                  <ExternalLinkIcon size={13} className="ext-icon" />
                </a>
              </div>
            </div>
          )}

          {/* Slack / Teams Snippet Box */}
          {slackSnippet && (
            <div className="share-input-group">
              <div className="slack-header-bar">
                <label className="share-field-label">Slack & Teams Snippet</label>
                <button
                  type="button"
                  className="slack-copy-btn"
                  onClick={handleCopySlack}
                >
                  {copiedSlack ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                  <span>{copiedSlack ? 'Copied' : 'Copy Snippet'}</span>
                </button>
              </div>
              <pre className="slack-snippet-pre">{slackSnippet}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
