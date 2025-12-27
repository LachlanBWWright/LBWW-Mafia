# Account System Implementation Plan

This document outlines a comprehensive plan for implementing an account system across the MERN Mafia application, including the server, Next.js, and mobile components.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Phase 1: Unified Prisma Schema](#2-phase-1-unified-prisma-schema)
3. [Phase 2: Google OAuth Integration](#3-phase-2-google-oauth-integration)
4. [Phase 3: tRPC Endpoint Updates](#4-phase-3-trpc-endpoint-updates)
5. [Phase 4: Next.js Frontend Updates](#5-phase-4-nextjs-frontend-updates)
6. [Phase 5: Mobile App Updates](#6-phase-5-mobile-app-updates)
7. [Phase 6: Account Pages Implementation](#7-phase-6-account-pages-implementation)
8. [Database Schema Changes](#8-database-schema-changes)
9. [Security Considerations](#9-security-considerations)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Overview

### Current State
- **Server**: Express + Socket.IO backend with Prisma, no user authentication
- **Next.js**: NextAuth configured but OAuth providers disabled, tRPC with demo mode
- **Mobile**: React Native/Expo using demo mode with hardcoded user ID (`user_123`)
- **Database**: Two similar Prisma schemas in `/server` and `/nextjs`

### Target State
- Unified Prisma schema shared between server and Next.js
- Google OAuth authentication across all platforms
- Type-safe tRPC API layer serving both web and mobile
- Comprehensive account features including match history, profile, and statistics

### Key Decisions
- **OAuth Provider**: Google only (for now)
- **Auth Library**: NextAuth v4 (already configured)
- **Session Strategy**: JWT (for mobile compatibility)
- **API Layer**: tRPC with protected procedures

---

## 2. Phase 1: Unified Prisma Schema

### Goal
Create a single source of truth for the database schema that can be used by both the Next.js application and the server.

### Approach

#### Option A: Shared Package (Recommended)
Create a new `@mernmafia/database` package in the monorepo that contains the Prisma schema and generated client.

**Structure:**
```
/packages/
  /database/
    /prisma/
      schema.prisma
      migrations/
    /src/
      index.ts          # Re-exports Prisma client
    package.json
    tsconfig.json
```

#### Implementation Steps

1. **Create the database package**
   ```
   /packages/database/
   ├── prisma/
   │   ├── schema.prisma
   │   └── migrations/
   ├── src/
   │   └── index.ts
   ├── package.json
   └── tsconfig.json
   ```

2. **Move schema to shared location**
   - Consolidate `/server/prisma/schema.prisma` and `/nextjs/prisma/schema.prisma`
   - Use the Next.js schema as the base (more complete with GameStatus enum)
   - Add any server-specific models

3. **Update package.json for database package**
   ```json
   {
     "name": "@mernmafia/database",
     "version": "1.0.0",
     "main": "./src/index.ts",
     "scripts": {
       "generate": "prisma generate",
       "migrate:dev": "prisma migrate dev",
       "migrate:deploy": "prisma migrate deploy",
       "db:push": "prisma db push",
       "db:seed": "prisma db seed"
     },
     "dependencies": {
       "@prisma/client": "^7.2.0"
     },
     "devDependencies": {
       "prisma": "^7.2.0"
     }
   }
   ```

4. **Export Prisma client**
   ```typescript
   // packages/database/src/index.ts
   import { PrismaClient } from '@prisma/client';

   export * from '@prisma/client';

   const globalForPrisma = globalThis as unknown as {
     prisma: PrismaClient | undefined;
   };

   export const prisma = globalForPrisma.prisma ?? new PrismaClient();

   if (process.env.NODE_ENV !== 'production') {
     globalForPrisma.prisma = prisma;
   }
   ```

5. **Update consumers**
   - **Next.js**: Replace `/nextjs/src/lib/prisma.ts` with import from `@mernmafia/database`
   - **Server**: Remove local prisma setup, import from `@mernmafia/database`

6. **Update workspace configuration**
   - Add `packages/database` to pnpm workspace
   - Update root `pnpm-workspace.yaml`

### Migration Plan

1. Create backup of existing SQLite database
2. Create new package structure
3. Generate fresh migrations from unified schema
4. Test locally before deploying
5. Update CI/CD to build database package first

---

## 3. Phase 2: Google OAuth Integration

### Goal
Implement Google OAuth authentication that works seamlessly across web and mobile platforms.

### Implementation Steps

#### 3.1 Google Cloud Console Setup

1. **Create OAuth 2.0 Client IDs**
   - Web application client (for Next.js)
   - iOS client (for mobile)
   - Android client (for mobile)

2. **Configure authorized origins**
   ```
   Web: http://localhost:3000, https://yourdomain.com
   ```

3. **Configure authorized redirect URIs**
   ```
   http://localhost:3000/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google
   ```

#### 3.2 Next.js NextAuth Configuration

Update `/nextjs/src/server/api/auth.ts`:

```typescript
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@mernmafia/database';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
```

#### 3.3 Environment Variables

Add to `.env.local` (Next.js) and `.env` (server):

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Mobile OAuth (for Expo)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
```

#### 3.4 Mobile OAuth Flow

For React Native/Expo, use `expo-auth-session` with Google:

1. **Install dependencies**
   ```bash
   npx expo install expo-auth-session expo-crypto expo-web-browser
   ```

2. **Create auth hook** (`/mobile/hooks/useGoogleAuth.ts`):
   ```typescript
   import * as Google from 'expo-auth-session/providers/google';
   import * as WebBrowser from 'expo-web-browser';
   import { useEffect, useState } from 'react';

   WebBrowser.maybeCompleteAuthSession();

   export function useGoogleAuth() {
     const [request, response, promptAsync] = Google.useAuthRequest({
       webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
       iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
       androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
     });

     return { request, response, promptAsync };
   }
   ```

3. **Create auth context** (`/mobile/contexts/AuthContext.tsx`):
   ```typescript
   import React, { createContext, useContext, useState, useEffect } from 'react';
   import AsyncStorage from '@react-native-async-storage/async-storage';

   interface AuthContextType {
     user: User | null;
     isLoading: boolean;
     signIn: (idToken: string) => Promise<void>;
     signOut: () => Promise<void>;
   }

   export const AuthContext = createContext<AuthContextType | null>(null);

   export function AuthProvider({ children }: { children: React.ReactNode }) {
     const [user, setUser] = useState<User | null>(null);
     const [isLoading, setIsLoading] = useState(true);

     // Implementation details...
   }
   ```

#### 3.5 Token Exchange Endpoint

Create a new tRPC endpoint for mobile token exchange:

```typescript
// In gameSession router
mobileAuth: publicProcedure
  .input(z.object({ idToken: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Find or create user
    const user = await ctx.prisma.user.upsert({
      where: { email: payload.email },
      create: {
        email: payload.email,
        name: payload.name,
        image: payload.picture,
      },
      update: {
        name: payload.name,
        image: payload.picture,
      },
    });

    // Generate JWT for mobile
    const token = jwt.sign({ userId: user.id }, process.env.NEXTAUTH_SECRET);

    return { user, token };
  }),
```

---

## 4. Phase 3: tRPC Endpoint Updates

### Goal
Create comprehensive tRPC endpoints for account management, game history, and statistics.

### New Router Structure

```
/nextjs/src/server/api/routers/
├── auth.ts           # Authentication endpoints (new)
├── user.ts           # User profile management (new)
├── gameSession.ts    # Game session management (existing, update)
├── stats.ts          # Statistics and leaderboards (new)
├── match.ts          # Match history endpoints (new)
└── index.ts          # Router aggregation
```

### 4.1 Auth Router (`/nextjs/src/server/api/routers/auth.ts`)

```typescript
import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';

export const authRouter = createTRPCRouter({
  // Get current session
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  // Mobile Google OAuth token exchange
  googleMobileAuth: publicProcedure
    .input(z.object({ idToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify and exchange token
    }),

  // Logout (invalidate session)
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Handle logout logic
  }),

  // Delete account
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    // Soft delete or full delete user account
  }),
});
```

### 4.2 User Router (`/nextjs/src/server/api/routers/user.ts`)

```typescript
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const userRouter = createTRPCRouter({
  // Get current user profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        _count: {
          select: { gameParticipations: true },
        },
      },
    });
  }),

  // Get public user profile by ID
  getPublicProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          image: true,
          createdAt: true,
          _count: {
            select: { gameParticipations: true },
          },
        },
      });
    }),

  // Update profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50).optional(),
      displayName: z.string().min(1).max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: input,
      });
    }),

  // Get user preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.userPreferences.findUnique({
      where: { userId: ctx.session.user.id },
    });
  }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      soundEnabled: z.boolean().optional(),
      notificationsEnabled: z.boolean().optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPreferences.upsert({
        where: { userId: ctx.session.user.id },
        create: { userId: ctx.session.user.id, ...input },
        update: input,
      });
    }),
});
```

### 4.3 Match History Router (`/nextjs/src/server/api/routers/match.ts`)

```typescript
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const matchRouter = createTRPCRouter({
  // Get user's match history with pagination
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      filter: z.object({
        status: z.enum(['FINISHED', 'CANCELLED']).optional(),
        role: z.string().optional(),
        won: z.boolean().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor, filter } = input;

      const participations = await ctx.prisma.gameParticipation.findMany({
        where: {
          userId: ctx.session.user.id,
          gameSession: {
            status: filter?.status ?? 'FINISHED',
          },
          ...(filter?.role && { role: filter.role }),
        },
        include: {
          gameSession: {
            select: {
              id: true,
              roomCode: true,
              status: true,
              startTime: true,
              endTime: true,
              result: true,
              _count: {
                select: { participants: true },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (participations.length > limit) {
        const nextItem = participations.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: participations,
        nextCursor,
      };
    }),

  // Get match details
  getMatchDetails: protectedProcedure
    .input(z.object({ gameSessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.gameSession.findUnique({
        where: { id: input.gameSessionId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      // Only return if user participated
      const participated = session?.participants.some(
        p => p.userId === ctx.session.user.id
      );

      if (!participated) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return session;
    }),

  // Get match summary for sharing
  getMatchSummary: publicProcedure
    .input(z.object({ gameSessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.gameSession.findUnique({
        where: { id: input.gameSessionId },
        select: {
          id: true,
          roomCode: true,
          startTime: true,
          endTime: true,
          result: true,
          _count: {
            select: { participants: true },
          },
        },
      });
    }),
});
```

### 4.4 Stats Router (`/nextjs/src/server/api/routers/stats.ts`)

```typescript
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const statsRouter = createTRPCRouter({
  // Get user's personal statistics
  getPersonalStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [totalGames, gamesWon, roleStats] = await Promise.all([
      // Total games played
      ctx.prisma.gameParticipation.count({
        where: { userId, gameSession: { status: 'FINISHED' } },
      }),

      // Games won (would need result parsing logic)
      ctx.prisma.gameParticipation.count({
        where: {
          userId,
          gameSession: { status: 'FINISHED' },
          // Add win condition based on result JSON
        },
      }),

      // Stats by role
      ctx.prisma.gameParticipation.groupBy({
        by: ['role'],
        where: { userId, gameSession: { status: 'FINISHED' } },
        _count: { id: true },
      }),
    ]);

    return {
      totalGames,
      gamesWon,
      winRate: totalGames > 0 ? (gamesWon / totalGames) * 100 : 0,
      roleStats: roleStats.map(r => ({
        role: r.role,
        gamesPlayed: r._count.id,
      })),
    };
  }),

  // Get public leaderboard
  getLeaderboard: publicProcedure
    .input(z.object({
      type: z.enum(['wins', 'games', 'winRate']).default('wins'),
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
      // Implementation depends on how wins are tracked
      // This is a simplified version
      const users = await ctx.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          image: true,
          _count: {
            select: {
              gameParticipations: {
                where: { gameSession: { status: 'FINISHED' } },
              },
            },
          },
        },
        orderBy: {
          gameParticipations: { _count: 'desc' },
        },
        take: input.limit,
      });

      return users.map((u, index) => ({
        rank: index + 1,
        user: { id: u.id, name: u.name, image: u.image },
        gamesPlayed: u._count.gameParticipations,
      }));
    }),

  // Get role-specific stats
  getRoleStats: protectedProcedure
    .input(z.object({ role: z.string() }))
    .query(async ({ ctx, input }) => {
      const stats = await ctx.prisma.gameParticipation.findMany({
        where: {
          userId: ctx.session.user.id,
          role: input.role,
          gameSession: { status: 'FINISHED' },
        },
        include: {
          gameSession: {
            select: { result: true, startTime: true },
          },
        },
      });

      return {
        role: input.role,
        totalGames: stats.length,
        // Add win calculation based on result
      };
    }),
});
```

### 4.5 Update Root Router

```typescript
// /nextjs/src/server/api/root.ts
import { createTRPCRouter } from './trpc';
import { authRouter } from './routers/auth';
import { userRouter } from './routers/user';
import { gameSessionRouter } from './routers/gameSession';
import { matchRouter } from './routers/match';
import { statsRouter } from './routers/stats';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  gameSession: gameSessionRouter,
  match: matchRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
```

---

## 5. Phase 4: Next.js Frontend Updates

### Goal
Update the Next.js frontend to support authentication UI and new account features.

### New Pages Structure

```
/nextjs/src/app/
├── auth/
│   ├── signin/
│   │   └── page.tsx          # Sign in page with Google button
│   ├── signout/
│   │   └── page.tsx          # Sign out confirmation
│   └── error/
│       └── page.tsx          # Auth error page
├── account/
│   ├── page.tsx              # Account dashboard
│   ├── profile/
│   │   └── page.tsx          # Edit profile
│   └── settings/
│       └── page.tsx          # Account settings
├── history/
│   ├── page.tsx              # Match history list
│   └── [matchId]/
│       └── page.tsx          # Match details
├── stats/
│   └── page.tsx              # Statistics dashboard (update existing)
├── leaderboard/
│   └── page.tsx              # Public leaderboard
└── user/
    └── [userId]/
        └── page.tsx          # Public user profile
```

### 5.1 Auth Pages

#### Sign In Page (`/auth/signin/page.tsx`)

```tsx
'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">Sign In</h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">
            {error === 'OAuthSignin' && 'Error starting sign in'}
            {error === 'OAuthCallback' && 'Error during sign in'}
            {error === 'Default' && 'An error occurred'}
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="w-full flex items-center justify-center gap-3
                     bg-white border border-gray-300 rounded-lg px-6 py-3
                     hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="text-center text-sm text-gray-600">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
```

### 5.2 Account Dashboard (`/account/page.tsx`)

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { api } from '@/utils/api';
import Link from 'next/link';

export default function AccountPage() {
  const { data: session } = useSession();
  const { data: profile } = api.user.getProfile.useQuery();
  const { data: stats } = api.stats.getPersonalStats.useQuery();

  if (!session) {
    return <RedirectToSignIn />;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>

      {/* Profile Summary */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-4">
          <img
            src={profile?.image ?? '/default-avatar.png'}
            alt={profile?.name ?? 'User'}
            className="w-20 h-20 rounded-full"
          />
          <div>
            <h2 className="text-2xl font-semibold">{profile?.name}</h2>
            <p className="text-gray-600">{session.user?.email}</p>
            <Link href="/account/profile" className="text-blue-600 hover:underline">
              Edit Profile
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard title="Games Played" value={stats?.totalGames ?? 0} />
        <StatCard title="Games Won" value={stats?.gamesWon ?? 0} />
        <StatCard title="Win Rate" value={`${stats?.winRate?.toFixed(1) ?? 0}%`} />
      </section>

      {/* Quick Links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickLinkCard
          title="Match History"
          description="View your past games and performance"
          href="/history"
        />
        <QuickLinkCard
          title="Statistics"
          description="Detailed stats and role performance"
          href="/stats"
        />
        <QuickLinkCard
          title="Settings"
          description="Manage preferences and notifications"
          href="/account/settings"
        />
        <QuickLinkCard
          title="Leaderboard"
          description="See how you rank against others"
          href="/leaderboard"
        />
      </section>
    </div>
  );
}
```

### 5.3 Match History Page (`/history/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/utils/api';
import { useInfiniteQuery } from '@tanstack/react-query';

export default function MatchHistoryPage() {
  const [filter, setFilter] = useState({});

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.match.getHistory.useInfiniteQuery(
    { limit: 20, filter },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const matches = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Match History</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <select
            onChange={(e) => setFilter(f => ({ ...f, role: e.target.value }))}
            className="border rounded px-3 py-2"
          >
            <option value="">All Roles</option>
            {/* Role options */}
          </select>
          {/* More filters */}
        </div>
      </div>

      {/* Match List */}
      <div className="space-y-4">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>

      {/* Load More */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

function MatchCard({ match }) {
  return (
    <Link href={`/history/${match.gameSession.id}`}>
      <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
        <div className="flex justify-between items-center">
          <div>
            <span className="font-semibold">Room: {match.gameSession.roomCode}</span>
            <span className="text-gray-600 ml-4">
              Role: {match.role ?? 'Unknown'}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">
              {new Date(match.joinedAt).toLocaleDateString()}
            </div>
            <div className="text-sm">
              {match.gameSession._count.participants} players
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

### 5.4 Navigation Updates

Update the navigation component to include account-related links:

```tsx
// components/Navigation.tsx
'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';

export function Navigation() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-gray-900 text-white">
      <div className="container mx-auto flex justify-between items-center py-4">
        <Link href="/" className="text-xl font-bold">
          MERN Mafia
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/play">Play</Link>
          <Link href="/lobby">Lobbies</Link>
          <Link href="/roles">Roles</Link>
          <Link href="/leaderboard">Leaderboard</Link>

          {status === 'loading' ? (
            <div className="animate-pulse w-8 h-8 bg-gray-700 rounded-full" />
          ) : session ? (
            <div className="relative group">
              <button className="flex items-center gap-2">
                <img
                  src={session.user?.image ?? '/default-avatar.png'}
                  alt={session.user?.name ?? 'User'}
                  className="w-8 h-8 rounded-full"
                />
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg hidden group-hover:block">
                <Link href="/account" className="block px-4 py-2 text-gray-800 hover:bg-gray-100">
                  My Account
                </Link>
                <Link href="/history" className="block px-4 py-2 text-gray-800 hover:bg-gray-100">
                  Match History
                </Link>
                <Link href="/stats" className="block px-4 py-2 text-gray-800 hover:bg-gray-100">
                  Statistics
                </Link>
                <hr className="my-1" />
                <button
                  onClick={() => signOut()}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
```

---

## 6. Phase 5: Mobile App Updates

### Goal
Update the React Native mobile app to support Google OAuth and integrate with new tRPC endpoints.

### New Directory Structure

```
/mobile/
├── App.tsx                        # Update with AuthProvider
├── screens/
│   ├── auth/
│   │   ├── SignInScreen.tsx       # New: Google sign in
│   │   └── LoadingScreen.tsx      # New: Auth loading state
│   ├── account/
│   │   ├── AccountScreen.tsx      # New: Account dashboard
│   │   ├── ProfileScreen.tsx      # New: Edit profile
│   │   ├── SettingsScreen.tsx     # Update existing
│   │   └── MatchHistoryScreen.tsx # New: Match history
│   ├── HomeScreen.tsx             # Update with auth state
│   ├── GameScreen.tsx             # Update with user context
│   └── ...existing screens
├── contexts/
│   └── AuthContext.tsx            # New: Auth state management
├── hooks/
│   ├── useGoogleAuth.ts           # New: Google OAuth hook
│   └── useAuth.ts                 # New: Auth utilities
├── components/
│   ├── AuthGuard.tsx              # New: Protected route wrapper
│   └── UserAvatar.tsx             # New: User avatar component
├── utils/
│   ├── api.ts                     # Update with auth headers
│   ├── storage.ts                 # New: Secure token storage
│   └── trpc.tsx                   # Update with auth
└── types.ts                       # Update with user types
```

### 6.1 Install New Dependencies

```bash
cd mobile
npx expo install expo-auth-session expo-crypto expo-web-browser @react-native-async-storage/async-storage expo-secure-store
```

### 6.2 Auth Context (`/mobile/contexts/AuthContext.tsx`)

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../utils/api';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authMutation = api.auth.googleMobileAuth.useMutation();

  useEffect(() => {
    // Load stored auth on mount
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await SecureStore.getItemAsync('authToken');
      const storedUser = await SecureStore.getItemAsync('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(idToken: string) {
    try {
      setIsLoading(true);
      const result = await authMutation.mutateAsync({ idToken });

      setUser(result.user);
      setToken(result.token);

      await SecureStore.setItemAsync('authToken', result.token);
      await SecureStore.setItemAsync('user', JSON.stringify(result.user));
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    try {
      setUser(null);
      setToken(null);
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('user');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 6.3 Sign In Screen (`/mobile/screens/auth/SignInScreen.tsx`)

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../contexts/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export function SignInScreen() {
  const { signIn, isLoading } = useAuth();

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      signIn(id_token);
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
      />

      <Text style={styles.title}>Welcome to MERN Mafia</Text>
      <Text style={styles.subtitle}>Sign in to track your games and stats</Text>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => promptAsync()}
        disabled={!request || isLoading}
      >
        <Image
          source={require('../../assets/google-icon.png')}
          style={styles.googleIcon}
        />
        <Text style={styles.googleButtonText}>
          {isLoading ? 'Signing in...' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton}>
        <Text style={styles.skipButtonText}>Play as Guest</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a2e',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  skipButton: {
    marginTop: 20,
    padding: 12,
  },
  skipButtonText: {
    color: '#888',
    fontSize: 14,
  },
});
```

### 6.4 Match History Screen (`/mobile/screens/account/MatchHistoryScreen.tsx`)

```typescript
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { api } from '../../utils/api';
import { useNavigation } from '@react-navigation/native';

export function MatchHistoryScreen() {
  const navigation = useNavigation();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    refetch,
  } = api.match.getHistory.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const matches = data?.pages.flatMap(page => page.items) ?? [];

  const renderMatch = ({ item }) => (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => navigation.navigate('MatchDetails', { matchId: item.gameSession.id })}
    >
      <View style={styles.matchHeader}>
        <Text style={styles.roomCode}>Room: {item.gameSession.roomCode}</Text>
        <Text style={styles.date}>
          {new Date(item.joinedAt).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.matchDetails}>
        <View style={styles.roleContainer}>
          <Text style={styles.roleLabel}>Role:</Text>
          <Text style={styles.roleValue}>{item.role ?? 'Unknown'}</Text>
        </View>
        <View style={styles.playersContainer}>
          <Text style={styles.playersCount}>
            {item.gameSession._count.participants} players
          </Text>
        </View>
      </View>

      {item.gameSession.result && (
        <View style={[
          styles.resultBadge,
          item.gameSession.result.winner === 'town'
            ? styles.townWin
            : styles.mafiaWin
        ]}>
          <Text style={styles.resultText}>
            {item.gameSession.result.winner === 'town' ? 'Town Win' : 'Mafia Win'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <Text style={styles.loading}>Loading more...</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No matches found</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  list: {
    padding: 16,
  },
  matchCard: {
    backgroundColor: '#252542',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roomCode: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    color: '#888',
    fontSize: 14,
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleLabel: {
    color: '#888',
    marginRight: 8,
  },
  roleValue: {
    color: '#fff',
    fontWeight: '500',
  },
  playersContainer: {
    alignItems: 'flex-end',
  },
  playersCount: {
    color: '#888',
  },
  resultBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  townWin: {
    backgroundColor: '#2d5a27',
  },
  mafiaWin: {
    backgroundColor: '#5a2727',
  },
  resultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loading: {
    color: '#888',
    textAlign: 'center',
    padding: 16,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    padding: 32,
    fontSize: 16,
  },
});
```

### 6.5 Update Navigation (`/mobile/App.tsx`)

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCProvider } from './utils/trpc';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Screens
import { SignInScreen } from './screens/auth/SignInScreen';
import { LoadingScreen } from './screens/auth/LoadingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AccountScreen } from './screens/account/AccountScreen';
import { MatchHistoryScreen } from './screens/account/MatchHistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { GameScreen } from './screens/GameScreen';
// ... other screens

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

function Navigation() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="MatchHistory" component={MatchHistoryScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          {/* ... other authenticated screens */}
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider>
        <AuthProvider>
          <NavigationContainer>
            <Navigation />
          </NavigationContainer>
        </AuthProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

### 6.6 Update tRPC Client with Auth Headers

```typescript
// /mobile/utils/api.ts
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '../../../nextjs/src/server/api/root';
import * as SecureStore from 'expo-secure-store';

export const api = createTRPCReact<AppRouter>();

export function getBaseUrl() {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export function createTRPCClient() {
  return api.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        async headers() {
          const token = await SecureStore.getItemAsync('authToken');
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
```

---

## 7. Phase 6: Account Pages Implementation

### Goal
Implement all account-related pages with consistent design across web and mobile.

### 7.1 Page Specifications

#### Account Dashboard
- **Route (Web)**: `/account`
- **Screen (Mobile)**: `AccountScreen`
- **Features**:
  - User profile summary (avatar, name, email)
  - Quick stats (games played, wins, win rate)
  - Navigation to sub-pages
  - Sign out button

#### Profile Edit
- **Route (Web)**: `/account/profile`
- **Screen (Mobile)**: `ProfileScreen`
- **Features**:
  - Edit display name
  - View connected Google account
  - Profile picture (from Google, read-only)

#### Settings
- **Route (Web)**: `/account/settings`
- **Screen (Mobile)**: `SettingsScreen` (update existing)
- **Features**:
  - Sound/notification preferences
  - Theme selection (light/dark/system)
  - Delete account option

#### Match History
- **Route (Web)**: `/history`
- **Screen (Mobile)**: `MatchHistoryScreen`
- **Features**:
  - Infinite scroll list of past games
  - Filters: role, date range, result
  - Click to view match details
  - Show: room code, role, date, player count, result

#### Match Details
- **Route (Web)**: `/history/[matchId]`
- **Screen (Mobile)**: `MatchDetailsScreen`
- **Features**:
  - Full game summary
  - List of all participants with roles
  - Game timeline/phases
  - Win/lose status
  - Share button

#### Statistics Dashboard
- **Route (Web)**: `/stats`
- **Screen (Mobile)**: `StatsScreen`
- **Features**:
  - Overall stats (games, wins, rate)
  - Role breakdown chart
  - Win rate by role
  - Recent performance trend
  - Personal bests

#### Leaderboard
- **Route (Web)**: `/leaderboard`
- **Screen (Mobile)**: `LeaderboardScreen`
- **Features**:
  - Top players by wins/games/rate
  - User's rank highlighted
  - Filter by time period (weekly/monthly/all-time)
  - Role-specific leaderboards

#### Public Profile
- **Route (Web)**: `/user/[userId]`
- **Screen (Mobile)**: `PublicProfileScreen`
- **Features**:
  - Public user info
  - Public stats
  - Recent games (if public)

---

## 8. Database Schema Changes

### New/Updated Models

```prisma
// packages/database/prisma/schema.prisma

// ========== AUTH MODELS (existing, unchanged) ==========
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  // New fields
  displayName   String?   @db.VarChar(30)

  accounts      Account[]
  sessions      Session[]
  gameParticipations GameParticipation[]
  preferences   UserPreferences?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ========== NEW MODEL: User Preferences ==========
model UserPreferences {
  id                    String   @id @default(cuid())
  userId                String   @unique

  soundEnabled          Boolean  @default(true)
  notificationsEnabled  Boolean  @default(true)
  theme                 String   @default("system") // light, dark, system

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ========== GAME MODELS (existing, updated) ==========
enum GameStatus {
  WAITING
  STARTING
  IN_PROGRESS
  FINISHED
  CANCELLED
}

model GameSession {
  id          String      @id @default(cuid())
  roomId      String      @unique
  roomCode    String      @unique
  status      GameStatus  @default(WAITING)
  startTime   DateTime?
  endTime     DateTime?
  maxPlayers  Int         @default(10)
  settings    Json?
  result      Json?       // { winner: 'town' | 'mafia', phases: number, ... }

  participants GameParticipation[]

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([status])
  @@index([createdAt])
}

model GameParticipation {
  id            String    @id @default(cuid())
  userId        String
  gameSessionId String
  role          String?   // Role assigned during game
  isAlive       Boolean   @default(true)
  isWinner      Boolean?  // Set when game ends
  joinedAt      DateTime  @default(now())
  leftAt        DateTime?

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  gameSession GameSession @relation(fields: [gameSessionId], references: [id], onDelete: Cascade)

  @@unique([userId, gameSessionId])
  @@index([userId])
  @@index([gameSessionId])
}

// ========== NEW MODEL: User Stats Cache ==========
// Optional: For performance, cache computed stats
model UserStats {
  id           String   @id @default(cuid())
  userId       String   @unique

  totalGames   Int      @default(0)
  totalWins    Int      @default(0)
  townGames    Int      @default(0)
  townWins     Int      @default(0)
  mafiaGames   Int      @default(0)
  mafiaWins    Int      @default(0)
  neutralGames Int      @default(0)
  neutralWins  Int      @default(0)

  lastUpdated  DateTime @default(now())

  @@index([totalWins])
  @@index([totalGames])
}
```

### Migration Strategy

1. **Create migration for new fields/models**
   ```bash
   cd packages/database
   pnpm prisma migrate dev --name add_account_system
   ```

2. **Seed initial stats** (if UserStats cache model used)
   ```typescript
   // packages/database/prisma/seed.ts
   // Compute initial stats from existing data
   ```

---

## 9. Security Considerations

### Authentication Security

1. **JWT Token Security**
   - Use short-lived JWTs (15 minutes) with refresh tokens
   - Store refresh tokens in httpOnly cookies (web) or SecureStore (mobile)
   - Implement token rotation on refresh

2. **OAuth Security**
   - Validate Google ID tokens on server
   - Check token audience matches your client ID
   - Verify token issuer is Google

3. **Session Management**
   - Implement session invalidation on logout
   - Track active sessions per user
   - Allow "sign out all devices" feature

### API Security

1. **Rate Limiting**
   - Implement rate limiting on auth endpoints
   - Per-user rate limits on API calls

2. **Input Validation**
   - Zod schemas for all tRPC inputs
   - Sanitize user-provided display names

3. **Data Access Control**
   - Users can only access their own data
   - Public endpoints return limited data
   - Verify ownership before updates/deletes

### Data Privacy

1. **Minimal Data Collection**
   - Only collect necessary data from Google (name, email, picture)
   - Clear data retention policy

2. **Account Deletion**
   - Implement full data deletion on account delete
   - Consider soft-delete with 30-day grace period

---

## 10. Testing Strategy

### Unit Tests

1. **tRPC Routers**
   - Test each procedure with mock context
   - Test authorization (protected vs public)
   - Test input validation

2. **Auth Logic**
   - Token generation/validation
   - Session management

### Integration Tests

1. **OAuth Flow**
   - Mock Google OAuth responses
   - Test full sign-in/sign-up flow

2. **Database Operations**
   - Test with real database (test instance)
   - Test cascade deletes

### E2E Tests

1. **Web (Playwright)**
   - Full auth flow
   - Account management
   - Match history browsing

2. **Mobile (Detox)**
   - Sign in flow
   - Navigation between screens
   - Data display

### Test Environment

```bash
# Environment variables for testing
DATABASE_URL="file:./test.db"
NEXTAUTH_SECRET="test-secret"
GOOGLE_CLIENT_ID="test-client-id"
GOOGLE_CLIENT_SECRET="test-secret"
```

---

## Implementation Order

1. **Phase 1**: Unified Prisma Schema (1-2 days)
2. **Phase 2**: Google OAuth Integration (2-3 days)
3. **Phase 3**: tRPC Endpoint Updates (2-3 days)
4. **Phase 4**: Next.js Frontend Updates (3-4 days)
5. **Phase 5**: Mobile App Updates (3-4 days)
6. **Phase 6**: Account Pages Implementation (2-3 days)

**Total Estimated Implementation Time**: 13-19 days

---

## Appendix: File Changes Summary

### New Files

**Packages**
- `/packages/database/` - Entire package

**Next.js**
- `/nextjs/src/app/auth/` - Auth pages
- `/nextjs/src/app/account/` - Account pages
- `/nextjs/src/app/history/` - Match history pages
- `/nextjs/src/app/leaderboard/` - Leaderboard page
- `/nextjs/src/app/user/` - Public profile pages
- `/nextjs/src/server/api/routers/auth.ts`
- `/nextjs/src/server/api/routers/user.ts`
- `/nextjs/src/server/api/routers/match.ts`
- `/nextjs/src/server/api/routers/stats.ts`

**Mobile**
- `/mobile/screens/auth/` - Auth screens
- `/mobile/screens/account/` - Account screens
- `/mobile/contexts/AuthContext.tsx`
- `/mobile/hooks/useGoogleAuth.ts`
- `/mobile/hooks/useAuth.ts`
- `/mobile/components/AuthGuard.tsx`
- `/mobile/utils/storage.ts`

### Modified Files

**Next.js**
- `/nextjs/src/server/api/auth.ts` - Add Google provider
- `/nextjs/src/server/api/root.ts` - Add new routers
- `/nextjs/src/server/api/trpc.ts` - Update context
- `/nextjs/src/lib/prisma.ts` - Import from package
- `/nextjs/src/app/stats/page.tsx` - Update with auth
- `/nextjs/package.json` - Add database package dep

**Mobile**
- `/mobile/App.tsx` - Add AuthProvider, update navigation
- `/mobile/utils/api.ts` - Add auth headers
- `/mobile/utils/trpc.tsx` - Update with auth
- `/mobile/screens/HomeScreen.tsx` - Add auth state
- `/mobile/screens/SettingsScreen.tsx` - Add account options
- `/mobile/package.json` - Add new dependencies

**Server**
- `/server/package.json` - Add database package dep
- Remove local prisma folder

---

*Document created: December 28, 2025*
*Last updated: December 28, 2025*
