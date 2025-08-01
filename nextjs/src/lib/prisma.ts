// Use mock Prisma client for development when the real one is not available
// This allows us to test the tRPC endpoints and UI without a working database
export { prisma } from './prisma-mock'

// Uncomment the lines below and comment out the line above when Prisma is properly set up:
// import { PrismaClient } from '@prisma/client'
// 
// const globalForPrisma = globalThis as unknown as {
//   prisma: PrismaClient | undefined
// }
// 
// export const prisma = globalForPrisma.prisma ?? new PrismaClient()
// 
// if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma