import React from 'react';
import { SunIcon, MoonIcon, SunriseIcon, TrashIcon } from './Icons.jsx';
import { PHASE_TYPES } from '../engine/timezoneEngine.js';

export function TimeRow({
  city,
  slots,
  activeHoverIndex,
  onHoverIndex,
  onSelectSlot,
  onRemoveCity,
  isRemovable,
  isReferenceCity,
  timelineOverlaps,
}) {
  // Format current live time in this city's timezone
  const currentLiveTime = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: city.timeZone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date());
    } catch {
      return '';
    }
  }, [city.timeZone]);

  const offsetFormatted = slots[0]?.offsetFormatted || '';
  const abbreviation = slots[0]?.abbreviation || '';

  return (
    <div className={`timerow-container ${isReferenceCity ? 'is-reference-row' : ''}`}>
      {/* City Header Card */}
      <div className="city-info-card">
        <div className="city-meta-wrapper">
          <div className="city-title-row">
            <span className="city-name" title={city.name}>{city.name}</span>
            {isReferenceCity && <span className="reference-badge">Primary</span>}
          </div>

          <div className="city-sub-row">
            <span className="city-offset-tag">{abbreviation} ({offsetFormatted})</span>
            <span className="city-live-clock">{currentLiveTime}</span>
          </div>
        </div>

        {isRemovable && (
          <button
            type="button"
            className="city-remove-btn"
            onClick={() => onRemoveCity(city.id)}
            title={`Remove ${city.name}`}
            aria-label={`Remove ${city.name}`}
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>

      {/* 24-Hour Slots Track */}
      <div className="slots-track-wrapper">
        <div className="slots-track">
          {slots.map((slot, index) => {
            const isHovered = activeHoverIndex === index;
            const isGolden = timelineOverlaps?.[index]?.isGolden;
            const phase = slot.phase;

            const phaseClass =
              phase === PHASE_TYPES.WORK
                ? 'phase-work'
                : phase === PHASE_TYPES.SLEEP
                ? 'phase-sleep'
                : 'phase-awake';

            return (
              <div
                key={`${city.id}-slot-${index}`}
                className={`time-slot-card ${phaseClass} ${isGolden ? 'is-golden-slot' : ''} ${
                  isHovered ? 'is-slot-hovered' : ''
                }`}
                onMouseEnter={() => onHoverIndex(index)}
                onClick={() => onSelectSlot(index)}
                title={`${city.name}: ${slot.formattedTime12} (${slot.phase}${
                  slot.dayRollover ? `, ${slot.dayRollover}` : ''
                })`}
              >
                {/* Rollover badge (+1 Day / -1 Day) */}
                {slot.dayRollover && (
                  <span className={`slot-rollover-badge ${slot.dateDifference > 0 ? 'rollover-next' : 'rollover-prev'}`}>
                    {slot.dayRollover}
                  </span>
                )}

                {/* Hour Display */}
                <span className="slot-hour-text">{slot.hourDisplay}</span>

                {/* Phase Mini-Icon */}
                <span className="slot-phase-icon">
                  {phase === PHASE_TYPES.WORK && <SunIcon size={11} />}
                  {phase === PHASE_TYPES.SLEEP && <MoonIcon size={11} />}
                  {phase === PHASE_TYPES.AWAKE && <SunriseIcon size={11} />}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
