import React, { useEffect } from 'react';

/**
 * AdSlot Component - Zero Cumulative Layout Shift (CLS)
 *
 * 1. When VITE_ADSENSE_CLIENT (`ca-pub-XXXXXXXXXXXXXXXX`) is set, ensures the
 *    AdSense verification meta tag and `adsbygoogle.js` script are present in
 *    `<head>` so Google AdSense site verification succeeds even before an ad
 *    unit slot ID is created.
 * 2. Renders the reserved-height ad container ONLY when both
 *    `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT_BELOW_BOARD` are configured,
 *    so no empty placeholder card ever reaches users.
 */
const ADSENSE_CLIENT = import.meta.env?.VITE_ADSENSE_CLIENT || '';

const ADSENSE_SLOTS = {
  'below-board-leaderboard': import.meta.env?.VITE_ADSENSE_SLOT_BELOW_BOARD || '',
};

const ADSENSE_SCRIPT_ID = 'timerows-adsense-script';
const ADSENSE_META_NAME = 'google-adsense-account';

function ensureAdSenseHeadTags(client) {
  if (typeof document === 'undefined' || !client) return;

  if (!document.querySelector(`meta[name="${ADSENSE_META_NAME}"]`)) {
    const meta = document.createElement('meta');
    meta.name = ADSENSE_META_NAME;
    meta.content = client;
    document.head.appendChild(meta);
  }

  if (!document.getElementById(ADSENSE_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(script);
  }
}

export function AdSlot({
  slotId = 'below-board-leaderboard',
  format = 'horizontal', // 'horizontal' | 'rectangle'
  className = '',
}) {
  const adSlot = ADSENSE_SLOTS[slotId] || '';
  const hasClient = Boolean(ADSENSE_CLIENT);
  const isSlotConfigured = Boolean(ADSENSE_CLIENT && adSlot);

  // Reserve exact dimensions based on ad format standard (IAB)
  const isHorizontal = format === 'horizontal';
  const slotHeight = isHorizontal ? '90px' : '250px';
  const slotMaxWidth = isHorizontal ? '100%' : '300px';

  useEffect(() => {
    if (!hasClient) return;
    try {
      ensureAdSenseHeadTags(ADSENSE_CLIENT);
      if (isSlotConfigured) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch {
      // AdSense script blocked or failed silently; reserved space stays empty
    }
  }, [hasClient, isSlotConfigured]);

  if (!isSlotConfigured) return null;

  return (
    <aside
      className={`zero-cls-ad-container ${className}`}
      style={{ minHeight: slotHeight, height: slotHeight, maxWidth: slotMaxWidth }}
      aria-label="Advertisement"
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: slotHeight }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-full-width-responsive="false"
      />
    </aside>
  );
}
