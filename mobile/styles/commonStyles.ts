import { StyleSheet } from "react-native";
import { colors } from "./colors";

export const commonStyles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    marginTop: "auto",
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  centeredText: {
    justifyContent: "flex-start",
    alignSelf: "center",
    color: colors.textPrimary,
  },
  rowContainer: {
    flexDirection: "row",
  },
  button: {
    margin: 4,
  },
  inputBorder: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    margin: 4,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
