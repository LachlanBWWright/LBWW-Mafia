import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { describe, expect, it } from "vitest";
import { captureEmitter, createTestSocket } from "../testUtils/gameTestUtils.js";
import { GamePhase } from "./gamePhase.js";
import { Room } from "./room.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(
  __dirname,
  "../../../shared/gameplay-fixtures/room/lobby-lifecycle.json",
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
  roomSize: number;
  roomName: string;
  actions: Array<{ type: "addUser"; socketId: string }>;
  expectedJoinResults: unknown[];
  expectedState: {
    started: boolean;
    phase: "day";
    userNames: string[];
    playerCount: number;
  };
  expectedEvents: Array<{
    target: string;
    event: string;
    messageKey?: MessageKey;
  }>;
};

describe("room gameplay parity fixture", () => {
  it("replays the shared lobby lifecycle fixture against the TypeScript room", async () => {
    const emittedCalls = captureEmitter();
    const room = new Room(fixture.roomSize, fixture.roomName);
    const joinResults = fixture.actions.map(({ socketId }) =>
      room.addUser(createTestSocket(socketId)),
    );

    await Promise.resolve();

    expect(joinResults).toEqual(fixture.expectedJoinResults);
    expect(room.started).toBe(fixture.expectedState.started);
    expect(room.time).toBe(GamePhase.Day);
    expect(room.userList.map((user) => user.username)).toEqual(
      fixture.expectedState.userNames,
    );
    expect(room.playerList).toHaveLength(fixture.expectedState.playerCount);

    for (const expectedEvent of fixture.expectedEvents) {
      expect(
        emittedCalls.some((call) => {
          if (call.target !== expectedEvent.target || call.event !== expectedEvent.event) {
            return false;
          }
          if (!expectedEvent.messageKey) {
            return true;
          }
          const [firstArg] = call.args;
          return (
            typeof firstArg === "object" &&
            firstArg !== null &&
            "key" in firstArg &&
            (firstArg as { key: MessageKey }).key === expectedEvent.messageKey
          );
        }),
      ).toBe(true);
    }
  });
});
