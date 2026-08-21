"use client";

import { useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { UserSummary } from "@mernmafia/shared/trpc/appRouter";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type AdminUserSearchProps = {
  initialQuery: string;
  initialUsers?: UserSummary[];
};

function createClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });
}

export function AdminUserSearch({
  initialQuery,
  initialUsers = [],
}: AdminUserSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState<UserSummary[]>(initialUsers);
  const [status, setStatus] = useState(
    initialUsers.length ? "" : "Run a search to view users.",
  );
  const [trpcClient] = useState(createClient);

  const searchUsers = async () => {
    setStatus("Searching users...");
    try {
      const result: UserSummary[] = await trpcClient.admin.searchUsers.query({
        query,
        limit: 50,
      });
      setUsers(result);
      setStatus(result.length === 0 ? "No users found." : "");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to search users.";
      setStatus(message);
    }
  };

  const toggleAdmin = async (user: UserSummary) => {
    try {
      await trpcClient.admin.setUserAdmin.mutate({
        userId: user.id,
        isAdmin: !user.isAdmin,
      });
      setUsers((current) =>
        current.map((entry) =>
          entry.id === user.id ? { ...entry, isAdmin: !entry.isAdmin } : entry,
        ),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update admin role.";
      setStatus(message);
    }
  };

  const assignRole = async (
    user: UserSummary,
    role: "player" | "moderator" | "support",
  ) => {
    try {
      await trpcClient.admin.setUserRoles.mutate({
        userId: user.id,
        roles: role === "player" ? ["player"] : ["player", role],
      });
      setUsers((current) =>
        current.map((entry) =>
          entry.id === user.id ? { ...entry, isAdmin: false } : entry,
        ),
      );
      setStatus(`${user.name ?? user.email} is now ${role}.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to update role.",
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
        />
        <Button onClick={searchUsers}>Search</Button>
      </div>
      {status ? (
        <p className="text-muted-foreground text-sm">{status}</p>
      ) : null}
      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="border-border/70 flex items-center justify-between rounded-md border p-3 text-sm"
          >
            <div>
              <p className="font-medium">{user.name ?? "Unnamed user"}</p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignRole(user, "player")}
              >
                Player
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignRole(user, "moderator")}
              >
                Moderator
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignRole(user, "support")}
              >
                Support
              </Button>
              <Button
                size="sm"
                variant={user.isAdmin ? "destructive" : "secondary"}
                onClick={() => toggleAdmin(user)}
              >
                {user.isAdmin ? "Revoke admin" : "Administrator"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
