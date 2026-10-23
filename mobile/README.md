# Mobile App

This app uses NativeWind for all app-owned styling.

## Styling rules

- Prefer `className` on components and screens.
- Avoid `StyleSheet.create` for app-owned UI.
- Avoid inline `style={{ ... }}` and `style={[... ]}` unless the API is a third-party exception that cannot accept `className`.
- Keep Tailwind utilities colocated with the component or screen they style.

## Checks

- `pnpm run lint`
- `pnpm run check:styles`

## Visual development

- `pnpm run storybook` opens the isolated React Native component workshop in Expo.
- `pnpm run storybook:ios` or `pnpm run storybook:android` opens it directly on a simulator.
- `pnpm run storybook:screenshots` exports every mobile Storybook story and captures it at small-phone, phone, and tablet viewports. Screenshots are written to `visual/storybook-screenshots/`.
- `pnpm run visual:screenshots` exports the real Expo web app and captures independent screen states at small-phone, phone, and tablet viewports. Long screens receive additional scroll-position captures. Open `visual/screenshots/index.html` to review the generated gallery.

Storybook is enabled only when `STORYBOOK_ENABLED=true`. Headless screenshot capture uses the normal Expo web bundle with a `capture` query parameter so the same story render functions can be checked in CI.

## Cross-platform behavior

Direct messages share the same 10-second refresh interval and merge/deduplication logic on web and mobile. The web client also listens for server-sent events for faster updates; the native client polls only while the app is foregrounded because it follows the operating system app lifecycle. The shared interval is covered by `shared/game/directMessages.test.ts`.

### Lobby invitation links

Set `EXPO_PUBLIC_WEBSITE_URL` when the public website and API use different origins. Public lobby links open the website; `mernmafia://lobby?room=<roomId>` opens the native lobby, with `&spectate=1` for watching. Native HTTPS app opening additionally requires the deployed domain’s association files and iOS/Android domain configuration. Lobby link routing accepts only the configured website origin or the registered native scheme.

## On-device ChatGPT AI

The installed iOS/Android app uses its own `MafiaChatGPT` local Expo module for loopback OAuth callbacks and OS RSA verification. Credentials stay in SecureStore; account model discovery, streaming inference and AI game sockets run on the phone. No computer companion, address or API key is needed. Expo Go and web builds cannot load this module.

Build with `pnpm --dir mobile run android:build` or, on macOS with Xcode, `pnpm --dir mobile run ios:build`. Expo autolinking discovers `modules/mafia-chatgpt`; do not omit that directory from EAS uploads. Set `EXPO_PUBLIC_TRPC_URL` and `EXPO_PUBLIC_SOCKET_URL` to the deployed API and PartyServer addresses before a release build. Keep the app open while AI characters play; backgrounding pauses decision submission.

Release acceptance still includes native iOS compilation and live ChatGPT consent/inference on both device platforms. Automated tests do not authorize an account or spend plan allowance.

Verified on 2026-10-23: Android `:mafia-chatgpt:compileDebugKotlin`, Android/iOS Hermes exports, native module autolinking on both platforms, mobile typecheck, authorization/signature tests and relevant Storybook checks pass. An iOS JS export does not compile Swift; use Xcode for that release check.

## Game Worker configuration

The game backend runs PartyServer on Cloudflare Workers. Set `EXPO_PUBLIC_SOCKET_BACKEND=partyserver`, `EXPO_PUBLIC_SOCKET_URL` to the Worker origin (for example `https://<worker>.<account-subdomain>.workers.dev`), and `EXPO_PUBLIC_TRPC_URL` to the Vercel website plus `/api/trpc`. Use the origin without `/parties/main/...`; the shared client adds the room path. `EXPO_PUBLIC_PARTYSERVER_ROOM` selects the fallback room when navigation does not supply one. These public values are bundled by Expo: rebuild and distribute the app when changing environments. For a physical device on a local network, replace `localhost` with your development machine’s reachable address.
