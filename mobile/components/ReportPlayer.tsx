import { createReportSchema } from "../../shared/trpc/accountFeatures";
import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { Button, Input } from "./ui";
import { trpcClient } from "../lib/trpc";
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
      await trpcClient.features.report.mutate(parsed.data);
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
    <View className="gap-2">
      <Button size="sm" variant="ghost" onPress={() => setOpen(!open)}>
        Report
      </Button>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-center bg-black/50 p-4">
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            <View
              accessibilityViewIsModal
              className="rounded-lg bg-background p-4 gap-2"
            >
              <Text className="text-sm text-foreground">Report {name}</Text>
              <View className="flex-row flex-wrap gap-2">
                {(["harassment", "cheating", "spam", "other"] as const).map(
                  (value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={reason === value ? "primary" : "outline"}
                      onPress={() => setReason(value)}
                    >
                      {value}
                    </Button>
                  ),
                )}
              </View>
              <Input
                value={details}
                onChangeText={setDetails}
                placeholder="Describe what happened"
                multiline
                numberOfLines={4}
                accessibilityLabel="Report details"
                maxLength={2000}
              />
              <Text className="text-sm text-foreground">
                Match ID (optional)
              </Text>
              <Input
                accessibilityLabel="Match ID (optional)"
                keyboardType="numeric"
                value={matchId}
                onChangeText={setMatchId}
              />
              <Text className="text-sm text-foreground">
                Message ID (optional)
              </Text>
              <Input
                accessibilityLabel="Message ID (optional)"
                keyboardType="numeric"
                value={messageId}
                onChangeText={setMessageId}
              />
              <Button
                size="sm"
                disabled={busy || !details.trim()}
                onPress={() => void submit()}
              >
                {busy ? "Submitting…" : "Submit report"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => setOpen(false)}
              >
                Cancel
              </Button>
              {status ? (
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-sm text-destructive"
                >
                  {status}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
      {!open && status ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-sm text-muted-foreground"
        >
          {status}
        </Text>
      ) : null}
    </View>
  );
}
