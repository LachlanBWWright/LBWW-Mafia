# LBWW Mafia

A multiplayer online mafia/werewolf game implementation.

Playable at: https://lbww-mafia.herokuapp.com/

## Project Structure

This is a monorepo containing three main components:

- **server/**: Node.js/Express backend with Socket.IO or PartyKit for real-time gameplay
- **nextjs/**: Next.js web application using the T3 Stack
- **mobile/**: React Native mobile application using Expo
- **shared/**: Shared game logic, types, and communication abstractions

## Shared Resources

- **db/**: Shared Drizzle ORM schema used by server and nextjs components
- **shared/communication/**: Backend-agnostic socket communication interfaces and adapters

## Socket Backend Architecture

The application supports two real-time communication backends:

### Socket.IO (Default)

A single Socket.IO server hosts multiple game rooms. This is the traditional approach using Express + Socket.IO.

### PartyKit

Each PartyKit party instance hosts a single game room/match. PartyKit runs on Cloudflare Workers for global low-latency deployment.

### Switching Backends

The backend is selected via environment variables. No code changes are required to switch between Socket.IO and PartyKit.

#### Server-side

```bash
# Socket.IO (default)
cd server && npm run start:socketio

# PartyKit
cd server && npm run start:partykit
```

#### Client-side (NextJS)

```env
# .env.local
NEXT_PUBLIC_SOCKET_BACKEND=socketio   # or "partykit"
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
NEXT_PUBLIC_PARTYKIT_ROOM=default     # only needed for partykit
```

#### Client-side (Mobile)

```env
EXPO_PUBLIC_SOCKET_BACKEND=socketio   # or "partykit"
EXPO_PUBLIC_SOCKET_URL=http://localhost:8000
EXPO_PUBLIC_PARTYKIT_ROOM=default     # only needed for partykit
```

### Adding a New Backend

To add a new socket backend:

1. **Server**: Implement the `GameEmitter` interface from `shared/communication/serverTypes.ts` and call `setGameEmitter()` from your entry point.
2. **Client**: Implement the `GameSocket` interface from `shared/communication/clientTypes.ts` and add a case to the `createGameSocket()` factory.
3. **Config**: Add the new backend type to `SocketBackendType` in `shared/communication/clientTypes.ts`.

## Development

### Server

```bash
cd server
npm install
npm start          # Socket.IO mode (default)
npm run start:partykit  # PartyKit mode
```

### Next.js Web App

```bash
cd nextjs
npm install
npm run dev
```

### Mobile App

```bash
cd mobile
npm install
npm start
```

## Linting

All three components have ESLint configured:

```bash
# Server
cd server && npm run lint

# Next.js
cd nextjs && npm run lint

# Mobile
cd mobile && npm run lint
```

## Testing

```bash
# Run all tests (from server directory)
cd server && npm test
```

## Tech Stack

### Server

- Node.js with Express
- MongoDB with Mongoose
- Socket.IO for real-time communication
- PartyKit for alternative real-time communication (Cloudflare Workers)
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
