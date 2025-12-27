# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-27

### Added - Account System

#### Database
- Unified Prisma schema in `packages/database`
- UserPreferences model for user settings
- UserStats model for cached statistics
- Enhanced User model with displayName field
- Enhanced GameParticipation with isWinner field
- Database migrations and seed data
- PostgreSQL and SQLite support

#### Authentication
- Google OAuth integration via NextAuth v4
- JWT-based sessions for cross-platform support
- Protected and public tRPC procedures
- Auth state management for web and mobile
- Guest mode for mobile app

#### API Endpoints (tRPC)
- **Auth Router**: Session management, logout, account deletion
- **User Router**: Profile management, preferences, public profiles
- **Match Router**: Paginated history, match details, match summaries
- **Stats Router**: Personal stats, leaderboards, role-specific stats
- 15+ fully typed and validated endpoints

#### Web Pages (Next.js)
- `/auth/signin` - Google OAuth sign-in page
- `/auth/error` - Authentication error handling
- `/account` - Account dashboard with quick stats
- `/account/profile` - Profile editing
- `/account/settings` - Preferences and account management
- `/history` - Match history with infinite scroll
- `/history/[matchId]` - Detailed match view
- `/leaderboard` - Global rankings with filters
- Updated `/stats` - Personal statistics with auth

#### Mobile App
- AuthContext for authentication state
- SignInScreen with guest mode
- AccountScreen with feature previews
- Updated dependencies for auth support
- tRPC integration ready for production

#### Developer Experience
- One-command setup script (`setup.sh`)
- Database reset script (`reset-db.sh`)
- Seed script with demo users and games
- Docker Compose for containerized development
- GitHub Actions CI/CD pipeline
- Contributing guidelines
- Deployment guide
- Comprehensive documentation

#### Documentation
- `README.md` - Project overview and setup
- `QUICK_START.md` - Quick setup guide
- `ACCOUNT_SYSTEM_IMPLEMENTATION.md` - Technical details
- `CONTRIBUTING.md` - Contribution guidelines
- `DEPLOYMENT.md` - Production deployment guide
- `.env.example` - Environment variable template

### Changed
- Navigation now includes auth dropdown with user avatar
- Stats page shows authenticated user statistics
- Database package is now shared between Next.js and server
- Improved error handling across all pages
- Enhanced type safety with tRPC and Zod

### Technical Details
- TypeScript throughout
- Prisma ORM for database
- tRPC for type-safe APIs
- Zod for runtime validation
- NextAuth v4 for authentication
- React Query for state management
- 44 backend unit tests passing

### Migration Guide
1. Run `./setup.sh` for automatic setup
2. Or manually:
   - Install database package dependencies
   - Run `npx prisma migrate dev`
   - Update environment variables
   - Restart development servers

## [1.0.0] - Previous Version

### Features
- Real-time multiplayer Mafia game
- Socket.IO for game communication
- Classic Mafia roles and mechanics
- Day/Night cycle gameplay
- Role-based abilities
- Win condition detection
- React Native mobile app
- Next.js web application

---

## Versioning Strategy

- **Major version (X.0.0)**: Breaking changes, major features
- **Minor version (0.X.0)**: New features, backwards compatible
- **Patch version (0.0.X)**: Bug fixes, small improvements

## Release Process

1. Update CHANGELOG.md
2. Update version in package.json files
3. Create git tag
4. Push to GitHub
5. Deploy to production
6. Announce release

## Support

- Current version: 2.0.0
- LTS version: 2.0.x
- Maintenance: Active

For older versions, see [Releases](https://github.com/LachlanBWWright/MERN-Mafia/releases).
