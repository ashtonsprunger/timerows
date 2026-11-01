import { useEffect } from 'react';

/**
 * useKeyboardNav Hook
 * 
 * Global keyboard navigation for TimeRows:
 * - ArrowLeft / ArrowRight: Scrub or move selected slot backward / forward
 * - Shift + ArrowLeft / ArrowRight: Expand / contract selected multi-hour range
 * - [ / ]: Previous / Next calendar day
 * - T: Jump to Today
 * - /: Open City Search modal
 * - S: Open Share modal
 * - Escape: Clear locked selection or close modals
 */
export function useKeyboardNav({
  selectedRange,
  setSelectedRange,
  hoveredIndex,
  setHoveredIndex,
  onPrevDay,
  onNextDay,
  onToday,
  onOpenSearch,
  onOpenShare,
  onCloseModals,
  isModalOpen,
  totalColumns = 24,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable);

      if (e.key === 'Escape') {
        if (isModalOpen) {
          onCloseModals();
        } else {
          setSelectedRange(null);
          setHoveredIndex(null);
        }
        return;
      }

      if (isInput || isModalOpen) return;

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          const currentStart = selectedRange?.startIndex ?? hoveredIndex ?? 12;
          const currentEnd = selectedRange?.endIndex ?? currentStart;
          const duration = currentEnd - currentStart + 1;
          if (e.shiftKey) {
            const nextEnd = Math.max(currentStart - 0.5, currentEnd - 0.5);
            setSelectedRange({ startIndex: currentStart, endIndex: nextEnd });
          } else {
            const nextStart = Math.max(0, currentStart - 0.5);
            const nextEnd = nextStart + duration - 1;
            setSelectedRange({ startIndex: nextStart, endIndex: nextEnd });
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const currentStart = selectedRange?.startIndex ?? hoveredIndex ?? 12;
          const currentEnd = selectedRange?.endIndex ?? currentStart;
          const duration = currentEnd - currentStart + 1;
          if (e.shiftKey) {
            const nextEnd = Math.min(totalColumns - 1, currentEnd + 0.5);
            setSelectedRange({ startIndex: currentStart, endIndex: nextEnd });
          } else {
            const nextEnd = Math.min(totalColumns - 1, currentEnd + 0.5);
            const nextStart = Math.max(0, nextEnd - duration + 1);
            setSelectedRange({ startIndex: nextStart, endIndex: nextEnd });
          }
          break;
        }

        case '[':
          e.preventDefault();
          onPrevDay();
          break;

        case ']':
          e.preventDefault();
          onNextDay();
          break;

        case 't':
        case 'T':
          e.preventDefault();
          onToday();
          break;

        case '/':
          e.preventDefault();
          onOpenSearch();
          break;

        case 's':
        case 'S':
          e.preventDefault();
          onOpenShare();
          break;

        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedRange,
    setSelectedRange,
    hoveredIndex,
    setHoveredIndex,
    onPrevDay,
    onNextDay,
    onToday,
    onOpenSearch,
    onOpenShare,
    onCloseModals,
    isModalOpen,
    totalColumns,
  ]);
}
