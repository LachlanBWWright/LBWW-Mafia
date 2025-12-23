# Prisma Database Setup Guide

This document explains how to use Prisma ORM in the MERN Mafia server.

## Overview

Prisma is configured to use SQLite for development and can be adapted for production databases like PostgreSQL, MySQL, or MongoDB.

## Initial Setup

### 1. Environment Configuration

Make sure your `.env` file includes:

```env
DATABASE_URL="file:./dev.db"
```

For production databases, use the appropriate connection string:
- PostgreSQL: `postgresql://user:password@localhost:5432/dbname`
- MySQL: `mysql://user:password@localhost:3306/dbname`
- MongoDB: `mongodb://user:password@localhost:27017/dbname`

### 2. Generate Prisma Client

After modifying the schema or first time setup:

```bash
npm run db:generate
```

This generates the Prisma Client library based on your schema.

### 3. Create Initial Migration

To create the database schema:

```bash
npm run db:migrate:dev
```

You'll be prompted to name your migration (e.g., "init").

## Common Commands

### Development

```bash
# Watch mode development server (includes database watch)
npm run dev

# Create a new migration (after schema changes)
npm run db:migrate:dev --name=add_new_feature

# View/edit data with Prisma Studio
npm run db:studio

# Reset database (WARNING: deletes all data)
npm run db:reset
```

### Production

```bash
# Generate Prisma Client
npm run db:generate

# Deploy migrations to production
npm run db:migrate:deploy

# Initialize the database
npm run db:init
```

## Using Prisma in Code

### Import the Prisma Client

```typescript
import { prisma } from "./lib/prisma.js";
```

### Create Records

```typescript
const user = await prisma.user.create({
  data: {
    email: "user@example.com",
    name: "John Doe",
  },
});
```

### Read Records

```typescript
// Find one
const user = await prisma.user.findUnique({
  where: { email: "user@example.com" },
});

// Find many
const users = await prisma.user.findMany();

// Find with filters
const activeGames = await prisma.gameSession.findMany({
  where: { status: "IN_PROGRESS" },
});
```

### Update Records

```typescript
const updated = await prisma.user.update({
  where: { id: userId },
  data: { name: "New Name" },
});
```

### Delete Records

```typescript
await prisma.user.delete({
  where: { id: userId },
});
```

### Complex Queries

```typescript
// With relations
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    gameParticipations: true,
    sessions: true,
  },
});

// With multiple conditions
const games = await prisma.gameSession.findMany({
  where: {
    AND: [
      { status: "IN_PROGRESS" },
      { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    ],
  },
});
```

## Schema Management

### Viewing the Schema

The schema is defined in `prisma/schema.prisma`.

### Models in This Project

- **User**: Game players with authentication info
- **Account**: OAuth account credentials
- **Session**: Authentication sessions
- **GameSession**: Individual game rooms
- **GameParticipation**: Player participation in games
- **VerificationToken**: Email verification tokens

### Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate:dev` and name your migration
3. Prisma will generate a migration file and update the database

## Troubleshooting

### Database Lock

If you get a database lock error:

```bash
# Close any open connections and try again
npm run db:reset  # Only if you can afford to lose data
```

### Schema Out of Sync

If your code and database schema are out of sync:

```bash
npm run db:migrate:deploy
npm run db:generate
```

### Connection Issues

- Ensure `DATABASE_URL` is set correctly in `.env`
- For SQLite, ensure the `./prisma` directory exists
- Check that the database file has read/write permissions

## Best Practices

1. **Always use `prisma` import**: Use the singleton instance from `lib/prisma.ts`
2. **Type safety**: Let TypeScript infer types from Prisma queries
3. **Error handling**: Wrap database calls in try/catch
4. **Transactions**: Use `prisma.$transaction()` for atomic operations
5. **Performance**: Use `select` and `include` to avoid over-fetching data

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles)
- [Database Connectors](https://www.prisma.io/docs/orm/reference/database-reference/connection-urls)
