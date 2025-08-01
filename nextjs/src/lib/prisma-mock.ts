// Mock Prisma Client for development when network is not available
// This should be replaced with the real Prisma client when possible

interface MockUser {
  id: string
  name?: string | null
  email?: string | null
  emailVerified?: Date | null
  image?: string | null
}

interface MockAccount {
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string | null
  access_token?: string | null
  expires_at?: number | null
  token_type?: string | null
  scope?: string | null
  id_token?: string | null
  session_state?: string | null
}

interface MockSession {
  id: string
  sessionToken: string
  userId: string
  expires: Date
}

interface MockGameSession {
  id: string
  roomId: string
  roomCode: string
  status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
  startTime?: Date | null
  endTime?: Date | null
  maxPlayers: number
  settings?: any
  result?: any
  createdAt: Date
  updatedAt: Date
  participants: MockGameParticipation[]
}

interface MockGameParticipation {
  id: string
  userId: string
  gameSessionId: string
  role?: string | null
  isAlive: boolean
  joinedAt: Date
  leftAt?: Date | null
  user: MockUser
}

// In-memory storage for development
const mockData = {
  users: [] as MockUser[],
  accounts: [] as MockAccount[],
  sessions: [] as MockSession[],
  gameSessions: [] as MockGameSession[],
  gameParticipations: [] as MockGameParticipation[],
  verificationTokens: [] as any[],
}

// Mock implementation that mimics Prisma client API
export const prisma = {
  user: {
    findUnique: async ({ where }: any) => {
      return mockData.users.find(u => u.id === where.id || u.email === where.email) || null
    },
    create: async ({ data }: any) => {
      const user: MockUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        ...data,
      }
      mockData.users.push(user)
      return user
    },
    update: async ({ where, data }: any) => {
      const index = mockData.users.findIndex(u => u.id === where.id)
      if (index !== -1) {
        mockData.users[index] = { ...mockData.users[index], ...data }
        return mockData.users[index]
      }
      throw new Error('User not found')
    },
  },
  account: {
    findUnique: async ({ where }: any) => {
      return mockData.accounts.find(a => 
        a.provider === where.provider && a.providerAccountId === where.providerAccountId
      ) || null
    },
    create: async ({ data }: any) => {
      const account: MockAccount = {
        id: `account_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        ...data,
      }
      mockData.accounts.push(account)
      return account
    },
  },
  session: {
    findUnique: async ({ where }: any) => {
      return mockData.sessions.find(s => s.sessionToken === where.sessionToken) || null
    },
    create: async ({ data }: any) => {
      const session: MockSession = {
        id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        ...data,
      }
      mockData.sessions.push(session)
      return session
    },
    update: async ({ where, data }: any) => {
      const index = mockData.sessions.findIndex(s => s.sessionToken === where.sessionToken)
      if (index !== -1) {
        mockData.sessions[index] = { ...mockData.sessions[index], ...data }
        return mockData.sessions[index]
      }
      throw new Error('Session not found')
    },
    delete: async ({ where }: any) => {
      const index = mockData.sessions.findIndex(s => s.sessionToken === where.sessionToken)
      if (index !== -1) {
        const session = mockData.sessions[index]
        mockData.sessions.splice(index, 1)
        return session
      }
      throw new Error('Session not found')
    },
  },
  verificationToken: {
    findUnique: async ({ where }: any) => {
      return mockData.verificationTokens.find(t => 
        t.identifier === where.identifier && t.token === where.token
      ) || null
    },
    create: async ({ data }: any) => {
      const token = { ...data }
      mockData.verificationTokens.push(token)
      return token
    },
    delete: async ({ where }: any) => {
      const index = mockData.verificationTokens.findIndex(t => 
        t.identifier === where.identifier && t.token === where.token
      )
      if (index !== -1) {
        const token = mockData.verificationTokens[index]
        mockData.verificationTokens.splice(index, 1)
        return token
      }
      throw new Error('Token not found')
    },
  },
  gameSession: {
    findUnique: async ({ where, include }: any) => {
      const session = mockData.gameSessions.find(g => 
        g.id === where.id || g.roomCode === where.roomCode
      )
      if (!session) return null

      if (include?.participants) {
        const participants = mockData.gameParticipations
          .filter(p => p.gameSessionId === session.id)
          .map(p => ({
            ...p,
            user: include.participants.include?.user ? 
              mockData.users.find(u => u.id === p.userId) : undefined
          }))
        return { ...session, participants }
      }
      return session
    },
    findMany: async ({ where, include, orderBy }: any) => {
      let sessions = mockData.gameSessions
      if (where?.status) {
        sessions = sessions.filter(s => s.status === where.status)
      }
      
      return sessions.map(session => {
        if (session && include?.participants) {
          const participants = mockData.gameParticipations
            .filter(p => p.gameSessionId === session.id)
            .filter(p => !where?.participants?.where?.leftAt || p.leftAt === null)
            .map(p => ({
              ...p,
              user: include.participants.include?.user ? 
                mockData.users.find(u => u.id === p.userId) : undefined
            }))
          return { ...session, participants }
        }
        return session
      })
    },
    create: async ({ data, include }: any) => {
      const session: MockGameSession = {
        id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
        ...data,
      }
      mockData.gameSessions.push(session)

      if (data.participants?.create) {
        const participation: MockGameParticipation = {
          id: `participation_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          gameSessionId: session.id,
          isAlive: true,
          joinedAt: new Date(),
          ...data.participants.create,
          user: mockData.users.find(u => u.id === data.participants.create.userId)!,
        }
        mockData.gameParticipations.push(participation)
        session.participants = [participation]
      }

      return session
    },
    update: async ({ where, data, include }: any) => {
      const index = mockData.gameSessions.findIndex(g => g.id === where.id)
      if (index !== -1) {
        mockData.gameSessions[index] = { 
          ...mockData.gameSessions[index], 
          ...data,
          updatedAt: new Date()
        }
        const session = mockData.gameSessions[index]
        
        if (session && include?.participants) {
          const participants = mockData.gameParticipations
            .filter(p => p.gameSessionId === session.id)
            .map(p => ({
              ...p,
              user: include.participants.include?.user ? 
                mockData.users.find(u => u.id === p.userId) : undefined
            }))
          return { ...session, participants }
        }
        return session
      }
      throw new Error('Game session not found')
    },
  },
  gameParticipation: {
    findUnique: async ({ where }: any) => {
      if (where.userId_gameSessionId) {
        return mockData.gameParticipations.find(p => 
          p.userId === where.userId_gameSessionId.userId && 
          p.gameSessionId === where.userId_gameSessionId.gameSessionId
        ) || null
      }
      return mockData.gameParticipations.find(p => p.id === where.id) || null
    },
    findMany: async ({ where, include, orderBy }: any) => {
      let participations = mockData.gameParticipations
      if (where?.userId) {
        participations = participations.filter(p => p.userId === where.userId)
      }
      
      return participations.map(p => {
        const result: any = { ...p }
        if (include?.user) {
          result.user = mockData.users.find(u => u.id === p.userId)!
        }
        if (include?.gameSession) {
          const gameSession = mockData.gameSessions.find(g => g.id === p.gameSessionId)!
          if (include.gameSession.include?.participants) {
            const participants = mockData.gameParticipations
              .filter(part => part.gameSessionId === gameSession.id)
              .map(part => ({
                ...part,
                user: include.gameSession.include.participants.include?.user ? 
                  mockData.users.find(u => u.id === part.userId) : undefined
              }))
            result.gameSession = { ...gameSession, participants }
          } else {
            result.gameSession = gameSession
          }
        }
        return result
      })
    },
    create: async ({ data }: any) => {
      const participation: MockGameParticipation = {
        id: `participation_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        isAlive: true,
        joinedAt: new Date(),
        ...data,
        user: mockData.users.find(u => u.id === data.userId)!,
      }
      mockData.gameParticipations.push(participation)
      return participation
    },
    update: async ({ where, data }: any) => {
      const index = mockData.gameParticipations.findIndex(p => p.id === where.id)
      if (index !== -1) {
        mockData.gameParticipations[index] = { 
          ...mockData.gameParticipations[index], 
          ...data 
        }
        return mockData.gameParticipations[index]
      }
      throw new Error('Participation not found')
    },
  },
}

// Create a mock user for testing
const mockUser: MockUser = {
  id: 'user_123',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
}
mockData.users.push(mockUser)