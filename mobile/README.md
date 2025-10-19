# MERN Mafia Mobile App

React Native mobile app for MERN Mafia game.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your backend server URLs:
```
EXPO_PUBLIC_API_URL=http://your-nextjs-server:3000
EXPO_PUBLIC_SOCKET_URL=http://your-socketio-server:8000
```

## Running the App

### Start the development server:
```bash
npm start
```

### Run on Android:
```bash
npm run android
```

### Run on iOS:
```bash
npm run ios
```

## Features

### Authentication
- The mobile app connects to the Next.js backend for game session management
- Username-based gameplay (OAuth integration can be added in future updates)

### Game Features
- **Create New Game**: Create a new game session with a unique room code
- **Browse Public Games**: View all active game sessions
- **Join Games**: Join existing games by room code
- **Real-time Gameplay**: Socket.IO integration for real-time game updates

### API Integration
The mobile app uses tRPC to communicate with the Next.js backend:
- `gameSession.create` - Create new game sessions
- `gameSession.getActive` - List all active games
- `gameSession.join` - Join existing games
- `gameSession.get` - Get game session details

### Architecture
- **React Navigation**: For screen navigation
- **tRPC + React Query**: Type-safe API calls with caching
- **Socket.IO Client**: Real-time game communication
- **TypeScript**: Full type safety across the app

## Configuration

### Backend URLs
Update `config.ts` or use environment variables to set:
- `EXPO_PUBLIC_API_URL`: Next.js backend API endpoint
- `EXPO_PUBLIC_SOCKET_URL`: Socket.IO server endpoint

### Development
For local development, make sure your backend servers are running:
- Next.js: `npm run dev` in the `/nextjs` directory
- Socket.IO: Run your Socket.IO server on port 8000

## Notes

- The app requires a running Next.js backend with tRPC endpoints
- Socket.IO server must be accessible for real-time gameplay
- Network connectivity is required for all features
