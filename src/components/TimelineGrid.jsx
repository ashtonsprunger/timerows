import React from 'react';
import { TimeRow } from './TimeRow.jsx';
import { TimeScrubber } from './TimeScrubber.jsx';
import { SparklesIcon } from './Icons.jsx';

export function TimelineGrid({
  cities,
  slotsByCity,
  timelineOverlaps,
  activeHoverIndex,
  onHoverIndex,
  onSelectSlot,
  onRemoveCity,
  referenceCityId,
}) {
  const columnCount = timelineOverlaps.length || 24;
  const hoursArray = Array.from({ length: columnCount }, (_, i) => i);

  return (
    <div
      className="timeline-grid-wrapper"
      onMouseLeave={() => onHoverIndex(null)}
    >
      <div className="timeline-grid-container">
        {/* Top Timeline Hours Header */}
        <div className="timeline-header-row">
          <div className="city-header-spacer">
            <span className="grid-label">Cities & Timezones</span>
          </div>

          <div className="header-hours-track">
            {hoursArray.map((hourIndex) => {
              const colData = timelineOverlaps[hourIndex];
              const isGolden = colData?.isGolden;
              const isHovered = activeHoverIndex === hourIndex;

              return (
                <div
                  key={`hdr-col-${hourIndex}`}
                  className={`header-hour-cell ${isGolden ? 'is-golden-column' : ''} ${
                    isHovered ? 'is-hovered-col' : ''
                  }`}
                  onMouseEnter={() => onHoverIndex(hourIndex)}
                  onClick={() => onSelectSlot(hourIndex)}
                >
                  <span className="hour-num-label">{hourIndex}:00</span>
                  {isGolden && (
                    <span className="golden-column-dot" title="Golden Overlap">
                      <SparklesIcon size={9} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stacked City Rows */}
        <div className="stacked-rows-body">
          {cities.map((city, cIdx) => {
            const citySlots = slotsByCity[city.id] || [];
            const isReference = city.id === referenceCityId;
            const isRemovable = cities.length > 1;

            return (
              <TimeRow
                key={city.id}
                city={city}
                slots={citySlots}
                activeHoverIndex={activeHoverIndex}
                onHoverIndex={onHoverIndex}
                onSelectSlot={onSelectSlot}
                onRemoveCity={onRemoveCity}
                isRemovable={isRemovable}
                isReferenceCity={isReference}
                timelineOverlaps={timelineOverlaps}
              />
            );
          })}
        </div>

        {/* Magnetic Vertical Scrubber Overlay */}
        <TimeScrubber
          activeIndex={activeHoverIndex}
          timelineOverlaps={timelineOverlaps}
          slotWidth={52}
          cityCardWidth={260}
        />
      </div>
    </div>
  );
}
