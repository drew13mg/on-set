# ON SET

A toolkit for creatives working on large productions. iOS and Android, built with Expo (SDK 57) and Expo Router.

## Projects
The first screen. The account button (top right) signs you in with Apple, Google, or email + password; the dot under the title shows sync status. Tap **New project** to start one (it opens straight into its tools), or tap a project in the list to open it. The list shows the most recently used first. **Press and hold** a project to rename or delete it (deleting also removes its clips and saved location). Everything in the tools below belongs to the open project.

**Join a project with a code** (under New project) joins a project someone shared with you by invite code.

## Sharing
Sign in to share. Everyone on a project sees every change (transcripts, clips, equipment checks, sun location, project name) as it happens.

- **Project settings** — the gear in the top-right corner of every project screen. Sharing lives here, so you can add more people any time. (More settings can be added here later.) Also reachable by pressing and holding a project → **Share**.
- **Add people** by email (paste several at once).
- **User groups** — saved lists of people (e.g. "Camera dept") shown as buttons: tap to share the project with the whole group, tap again to unshare. **Press and hold a group** to edit its name and members. Groups stay linked: people you add to a group get access to every project shared with it, and people you remove lose it. Manage all groups from Account → User groups.
- **Invite code** — an 8-character code anyone can use via "Join a project with a code". Useful when someone signs in with Apple's Hide My Email.
- **People with access** — who can open the project and how (owner, added directly, or via a group). The owner can remove people added directly.
- Anyone on a project can edit and share it further. Only the owner can delete it for everyone; others can **Leave**.
- **Offline**: everything works without signal. Changes are saved on the phone and upload when you're back online; if two people edit the same thing, the most recent change wins.
- **"My equipment"** (saved gear) follows you across your own devices but isn't shared.
- **Account → Delete account** permanently removes your account and the projects you own (required by the App Store).

## Tools

### Transcribe
Named transcriptions, each with its own transcript and clip list.

- **Transcriptions list:** tap **New transcription** and name it (e.g. "Locker room interviews", "Day 2 – B camera"). It opens the recorder. Saved transcriptions are listed newest first with date, recorded time span, clip count and word count. Tap to open and keep adding; **press and hold** to rename, email or delete.
- **Recorder:** **Start transcribing** for live speech-to-text; each line is stamped with the time of day. **Mark In** / **Mark Out** stamp the time of day when tapped, then a window pops up to name the clip. Saved clips' IN/OUT marks appear in the transcript where they happened. Lines are saved as they arrive, so a transcription can be stopped and continued later.
- Transcription restarts automatically during silences, so it keeps running until you tap Stop. On iOS, speech is processed on the device.
- **Email (any time):** from the recorder header, the transcriptions list, or the Clips screen. Sends a plain-text version for editors:
  - header (project, transcription, date, recorded time span)
  - numbered clip list sorted by IN time: name, IN, OUT, length, dialogue
  - full timestamped transcript with `>> IN` / `<< OUT` clip marks in place
  Uses the phone's Mail app when set up, otherwise the share sheet (Gmail, Outlook, etc.).

### Clips
Every clip in the project, grouped by transcription, each group with its own **Email** button. Tap a clip to rename; hold for rename / delete. **Share** sends all groups as text.

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

### Equipment
Build a gear list for the project, then use it as a checklist.

- **Build the list:** type equipment and tap **Add**. With *Save to My equipment* on (the default), it's saved for every future project. Turn it off for one-off items that belong to this project only.
- **My equipment:** saved gear appears as small buttons under the text box, A–Z. Tap to add to (or take off) this project; typing filters them.
- **Save list** turns the selection into the reference checklist.
- **Checklist:** every item is a button; tap to turn it green and confirm you have it. A progress bar shows how many are checked; **Clear all checks** resets. **Edit list** goes back to adding or removing items.
- **Press and hold** any equipment button (in either view) to **edit** its name or **delete** it. Editing saved equipment updates it in every project.

Weather and place search use [Open-Meteo](https://open-meteo.com) (free, no API key). Street addresses use the phone's built-in geocoder.

### Location Scouting
The places you're considering for the project.

- **Locations list:** **New location** (give it a name), or tap a previously added location to open it. Each shows a cover photo and how many photos/notes it has. **Press and hold** to rename or delete.
- **Photos:** up to **10 per location**. Tap **Add photo** → **Take photo** (camera) or **Choose from library** (pick several at once). Photos are resized to 2048 px on the long edge to keep uploads fast on set.
- **Photo notes:** press and hold a photo → **Add note** / **Edit note** (or tap **Add note** in full screen). A small NOTE badge marks photos that have one.
- **Full screen:** tap a photo. Its note shows on the photo. **Swipe left/right** for the next/previous photo, **pinch in** (squeeze two fingers) or tap the **back arrow** (top left) to exit.
- **Location notes:** **+ Add note** for as many notes as you need. **Press and hold** a note to edit or delete it.
- Shared with everyone on the project. Photos are kept on the phone that took them and upload in the background when signed in and online; teammates see a placeholder until the upload finishes. Stored in a private bucket only people on the project can access.

## Project layout

```
src/app/                    screens (Expo Router: every file is a route)
  _layout.tsx               app shell, fonts, header style
  index.tsx                 projects (first screen)
  project/[id]/index.tsx    a project's tools (add new tools here)
  project/[id]/transcribe.tsx          transcriptions list
  project/[id]/transcription/[tid].tsx recorder for one transcription
  project/[id]/clips.tsx
  project/[id]/sun.tsx
  project/[id]/equipment.tsx
  project/[id]/locations.tsx       location scouting list
  project/[id]/location/[lid].tsx  one location: photos + notes (PhotoViewer for full screen)
  project/[id]/settings.tsx   project settings (gear, top right): sharing, rename, delete/leave
  account.tsx               sign in (Apple, Google, email) / account
  auth-callback.tsx         opened by the confirm-email link
  reset-password.tsx        opened by the reset-password link
  groups.tsx                saved user groups
src/components/     shared UI (clip naming, sun compass, time slider, place picker, weather cards)
src/lib/            logic, theme, fonts, hooks (sun.ts, tz.ts, weather.ts are pure + unit tested)
tests/              unit tests (node --test)
```

## Look
Dark slate grey (`#1C2127`) with DIN-style type. Colors, spacing and type styles live in `src/lib/theme.ts`.

**Font:** the app is set up for **DIN Pro**, which is a licensed font and isn't in the repo. Until it's added, Barlow (free, DIN-inspired) stands in. To switch, add your DIN Pro files to `assets/fonts/` and follow the steps at the top of `src/lib/fonts.ts`.

## Backend

Supabase project **on-set** (`upjtapmgidpmtudjhtpv`, US East). Schema, access rules and functions are in `supabase/migrations/`. Every table has row-level security: people only ever see projects they own, were added to, or are in a linked group for. The app's publishable key is in `src/lib/supabase.ts` (safe to ship; override with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

App side: `src/lib/sync/` is the offline-first sync engine (device copy → upload → download → live updates via Supabase Realtime), tested in `tests/sync.test.ts`.

## Sign-in setup (needed before anyone can sign in)

**Email + password** works with Supabase's built-in email sign-in (on by default). People tap *New here? Create an account*, enter their email, an optional name, and create a password (at least 8 characters, letters and numbers, typed twice). Returning users sign in with email + password; **Forgot password?** emails a link that opens ON SET to choose a new one.

Email setup in Supabase:
- Authentication → URL Configuration → *Redirect URLs*: add `onset://auth-callback` and `onset://reset-password`.
- Authentication → Sign In / Providers → Email: keep **Confirm email** on (new accounts confirm their address before first sign-in). Set *Minimum password length* to 8 to match the app.
- **Before real users:** Supabase's built-in email sender only delivers to your own team's addresses and a few emails per hour. Add your own SMTP (Authentication → Emails → SMTP Settings; e.g. Resend, Postmark, SendGrid or your company mail server) so confirmation and reset emails reach everyone. You can also edit the email wording there.

Apple and Google each need a one-time setup in their developer consoles, then the keys go into Supabase.

**1. Supabase redirect URLs**
Supabase dashboard → Authentication → URL Configuration → *Redirect URLs* → add `onset://auth-callback` and `onset://reset-password`.

**2. Google**
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → type **Web application**.
2. Authorized redirect URI: `https://upjtapmgidpmtudjhtpv.supabase.co/auth/v1/callback`
3. Copy the Client ID and Client secret into Supabase → Authentication → Sign In / Providers → **Google** → enable.
4. OAuth consent screen: add your app name, support email and the `email` / `profile` scopes; publish it when you're ready for users outside your test list.

**3. Apple** (needs the paid Apple Developer Program)
1. Certificates, Identifiers & Profiles → Identifiers → App ID `com.drew13mg.onset` → enable **Sign in with Apple**.
2. For iPhone (native sign-in): in Supabase → Providers → **Apple** → enable, and add `com.drew13mg.onset` to *Client IDs*.
3. For Android (browser sign-in): create a **Services ID** (e.g. `com.drew13mg.onset.signin`), enable Sign in with Apple on it, set the return URL to `https://upjtapmgidpmtudjhtpv.supabase.co/auth/v1/callback`; create a **Key** with Sign in with Apple; in Supabase's Apple provider add the Services ID to Client IDs and generate the secret from the key (Team ID, Key ID, .p8 file). Apple requires regenerating this secret every 6 months.

Until a provider is set up, tapping its button shows "This sign-in option isn't switched on yet". Everything else in the app works without signing in.

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
