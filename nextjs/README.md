# MERN Mafia - Next.js App

This is the Next.js web application for MERN Mafia, built with the [T3 Stack](https://create.t3.gg/).

## Tech Stack

The application uses modern web technologies:

- [Next.js](https://nextjs.org) - React framework for production
- [NextAuth.js](https://next-auth.js.org) - Authentication for Next.js
- [Drizzle ORM](https://orm.drizzle.team) - TypeScript ORM with SQLite
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com) - Re-usable component library

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables (copy `.env.example` to `.env` and fill in values)

3. Run database migrations:
```bash
npm run db:push
```

4. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Database

The app uses Drizzle ORM with SQLite for local development. The shared schema is located at `/db/schema.ts` in the repository root.

### Database Commands

- `npm run db:generate` - Generate migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio

## Learn More

- [T3 Stack Documentation](https://create.t3.gg/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle Documentation](https://orm.drizzle.team/docs/overview)

## Deployment

Follow the T3 Stack deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker).
