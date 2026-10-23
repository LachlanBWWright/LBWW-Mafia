import { expect, it, vi } from "vitest";
import { createAppRouter, type RouterServices } from "./appRouter";
const reviewReport = vi.fn(async () => undefined);
const inbox = vi.fn(async () => []);
const router = createAppRouter({
  features: { inbox, reviewReport },
} as unknown as RouterServices);
it("keeps personal data and notifications behind authentication", async () => {
  const caller = router.createCaller({ sessionUser: null, isBackend: false });
  await expect(caller.features.inbox()).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  await expect(caller.features.exportData()).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  await expect(
    caller.features.deleteAccount({ confirmation: "DELETE" }),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(inbox).not.toHaveBeenCalled();
});
it("requires administrator identity for report review", async () => {
  const caller = router.createCaller({
    sessionUser: { id: "player", isAdmin: false },
    isBackend: false,
  });
  await expect(
    caller.features.reviewReport({
      id: 1,
      status: "resolved",
      resolution: "Checked",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(reviewReport).not.toHaveBeenCalled();
  const admin = router.createCaller({
    sessionUser: { id: "admin", isAdmin: true },
    isBackend: false,
  });
  await admin.features.reviewReport({
    id: 1,
    status: "resolved",
    resolution: "Checked",
  });
  expect(reviewReport).toHaveBeenCalledWith("admin", {
    id: 1,
    status: "resolved",
    resolution: "Checked",
  });
});
