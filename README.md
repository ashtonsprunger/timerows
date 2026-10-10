# TimeRows (`timerows.com`)

> A modern, high-craft visual timezone converter and team meeting overlap planner.

TimeRows eliminates timezone math for global teams through stacked 24-hour visual time rows with real-time solar gradients, working-hours overlap highlighting, and frictionless 1-click calendar exports.

---

## Features

- **Stacked 24-Hour Visual Tracks:** Local timezone auto-detection with aligned multi-city timelines.
- **Solar Day/Night Illumination:**
  - 🌙 **Sleep Phase (11:00 PM – 7:00 AM):** Slate/fog tones for non-viable hours.
  - 🌅 **Awake / Off-Hours (7:00 AM – 9:00 AM & 5:00 PM – 11:00 PM):** Warm twilight tones.
  - ☀️ **Core Working Hours (9:00 AM – 5:00 PM):** Vibrant contrast surfaces.
- **Golden Overlap Windows:** Vertical columns highlight in radiant emerald when all pinned cities are simultaneously in working hours.
- **Magnetic Time Scrubber:** Smooth laser guide with floating time bubble showing real-time working status.
- **RFC 5545 `.ics` Export:** 1-click calendar invite downloads for Apple Calendar, Outlook, and Google Calendar.
- **Programmatic SEO & PLG URLs:** Share links (`timerows.com/m/nyc+lon+tyo`) and city-pair paths (`/from/san-francisco/to/london`).
- **Concentric Google Material 3 Geometry:** Mathematically calculated concentric radii and zero Cumulative Layout Shift (CLS).

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `←` / `→` | Scrub hour columns backward / forward |
| `[` / `]` | Previous Day / Next Day |
| `T` | Jump to Today |
| `/` | Open City Search modal |
| `S` | Open Share & Calendar Export modal |
| `Esc` | Clear selection / close modals |

---

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run engine unit tests
npm test -- --runInBand

# Build production bundle
npm run build
```
