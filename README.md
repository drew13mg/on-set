# ON SET

A toolkit for creatives working on large productions. iOS and Android, built with Expo (SDK 57) and Expo Router.

## Projects
The first screen. Tap **New project** to start one (it opens straight into its tools), or tap a project in the list to open it. The list shows the most recently used first. **Press and hold** a project to rename or delete it (deleting also removes its clips and saved location). Everything in the tools below belongs to the open project.

## Tools

### Transcribe
Live speech-to-text from the phone's microphone.

- **Start transcribing** begins a live transcript. Each finished line is stamped with the time of day it was heard.
- **Mark In** stamps the time of day the moment it's tapped (device clock, 24-hour `HH:MM:SS`).
- **Mark Out** stamps the time of day and opens a window to name the clip.
- Saved clips keep their IN / OUT times, length, and the dialogue heard between them.
- Transcription restarts automatically when the recognizer times out during silence, so it keeps running until you tap Stop.
- On iOS, speech is processed on the device (no network needed).

### Clips
The project's named clips, saved on the device. Tap to rename, hold for rename / delete, **Share** to send a text log (sorted by IN time) to an editor or script supervisor.

### Sun Tracker
Where the sun will be at any time and date, anywhere, plus live weather there.

- **Location:** use the phone's current location, or type an address, city or landmark. The last location is remembered.
- **Date:** step day by day, tap the date for a calendar, or jump back to Today. Sun positions work for any date.
- **Sky map:** top-down compass (north up, outer ring = horizon, centre = overhead). The arc is the day's sun path, coloured golden / daylight; the dot is the sun at the chosen time, with a dashed line showing the direction the light comes from.
- **Time slider:** drag through the day. The track is coloured by light: night, blue hour (−6° to −4°), golden hour (−4° to +6°) and daylight. On today's date a red line marks now, and the slider follows the live time until you move it.
- **Key moments:** blue hour, golden hour, sunrise, solar noon, sunset and dark as chips. Tap one to jump there.
- **Sun details:** direction (degrees + compass point), elevation, and shadow length/direction.
- **Forecast at the chosen hour** (up to 16 days ahead): temperature, conditions, cloud cover and what it means for the light, rain chance, wind and gusts, visibility, UV.
- **Live weather:** current conditions, refreshed every 10 minutes and when you return to the app; pull down to refresh.
- All times are the **location's local time**, so you can scout another city from anywhere.

Weather and place search use [Open-Meteo](https://open-meteo.com) (free, no API key). Street addresses use the phone's built-in geocoder.

## Project layout

```
src/app/                    screens (Expo Router: every file is a route)
  _layout.tsx               app shell, fonts, header style
  index.tsx                 projects (first screen)
  project/[id]/index.tsx    a project's tools (add new tools here)
  project/[id]/transcribe.tsx
  project/[id]/clips.tsx
  project/[id]/sun.tsx
src/components/     shared UI (clip naming, sun compass, time slider, place picker, weather cards)
src/lib/            logic, theme, fonts, hooks (sun.ts, tz.ts, weather.ts are pure + unit tested)
tests/              unit tests (node --test)
```

## Look
Dark slate grey (`#1C2127`) with DIN-style type. Colors, spacing and type styles live in `src/lib/theme.ts`.

**Font:** the app is set up for **DIN Pro**, which is a licensed font and isn't in the repo. Until it's added, Barlow (free, DIN-inspired) stands in. To switch, add your DIN Pro files to `assets/fonts/` and follow the steps at the top of `src/lib/fonts.ts`.

## Running it

Speech recognition uses native code, so it needs a **development build** (it won't run in Expo Go).

```bash
npm install
npx eas-cli@latest build --profile development --platform ios   # or android
npx expo start --dev-client
```

Other commands:

```bash
npm test             # clip logic unit tests
npm run typecheck    # TypeScript
```

## Store builds

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios       # App Store Connect / TestFlight
npx eas-cli@latest submit --platform android   # Google Play
```

App IDs: `com.drew13mg.onset` (iOS bundle ID and Android package).
