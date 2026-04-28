import { StyleSheet } from "react-native";
import { colors } from "./colors";

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  centeredText: {
    color: colors.textPrimary,
    textAlign: "center",
  },
  rowContainer: {
    flexDirection: "row",
  },
  button: {
    marginTop: 8,
  },
  inputBorder: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
