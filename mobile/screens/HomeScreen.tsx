import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { View, Text, Button, TextInput, StyleSheet } from "react-native";
import { StackParamList } from "../App";
import { commonStyles } from "../styles/commonStyles";
import { colors } from "../styles/colors";

type HomeScreenProps = NativeStackScreenProps<StackParamList, "HomeScreen">;

const styles = StyleSheet.create({
  title: {
    justifyContent: "flex-start",
    alignSelf: "center",
    fontSize: 25,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  nameText: {
    justifyContent: "flex-start",
    alignSelf: "center",
    flex: 1,
    color: colors.textSecondary,
  },
  formContainer: {
    alignContent: "space-between",
  },
});

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [name, setName] = useState("");
  const [disabled, setDisabled] = useState(true);

  return (
    <View style={commonStyles.container} className="bg-slate-950">
      <Text style={styles.title}>Welcome To MERN Mafia!</Text>
      <Text style={styles.nameText}>
        {name.length !== 0 ? `Your name is "${name}"` : ""}
      </Text>

      <View style={styles.formContainer} className="gap-2">
        <TextInput
          onChangeText={(text) => {
            setName(text);
            text = validateText(text);
            setDisabled(!checkValidity(text));
          }}
          placeholder={"Enter your username, 3-12 lowercase letters only!"}
          autoComplete={"username"}
          value={name}
          style={commonStyles.inputBorder}
          placeholderTextColor={colors.textSecondary}
        />
        <View style={commonStyles.button}>
          <Button
            title="Play Private Match (TBA)"
            disabled={true}
            onPress={() => navigation.navigate("PrivateGameLobbyScreen")}
            color={colors.danger}
          />
        </View>
        <View style={commonStyles.button}>
          <Button
            title="Join Game"
            disabled={disabled}
            onPress={() =>
              navigation.navigate("GameScreen", {
                title: "MERN Mafia",
                name: validateText(name),
              })
            }
            color={colors.accent}
          />
        </View>
      </View>
    </View>
  );
}

//Makes username lowercase, removes non-alphabetical characters
function validateText(text: string): string {
  text = text.toLowerCase();
  text = text.replace(/[0-9]/g, "");
  return text;
}

//Checks if the username is valid, for enabling 'Play' buttons
function checkValidity(text: string): boolean {
  return text.length >= 3 && text.length <= 12;
}
