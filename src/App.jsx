import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { useTheme } from './hooks/useTheme.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useKeyboardNav } from './hooks/useKeyboardNav.js';
import { getDefaultCities, TEAM_PRESETS } from './data/defaultPresets.js';
import {
  getUserLocalTimezone,
  getTimeParts,
  getTimezoneOffset,
  generateDayIntervals,
  generateCityRowSlots,
  DEFAULT_WORKING_HOURS,
} from './engine/timezoneEngine.js';
import {
  calculateTimelineOverlaps,
  findBestMeetingWindows,
  buildCustomMeetingWindow,
  findBestCompromiseWindow,
} from './engine/overlapEngine.js';
import {
  deserializeShareQuery,
  parseCityPairPath,
  extractCityTokensFromUrl,
  resolveCityFromToken,
  generateShareUrl,
} from './engine/urlSync.js';

import { Header } from './components/Header.jsx';
import { TimelineGrid } from './components/TimelineGrid.jsx';
import { OverlapSummary } from './components/OverlapSummary.jsx';
import { AdSlot } from './components/AdSlot.jsx';
import { SiteFooter } from './components/SiteFooter.jsx';
import { CitySearchModal } from './components/CitySearchModal.jsx';
import { ShareModal } from './components/ShareModal.jsx';
import { Toast } from './components/Toast.jsx';

function getTodayIsoInZone(timeZone) {
  try {
    return getTimeParts(Date.now(), timeZone || getUserLocalTimezone()).isoDate;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function updateDocumentSeo({ title, description, canonicalPath }) {
  if (typeof document === 'undefined') return;
  if (title) {
    document.title = title;
  }
  const cleanPath = canonicalPath && canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath || ''}`;
  const canonicalUrl = `https://timerows.com${cleanPath}`;

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  if (canonicalEl) {
    canonicalEl.setAttribute('href', canonicalUrl);
  }
  const ogUrlEl = document.querySelector('meta[property="og:url"]');
  if (ogUrlEl) {
    ogUrlEl.setAttribute('content', canonicalUrl);
  }
  if (title) {
    const ogTitleEl = document.querySelector('meta[property="og:title"]');
    if (ogTitleEl) ogTitleEl.setAttribute('content', title);
    const twTitleEl = document.querySelector('meta[name="twitter:title"]');
    if (twTitleEl) twTitleEl.setAttribute('content', title);
  }
  if (description) {
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', description);
    const ogDescEl = document.querySelector('meta[property="og:description"]');
    if (ogDescEl) ogDescEl.setAttribute('content', description);
    const twDescEl = document.querySelector('meta[name="twitter:description"]');
    if (twDescEl) twDescEl.setAttribute('content', description);
  }
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Persisted user preferences
  const [cities, setCities] = useLocalStorage('timerows_pinned_cities_v2', getDefaultCities());
  const [use24Hour, setUse24Hour] = useLocalStorage('timerows_use_24h', false);
  const [workingHours, setWorkingHours] = useLocalStorage(
    'timerows_working_hours',
    DEFAULT_WORKING_HOURS
  );

  const referenceCity =
    cities.find((c) => c.isPrimary) ||
    cities[0] || { id: 'utc-gmt', name: 'UTC', timeZone: 'UTC' };

  const [selectedDate, setSelectedDate] = useState(() =>
    getTodayIsoInZone(referenceCity.timeZone)
  );

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Live ticking clock timestamp (updates every 30 seconds)
  const [liveTimestamp, setLiveTimestamp] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = setInterval(() => {
      setLiveTimestamp(Date.now());
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Initialize state from URL routes (/m/..., /from/:a/to/:b, ?c=...)
  useEffect(() => {
    const pathname = window.location.pathname;
    const search = window.location.search;
    const queryState = search ? deserializeShareQuery(search) : null;

    const cityPair = parseCityPairPath(pathname);
    if (cityPair) {
      const fromResolved = resolveCityFromToken(cityPair.fromSlug, 0) || {
        id: `pair-from-${cityPair.fromSlug}`,
        name: cityPair.fromName,
        country: '',
        timeZone: 'America/New_York',
      };
      const toResolved = resolveCityFromToken(cityPair.toSlug, 1) || {
        id: `pair-to-${cityPair.toSlug}`,
        name: cityPair.toName,
        country: '',
        timeZone: 'Europe/London',
      };

      const isToPrimary =
        queryState?.referenceTimezone &&
        queryState.referenceTimezone === toResolved.timeZone &&
        queryState.referenceTimezone !== fromResolved.timeZone;

      const pairCities = [
        { ...fromResolved, isPrimary: !isToPrimary },
        { ...toResolved, isPrimary: Boolean(isToPrimary) },
      ];
      const activePrimary = pairCities.find((c) => c.isPrimary) || pairCities[0];

      setCities(pairCities);
      setSelectedDate(queryState?.date || getTodayIsoInZone(activePrimary.timeZone));

      if (queryState && typeof queryState.selectedSlotIndex === 'number') {
        const startIdx = queryState.selectedSlotIndex;
        const endIdx =
          typeof queryState.selectedEndSlotIndex === 'number'
            ? queryState.selectedEndSlotIndex
            : startIdx;
        setSelectedRange({ startIndex: startIdx, endIndex: endIdx });
      }
      if (queryState?.workingHours) {
        setWorkingHours(queryState.workingHours);
      }

      const seoTitle = `${fromResolved.name} to ${toResolved.name} Time Converter — TimeRows`;
      const seoDesc = `Convert time between ${fromResolved.name} (${fromResolved.timeZone}) and ${toResolved.name} (${toResolved.timeZone}). View 24-hour working overlap and schedule meetings in 1 click.`;
      updateDocumentSeo({
        title: seoTitle,
        description: seoDesc,
        canonicalPath: `/from/${cityPair.fromSlug}/to/${cityPair.toSlug}`,
      });
      return;
    }

    const tokens = extractCityTokensFromUrl(pathname, search);
    if (tokens.length > 0) {
      const restoredCities = tokens
        .map((token, idx) => resolveCityFromToken(token, idx))
        .filter(Boolean);

      if (restoredCities.length > 0) {
        let primaryIdx = 0;
        if (queryState?.referenceTimezone) {
          const matchedIdx = restoredCities.findIndex(
            (c) => c.timeZone === queryState.referenceTimezone
          );
          if (matchedIdx !== -1) {
            primaryIdx = matchedIdx;
          }
        }

        const citiesWithPrimary = restoredCities.map((c, idx) => ({
          ...c,
          isPrimary: idx === primaryIdx,
        }));
        const activePrimary = citiesWithPrimary[primaryIdx] || citiesWithPrimary[0];

        setCities(citiesWithPrimary);
        setSelectedDate(queryState?.date || getTodayIsoInZone(activePrimary.timeZone));

        if (pathname.startsWith('/m/')) {
          const namesList = citiesWithPrimary.map((c) => c.name).join(', ');
          updateDocumentSeo({
            title: `${namesList} Timezone Overlap — TimeRows`,
            description: `Compare working hours and meeting overlap across ${namesList} on TimeRows.`,
            canonicalPath: `/m/${tokens.join('+')}`,
          });
        }
      }
    } else if (queryState?.referenceTimezone) {
      setCities((prev) => {
        const matchedIdx = prev.findIndex((c) => c.timeZone === queryState.referenceTimezone);
        if (matchedIdx === -1) return prev;
        return prev.map((c, idx) => ({ ...c, isPrimary: idx === matchedIdx }));
      });
      if (!queryState.date) {
        setSelectedDate(getTodayIsoInZone(queryState.referenceTimezone));
      }
    }

    if (queryState) {
      if (queryState.date) {
        setSelectedDate(queryState.date);
      }
      if (typeof queryState.selectedSlotIndex === 'number') {
        const startIdx = queryState.selectedSlotIndex;
        const endIdx =
          typeof queryState.selectedEndSlotIndex === 'number'
            ? queryState.selectedEndSlotIndex
            : startIdx;
        setSelectedRange({ startIndex: startIdx, endIndex: endIdx });
      }
      if (queryState.workingHours) {
        setWorkingHours(queryState.workingHours);
      }
    }
  }, []);

  const todayIso = useMemo(
    () => getTodayIsoInZone(referenceCity.timeZone),
    [referenceCity.timeZone, liveTimestamp]
  );
  const isToday = selectedDate === todayIso;

  const referenceTimestamps = useMemo(() => {
    try {
      return generateDayIntervals(selectedDate, referenceCity.timeZone, { dstAware: true });
    } catch (e) {
      console.error('Error generating intervals:', e);
      return [];
    }
  }, [selectedDate, referenceCity.timeZone]);

  const slotsByCity = useMemo(() => {
    const result = {};
    cities.forEach((city) => {
      try {
        result[city.id] = generateCityRowSlots({
          targetTimezone: city.timeZone,
          timestamps: referenceTimestamps,
          referenceDate: selectedDate,
          referenceTimezone: referenceCity.timeZone,
          workingHours: city.workingHours || workingHours,
        });
      } catch (e) {
        console.error(`Error generating slots for ${city.timeZone}:`, e);
        result[city.id] = [];
      }
    });
    return result;
  }, [cities, referenceTimestamps, selectedDate, referenceCity.timeZone, workingHours]);

  const timelineOverlaps = useMemo(() => {
    const cityRows = cities.map((city) => ({
      id: city.id,
      name: city.name,
      timeZone: city.timeZone,
      slots: slotsByCity[city.id] || [],
    }));
    return calculateTimelineOverlaps(cityRows);
  }, [cities, slotsByCity]);

  // Clamp selectedRange and hoveredIndex when switching from a 25h Fall Back day to a 24h or 23h day
  useEffect(() => {
    const maxCols = timelineOverlaps.length;
    if (!maxCols) return;
    const maxIdx = maxCols - 1;

    setSelectedRange((prev) => {
      if (!prev) return null;
      const clampedStart = Math.min(prev.startIndex, maxIdx);
      const clampedEnd = Math.min(prev.endIndex ?? prev.startIndex, maxIdx);
      if (clampedStart !== prev.startIndex || clampedEnd !== prev.endIndex) {
        return { startIndex: clampedStart, endIndex: clampedEnd };
      }
      return prev;
    });

    setHoveredIndex((prev) => (prev !== null && prev > maxIdx ? maxIdx : prev));
  }, [timelineOverlaps.length]);

  const meetingWindows = useMemo(() => {
    return findBestMeetingWindows(timelineOverlaps, {
      maxResults: 3,
      minDurationHours: 1,
    });
  }, [timelineOverlaps]);

  // Full contiguous golden overlap windows (so a 5h or 6h overlap is shown in full)
  const goldenWindows = useMemo(() => {
    if (!Array.isArray(timelineOverlaps) || timelineOverlaps.length === 0) return [];
    const spans = [];
    let current = null;
    for (let i = 0; i < timelineOverlaps.length; i++) {
      if (timelineOverlaps[i]?.isGolden) {
        if (!current) {
          current = { startIndex: i, endIndex: i };
        } else {
          current.endIndex = i;
        }
      } else if (current) {
        spans.push(current);
        current = null;
      }
    }
    if (current) spans.push(current);
    return spans
      .map((s) => buildCustomMeetingWindow(timelineOverlaps, s.startIndex, s.endIndex))
      .filter(Boolean)
      .sort((a, b) => b.durationHours - a.durationHours);
  }, [timelineOverlaps]);

  const customWindow = useMemo(() => {
    if (!selectedRange) return null;
    return buildCustomMeetingWindow(
      timelineOverlaps,
      selectedRange.startIndex,
      selectedRange.endIndex
    );
  }, [timelineOverlaps, selectedRange]);

  const compromiseWindow = useMemo(() => {
    return findBestCompromiseWindow(timelineOverlaps);
  }, [timelineOverlaps]);

  const activeShareWindow =
    customWindow || goldenWindows[0] || meetingWindows[0] || compromiseWindow || null;

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
    setSelectedDate(getTodayIsoInZone(referenceCity.timeZone));
  };

  useKeyboardNav({
    selectedRange,
    setSelectedRange,
    hoveredIndex,
    setHoveredIndex,
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

  const showToast = useCallback((message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2800);
  }, []);

  const handleAddCity = (newCity) => {
    const exists = cities.some(
      (c) =>
        c.id === newCity.id ||
        (c.timeZone === newCity.timeZone &&
          c.name.toLowerCase() === newCity.name.toLowerCase())
    );
    if (exists) {
      showToast(`${newCity.name} is already on the board.`);
      return;
    }

    const cityEntry = {
      id: newCity.id || `city-${Date.now()}`,
      name: newCity.name,
      country: newCity.country || '',
      timeZone: newCity.timeZone,
    };
    setCities((prev) => [...prev, cityEntry]);
    showToast(`Added ${newCity.name}`);
  };

  const handleRemoveCity = (cityId) => {
    if (cities.length <= 1) return;
    setCities((prev) => prev.filter((c) => c.id !== cityId));
  };

  const handleSetPrimaryCity = (cityId) => {
    const target = cities.find((c) => c.id === cityId);
    if (!target) return;
    setCities((prev) =>
      prev.map((c) => ({
        ...c,
        isPrimary: c.id === cityId,
      }))
    );
    showToast(`${target.name} set as Home city`);
  };

  const handleMoveCity = (index, direction) => {
    setCities((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const currentPrimaryId = (prev.find((c) => c.isPrimary) || prev[0])?.id;
      const copy = prev.map((c) => ({
        ...c,
        isPrimary: c.id === currentPrimaryId,
      }));
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const handleReorderCity = (fromIndex, toIndex) => {
    setCities((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const currentPrimaryId = (prev.find((c) => c.isPrimary) || prev[0])?.id;
      const copy = prev.map((c) => ({
        ...c,
        isPrimary: c.id === currentPrimaryId,
      }));
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleSortCities = (direction) => {
    setCities((prev) => {
      if (prev.length <= 1) return prev;
      const currentPrimaryId = (prev.find((c) => c.isPrimary) || prev[0])?.id;
      const nowMs = liveTimestamp || Date.now();
      const sorted = prev
        .map((c, idx) => {
          let offset = 0;
          try {
            offset = getTimezoneOffset(c.timeZone, nowMs);
          } catch {
            offset = 0;
          }
          return {
            city: {
              ...c,
              isPrimary: c.id === currentPrimaryId,
            },
            offset,
            idx,
          };
        })
        .sort((a, b) => {
          const diff = direction === 'desc' ? b.offset - a.offset : a.offset - b.offset;
          if (diff !== 0) return diff;
          return a.idx - b.idx;
        })
        .map((item) => item.city);

      return sorted;
    });
  };

  const handleUpdateCityWorkingHours = (cityId, customHours) => {
    setCities((prev) =>
      prev.map((c) => {
        if (c.id !== cityId) return c;
        if (!customHours) {
          const { workingHours: _removed, ...rest } = c;
          return rest;
        }
        return { ...c, workingHours: customHours };
      })
    );
  };

  const handleSelectMeetingWindow = (win) => {
    setSelectedRange({ startIndex: win.startIndex, endIndex: win.endIndex });
  };

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://timerows.com';
    return generateShareUrl(window.location.origin, {
      cities,
      date: selectedDate,
      selectedSlotIndex: selectedRange?.startIndex,
      selectedEndSlotIndex: selectedRange?.endIndex,
      referenceTimezone: referenceCity.timeZone,
      workingHours,
    });
  }, [cities, selectedDate, selectedRange, referenceCity.timeZone, workingHours]);

  // Keep the browser URL bar synchronized after initial mount when the user modifies their board
  const hasHydratedUrlRef = useRef(false);
  const initialBoardSignatureRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const sig = JSON.stringify({
      ids: cities.map((c) => c.id),
      ref: referenceCity.timeZone,
      date: selectedDate,
      range: selectedRange,
      wh: workingHours,
    });
    if (!hasHydratedUrlRef.current) {
      hasHydratedUrlRef.current = true;
      initialBoardSignatureRef.current = sig;
      return;
    }
    if (sig === initialBoardSignatureRef.current) return;
    try {
      const parsed = new URL(shareUrl);
      window.history.replaceState(null, '', `${parsed.pathname}${parsed.search}`);
    } catch {
      // Ignore history API errors in restricted environments
    }
  }, [shareUrl, cities, referenceCity.timeZone, selectedDate, selectedRange, workingHours]);

  return (
    <div className="timerows-shell">
      <div className="timerows-container">
        {/* Minimal Top Brand & Format Bar */}
        <Header
          use24Hour={use24Hour}
          onToggle24Hour={() => setUse24Hour((prev) => !prev)}
          workingHours={workingHours}
          onWorkingHoursChange={setWorkingHours}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Unified Converter Board (Toolbar + Stacked 24h Ribbons + Integrated Footer) */}
        <main className="wtb-board">
          <TimelineGrid
            cities={cities}
            slotsByCity={slotsByCity}
            timelineOverlaps={timelineOverlaps}
            hoveredIndex={hoveredIndex}
            onHoverIndex={setHoveredIndex}
            selectedRange={selectedRange}
            onSelectRange={setSelectedRange}
            onAddCity={handleAddCity}
            onSetPrimaryCity={handleSetPrimaryCity}
            onMoveCity={handleMoveCity}
            onReorderCity={handleReorderCity}
            onSortCities={handleSortCities}
            onRemoveCity={handleRemoveCity}
            workingHours={workingHours}
            onUpdateCityWorkingHours={handleUpdateCityWorkingHours}
            selectedDate={selectedDate}
            todayIso={todayIso}
            onDateChange={setSelectedDate}
            onToday={handleToday}
            isToday={isToday}
            customWindow={customWindow}
            onShareClick={() => setIsShareOpen(true)}
            referenceCityId={referenceCity.id}
            liveTimestamp={liveTimestamp}
            use24Hour={use24Hour}
            teamPresets={TEAM_PRESETS}
            onLoadPreset={(preset) => {
              setCities(preset.cities);
              setSelectedRange(null);
              showToast(`Loaded ${preset.label}`);
            }}
            headline={
              <OverlapSummary
                customWindow={customWindow}
                goldenWindows={goldenWindows}
                meetingWindows={meetingWindows}
                compromiseWindow={compromiseWindow}
                referenceCityId={referenceCity.id}
                onSelectWindow={handleSelectMeetingWindow}
                onClearSelection={() => setSelectedRange(null)}
                onShowToast={showToast}
                shareUrl={shareUrl}
                use24Hour={use24Hour}
              />
            }
          />
        </main>

        {/* Below-Board: ad (renders only when AdSense is configured) + thin text footer */}
        <AdSlot slotId="below-board-leaderboard" format="horizontal" />
        <SiteFooter />
      </div>

      {/* Modals & Toast */}
      <CitySearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectCity={handleAddCity}
        pinnedCities={cities}
        liveTimestamp={liveTimestamp}
        use24Hour={use24Hour}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        cities={cities}
        referenceTimezone={referenceCity.timeZone}
        selectedDate={selectedDate}
        selectedRange={selectedRange}
        activeWindow={activeShareWindow}
        workingHours={workingHours}
        use24Hour={use24Hour}
        onShowToast={showToast}
      />

      <Toast message={toastMessage} isVisible={Boolean(toastMessage)} />
    </div>
  );
}
