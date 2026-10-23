import { saveMobileSession } from "../lib/mobileSession";
import { signInWithGoogle } from "../lib/googleSignIn";
import React, { useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StackParamList } from "../App";
import { Button, Screen } from "../components/ui";
import { useAppState } from "../context/AppStateContext";
type Props = NativeStackScreenProps<StackParamList, "SignIn">;
export function SignInScreen({ navigation }: Props) {
  const state = useAppState();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const session = await signInWithGoogle();
      if (!session) return;
      await saveMobileSession(session);
      state.setAuthToken(session.token);
      state.setPlayerName(session.user.handle ?? session.user.name ?? "Player");
      state.setIsAdmin(session.user.isAdmin);
      navigation.replace("Profile");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to sign in. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Screen navigation={navigation} activeRoute="SignIn" title="Sign in">
      <View className="gap-4">
        {error ? (
          <Text accessibilityRole="alert" className="text-destructive">
            {error}
          </Text>
        ) : null}
        <Button disabled={submitting} onPress={() => void submit()}>
          {submitting ? "Signing in…" : "Continue with Google"}
        </Button>
      </View>
    </Screen>
  );
}
