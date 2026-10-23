import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  rows: [] as unknown[][],
  select: vi.fn(),
  limits: [] as number[],
}));
vi.mock("~/server/db", () => ({ db: { select: mock.select } }));
import { matchAnalysisServices } from "./matchAnalysis";
const row = {
  id: 1,
  gameId: "g",
  roomName: "private",
  startedAt: new Date(1000),
  endedAt: new Date(2000),
  winningFaction: "town",
  winningRoles: '["Doctor"]',
  playerCount: 2,
  actionHistory:
    '[{"time":1500,"type":"action","actor":"Alice","content":"protect Bob"}]',
  conversationHistory:
    '[{"time":1600,"type":"whisper","actor":"Bob","target":"Carol","content":"private"}]',
};
const participant = {
  id: 1,
  matchId: 1,
  userId: "a",
  username: "Alice",
  role: "Doctor",
  won: true,
};
beforeEach(() => {
  mock.rows = [];
  mock.limits = [];
  mock.select.mockReset();
  mock.select.mockImplementation(() => {
    const result = mock.rows.shift() ?? [];
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => {
        mock.limits.push(n);
        return Promise.resolve(result);
      },
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    return chain;
  });
});
describe("match analysis data access", () => {
  it("rejects strangers before loading any private match history", async () => {
    mock.rows = [[]];
    await expect(
      matchAnalysisServices.getReplay({
        matchId: 1,
        viewerId: "stranger",
        isAdmin: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.select).toHaveBeenCalledTimes(1);
  });
  it("loads participant replay and strips unrelated whispers and account identifiers", async () => {
    mock.rows = [[{ id: 1 }], [row], [participant]];
    const replay = await matchAnalysisServices.getReplay({
      matchId: 1,
      viewerId: "a",
      isAdmin: false,
    });
    expect(replay.events).toHaveLength(1);
    expect(replay.participants).toEqual([
      { username: "Alice", role: "Doctor", won: true },
    ]);
  });
  it("still rejects unfinished records returned by storage", async () => {
    mock.rows = [
      [{ id: 1 }],
      [{ ...row, endedAt: new Date(Date.now() + 60000) }],
      [participant],
    ];
    await expect(
      matchAnalysisServices.getReplay({
        matchId: 1,
        viewerId: "a",
        isAdmin: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("bounds analytics scans and returns aggregate data only", async () => {
    mock.rows = [[row], [participant]];
    const summary = await matchAnalysisServices.getBalance({ limit: 5000 });
    expect(mock.limits).toContain(500);
    expect(summary.sampleSize).toBe(1);
    expect(JSON.stringify(summary)).not.toMatch(/Alice|private|userId|protect/);
  });
});
