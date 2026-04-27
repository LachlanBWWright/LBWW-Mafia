import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

/**
 * NextAuth.js authentication instance with React caching.
 * The cache wrapper ensures the session is only fetched once per request.
 * Also exports handlers, signIn, and signOut functions.
 */
const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
