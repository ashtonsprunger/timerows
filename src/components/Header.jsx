import React from 'react';
import {
  SunIcon,
  MoonIcon,
  ShareIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
} from './Icons.jsx';

export function Header({
  selectedDate,
  onDateChange,
  onAddCityClick,
  onShareClick,
  theme,
  onToggleTheme,
}) {
  const handlePrevDay = () => {
    const current = new Date(`${selectedDate}T12:00:00Z`);
    current.setUTCDate(current.getUTCDate() - 1);
    onDateChange(current.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const current = new Date(`${selectedDate}T12:00:00Z`);
    current.setUTCDate(current.getUTCDate() + 1);
    onDateChange(current.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    onDateChange(new Date().toISOString().split('T')[0]);
  };

  const formattedDateLabel = (() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
    } catch {
      return selectedDate;
    }
  })();

  return (
    <header className="timerows-header">
      <div className="header-brand">
        <div className="brand-logo-mark">
          <span className="logo-dot dot-emerald"></span>
          <span className="logo-dot dot-indigo"></span>
          <span className="logo-dot dot-sky"></span>
        </div>
        <div className="brand-text">
          <span className="brand-title">TimeRows</span>
          <span className="brand-badge">PRO</span>
        </div>
      </div>

      <div className="header-controls">
        {/* Date Selector Pill */}
        <div className="date-controller-pill">
          <button
            type="button"
            className="date-nav-btn"
            onClick={handlePrevDay}
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeftIcon size={16} />
          </button>

          <button
            type="button"
            className="date-today-btn"
            onClick={handleToday}
            title="Jump to Today"
          >
            Today
          </button>

          <div className="date-display-wrapper">
            <CalendarIcon size={14} className="calendar-icon" />
            <span className="date-display-text">{formattedDateLabel}</span>
            <input
              type="date"
              className="hidden-date-picker"
              value={selectedDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              title="Select date"
            />
          </div>

          <button
            type="button"
            className="date-nav-btn"
            onClick={handleNextDay}
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="header-actions">
          <button
            type="button"
            className="action-pill-btn btn-primary"
            onClick={onAddCityClick}
          >
            <PlusIcon size={16} />
            <span>Add City</span>
          </button>

          <button
            type="button"
            className="action-pill-btn btn-secondary"
            onClick={onShareClick}
          >
            <ShareIcon size={15} />
            <span>Share</span>
          </button>

          <button
            type="button"
            className="icon-round-btn theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
