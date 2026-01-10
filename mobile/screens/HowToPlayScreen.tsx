import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableNativeFeedback,
  StyleSheet,
} from "react-native";
import { commonStyles } from "../styles/commonStyles";

const styles = StyleSheet.create({
  question: {
    fontWeight: "bold",
    fontSize: 20,
  },
  answer: {
    fontSize: 14,
  },
});

export function HowToPlayScreen() {
  interface htpItem {
    question: string;
    answer: string;
  }
  const items: Array<htpItem> = [
    { question: "Question", answer: "Lorem ipsum blah blah blah" },
    { question: "Question", answer: "Lorem ipsum blah blah blah" },
    { question: "Question", answer: "Lorem ipsum blah blah blah" },
    { question: "Question", answer: "Lorem ipsum blah blah blah" },
  ];

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={items}
        renderItem={({ item }) => (
          <HowToPlayItem question={item.question} answer={item.answer} />
        )}
      />
    </View>
  );
}

function HowToPlayItem(props: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableNativeFeedback onPress={() => setOpen(!open)}>
        <Text style={styles.question}>{props.question}</Text>
      </TouchableNativeFeedback>
      {open ? <Text style={styles.answer}>{props.answer}</Text> : <></>}
    </View>
  );
}
