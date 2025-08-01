import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Discord from 'next-auth/providers/discord'
import { env } from '~/env.js'

export const authOptions: NextAuthConfig = {
  // adapter: PrismaAdapter(prisma) as any, // Commented out for development without database
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID ?? '',
      clientSecret: env.AUTH_GOOGLE_SECRET ?? '',
    }),
    Discord({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
    }),
  ],
  callbacks: {
    session: ({ session, token }: any) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub || 'anonymous_user',
      },
    }),
    jwt: ({ token, user }: any) => {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  // Use JWT for sessions in development
  session: {
    strategy: 'jwt',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)