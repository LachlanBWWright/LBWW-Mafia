# LBWW Mafia

A multiplayer online mafia/werewolf game implementation.

Production uses a Next.js web app on Vercel and isolated PartyServer game rooms.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for configuration.

## Project Structure

This is a monorepo containing four main components:

- **server/**: Node.js/Express backend with Socket.IO, PartyServer, or Supabase Realtime for real-time gameplay
- **nextjs/**: Next.js web application using the T3 Stack
- **mobile/**: React Native mobile application using Expo
- **shared/**: Shared game logic, types, and communication abstractions

The historical Create React App implementation remains under `client/` for reference, but is not
part of the active workspace or deployment. The supported web application is `nextjs/`.

## Shared Resources

- **db/**: Shared Drizzle ORM schema used by server and nextjs components
- **shared/communication/**: Backend-agnostic socket communication interfaces and adapters

## Socket Backend Architecture

The application supports multiple real-time communication backends:

### PartyServer (Default)

Each PartyServer room hosts one isolated game in a Cloudflare Durable Object deployed to your Cloudflare account with Wrangler. The root `wrangler.jsonc` binds `Main` and preserves the `/parties/main/:room` protocol. Active games remain in memory with hibernation disabled; a Worker replacement can end a game. Completed-history upload retries retain their durable outbox.

### Socket.IO compatibility

Socket.IO remains available for local compatibility testing.

### Supabase Realtime

Supabase Realtime is available as a managed channel-based transport that can relay room broadcasts and targeted player callbacks without changing the gameplay contract.

### Switching Backends

The backend is selected via environment variables. No code changes are required to switch between Socket.IO, PartyServer, and Supabase-backed clients.

#### Server-side

```bash
# Socket.IO compatibility
cd server && pnpm run start:socketio

# PartyServer
cd server && pnpm run start:partyserver

# Supabase Realtime
cd server && pnpm run start:supabase
```

#### Client-side (NextJS)

```env
# .env.local
NEXT_PUBLIC_SOCKET_BACKEND=partyserver   # or "socketio" / "supabase"
NEXT_PUBLIC_SOCKET_URL=http://localhost:1999
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

#### Client-side (Mobile)

```env
EXPO_PUBLIC_SOCKET_BACKEND=partyserver   # or "socketio" / "supabase"
EXPO_PUBLIC_SOCKET_URL=http://localhost:1999
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Adding a New Backend

To add a new socket backend:

1. **Server**: Implement the `GameEmitter` interface from `shared/communication/serverTypes.ts` and call `setGameEmitter()` from your entry point.
2. **Client**: Implement the `GameSocket` interface from `shared/communication/clientTypes.ts` and add a case to the `createGameSocket()` factory.
3. **Config**: Add the new backend type to `SocketBackendType` in `shared/communication/clientTypes.ts`.

### Custom PartyServer lobbies

With the PartyServer backend enabled, `POST /lobbies` creates an isolated room with a
validated role-selection configuration. The Next.js proxy is available at
`/api/lobbies`; the lobby builder is at `/lobby/create`.

Role rules support `weight`, `minimum`, `maximum`, and an optional `tier`. The
available algorithms are `weighted-random`, `tier-balanced`, and
`explicit-slots`. Both clients and the API validate role counts, capacity, and uniqueness before
creation. PartyServer retrieves and caches the saved rules before the first join.
The weighted algorithm honors role weights and count bounds; tier balancing
fills the least-represented available tier before applying weights within it.
Role IDs use engine identifiers, including `mafia-investigator` and `mafia-roleblocker`.

## Development

Use Node.js 24+ and the pnpm version declared in the root `package.json`.

Production deployment instructions are in [DEPLOYMENT.md](./DEPLOYMENT.md).

### One-command local web game

From the repository root:

```bash
bash dev.sh
```

This installs the locked dependencies, starts the local Postgres container,
waits for it to be healthy, applies database migrations, and launches Next.js
and PartyServer. It uses a three-player room by default. Open
`http://localhost:3000`.

When dependencies are already installed, use the same launcher without the
installation step. It also starts and prepares the database:

```bash
pnpm run dev:local
```

Local development can start without Google OAuth credentials; Google sign-in
requires `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `nextjs/.env.local`.
Production builds require both credentials. The local PartyServer port is fixed at
1999 so it matches the client URL; set `PARTYSERVER_PORT` to use another port.
`WEB_PORT` and `POSTGRES_PORT` override the default web and database ports.
The launcher refuses occupied web/game ports instead of silently choosing a
different port. Its database URLs override any Neon URLs in `.env.local` so
the web app, notifications, and migrations use the same local database.

Closing the terminal, pressing `Ctrl-C`, or any app service exiting stops
Next.js, PartyServer, and PostgreSQL. Database contents remain in the named volume
for the next run. To stop a database left over from an older launcher:

```bash
pnpm run dev:down
```

### Server

```bash
pnpm install
pnpm --dir server run start:socketio  # Socket.IO compatibility mode
pnpm --dir server run start:partyserver  # PartyServer mode
pnpm --dir server run start:supabase  # Supabase Realtime mode
```

### Next.js Web App

```bash
pnpm install
pnpm --dir nextjs run dev
```

### Mobile App

```bash
pnpm install
pnpm --dir mobile run start
```

### Storybook and screenshot coverage

Story files stay in their feature/UI story directories. Screenshot runners are
kept separately from those stories and cover every web story at small-phone,
phone, tablet, and desktop viewports. The mobile Storybook catalog is exported
and captured at small-phone, phone, and tablet sizes.

```bash
pnpm run storybook                 # open the Next.js Storybook
pnpm run storybook:mobile          # open the React Native Storybook in Expo
pnpm run storybook:screenshots     # capture both Storybook catalogs
pnpm run screenshots:mobile        # capture the mobile app screen gallery
```

To run the complete local quality gate—including lint, typechecks, gameplay
tests, unit tests, Storybook screenshots, visual screens, live Chromium E2E,
and Firefox/WebKit smoke tests:

```bash
pnpm run test:all
```

This requires Docker and the Playwright browsers to be installed. Worker runtime tests run locally without Cloudflare credentials:

```bash
pnpm --dir server run test:worker
pnpm --dir server run build:partyserver
```

### Playwright live-server tests

The web end-to-end suite boots a real Postgres database, Next.js server, and
PartyServer game server. It opens several browser windows against the same room
to verify joins, synchronized chat, targeted whispers, voting, and disconnects.

```bash
pnpm run test:e2e
```

For manual multiplayer testing in several browsers, run:

```bash
pnpm run test:manual
```

Then open the same room URL in separate browser windows or private sessions:

```text
http://localhost:3000/lobby?room=manual-game-1
```

Each browser joins the same live game. Close the terminal or press `Ctrl-C` to
stop the web app, PartyServer, and PostgreSQL together.

Web Storybook screenshots are written to `nextjs/storybook-screenshots/` and
mobile Storybook screenshots are written to `mobile/visual/storybook-screenshots/`.

## Linting

All three components have ESLint configured:

```bash
# Server
pnpm --dir server run lint

# Next.js
pnpm --dir nextjs run lint

# Mobile
pnpm --dir mobile run lint
```

## Testing

```bash
# Run the offline ChatGPT, Electron, game server, web and mobile unit suites
pnpm run test:unit

# Enforce shared AI/desktop coverage and native adapter coverage
pnpm run test:chatgpt:coverage
pnpm run test:chatgpt:native:coverage
```

The AI/desktop coverage check includes the portable OAuth runtime, stream parser,
decision policy, character decisions, bot runner, desktop controller and encrypted
store. Native coverage checks the TypeScript authorization adapter, React Native
service and shared IPC client, with per-file thresholds. Both checks run in CI.
These tests use isolated stores, signed test identities and simulated transports;
they do not authorize a real ChatGPT account or spend plan usage. Native OS module
and live account acceptance remain separate from unit coverage.

## Tech Stack

### Server

- Node.js with Express
- Shared PostgreSQL persistence through the Next.js API
- Socket.IO for real-time communication
- PartyServer on Cloudflare Workers and Durable Objects, deployed with Wrangler
- Supabase Realtime for managed channel-based transport
- TypeScript

### Next.js

- Next.js 16
- Drizzle ORM with PostgreSQL
- NextAuth.js for authentication
- Tailwind CSS
- TypeScript

### Mobile

- React Native
- Expo
- Shared WebSocket PartyServer adapter / Socket.IO client
- TypeScript

## Code Quality

- All components use TypeScript with strict type checking
- ESLint configured for code quality
- Shared Zod validation and typed game events across clients
- Zod schemas used with safeParse for validation

## Application integration tests

Run against a dedicated PostgreSQL database with the normal auth/backend environment variables:

```bash
pnpm --dir nextjs run db:migrate
pnpm --dir nextjs run test:integration
```

These tests exercise friendships, blocked and suspended accounts, message permissions,
read markers, pagination, delivery between separate database connections, and lobby APIs.
They insert isolated test accounts and remove them afterward.

For E2E tests with an existing database, set `PLAYWRIGHT_EXTERNAL_DB=true` and
`DATABASE_URL`; the launcher applies migrations and skips Docker startup.

See [RELIABILITY.md](./RELIABILITY.md) for reconnect behavior, messaging transports,
native testing boundaries, and operational requirements.

See [MATCH_EXPERIENCE.md](./MATCH_EXPERIENCE.md) for the shared web/mobile match
flow, local practice scenario, action and vote privacy, rematches, and native
verification requirements. The [AI runtime guide](./tools/ai-bots/README.md)
explains optional ChatGPT-powered characters, context modes, and character profiles.

ChatGPT AI characters are available in the Electron desktop and installed React Native apps. Subscription sign-in, protected credentials, inference and bot sockets run inside those apps; no separate companion or API key is needed. The Next.js browser client disables AI setup with an explanation. See [desktop setup](desktop/README.md) and [ChatGPT runtime](tools/ai-bots/README.md).
