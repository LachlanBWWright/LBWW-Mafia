# LBWW Mafia - Next.js App

This is the Next.js web application for LBWW Mafia, built with the [T3 Stack](https://create.t3.gg/).

## Tech Stack

The application uses modern web technologies:

- [Next.js](https://nextjs.org) - React framework for production
- [NextAuth.js](https://next-auth.js.org) - Authentication for Next.js
- [Drizzle ORM](https://orm.drizzle.team) - TypeScript ORM with PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com) - Re-usable component library

## Getting Started

1. Install dependencies:

```bash
# Run this from the repository root so pnpm sees the workspace packages.
pnpm install
```

2. Copy `nextjs/.env.example` to `nextjs/.env.local` and fill in the values. Use Node.js 24 and the repository's pinned pnpm version.

3. Run database migrations:

```bash
pnpm --dir nextjs run db:migrate
```

4. Start the development server:

```bash
pnpm --dir nextjs run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Database

The app uses Drizzle ORM with PostgreSQL for local development and production. The shared schema is located at `db/schema.ts` in the repository root. Start the local database with `docker compose up -d db` before running migrations.

### Database Commands

- `pnpm run db:generate` - Generate migrations
- `pnpm run db:migrate` - Run migrations
- `pnpm run db:push` - Push schema to database
- `pnpm run db:studio` - Open Drizzle Studio

## Learn More

- [T3 Stack Documentation](https://create.t3.gg/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle Documentation](https://orm.drizzle.team/docs/overview)

## Deployment

Follow the repository's [deployment instructions](../DEPLOYMENT.md#vercel). The Vercel Root Directory is `nextjs`; `nextjs/vercel.json` defines its build commands. Configure PostgreSQL, Google OAuth, and the deployed PartyServer endpoint before deployment. CAPTCHA is disabled.
