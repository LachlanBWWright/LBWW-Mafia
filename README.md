# LBWW Mafia

A multiplayer online mafia/werewolf game implementation.

Playable at: https://lbww-mafia.herokuapp.com/

## Project Structure

This is a monorepo containing three main components:

- **server/**: Node.js/Express backend with Socket.IO for real-time gameplay
- **nextjs/**: Next.js web application using the T3 Stack
- **mobile/**: React Native mobile application using Expo

## Shared Resources

- **db/**: Shared Drizzle ORM schema used by server and nextjs components

## Development

### Server

```bash
cd server
npm install
npm start
```

### Next.js Web App

```bash
cd nextjs
npm install  # or pnpm install
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

## Tech Stack

### Server

- Node.js with Express
- MongoDB with Mongoose
- Socket.IO for real-time communication
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
- Socket.IO Client
- TypeScript

## Code Quality

- All components use TypeScript with strict type checking
- ESLint configured for code quality
- No exceptions used - result types preferred
- Zod schemas used with safeParse for validation
