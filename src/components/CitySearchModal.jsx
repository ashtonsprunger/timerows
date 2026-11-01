import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SearchIcon, PlusIcon, CheckIcon, CloseIcon } from './Icons.jsx';
import { searchCities } from '../engine/citySearch.js';
import { getTimezoneOffset, formatTimezoneOffset } from '../engine/timezoneEngine.js';

export function CitySearchModal({
  isOpen,
  onClose,
  onSelectCity,
  pinnedCities = [],
  liveTimestamp,
  use24Hour = false,
}) {
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setFocusedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const searchResults = useMemo(() => {
    return searchCities(query, { limit: 25 });
  }, [query]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const isCityPinned = (candidate) => {
    return pinnedCities.some(
      (c) =>
        c.id === candidate.id ||
        (c.name.toLowerCase() === candidate.name.toLowerCase() &&
          c.timeZone === candidate.timeZone)
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(searchResults.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      const chosen = searchResults[focusedIndex] || searchResults[0];
      onSelectCity(chosen);
      onClose();
    }
  };

  const nowDate = new Date(liveTimestamp || Date.now());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="search-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <SearchIcon size={18} className="modal-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder="Search city, country, airport code (NYC, SFO, BLR)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="search-results-list">
          {searchResults.map((city, idx) => {
            const alreadyPinned = isCityPinned(city);
            const isFocused = idx === focusedIndex;

            let offsetStr = '';
            let liveTimeStr = '';
            try {
              const offsetMins = getTimezoneOffset(city.timeZone, nowDate);
              offsetStr = `UTC${formatTimezoneOffset(offsetMins)}`;
              liveTimeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: city.timeZone,
                hour: use24Hour ? '2-digit' : 'numeric',
                minute: '2-digit',
                hour12: !use24Hour,
                hourCycle: use24Hour ? 'h23' : undefined,
              }).format(nowDate);
            } catch {
              // ignore formatting fallback
            }

            return (
              <div
                key={city.id || `${city.name}-${city.timeZone}`}
                className={`city-search-item ${isFocused ? 'is-keyboard-focused' : ''} ${
                  alreadyPinned ? 'is-already-pinned' : ''
                }`}
                onMouseEnter={() => setFocusedIndex(idx)}
                onClick={() => {
                  onSelectCity(city);
                  if (!alreadyPinned) onClose();
                }}
              >
                <div className="item-text">
                  <span className="item-city-name">{city.name}</span>
                  <span className="item-city-sub">
                    {city.country ? `${city.country} · ` : ''}
                    {offsetStr} · {liveTimeStr}
                  </span>
                </div>
                <button type="button" className="add-city-pill-btn">
                  {alreadyPinned ? (
                    <>
                      <CheckIcon size={13} />
                      <span>Pinned</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon size={13} />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {searchResults.length === 0 && (
            <div className="no-results-view">
              <p>No matching cities found for &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
