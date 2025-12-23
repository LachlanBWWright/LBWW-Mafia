import type { NextAuthOptions } from "next-auth";
import type { NextRequest } from "next/server";

declare module "next-auth" {
  // Handler signature used by Next.js route handlers
  export type NextAuthRouteHandler = (
    request: NextRequest,
    context: { params: Promise<{ nextauth: string[] }> },
  ) => void | Response | Promise<void | Response>;

  export default function NextAuth(
    options: NextAuthOptions,
  ): NextAuthRouteHandler;
}
