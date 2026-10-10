import React, { useState, useMemo, useEffect } from 'react';
import './App.css';
import { useTheme } from './hooks/useTheme.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useKeyboardNav } from './hooks/useKeyboardNav.js';
import { getDefaultCities } from './data/defaultPresets.js';
import { generateDayIntervals, generateCityRowSlots } from './engine/timezoneEngine.js';
import { calculateTimelineOverlaps, findBestMeetingWindows } from './engine/overlapEngine.js';
import {
  deserializeShareQuery,
  parseCityPairPath,
  parseCompactMeetingPath,
  generateShareUrl,
} from './engine/urlSync.js';

import { Header } from './components/Header.jsx';
import { TimelineGrid } from './components/TimelineGrid.jsx';
import { OverlapSummary } from './components/OverlapSummary.jsx';
import { CitySearchModal } from './components/CitySearchModal.jsx';
import { ShareModal } from './components/ShareModal.jsx';
import { AdSlot } from './components/AdSlot.jsx';
import { Toast } from './components/Toast.jsx';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Selected calendar date ('YYYY-MM-DD')
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Pinned cities state persisted in local storage
  const [cities, setCities] = useLocalStorage('timerows_pinned_cities', getDefaultCities());

  // Interactive UI state
  const [activeHoverIndex, setActiveHoverIndex] = useState(null);
  const [selectedWindowId, setSelectedWindowId] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Initialize and sync state from URL (support ?c=..., /m/..., /from/:a/to/:b)
  useEffect(() => {
    const pathname = window.location.pathname;
    const search = window.location.search;

    // Check compact meeting path (/m/nyc+lon+tyo)
    const compactTzs = parseCompactMeetingPath(pathname);
    if (compactTzs && compactTzs.length > 0) {
      const restored = compactTzs.map((tz, i) => ({
        id: `url-city-${i}`,
        name: tz.split('/').pop().replace(/_/g, ' '),
        timeZone: tz,
        isPrimary: i === 0,
      }));
      setCities(restored);
      return;
    }

    // Check city pair path (/from/:cityA/to/:cityB)
    const cityPair = parseCityPairPath(pathname);
    if (cityPair) {
      const pairRows = [
        { id: 'city-pair-1', name: cityPair.fromName, timeZone: 'America/Los_Angeles', isPrimary: true },
        { id: 'city-pair-2', name: cityPair.toName, timeZone: 'Europe/London', isPrimary: false },
      ];
      setCities(pairRows);
      return;
    }

    // Check search query parameters (?c=nyc,lon,tyo&d=2026-10-10)
    if (search) {
      const queryState = deserializeShareQuery(search);
      if (queryState.timezones && queryState.timezones.length > 0) {
        const restored = queryState.timezones.map((tz, i) => ({
          id: `share-city-${i}`,
          name: tz.split('/').pop().replace(/_/g, ' '),
          timeZone: tz,
          isPrimary: i === 0,
        }));
        setCities(restored);
      }
      if (queryState.date) {
        setSelectedDate(queryState.date);
      }
      if (typeof queryState.selectedSlotIndex === 'number') {
        setActiveHoverIndex(queryState.selectedSlotIndex);
      }
    }
  }, []);

  const referenceCity = cities[0] || { id: 'ref', name: 'UTC', timeZone: 'UTC' };

  // Generate 24-hour timestamps aligned to the primary reference city's local date
  const referenceTimestamps = useMemo(() => {
    try {
      return generateDayIntervals(selectedDate, referenceCity.timeZone, { dstAware: true });
    } catch (e) {
      console.error('Error generating intervals:', e);
      return [];
    }
  }, [selectedDate, referenceCity.timeZone]);

  // Generate rich slot objects for every pinned city
  const slotsByCity = useMemo(() => {
    const result = {};
    cities.forEach((city) => {
      try {
        result[city.id] = generateCityRowSlots({
          targetTimezone: city.timeZone,
          timestamps: referenceTimestamps,
          referenceDate: selectedDate,
          referenceTimezone: referenceCity.timeZone,
        });
      } catch (e) {
        console.error(`Error generating slots for ${city.timeZone}:`, e);
        result[city.id] = [];
      }
    });
    return result;
  }, [cities, referenceTimestamps, selectedDate, referenceCity.timeZone]);

  // Compute multi-city overlap for every column
  const timelineOverlaps = useMemo(() => {
    const cityRows = cities.map((city) => ({
      id: city.id,
      name: city.name,
      timeZone: city.timeZone,
      slots: slotsByCity[city.id] || [],
    }));
    return calculateTimelineOverlaps(cityRows);
  }, [cities, slotsByCity]);

  // Compute top meeting windows across all cities
  const meetingWindows = useMemo(() => {
    return findBestMeetingWindows(timelineOverlaps, { maxResults: 3, minDurationHours: 1 });
  }, [timelineOverlaps]);

  // Date step helpers
  const handlePrevDay = () => {
    const current = new Date(`${selectedDate}T12:00:00Z`);
    current.setUTCDate(current.getUTCDate() - 1);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const current = new Date(`${selectedDate}T12:00:00Z`);
    current.setUTCDate(current.getUTCDate() + 1);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Keyboard navigation hook
  useKeyboardNav({
    activeHoverIndex,
    setActiveHoverIndex,
    onPrevDay: handlePrevDay,
    onNextDay: handleNextDay,
    onToday: handleToday,
    onOpenSearch: () => setIsSearchOpen(true),
    onOpenShare: () => setIsShareOpen(true),
    onCloseModals: () => {
      setIsSearchOpen(false);
      setIsShareOpen(false);
    },
    isModalOpen: isSearchOpen || isShareOpen,
    totalColumns: timelineOverlaps.length || 24,
  });

  // City management handlers
  const handleAddCity = (newCity) => {
    const exists = cities.some((c) => c.timeZone === newCity.timeZone && c.name === newCity.name);
    if (exists) {
      showToast(`${newCity.name} is already pinned.`);
      return;
    }

    const cityEntry = {
      id: `city-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: newCity.name,
      country: newCity.country,
      timeZone: newCity.timeZone,
      isPrimary: false,
    };
    setCities((prev) => [...prev, cityEntry]);
    showToast(`Added ${newCity.name}`);
  };

  const handleRemoveCity = (cityId) => {
    if (cities.length <= 1) return;
    setCities((prev) => prev.filter((c) => c.id !== cityId));
  };

  const handleSelectMeetingWindow = (win) => {
    setSelectedWindowId(win.id);
    setActiveHoverIndex(win.startIndex);
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://www.timerows.com';
    return generateShareUrl(window.location.origin, {
      cities: cities.map((c) => c.timeZone),
      date: selectedDate,
      selectedSlotIndex: activeHoverIndex,
      referenceTimezone: referenceCity.timeZone,
    });
  }, [cities, selectedDate, activeHoverIndex, referenceCity.timeZone]);

  return (
    <div className="timerows-app-layout">
      {/* Top Navigation & Controls */}
      <Header
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onAddCityClick={() => setIsSearchOpen(true)}
        onShareClick={() => setIsShareOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Interactive 24-Hour Visual Timeline */}
      <main className="timeline-main-content">
        <TimelineGrid
          cities={cities}
          slotsByCity={slotsByCity}
          timelineOverlaps={timelineOverlaps}
          activeHoverIndex={activeHoverIndex}
          onHoverIndex={setActiveHoverIndex}
          onSelectSlot={(slotIdx) => setActiveHoverIndex(slotIdx)}
          onRemoveCity={handleRemoveCity}
          referenceCityId={referenceCity.id}
        />
      </main>

      {/* Overlap Summary & Top Meeting Windows */}
      <OverlapSummary
        meetingWindows={meetingWindows}
        onSelectWindow={handleSelectMeetingWindow}
        selectedWindowId={selectedWindowId}
        onShowToast={showToast}
        shareUrl={shareUrl}
      />

      {/* Zero-CLS Reserved AdSlot (Rule 4 Compliance) */}
      <AdSlot slotId="footer-banner" format="horizontal" />

      {/* Keyboard Shortcuts Hint Pill */}
      <footer className="keyboard-shortcuts-bar">
        <div className="shortcut-item">
          <span className="kbd-badge">←</span>
          <span className="kbd-badge">→</span>
          <span>Scrub Hours</span>
        </div>
        <div className="shortcut-item">
          <span className="kbd-badge">[</span>
          <span className="kbd-badge">]</span>
          <span>Prev / Next Day</span>
        </div>
        <div className="shortcut-item">
          <span className="kbd-badge">T</span>
          <span>Today</span>
        </div>
        <div className="shortcut-item">
          <span className="kbd-badge">/</span>
          <span>Search City</span>
        </div>
        <div className="shortcut-item">
          <span className="kbd-badge">S</span>
          <span>Share</span>
        </div>
        <div className="shortcut-item">
          <span className="kbd-badge">Esc</span>
          <span>Clear</span>
        </div>
      </footer>

      {/* Modals and Toasts */}
      <CitySearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectCity={handleAddCity}
        currentCityIds={cities.map((c) => c.id)}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        cities={cities}
        selectedDate={selectedDate}
        selectedSlotIndex={activeHoverIndex}
        bestWindow={meetingWindows[0] || null}
        onShowToast={showToast}
      />

      <Toast message={toastMessage} isVisible={Boolean(toastMessage)} />
    </div>
  );
}
