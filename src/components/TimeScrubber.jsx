import React from 'react';
import { SparklesIcon } from './Icons.jsx';
import { OVERLAP_QUALITY } from '../engine/overlapEngine.js';

export function TimeScrubber({
  activeIndex,
  timelineOverlaps,
  slotWidth = 52,
  cityCardWidth = 260,
}) {
  if (activeIndex === null || activeIndex === undefined || activeIndex < 0) {
    return null;
  }

  const columnData = timelineOverlaps?.[activeIndex];
  const isGolden = columnData?.quality === OVERLAP_QUALITY.GOLDEN;
  const isGood = columnData?.quality === OVERLAP_QUALITY.GOOD;

  // Calculate pixel position of the vertical magnetic guide
  const leftPosition = cityCardWidth + activeIndex * slotWidth + slotWidth / 2;

  return (
    <div
      className="magnetic-scrubber-container"
      style={{ left: `${leftPosition}px` }}
      aria-hidden="true"
    >
      {/* Top Floating Time Bubble */}
      <div className={`scrubber-bubble ${isGolden ? 'bubble-golden' : isGood ? 'bubble-good' : ''}`}>
        {isGolden ? (
          <div className="scrubber-bubble-header golden-text">
            <SparklesIcon size={12} />
            <span>Golden Overlap</span>
          </div>
        ) : (
          <div className="scrubber-bubble-header">
            <span>{columnData?.workingCount || 0}/{columnData?.totalCities || 0} Working</span>
          </div>
        )}
      </div>

      {/* Vertical Laser Guideline */}
      <div className={`scrubber-line ${isGolden ? 'line-golden' : ''}`} />
    </div>
  );
}
