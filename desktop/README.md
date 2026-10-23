# Electron desktop app

Electron loads the shared Next.js client and supplies an isolated native ChatGPT bridge. Browser visitors see disabled AI setup; the installed app opens ChatGPT authorization in the system browser and handles the callback automatically. Players do not install Node or start a companion.

For local development, start the web/game services with `pnpm run dev:local`, then run:

```sh
MAFIA_DESKTOP_APP_URL=http://localhost:3000 MAFIA_DESKTOP_SOCKET_URL=http://localhost:1999 pnpm run desktop
```

Install dependencies with `pnpm install`. Electron 45 downloads its binary explicitly with `pnpm exec install-electron` when first needed. Production game services remain hosted; they are not bundled into the desktop app.

Before distribution, set `appUrl` and `socketUrl` in `desktop/config.json` to the deployed HTTPS website and PartyServer origins. Use the Cloudflare Worker origin (for example `https://<worker>.<account-subdomain>.workers.dev`) without `/parties/main/...`; the bot runner adds the room path. The socket origin must match the Next.js public socket configuration (`NEXT_PUBLIC_SOCKET_BACKEND=partyserver`). Runtime environment variables above override these values for development. Empty configuration fails with an explanatory startup error.

`pnpm run desktop:pack` creates an unpacked application. `pnpm run desktop:dist` creates a platform installer (AppImage, macOS DMG or Windows NSIS). Build/sign/notarize on the respective release platforms with your distribution credentials. A successful Linux package is not proof of macOS/Windows signing or store readiness.

Credentials are encrypted through Electron `safeStorage` and written atomically under the app's user-data `chatgpt` directory. Linux requires an available OS secret service; the insecure `basic_text` backend is refused. The renderer receives no access/refresh/ID tokens or generic inference method. Main-frame sender checks, allowed methods, configured game origin and bot-seat validation protect the bridge. Closing the desktop app stops its bot sockets and in-flight authorization/inference.

Run `pnpm run test:desktop` for controller/storage tests. With built Storybook served at `STORYBOOK_BASE_URL`, `node desktop/smoke.mjs` launches Electron against the native setup UI using an isolated user-data directory. It does not sign in or spend plan usage. Runtime and bot tests remain under `pnpm run test:chatgpt` and the server suites.

Live ChatGPT authorization and a complete AI match remain release acceptance checks. The desktop stores one ChatGPT registration; disconnect and reconnect reuse that registration. Multi-account selection is future work.

Verification on 2026-10-23: controller/encrypted-store tests and source plus packaged Linux Electron UI smoke passed. The smoke uses a separate user-data directory, verifies the real preload/IPC status path and native setup UI, and rejects arbitrary inference calls. Platform typechecks, 110 relevant web checks and 48 mobile checks passed; the new browser-disabled snapshots were compared again without updating baselines. Android native module compilation and Android/iOS JS exports passed. These checks use no real ChatGPT account. macOS/Windows packaging/signing, iOS native compilation and live account/game acceptance remain unverified.

The unit audit adds malformed IPC/configuration, disconnect-versus-join races, encrypted-store failure/rotation, ambiguous callbacks, JWT/JWKS validation, stream fragmentation/limits, stale model catalogs, revocation, bot action permissions, evidence policies, rematch reset and background/resume cases. Run `pnpm run test:unit` for all offline suites. `test:chatgpt:coverage` enforces 99% lines/functions and 90% branches across the shared AI engines and desktop controller/store; `test:chatgpt:native:coverage` enforces per-file native adapter thresholds (95% lines/statements, 90% functions/branches). Both coverage commands run in CI. Electron boot/preload behavior remains covered by the separate smoke check; Swift/Kotlin execution and live account authorization are not claimed by these unit metrics.
