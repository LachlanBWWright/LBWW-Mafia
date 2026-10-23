import { describe, expect, it } from "vitest";
import {
  DayTime,
  ClientEvent,
  ServerEvent,
  type GameSnapshot,
} from "../communication/events";
import { gameSnapshotSchema } from "../communication/protocol";
import { lobbyReducer, initialLobbyState } from "./lobbyState";
import { PracticeSocket } from "./practiceSocket";
import {
  canConfigureAiCharacters,
  phaseActionHint,
  roleActionRestrictions,
  roleReference,
  visibleMessages,
  voteSummary,
} from "./matchExperience";
import { defaultVisitCapability } from "./playerActionRules";
import { nightMatch, dayMatch, hiddenMatch } from "../testing/matchFixtures";

describe("shared match experience", () => {
  it("describes the player's private visit permissions and phase actions", () => {
    const doctor = {
      ...defaultVisitCapability,
      nightVisitOthers: true,
      nightVisitFaction: true,
    };
    expect(roleActionRestrictions(doctor)).toEqual([
      "Night: you cannot visit yourself.",
    ]);
    expect(
      phaseActionHint({
        time: DayTime.Night,
        capability: doctor,
        canVote: false,
      }),
    ).toContain("change or cancel");
    expect(
      phaseActionHint({
        time: DayTime.Night,
        capability: defaultVisitCapability,
        canVote: false,
      }),
    ).toContain("no available night action");
    expect(
      phaseActionHint({
        time: DayTime.Night,
        capability: { ...defaultVisitCapability, nightVote: true },
        canVote: true,
      }),
    ).toContain("faction's night vote");
    expect(
      phaseActionHint({
        time: DayTime.Day,
        capability: doctor,
        canVote: true,
        actorAlive: false,
      }),
    ).toContain("spectator");
    expect(roleReference("Doctor")?.objective).not.toContain("survive");
  });
  it("hides vote totals even when an older public state is available", () => {
    expect(voteSummary(hiddenMatch.players, "hidden")).toBeUndefined();
    expect(voteSummary(dayMatch.players, "hidden")).toBeUndefined();
    expect(voteSummary(dayMatch.players, "public")).toMatchObject({
      leaders: ["Theo"],
      highest: 2,
    });
  });
  it("mutes only bot chatter, retaining announcements and human messages", () => {
    expect(
      visibleMessages(nightMatch.messages, true).map((message) => message.id),
    ).toEqual([1, 2, 3, 4]);
    expect(roleReference("Doctor")?.objective).toContain("Mafia");
    expect(roleReference("made-up role")).toBeUndefined();
  });
  it("summarizes public events and restores current choices after reconnecting", () => {
    const state = lobbyReducer(
      { ...nightMatch, connected: false, snapshotReceived: true },
      {
        type: "snapshot",
        value: {
          ...nightMatch,
          action: { visit: "Theo" },
          timeline: [
            { id: 1, day: 2, phase: DayTime.Night, text: "Sam died (Mafia)." },
          ],
        },
      },
    );
    expect(state.recoveryNotice).toContain("Sam died");
    expect(state.action.visit).toBe("Theo");
    expect(state.messages).toEqual(nightMatch.messages);
    expect(state.connected).toBe(true);
  });
  it("does not announce reconnection when the initial join callback arrives before the first snapshot", () => {
    const joining = {
      ...initialLobbyState,
      playerName: "You",
      connected: false,
    };
    const joined = lobbyReducer(joining, {
      type: "snapshot",
      value: { ...nightMatch, playerName: "You" },
    });
    expect(joined.recoveryNotice).toBe("");
    expect(joined.snapshotReceived).toBe(true);
    expect(
      lobbyReducer(
        { ...joined, connected: false },
        {
          type: "snapshot",
          value: { ...nightMatch, playerName: "You" },
        },
      ).recoveryNotice,
    ).toContain("Reconnected");
  });
  it("classifies bot chat from roster metadata without treating whispers as public chat", () => {
    const state = lobbyReducer(nightMatch, {
      type: "message",
      text: "Nadia: hello",
      kind: "chat",
      sender: "Nadia",
    });
    expect(state.messages.at(-1)).toMatchObject({ kind: "chat", isBot: true });
    const whispered = lobbyReducer(state, {
      type: "message",
      text: "Whisper from Theo: hello",
      kind: "whisper",
    });
    expect(whispered.messages.at(-1)?.kind).toBe("whisper");
  });
  it("retains private action feedback through unrelated snapshots and replaces it for a new choice", () => {
    const rejected = lobbyReducer(nightMatch, {
      type: "feedback",
      feedback: "That protection was rejected.",
      outcome: "rejected",
    });
    const unchanged = lobbyReducer(rejected, {
      type: "snapshot",
      value: { ...nightMatch, action: { visit: nightMatch.action.visit } },
    });
    expect(unchanged.action.outcome).toBe("rejected");
    expect(unchanged.action.feedback).toBe("That protection was rejected.");
    const changed = lobbyReducer(unchanged, {
      type: "snapshot",
      value: { ...nightMatch, action: { visit: "Mira" } },
    });
    expect(changed.action).toEqual({ visit: "Mira" });
  });
  it("clears revealed roles, chat, private feedback, and recap when a new match starts", () => {
    const prior = {
      ...nightMatch,
      matchId: "finished",
      phaseVersion: 10,
      ended: true,
      recap: { winner: "Town", reason: "Won", players: [], timeline: [] },
    };
    const next = lobbyReducer(prior, {
      type: "snapshot",
      value: {
        matchId: "next",
        phaseVersion: 11,
        playerName: prior.playerName,
        started: false,
        ended: false,
        players: [{ name: prior.playerName, isAlive: true }],
        time: DayTime.Day,
        dayNumber: 0,
        timeLeft: 0,
        canTalk: true,
        canVote: true,
      },
    });
    expect(next.currentUserRole).toBeUndefined();
    expect(next.messages).toEqual([]);
    expect(next.action).toEqual({});
    expect(next.recap).toBeUndefined();
    expect(next.timeline).toBeUndefined();
  });
  it("clears obsolete selections as soon as a phase event arrives", () => {
    const transitioned = lobbyReducer(nightMatch, {
      type: "phase",
      value: {
        time: DayTime.Day,
        dayNumber: 3,
        timeLeft: 30,
        phaseVersion: 10,
      },
    });
    expect(transitioned.action).toEqual({});
    const submitted = lobbyReducer(transitioned, {
      type: "feedback",
      feedback: "Vote confirmed.",
      outcome: "submitted",
    });
    expect(
      lobbyReducer(submitted, {
        type: "phase",
        value: {
          time: DayTime.Day,
          dayNumber: 3,
          timeLeft: 29,
          phaseVersion: 10,
        },
      }).action,
    ).toEqual(submitted.action);
  });
  it("runs a complete free practice match with hidden roles, a night action, voting, and replay", () => {
    const socket = new PracticeSocket();
    let snapshot: GameSnapshot | undefined;
    let clue = "";
    socket.on(ServerEvent.GameSnapshot, (value) => {
      snapshot = value;
    });
    socket.on(ServerEvent.ReceiveChatMessage, (text) => {
      clue = text;
    });
    socket.connect();
    socket.emit(ClientEvent.PlayerJoinRoom, "practice", "", () => {});
    expect(
      snapshot?.players.find((player) => player.name === "Theo")?.role,
    ).toBeUndefined();
    socket.emit(ClientEvent.HandleVisit, 1, DayTime.Night);
    expect(snapshot?.action?.visit).toBe("Mira");
    socket.emit(ClientEvent.HandleVisit, null, DayTime.Night);
    expect(snapshot?.action?.visit).toBeNull();
    socket.emit(ClientEvent.HandleVisit, 1, DayTime.Night);
    socket.advance();
    expect(snapshot?.time).toBe(DayTime.Day);
    expect(clue).toContain("Theo");
    socket.emit(ClientEvent.HandleVote, 2, DayTime.Day);
    expect(snapshot?.recap?.winner).toBe("Town");
    expect(
      snapshot?.recap?.players.find((player) => player.name === "Theo")?.role,
    ).toBe("Mafia");
    const priorMatchId = snapshot?.matchId;
    const priorVersion = snapshot?.phaseVersion ?? 0;
    socket.emit(ClientEvent.ReadyForRematch);
    expect(snapshot?.ended).toBe(false);
    expect(snapshot?.action).toEqual({});
    expect(snapshot?.matchId).not.toBe(priorMatchId);
    expect(snapshot?.phaseVersion).toBeGreaterThan(priorVersion);
    expect(gameSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      lobbyReducer(initialLobbyState, { type: "snapshot", value: snapshot! })
        .currentUserRole,
    ).toBe("Doctor");
  });
  it("rejects invalid or stale practice targets and leaves a live match intact", () => {
    const socket = new PracticeSocket();
    let snapshot: GameSnapshot | undefined;
    let errors = 0;
    socket.on(ServerEvent.GameSnapshot, (value) => {
      snapshot = value;
    });
    socket.on(ServerEvent.ReceiveMessage, () => {
      errors += 1;
    });
    socket.connect();
    socket.emit(ClientEvent.PlayerJoinRoom, "practice", "", () => {});
    const matchId = snapshot?.matchId;
    socket.emit(ClientEvent.HandleVisit, 0, DayTime.Night);
    socket.emit(ClientEvent.HandleVisit, 99, DayTime.Night);
    socket.emit(ClientEvent.HandleVisit, 1, DayTime.Day);
    expect(errors).toBe(3);
    expect(snapshot?.action).toEqual({});
    socket.emit(ClientEvent.ReadyForRematch);
    expect(snapshot?.matchId).toBe(matchId);
    expect(snapshot?.ended).toBe(false);
  });
});

describe("AI character setup availability on web and mobile", () => {
  it("is available to waiting players", () => {
    expect(
      canConfigureAiCharacters({
        started: false,
        ended: false,
        participation: "player",
      }),
    ).toBe(true);
  });
  it("disappears when play begins and stays hidden after the match", () => {
    expect(canConfigureAiCharacters({ started: true, ended: false })).toBe(
      false,
    );
    expect(canConfigureAiCharacters({ started: false, ended: true })).toBe(
      false,
    );
  });
  it("is unavailable to observers and in practice matches", () => {
    expect(canConfigureAiCharacters({ participation: "spectator" })).toBe(
      false,
    );
    expect(canConfigureAiCharacters({ participation: "eliminated" })).toBe(
      false,
    );
    expect(canConfigureAiCharacters({}, true)).toBe(false);
  });
});
