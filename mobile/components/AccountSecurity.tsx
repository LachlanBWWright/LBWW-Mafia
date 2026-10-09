import React, { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Button, SectionHeader } from "./ui";
import { trpcClient } from "../lib/trpc";
type Device = { id: string; deviceName: string; createdAt: Date };
export function AccountSecurity({
  initialSessions,
}: {
  initialSessions?: Device[];
}) {
  const [sessions, setSessions] = useState<Device[]>(initialSessions ?? []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialSessions) return;
    void trpcClient.account.deviceSessions
      .query()
      .then(setSessions)
      .catch(() => setMessage("Unable to load device sessions."));
  }, [initialSessions]);
  async function revoke(id: string) {
    setBusy(true);
    try {
      await trpcClient.account.revokeDeviceSession.mutate({ sessionId: id });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch {
      setMessage("Unable to sign out device. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-3 border-t border-border pt-5">
      <SectionHeader title="Account security" />
      <Text className="text-sm text-muted-foreground">
        Sign-in is managed by your Google account.
      </Text>
      <Button
        variant="outline"
        onPress={() =>
          void Linking.openURL("https://myaccount.google.com/security")
        }
      >
        Manage Google security
      </Button>
      <SectionHeader title="Mobile devices" />
      {sessions.length ? (
        sessions.map((session) => (
          <View key={session.id} className="gap-2 border-b border-border pb-3">
            <Text className="text-foreground">{session.deviceName}</Text>
            <Button
              variant="outline"
              disabled={busy}
              onPress={() => void revoke(session.id)}
            >{`Sign out ${session.deviceName}`}</Button>
          </View>
        ))
      ) : (
        <Text className="text-sm text-muted-foreground">
          No active mobile sessions.
        </Text>
      )}
      {message ? (
        <Text accessibilityRole="alert" className="text-sm text-foreground">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
