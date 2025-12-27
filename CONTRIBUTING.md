# Contributing to MERN Mafia

Thank you for your interest in contributing to MERN Mafia! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- Git
- Basic knowledge of TypeScript, React, and Node.js

### Development Setup
1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/MERN-Mafia.git
   cd MERN-Mafia
   ```

3. Install dependencies:
   ```bash
   # Database
   cd packages/database
   npm install
   npx prisma generate
   
   # Next.js
   cd ../../nextjs
   npm install
   
   # Server
   cd ../server
   npm install
   
   # Mobile (optional)
   cd ../mobile
   npm install
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

5. Initialize database:
   ```bash
   ./reset-db.sh
   ```

6. Start development servers:
   ```bash
   # Terminal 1: Next.js
   cd nextjs && npm run dev
   
   # Terminal 2: Socket.IO Server
   cd server && npm start
   ```

## 📝 Development Workflow

### Branch Naming
- `feature/your-feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages
Follow conventional commits:
- `feat: add user profile page`
- `fix: resolve authentication bug`
- `docs: update README with setup instructions`
- `refactor: improve database query performance`
- `test: add tests for match history`

### Code Style
- Use TypeScript for all new code
- Follow existing code formatting (Prettier + ESLint)
- Add comments for complex logic
- Write self-documenting code with clear variable names

### Testing
- Write tests for new features
- Ensure all existing tests pass:
  ```bash
  cd server
  npm test
  ```
- Test manually on both web and mobile when applicable

## 🏗️ Project Structure

### Key Directories
- `/nextjs` - Next.js web application
  - `/src/app` - App router pages
  - `/src/server/api` - tRPC API routes
  - `/src/components` - Reusable React components

- `/server` - Socket.IO game server
  - `/src` - Game logic and real-time handlers
  - `/tests` - Backend unit tests

- `/mobile` - React Native mobile app
  - `/screens` - Mobile screens
  - `/contexts` - State management

- `/packages/database` - Shared Prisma schema
  - `/prisma` - Schema and migrations

### Adding New Features

#### Web Pages
1. Create page in `/nextjs/src/app/your-page/page.tsx`
2. Use tRPC hooks for data fetching
3. Follow existing styling patterns
4. Update navigation if needed

#### API Endpoints
1. Add to relevant router in `/nextjs/src/server/api/routers/`
2. Use Zod for input validation
3. Add to router index in `/nextjs/src/server/api/root.ts`
4. Test with tRPC client

#### Database Changes
1. Edit `/packages/database/prisma/schema.prisma`
2. Create migration:
   ```bash
   cd packages/database
   npx prisma migrate dev --name your_migration_name
   ```
3. Regenerate client:
   ```bash
   npx prisma generate
   ```

#### Mobile Screens
1. Create screen in `/mobile/screens/`
2. Add to navigation in `App.tsx`
3. Use tRPC hooks for API calls
4. Test on both iOS and Android simulators

## 🧪 Testing Guidelines

### Unit Tests
- Located in `/server/tests/`
- Use Vitest framework
- Mock external dependencies when appropriate
- Aim for high coverage on game logic

### Integration Tests
- Test API endpoints end-to-end
- Verify database operations
- Test authentication flows

### Manual Testing
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test responsive design on different screen sizes
- Test mobile app on iOS and Android
- Verify real-time game mechanics work correctly

## 📦 Pull Request Process

1. **Create a feature branch** from `develop`

2. **Make your changes** with clear, focused commits

3. **Update documentation** if needed (README, code comments)

4. **Add tests** for new functionality

5. **Run checks locally:**
   ```bash
   # Linting
   cd nextjs && npm run lint
   
   # Type checking
   npm run typecheck
   
   # Tests
   cd ../server && npm test
   ```

6. **Push to your fork** and create a pull request

7. **Fill out the PR template** with:
   - Description of changes
   - Related issue numbers
   - Screenshots (for UI changes)
   - Testing checklist

8. **Respond to feedback** from maintainers

9. **Squash commits** if requested before merge

## 🐛 Reporting Bugs

Use the bug report template and include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or error logs
- Environment details (OS, browser, device)

## 💡 Feature Requests

Use the feature request template and include:
- Problem statement
- Proposed solution
- Use cases
- Priority level
- Platform affected (web/mobile/both)

## 📋 Code Review Checklist

Before submitting, verify:
- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] No console errors or warnings
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions
- [ ] PR description is complete
- [ ] Screenshots included for UI changes
- [ ] Database migrations tested
- [ ] Works on both web and mobile (if applicable)

## 🌟 Areas for Contribution

### High Priority
- Additional OAuth providers (Discord, GitHub)
- Mobile app full OAuth implementation
- Achievement system
- Tournament bracket system

### Medium Priority
- Role-specific leaderboards
- Advanced match filters
- Friend system
- Social sharing features

### Nice to Have
- Match replay/analysis
- Custom game modes
- In-game chat improvements
- Accessibility improvements

## 📞 Getting Help

- Open an issue for bugs or questions
- Join discussions in GitHub Discussions
- Check existing issues and PRs first

## 🙏 Thank You!

Your contributions make MERN Mafia better for everyone. We appreciate your time and effort!

## 📄 License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
