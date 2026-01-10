import { StyleSheet } from "react-native";

export const commonStyles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    marginTop: "auto",
    flex: 1,
    padding: 20,
  },
  centeredText: {
    justifyContent: "flex-start",
    alignSelf: "center",
  },
  rowContainer: {
    flexDirection: "row",
  },
  button: {
    margin: 4,
  },
  inputBorder: {
    borderColor: "#0000FF",
    borderWidth: 1,
    borderRadius: 10,
    margin: 4,
  },
});
