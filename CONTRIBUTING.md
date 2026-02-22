# Contributing to LBWW Mafia

Thank you for your interest in contributing to LBWW Mafia!

## Development Guidelines

### Code Quality Standards

- **No Exceptions**: Use result types instead of throwing exceptions
- **Zod Validation**: Always use `safeParse()` instead of `parse()` for validation
- **Type Safety**: Avoid using `any` types; use proper TypeScript types
- **Linting**: All code must pass ESLint without errors before committing

### Before Committing

Run the linters for all components you've modified:

```bash
# Server
cd server && npm run lint

# Next.js
cd nextjs && npm run lint

# Mobile
cd mobile && npm run lint
```

Fix all errors and address warnings where practical.

### Code Style

- Use `===` instead of `==` for equality checks
- Prefix intentionally unused parameters with underscore (`_param`)
- Extract React components outside of render methods
- Use StyleSheet for React Native styles instead of inline styles
- Include proper TypeScript types for all functions and variables

### Component-Specific Guidelines

#### Server
- Use proper type imports for Role and Player types
- Handle errors with console.error and appropriate fallbacks
- Use result types for operations that may fail

#### Next.js
- Follow T3 Stack conventions
- Use Drizzle ORM for database operations
- Leverage tRPC for type-safe APIs
- Use the shared `/db` schema

#### Mobile
- Use Expo conventions
- Extract common styles to shared StyleSheet modules
- Handle async operations with proper error boundaries
- Use TypeScript strict mode

### Testing

Before submitting a PR:

1. Ensure all three component linters pass with no errors
2. Test basic functionality in each component
3. Verify no regressions in existing features
4. Update documentation if adding new features

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the guidelines above
3. Run all linters and fix any issues
4. Update README if needed
5. Submit PR with clear description of changes
6. Wait for review and address feedback

## Project Structure

- `/db` - Shared Drizzle schema for database
- `/server` - Backend game server
- `/nextjs` - Web application
- `/mobile` - Mobile application
- `/client` - Legacy client (deprecated)
- `/shared` - Shared utilities and types

## Questions?

Open an issue for any questions or concerns!
