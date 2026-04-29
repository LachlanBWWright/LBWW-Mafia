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
} from "./roles.js";

export const townRoles: readonly RoleCatalogEntry[] = townRolesValue;
export const mafiaRoles: readonly RoleCatalogEntry[] = mafiaRolesValue;
export const neutralRoles: readonly RoleCatalogEntry[] = neutralRolesValue;
export const allRoles: readonly RoleCatalogEntry[] = allRolesValue;
export const roleSections: readonly RoleSection[] = roleSectionsValue;
export const roleFactionsByName: Map<string, RoleFaction> = roleFactionsByNameValue;
