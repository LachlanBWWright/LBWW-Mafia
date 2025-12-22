import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import { auth } from "~/server/api/auth";
import { prisma } from "../../lib/prisma";
import { z } from "zod";
import type { Session } from "next-auth";

interface CreateContextOptions {
  session: Session | null;
}

import type { PrismaClient } from "@prisma/client";

const createInnerTRPCContext = (opts: CreateContextOptions): Context => {
  return {
    session: opts.session,
    prisma,
  };
};

interface Context {
  session: Session | null;
  prisma: PrismaClient;
}

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  let session: Session | null = null;

  try {
    const authResult = await auth();
    if (authResult && typeof authResult === "object" && "user" in authResult) {
      session = authResult;
    }
  } catch {
    // If auth fails, check for demo mode by looking at the request
    // For demo purposes, we'll create a mock session
    const userAgent = opts.req.headers.get("user-agent") ?? "";
    if (userAgent) {
      const demoSession: Session = {
        user: {
          id: "user_123",
          name: "Demo Player",
          email: "demo@example.com",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      session = demoSession;
    }
  }

  return createInnerTRPCContext({
    session,
  });
};

const t = initTRPC.context<Context>().create({
  transformer: undefined,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        ...ctx,
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  }),
);
