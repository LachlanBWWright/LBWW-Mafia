"use client";

import { useMemo, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { UserSummary } from "@mernmafia/shared/trpc/appRouter";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type AdminUserSearchProps = {
  initialQuery: string;
};

export function AdminUserSearch({ initialQuery }: AdminUserSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [status, setStatus] = useState("Run a search to view users.");

  const trpcClient = useMemo(
    () =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
          }),
        ],
      }),
    [],
  );

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
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-md border border-border/70 p-3 text-sm"
          >
            <div>
              <p className="font-medium">{user.name ?? "Unnamed user"}</p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            <Button
              variant={user.isAdmin ? "destructive" : "secondary"}
              onClick={() => toggleAdmin(user)}
            >
              {user.isAdmin ? "Revoke admin" : "Make admin"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
