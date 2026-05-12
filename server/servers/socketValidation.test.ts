import { describe, expect, it } from "vitest";
import { DayTime } from "../../shared/communication/events.js";
import {
  parseJoinRoomToken,
  parseMessageSentPayload,
  parseVisitPayload,
  parseVotePayload,
  parseWhisperPayload,
} from "./socketValidation.js";

describe("socketValidation", () => {
  it("parses valid chat and phase payloads", () => {
    expect(parseJoinRoomToken("token-value")).toBe("token-value");
    expect(parseMessageSentPayload("hello", DayTime.Day)).toEqual({
      message: "hello",
      phase: DayTime.Day,
    });
    expect(parseVotePayload(1, DayTime.Day)).toEqual({
      recipient: 1,
      phase: DayTime.Day,
    });
    expect(parseVisitPayload(null, DayTime.Night)).toEqual({
      recipient: null,
      phase: DayTime.Night,
    });
    expect(parseWhisperPayload(2, "psst", DayTime.Day)).toEqual({
      recipient: 2,
      message: "psst",
      phase: DayTime.Day,
    });
  });

  it("rejects invalid socket boundary payloads", () => {
    expect(parseJoinRoomToken(12)).toBeNull();
    expect(parseMessageSentPayload("", DayTime.Day)).toBeNull();
    expect(parseMessageSentPayload("hello", "day")).toBeNull();
    expect(parseVotePayload(null, DayTime.Day)).toBeNull();
    expect(parseVisitPayload(-1, DayTime.Night)).toBeNull();
    expect(parseWhisperPayload(2, "", DayTime.Day)).toBeNull();
  });
});
