"use client";
import { useId, useRef, useState } from "react";
import { chatSuggestions, filterChatSuggestions, insertChatSuggestion, suggestionQuery, type ChatSuggestion } from "@mernmafia/shared/game/chatSuggestions";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function ChatComposer({ value, onChange, onSend, players, ownRole, disabled, placeholder }: {
  value: string; onChange: (value: string) => void; onSend: () => void;
  players: readonly { name: string }[]; ownRole?: string; disabled: boolean; placeholder: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [cursor, setCursor] = useState(0);
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [offset, setOffset] = useState(0);
  const query = focused && !disabled && !dismissed ? suggestionQuery(value, cursor) : null;
  const options = query ? filterChatSuggestions(chatSuggestions(players, ownRole), query.query).filter((option) => insertChatSuggestion(value, query, option.label) !== null) : [];
  const active = Math.min(selected, Math.max(0, options.length - 1));
  function updateCursor(element: HTMLInputElement) {
    const position = element.selectionStart ?? 0;
    setCursor(element.selectionStart === element.selectionEnd ? position : -1);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    const style = getComputedStyle(element);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const x = context.measureText(element.value.slice(0, position)).width + parseFloat(style.paddingLeft) - element.scrollLeft;
    setOffset(Math.max(0, Math.min(x, element.clientWidth - 220)));
  }
  function choose(option: ChatSuggestion) {
    if (!query) return;
    const result = insertChatSuggestion(value, query, option.label);
    if (!result) return;
    onChange(result.text);
    setCursor(result.cursor);
    setDismissed(true);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(result.cursor, result.cursor); });
  }
  return <div className="flex shrink-0 gap-3 border-t px-4 py-4 sm:px-6">
    <div className="relative min-w-0 flex-1">
      {options.length > 0 ? <div id={id} role="listbox" aria-label="Chat suggestions" className="bg-popover text-popover-foreground absolute bottom-full z-20 mb-2 max-h-64 w-56 max-w-full overflow-y-auto rounded-md border p-1 shadow-lg" style={{ left: offset }}>
        {options.map((option, index) => <button key={`${option.kind}:${option.label}`} type="button" role="option" id={`${id}-${index}`} aria-selected={index === active} className={`flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm ${index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}><span className="truncate">{option.label}</span><span className="text-muted-foreground text-xs">{option.kind}</span></button>)}
      </div> : null}
      <Input ref={input} className="h-11" aria-label="Message" aria-autocomplete="list" aria-controls={options.length ? id : undefined} aria-activedescendant={options.length ? `${id}-${active}` : undefined} maxLength={150} placeholder={placeholder} value={value} onFocus={(event) => { setFocused(true); updateCursor(event.currentTarget); }} onBlur={() => setFocused(false)} onSelect={(event) => updateCursor(event.currentTarget)} onChange={(event) => { onChange(event.target.value); setSelected(0); setDismissed(false); updateCursor(event.currentTarget); }} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (options.length && event.key === "ArrowDown") { event.preventDefault(); setSelected((active + 1) % options.length); }
        else if (options.length && event.key === "ArrowUp") { event.preventDefault(); setSelected((active + options.length - 1) % options.length); }
        else if (options.length && (event.key === "Enter" || event.key === "Tab")) { event.preventDefault(); choose(options[active]!); }
        else if (options.length && event.key === "Escape") { event.preventDefault(); setDismissed(true); }
        else if (event.key === "Enter") { event.preventDefault(); onSend(); }
      }} disabled={disabled} />
    </div>
    <Button className="h-11 px-5" onClick={onSend} disabled={disabled || !value.trim()}>Send</Button>
  </div>;
}
