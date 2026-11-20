/** The product-level destinations exposed by both clients. */
export const navigationItems = [
  { key: "Home", label: "Home", path: "/" },
  { key: "Lobby", label: "Lobby", path: "/lobby" },
  { key: "PublicLobbies", label: "Public lobbies", path: "/lobbies" },
  {
    key: "CreateLobby",
    label: "Create",
    path: "/lobby/create",
    requiresAuth: true,
  },
  { key: "Roles", label: "Roles", path: "/roles" },
  { key: "History", label: "History", path: "/history" },
  {
    key: "Campaigns",
    label: "Persistent lobbies",
    path: "/campaigns",
    requiresAuth: true,
  },
  { key: "Sandbox", label: "Role sandbox", path: "/sandbox" },
  {
    key: "Community",
    label: "Community",
    path: "/community",
    requiresAuth: true,
  },
  {
    key: "Notifications",
    label: "Notifications",
    path: "/notifications",
    requiresAuth: true,
  },
  { key: "Messages", label: "Messages", path: "/messages", requiresAuth: true },
  { key: "Profile", label: "Profile", path: "/profile", requiresAuth: true },
  { key: "Settings", label: "Settings", path: "/settings", requiresAuth: true },
  {
    key: "Admin",
    label: "Admin",
    path: "/admin",
    requiresAuth: true,
    adminOnly: true,
  },
] as const;

export type NavigationKey = (typeof navigationItems)[number]["key"];

/** Apply the same account and administrator route visibility in every client. */
export function getVisibleNavigationItems(
  isAuthenticated: boolean,
  isAdmin: boolean,
) {
  return navigationItems.filter(
    (item) =>
      (!("requiresAuth" in item && item.requiresAuth) || isAuthenticated) &&
      (!("adminOnly" in item) || !item.adminOnly || isAdmin),
  );
}

/** Persistent destinations and secondary menu use identical grouping on both clients. */
export function getNavigationGroups(isAuthenticated: boolean, isAdmin: boolean) {
  const visible = getVisibleNavigationItems(isAuthenticated, isAdmin);
  const primaryKeys: readonly NavigationKey[] = ["Home", "Community", "Messages"];
  return {
    primary: visible.filter((item) => primaryKeys.includes(item.key)),
    secondary: visible.filter((item) => !primaryKeys.includes(item.key)),
  };
}
