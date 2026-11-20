import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { GameSnapshot } from "../../shared/communication/events";
import { publicSetupLines } from "../../shared/game/gameSetupPresentation";
import { Button } from "./ui";

export function GameSetupSummary({
  setup,
  started,
}: {
  setup?: GameSnapshot["setup"];
  started?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!setup) return null;
  const open = !started || expanded;
  return (
    <View className="border-b border-border py-1">
      <Button
        variant="ghost"
        size="sm"
        accessibilityLabel={open ? "Hide game setup" : "Show game setup"}
        onPress={() => setExpanded((value) => !value)}
      >
        Game setup
      </Button>
      {open ? (
        <ScrollView className="max-h-[150px]">
          <View className="gap-1 pb-2">
            {publicSetupLines(setup).map((line) => (
              <Text key={line} className="text-xs text-muted-foreground">
                {line}
              </Text>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
