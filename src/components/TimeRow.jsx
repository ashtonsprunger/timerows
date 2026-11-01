import React, { useState, useRef, useEffect } from 'react';
import { HomePinIcon, CloseIcon, ChevronUpIcon } from './Icons.jsx';
import { PHASE_TYPES, getTimeParts, formatRelativeOffset } from '../engine/timezoneEngine.js';
import { formatHourOption } from './Header.jsx';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const START_HOURS = Array.from({ length: 24 }, (_, i) => i);
const END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);

function formatCompactRange(start, end, use24Hour) {
  if (use24Hour) {
    return `${start}:00–${end}:00`;
  }
  const s12 = start % 12 || 12;
  const sAp = start < 12 ? 'a' : 'p';
  const normEnd = ((end % 24) + 24) % 24;
  const e12 = normEnd % 12 || 12;
  const eAp = normEnd < 12 ? 'a' : 'p';
  return `${s12}${sAp}–${e12}${eAp}`;
}

export function TimeRow({
  city,
  rowIndex,
  totalRows,
  slots,
  referenceOffsetMinutes = 0,
  referenceLiveIsoDate = null,
  liveTimestamp,
  use24Hour = false,
  defaultWorkingHours,
  onUpdateCityWorkingHours,
  onSetPrimaryCity,
  onMoveCity,
  onReorderCity,
  onRemoveCity,
  isRemovable,
  isReferenceCity,
  timelineOverlaps,
  nowColumnIndex = null,
}) {
  const [isWorkPopoverOpen, setIsWorkPopoverOpen] = useState(false);
  const [isDraggingRow, setIsDraggingRow] = useState(false);
  const [isDragOverRow, setIsDragOverRow] = useState(false);
  const workPopoverRef = useRef(null);

  useEffect(() => {
    if (!isWorkPopoverOpen) return;
    const handleClickOut = (e) => {
      if (workPopoverRef.current && !workPopoverRef.current.contains(e.target)) {
        setIsWorkPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOut);
    return () => document.removeEventListener('mousedown', handleClickOut);
  }, [isWorkPopoverOpen]);

  const effectiveWorkHours = city.workingHours || defaultWorkingHours || { start: 9, end: 17 };
  const hasCustomWorkHours = Boolean(city.workingHours);

  // Format live ticking clock, date, and day-offset badge (+1d / -1d) for this city
  const { liveClockMain, liveClockSuffix, liveDateStr, dayDiffBadge } = React.useMemo(() => {
    try {
      const now = new Date(liveTimestamp || Date.now());
      const parts = getTimeParts(now, city.timeZone);
      const minPad = String(parts.minute).padStart(2, '0');
      const main = use24Hour
        ? `${String(parts.hour).padStart(2, '0')}:${minPad}`
        : `${parts.hour12}:${minPad}`;
      const suffix = use24Hour ? '' : parts.ampm;

      const dateFormatted = new Intl.DateTimeFormat('en-US', {
        timeZone: city.timeZone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(now);

      let diffTag = null;
      if (!isReferenceCity && referenceLiveIsoDate && parts.isoDate && parts.isoDate !== referenceLiveIsoDate) {
        const refMs = Date.parse(`${referenceLiveIsoDate}T00:00:00Z`);
        const cityMs = Date.parse(`${parts.isoDate}T00:00:00Z`);
        const diffDays = Math.round((cityMs - refMs) / 86400000);
        if (diffDays > 0) diffTag = `+${diffDays}d`;
        else if (diffDays < 0) diffTag = `${diffDays}d`;
      }

      return {
        liveClockMain: main,
        liveClockSuffix: suffix,
        liveDateStr: dateFormatted,
        dayDiffBadge: diffTag,
      };
    } catch {
      return { liveClockMain: '', liveClockSuffix: '', liveDateStr: '', dayDiffBadge: null };
    }
  }, [city.timeZone, liveTimestamp, use24Hour, isReferenceCity, referenceLiveIsoDate]);

  const cityOffsetMinutes = slots[0]?.offsetMinutes ?? 0;
  const abbreviation = slots[0]?.abbreviation || '';
  const displayName = city.name === 'UTC / GMT' ? 'UTC' : city.name;
  const showTzLabel =
    Boolean(abbreviation) &&
    !displayName.toUpperCase().includes(abbreviation.toUpperCase());

  // Second line under the city name: timezone abbreviation (EDT, GMT, GMT+5:30).
  // Falls back to country only when the abbreviation would repeat the name (e.g. "UTC").
  const fallbackCountry =
    city.country === 'Coordinated Universal Time'
      ? 'Universal Time'
      : city.country || city.timeZone.replace(/_/g, ' ');
  const secondaryLabel = showTzLabel ? abbreviation : fallbackCountry;

  // Compute relative offset from Home/Primary city (+1h, +5h, -3h, +5.5h, +5:45)
  const relativeOffsetText = React.useMemo(() => {
    if (isReferenceCity) return null;
    const diffMins = cityOffsetMinutes - referenceOffsetMinutes;
    return formatRelativeOffset(diffMins);
  }, [isReferenceCity, cityOffsetMinutes, referenceOffsetMinutes]);

  // Helper to check if a slot is a midnight date-change cell
  const isMidnightSlot = (slot, idx) => {
    if (!slot) return false;
    if (slot.hour === 0) return true;
    if (idx > 0 && slots[idx - 1] && slots[idx - 1].dateStr !== slot.dateStr) return true;
    return false;
  };

  return (
    <div
      className={`wtb-row ${isReferenceCity ? 'is-home-row' : ''} ${
        isDraggingRow ? 'is-dragging-row' : ''
      } ${isDragOverRow ? 'is-drag-over-row' : ''}`}
      onDragOver={(e) => {
        if (totalRows <= 1 || !onReorderCity) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragOverRow) setIsDragOverRow(true);
      }}
      onDragLeave={() => {
        if (isDragOverRow) setIsDragOverRow(false);
      }}
      onDrop={(e) => {
        setIsDragOverRow(false);
        if (totalRows <= 1 || !onReorderCity) return;
        e.preventDefault();
        const fromIdx = Number(e.dataTransfer.getData('text/plain'));
        if (!Number.isNaN(fromIdx) && fromIdx !== rowIndex) {
          onReorderCity(fromIdx, rowIndex);
        }
      }}
    >
      {/* Left 3-Part City Column (296px Fixed Width) — draggable handle for reordering rows */}
      <div
        className="wtb-city-col"
        draggable={totalRows > 1 && Boolean(onReorderCity)}
        onDragStart={(e) => {
          if (totalRows <= 1 || !onReorderCity) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(rowIndex));
          setIsDraggingRow(true);
        }}
        onDragEnd={() => {
          setIsDraggingRow(false);
          setIsDragOverRow(false);
        }}
      >
        {/* 1. Hover Tools + Offset/Home Badge (64px) */}
        <div className="wtb-gutter">
          <div className="wtb-row-hover-tools">
            {isRemovable && (
              <button
                type="button"
                className="wtb-micro-btn btn-remove"
                onClick={() => onRemoveCity(city.id)}
                title={`Remove ${city.name}`}
                aria-label={`Remove ${city.name}`}
              >
                <CloseIcon size={13} />
              </button>
            )}
            {!isReferenceCity && (
              <button
                type="button"
                className="wtb-micro-btn"
                onClick={() => onSetPrimaryCity(city.id)}
                title={`Make ${city.name} Home / Primary city`}
                aria-label={`Set ${city.name} as Home`}
              >
                <HomePinIcon size={13} />
              </button>
            )}
            {totalRows > 1 && rowIndex > 0 && (
              <button
                type="button"
                className="wtb-micro-btn"
                onClick={() => onMoveCity(rowIndex, -1)}
                title="Move row up"
                aria-label={`Move ${city.name} up`}
              >
                <ChevronUpIcon size={14} />
              </button>
            )}
          </div>

          <div
            className={`wtb-offset-cell ${isReferenceCity ? 'is-home-badge' : ''}`}
            title={isReferenceCity ? 'Home / Primary reference city' : 'Hours from Home city'}
          >
            {isReferenceCity ? (
              <span className="wtb-home-icon">
                <HomePinIcon size={13} />
              </span>
            ) : (
              <span>{relativeOffsetText}</span>
            )}
          </div>
        </div>

        {/* 2. City Name over Timezone (country only as fallback) + Custom Work Hours Pill */}
        <div className="wtb-place-info" ref={workPopoverRef}>
          <div className="wtb-place-title-line">
            <span className="wtb-city-name" title={city.country ? `${displayName}, ${city.country}` : displayName}>
              {displayName}
            </span>
          </div>
          <div className={`wtb-country-line ${dayDiffBadge ? 'has-day-diff' : ''}`}>
            {/* Phone-only: live time moves under the city name (the clock column is hidden) */}
            <span className="wtb-compact-clock" aria-hidden="true">
              <span>
                {liveClockMain}
                {liveClockSuffix && ` ${liveClockSuffix.toLowerCase()}`}
              </span>
              {dayDiffBadge && <span className="wtb-day-diff-tag">{dayDiffBadge}</span>}
              <span className="wtb-compact-sep">·</span>
            </span>
            <span className="wtb-country-sub">{secondaryLabel}</span>
            {onUpdateCityWorkingHours && (
              <button
                type="button"
                className={`wtb-city-work-btn ${hasCustomWorkHours ? 'is-custom' : ''}`}
                onClick={() => setIsWorkPopoverOpen((v) => !v)}
                title={`Customize working hours for ${city.name}`}
              >
                {formatCompactRange(effectiveWorkHours.start, effectiveWorkHours.end, use24Hour)}
              </button>
            )}
          </div>

          {isWorkPopoverOpen && onUpdateCityWorkingHours && (
            <div className="wtb-city-work-popover">
              <div className="wtb-work-pop-header">
                <span>{city.name} work hours</span>
                {hasCustomWorkHours && (
                  <button
                    type="button"
                    className="wtb-work-reset-btn"
                    onClick={() => {
                      onUpdateCityWorkingHours(city.id, null);
                      setIsWorkPopoverOpen(false);
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="wtb-work-pop-controls">
                <select
                  className="wtb-work-select"
                  value={effectiveWorkHours.start}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    const nextEnd =
                      effectiveWorkHours.end <= nextStart
                        ? Math.min(24, nextStart + 1)
                        : effectiveWorkHours.end;
                    onUpdateCityWorkingHours(city.id, { start: nextStart, end: nextEnd });
                  }}
                >
                  {START_HOURS.map((h) => (
                    <option key={`cstart-${h}`} value={h}>
                      {formatHourOption(h, use24Hour)}
                    </option>
                  ))}
                </select>
                <span>–</span>
                <select
                  className="wtb-work-select"
                  value={effectiveWorkHours.end}
                  onChange={(e) => {
                    const nextEnd = Number(e.target.value);
                    const nextStart =
                      effectiveWorkHours.start >= nextEnd
                        ? Math.max(0, nextEnd - 1)
                        : effectiveWorkHours.start;
                    onUpdateCityWorkingHours(city.id, { start: nextStart, end: nextEnd });
                  }}
                >
                  {END_HOURS.map((h) => (
                    <option key={`cend-${h}`} value={h}>
                      {formatHourOption(h, use24Hour)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 3. Prominent Live Time + Local Date (+1d / -1d badge) */}
        <div className="wtb-live-clock-col">
          <div className="wtb-live-time">
            <span>{liveClockMain}</span>
            {liveClockSuffix && <span className="wtb-live-ampm">{liveClockSuffix}</span>}
          </div>
          <div className="wtb-live-date">
            <span>{liveDateStr}</span>
            {dayDiffBadge && (
              <span
                className="wtb-day-diff-tag"
                title={dayDiffBadge.startsWith('+') ? 'Tomorrow relative to Home city' : 'Yesterday relative to Home city'}
              >
                {dayDiffBadge}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Continuous 24-Hour Time Ribbon */}
      <div className="wtb-ribbon-wrap">
        <div className="wtb-ribbon-track">
          {slots.map((slot, index) => {
            const isMidnight = isMidnightSlot(slot, index);
            const isFirst = index === 0;
            const isLast = index === slots.length - 1;

            const isGolden = timelineOverlaps?.[index]?.isGolden;
            const phase = slot.phase;

            const basePhaseClass =
              phase === PHASE_TYPES.WORK
                ? 'wtb-phase-work'
                : phase === PHASE_TYPES.SLEEP
                ? 'wtb-phase-sleep'
                : 'wtb-phase-awake';

            const midnightClass = isMidnight ? 'wtb-cell-midnight' : '';
            const capLeft = isFirst ? 'wtb-cap-left' : '';
            const capRight = isLast ? 'wtb-cap-right' : '';
            const nowClass = index === nowColumnIndex ? 'is-now-col' : '';

            const slotHour = slot.hour ?? 0;
            const slotHour12 = slot.hour12 ?? (slotHour % 12 || 12);
            const slotAmpm = (slot.ampm || (slotHour >= 12 ? 'PM' : 'AM')).toLowerCase();
            const hasMinutes = (slot.minute ?? 0) !== 0;
            const minStr = String(slot.minute ?? 0).padStart(2, '0');

            const monthAbbrev = SHORT_MONTHS[(slot.month || 1) - 1] || '';
            const dayOfWeekShort = (slot.dayOfWeek || '').slice(0, 3).toUpperCase();

            return (
              <div
                key={`${city.id}-slot-${index}`}
                className={`wtb-hour-cell ${basePhaseClass} ${midnightClass} ${capLeft} ${capRight} ${nowClass} ${
                  isGolden && !isMidnight ? 'wtb-golden-col' : ''
                }`}
                title={`${city.name}: ${
                  use24Hour ? slot.formattedTime24 : slot.formattedTime12
                } (${slot.dayOfWeek}, ${monthAbbrev} ${slot.day})`}
              >
                {isMidnight ? (
                  <>
                    <span className="wtb-midnight-month">{dayOfWeekShort || monthAbbrev}</span>
                    <span className="wtb-midnight-day">{slot.day}</span>
                  </>
                ) : use24Hour ? (
                  <>
                    <span className="wtb-cell-num">{slotHour}</span>
                    {hasMinutes && <span className="wtb-cell-sub">{minStr}</span>}
                  </>
                ) : (
                  <>
                    <span className={hasMinutes ? 'wtb-cell-num-fractional' : 'wtb-cell-num'}>
                      {hasMinutes ? `${slotHour12}:${minStr}` : slotHour12}
                    </span>
                    {(slotHour === 12 || index === 0 || hasMinutes) && (
                      <span className="wtb-cell-sub">{slotAmpm}</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
