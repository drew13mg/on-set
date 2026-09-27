# ON SET

A toolkit for creatives working on large productions. iOS and Android, built with Expo (SDK 57) and Expo Router.

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
All named clips, saved on the device. Tap to rename, hold to delete, **Share** to send a text log (sorted by IN time) to an editor or script supervisor.

## Project layout

```
src/app/            screens (Expo Router: every file is a route)
  _layout.tsx       app shell, fonts, header style
  index.tsx         home: list of ON SET tools (add new tools here)
  transcribe.tsx    live transcript + Mark In / Mark Out
  clips.tsx         saved clips
src/components/     shared UI (NameClipModal)
src/lib/            logic, theme, fonts, hooks
tests/              unit tests for the clip logic (node --test)
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
