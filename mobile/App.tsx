import "react-native-reanimated";
import "./global.css";
import React from "react";
import {
  NavigationContainer,
  DarkTheme,
  type Theme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { authIdentity } from "./lib/authIdentity";
import { AppStateProvider, useAppState } from "./context/AppStateContext";
import { LandingScreen } from "./screens/LandingScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { RolesScreen } from "./screens/RolesScreen";
import { AboutScreen } from "./screens/AboutScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { CommunityScreen } from "./screens/CommunityScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { CreateLobbyScreen } from "./screens/CreateLobbyScreen";
import { colors } from "./styles/colors";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoryCapture } from "./visual/StoryCapture";

export type StackParamList = {
  Home: undefined;
  Lobby: { roomId?: string } | undefined;
  CreateLobby: undefined;
  Roles: undefined;
  About: undefined;
  History: undefined;
  Profile: undefined;
  Admin: undefined;
  SignIn: undefined;
  Community: undefined;
  Messages: undefined;
  Notifications: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<StackParamList>();

const appTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.card,
    border: colors.border,
    text: colors.foreground,
    primary: colors.primary,
    notification: colors.destructive,
  },
};

function AppNavigation() {
  const { authToken } = useAppState();
  return (
    <NavigationContainer theme={appTheme}>
      <Stack.Navigator
        key={authIdentity(authToken)}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home" component={LandingScreen} />
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        <Stack.Screen name="CreateLobby" component={CreateLobbyScreen} />
        <Stack.Screen name="Roles" component={RolesScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Community" component={CommunityScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Messages" component={MessagesScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <AppNavigation />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const isStorybookEnabled =
  process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true" ||
  process.env.STORYBOOK_ENABLED === "true";
const storybookCaptureId =
  process.env.EXPO_PUBLIC_STORYBOOK_CAPTURE_ID ??
  (typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("capture") ?? undefined)
    : undefined);

let AppEntryPoint: React.ComponentType = App;

if (isStorybookEnabled) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StorybookUI = require("./.rnstorybook").default;
  AppEntryPoint = StorybookUI;
}

if (storybookCaptureId) {
  AppEntryPoint = () => <StoryCapture storyId={storybookCaptureId} />;
}

export default AppEntryPoint;
