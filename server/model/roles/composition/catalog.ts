import {
  bodyguardDefinition,
  doctorDefinition,
  fortifierDefinition,
  investigatorDefinition,
  jailorDefinition,
  judgeDefinition,
  lawmanDefinition,
  nimbyDefinition,
  roleblockerDefinition,
  sacrificerDefinition,
  tapperDefinition,
  trackerDefinition,
  vetterDefinition,
  watchmanDefinition,
} from "../definitions/town.js";
import {
  mafiaDefinition,
  mafiaInvestigatorDefinition,
  mafiaRoleblockerDefinition,
} from "../definitions/mafia.js";
import {
  blankRoleDefinition,
  confesserDefinition,
  framerDefinition,
  maniacDefinition,
  peacemakerDefinition,
  sniperDefinition,
} from "../definitions/neutral.js";
import { RoleGroup } from "../roleGroup.js";
import type { RoleDefinition } from "./roleDefinition.js";

export const builtInRoleDefinitions: RoleDefinition[] = [
  doctorDefinition,
  judgeDefinition,
  watchmanDefinition,
  investigatorDefinition,
  lawmanDefinition,
  vetterDefinition,
  tapperDefinition,
  trackerDefinition,
  bodyguardDefinition,
  nimbyDefinition,
  sacrificerDefinition,
  fortifierDefinition,
  roleblockerDefinition,
  jailorDefinition,
  mafiaDefinition,
  mafiaRoleblockerDefinition,
  mafiaInvestigatorDefinition,
  maniacDefinition,
  sniperDefinition,
  framerDefinition,
  confesserDefinition,
  peacemakerDefinition,
  blankRoleDefinition,
];

export const builtInTownRoleDefinitions = builtInRoleDefinitions.filter(
  (definition) => definition.metadata.group === RoleGroup.Town,
);

export const builtInMafiaRoleDefinitions = builtInRoleDefinitions.filter(
  (definition) => definition.metadata.group === RoleGroup.Mafia,
);

export const builtInNeutralRoleDefinitions = builtInRoleDefinitions.filter(
  (definition) =>
    definition.metadata.group !== RoleGroup.Town &&
    definition.metadata.group !== RoleGroup.Mafia &&
    definition.id !== "blank-role",
);
