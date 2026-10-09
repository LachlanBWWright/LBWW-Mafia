/** The product-level destinations exposed by both clients. */
export const navigationItems = [
  { key: "Home", label: "Home", path: "/" },
  { key: "Lobby", label: "Lobby", path: "/lobby" },
  {
    key: "CreateLobby",
    label: "Create",
    path: "/lobby/create",
    requiresAuth: true,
  },
  { key: "Roles", label: "Roles", path: "/roles" },
  { key: "History", label: "History", path: "/history" },
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
  { key: "About", label: "About", path: "/about" },
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
