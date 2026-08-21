# LBWW Mafia

A multiplayer online mafia/werewolf game implementation.

Playable at: https://lbww-mafia.herokuapp.com/

## Project Structure

This is a monorepo containing three main components:

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

### Socket.IO (Default)

A single Socket.IO server hosts multiple game rooms. This is the traditional approach using Express + Socket.IO.

### PartyKit

Each PartyKit party instance hosts a single game room/match. PartyKit runs on Cloudflare Workers for global low-latency deployment.

### Supabase Realtime

Supabase Realtime is available as a managed channel-based transport that can relay room broadcasts and targeted player callbacks without changing the gameplay contract.

### Switching Backends

The backend is selected via environment variables. No code changes are required to switch between Socket.IO, PartyKit, and Supabase-backed clients.

#### Server-side

```bash
# Socket.IO (default)
cd server && pnpm run start:socketio

# PartyKit
cd server && pnpm run start:partykit

# Supabase Realtime
cd server && pnpm run start:supabase
```

#### Client-side (NextJS)

```env
# .env.local
NEXT_PUBLIC_SOCKET_BACKEND=socketio   # or "partykit" / "supabase"
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

#### Client-side (Mobile)

```env
EXPO_PUBLIC_SOCKET_BACKEND=socketio   # or "partykit" / "supabase"
EXPO_PUBLIC_SOCKET_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Adding a New Backend

To add a new socket backend:

1. **Server**: Implement the `GameEmitter` interface from `shared/communication/serverTypes.ts` and call `setGameEmitter()` from your entry point.
2. **Client**: Implement the `GameSocket` interface from `shared/communication/clientTypes.ts` and add a case to the `createGameSocket()` factory.
3. **Config**: Add the new backend type to `SocketBackendType` in `shared/communication/clientTypes.ts`.

## Development

Production deployment instructions are in [DEPLOYMENT.md](./DEPLOYMENT.md).

### One-command local web game

From the repository root:

```bash
bash dev.sh
```

This installs the locked dependencies, starts the local Postgres container,
applies the database schema, and launches the Next.js app and Rust WebSocket
game server. It uses a three-player room and local-only placeholder credentials
by default. Open `http://localhost:3000`.

Stop the foreground process with `Ctrl-C`, then stop Postgres with:

```bash
pnpm run dev:down
```

### Server

```bash
pnpm install
pnpm --dir server run start:socketio  # Socket.IO mode (default)
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
- MongoDB with Mongoose
- Socket.IO for real-time communication
- PartyKit for alternative real-time communication (Cloudflare Workers)
- Supabase Realtime for managed channel-based transport
- TypeScript

### Next.js

- Next.js 15
- Drizzle ORM with SQLite
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
- No exceptions used - result types preferred
- Zod schemas used with safeParse for validation
