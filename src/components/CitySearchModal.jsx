import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SearchIcon, PlusIcon } from './Icons.jsx';
import { searchCities } from '../engine/citySearch.js';

export function CitySearchModal({ isOpen, onClose, onSelectCity, currentCityIds = [] }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const searchResults = useMemo(() => {
    return searchCities(query, { limit: 25 });
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="search-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <SearchIcon size={20} className="modal-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder="Search city, country, or timezone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && searchResults.length > 0) {
                onSelectCity(searchResults[0]);
                onClose();
              }
            }}
          />
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="search-results-list">
          {searchResults.map((city) => (
            <div
              key={`${city.name}-${city.timeZone}`}
              className="city-search-item"
              onClick={() => {
                onSelectCity(city);
                onClose();
              }}
            >
              <div className="item-text">
                <span className="item-city-name">{city.name}</span>
                <span className="item-city-sub">
                  {city.country ? `${city.country} · ` : ''}{city.timeZone}
                </span>
              </div>
              <button type="button" className="add-city-pill-btn">
                <PlusIcon size={14} />
                <span>Add</span>
              </button>
            </div>
          ))}

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
