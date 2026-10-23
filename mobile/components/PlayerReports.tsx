import React, {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Text, View } from "react-native";
import type { PlayerReport } from "../../shared/trpc/accountFeatures";
import { getAuthToken, subscribeAuthToken } from "../lib/authToken";
import { trpcClient } from "../lib/trpc";
import { Button, Input } from "./ui";
export function PlayerReports({
  moderation = false,
  initialReports,
}: {
  moderation?: boolean;
  initialReports?: PlayerReport[];
}) {
  const authToken = useSyncExternalStore(
    subscribeAuthToken,
    getAuthToken,
    getAuthToken,
  );
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [reports, setReports] = useState<PlayerReport[]>(initialReports ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const load = useCallback(async () => {
    const requestToken = authToken;
    if (!requestToken) return;
    try {
      const nextReports = await trpcClient.features.reports.query();
      if (getAuthToken() !== requestToken) return;
      setLoadedToken(requestToken);
      setReports(nextReports);
      setError("");
    } catch {
      if (getAuthToken() !== requestToken) return;
      setError("Unable to load reports.");
    }
  }, [authToken]);
  useEffect(() => {
    if (initialReports === undefined) void load();
  }, [initialReports, load]);
  async function review(
    id: number,
    status: "reviewing" | "resolved" | "dismissed",
  ) {
    setBusy(true);
    try {
      await trpcClient.features.reviewReport.mutate({
        id,
        status,
        resolution: notes[id] ?? "",
      });
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to update report.",
      );
    } finally {
      setBusy(false);
    }
  }
  const visibleReports =
    initialReports !== undefined || loadedToken === authToken ? reports : [];
  return (
    <View className="gap-3 py-4">
      <Text className="text-xl font-semibold text-foreground">
        {moderation ? "Player reports" : "Your reports"}
      </Text>
      {!visibleReports.length ? (
        <Text className="text-muted-foreground">No reports.</Text>
      ) : null}
      {visibleReports.map((report) => (
        <View key={report.id} className="border-b border-border py-3 gap-2">
          <Text className="font-semibold text-foreground">
            Report #{report.id} · {report.reason} · {report.status}
          </Text>
          <Text className="text-foreground">{report.details}</Text>
          {report.matchId ? (
            <Text className="text-sm text-muted-foreground">
              Match #{report.matchId}
            </Text>
          ) : null}
          {report.messageId ? (
            <Text className="text-sm text-muted-foreground">
              Message #{report.messageId}
            </Text>
          ) : null}
          {report.resolution ? (
            <Text className="text-foreground">
              Outcome: {report.resolution}
            </Text>
          ) : null}
          {moderation ? (
            <>
              <Text className="text-xs text-muted-foreground">
                Reported player: {report.subjectId} · Reporter:{" "}
                {report.reporterId}
              </Text>
              <Input
                accessibilityLabel={`Resolution for report ${report.id}`}
                placeholder="Resolution"
                maxLength={1000}
                value={notes[report.id] ?? ""}
                onChangeText={(value) =>
                  setNotes({ ...notes, [report.id]: value })
                }
              />
              <View className="flex-row flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onPress={() => void review(report.id, "reviewing")}
                >
                  Review
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onPress={() => void review(report.id, "resolved")}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onPress={() => void review(report.id, "dismissed")}
                >
                  Dismiss
                </Button>
              </View>
            </>
          ) : null}
        </View>
      ))}
      {error ? (
        <View>
          <Text accessibilityLiveRegion="polite" className="text-destructive">
            {error}
          </Text>
          <Button variant="outline" onPress={() => void load()}>
            Retry
          </Button>
        </View>
      ) : null}
    </View>
  );
}
