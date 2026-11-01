import React, { useState, useRef, useEffect } from 'react';
import { SunIcon, MoonIcon, TimeRowsLogo, ChevronDownIcon } from './Icons.jsx';

export function formatHourOption(hour, use24Hour) {
  const norm = ((hour % 24) + 24) % 24;
  if (use24Hour) {
    return `${String(norm).padStart(2, '0')}:00`;
  }
  const h12 = norm % 12 || 12;
  const ampm = norm < 12 ? 'am' : 'pm';
  return `${h12}:00 ${ampm}`;
}

export function formatCompactHour(hour, use24Hour) {
  const norm = ((hour % 24) + 24) % 24;
  if (use24Hour) {
    return `${String(norm).padStart(2, '0')}:00`;
  }
  const h12 = norm % 12 || 12;
  const ampm = norm < 12 ? 'am' : 'pm';
  return `${h12} ${ampm}`;
}

const START_HOURS = Array.from({ length: 24 }, (_, i) => i);
const END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);

const WORK_PRESETS = [
  { label: '9a – 5p', start: 9, end: 17 },
  { label: '8a – 5p', start: 8, end: 17 },
  { label: '9a – 6p', start: 9, end: 18 },
  { label: '8a – 6p', start: 8, end: 18 },
];

export function Header({
  use24Hour,
  onToggle24Hour,
  workingHours,
  onWorkingHoursChange,
  theme,
  onToggleTheme,
}) {
  const [isWorkOpen, setIsWorkOpen] = useState(false);
  const workPopoverRef = useRef(null);

  const startHour = workingHours?.start ?? 9;
  const endHour = workingHours?.end ?? 17;

  useEffect(() => {
    if (!isWorkOpen) return;
    const handleClickOutside = (e) => {
      if (workPopoverRef.current && !workPopoverRef.current.contains(e.target)) {
        setIsWorkOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isWorkOpen]);

  const handleStartChange = (e) => {
    const nextStart = Number(e.target.value);
    if (!isNaN(nextStart)) {
      const nextEnd = endHour <= nextStart ? Math.min(24, nextStart + 1) : endHour;
      onWorkingHoursChange({ start: nextStart, end: nextEnd });
    }
  };

  const handleEndChange = (e) => {
    const nextEnd = Number(e.target.value);
    if (!isNaN(nextEnd)) {
      const nextStart = startHour >= nextEnd ? Math.max(0, nextEnd - 1) : startHour;
      onWorkingHoursChange({ start: nextStart, end: nextEnd });
    }
  };

  return (
    <header className="wtb-top-nav">
      <div className="wtb-brand">
        <div className="wtb-logo-icon" aria-hidden="true">
          <TimeRowsLogo size={25} />
        </div>
        <span className="wtb-brand-name">timerows</span>
      </div>

      <div className="wtb-top-controls">
        <div className="wtb-work-hours-wrap" ref={workPopoverRef}>
          <button
            type="button"
            className={`wtb-work-hours-pill ${isWorkOpen ? 'is-open' : ''}`}
            onClick={() => setIsWorkOpen((v) => !v)}
            title="Default core working hours"
            aria-expanded={isWorkOpen}
          >
            <span className="wtb-work-pill-label">Work hours</span>
            <strong className="wtb-work-pill-val">
              {formatCompactHour(startHour, use24Hour)} – {formatCompactHour(endHour, use24Hour)}
            </strong>
            <ChevronDownIcon size={13} className="wtb-work-pill-chevron" />
          </button>

          {isWorkOpen && (
            <div className="wtb-header-work-popover">
              <div className="wtb-work-pop-header">
                <span>Default working hours</span>
              </div>

              <div className="wtb-work-preset-row">
                {WORK_PRESETS.map((p) => {
                  const isActive = startHour === p.start && endHour === p.end;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className={`wtb-work-preset-chip ${isActive ? 'is-active' : ''}`}
                      onClick={() => {
                        onWorkingHoursChange({ start: p.start, end: p.end });
                        setIsWorkOpen(false);
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <div className="wtb-work-pop-controls">
                <select
                  className="wtb-work-select-clean"
                  value={startHour}
                  onChange={handleStartChange}
                  aria-label="Working hours start"
                >
                  {START_HOURS.map((h) => (
                    <option key={`start-${h}`} value={h}>
                      {formatHourOption(h, use24Hour)}
                    </option>
                  ))}
                </select>
                <span className="wtb-work-sep">to</span>
                <select
                  className="wtb-work-select-clean"
                  value={endHour}
                  onChange={handleEndChange}
                  aria-label="Working hours end"
                >
                  {END_HOURS.map((h) => (
                    <option key={`end-${h}`} value={h}>
                      {formatHourOption(h, use24Hour)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Classic WTB am/pm | 24 toggle */}
        <div className="wtb-format-switch" role="group" aria-label="Time format">
          <button
            type="button"
            className={`wtb-format-btn ${!use24Hour ? 'is-active' : ''}`}
            onClick={() => use24Hour && onToggle24Hour()}
            title="12-hour AM/PM format"
          >
            am/pm
          </button>
          <button
            type="button"
            className={`wtb-format-btn ${use24Hour ? 'is-active' : ''}`}
            onClick={() => !use24Hour && onToggle24Hour()}
            title="24-hour format"
          >
            24
          </button>
        </div>

        <button
          type="button"
          className="wtb-theme-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
        </button>
      </div>
    </header>
  );
}

