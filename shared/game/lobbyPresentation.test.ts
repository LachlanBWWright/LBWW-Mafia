import { describe, expect, it } from "vitest";
import { DayTime } from "../communication/events";
import { nightMatch } from "../testing/matchFixtures";
import type { LobbyMessage } from "./matchExperience";
import {
  resolveLobbyTab,
  chatMessagePresentation,
  lobbyPhaseLabel,
  roleVisitLabel,
  type LobbyTab,
} from "./lobbyPresentation";

const context = { scope: "room:player", ended: false, groupAvailable: true };

describe("web/mobile lobby tab presentation", () => {
  it.each([false, true])("defaults appropriately when ended is %s", (ended) => {
    expect(resolveLobbyTab(undefined, { ...context, ended })).toBe(
      ended ? "players" : "chat",
    );
  });

  it.each(["chat", "players", "group"] as const)(
    "preserves an explicit %s selection during ordinary updates",
    (tab) => {
      expect(resolveLobbyTab({ ...context, tab }, { ...context })).toBe(tab);
    },
  );

  it.each(["chat", "players", "group"] as const)(
    "opens results on completion after a %s selection",
    (tab) => {
      expect(
        resolveLobbyTab({ ...context, tab }, { ...context, ended: true }),
      ).toBe("players");
    },
  );

  it.each(["chat", "players", "group"] as const)(
    "allows explicit %s navigation after completion",
    (tab) => {
      const ended = { ...context, ended: true };
      expect(resolveLobbyTab({ ...ended, tab }, ended)).toBe(tab);
    },
  );

  it.each(["chat", "players", "group"] as const)(
    "returns to chat when rematching after %s was selected",
    (tab) => {
      expect(resolveLobbyTab({ ...context, ended: true, tab }, context)).toBe(
        "chat",
      );
    },
  );

  it.each([
    ["room:player", "another-room:player"],
    ["room:player", "room:spectator"],
    ["room:player", "room:eliminated"],
    ["practice:player", "room:player"],
    ["room:spectator", "practice:player"],
  ])(
    "invalidates a user choice when scope changes from %s to %s",
    (before, after) => {
      const selection = { ...context, scope: before, tab: "players" as const };
      expect(resolveLobbyTab(selection, { ...context, scope: after })).toBe(
        "chat",
      );
      expect(
        resolveLobbyTab(selection, { ...context, scope: after, ended: true }),
      ).toBe("players");
    },
  );

  it("gates group on both current and selection-time authentication", () => {
    const selection = { ...context, tab: "group" as const };
    expect(resolveLobbyTab(selection, context)).toBe("group");
    expect(
      resolveLobbyTab(selection, { ...context, groupAvailable: false }),
    ).toBe("chat");
    expect(
      resolveLobbyTab({ ...selection, groupAvailable: false }, context),
    ).toBe("chat");
    expect(
      resolveLobbyTab(
        { ...selection, groupAvailable: false },
        { ...context, groupAvailable: false },
      ),
    ).toBe("chat");
  });

  it.each(["chat", "players"] as LobbyTab[])(
    "does not reset %s solely because authentication changes",
    (tab) => {
      expect(
        resolveLobbyTab(
          { ...context, tab },
          { ...context, groupAvailable: false },
        ),
      ).toBe(tab);
      expect(
        resolveLobbyTab({ ...context, groupAvailable: false, tab }, context),
      ).toBe(tab);
    },
  );
});

describe("shared chat message presentation", () => {
  const chat: LobbyMessage = {
    id: 2,
    kind: "chat",
    sender: "Mira",
    text: "Mira: hello",
  };

  it("groups consecutive chat from the same sender and removes exactly one sender prefix", () => {
    expect(
      chatMessagePresentation(
        { ...chat, text: "Mira: Mira: hello" },
        { ...chat, id: 1 },
      ),
    ).toEqual({ grouped: true, text: "Mira: hello" });
  });

  it("does not group the first message or a different sender", () => {
    expect(chatMessagePresentation(chat)).toEqual({
      grouped: false,
      text: "hello",
    });
    expect(
      chatMessagePresentation(chat, { ...chat, sender: "Theo" }).grouped,
    ).toBe(false);
  });

  it.each(["system", "role", "spectator", "whisper", undefined] as const)(
    "does not group chat across a %s message",
    (kind) => {
      expect(chatMessagePresentation(chat, { ...chat, kind }).grouped).toBe(
        false,
      );
    },
  );

  it.each(["system", "role", "spectator", "whisper", undefined] as const)(
    "preserves %s message text and does not group it",
    (kind) => {
      expect(
        chatMessagePresentation({ ...chat, kind }, { ...chat, kind }),
      ).toEqual({ grouped: false, text: chat.text });
    },
  );

  it.each([undefined, ""])(
    "does not strip or group messages without a nonempty sender (%s)",
    (sender) => {
      const message = { ...chat, sender };
      expect(chatMessagePresentation(message, message)).toEqual({
        grouped: false,
        text: chat.text,
      });
    },
  );

  it.each(["Mira:hello", "mira: hello", "Theo: hello", "hello Mira: text", ""])(
    "preserves text without the exact leading sender prefix: %s",
    (text) => {
      expect(chatMessagePresentation({ ...chat, text }).text).toBe(text);
    },
  );

  it("handles punctuation and Unicode names literally without mutating inputs", () => {
    const message = Object.freeze({
      ...chat,
      sender: "Éva [1]",
      text: "Éva [1]: hello",
    });
    const previous = Object.freeze({ ...message, id: 1 });
    expect(chatMessagePresentation(message, previous)).toEqual({
      grouped: true,
      text: "hello",
    });
    expect(message.text).toBe("Éva [1]: hello");
  });
});

describe("shared phase heading", () => {
  it("labels waiting, day, night and completed matches consistently", () => {
    expect(lobbyPhaseLabel(nightMatch)).toBe(`${DayTime.Night} 2`);
    expect(
      lobbyPhaseLabel({ ...nightMatch, time: DayTime.Day, dayNumber: 3 }),
    ).toBe(`${DayTime.Day} 3`);
    expect(lobbyPhaseLabel({ ...nightMatch, started: false })).toBe(
      "Waiting for players",
    );
    expect(lobbyPhaseLabel({ ...nightMatch, ended: true })).toBe(
      "Match complete",
    );
    expect(
      lobbyPhaseLabel({ ...nightMatch, started: false, ended: true }),
    ).toBe("Match complete");
  });
});

describe("role-specific visit labels", () => {
  it.each([
    ["Doctor", "Protect"],
    ["Investigator", "Investigate"],
  ])("labels %s night actions as %s", (role, expected) => {
    expect(roleVisitLabel(role, DayTime.Night)).toBe(expected);
  });

  it.each(["Doctor", "Investigator", "Mafia", "", undefined])(
    "uses Visit for %s during the day",
    (role) => {
      expect(roleVisitLabel(role, DayTime.Day)).toBe("Visit");
    },
  );

  it.each(["Mafia", "Vigilante", "Unknown", "doctor", "", undefined])(
    "uses a safe generic label for ambiguous night role %s",
    (role) => {
      expect(roleVisitLabel(role, DayTime.Night)).toBe("Visit");
    },
  );
});
