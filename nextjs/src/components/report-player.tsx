"use client";
import { createReportSchema } from "@mernmafia/shared/trpc/accountFeatures";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function ReportPlayer({
  userId,
  name,
  initialMessageId,
}: {
  userId: string;
  name: string;
  initialMessageId?: number;
}) {
  const [reason, setReason] = useState<
    "harassment" | "cheating" | "spam" | "other"
  >("other");
  const [matchId, setMatchId] = useState("");
  const [messageId, setMessageId] = useState(
    initialMessageId?.toString() ?? "",
  );
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  async function submit() {
    setBusy(true);
    try {
      const parsed = createReportSchema.safeParse({
        subjectId: userId,
        reason,
        details,
        matchId: matchId ? Number(matchId) : undefined,
        messageId: messageId ? Number(messageId) : undefined,
      });
      if (!parsed.success) {
        setStatus(parsed.error.issues[0]?.message ?? "Check report details.");
        return;
      }
      await client.features.report.mutate(parsed.data);
      setOpen(false);
      setDetails("");
      setStatus("Report submitted.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to submit report.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button size="sm" variant="ghost">
            Report
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-6">
            <Dialog.Title className="text-lg font-semibold">
              Report {name}
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              Describe the behaviour you want reviewed.
            </Dialog.Description>
            {open ? (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <label className="block text-sm">
                  Reason
                  <select
                    className="bg-background block w-full rounded-md border p-2"
                    value={reason}
                    onChange={(event) =>
                      setReason(event.target.value as typeof reason)
                    }
                  >
                    {["harassment", "cheating", "spam", "other"].map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="block text-sm">
                  Incident details
                  <textarea
                    rows={4}
                    className="border-input bg-background block w-full rounded-md border px-3 py-2 text-sm"
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Describe what happened"
                    maxLength={2000}
                    required
                  />
                </label>
                <label className="block text-sm">
                  Match ID (optional)
                  <Input
                    inputMode="numeric"
                    value={matchId}
                    onChange={(event) => setMatchId(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Message ID (optional)
                  <Input
                    inputMode="numeric"
                    value={messageId}
                    onChange={(event) => setMessageId(event.target.value)}
                  />
                </label>
                <Button size="sm" disabled={busy || !details.trim()}>
                  {busy ? "Submitting…" : "Submit report"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </form>
            ) : null}
            {status ? (
              <p role="status" className="text-muted-foreground text-sm">
                {status}
              </p>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!open && status ? (
        <p role="status" className="text-muted-foreground text-sm">
          {status}
        </p>
      ) : null}
    </div>
  );
}
