import NextAuth, { type NextAuthConfig } from 'next-auth'
import { env } from '~/env.js'

export const authOptions: NextAuthConfig = {
  providers: [
    // Temporarily removed providers to test basic setup
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
  session: {
    strategy: 'jwt',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)