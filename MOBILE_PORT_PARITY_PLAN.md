# Mobile Port Parity Plan

## Goal

Bring the Expo mobile app in `mobile/` up to the same styling system and user-facing feature set as the main Next.js app in `nextjs/`.

This is not just a visual polish pass. The current mobile app only covers part of the gameplay flow, while the Next.js site already defines the product surface area, theme tokens, auth model, and several non-game pages.

## Current State Summary

### Next.js currently provides

- Shared dark theme and UI tokens in `nextjs/src/styles/globals.css`
- A branded top-level header/navigation in `nextjs/src/components/header.tsx`
- Landing page in `nextjs/src/app/page.tsx`
- Live lobby/game client in `nextjs/src/app/lobby/LobbyClient.tsx`
- Roles reference page in `nextjs/src/app/roles/page.tsx`
- About page in `nextjs/src/app/about/page.tsx`
- Match history page in `nextjs/src/app/history/page.tsx`
- Profile page with auth-aware state in `nextjs/src/app/profile/page.tsx`
- Admin user search page in `nextjs/src/app/admin/page.tsx`
- Google sign-in via NextAuth
- tRPC-backed recent match history and admin actions

### Mobile currently provides

- Stack navigation shell in `mobile/App.tsx`
- Home screen with username entry in `mobile/screens/HomeScreen.tsx`
- Game screen with chat, player list, and recent matches tab in `mobile/screens/GameScreen.tsx`
- Placeholder or partial screens for private lobby, public lobby, settings, and how-to-play
- A similar but separate color palette in `mobile/styles/colors.ts`
- Ad hoc React Native styles in screen files and `mobile/styles/commonStyles.ts`

### Main parity gap

The mobile app currently matches only part of the in-game lobby experience. It does not yet match the full Next.js information architecture, auth behavior, reusable component system, or page-level content.

## What Needs To Be Done

## 1. Establish a shared design system for mobile

The Next.js site already defines the visual language. Mobile should treat that as the source of truth.

Work required:

- Port the web theme tokens from `nextjs/src/styles/globals.css` into a mobile token layer.
- Align mobile colors with the web values:
  - background `#060912`
  - card/popover `#0f1528`
  - secondary/muted `#19213a`
  - accent/input `#1e2947`
  - primary `#5b8cff`
  - border `#283456`
  - destructive `#a93f57`
  - foreground and muted text values
- Define mobile equivalents for the web spacing, border radius, and surface hierarchy.
- Choose a font strategy that matches the Next.js Geist-based presentation as closely as React Native allows.
- Replace one-off `StyleSheet` usage with reusable UI primitives where possible:
  - `Screen`
  - `PageHeader`
  - `Card`
  - `Button`
  - `Input`
  - `Badge`
  - `ListRow`
  - `EmptyState`
- Recreate the web affordances that matter visually:
  - sticky/app header feel
  - card surfaces
  - outlined and secondary button variants
  - muted text treatment
  - badge styling for day/time state
  - consistent rounded borders

Expected outcome:

The mobile app should stop looking like a separate product and instead look like a native rendering of the same product system.

## 2. Align navigation and screen structure with the web app

The web app has a clear route structure. Mobile needs an equivalent navigation model.

Recommended mobile screen set:

- `Home`
  - Mobile equivalent of `nextjs/src/app/page.tsx`
- `Lobby`
  - Mobile equivalent of `nextjs/src/app/lobby/page.tsx` and `LobbyClient.tsx`
- `Roles`
  - Mobile equivalent of `nextjs/src/app/roles/page.tsx`
- `About`
  - Mobile equivalent of `nextjs/src/app/about/page.tsx`
- `History`
  - Mobile equivalent of `nextjs/src/app/history/page.tsx`
- `Profile`
  - Mobile equivalent of `nextjs/src/app/profile/page.tsx`
- `Admin`
  - Mobile equivalent of `nextjs/src/app/admin/page.tsx`, only for admins

Likely navigation work:

- Replace the current minimal stack setup with a clearer app shell.
- Add a primary navigation model that exposes the same destinations as the web header.
- Decide whether mobile should use:
  - bottom tabs for top-level destinations plus stack detail screens, or
  - a stack plus menu/drawer
- Remove or repurpose screens that do not map cleanly to the web app:
  - `PrivateGameLobbyScreen`
  - `PublicGameLobbyScreen`
  - `HowToPlayScreen`
  - `SettingsScreen`

Recommendation:

Use the web app as the product source of truth. If a mobile-only screen exists but has no equivalent on the main site and no current product need, it should be removed or folded into the aligned navigation model.

## 3. Rebuild the mobile home screen to match the web landing page

Current mobile home is a username form and a disabled private match button. The web landing page is a branded hero with a quick-start panel and a single clear CTA.

Work required:

- Replace the current home layout with a mobile adaptation of the web landing page.
- Add:
  - branded title treatment
  - supporting copy
  - quick-start instructions
  - main CTA to join the lobby
- Decide where username entry belongs.

Recommendation:

Do not keep username entry as the primary home-screen concept if web parity is the goal. Username should come from authenticated identity where possible, or be a secondary join step rather than the homepage itself.

## 4. Bring the lobby/gameplay screen to behavioral parity

The mobile `GameScreen` is the closest thing to parity, but it still diverges from the web implementation.

### Gaps to close

- Reuse the same room-join behavior as the web lobby flow.
- Align join/loading/error states with `LobbyClient.tsx`.
- Match the web layout concepts:
  - chat panel
  - player panel
  - meta badges for time/day/time left
  - disabled states
- Replace command-string action emission in the player list with the same explicit event usage the web client uses:
  - vote via `ClientEvent.HandleVote`
  - visit via `ClientEvent.HandleVisit`
  - whisper via `ClientEvent.HandleWhisper`
- Ensure mobile and web use the same player action rules and affordances.
- Match the web copy and empty states.
- Review socket lifecycle handling so it mirrors the more structured web hook in `nextjs/src/app/lobby/hooks/useGameLobby.ts`.

### Specific mobile issues worth fixing during parity work

- `GameScreen` currently mixes gameplay UI with a recent match history tab. On web, history is a separate page.
- `GameScreen` emits slash-command strings for some actions instead of using the dedicated client events the web client uses.
- `PublicGameLobbyScreen` expects a `name` route param, but the current home flow navigates directly to `GameScreen`, so the lobby split is not coherent.
- The mobile app has no equivalent to the web `Header` branding and navigation context once inside the app.

Expected outcome:

The mobile lobby should feel like the same game client with native layout adaptations, not a second implementation with similar mechanics.

## 5. Add parity for non-game content pages

The Next.js site is already more than just the lobby. Mobile needs equivalents for those user-facing pages if the goal is the same feature set.

### Roles

Implement a mobile roles screen using the same role groups and descriptions from `nextjs/src/app/roles/page.tsx`.

### About

Implement a mobile about screen using the same copy and feature list from `nextjs/src/app/about/page.tsx`.

### History

Implement a mobile match history screen using the same `recentByUsername` data source and presentation goals as `nextjs/src/components/recent-matches.tsx`.

### Profile

Implement a mobile profile screen with:

- signed-out state
- signed-in user identity
- recent matches
- admin entry point when allowed

### Admin

Implement a mobile admin screen for authorized users with:

- user search
- current admin state display
- admin toggle action

## 6. Solve authentication parity

This is the biggest product-level gap after navigation.

The web app uses NextAuth with Google sign-in. The mobile app currently has no equivalent authenticated user flow and instead relies on manual name entry for gameplay.

Work required:

- Decide whether mobile must support the same real auth identities as the web app.
- If yes, implement a mobile auth flow that is compatible with the existing backend/session model.
- Confirm how mobile will call authenticated tRPC procedures:
  - cookie-backed web session will not translate directly to native
  - mobile may need token-based auth or a dedicated session exchange flow
- Update profile/history/admin behavior to depend on authenticated identity rather than manual typed usernames.

Important implication:

Feature parity with `profile`, `history`, and `admin` is incomplete until auth/session parity is solved.

## 7. Unify API and data access patterns

Mobile and web both use tRPC and shared game rules, but they are not structured the same way.

Work required:

- Centralize mobile API access patterns to match the web app’s expectations.
- Introduce a small mobile-side app state layer for:
  - auth/session
  - lobby/game session
  - recent matches
  - admin mutations
- Move duplicated lobby/socket behavior toward a shared abstraction where practical.
- Audit environment variables so mobile and web stay aligned:
  - socket backend
  - socket URL
  - captcha token
  - tRPC URL
- Review whether `room.rotate` and active room behavior should be surfaced in mobile too.

## 8. Standardize copy, states, and UX rules

Even where functionality overlaps, the experience is not yet consistent.

Work required:

- Match the web copy for loading, empty, and error states.
- Match button labels and CTA hierarchy.
- Match alive/dead/player-state visual semantics.
- Decide whether mobile should keep vibration on death as a deliberate mobile enhancement.
- Add native-safe equivalents for web-only affordances:
  - scroll styling becomes standard native scroll behavior
  - sticky header becomes navigation/header treatment
  - hover states are dropped, pressed states are added

## 9. Testing and verification work

Parity work should be verified at both UI and behavior levels.

Work required:

- Add screen-level tests for navigation and basic rendering.
- Add behavior tests around:
  - join flow
  - message sending
  - vote/visit/whisper enablement rules
  - signed-in vs signed-out states
  - admin authorization gating
- Manually verify the mobile app against the web app for:
  - theme accuracy
  - route coverage
  - socket behavior
  - tRPC data loading
  - auth-gated surfaces

## Recommended Implementation Order

1. Build a shared mobile design system that mirrors the Next.js theme.
2. Redesign the mobile navigation to match the web route structure.
3. Rework the home screen and lobby/game screen for visual and behavioral parity.
4. Add Roles and About screens.
5. Add History and Profile screens.
6. Solve authentication/session parity.
7. Add Admin screen after auth is in place.
8. Run parity QA across all shared features.

## Likely File Areas To Touch

### Mobile

- `mobile/App.tsx`
- `mobile/screens/*`
- `mobile/styles/colors.ts`
- `mobile/styles/commonStyles.ts`
- `mobile/lib/trpc.ts`
- new shared mobile UI components, likely under a new `mobile/components/` directory

### Shared or backend-adjacent

- shared auth/session types if mobile auth is added
- tRPC context or auth handling if native clients need non-cookie auth
- possibly server/session endpoints if mobile needs a token/session exchange path

## Risks and Decisions Needed

- Auth is the main architectural blocker for true feature parity.
- The current mobile information architecture does not match the web app and should not simply be polished as-is.
- Some current mobile screens are placeholders and should be treated as disposable during parity work.
- If the product goal is only “same gameplay” and not “same full app,” scope should be reduced explicitly. Otherwise the mobile app needs parity for content, profile, history, and admin too.

## Definition of Done

The mobile port can be considered aligned with the main Next.js site when:

- it uses the same core theme tokens and component language
- it exposes equivalent top-level destinations
- it matches the web lobby/gameplay behavior
- it includes mobile equivalents for About, Roles, History, Profile, and Admin
- authenticated features behave consistently with the web app
- the app no longer depends on placeholder screens or divergent flows that do not exist on the main site
