import { handlers } from "~/server/auth";

/**
 * NextAuth.js API route handlers for authentication.
 * Exports both GET and POST handlers that manage OAuth flow and session management.
 */
export const { GET, POST } = handlers;
