import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("~/server/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@mernmafia/db/schema", () => ({
  activeRoom: { id: "id" },
  quickJoinRooms: { table: "archive" },
}));
import { rotateActiveRoom } from "./roomDirectory";
it("retains the previous quick-join room and registers its replacement in the same transaction", async () => {
  mocks.transaction.mockClear();
  const archive = vi.fn();
  const update = vi.fn();
  const lock = vi.fn().mockResolvedValue([{ roomId: "running-game" }]);
  const insert = vi
    .fn()
    .mockReturnValueOnce({
      values: (rows: unknown) => {
        archive(rows);
        return { onConflictDoNothing: async () => undefined };
      },
    })
    .mockReturnValueOnce({
      values: (row: unknown) => {
        update(row);
        return { onConflictDoUpdate: async () => undefined };
      },
    });
  mocks.transaction.mockImplementation(async (work) =>
    work({
      select: () => ({ from: () => ({ where: () => ({ for: lock }) }) }),
      insert,
    }),
  );
  const result = await rotateActiveRoom();
  expect(lock).toHaveBeenCalledWith("update");
  expect(archive).toHaveBeenCalledWith([
    { roomId: result.roomId },
    { roomId: "running-game" },
  ]);
  expect(update).toHaveBeenCalledWith({ id: 1, roomId: result.roomId });
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
});
it("propagates a failed transaction rather than reporting a new active room", async () => {
  mocks.transaction.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(rotateActiveRoom()).rejects.toThrow("storage unavailable");
});
