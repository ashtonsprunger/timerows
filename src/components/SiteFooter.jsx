import React from 'react';

const POPULAR_PAIRS = [
  { from: 'new-york', to: 'london', label: 'New York → London' },
  { from: 'san-francisco', to: 'london', label: 'San Francisco → London' },
  { from: 'new-york', to: 'tokyo', label: 'New York → Tokyo' },
  { from: 'london', to: 'singapore', label: 'London → Singapore' },
  { from: 'san-francisco', to: 'bengaluru', label: 'San Francisco → Bengaluru' },
];

/**
 * Thin text footer (no card): popular city-pair links for SEO + About / Privacy.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="wtb-site-footer">
      <nav className="wtb-footer-pairs" aria-label="Popular timezone comparisons">
        {POPULAR_PAIRS.map((pair) => (
          <a key={`${pair.from}-${pair.to}`} href={`/from/${pair.from}/to/${pair.to}`}>
            {pair.label}
          </a>
        ))}
      </nav>

      <div className="wtb-footer-meta">
        <span>© {year} TimeRows</span>
        <span className="wtb-footer-dot" aria-hidden="true">·</span>
        <a href="/about.html">About</a>
        <span className="wtb-footer-dot" aria-hidden="true">·</span>
        <a href="/privacy.html">Privacy</a>
      </div>
    </footer>
  );
}
