import "react-native-reanimated";
import "./global.css";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  DarkTheme,
  NavigationContainer,
  Theme,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { HomeScreen } from "./screens/HomeScreen";
import { PrivateGameLobbyScreen } from "./screens/PrivateGameLobbyScreen";
import { PublicGameLobbyScreen } from "./screens/PublicGameLobbyScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { GameScreen } from "./screens/GameScreen";
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import { colors } from "./styles/colors";

export type StackParamList = {
  HomeScreen: undefined;
  PrivateGameLobbyScreen: undefined;
  PublicGameLobbyScreen: { name: string };
  SettingsScreen: undefined;
  GameScreen: { title: string; name: string };
};

const Stack = createNativeStackNavigator<StackParamList>();

const appTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    text: colors.textPrimary,
    primary: colors.accent,
    notification: colors.danger,
  },
};

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
  },
  iconPadding: {
    paddingHorizontal: 7,
  },
});

function HeaderRight({
  navigation,
}: {
  navigation: NativeStackNavigationProp<StackParamList, "HomeScreen">;
}) {
  return (
    <View style={styles.headerRight}>
      <Pressable onPress={() => navigation.navigate("SettingsScreen")}>
        <Icon
          name="settings"
          size={30}
          color={colors.accent}
          style={styles.iconPadding}
        />
      </Pressable>
    </View>
  );
}

function HeaderLeft() {
  return <Text />;
}

const homeScreenOptions = (navigation: NativeStackNavigationProp<StackParamList, "HomeScreen">) => ({
  title: "LBWW Mafia",
  headerRight: () => <HeaderRight navigation={navigation} />, 
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
});

const gameScreenOptions = (title: string) => ({
  title: title,
  headerLeft: HeaderLeft,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
});

export default function App() {
  return (
    <NavigationContainer theme={appTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="HomeScreen"
          component={HomeScreen}
          options={({ navigation }) => homeScreenOptions(navigation)}
        />
        <Stack.Screen
          name="PrivateGameLobbyScreen"
          component={PrivateGameLobbyScreen}
          options={{ title: "Private Games" }}
        />
        <Stack.Screen
          name="PublicGameLobbyScreen"
          component={PublicGameLobbyScreen}
          options={{ title: "Public Games" }}
        />
        <Stack.Screen
          name="SettingsScreen"
          component={SettingsScreen}
          options={{ title: "Settings" }}
        />
        <Stack.Screen
          name="GameScreen"
          component={GameScreen}
          options={({ route }) => gameScreenOptions(route.params.title)}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
