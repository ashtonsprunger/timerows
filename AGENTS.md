# AGENTS.md

> Developer and AI Agent Guide for **TimeRows** (`timerows.com`)

---

## 1. Project Overview & Vision

**TimeRows** is a high-craft, visual timezone converter and team meeting overlap planner built with React 18, Vite (or modern CRA), and modern web standards. It modernizes the outdated, clunky incumbent (WorldTimeBuddy) with fluid interactive horizontal time rows, ambient day/night illumination, magnetic time scrubbing, instant working-hour overlap detection, and 1-click meeting schedule links.

- **Brand & Domain:** **TimeRows** (`https://timerows.com`)
- **Core Value Proposition:** Eliminate timezone math for remote teams and global professionals through stacked 24-hour visual time rows with real-time solar gradients, working-hours overlap highlighting, and frictionless 1-click `.ics` calendar exports.
- **Product-Led Growth (PLG):** Every time a user shares a meeting overlap link (`timerows.com/m/nyc+lon+tyo`), every recipient is seamlessly introduced to TimeRows.
- **Monetization Engine:** High-volume programmatic SEO for city-pair queries (`/from/san-francisco/to/london`), non-intrusive zero-CLS Google AdSense slots, and Pro/Team presets.

---

## 2. Architectural Principles & AI Agent Rules

AI agents working on this codebase **MUST** adhere strictly to the following rules:

### Rule 1: Strictly Modular Architecture (Zero Monolithic Single-File Dumps)
- **NEVER** write a single 1,000+ line component or file containing data, math, UI, and state combined.
- Every feature must be divided into dedicated layers:
  1. `src/engine/`: Pure mathematical, algorithmic, and conversion functions (zero React dependency).
  2. `src/components/`: Presentational and interactive React components with clear prop interfaces.
  3. `src/hooks/`: Reusable state logic (local storage, URL sync, drag interactions).
  4. `src/data/`: City directories, timezone databases, and lookup maps.

### Rule 2: IANA Timezone Integrity & DST Safety
- **Never rely on naive UTC hour offsets** (e.g., `UTC-5` or `+5.5`). UTC offsets change dynamically throughout the year due to Daylight Saving Time (DST).
- All calculations must use canonical **IANA Time Zone identifiers** (e.g., `America/New_York`, `Europe/London`, `Asia/Kolkata`, `Asia/Tokyo`).
- Time calculations must use browser-native `Intl.DateTimeFormat` or battle-tested timezone engines (`date-fns-tz` / `luxon`).
- Explicitly test for DST transition days ("Spring forward" 23-hour days and "Fall back" 25-hour days).

### Rule 3: Test-Driven Engine Development (TDD)
- No mathematical or engine code may be committed without a co-located `.test.js` file.
- Before building UI components, the underlying engine functions (overlap detection, timezone conversions, URL serialization) must pass 100% of unit tests.

### Rule 4: Zero Cumulative Layout Shift (CLS)
- Time tracks, city header cards, and ad placeholders must have explicitly locked aspect ratios and reserved dimensions so the page never shifts or jumps during render.

### Rule 5: Google Material 3 Design System, Flat Tonal Surfaces & Micro-Interactions
- Primary cards: `border-radius: var(--radius-card, 28px)`.
- Nested surface cards: `border-radius: var(--radius-surface, 16px)`.
- Action pills and inputs: `border-radius: var(--radius-pill, 9999px)`.
- Follow strict concentric geometry: Outer card radius = Inner nested surface radius + Padding.
- **Flat Tonal Surfaces (Zero Wireframe Borders):** Never use `1px solid` grid/table borders on hour cells, row dividers, inputs, or pills. Create visual hierarchy purely through Material 3 tonal surface layering while preserving ultra-compact 1-screen density.
- **Tactile & Addictive Micro-Interactions:** Use spring physics (`cubic-bezier(0.22, 1, 0.36, 1)`), tactile press compression (`scale(0.96)`), and smooth surface transitions so scrubbing, sorting, and scheduling feel effortless and responsive.

### Rule 6: A question from the user doesn't mean to start building
- If the user asks a question, answer the question. 
- If the user asks you to build something, start building.
- Do not start building unless the user asks you to build something.
- If the user asks you a question about a behavior, respond with "Yes, that is expected behavior..." or "No, that is not expected behavior..." and explain why. Do not start building unless the user explicitly tells you to start building.

---

## 3. Directory Structure

```
timerows/
├── public/
│   ├── favicon.svg
│   ├── index.html             # SEO meta tags, OpenGraph, JSON-LD schema
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── components/
│   │   ├── AdSlot.jsx         # Reserved zero-CLS ad container
│   │   ├── CitySearchModal.jsx# Fast fuzzy-search city selector
│   │   ├── Header.jsx         # Logo, date picker, share button, theme toggle
│   │   ├── Icons.jsx          # Lightweight zero-dependency SVG icons
│   │   ├── OverlapSummary.jsx # Highlighted best-meeting-window cards
│   │   ├── ShareModal.jsx     # Copy link, Slack snippet, and .ics export
│   │   ├── TimelineGrid.jsx   # Grid container coordinating all rows and scrubber
│   │   ├── TimeRow.jsx        # Individual city 24-hour horizontal track
│   │   ├── TimeScrubber.jsx   # Magnetic vertical time scrubber with time bubble
│   │   └── Toast.jsx          # Notification toasts (link copied, etc.)
│   ├── data/
│   │   ├── cities.json        # Curated offline database (~5,000 top global cities)
│   │   └── defaultPresets.js  # Default city rows (User local city + NYC + London + Tokyo)
│   ├── engine/
│   │   ├── citySearch.js      # Fast fuzzy autocomplete search engine
│   │   ├── citySearch.test.js
│   │   ├── icsExport.js       # RFC 5545 calendar invite generator (.ics)
│   │   ├── icsExport.test.js
│   │   ├── overlapEngine.js   # Multi-zone working-hour overlap detector
│   │   ├── overlapEngine.test.js
│   │   ├── timezoneEngine.js  # IANA timezone calculations, DST, solar phases
│   │   ├── timezoneEngine.test.js
│   │   ├── urlSync.js         # Bidirectional URL slug and share-state serializer
│   │   └── urlSync.test.js
│   ├── hooks/
│   │   ├── useLocalStorage.js # Persisted cities, preferences, and theme
│   │   └── useTheme.js        # Dark/Light theme manager
│   ├── App.css                # CSS custom properties, grid layouts, animations
│   ├── App.jsx                # Root coordinator and state orchestrator
│   ├── index.css              # Reset, typography tokens, base surfaces
│   └── index.jsx              # React 18 entry point
├── AGENTS.md                  # This file
├── package.json
└── README.md
```

---

## 4. Visual Time Row & Color Phase Standards

Each 24-hour time row is divided into 24 distinct hourly slots representing the selected calendar date. Slots must visually communicate human daily rhythms:

1. **Sleep Phase (11:00 PM – 7:00 AM):**
   - Deep slate/charcoal tones in dark mode, soft muted fog in light mode. Indicates unacceptable meeting times.
2. **Awake / Off-Hours (7:00 AM – 9:00 AM & 6:00 PM – 10:00 PM):**
   - Soft amber / warm twilight tones. Indicates possible but non-ideal meeting hours.
3. **Core Working Hours (9:00 AM – 5:00 PM / customizable):**
   - Clean, vibrant surface contrast with a distinct working-hour status badge.
4. **Golden Overlap Windows:**
   - When all pinned cities fall within working hours (e.g. 9am–5pm), the vertical column lights up with a subtle, radiant emerald/green glow.
5. **Date Line Crossing Indicator:**
   - Clearly flags days that roll over into `+1 Day` (Tomorrow) or `-1 Day` (Yesterday) relative to the primary city.

### Brand & Color Semantics (Non-Negotiable)

- **Name casing:** The logo wordmark is always lowercase `timerows`. In prose, titles, meta tags, and copy, the product name is always `TimeRows`.
- **Emerald (`#10b981`) means "overlap" only.** It appears in the logo's middle bar, the overlap band, and the best-overlap headline. Never use it for generic success states, toasts, or buttons.
- **Red (`#ef4444`) means "now" only.** It marks the live current-hour column and dot. Never use it for errors, warnings, or destructive hovers.
- **Solid ink (`--accent-primary`) is reserved** for the single primary CTA (Share) and the current selection (selected date, locked lens). Toggles and secondary active states use tonal fills.
- **Five color roles total:** ink (actions), slate (night), warm sand (off-hours), emerald (overlap), red (now). Do not introduce new accent hues.

---

## 5. Development Workflow & Scripts

- **Install Dependencies:** `npm install`
- **Start Dev Server:** `npm start` (or `npm run dev`)
- **Run Engine Test Suite:** `npm test -- --runInBand`
- **Build Production Bundle:** `npm run build`

---

## 6. Implementation Milestones for Agents - CHECK OFF AS YOU GO

- [x] **Milestone 1:** Pure Engine & Tests — `timezoneEngine.js`, `overlapEngine.js`, and `urlSync.js` with 100% passing Jest test coverage.
- [x] **Milestone 2:** City Search & Data — `cities.json` with indexed search by city name, country, and timezone.
- [x] **Milestone 3:** Visual Grid & Scrubber — Render stacked 24h tracks with magnetic cursor scrubbing, date line markers, and day/night gradients.
- [x] **Milestone 4:** Overlap Calculation & Summary Bar — Automatically calculate and highlight the top 3 best meeting windows.
- [x] **Milestone 5:** Sharing & Calendar Export — 1-click shareable URL generation, Slack markdown format, and RFC 5545 `.ics` export.
- [x] **Milestone 6:** Polish & Craft — Concentric geometry, keyboard navigation, fluid hover states, and zero-CLS ad slots.

users summarized goals:
1. earn max money through adsense. (all goals and objectives listed below are ultimately to achieve this primary goal.) this doesn't mean it is annoying with ads, but rather it is user friendly and has a lot of traffic which causes a high volume of return viewers and volume.
2. rank WELL on google and other search tools including chatgpt, gemini, claude, etc.