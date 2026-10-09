"use client";
import { useCallback, useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { PlayerReport } from "@mernmafia/shared/trpc/accountFeatures";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function PlayerReports({
  moderation = false,
  initialReports,
}: {
  moderation?: boolean;
  initialReports?: PlayerReport[];
}) {
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  const [reports, setReports] = useState<PlayerReport[]>(initialReports ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const load = useCallback(async () => {
    try {
      setReports(await client.features.reports.query());
      setError("");
    } catch {
      setError("Unable to load reports.");
    }
  }, [client]);
  useEffect(() => {
    if (initialReports === undefined) void Promise.resolve().then(load);
  }, [initialReports, load]);
  async function review(
    id: number,
    status: "reviewing" | "resolved" | "dismissed",
  ) {
    setBusy(true);
    try {
      await client.features.reviewReport.mutate({
        id,
        status,
        resolution: notes[id] ?? "",
      });
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to update report.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 py-6">
      <h2 className="text-xl font-semibold">
        {moderation ? "Player reports" : "Your reports"}
      </h2>
      {!reports.length ? (
        <p className="text-muted-foreground">No reports.</p>
      ) : null}
      {reports.map((report) => (
        <div key={report.id} className="space-y-2 border-b py-4">
          <p className="font-medium">
            Report #{report.id} · {report.reason} · {report.status}
          </p>
          <p className="break-words whitespace-pre-wrap">{report.details}</p>
          {report.matchId ? (
            <p className="text-sm">Match #{report.matchId}</p>
          ) : null}
          {report.messageId ? (
            <p className="text-sm">Message #{report.messageId}</p>
          ) : null}
          {report.resolution ? (
            <p className="text-sm">Outcome: {report.resolution}</p>
          ) : null}
          {moderation ? (
            <>
              <p className="text-muted-foreground text-xs break-all">
                Reported player: {report.subjectId} · Reporter:{" "}
                {report.reporterId}
              </p>
              <Input
                aria-label={`Resolution for report ${report.id}`}
                placeholder="Resolution"
                maxLength={1000}
                value={notes[report.id] ?? ""}
                onChange={(event) =>
                  setNotes({ ...notes, [report.id]: event.target.value })
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void review(report.id, "reviewing")}
                >
                  Review
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void review(report.id, "resolved")}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void review(report.id, "dismissed")}
                >
                  Dismiss
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ))}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}
    </section>
  );
}
