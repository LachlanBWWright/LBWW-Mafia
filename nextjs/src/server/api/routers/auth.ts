import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const authRouter = createTRPCRouter({
  // Get current session
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  // Mobile Google OAuth token exchange
  // This endpoint verifies a Google ID token from mobile and creates/returns a session
  googleMobileAuth: publicProcedure
    .input(z.object({ idToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement Google ID token verification
      // For now, we'll create a simplified version
      // In production, use google-auth-library to verify the token
      
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Google mobile authentication coming soon. Use demo mode for now.',
      });
    }),

  // Logout (invalidate session)
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Session is JWT-based, so we just return success
    // Client should clear the session cookie/token
    return { success: true };
  }),

  // Delete account (soft delete)
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    
    // Instead of hard delete, we could mark as deleted
    // For now, we'll actually delete
    await ctx.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  }),
});
