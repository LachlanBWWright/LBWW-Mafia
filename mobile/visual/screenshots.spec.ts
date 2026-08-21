import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

type ScreenCase = {
  name: string;
  navigate?: (page: Page) => Promise<void>;
  readyText: string;
  scrollCaptures?: number;
};

const screens: ScreenCase[] = [
  { name: "home", readyText: "Quick Start" },
  {
    name: "lobby-connection",
    navigate: (page) => clickLink(page, "Lobby"),
    readyText: "Connecting to Game Lobby",
  },
  {
    name: "roles",
    navigate: (page) => clickLink(page, "Roles"),
    readyText: "Town Roles",
    scrollCaptures: 3,
  },
  {
    name: "about",
    navigate: (page) => clickLink(page, "About"),
    readyText: "The Project",
    scrollCaptures: 1,
  },
  {
    name: "history-signed-out",
    navigate: (page) => clickLink(page, "History"),
    readyText: "No username available for history lookup.",
  },
  {
    name: "profile-signed-out",
    navigate: (page) => clickLink(page, "Profile"),
    readyText: "Sign in to view your profile and match history.",
  },
  {
    name: "sign-in",
    navigate: async (page) => {
      await clickLink(page, "Profile");
      await page.getByText("Sign in", { exact: true }).last().click();
    },
    readyText: "Account sign in",
  },
  {
    name: "admin-unauthorized",
    navigate: (page) => clickLink(page, "Admin"),
    readyText: "You are not authorized.",
  },
];

async function clickLink(page: Page, label: string) {
  await page.getByText(label, { exact: true }).last().click();
}

function output(testInfo: TestInfo, name: string) {
  return path.join("visual", "screenshots", testInfo.project.name, `${name}.png`);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: output(testInfo, name),
    animations: "disabled",
    caret: "hide",
  });
}

async function scrollApp(page: Page, amount: number) {
  return page.evaluate((distance) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter((element) => element.scrollHeight > element.clientHeight + 1)
      .sort((left, right) =>
        (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight));
    const scroller = candidates[0];
    if (!scroller) return false;
    const previousScrollTop = scroller.scrollTop;
    scroller.scrollTop = Math.min(scroller.scrollTop + distance, scroller.scrollHeight);
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    return scroller.scrollTop !== previousScrollTop;
  }, amount);
}

for (const screen of screens) {
  test(`capture ${screen.name}`, async ({ page }, testInfo) => {
    await page.goto("/");
    await screen.navigate?.(page);
    await expect(page.getByText(screen.readyText, { exact: false }).last()).toBeVisible();
    await capture(page, testInfo, screen.name);

    for (let index = 1; index <= (screen.scrollCaptures ?? 0); index += 1) {
      const didScroll = await scrollApp(page, testInfo.project.name === "small-phone" ? 360 : 620);
      if (!didScroll) break;
      await page.waitForTimeout(100);
      await capture(page, testInfo, `${screen.name}-scroll-${index + 1}`);
    }
  });
}
