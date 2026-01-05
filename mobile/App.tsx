import { Pressable, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "./screens/HomeScreen";
import { HowToPlayScreen } from "./screens/HowToPlayScreen";
import { PrivateGameLobbyScreen } from "./screens/PrivateGameLobbyScreen";
import { PublicGameLobbyScreen } from "./screens/PublicGameLobbyScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { GameScreen } from "./screens/GameScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { RolesScreen } from "./screens/RolesScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { AccountScreen } from "./screens/account/AccountScreen";
import { SignInScreen } from "./screens/auth/SignInScreen";

import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import { TRPCProvider } from "./utils/trpc";

export interface StackParamList {
  [key: string]: object | undefined;
  HomeScreen: undefined;
  HowToPlayScreen: undefined;
  PrivateGameLobbyScreen: undefined;
  PublicGameLobbyScreen: { name: string };
  SettingsScreen: undefined;
  GameScreen: { lobbyId: string; title: string; name: string };
  HistoryScreen: undefined;
  LeaderboardScreen: undefined;
  RolesScreen: undefined;
  StatsScreen: undefined;
  AccountScreen: undefined;
  SignInScreen: undefined;
}

const Stack = createNativeStackNavigator<StackParamList>();

export default function App() {
  return (
    <TRPCProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="HomeScreen"
            component={HomeScreen}
            options={({ navigation, route: _route }) => ({
              title: "MERN Mafia",
              headerRight: () => (
                <View style={{ flexDirection: "row" }}>
                   <Pressable
                    onPress={() => { navigation.navigate("AccountScreen"); }}
                  >
                    <Icon
                      name="person"
                      size={30}
                      color="#3333FF"
                      style={{ paddingHorizontal: 7 }}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => { navigation.navigate("SettingsScreen"); }}
                  >
                    <Icon
                      name="settings"
                      size={30}
                      color="#3333FF"
                      style={{ paddingHorizontal: 7 }}
                    />
                  </Pressable>
                </View>
              ),
            })}
          />
          <Stack.Screen
            name="HowToPlayScreen"
            component={HowToPlayScreen}
            options={{ title: "How To Play" }}
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
            options={({ navigation: _navigation, route }) => ({
              title: route.params.title,
              headerLeft: () => <Text></Text>,
            })}
          />
          <Stack.Screen
            name="HistoryScreen"
            component={HistoryScreen}
            options={{ title: "Match History" }}
          />
          <Stack.Screen
            name="LeaderboardScreen"
            component={LeaderboardScreen}
            options={{ title: "Leaderboard" }}
          />
          <Stack.Screen
            name="RolesScreen"
            component={RolesScreen}
            options={{ title: "Roles Wiki" }}
          />
          <Stack.Screen
            name="StatsScreen"
            component={StatsScreen}
            options={{ title: "Your Stats" }}
          />
          <Stack.Screen
            name="AccountScreen"
            component={AccountScreen}
            options={{ title: "Account" }}
          />
          <Stack.Screen
             name="SignInScreen"
             component={SignInScreen}
             options={{ title: "Sign In" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </TRPCProvider>
  );
}
