import React, { useState, useEffect, useMemo, useRef } from 'react';
import './Timeline.css';
import { TimeRow } from './TimeRow.jsx';
import { TimeScrubber } from './TimeScrubber.jsx';
import {
  PlusIcon,
  CalendarIcon,
  ShareIcon,
  SortArrowsIcon,
} from './Icons.jsx';
import { searchCities } from '../engine/citySearch.js';
import { isSameCitySet } from '../engine/cityPresets.js';
import { formatSmartTimeSpan } from '../engine/overlapFormat.js';
import {
  getTimezoneOffset,
  formatTimezoneOffset,
  getTimeParts,
  getRepresentativeSlotIndex,
  getRepresentativeSlot,
} from '../engine/timezoneEngine.js';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TimelineGrid({
  cities,
  slotsByCity,
  timelineOverlaps,
  hoveredIndex,
  onHoverIndex,
  selectedRange,
  onSelectRange,
  onAddCity,
  onSetPrimaryCity,
  onMoveCity,
  onReorderCity,
  onSortCities,
  onRemoveCity,
  workingHours,
  onUpdateCityWorkingHours,
  selectedDate,
  todayIso,
  onDateChange,
  onToday,
  isToday,
  bestWindow,
  customWindow,
  onSelectWindow,
  onShareClick,
  referenceCityId,
  liveTimestamp,
  use24Hour = false,
  headline = null,
  teamPresets = [],
  onLoadPreset,
}) {
  // Inline "+ Place or timezone" search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const searchWrapRef = useRef(null);
  const dateInputRef = useRef(null);
  const canvasRef = useRef(null);
  const bodyRef = useRef(null);

  // Drag / Resize state (.5h precision across entire canvas, including between rows)
  const [isDragging, setIsDragging] = useState(false);
  const dragSessionRef = useRef(null);

  // Last applied sort direction (single toggle: West → East, then East → West)
  const [sortDir, setSortDir] = useState(null);

  // Close inline search dropdown on outside click or touch
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const searchResults = useMemo(() => {
    if (!isDropdownOpen && !searchQuery.trim()) return [];
    return searchCities(searchQuery, { limit: 12 });
  }, [searchQuery, isDropdownOpen]);

  const handleSelectSearchCity = (city) => {
    onAddCity(city);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  // Build fixed 7-day strip always anchored to todayIso (-1 day to +5 days)
  const anchorIso = todayIso || selectedDate;
  const dateStripDays = useMemo(() => {
    try {
      const [y, m, d] = anchorIso.split('-').map(Number);
      const baseUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
      const days = [];
      for (let offset = -1; offset <= 5; offset++) {
        const dt = new Date(baseUtc + offset * 86400000);
        const iso = dt.toISOString().split('T')[0];
        const dayNum = dt.getUTCDate();
        const monthLabel = SHORT_MONTHS[dt.getUTCMonth()];
        const dow = dt.getUTCDay();
        const weekdayName = FULL_WEEKDAYS[dow];
        const shortDow = weekdayName.slice(0, 3);
        const isWeekend = dow === 0 || dow === 6;
        const isSelected = iso === selectedDate;
        days.push({
          iso,
          shortDow,
          dayNum,
          monthLabel,
          label: isSelected ? `${monthLabel} ${dayNum}` : String(dayNum),
          tooltip: `${weekdayName}, ${monthLabel} ${dayNum}`,
          isWeekend,
          isSelected,
        });
      }
      return days;
    } catch {
      return [];
    }
  }, [anchorIso, selectedDate]);

  const referenceSlots = slotsByCity[referenceCityId] || [];
  const totalCols = referenceSlots.length || 24;

  // Determine current real-time hour column and exact minute offset for the live "Now" indicator
  const nowMarker = useMemo(() => {
    if (!isToday || referenceSlots.length === 0) return null;
    const nowMs = liveTimestamp || Date.now();
    for (let i = 0; i < referenceSlots.length; i++) {
      const slotStart = referenceSlots[i].timestamp;
      if (nowMs >= slotStart && nowMs < slotStart + 3600000) {
        const fraction = Math.max(0, Math.min(1, (nowMs - slotStart) / 3600000));
        const colOffset = i + fraction;
        return {
          columnIndex: i,
          leftCalc: `calc(var(--city-col-width, 296px) + ${colOffset.toFixed(4)} * var(--slot-width, 32px))`,
        };
      }
    }
    return null;
  }, [isToday, referenceSlots, liveTimestamp]);

  const activeColumnIndex = useMemo(
    () =>
      getRepresentativeSlotIndex(referenceSlots.length, {
        hoveredIndex,
        selectedRange,
        nowColumnIndex: nowMarker ? nowMarker.columnIndex : null,
      }),
    [referenceSlots.length, hoveredIndex, selectedRange, nowMarker]
  );

  const referenceSlot = getRepresentativeSlot(referenceSlots, {
    activeColumnIndex,
    nowColumnIndex: nowMarker ? nowMarker.columnIndex : null,
  });
  const referenceOffsetMinutes = referenceSlot?.offsetMinutes ?? 0;
  const offsetReferenceTimestamp =
    referenceSlot?.timestamp ?? (liveTimestamp || Date.now());

  const referenceCityObj = useMemo(
    () => cities.find((c) => c.id === referenceCityId) || cities[0],
    [cities, referenceCityId]
  );

  const referenceLiveIsoDate = useMemo(() => {
    try {
      if (!referenceCityObj?.timeZone) return null;
      return getTimeParts(new Date(liveTimestamp || Date.now()), referenceCityObj.timeZone).isoDate;
    } catch {
      return null;
    }
  }, [referenceCityObj, liveTimestamp]);

  // Compute contiguous Golden Overlap spans so we can render unified vertical column bands (#2)
  const goldenSpans = useMemo(() => {
    if (!Array.isArray(timelineOverlaps) || timelineOverlaps.length === 0) return [];
    const spans = [];
    let current = null;
    for (let i = 0; i < timelineOverlaps.length; i++) {
      if (timelineOverlaps[i]?.isGolden) {
        if (!current) {
          current = { startCol: i, endCol: i };
        } else {
          current.endCol = i;
        }
      } else if (current) {
        spans.push(current);
        current = null;
      }
    }
    if (current) spans.push(current);
    return spans;
  }, [timelineOverlaps]);

  // Convert any clientX coordinate on the canvas into hour / 0.5h positions (responsive-aware)
  const getPointerPosition = (clientX) => {
    if (!canvasRef.current) return null;
    const ribbonEl = canvasRef.current.querySelector('.wtb-ribbon-track');
    let ribbonLeft;
    let maxWidth;
    if (ribbonEl) {
      const rRect = ribbonEl.getBoundingClientRect();
      ribbonLeft = rRect.left;
      maxWidth = rRect.width;
    } else {
      const rect = canvasRef.current.getBoundingClientRect();
      ribbonLeft = rect.left + 296;
      maxWidth = totalCols * 32;
    }
    const colWidth = maxWidth / totalCols;
    const relX = clientX - ribbonLeft;
    const isInsideRibbon = relX >= 0 && relX <= maxWidth;
    const clampedX = Math.max(0, Math.min(maxWidth, relX));
    const rawHours = clampedX / colWidth;
    const snappedHalf = Math.round(rawHours * 2) / 2;
    const floorHalf = Math.min(totalCols - 0.5, Math.max(0, Math.floor(rawHours * 2) / 2));
    const hourCol = Math.min(totalCols - 1, Math.max(0, Math.floor(rawHours)));
    return {
      isInsideRibbon,
      rawHours,
      snappedHalf,
      floorHalf,
      hourCol,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const updateSelectionFromClientX = (clientX, clientY = null) => {
      const session = dragSessionRef.current;
      if (!session) return;

      if (session.mode === 'create' && !session.hasMoved) {
        const dx = Math.abs(clientX - session.downClientX);
        const dy =
          clientY !== null && session.downClientY !== undefined
            ? Math.abs(clientY - session.downClientY)
            : 0;
        // On touch devices, if user is scrolling vertically, cancel selection drag so native scroll works
        if (session.isTouch && dy > dx && dy > 8) {
          dragSessionRef.current = null;
          setIsDragging(false);
          return;
        }
        if (dx >= 4) {
          session.hasMoved = true;
        }
      }

      const pos = getPointerPosition(clientX);
      if (!pos) return;

      if (session.mode === 'create') {
        if (session.hasMoved) {
          let startEdge;
          let endEdge;
          if (pos.snappedHalf >= session.anchorHalf) {
            startEdge = session.anchorHalf;
            endEdge = Math.max(session.anchorHalf + 0.5, pos.snappedHalf);
          } else {
            startEdge = pos.snappedHalf;
            endEdge = Math.max(pos.snappedHalf + 0.5, session.anchorHalf + 0.5);
          }
          startEdge = Math.max(0, Math.min(totalCols - 0.5, startEdge));
          endEdge = Math.max(startEdge + 0.5, Math.min(totalCols, endEdge));
          onSelectRange({ startIndex: startEdge, endIndex: endEdge - 1 });
        }
      } else if (session.mode === 'resize-left') {
        const newStartEdge = Math.max(0, Math.min(session.fixedEdge - 0.5, pos.snappedHalf));
        const newEndEdge = session.fixedEdge;
        onSelectRange({ startIndex: newStartEdge, endIndex: newEndEdge - 1 });
      } else if (session.mode === 'resize-right') {
        const newStartEdge = session.fixedEdge;
        const newEndEdge = Math.min(totalCols, Math.max(session.fixedEdge + 0.5, pos.snappedHalf));
        onSelectRange({ startIndex: newStartEdge, endIndex: newEndEdge - 1 });
      }
    };

    const handleGlobalMouseMove = (e) => {
      updateSelectionFromClientX(e.clientX, e.clientY);
    };

    const handleGlobalTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      updateSelectionFromClientX(touch.clientX, touch.clientY);
    };

    const finishDragSession = () => {
      const session = dragSessionRef.current;
      if (session && session.mode === 'create' && !session.hasMoved) {
        const col = session.anchorHourCol;
        if (
          selectedRange &&
          selectedRange.startIndex === col &&
          selectedRange.endIndex === col
        ) {
          onSelectRange(null);
        } else {
          onSelectRange({ startIndex: col, endIndex: col });
        }
      }
      dragSessionRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', finishDragSession);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    window.addEventListener('touchend', finishDragSession);
    window.addEventListener('touchcancel', finishDragSession);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', finishDragSession);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', finishDragSession);
      window.removeEventListener('touchcancel', finishDragSession);
    };
  }, [isDragging, totalCols, selectedRange, onSelectRange]);

  // On narrow screens the grid scrolls horizontally: bring the overlap (or the current hour)
  // into view next to the sticky city column instead of always opening at midnight.
  const focusColumn = goldenSpans[0]?.startCol ?? nowMarker?.columnIndex ?? null;
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || focusColumn === null || body.scrollWidth <= body.clientWidth + 1) return;
    const slotWidth =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-width')) || 32;
    body.scrollLeft = Math.max(0, focusColumn * slotWidth - slotWidth);
    // Re-run only when the focus target changes (new cities, date, or overlap)
  }, [focusColumn, selectedDate, cities.length]);

  // Presses on the (sticky) city column must never start a selection on the ribbons scrolled beneath it
  const isOverCityColumn = (target) => Boolean(target?.closest?.('.wtb-city-col'));

  const handleCanvasMouseDown = (e) => {
    if (e.button !== 0) return;
    if (isOverCityColumn(e.target)) return;
    const pos = getPointerPosition(e.clientX);
    if (!pos || !pos.isInsideRibbon) return;

    dragSessionRef.current = {
      mode: 'create',
      downClientX: e.clientX,
      downClientY: e.clientY,
      anchorHalf: pos.floorHalf,
      anchorHourCol: pos.hourCol,
      hasMoved: false,
      isTouch: false,
    };
    setIsDragging(true);
    onHoverIndex(pos.hourCol);
  };

  const handleCanvasTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    if (isOverCityColumn(e.target)) return;
    const touch = e.touches[0];
    const pos = getPointerPosition(touch.clientX);
    if (!pos || !pos.isInsideRibbon) return;

    dragSessionRef.current = {
      mode: 'create',
      downClientX: touch.clientX,
      downClientY: touch.clientY,
      anchorHalf: pos.floorHalf,
      anchorHourCol: pos.hourCol,
      hasMoved: false,
      isTouch: true,
    };
    setIsDragging(true);
    onHoverIndex(pos.hourCol);
  };

  const handleCanvasMouseMove = (e) => {
    if (isDragging) return;
    const pos = isOverCityColumn(e.target) ? null : getPointerPosition(e.clientX);
    if (pos && pos.isInsideRibbon) {
      onHoverIndex(pos.hourCol);
    } else {
      onHoverIndex(null);
    }
  };

  const handleResizeStart = (side) => {
    if (!selectedRange) return;
    const rawEnd = selectedRange.endIndex ?? selectedRange.startIndex;
    const isRev = rawEnd < selectedRange.startIndex - 0.5;
    const curStartEdge = Math.max(0, isRev ? rawEnd : selectedRange.startIndex);
    const curEndEdge = Math.max(curStartEdge + 0.5, (isRev ? selectedRange.startIndex : rawEnd) + 1);

    dragSessionRef.current = {
      mode: side === 'left' ? 'resize-left' : 'resize-right',
      fixedEdge: side === 'left' ? curEndEdge : curStartEdge,
      hasMoved: true,
    };
    setIsDragging(true);
  };

  // Determine active lens position (locked selection > hover)
  let scrubberStart = null;
  let scrubberEnd = null;
  let isRangeLocked = false;

  if (selectedRange) {
    scrubberStart = selectedRange.startIndex;
    scrubberEnd = selectedRange.endIndex;
    isRangeLocked = true;
  } else if (hoveredIndex !== null && hoveredIndex !== undefined) {
    scrubberStart = hoveredIndex;
    scrubberEnd = hoveredIndex;
    isRangeLocked = false;
  }

  const scrubberRangeLabel = useMemo(() => {
    if (!customWindow?.citySummaries?.length) return '';
    const refSummary =
      customWindow.citySummaries.find((s) => s.cityId === referenceCityId) ||
      customWindow.citySummaries[0];
    if (!refSummary) return `${customWindow.durationHours}h`;
    const timeSpan = use24Hour
      ? formatSmartTimeSpan(refSummary.startTime24, refSummary.endTime24, true)
      : formatSmartTimeSpan(refSummary.startTime, refSummary.endTime, false);
    return `${timeSpan} · ${customWindow.durationHours}h`;
  }, [customWindow, referenceCityId, use24Hour]);

  return (
    <>
      {/* Top Board Toolbar: Inline Search + Sort + 7-Day Date Strip + Share */}
      <div className="wtb-board-toolbar">
        {/* Left: Primary "+ Place or timezone" Autocomplete Search + Sort Triangles */}
        <div className="wtb-toolbar-left">
          <div className="wtb-inline-search-wrap" ref={searchWrapRef}>
            <div className="wtb-inline-search-box">
              <span className="wtb-search-plus">
                <PlusIcon size={14} />
              </span>
              <input
                type="text"
                className="wtb-inline-search-input"
                placeholder="Place or timezone"
                value={searchQuery}
                onFocus={() => {
                  setIsDropdownOpen(true);
                  setFocusedIdx(0);
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  setFocusedIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedIdx((p) => Math.min(searchResults.length - 1, p + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIdx((p) => Math.max(0, p - 1));
                  } else if (e.key === 'Enter' && searchResults.length > 0) {
                    e.preventDefault();
                    handleSelectSearchCity(searchResults[focusedIdx] || searchResults[0]);
                  }
                }}
              />
            </div>

            {isDropdownOpen && (searchResults.length > 0 || searchQuery.trim().length > 0) && (
              <div className="wtb-search-dropdown">
                {!searchQuery.trim() && teamPresets.length > 0 && (
                  <div className="wtb-dropdown-section">
                    <div className="wtb-dropdown-heading">Popular teams</div>
                    {teamPresets.map((preset) => {
                      const isActive = isSameCitySet(cities, preset.cities);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`wtb-dropdown-preset ${isActive ? 'is-active' : ''}`}
                          onClick={() => {
                            if (onLoadPreset) onLoadPreset(preset);
                            setSearchQuery('');
                            setIsDropdownOpen(false);
                          }}
                        >
                          <span>{preset.label}</span>
                          <span className="wtb-dropdown-meta">
                            {isActive ? 'Current' : `${preset.cities.length} cities`}
                          </span>
                        </button>
                      );
                    })}
                    <div className="wtb-dropdown-heading">Popular cities</div>
                  </div>
                )}
                {searchResults.length > 0 ? (
                  searchResults.map((city, idx) => {
                    const isPinned = cities.some(
                      (c) =>
                        c.id === city.id ||
                        (c.name.toLowerCase() === city.name.toLowerCase() &&
                          c.timeZone === city.timeZone)
                    );
                    let offsetTag = '';
                    try {
                      const mins = getTimezoneOffset(city.timeZone, offsetReferenceTimestamp);
                      offsetTag = `UTC${formatTimezoneOffset(mins)}`;
                    } catch {
                      // ignore
                    }
                    return (
                      <div
                        key={city.id || `${city.name}-${city.timeZone}`}
                        className={`wtb-dropdown-item ${idx === focusedIdx ? 'is-focused' : ''} ${
                          isPinned ? 'is-pinned' : ''
                        }`}
                        onMouseEnter={() => setFocusedIdx(idx)}
                        onClick={() => handleSelectSearchCity(city)}
                      >
                        <div>
                          <span className="wtb-dropdown-city">{city.name}</span>
                          {city.country && (
                            <span className="wtb-dropdown-country">{city.country}</span>
                          )}
                        </div>
                        <span className="wtb-dropdown-meta">
                          {isPinned ? 'Pinned' : offsetTag}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="wtb-dropdown-empty">
                    No matching places or timezones for &ldquo;{searchQuery.trim()}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`wtb-sort-toggle ${sortDir ? 'is-sorted' : ''}`}
            onClick={() => {
              const nextDir = sortDir === 'asc' ? 'desc' : 'asc';
              setSortDir(nextDir);
              if (onSortCities) onSortCities(nextDir);
            }}
            data-tooltip={
              sortDir === 'asc' ? 'Sort by offset: East → West' : 'Sort by offset: West → East'
            }
            aria-label={
              sortDir === 'asc'
                ? 'Sort rows by UTC offset, East to West'
                : 'Sort rows by UTC offset, West to East'
            }
          >
            <SortArrowsIcon size={15} />
          </button>
        </div>

        {/* Center: Calendar Button + 7-Day Date Strip */}
        <div className="wtb-date-strip">
          <button
            type="button"
            className="wtb-cal-picker-btn"
            title="Pick a specific date"
            onClick={() => {
              if (dateInputRef.current?.showPicker) {
                try {
                  dateInputRef.current.showPicker();
                } catch {
                  dateInputRef.current.focus();
                }
              }
            }}
          >
            <CalendarIcon size={15} />
            <input
              ref={dateInputRef}
              type="date"
              className="hidden-date-picker"
              value={selectedDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              aria-label="Choose calendar date"
            />
          </button>

          {dateStripDays.map((d, idx) => {
            const isMonthStart = idx > 0 && d.dayNum === 1 && !d.isSelected;
            return (
              <button
                key={d.iso}
                type="button"
                className={`wtb-strip-day-btn ${d.isSelected ? 'is-selected' : ''} ${
                  d.isWeekend ? 'is-weekend' : ''
                } ${isMonthStart ? 'is-month-start' : ''}`}
                data-tooltip={d.tooltip}
                aria-label={d.tooltip}
                onClick={() => onDateChange(d.iso)}
              >
                {d.isSelected && <span className="strip-dow">{d.shortDow}</span>}
                {isMonthStart && <span className="strip-month-tag">{d.monthLabel}</span>}
                <span className="strip-num">
                  {d.isSelected ? `${d.monthLabel} ${d.dayNum}` : d.dayNum}
                </span>
              </button>
            );
          })}

          {!isToday && (
            <button
              type="button"
              className="wtb-today-jump-btn"
              onClick={onToday}
              title="Return to Today"
            >
              Today
            </button>
          )}
        </div>

        {/* Right: Share (export options live inside the Share modal) */}
        <div className="wtb-toolbar-right">
          <button
            type="button"
            className="wtb-share-link-btn"
            onClick={onShareClick}
            title="Share link or export calendar invite"
          >
            <ShareIcon size={13} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Headline answer row (Best overlap) sits directly above the grid */}
      {headline}

      {/* Main Stacked Ribbons Body */}
      <div
        className="wtb-board-body"
        ref={bodyRef}
        onMouseLeave={() => {
          if (!isDragging) onHoverIndex(null);
        }}
      >
        <div
          className={`wtb-rows-canvas ${isRangeLocked ? 'has-selection' : ''}`}
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onTouchStart={handleCanvasTouchStart}
        >
          {/* Unified Vertical Golden Overlap Column Bands (label lives in the answer row above) */}
          {goldenSpans.map((span) => {
            const hrs = span.endCol - span.startCol + 1;
            return (
              <div
                key={`golden-band-${span.startCol}-${span.endCol}`}
                className={`wtb-golden-band ${isRangeLocked ? 'is-dimmed' : ''}`}
                aria-hidden="true"
                style={{
                  left: `calc(var(--city-col-width, 296px) + ${span.startCol} * var(--slot-width, 32px))`,
                  width: `calc(${hrs} * var(--slot-width, 32px))`,
                }}
              />
            );
          })}

          {/* Exact-minute live "Now" dot (the current-hour column is tinted in each row) */}
          {nowMarker && (
            <div
              className={`wtb-now-indicator ${isRangeLocked ? 'is-dimmed' : ''}`}
              style={{ left: nowMarker.leftCalc }}
            >
              <span className="wtb-now-dot" data-tooltip="Current time" />
            </div>
          )}

          <div className="wtb-rows-list">
            {cities.map((city, cIdx) => {
              const citySlots = slotsByCity[city.id] || [];
              const isReference = city.id === referenceCityId;
              const isRemovable = cities.length > 1;

              return (
                <TimeRow
                  key={city.id}
                  city={city}
                  rowIndex={cIdx}
                  totalRows={cities.length}
                  slots={citySlots}
                  referenceOffsetMinutes={referenceOffsetMinutes}
                  referenceLiveIsoDate={referenceLiveIsoDate}
                  liveTimestamp={liveTimestamp}
                  use24Hour={use24Hour}
                  defaultWorkingHours={workingHours}
                  onUpdateCityWorkingHours={onUpdateCityWorkingHours}
                  onSetPrimaryCity={onSetPrimaryCity}
                  onMoveCity={onMoveCity}
                  onReorderCity={onReorderCity}
                  onRemoveCity={onRemoveCity}
                  isRemovable={isRemovable}
                  isReferenceCity={isReference}
                  timelineOverlaps={timelineOverlaps}
                  nowColumnIndex={nowMarker ? nowMarker.columnIndex : null}
                  activeColumnIndex={activeColumnIndex}
                />
              );
            })}
          </div>

          {/* Single Clean Vertical Lens Scrubber */}
          <TimeScrubber
            startIndex={scrubberStart}
            endIndex={scrubberEnd}
            isLocked={isRangeLocked}
            rangeLabel={scrubberRangeLabel}
            slotWidth={32}
            cityCardWidth={296}
            totalColumns={totalCols}
            onResizeStart={handleResizeStart}
          />
        </div>
      </div>
    </>
  );
}
