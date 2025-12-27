# MERN Mafia - Online Multiplayer Social Deduction Game

A full-stack implementation of the classic Mafia party game with real-time gameplay, persistent accounts, and comprehensive statistics tracking.

## 🎮 Features

### Game Play
- **Real-time multiplayer** using Socket.IO
- **Classic Mafia roles** (Mafia, Doctor, Investigator, Bodyguard, etc.)
- **Day/Night cycles** with voting and night actions
- **Role-specific abilities** with strategic depth
- **Win conditions** for Town, Mafia, and Neutral factions

### Account System (New! v2.0)
- **Google OAuth authentication** for secure sign-in
- **Match history** with detailed game records
- **Personal statistics** tracking wins, losses, and performance
- **Global leaderboards** with multiple ranking types
- **User profiles** with customizable display names
- **Preferences management** for sound, notifications, and themes

### Cross-Platform
- **Web Application** (Next.js 15) - Full-featured desktop experience
- **Mobile App** (React Native/Expo) - Play on iOS and Android with guest mode

## 🏗️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React Native/Expo** - Mobile application
- **TypeScript** - Type safety throughout
- **Bootstrap & Tailwind** - Responsive UI components
- **React Query** - State management and caching

### Backend
- **tRPC** - End-to-end type-safe APIs
- **NextAuth v4** - Authentication with OAuth providers
- **Prisma** - Type-safe database ORM
- **Socket.IO** - Real-time game communication
- **Zod** - Runtime validation

### Database
- **SQLite** (development) / **PostgreSQL** (production)
- Unified schema across all services
- Migration support with Prisma

## 📂 Project Structure

```
/MERN-Mafia
├── nextjs/              # Next.js web application
│   ├── src/app/         # App router pages
│   ├── src/server/api/  # tRPC API routes
│   └── prisma/          # (Deprecated - moved to packages)
├── server/              # Socket.IO game server
│   └── src/             # Game logic and socket handlers
├── mobile/              # React Native mobile app
│   ├── screens/         # App screens
│   ├── contexts/        # Auth and state management
│   └── utils/           # tRPC client setup
├── packages/            # Shared packages
│   └── database/        # Unified Prisma schema
│       ├── prisma/      # Schema and migrations
│       └── src/         # Prisma client exports
└── shared/              # Shared utilities and types
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/LachlanBWWright/MERN-Mafia.git
cd MERN-Mafia

# Install database package
cd packages/database
npm install
npx prisma generate
cd ../..

# Install Next.js
cd nextjs
npm install
cd ..

# Install server
cd server
npm install
cd ..

# Install mobile (optional)
cd mobile
npm install
cd ..
```

### 2. Setup Environment Variables

**Next.js** `.env`:
```env
DATABASE_URL="file:./db.sqlite"
AUTH_SECRET="your-secret-key"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

Generate AUTH_SECRET:
```bash
cd nextjs
npx auth secret
```

### 3. Initialize Database

```bash
cd packages/database
npx prisma migrate dev
```

### 4. Start Development Servers

```bash
# Terminal 1: Next.js (port 3000)
cd nextjs
npm run dev

# Terminal 2: Socket.IO Server (port 8000)
cd server
npm start

# Terminal 3: Mobile App (optional)
cd mobile
npm start
```

### 5. Access the Application

- **Web:** http://localhost:3000
- **Mobile:** Scan QR code with Expo Go app

## 🔐 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
6. Copy credentials to `.env` file

## 📖 Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Detailed setup instructions
- **[Implementation Guide](./ACCOUNT_SYSTEM_IMPLEMENTATION.md)** - Technical architecture
- **[Account System Plan](./ACCOUNT_SYSTEM_PLAN.md)** - Original design document

## 🎯 Key Pages

### Web Application
- `/` - Home and game lobby
- `/auth/signin` - Sign in with Google
- `/account` - Account dashboard
- `/account/profile` - Edit profile
- `/account/settings` - Manage preferences
- `/history` - Match history
- `/history/[id]` - Match details
- `/leaderboard` - Global rankings
- `/stats` - Personal statistics
- `/roles` - Role descriptions
- `/room/[code]` - Game room (real-time play)

### API Endpoints (tRPC)

**Authentication:**
- `api.auth.getSession()` - Get current session
- `api.auth.logout()` - Sign out
- `api.auth.deleteAccount()` - Delete account

**User Management:**
- `api.user.getProfile()` - Get user profile
- `api.user.updateProfile()` - Update name/display name
- `api.user.getPreferences()` - Get settings
- `api.user.updatePreferences()` - Update settings

**Match History:**
- `api.match.getHistory()` - Paginated history
- `api.match.getMatchDetails()` - Game details

**Statistics:**
- `api.stats.getPersonalStats()` - Personal stats
- `api.stats.getLeaderboard()` - Rankings
- `api.stats.getRoleStats()` - Role performance

## 🧪 Testing

### Backend Tests
```bash
cd server
npm test
```

**Test Coverage:**
- 44 comprehensive unit tests
- Game mechanics simulation
- Role interactions
- Win conditions
- Edge cases

### Manual Testing
See [Quick Start Guide](./QUICK_START.md) for testing checklist.

## 🎨 Screenshots

### Web Application
- Sign In Page with Google OAuth
- Account Dashboard with Statistics
- Match History with Infinite Scroll
- Leaderboard with Multiple Views
- Game Room with Real-time Updates

### Mobile Application
- Guest Mode Landing
- Account Screen with Feature Preview
- Navigation with Auth State

## 🔄 Development Workflow

### Database Changes
```bash
cd packages/database
# Edit prisma/schema.prisma
npx prisma migrate dev --name your_migration_name
npx prisma generate
```

### Adding New API Endpoints
1. Create/update router in `nextjs/src/server/api/routers/`
2. Add to `nextjs/src/server/api/root.ts`
3. Use in components via `api.yourRouter.yourProcedure.useQuery()`

### Adding New Pages
1. Create in `nextjs/src/app/your-page/page.tsx`
2. Add navigation link if needed
3. Implement with tRPC for data fetching

## 🐛 Troubleshooting

**Database Connection Issues:**
```bash
cd packages/database
npx prisma generate
npx prisma migrate dev
```

**OAuth Errors:**
- Verify Google Cloud Console configuration
- Check redirect URIs match exactly
- Ensure AUTH_SECRET is set

**Mobile Can't Connect:**
- Use local IP address, not localhost
- Check firewall settings
- Verify backend is running

## 📊 Game Features

### Roles
- **Town Roles:** Doctor, Investigator, Bodyguard
- **Mafia Roles:** Mafia members
- **Neutral Roles:** Independent players

### Mechanics
- Day phase voting with majority requirement
- Night phase with role-specific actions
- Real-time chat and player communication
- Automatic win condition detection

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with Next.js, React, and Socket.IO
- Authentication via NextAuth.js
- Database powered by Prisma
- Styled with Bootstrap and Tailwind CSS
- Mobile app with React Native and Expo

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Version:** 2.0.0 - Account System Update  
**Last Updated:** December 27, 2025
