# Account System - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Google Cloud Console project (for OAuth)

### 1. Database Setup

```bash
cd packages/database
npm install
npx prisma generate
npx prisma migrate dev
```

### 2. Configure Environment Variables

#### Next.js `.env`
```env
# Database
DATABASE_URL="file:./db.sqlite"

# NextAuth (Generate secret with: npx auth secret)
AUTH_SECRET="your-super-secret-key-here"

# Google OAuth
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

#### Mobile `.env`
```env
EXPO_PUBLIC_API_URL="http://your-computer-ip:3000"
EXPO_PUBLIC_SOCKET_URL="http://your-computer-ip:8000"
```

### 3. Start Development Servers

```bash
# Terminal 1: Next.js
cd nextjs
npm install
npm run dev

# Terminal 2: Socket Server (if separate)
cd server
npm install
npm start

# Terminal 3: Mobile App
cd mobile
npm install
npm start
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google` (production)
6. Copy Client ID and Client Secret to `.env`

## ✨ Features Available

### Web Application
- ✅ Sign in with Google
- ✅ Account dashboard
- ✅ Profile editing
- ✅ Match history with pagination
- ✅ Leaderboard (wins, games, win rate)
- ✅ Settings management
- ✅ Account deletion

### Mobile Application
- ✅ Guest mode (play without account)
- ✅ Sign in placeholder (coming soon)
- ✅ Account screen with feature previews
- ✅ Navigation to settings

## 📊 API Endpoints Available

All endpoints are accessible via tRPC:

### Authentication
- `api.auth.getSession()`
- `api.auth.logout()`
- `api.auth.deleteAccount()`

### User Management
- `api.user.getProfile()`
- `api.user.updateProfile({ name, displayName })`
- `api.user.getPreferences()`
- `api.user.updatePreferences({ soundEnabled, notificationsEnabled, theme })`

### Match History
- `api.match.getHistory({ limit, cursor, filter })`
- `api.match.getMatchDetails({ gameSessionId })`

### Statistics
- `api.stats.getPersonalStats()`
- `api.stats.getLeaderboard({ type, limit })`
- `api.stats.getRoleStats({ role })`

## 🧪 Testing

### Manual Testing Checklist

**Web:**
1. Navigate to `/auth/signin`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Navigate to `/account` - should see dashboard
5. Edit profile at `/account/profile`
6. View settings at `/account/settings`
7. Check `/history` - should see empty state or matches
8. Visit `/leaderboard` - should load (may be empty)
9. Sign out from dropdown menu

**Mobile:**
1. Open app - should show SignInScreen
2. Tap "Continue as Guest"
3. Navigate through app
4. Open AccountScreen - should show guest mode
5. Note locked features
6. Sign out/exit guest mode

## 🐛 Troubleshooting

### "prisma is not a recognized command"
```bash
cd packages/database
npm install
```

### "AUTH_SECRET is not defined"
```bash
npx auth secret
# Copy the generated secret to your .env file
```

### "Failed to fetch" errors in browser
- Check that Next.js dev server is running on port 3000
- Verify DATABASE_URL is correct
- Run `npx prisma generate` in packages/database

### Mobile app can't connect
- Use your computer's local IP, not localhost
- Ensure firewall allows connections on ports 3000 and 8000
- For iOS simulator, try `http://localhost:3000`
- For Android emulator, try `http://10.0.2.2:3000`

## 📝 Next Steps

1. **Add real Google OAuth credentials** to enable sign-in
2. **Test match creation** and verify it creates GameSession records
3. **Play a complete game** and check if stats are updated
4. **Customize styling** to match your brand
5. **Deploy** to production (Vercel, Railway, etc.)

## 🔗 Useful Links

- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js](https://next-auth.js.org)
- [tRPC](https://trpc.io)
- [Google OAuth Setup Guide](https://support.google.com/cloud/answer/6158849)

---

For detailed implementation notes, see `ACCOUNT_SYSTEM_IMPLEMENTATION.md`
