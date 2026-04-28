import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { Badge, Card, Screen } from "../components/ui";
import { colors } from "../styles/colors";

type RoleEntry = {
  name: string;
  category: string;
  ability: string;
};

const townRoles: RoleEntry[] = [
  { name: "Doctor", category: "Town Protective", ability: "Protect a player from attacks." },
  { name: "Judge", category: "Town Investigative", ability: "Investigate alignments with uncertainty." },
  { name: "Watchman", category: "Town Investigative", ability: "See visitors to your target." },
  { name: "Investigator", category: "Town Investigative", ability: "Inspect faction clues at night." },
  { name: "Lawman", category: "Town Support", ability: "Coordinate with Lawman faction members." },
  { name: "Vetter", category: "Town Investigative", ability: "Vet two players to compare identities." },
  { name: "Tapper", category: "Town Support", ability: "Tap players to expose whispers/actions." },
  { name: "Tracker", category: "Town Investigative", ability: "Track who a target visits." },
  { name: "Bodyguard", category: "Town Protective", ability: "Guard a player and counter attackers." },
  { name: "Nimby", category: "Town Utility", ability: "Punish hostile visits to your target area." },
  { name: "Sacrificer", category: "Town Protective", ability: "Absorb damage for allies." },
  { name: "Fortifier", category: "Town Protective", ability: "Increase a target's defense." },
  { name: "Roleblocker", category: "Town Support", ability: "Prevent a player from acting." },
  { name: "Jailor", category: "Town Control", ability: "Jail and execute key suspects." },
];

const mafiaRoles: RoleEntry[] = [
  { name: "Mafia", category: "Mafia Killing", ability: "Perform faction attacks at night." },
  { name: "Mafia Roleblocker", category: "Mafia Support", ability: "Roleblock priority targets." },
  { name: "Mafia Investigator", category: "Mafia Investigative", ability: "Discover threat roles." },
];

const neutralRoles: RoleEntry[] = [
  { name: "Maniac", category: "Neutral Killing", ability: "Eliminate players for solo victory." },
  { name: "Sniper", category: "Neutral Killing", ability: "Take precision shots with constraints." },
  { name: "Framer", category: "Neutral Evil", ability: "Manipulate voting outcomes around targets." },
  { name: "Confesser", category: "Neutral Chaos", ability: "Win by being voted out." },
  { name: "Peacemaker", category: "Neutral Benign", ability: "Force a draw by prolonged peace." },
];

type RolesScreenProps = NativeStackScreenProps<StackParamList, "Roles">;

function RoleSection({
  title,
  accent,
  roles,
}: {
  title: string;
  accent: string;
  roles: RoleEntry[];
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>
        <Text style={{ color: accent }}>{title}</Text> Roles
      </Text>
      <View style={{ gap: 12 }}>
        {roles.map((role) => (
          <Card key={role.name}>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>
                  {role.name}
                </Text>
                <Badge variant="outline">{role.category}</Badge>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
                {role.ability}
              </Text>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

export function RolesScreen({ navigation }: RolesScreenProps) {
  return (
    <Screen
      navigation={navigation}
      activeRoute="Roles"
      title="Game Roles"
      subtitle="Reference of active roles used by the server role handler."
    >
      <View style={{ gap: 20 }}>
        <RoleSection title="Town" accent={colors.primary} roles={townRoles} />
        <RoleSection title="Mafia" accent={colors.destructive} roles={mafiaRoles} />
        <RoleSection title="Neutral" accent={colors.mutedForeground} roles={neutralRoles} />
      </View>
    </Screen>
  );
}
