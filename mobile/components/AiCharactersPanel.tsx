import type { ChatGPTClient } from "../../shared/game/chatGPTConnection";
import profiles from "../../shared/game/botProfiles.json";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { useChatGPT } from "../lib/useChatGPT";
import { chatGPTUsageUrl } from "../../shared/game/chatGPTConnection";
import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatGPTIcon } from "./ChatGPTIcon";
import { Button, Input, SectionHeader } from "./ui";
import { getAccessToken } from "../lib/mobileSession";

function appBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc\/?$/, "") ??
    "http://localhost:3000"
  );
}

export function AiCharactersPanel({
  roomId,
  embedded = false,
  connectionClient,
}: {
  roomId: string;
  embedded?: boolean;
  connectionClient?: ChatGPTClient;
}) {
  const connection = useChatGPT(connectionClient);
  const [personality, setPersonality] = useState("varied");
  const [difficulty, setDifficulty] = useState("standard");
  const [botCount, setBotCount] = useState("1");
  const [mode, setMode] = useState<"shared" | "per-character">("shared");
  const { refresh } = connection;
  useEffect(() => {
    void refresh();
  }, [connectionClient, refresh]);
  const models = connection.models;
  const [requestedModel, setModel] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const model = models.some((item) => item.slug === requestedModel)
    ? requestedModel
    : (models[0]?.slug ?? "");

  const addCharacters = async () => {
    setBusy(true);
    setStatus("");
    try {
      if (
        process.env.EXPO_PUBLIC_SOCKET_BACKEND &&
        process.env.EXPO_PUBLIC_SOCKET_BACKEND !== "partyserver"
      )
        throw new Error(
          "AI characters currently require the PartyServer game server.",
        );
      const count = Number.parseInt(botCount, 10);
      if (!Number.isInteger(count) || count < 1 || count > 12)
        throw new Error("Choose between 1 and 12 bot characters.");
      if (!models.some((item) => item.slug === model))
        throw new Error("Load the available models and choose one first.");
      const token = await getAccessToken();
      const ticketResponse = await fetch(
        `${appBaseUrl()}/api/account/game-ticket`,
        {
          method: "POST",
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            "content-type": "application/json",
          },
          body: JSON.stringify({ count }),
        },
      );
      const ticketBody = (await ticketResponse.json()) as {
        tokens?: string[];
        error?: string;
      };
      if (!ticketResponse.ok || !ticketBody.tokens?.length)
        throw new Error(ticketBody.error ?? "Could not create bot seats.");
      const body = await connection.client.join(
        {
          socketUrl:
            process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:1999",
          room: roomId,
          tickets: ticketBody.tokens,
          personality,
          difficulty,
          mode,
          model,
        },
        AbortSignal.timeout(30_000),
      );
      setStatus(
        `${body.added ?? count} bot character${count === 1 ? "" : "s"} joining.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not add bot characters.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="pb-4"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-4">
        {!embedded ? (
          <SectionHeader
            title="AI characters"
            subtitle="Use your ChatGPT plan to play additional seats."
          />
        ) : null}
        <View className="gap-3 border-b border-border pb-4">
          {connection.account.connected ? (
            <>
              <Text className="text-sm font-semibold text-foreground">
                {connection.account.email ??
                  connection.account.name ??
                  "ChatGPT connected"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {connection.account.planEnabled
                  ? "ChatGPT plan usage enabled"
                  : "ChatGPT plan usage is off"}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {!connection.account.planEnabled && (
                  <Button
                    disabled={connection.busy}
                    onPress={() =>
                      void connection.connect(async (url) => {
                        await WebBrowser.openBrowserAsync(url);
                      })
                    }
                  >
                    Enable ChatGPT plan usage
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    void WebBrowser.openBrowserAsync(chatGPTUsageUrl)
                  }
                >
                  Manage usage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={connection.busy}
                  onPress={() => void connection.disconnect()}
                >
                  Disconnect
                </Button>
              </View>
              {connection.account.usagePaused && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={connection.busy}
                  onPress={() => void connection.retry()}
                >
                  Retry after checking usage
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                className="border border-white/20 bg-black"
                accessibilityLabel={
                  connection.busy ? "Connecting…" : "Continue with ChatGPT"
                }
                disabled={connection.busy}
                onPress={() =>
                  void connection.connect(async (url) => {
                    await WebBrowser.openBrowserAsync(url);
                  })
                }
              >
                <View className="flex-row items-center justify-center gap-2">
                  <ChatGPTIcon />
                  <Text className="text-sm font-semibold text-white">
                    {connection.busy ? "Connecting…" : "Continue with ChatGPT"}
                  </Text>
                </View>
              </Button>
            </>
          )}
          {connection.busy && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => void connection.cancel()}
            >
              Cancel
            </Button>
          )}
          {connection.message && (
            <Text
              accessibilityRole="alert"
              className="text-xs text-muted-foreground"
            >
              {connection.message}
            </Text>
          )}
          <Text className="text-xs text-muted-foreground">
            Keep this app open while AI characters play.
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Input
            accessibilityLabel="Bot count"
            className="flex-1"
            value={botCount}
            onChangeText={setBotCount}
            placeholder="Bot count (1–12)"
            keyboardType="number-pad"
          />
          <Input
            accessibilityLabel="Selected model"
            className="flex-1"
            value={
              model
                ? (models.find((item) => item.slug === model)?.name ?? model)
                : ""
            }
            editable={false}
            placeholder="Load a model"
          />
        </View>
        <View className="flex-row gap-2">
          <Button
            variant={mode === "shared" ? "primary" : "secondary"}
            accessibilityState={{ selected: mode === "shared" }}
            size="sm"
            className="flex-1"
            onPress={() => setMode("shared")}
          >
            Shared model
          </Button>
          <Button
            variant={mode === "per-character" ? "primary" : "secondary"}
            accessibilityState={{ selected: mode === "per-character" }}
            size="sm"
            className="flex-1"
            onPress={() => setMode("per-character")}
          >
            Separate contexts
          </Button>
        </View>
        <Text className="text-sm font-semibold text-foreground">
          Personality
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {[{ id: "varied", name: "Varied" }, ...profiles.personalities].map(
            (entry) => (
              <Button
                key={entry.id}
                size="sm"
                variant={personality === entry.id ? "primary" : "outline"}
                accessibilityState={{ selected: personality === entry.id }}
                onPress={() => setPersonality(entry.id)}
              >
                {entry.name}
              </Button>
            ),
          )}
        </View>
        <Text className="text-sm font-semibold text-foreground">
          Difficulty
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {profiles.difficulties.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              variant={difficulty === entry.id ? "primary" : "outline"}
              accessibilityState={{ selected: difficulty === entry.id }}
              onPress={() => setDifficulty(entry.id)}
            >
              {entry.name}
            </Button>
          ))}
        </View>
        <Text className="text-xs text-muted-foreground">
          {difficulty === "casual"
            ? "Simple deductions and fewer accusations."
            : difficulty === "challenging"
              ? "Stronger evidence requirements, more accusations, and more bluffing."
              : "Balanced deductions, accusations, and bluffing."}
        </Text>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onPress={() => void connection.refresh()}
            disabled={busy || connection.busy || !connection.account.connected}
          >
            {connection.busy ? "Loading…" : "Reload models"}
          </Button>
          <Button
            size="sm"
            onPress={() => void addCharacters()}
            disabled={
              busy ||
              connection.busy ||
              !models.length ||
              !connection.account.planEnabled ||
              connection.account.usagePaused
            }
          >
            {busy ? "Working…" : "Add characters"}
          </Button>
        </View>
        {models.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            {models.map((item) => (
              <Button
                key={item.slug}
                variant={item.slug === model ? "secondary" : "outline"}
                accessibilityState={{ selected: item.slug === model }}
                size="sm"
                onPress={() => setModel(item.slug)}
              >
                {item.name}
              </Button>
            ))}
          </ScrollView>
        ) : null}
        {status ? (
          <Text
            accessibilityRole="alert"
            className="text-xs text-muted-foreground"
          >
            {status}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

export function AiCharactersSetup({
  roomId,
  initialOpen = false,
  connectionClient,
}: {
  roomId: string;
  initialOpen?: boolean;
  connectionClient?: ChatGPTClient;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <Button variant="outline" size="sm" onPress={() => setOpen(true)}>
        Add AI characters
      </Button>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView
          className="flex-1 bg-background"
          edges={["top", "bottom"]}
        >
          <View className="flex-1 px-4 pb-4">
            <View className="mb-3 flex-row items-center justify-between gap-3 border-b border-border py-3">
              <Text
                accessibilityRole="header"
                className="text-xl font-semibold text-foreground"
              >
                Add AI characters
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setOpen(false)}
                accessibilityLabel="Close AI character setup"
              >
                Close
              </Button>
            </View>
            <AiCharactersPanel
              roomId={roomId}
              embedded
              connectionClient={connectionClient}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
