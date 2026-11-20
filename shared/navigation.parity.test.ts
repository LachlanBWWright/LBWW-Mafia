import { describe, expect, it } from "vitest";
import { getVisibleNavigationItems, getNavigationGroups, navigationItems } from "./navigation";

describe("web and mobile navigation contract", () => {
  it("keeps every permitted destination in exactly one navigation group", () => {
    for (const [authenticated, admin] of [[false, false], [true, false], [true, true]]) {
      const groups = getNavigationGroups(authenticated!, admin!);
      expect(groups.primary.map((item) => item.key)).toEqual(authenticated ? ["Home", "Community", "Messages"] : ["Home"]);
      expect([...groups.primary, ...groups.secondary].map((item) => item.key).sort()).toEqual(getVisibleNavigationItems(authenticated!, admin!).map((item) => item.key).sort());
    }
  });
  it("has unique destinations and stable labels", () => {
    const keys = navigationItems.map((item) => item.key);
    const paths = navigationItems.map((item) => item.path);
    const labels = navigationItems.map((item) => item.label);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("marks the same auth and admin boundaries for both clients", () => {
    expect(
      navigationItems
        .filter((item) => "requiresAuth" in item)
        .map((item) => item.key),
    ).toEqual([
      "CreateLobby",
      "Campaigns",
      "Community",
      "Notifications",
      "Messages",
      "Profile",
      "Settings",
      "Admin",
    ]);
    expect(
      navigationItems
        .filter((item) => "adminOnly" in item)
        .map((item) => item.key),
    ).toEqual(["Admin"]);
  });

  it("shows the same destinations for guests, members, and admins", () => {
    const keysFor = (isAuthenticated: boolean, isAdmin: boolean) =>
      getVisibleNavigationItems(isAuthenticated, isAdmin).map(
        (item) => item.key,
      );

    expect(keysFor(false, false)).toEqual([
      "Home",
      "Lobby",
      "PublicLobbies",
      "Roles",
      "History",
      "Sandbox",
    ]);
    expect(keysFor(true, false)).toEqual([
      "Home",
      "Lobby",
      "PublicLobbies",
      "CreateLobby",
      "Roles",
      "History",
      "Campaigns",
      "Sandbox",
      "Community",
      "Notifications",
      "Messages",
      "Profile",
      "Settings",
    ]);
    expect(keysFor(true, true)).toContain("Admin");
  });
});
