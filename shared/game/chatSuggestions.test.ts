import { describe, expect, it } from "vitest";
import { chatSuggestions, filterChatSuggestions, insertChatSuggestion, suggestionQuery } from "./chatSuggestions";

describe("chat suggestions", () => {
  it("finds public players, roles and action words without reading hidden assignments", () => {
    const options = chatSuggestions([{ name: "Alex" }, { name: "Finn" }], "Custom Medic");
    expect(filterChatSuggestions(options, "alex")).toEqual([{ label: "Alex", kind: "Player" }]);
    expect(filterChatSuggestions(options, "doctor")).toContainEqual({ label: "Doctor", kind: "Role" });
    expect(filterChatSuggestions(options, "vote")).toContainEqual({ label: "Vote", kind: "Action" });
    expect(filterChatSuggestions(options, "custom medic")).toContainEqual({ label: "Custom Medic", kind: "Role" });
  });
  it("replaces the complete token at the cursor and preserves the surrounding text", () => {
    const text = "Ask /doct later";
    const query = suggestionQuery(text, 7)!;
    expect(insertChatSuggestion(text, query, "Doctor")).toEqual({ text: "Ask Doctor later", cursor: 10 });
    expect(suggestionQuery("https://example", 8)).toBeNull();
    expect(suggestionQuery("/mafia inv", 10)?.query).toBe("mafia inv");
  });
  it("refuses insertion beyond the chat limit", () => {
    const text = `${"a".repeat(148)} /`;
    expect(insertChatSuggestion(text, suggestionQuery(text, text.length)!, "Alex")).toBeNull();
  });
});
