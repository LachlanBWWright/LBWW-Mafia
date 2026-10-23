import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateWithChatGPT } = vi.hoisted(() => ({
  generateWithChatGPT: vi.fn(),
}));
vi.mock("../../../tools/ai-bots/chatgpt-plan.mjs", () => ({
  generateWithChatGPT,
}));

import { decideCharacterActions } from "../../../tools/ai-bots/characterDecisions.mjs";

const character = (playerName: string, privateFact: string) => ({
  snapshot: {
    playerName,
    players: [{ name: playerName, isAlive: true }],
    time: "Day",
    canTalk: true,
    canVote: true,
  },
  observations: [{ event: "receive-whisper-message", data: privateFact }],
  conversation: [
    { role: "user", content: `Previous context: ${privateFact}` },
    { role: "assistant", content: "I will remember that." },
  ],
});

describe("AI character context modes", () => {
  beforeEach(() => generateWithChatGPT.mockReset());

  it("keeps each per-character conversation isolated while carrying it forward", async () => {
    generateWithChatGPT
      .mockResolvedValueOnce(
        JSON.stringify({ characters: [{ playerName: "Alice", actions: [] }] }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ characters: [{ playerName: "Bob", actions: [] }] }),
      );
    const alice = character("Alice", "Alice-only secret");
    const bob = character("Bob", "Bob-only secret");

    await decideCharacterActions({
      mode: "per-character",
      model: "gpt-6-luna",
      characters: [alice, bob],
    });

    expect(generateWithChatGPT).toHaveBeenCalledTimes(2);
    for (const [request] of generateWithChatGPT.mock.calls) {
      const serialized = JSON.stringify(request.input);
      const privateFact = request.instructions.includes("only Alice")
        ? "Alice-only secret"
        : "Bob-only secret";
      const otherFact =
        privateFact === "Alice-only secret"
          ? "Bob-only secret"
          : "Alice-only secret";
      expect(serialized).toContain(privateFact);
      expect(serialized).not.toContain(otherFact);
      expect(request.input[0].content).toContain("Previous context:");
    }
    expect(alice.conversation).toHaveLength(4);
    expect(bob.conversation).toHaveLength(4);
    expect(alice.conversation.at(-1).content).toContain('"Alice"');
    expect(bob.conversation.at(-1).content).toContain('"Bob"');
  });

  it("uses one shared request for a combined model mode", async () => {
    generateWithChatGPT.mockResolvedValue(
      JSON.stringify({
        characters: [
          { playerName: "Alice", actions: [] },
          { playerName: "Bob", actions: [] },
        ],
      }),
    );
    const sharedConversation: { role: string; content: string }[] = [];

    await decideCharacterActions({
      mode: "shared",
      model: "gpt-6-luna",
      characters: [
        character("Alice", "Alice-only secret"),
        character("Bob", "Bob-only secret"),
      ],
      sharedConversation,
    });

    expect(generateWithChatGPT).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(generateWithChatGPT.mock.calls[0][0].input),
    ).toContain("Alice-only secret");
    expect(
      JSON.stringify(generateWithChatGPT.mock.calls[0][0].input),
    ).toContain("Bob-only secret");
    expect(sharedConversation).toHaveLength(2);
  });
});

describe("AI character personalities", () => {
  it("carries fixed personality and difficulty instructions into each isolated context", async () => {
    generateWithChatGPT
      .mockReset()
      .mockResolvedValue(
        JSON.stringify({ characters: [{ playerName: "Alice", actions: [] }] }),
      );
    const alice = {
      ...character("Alice", "private clue"),
      personality: "argumentative",
      difficulty: "challenging",
    };
    await decideCharacterActions({
      mode: "per-character",
      model: "gpt-6-luna",
      characters: [alice],
    });
    const payload = JSON.parse(
      generateWithChatGPT.mock.calls[0][0].input.at(-1).content,
    );
    expect(payload.characters[0].personality.id).toBe("argumentative");
    expect(payload.characters[0].difficulty.instruction).toContain(
      "contradictory claims",
    );
    expect(generateWithChatGPT.mock.calls[0][0].instructions).toContain(
      "persistent personality",
    );
  });
});

it("does not request a model for dead or ended characters", async () => {
  generateWithChatGPT.mockReset();
  const dead = character("Alice", "secret");
  dead.snapshot.players[0]!.isAlive = false;
  const ended = {
    ...character("Bob", "secret"),
    snapshot: { ...character("Bob", "secret").snapshot, ended: true },
  };
  expect(
    await decideCharacterActions({
      mode: "shared",
      model: "gpt-6-luna",
      characters: [dead, ended],
    }),
  ).toEqual([]);
  expect(generateWithChatGPT).not.toHaveBeenCalled();
});

it("rejects unknown profiles before making a model request", async () => {
  generateWithChatGPT.mockReset();
  await expect(
    decideCharacterActions({
      mode: "per-character",
      model: "gpt-6-luna",
      characters: [
        { ...character("Alice", "secret"), personality: "invented" },
      ],
    }),
  ).rejects.toThrow("Unknown bot personality");
  expect(generateWithChatGPT).not.toHaveBeenCalled();
});

it("filters repeated votes after an action is submitted", async () => {
  generateWithChatGPT.mockReset().mockResolvedValue(
    JSON.stringify({
      characters: [
        {
          playerName: "Alice",
          actions: [
            { kind: "vote", target: "Bob" },
            { kind: "chat", message: "I have voted." },
          ],
        },
      ],
    }),
  );
  const alice = character("Alice", "secret");
  alice.snapshot.players.push({ name: "Bob", isAlive: true });
  const [decision] = await decideCharacterActions({
    mode: "per-character",
    model: "gpt-6-luna",
    characters: [
      { ...alice, snapshot: { ...alice.snapshot, action: { vote: "Bob" } } },
    ],
  });
  expect(decision.actions).toEqual([
    { kind: "chat", message: "I have voted." },
  ]);
});

it("remembers accepted decisions rather than a rejected unsupported vote", async () => {
  generateWithChatGPT
    .mockReset()
    .mockResolvedValue(
      JSON.stringify({
        characters: [
          { playerName: "Alice", actions: [{ kind: "vote", target: "Bob" }] },
        ],
      }),
    );
  const alice = character("Alice", "a private clue");
  alice.snapshot.players.push({ name: "Bob", isAlive: true });
  const [decision] = await decideCharacterActions({
    mode: "per-character",
    model: "gpt-6-luna",
    characters: [alice],
  });
  expect(decision.actions).toEqual([]);
  expect(
    JSON.parse(alice.conversation.at(-1)!.content).characters[0].actions,
  ).toEqual([]);
  const context = JSON.parse(
    generateWithChatGPT.mock.calls[0][0].input.at(-1).content,
  ).characters[0];
  expect(context.evidence[0].id).toBe("observation:0");
  expect(context.difficulty.policy.minimumConfidence).toBe(0.6);
});
