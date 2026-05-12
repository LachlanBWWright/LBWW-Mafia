export enum RoleFaction {
  Town = "town",
  Mafia = "mafia",
  Neutral = "neutral",
}

export type RoleCatalogEntry = {
  name: string;
  faction: RoleFaction;
  category: string;
  summary: string;
  description: string;
};

export type RoleSection = {
  title: string;
  faction: RoleFaction;
  roles: readonly RoleCatalogEntry[];
};
