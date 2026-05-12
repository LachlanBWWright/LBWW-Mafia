import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { roleSections } from "@mernmafia/shared/game/rolesList";
import { RoleFaction } from "@mernmafia/shared/game/rolesTypes";
import type { RoleCatalogEntry } from "@mernmafia/shared/game/rolesTypes";
import { StackParamList } from "../App";
import { Badge, Card, Screen } from "../components/ui";

type RolesScreenProps = NativeStackScreenProps<StackParamList, "Roles">;

function RoleSection({
  title,
  accentClassName,
  roles,
}: {
  title: string;
  accentClassName: string;
  roles: readonly RoleCatalogEntry[];
}) {
  return (
    <View className="gap-3">
      <Text className="text-[22px] font-extrabold text-foreground">
        <Text className={accentClassName}>{title}</Text> Roles
      </Text>
      <View className="gap-3">
        {roles.map((role) => (
          <Card key={role.name}>
            <View className="gap-1.5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-base font-extrabold text-foreground">
                  {role.name}
                </Text>
                <Badge variant="outline">{role.category}</Badge>
              </View>
              <Text className="text-sm leading-[19px] text-muted-foreground">{role.summary}</Text>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

export function RolesScreen({ navigation }: RolesScreenProps) {
  const accentClassNameByFaction = {
    [RoleFaction.Town]: "text-primary",
    [RoleFaction.Mafia]: "text-destructive",
    [RoleFaction.Neutral]: "text-muted-foreground",
  } as const;

  return (
    <Screen
      navigation={navigation}
      activeRoute="Roles"
      title="Game Roles"
      subtitle="Reference of active roles used by the server role handler."
    >
      <View className="gap-5">
        {roleSections.map((section) => (
          <RoleSection
            key={section.title}
            title={section.title}
            accentClassName={accentClassNameByFaction[section.faction]}
            roles={section.roles}
          />
        ))}
      </View>
    </Screen>
  );
}
