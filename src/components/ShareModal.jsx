import React, { useState, useEffect } from 'react';
import {
  CopyIcon,
  CheckIcon,
  ShareIcon,
  CalendarIcon,
  DownloadIcon,
  ExternalLinkIcon,
  CloseIcon,
} from './Icons.jsx';
import { generateShareUrl, generateCompactShareUrl } from '../engine/urlSync.js';
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
  referenceTimezone,
  selectedDate,
  selectedRange,
  activeWindow,
  workingHours,
  use24Hour = false,
  onShowToast,
}) {
  const defaultTitle = `Team Sync — ${cities.map((c) => c.name).join(' / ')}`;
  const [meetingTitle, setMeetingTitle] = useState(defaultTitle);
  const [includeSlot, setIncludeSlot] = useState(Boolean(selectedRange));
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSlack, setCopiedSlack] = useState(false);
  const [downloadedIcs, setDownloadedIcs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMeetingTitle(`Team Sync — ${cities.map((c) => c.name).join(' / ')}`);
      setIncludeSlot(Boolean(selectedRange));
    }
  }, [isOpen, cities, selectedRange]);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://timerows.com';

  const primaryTz =
    referenceTimezone || (cities.find((c) => c.isPrimary) || cities[0])?.timeZone;

  const permalinkUrl = generateShareUrl(origin, {
    cities,
    date: selectedDate,
    selectedSlotIndex: selectedRange?.startIndex ?? activeWindow?.startIndex,
    selectedEndSlotIndex: selectedRange?.endIndex ?? activeWindow?.endIndex,
    referenceTimezone: primaryTz,
    workingHours,
  });

  const compactUrl = generateCompactShareUrl(origin, cities);
  const activeShareUrl = includeSlot && activeWindow ? permalinkUrl : compactUrl;

  const slackSnippet = activeWindow
    ? formatSlackSnippet(activeWindow, {
        title: meetingTitle,
        use24Hour,
        shareUrl: compactUrl,
      })
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeShareUrl).then(() => {
      setCopiedLink(true);
      if (onShowToast) onShowToast('Link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopySlack = () => {
    if (!slackSnippet) return;
    navigator.clipboard.writeText(slackSnippet).then(() => {
      setCopiedSlack(true);
      if (onShowToast) onShowToast('Slack snippet copied to clipboard');
      setTimeout(() => setCopiedSlack(false), 2000);
    });
  };

  const handleDownloadIcs = () => {
    if (!activeWindow) return;
    try {
      const icsString = generateMeetingIcs({
        title: meetingTitle || defaultTitle,
        startTimestamp: activeWindow.startTimestamp,
        endTimestamp: activeWindow.endTimestamp,
        citySummaries: activeWindow.citySummaries,
        url: activeShareUrl,
      });

      downloadIcsFile('timerows-meeting.ics', icsString);
      setDownloadedIcs(true);
      if (onShowToast) onShowToast('Downloaded .ics calendar invite');
      setTimeout(() => setDownloadedIcs(false), 2500);
    } catch (e) {
      console.error('Error generating .ics:', e);
    }
  };

  const googleCalUrl = activeWindow
    ? generateGoogleCalendarUrl({
        title: meetingTitle || defaultTitle,
        startTimestamp: activeWindow.startTimestamp,
        endTimestamp: activeWindow.endTimestamp,
        citySummaries: activeWindow.citySummaries,
      })
    : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-group">
            <ShareIcon size={17} />
            <h3 className="modal-title">Share</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="share-modal-body">
          {/* Editable Meeting Title */}
          <div className="share-input-group">
            <label className="share-field-label" htmlFor="share-meeting-title">
              Meeting title
            </label>
            <div className="share-input-wrapper is-editable">
              <input
                id="share-meeting-title"
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title..."
                className="share-title-input"
              />
            </div>
          </div>

          {/* Unified Share Link with optional date/slot toggle */}
          <div className="share-input-group">
            <div className="share-label-row">
              <label className="share-field-label" htmlFor="share-url-field">
                Share link
              </label>
              {activeWindow && (
                <label className="share-slot-toggle">
                  <input
                    type="checkbox"
                    checked={includeSlot}
                    onChange={(e) => setIncludeSlot(e.target.checked)}
                  />
                  <span>Include {selectedRange ? 'selected time' : 'best overlap'}</span>
                </label>
              )}
            </div>
            <div className="share-input-wrapper">
              <input
                id="share-url-field"
                type="text"
                readOnly
                value={activeShareUrl}
                className="share-url-input"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                className="share-copy-btn btn-primary"
                onClick={handleCopyLink}
              >
                {copiedLink ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
              </button>
            </div>
          </div>

          {/* Calendar Export Actions */}
          {activeWindow && (
            <div className="share-input-group">
              <label className="share-field-label">
                Add to calendar · {activeWindow.durationHours}h window
              </label>
              <div className="calendar-export-actions">
                <button
                  type="button"
                  className="cal-export-btn btn-secondary"
                  onClick={handleDownloadIcs}
                >
                  {downloadedIcs ? <CheckIcon size={15} /> : <DownloadIcon size={15} />}
                  <span>Download .ics</span>
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
                <label className="share-field-label">Slack / Teams snippet</label>
                <button
                  type="button"
                  className="slack-copy-btn"
                  onClick={handleCopySlack}
                >
                  {copiedSlack ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                  <span>{copiedSlack ? 'Copied' : 'Copy snippet'}</span>
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
