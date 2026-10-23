import {
  bodyguardDefinition,
} from "../definitions/town/bodyguard.js";
import { doctorDefinition } from "../definitions/town/doctor.js";
import { fortifierDefinition } from "../definitions/town/fortifier.js";
import { investigatorDefinition } from "../definitions/town/investigator.js";
import { jailorDefinition } from "../definitions/town/jailor.js";
import { judgeDefinition } from "../definitions/town/judge.js";
import { lawmanDefinition } from "../definitions/town/lawman.js";
import { nimbyDefinition } from "../definitions/town/nimby.js";
import { roleblockerDefinition } from "../definitions/town/roleblocker.js";
import { sacrificerDefinition } from "../definitions/town/sacrificer.js";
import { tapperDefinition } from "../definitions/town/tapper.js";
import { trackerDefinition } from "../definitions/town/tracker.js";
import { vetterDefinition } from "../definitions/town/vetter.js";
import { watchmanDefinition } from "../definitions/town/watchman.js";
import {
  mafiaDefinition,
} from "../definitions/mafia/mafia.js";
import { mafiaInvestigatorDefinition } from "../definitions/mafia/mafiaInvestigator.js";
import { mafiaRoleblockerDefinition } from "../definitions/mafia/mafiaRoleblocker.js";
import {
  blankRoleDefinition,
} from "../definitions/neutral/blankRole.js";
import { confesserDefinition } from "../definitions/neutral/confesser.js";
import { framerDefinition } from "../definitions/neutral/framer.js";
import { maniacDefinition } from "../definitions/neutral/maniac.js";
import { peacemakerDefinition } from "../definitions/neutral/peacemaker.js";
import { sniperDefinition } from "../definitions/neutral/sniper.js";
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
