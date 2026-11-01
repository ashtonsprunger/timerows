import React from 'react';

export function TimeScrubber({
  startIndex,
  endIndex,
  isLocked = false,
  slotWidth = 32,
  cityCardWidth = 296,
  totalColumns = 24,
  rangeLabel,
  onResizeStart,
}) {
  if (startIndex === null || startIndex === undefined || startIndex < 0) {
    return null;
  }

  const maxCol = Math.max(1, totalColumns);
  const clampedStart = Math.min(startIndex, maxCol - 0.5);
  const rawEnd = Math.min(endIndex ?? clampedStart, maxCol - 0.5);
  const isReversed = rawEnd < clampedStart - 0.5;
  const startEdge = Math.max(0, Math.min(maxCol - 0.5, isReversed ? rawEnd : clampedStart));
  const endEdge = Math.min(
    maxCol,
    Math.max(startEdge + 0.5, (isReversed ? clampedStart : rawEnd) + 1)
  );
  const spanHours = endEdge - startEdge;

  return (
    <div
      className={`wtb-lens-scrubber ${isLocked ? 'is-locked' : ''}`}
      style={{
        left: `calc(var(--city-col-width, ${cityCardWidth}px) + ${startEdge} * var(--slot-width, ${slotWidth}px))`,
        width: `calc(${spanHours} * var(--slot-width, ${slotWidth}px))`,
      }}
      aria-hidden="true"
    >
      <div className="wtb-lens-box" />
      {isLocked && (
        <>
          <div className="wtb-lens-badge">{rangeLabel || `${spanHours}h`}</div>
          <div
            className="wtb-scrubber-handle handle-left"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onResizeStart) onResizeStart('left', e);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              if (onResizeStart) onResizeStart('left', e);
            }}
            title="Drag to adjust start time (0.5h increments)"
          />
          <div
            className="wtb-scrubber-handle handle-right"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onResizeStart) onResizeStart('right', e);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              if (onResizeStart) onResizeStart('right', e);
            }}
            title="Drag to adjust end time (0.5h increments)"
          />
        </>
      )}
    </div>
  );
}
