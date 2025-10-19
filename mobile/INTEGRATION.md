# Mobile App Integration Guide

This guide explains how the React Native mobile app integrates with the Next.js backend.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  React Native   │ ◄─────► │  Next.js Server  │
│   Mobile App    │  tRPC   │   (Port 3000)    │
└─────────────────┘         └──────────────────┘
         │                            │
         │                            ▼
         │                   ┌─────────────────┐
         │                   │ Prisma Database │
         │                   │    (SQLite)     │
         │                   └─────────────────┘
         │
         │  Socket.IO
         ▼
┌─────────────────┐
│  Socket Server  │
│   (Port 8000)   │
└─────────────────┘
```

## Integration Points

### 1. tRPC API Integration

The mobile app communicates with the Next.js backend using tRPC for type-safe API calls:

**Setup Location:** `/mobile/utils/trpc.tsx`

**Endpoints Used:**
- `api.demo.createDemo` - Create new game sessions
- `api.demo.joinDemo` - Join existing game sessions
- `api.gameSession.getActive` - List all active games
- `api.demo.getUserHistoryDemo` - Get player's game history

**Example Usage:**
```typescript
const createGameMutation = api.demo.createDemo.useMutation({
  onSuccess: (data) => {
    // Navigate to game with room code
    navigation.navigate("GameScreen", {
      lobbyId: data.roomCode,
      title: data.roomCode,
      name: username,
    });
  },
});
```

### 2. Socket.IO Real-Time Communication

For real-time gameplay, the mobile app connects directly to the Socket.IO server:

**Configuration:** `/mobile/config.ts`

**Events:**
- `receive-message` - Chat messages
- `receive-player-list` - Updated player list
- `assign-player-role` - Role assignment
- `update-player-role` - Role updates (deaths, etc.)
- `update-day-time` - Day/night cycle updates
- `block-messages` - Message restrictions

### 3. Authentication Flow

Currently using demo mode (no OAuth):
- Mobile app uses `api.demo.*` endpoints
- Demo endpoints create sessions with a fixed demo user ID
- Future enhancement: Add OAuth support for mobile

### 4. Data Flow

#### Creating a Game:
1. User taps "Create New Game" on HomeScreen
2. Mobile app calls `api.demo.createDemo.useMutation()`
3. Next.js creates a GameSession in the database
4. Returns room code to mobile app
5. Mobile app navigates to GameScreen
6. GameScreen connects to Socket.IO server with room code

#### Joining a Game:
1. User enters room code or selects from active games list
2. Mobile app calls `api.demo.joinDemo.useMutation()`
3. Next.js validates the room and adds player to GameParticipation
4. Returns updated session to mobile app
5. Mobile app navigates to GameScreen
6. GameScreen connects to Socket.IO server

#### Browsing Games:
1. User navigates to PublicGameLobbyScreen
2. Mobile app calls `api.gameSession.getActive.useQuery()`
3. Next.js returns all active games from database
4. Mobile app displays list with player counts

## Configuration

### Environment Variables

Create `/mobile/.env` from `.env.example`:

```bash
EXPO_PUBLIC_API_URL=http://your-server-ip:3000
EXPO_PUBLIC_SOCKET_URL=http://your-server-ip:8000
```

**Important:** 
- Use your computer's local IP address (not localhost) for physical devices
- For emulators, you can use localhost or 10.0.2.2 (Android) / 127.0.0.1 (iOS)

### Backend Configuration

Ensure your Next.js backend has:
1. tRPC endpoints configured (`/nextjs/src/server/api/routers/`)
2. CORS enabled for mobile app origin
3. Prisma database initialized and migrated
4. Socket.IO server running and accessible

## Testing the Integration

### 1. Start Backend Services

```bash
# In /nextjs directory
npm run dev

# In /server directory (for Socket.IO)
npm start
```

### 2. Configure Mobile App

```bash
cd /mobile
cp .env.example .env
# Edit .env with your server URLs
```

### 3. Start Mobile App

```bash
npm install
npm start
```

### 4. Test Functionality

1. **Create Game:** Tap "Create New Game" on home screen
2. **Browse Games:** Tap "Browse Public Games" and verify list loads
3. **Join Game:** Enter a room code and tap "Join"
4. **Real-time Play:** Verify Socket.IO connection in GameScreen

## Troubleshooting

### "Network request failed"
- Verify backend servers are running
- Check firewall settings
- Confirm mobile device can reach server IP
- For iOS simulator, ensure using `http://` not `https://`

### "Failed to create game"
- Check backend logs for errors
- Verify Prisma database is initialized
- Ensure tRPC endpoints are accessible

### Socket.IO connection issues
- Verify Socket.IO server is running on correct port
- Check SOCKET_URL in mobile config
- Confirm no firewall blocking WebSocket connections

### Type errors
- Ensure mobile app's tRPC types match backend
- Run `npm install` to update dependencies
- Check that AppRouter type is correctly imported

## Future Enhancements

- [ ] Add OAuth authentication for mobile (Google, Discord)
- [ ] Implement push notifications for game events
- [ ] Add offline mode with local storage
- [ ] Implement game history caching
- [ ] Add deep linking for room codes
- [ ] Improve error handling and retry logic
