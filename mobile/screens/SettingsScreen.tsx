import { AccountPreferences } from "../components/AccountPreferences";
import { AccountSecurity } from "../components/AccountSecurity";
import React, { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AccountProfile } from "../../shared/trpc/appRouter";
import { StackParamList } from "../App";
import {
  Button,
  Card,
  Input,
  LoadingCard,
  Screen,
  SectionHeader,
} from "../components/ui";
import { useAppState } from "../context/AppStateContext";
import { trpcClient } from "../lib/trpc";
import { colors } from "../styles/colors";

type Props = NativeStackScreenProps<StackParamList, "Settings">;
export function SettingsScreen({ navigation }: Props) {
  const { setAuthToken, setPlayerName, setIsAdmin } = useAppState();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [profileVisibility, setProfileVisibility] = useState<
    "public" | "friends" | "private"
  >("public");
  const [historyVisibility, setHistoryVisibility] = useState<
    "public" | "friends" | "private"
  >("public");
  const [theme, setTheme] = useState<"dark" | "light" | "system">("system");
  useEffect(() => {
    void trpcClient.account.profile
      .query()
      .then((value) => {
        setProfile(value);
        setName(value.name ?? "");
        setHandle(value.handle ?? "");
        setBio(value.bio ?? "");
        setReducedMotion(value.reducedMotion);
        setSoundEnabled(value.soundEnabled);
        setNotificationsEnabled(value.notificationsEnabled);
        setProfileVisibility(
          value.profileVisibility as typeof profileVisibility,
        );
        setHistoryVisibility(
          value.historyVisibility as typeof historyVisibility,
        );
        setTheme(value.theme as typeof theme);
      })
      .catch(() => setMessage("Unable to load account settings."));
  }, []);
  if (!profile)
    return (
      <Screen navigation={navigation} activeRoute="Settings" title="Settings">
        <LoadingCard label={message || "Loading account settings…"} />
      </Screen>
    );
  async function save() {
    try {
      const updated = await trpcClient.account.updateProfile.mutate({
        name,
        handle,
        bio,
        profileVisibility,
        historyVisibility,
        theme,
        reducedMotion,
        soundEnabled,
        notificationsEnabled,
      });
      setProfile(updated);
      setMessage("Settings saved.");
    } catch {
      setMessage("Unable to save settings.");
    }
  }
  return (
    <Screen
      navigation={navigation}
      activeRoute="Settings"
      title="Settings"
      subtitle="Profile, privacy, and game preferences."
    >
      <Card>
        <SectionHeader title="Profile" />
        <Input value={name} onChangeText={setName} placeholder="Display name" />
        <Input
          value={handle}
          onChangeText={setHandle}
          placeholder="Handle"
          autoCapitalize="none"
        />
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder="Bio"
          multiline
          maxLength={280}
        />
      </Card>
      <Card>
        <SectionHeader title="Preferences" />
        {[
          {
            label: "Profile visibility",
            value: profileVisibility,
            setValue: setProfileVisibility,
          },
          {
            label: "History visibility",
            value: historyVisibility,
            setValue: setHistoryVisibility,
          },
        ].map((control) => (
          <View key={control.label} className="gap-2">
            <Text className="text-sm text-foreground">{control.label}</Text>
            <View className="flex-row flex-wrap gap-2">
              {(["public", "friends", "private"] as const).map((value) => (
                <Button
                  key={value}
                  variant={control.value === value ? "primary" : "outline"}
                  onPress={() => control.setValue(value)}
                >
                  {value[0]!.toUpperCase() + value.slice(1)}
                </Button>
              ))}
            </View>
          </View>
        ))}
        <Text className="text-sm text-foreground">Theme</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["dark", "light", "system"] as const).map((value) => (
            <Button
              key={value}
              variant={theme === value ? "primary" : "outline"}
              onPress={() => setTheme(value)}
            >
              {value[0]!.toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </View>
        {[
          ["Reduced motion", reducedMotion, setReducedMotion],
          ["Game sound", soundEnabled, setSoundEnabled],
          ["Notifications", notificationsEnabled, setNotificationsEnabled],
        ].map(([label, value, setter]) => (
          <View
            key={String(label)}
            className="flex-row items-center justify-between"
          >
            <Text className="text-sm text-foreground">{String(label)}</Text>
            <Switch
              value={Boolean(value)}
              onValueChange={setter as (value: boolean) => void}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
        <Button onPress={() => void save()}>Save settings</Button>
        <Button
          variant="outline"
          onPress={() => {
            setAuthToken(null);
            setPlayerName("");
            setIsAdmin(false);
            navigation.replace("SignIn");
          }}
        >
          Sign out
        </Button>
        <Text className="text-sm text-muted-foreground">{message}</Text>
      </Card>
      <AccountSecurity />
      <AccountPreferences
        onDeleted={() => {
          setAuthToken(null);
          navigation.replace("SignIn");
        }}
      />
    </Screen>
  );
}
