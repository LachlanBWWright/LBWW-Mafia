# Mobile NativeWind Migration Plan

## Goal

Update the React Native mobile app to use NativeWind as the exclusive styling system for app-owned UI.

This means:

- no `StyleSheet.create`
- no inline `style={{ ... }}`
- no app-owned style arrays such as `style={[...]}`
- shared primitives expose `className`-based APIs instead of style props

Some non-`className` library configuration will still need to exist where third-party APIs require explicit objects or scalar props. Examples in this app include the React Navigation theme object and props like `ActivityIndicator.color`. Those should be treated as explicit exceptions, not as reasons to keep the current mixed styling model.

## Current State

The mobile app already has some NativeWind setup in place:

- `nativewind` is installed in [mobile/package.json](/home/lachl/documents/mernmafia/mobile/package.json)
- Tailwind directives exist in [mobile/global.css](/home/lachl/documents/mernmafia/mobile/global.css)
- the CSS file is imported in [mobile/App.tsx](/home/lachl/documents/mernmafia/mobile/App.tsx#L1)
- the NativeWind type reference exists in [mobile/nativewind-env.d.ts](/home/lachl/documents/mernmafia/mobile/nativewind-env.d.ts)

But the app is not yet NativeWind-only:

- shared primitives are still `StyleSheet`-driven in [mobile/components/ui.tsx](/home/lachl/documents/mernmafia/mobile/components/ui.tsx#L315)
- legacy shared styles still exist in [mobile/styles/commonStyles.ts](/home/lachl/documents/mernmafia/mobile/styles/commonStyles.ts#L1)
- screens still use many inline `style` props across `mobile/screens/*.tsx`
- the Tailwind config is incomplete in [mobile/tailwind.config.js](/home/lachl/documents/mernmafia/mobile/tailwind.config.js#L1)
- Metro is not wrapped with NativeWind in [mobile/metro.config.js](/home/lachl/documents/mernmafia/mobile/metro.config.js#L1)
- Babel is close but not aligned with the current NativeWind Expo setup in [mobile/babel.config.js](/home/lachl/documents/mernmafia/mobile/babel.config.js#L1)

## Migration Principles

1. Use `className` for all app-owned visual styling.
2. Keep business logic unchanged during the styling migration.
3. Migrate shared primitives before screens.
4. Preserve semantic design tokens instead of scattering raw values through JSX.
5. Document and constrain any unavoidable exceptions for third-party APIs.

## Migration Phases

### Phase 1: Fix NativeWind Configuration

Bring the project in line with the current NativeWind Expo setup before converting components.

Files:

- [mobile/tailwind.config.js](/home/lachl/documents/mernmafia/mobile/tailwind.config.js)
- [mobile/babel.config.js](/home/lachl/documents/mernmafia/mobile/babel.config.js)
- [mobile/metro.config.js](/home/lachl/documents/mernmafia/mobile/metro.config.js)
- [mobile/app.json](/home/lachl/documents/mernmafia/mobile/app.json)

Tasks:

- add `presets: [require("nativewind/preset")]` to `tailwind.config.js`
- expand the Tailwind `content` globs to include:
  - `./App.tsx`
  - `./components/**/*.{js,jsx,ts,tsx}`
  - `./screens/**/*.{js,jsx,ts,tsx}`
  - `./context/**/*.{js,jsx,ts,tsx}`
- update Babel to use the Expo preset form with `jsxImportSource: "nativewind"`
- wrap the Metro config with `withNativeWind(config, { input: "./global.css" })`
- preserve the current monorepo `watchFolders` and `nodeModulesPaths` behavior while adding NativeWind
- if Expo web matters, switch `expo.web.bundler` to `metro`

Acceptance criteria:

- NativeWind classes compile reliably across app screens and components
- Metro still resolves workspace packages correctly
- no regressions in Expo startup for mobile

### Phase 2: Move Mobile Design Tokens Into Tailwind Theme

The app already has semantic tokens in [mobile/styles/colors.ts](/home/lachl/documents/mernmafia/mobile/styles/colors.ts#L1). Mirror these into the Tailwind theme so components can style against semantic names rather than inline color constants.

Files:

- [mobile/styles/colors.ts](/home/lachl/documents/mernmafia/mobile/styles/colors.ts)
- [mobile/tailwind.config.js](/home/lachl/documents/mernmafia/mobile/tailwind.config.js)

Tasks:

- map the existing semantic colors into `theme.extend.colors`
- map spacing tokens into `theme.extend.spacing`
- map radius tokens into `theme.extend.borderRadius`
- decide whether `colors.ts` remains as the source for non-className consumers such as React Navigation, or whether a shared token source should be introduced later

Acceptance criteria:

- JSX no longer needs raw hex values for app-owned styling
- utility classes express app semantics such as background, card, border, muted text, and primary

### Phase 3: Rebuild Shared UI Primitives Around `className`

The main migration seam is [mobile/components/ui.tsx](/home/lachl/documents/mernmafia/mobile/components/ui.tsx#L41). Converting this file first will remove most repeated style logic from screens.

Components to migrate:

- `Screen`
- `Card`
- `Button`
- `Input`
- `Badge`
- `ListRow`
- `EmptyState`
- `SectionHeader`
- `LoadingCard`
- `NavChip`
- `AppHeader`

Tasks:

- remove the `StyleSheet.create` block entirely
- replace `style` and `textStyle` props with `className`-driven APIs
- add targeted class props where needed, for example:
  - `className`
  - `contentClassName`
  - `textClassName`
- keep variant logic, but express it as class strings
- use a class composition helper if variant logic becomes difficult to maintain
- update `Screen` so scroll and non-scroll modes can be styled without falling back to inline style objects

Acceptance criteria:

- `mobile/components/ui.tsx` contains no `StyleSheet.create`
- shared primitives accept `className`-based customization
- new screen work no longer requires ad hoc style props

### Phase 4: Remove Legacy Shared Style Helpers

Files:

- [mobile/styles/commonStyles.ts](/home/lachl/documents/mernmafia/mobile/styles/commonStyles.ts)
- [mobile/screens/HowToPlayScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/HowToPlayScreen.tsx)
- [mobile/screens/PrivateGameLobbyScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/PrivateGameLobbyScreen.tsx)
- [mobile/screens/PublicGameLobbyScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/PublicGameLobbyScreen.tsx)
- [mobile/screens/SettingsScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/SettingsScreen.tsx)

Tasks:

- replace all `commonStyles` usage with NativeWind classes
- delete `commonStyles.ts` once nothing references it

Acceptance criteria:

- no app-owned shared style helper remains outside Tailwind theme and shared primitives

### Phase 5: Migrate Screens in Dependency Order

Convert screens after the shared primitives are stable.

Recommended order:

1. [mobile/screens/LandingScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/LandingScreen.tsx)
2. [mobile/screens/AboutScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/AboutScreen.tsx)
3. [mobile/screens/ProfileScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/ProfileScreen.tsx)
4. [mobile/screens/HistoryScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/HistoryScreen.tsx)
5. [mobile/screens/RolesScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/RolesScreen.tsx)
6. [mobile/screens/AdminScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/AdminScreen.tsx)
7. [mobile/screens/LobbyScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/LobbyScreen.tsx)

Reasoning:

- `Landing`, `About`, and `Profile` are simple and will validate the primitive API quickly
- `Lobby` is the most complex screen and should move last because it exercises:
  - tabs
  - scroll containers
  - action buttons
  - dynamic list rows
  - keyboard avoidance

Acceptance criteria:

- each migrated screen contains no inline style objects
- all screen-owned visual styling is expressed through NativeWind utilities or shared class-based primitives

### Phase 6: Handle Hard Edges Explicitly

Some APIs do not map cleanly to `className`.

Known hard edges in this codebase:

- `NavigationContainer` theme in [mobile/App.tsx](/home/lachl/documents/mernmafia/mobile/App.tsx#L28)
- `Stack.Navigator` `screenOptions.contentStyle` in [mobile/App.tsx](/home/lachl/documents/mernmafia/mobile/App.tsx#L45)
- `ActivityIndicator color` in [mobile/components/ui.tsx](/home/lachl/documents/mernmafia/mobile/components/ui.tsx#L281)
- `ScrollView` container styling patterns in [mobile/components/ui.tsx](/home/lachl/documents/mernmafia/mobile/components/ui.tsx#L56) and [mobile/screens/LobbyScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/LobbyScreen.tsx#L102)

Tasks:

- define an explicit exception policy for third-party props that require objects or scalar style values
- where `contentContainerStyle` is awkward, prefer wrapping scroll content in an inner `View` with `className`
- avoid preserving general-purpose `style` escape hatches on shared primitives

Acceptance criteria:

- exceptions are narrow, documented, and library-driven
- the app does not keep broad style escape hatches that undermine the migration

### Phase 7: Enforce the End State

Add checks so the app does not drift back into mixed styling.

Tasks:

- add lint rules or a repo check that flags:
  - `StyleSheet.create`
  - `style={{`
  - `style={[`
- run a final grep pass over `mobile/`
- document the styling rule for future contributors

Acceptance criteria:

- regressions toward inline styles or `StyleSheet` usage are caught automatically

### Phase 8: Verification

Run a regression pass once the migration is complete.

Platforms:

- iOS
- Android
- Expo web if the app is expected to support web through Metro

Checks:

- layout spacing consistency
- text wrapping and line-height behavior
- button pressed and disabled states
- list row alignment
- scroll behavior
- lobby chat and player panel usability
- navigation background and card color parity

Acceptance criteria:

- visual parity is maintained or improved
- no interaction regressions are introduced by the styling rewrite

## File-Level Worklist

### Configuration

- [mobile/tailwind.config.js](/home/lachl/documents/mernmafia/mobile/tailwind.config.js)
- [mobile/babel.config.js](/home/lachl/documents/mernmafia/mobile/babel.config.js)
- [mobile/metro.config.js](/home/lachl/documents/mernmafia/mobile/metro.config.js)
- [mobile/app.json](/home/lachl/documents/mernmafia/mobile/app.json)

### Shared Styling Foundation

- [mobile/styles/colors.ts](/home/lachl/documents/mernmafia/mobile/styles/colors.ts)
- [mobile/components/ui.tsx](/home/lachl/documents/mernmafia/mobile/components/ui.tsx)
- [mobile/styles/commonStyles.ts](/home/lachl/documents/mernmafia/mobile/styles/commonStyles.ts)

### Screens

- [mobile/screens/LandingScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/LandingScreen.tsx)
- [mobile/screens/AboutScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/AboutScreen.tsx)
- [mobile/screens/ProfileScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/ProfileScreen.tsx)
- [mobile/screens/HistoryScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/HistoryScreen.tsx)
- [mobile/screens/RolesScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/RolesScreen.tsx)
- [mobile/screens/AdminScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/AdminScreen.tsx)
- [mobile/screens/LobbyScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/LobbyScreen.tsx)
- [mobile/screens/HowToPlayScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/HowToPlayScreen.tsx)
- [mobile/screens/PrivateGameLobbyScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/PrivateGameLobbyScreen.tsx)
- [mobile/screens/PublicGameLobbyScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/PublicGameLobbyScreen.tsx)
- [mobile/screens/SettingsScreen.tsx](/home/lachl/documents/mernmafia/mobile/screens/SettingsScreen.tsx)

## Major Risks

- the current Tailwind content globs are too narrow, so some classes would not compile until config is fixed
- the current Metro config does not include NativeWind wrapping, which can cause partial or inconsistent setup behavior
- preserving general `style` props on custom components would allow the mixed styling model to survive
- forcing purity on third-party APIs would create brittle workarounds and slow the migration unnecessarily

## Definition of Done

The migration is complete when:

- `rg "StyleSheet\\.create|style=\\{|style=\\[" mobile` returns only approved third-party exceptions or nothing
- shared primitives are class-based
- screen-owned styling is implemented with NativeWind utilities
- legacy shared style helpers are removed
- app visuals remain stable across supported platforms

## References

- NativeWind installation docs: https://www.nativewind.dev/docs/getting-started/installation
- NativeWind custom components guide: https://www.nativewind.dev/docs/guides/custom-components
- NativeWind third-party components guide: https://www.nativewind.dev/docs/guides/third-party-components
