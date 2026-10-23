import React from "react";
import type { Preview } from "@storybook/react-native";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStateProvider } from "../context/AppStateContext";
import "../global.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <SafeAreaProvider>
        <AppStateProvider>
          <View className="flex-1 bg-background p-4">
            <Story />
          </View>
        </AppStateProvider>
      </SafeAreaProvider>
    ),
  ],
  parameters: {
    backgrounds: {
      default: "app",
      values: [{ name: "app", value: "#060912" }],
    },
  },
};

export default preview;
