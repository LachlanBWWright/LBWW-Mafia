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
import { colors } from "./styles/colors";

export type StackParamList = {
  Home: undefined;
  Lobby: undefined;
  Roles: undefined;
  About: undefined;
  History: undefined;
  Profile: undefined;
  Admin: undefined;
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

export default function App() {
  return (
    <AppStateProvider>
      <NavigationContainer theme={appTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="Home" component={LandingScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Roles" component={RolesScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppStateProvider>
  );
}
