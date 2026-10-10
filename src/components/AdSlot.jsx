import React, { useEffect, useRef } from 'react';

/**
 * AdSlot Component - Zero Cumulative Layout Shift (CLS)
 * 
 * Reserves strict dimensions in advance to prevent any layout jumping
 * when Google AdSense or programmatic sponsors load.
 */
export function AdSlot({
  slotId = 'top-banner',
  format = 'horizontal', // 'horizontal' | 'rectangle'
  className = '',
}) {
  const adContainerRef = useRef(null);

  // Reserve exact dimensions based on ad format standard (IAB)
  const isHorizontal = format === 'horizontal';
  const slotHeight = isHorizontal ? '90px' : '250px';
  const slotMaxWidth = isHorizontal ? '970px' : '300px';

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch (e) {
      // AdSense script blocked or failed silently
    }
  }, []);

  return (
    <aside
      className={`zero-cls-ad-container ${className}`}
      style={{
        minHeight: slotHeight,
        height: slotHeight,
        maxWidth: slotMaxWidth,
      }}
      aria-label="Advertisement"
    >
      <div className="ad-placeholder-surface" ref={adContainerRef}>
        <div className="ad-badge-row">
          <span className="ad-label">SPONSOR / ADVERTISEMENT</span>
          <span className="ad-pro-pill">Zero-CLS Reserved Slot</span>
        </div>
        <p className="ad-subtext">
          Non-intrusive ad placeholder. Pinned dimensions guarantee zero layout shift.
        </p>
      </div>
    </aside>
  );
}
