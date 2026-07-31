import type { RecentMatchSummary, UserSummary } from "../../shared/trpc/appRouter";
import { trpcClient } from "./trpc";

export async function fetchRecentMatches(username: string, limit = 10) {
  return trpcClient.match.recentByUsername.query({ username, limit });
}
export async function fetchCurrentUserMatches(limit = 10) {
  return trpcClient.match.recentForCurrentUser.query({ limit });
}

export async function searchUsers(query: string, limit = 25) {
  return trpcClient.admin.searchUsers.query({ query, limit });
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  return trpcClient.admin.setUserAdmin.mutate({ userId, isAdmin });
}

export type { RecentMatchSummary, UserSummary };
