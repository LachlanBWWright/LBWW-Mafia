import "react-native-reanimated";
import "./global.css";
import React from "react";
import { NavigationContainer, DarkTheme, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppStateProvider } from "./context/AppStateContext";
import { LandingScreen } from "./screens/LandingScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { RolesScreen } from "./screens/RolesScreen";
import { AboutScreen } from "./screens/AboutScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { colors } from "./styles/colors";
import { SafeAreaProvider } from "react-native-safe-area-context";

export type StackParamList = {
  Home: undefined;
  Lobby: undefined;
  Roles: undefined;
  About: undefined;
  History: undefined;
  Profile: undefined;
  Admin: undefined;
  SignIn: undefined;
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

export function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <NavigationContainer theme={appTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Home" component={LandingScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Roles" component={RolesScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
        </Stack.Navigator>
        </NavigationContainer>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const isStorybookEnabled =
  process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true" ||
  process.env.STORYBOOK_ENABLED === "true";

let AppEntryPoint: React.ComponentType = App;

if (isStorybookEnabled) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StorybookUI = require("./.rnstorybook").default;
  AppEntryPoint = StorybookUI;
}

export default AppEntryPoint;

