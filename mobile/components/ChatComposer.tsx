import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { chatSuggestions, filterChatSuggestions, insertChatSuggestion, suggestionQuery, type ChatSuggestion } from "../../shared/game/chatSuggestions";
import { colors } from "../styles/colors";
import { Button } from "./ui";

export function ChatComposer({ value, onChange, onSend, players, ownRole, disabled, placeholder }: {
  value: string; onChange: (value: string) => void; onSend: () => void;
  players: readonly { name: string }[]; ownRole?: string; disabled: boolean; placeholder: string;
}) {
  const input = useRef<TextInput>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  const [cursor, setCursor] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const query = focused && !disabled && !dismissed ? suggestionQuery(value, cursor) : null;
  const options = query ? filterChatSuggestions(chatSuggestions(players, ownRole), query.query).filter((option) => insertChatSuggestion(value, query, option.label) !== null) : [];
  function choose(option: ChatSuggestion) {
    if (!query) return;
    const result = insertChatSuggestion(value, query, option.label);
    if (!result) return;
    clearTimeout(blurTimer.current);
    onChange(result.text);
    setCursor(result.cursor);
    setSelection({ start: result.cursor, end: result.cursor });
    setDismissed(true);
    input.current?.focus();
  }
  return <View className="flex-row items-end gap-2 border-t border-border pt-2">
    <View className="relative min-w-0 flex-1">
      {options.length > 0 ? <View className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-lg border border-border bg-card" accessibilityLabel="Chat suggestions">
        <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="always" nestedScrollEnabled>
          {options.map((option) => <Pressable key={`${option.kind}:${option.label}`} focusable accessibilityRole="button" accessibilityLabel={`${option.label}, ${option.kind}`} onFocus={() => { clearTimeout(blurTimer.current); setFocused(true); }} onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 150); }} onPress={() => choose(option)} className="flex-row items-center justify-between gap-3 px-3 py-2"><Text className="flex-1 text-sm text-foreground">{option.label}</Text><Text className="text-xs text-muted-foreground">{option.kind}</Text></Pressable>)}
        </ScrollView>
      </View> : null}
      <TextInput ref={input} className="min-h-11 max-h-28 rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground" accessibilityLabel="Message" value={value} onFocus={() => { clearTimeout(blurTimer.current); setFocused(true); }} onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 150); }} onChangeText={(next) => { setCursor((position) => Math.max(0, Math.min(next.length, position + next.length - value.length))); setSelection(undefined); setDismissed(false); onChange(next); }} onSelectionChange={(event) => { const { start, end } = event.nativeEvent.selection; setCursor(start === end ? start : -1); if (selection && start === selection.start && end === selection.end) setSelection(undefined); }} selection={selection} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} editable={!disabled} multiline maxLength={150} />
    </View>
    <Button onPress={onSend} disabled={disabled || !value.trim()}>Send</Button>
  </View>;
}
