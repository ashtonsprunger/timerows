import { useEffect } from 'react';

/**
 * useKeyboardNav Hook
 * 
 * Provides global keyboard navigation for TimeRows:
 * - ArrowLeft / ArrowRight: Scrub hour columns
 * - [ / ]: Previous / Next calendar day
 * - T: Jump to Today
 * - /: Open City Search modal
 * - S: Open Share modal
 * - Escape: Clear selection or close modals
 */
export function useKeyboardNav({
  activeHoverIndex,
  setActiveHoverIndex,
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
      // Ignore shortcut keys when typing inside input elements or modals
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable);

      if (e.key === 'Escape') {
        if (isModalOpen) {
          onCloseModals();
        } else {
          setActiveHoverIndex(null);
        }
        return;
      }

      if (isInput) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setActiveHoverIndex((prev) => {
            if (prev === null || prev === undefined) return 12;
            return Math.max(0, prev - 1);
          });
          break;

        case 'ArrowRight':
          e.preventDefault();
          setActiveHoverIndex((prev) => {
            if (prev === null || prev === undefined) return 12;
            return Math.min(totalColumns - 1, prev + 1);
          });
          break;

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
    activeHoverIndex,
    setActiveHoverIndex,
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
