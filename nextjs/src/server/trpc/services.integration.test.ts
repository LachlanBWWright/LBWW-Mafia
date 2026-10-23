import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { users } from "@mernmafia/db/schema";
import { db } from "~/server/db";
import { trpcServices as services } from "./services";
import { getActiveIdentity } from "../auth/identity";
import { createMessageBus } from "../messaging/events";
import { env } from "~/env";
import { messageDatabaseUrl } from "../db/connectionConfig";
import { createMobileToken } from "../auth/mobileToken";
import { POST as createLobby } from "../../app/api/lobbies/route";
import { GET as readLobby } from "../../app/api/lobbies/[roomId]/route";
vi.mock("~/server/auth", () => ({ auth: async () => null }));
const prefix = `integration-${crypto.randomUUID()}`;
const a = `${prefix}-a`,
  b = `${prefix}-b`,
  outsider = `${prefix}-c`;
const receiver = createMessageBus(messageDatabaseUrl(env));
describe("PostgreSQL application services", () => {
  beforeAll(async () => {
    await db
      .insert(users)
      .values(
        [a, b, outsider].map((id) => ({
          id,
          name: id,
          email: `${id}@test.invalid`,
        })),
      );
  });
  afterAll(async () => {
    await receiver.close();
    await db.delete(users).where(inArray(users.id, [a, b, outsider]));
    await db.$client.end({ timeout: 1 });
  });
  it("exposes incoming requests and allows only accepted friends to message", async () => {
    await services.requestFriend(a, b);
    expect(
      (await services.listFriends(b)).find((entry) => entry.id === a)
        ?.relationship,
    ).toBe("incoming");
    await expect(services.sendDirectMessage(a, b, "pending")).rejects.toThrow();
    await services.respondFriend(b, a, true);
    await expect(
      services.sendDirectMessage(a, outsider, "unrelated"),
    ).rejects.toThrow();
    const received = new Promise<void>((resolve) => {
      void receiver
        .subscribe(b, () => resolve())
        .then((stop) => {
          unsubscribe = stop;
          ready();
        });
    });
    let unsubscribe: (() => Promise<unknown>) | undefined;
    let ready!: () => void;
    const listening = new Promise<void>((resolve) => {
      ready = resolve;
    });
    await listening;
    const sent = await services.sendDirectMessage(
      a,
      b,
      "hello from another database connection",
    );
    await received;
    await unsubscribe?.();
    const thread = await services.getDirectThread(b, a, 50);
    expect(thread.messages.map((entry) => entry.id)).toContain(sent.id);
    expect((await services.listDirectConversations(b))[0]?.unread).toBe(true);
    await services.markDirectConversationRead(b, thread.conversationId!);
    expect((await services.listDirectConversations(b))[0]?.unread).toBe(false);
  });
  it("enforces pagination, blocks, and account suspension", async () => {
    const first = await services.sendDirectMessage(a, b, "first");
    const second = await services.sendDirectMessage(a, b, "second");
    expect(
      (await services.getDirectThread(b, a, 1, second.id)).messages[0]?.id,
    ).toBe(first.id);
    await db
      .update(users)
      .set({ accountStatus: "suspended" })
      .where(eq(users.id, b));
    expect(await getActiveIdentity(b)).toBeNull();
    await expect(
      services.sendDirectMessage(a, b, "suspended"),
    ).rejects.toThrow();
    await db
      .update(users)
      .set({ accountStatus: "active" })
      .where(eq(users.id, b));
    await services.blockUser(b, a);
    await expect(services.sendDirectMessage(a, b, "blocked")).rejects.toThrow();
    expect((await services.getDirectThread(b, a, 50)).messages).toEqual([]);
  });
  it("validates and stores lobby rules behind authenticated endpoints", async () => {
    const token = await createMobileToken({ id: a });
    const request = (body: unknown) =>
      new Request("http://test/api/lobbies", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    expect((await createLobby(request({ size: 1000 }))).status).toBe(400);
    const config = {
      size: 2,
      roleSelection: {
        algorithm: "explicit-slots",
        roles: [],
        explicitSlots: ["doctor", "mafia"],
      },
    };
    const response = await createLobby(request(config));
    expect(response.status).toBe(200);
    const { roomId } = (await response.json()) as { roomId: string };
    const params = { params: Promise.resolve({ roomId }) };
    expect((await readLobby(new Request("http://test"), params)).status).toBe(
      401,
    );
    const loaded = await readLobby(
      new Request("http://test", {
        headers: { authorization: `Bearer ${env.BACKEND_SECRET}` },
      }),
      params,
    );
    expect(await loaded.json()).toEqual(config);
  });
});
