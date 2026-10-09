import { expect, test } from "@playwright/test";
test("account sign-in offers only Google", async ({ page, request }) => {
  await page.goto("/signin");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('input[type="password"], input[type="email"]'),
  ).toHaveCount(0);
  for (const path of ["register", "mobile-login"]) {
    const response = await request.post(`/api/account/${path}`, {
      data: { email: "nobody@test.invalid", password: "old-password" },
    });
    expect(response.status()).toBe(410);
  }
});
