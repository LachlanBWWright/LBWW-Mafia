# LBWW Mafia

A multiplayer online mafia/werewolf game implementation.

Production uses a Next.js web app on Vercel and isolated PartyKit game rooms.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for configuration.

## Project Structure

This is a monorepo containing four main components:

- **server/**: Node.js/Express backend with Socket.IO, PartyKit, or Supabase Realtime for real-time gameplay
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

### PartyKit (Default)

Each PartyKit room hosts one isolated game. This is the active production backend and runs on PartyKit's globally distributed room infrastructure.

### Socket.IO compatibility

Socket.IO remains available for local compatibility testing.

### Supabase Realtime

Supabase Realtime is available as a managed channel-based transport that can relay room broadcasts and targeted player callbacks without changing the gameplay contract.

### Switching Backends

The backend is selected via environment variables. No code changes are required to switch between Socket.IO, PartyKit, and Supabase-backed clients.

#### Server-side

```bash
# Socket.IO compatibility
cd server && pnpm run start:socketio

# PartyKit
cd server && pnpm run start:partykit

# Supabase Realtime
cd server && pnpm run start:supabase
```

#### Client-side (NextJS)

```env
# .env.local
NEXT_PUBLIC_SOCKET_BACKEND=partykit   # or "socketio" / "supabase"
NEXT_PUBLIC_SOCKET_URL=http://localhost:1999
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

#### Client-side (Mobile)

```env
EXPO_PUBLIC_SOCKET_BACKEND=partykit   # or "socketio" / "supabase"
EXPO_PUBLIC_SOCKET_URL=http://localhost:1999
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Adding a New Backend

To add a new socket backend:

1. **Server**: Implement the `GameEmitter` interface from `shared/communication/serverTypes.ts` and call `setGameEmitter()` from your entry point.
2. **Client**: Implement the `GameSocket` interface from `shared/communication/clientTypes.ts` and add a case to the `createGameSocket()` factory.
3. **Config**: Add the new backend type to `SocketBackendType` in `shared/communication/clientTypes.ts`.

### Custom PartyKit lobbies

With the PartyKit backend enabled, `POST /lobbies` creates an isolated room with a
validated role-selection configuration. The Next.js proxy is available at
`/api/lobbies`; the lobby builder is at `/lobby/create`.

Role rules support `weight`, `minimum`, `maximum`, and an optional `tier`. The
available algorithms are `weighted-random`, `tier-balanced`, and
`explicit-slots`. Both clients and the API validate role counts, capacity, and uniqueness before
creation. PartyKit retrieves and caches the saved rules before the first join.
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
applies the database schema, and launches the Next.js app and PartyKit game
server. It uses a three-player room and local-only placeholder credentials
by default. Open `http://localhost:3000`.

When dependencies and Postgres are already running, use the focused launcher:

```bash
pnpm run dev:local
```

Stop the foreground process with `Ctrl-C`, then stop Postgres with:

```bash
pnpm run dev:down
```

### Server

```bash
pnpm install
pnpm --dir server run start:socketio  # Socket.IO compatibility mode
pnpm --dir server run start:partykit  # PartyKit mode
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

This requires Docker, the Playwright browsers to be installed.

### Playwright live-server tests

The web end-to-end suite boots a real Postgres database, Next.js server, and
PartyKit game server. It opens several browser windows against the same room
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

Each browser joins the same live game. Stop the environment with `Ctrl-C`, or
run `pnpm run dev:down` to stop Postgres.

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
# Run all tests (from server directory)
pnpm --dir server test
```

## Tech Stack

### Server

- Node.js with Express
- Shared PostgreSQL persistence through the Next.js API
- Socket.IO for real-time communication
- PartyKit for production real-time communication (Cloudflare Workers)
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
- Socket.IO Client / PartyKit Client
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
