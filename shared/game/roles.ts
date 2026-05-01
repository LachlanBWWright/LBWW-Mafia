export type RoleFaction = "town" | "mafia" | "neutral";

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

import {
  allRoles as allRolesValue,
  mafiaRoles as mafiaRolesValue,
  neutralRoles as neutralRolesValue,
  roleFactionsByName as roleFactionsByNameValue,
  roleSections as roleSectionsValue,
  townRoles as townRolesValue,
} from "./rolesList";

export const townRoles = townRolesValue as readonly RoleCatalogEntry[];
export const mafiaRoles = mafiaRolesValue as readonly RoleCatalogEntry[];
export const neutralRoles = neutralRolesValue as readonly RoleCatalogEntry[];
export const allRoles = allRolesValue as readonly RoleCatalogEntry[];
export const roleSections = roleSectionsValue as readonly RoleSection[];
export const roleFactionsByName = roleFactionsByNameValue as Map<
  string,
  RoleFaction
>;
