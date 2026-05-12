import type { Player } from "../../player/player.js";
import type { Room } from "../room.js";
import type { RoleDefinition } from "../../roles/composition/roleDefinition.js";
import type { CustomRoleDefinition } from "../../roles/composition/roleFactory.js";
import { createRoleInstance } from "../../roles/composition/roleFactory.js";
import { FactionFactory } from "../../factions/composition/factionFactory.js";
import type { Faction } from "../../factions/abstractFaction.js";
import {
  builtInMafiaRoleDefinitions,
  builtInNeutralRoleDefinitions,
  builtInRoleDefinitions,
  builtInTownRoleDefinitions,
} from "../../roles/composition/catalog.js";
import { builtInFactionDefinitions } from "../../factions/composition/catalog.js";
import { assertValidBuiltInCatalogs } from "../../roles/composition/validation.js";

const ROLE_BALANCE_TOLERANCE = 15;
const RANDOM_BALANCE_OFFSET_MIN = -15;
const RANDOM_BALANCE_OFFSET_RANGE = 30;
const NEUTRAL_ROLE_SELECTION_THRESHOLD = 0.3;

type RoleSelectionEntry = RoleDefinition | CustomRoleDefinition;

function isBuiltInRoleDefinition(entry: RoleSelectionEntry): entry is RoleDefinition {
  return entry.kind === "built-in";
}

export class RoleHandler {
  roomSize: number;
  customRoles: CustomRoleDefinition[];

  constructor(roomSize: number, customRoles: CustomRoleDefinition[] = []) {
    assertValidBuiltInCatalogs();
    this.roomSize = roomSize;
    this.customRoles = customRoles;
  }

  assignGame(): RoleSelectionEntry[] {
    const roleList: RoleSelectionEntry[] = [];
    let comparativePower = 0;

    const randomTownList = [...builtInTownRoleDefinitions];
    const randomMafiaList = [...builtInMafiaRoleDefinitions];
    const randomNeutralList = [...builtInNeutralRoleDefinitions];

    for (let i = 0; i < this.roomSize; i++) {
      const randomiser = Math.random() * RANDOM_BALANCE_OFFSET_RANGE + RANDOM_BALANCE_OFFSET_MIN;
      if (comparativePower < ROLE_BALANCE_TOLERANCE && comparativePower > -ROLE_BALANCE_TOLERANCE) {
        if (randomiser > comparativePower) {
          this.pushRandomRole(roleList, randomTownList, (entry) => {
            comparativePower += this.getRolePower(entry);
          });
        } else if (Math.random() > NEUTRAL_ROLE_SELECTION_THRESHOLD || randomNeutralList.length === 0) {
          this.pushRandomRole(roleList, randomMafiaList, (entry) => {
            comparativePower += this.getRolePower(entry);
          });
        } else {
          this.pushRandomRole(roleList, randomNeutralList, (entry) => {
            comparativePower += this.getRolePower(entry);
          });
        }
      } else if (comparativePower >= ROLE_BALANCE_TOLERANCE) {
        this.pushRandomRole(roleList, randomMafiaList, (entry) => {
          comparativePower += this.getRolePower(entry);
        });
      } else {
        this.pushRandomRole(roleList, randomTownList, (entry) => {
          comparativePower += this.getRolePower(entry);
        });
      }
    }

    return roleList;
  }

  private pushRandomRole(
    target: RoleSelectionEntry[],
    source: RoleDefinition[],
    onChosen: (entry: RoleDefinition) => void,
  ): void {
    if (source.length === 0) return;
    const index = Math.floor(Math.random() * source.length);
    const addedRole = source[index];
    target.push(addedRole);
    onChosen(addedRole);
    if (this.isUniqueRole(addedRole)) {
      source.splice(index, 1);
    }
  }

  assignFactionsFromPlayerList(playerList: Player[], room: Room): Faction[] {
    const factions = FactionFactory.createFactions(
      room,
      playerList,
      builtInFactionDefinitions,
    );
    return factions;
  }

  getRolePower(entry: RoleSelectionEntry): number {
    if (isBuiltInRoleDefinition(entry)) {
      return entry.balance.power;
    }
    return entry.metadata.powerValue ?? 0;
  }

  isUniqueRole(entry: RoleSelectionEntry): boolean {
    if (isBuiltInRoleDefinition(entry)) {
      return entry.metadata.isUnique;
    }
    return entry.metadata.isUnique ?? false;
  }

  instantiateRole(roleOrDef: RoleSelectionEntry, room: Room, player: Player) {
    return createRoleInstance(roleOrDef, room, player);
  }

  getBuiltInDefinitions(): RoleDefinition[] {
    return builtInRoleDefinitions;
  }
}
