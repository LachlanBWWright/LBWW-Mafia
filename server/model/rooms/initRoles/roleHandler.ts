//Imports all the roles used

//Town Roles
import { Doctor } from "../../roles/town/doctor.js";
import { Judge } from "../../roles/town/judge.js";
import { Watchman } from "../../roles/town/watchman.js";
import { Investigator } from "../../roles/town/investigator.js";
import { Lawman } from "../../roles/town/lawman.js";
import { Vetter } from "../../roles/town/vetter.js";
import { Tapper } from "../../roles/town/tapper.js";
import { Tracker } from "../../roles/town/tracker.js";
import { Bodyguard } from "../../roles/town/bodyguard.js";
import { Nimby } from "../../roles/town/nimby.js";
import { Sacrificer } from "../../roles/town/sacrificer.js";
import { Fortifier } from "../../roles/town/fortifier.js";
import { Roleblocker } from "../../roles/town/roleblocker.js";
import { Jailor } from "../../roles/town/jailor.js";

//Mafia Roles
import { Mafia } from "../../roles/mafia/mafia.js";
import { MafiaRoleblocker } from "../../roles/mafia/mafiaRoleblocker.js";
import { MafiaInvestigator } from "../../roles/mafia/mafiaInvestigator.js";

//Neutral Roles
import { Maniac } from "../../roles/maniac/maniac.js";
import { Sniper } from "../../roles/sniper/sniper.js";
import { Framer } from "../../roles/neutral/framer.js";
import { Confesser } from "../../roles/neutral/confesser.js";
import { Peacemaker } from "../../roles/neutral/peacemaker.js";

//Imports all the factions used
import { MafiaFaction } from "../../factions/mafiaFaction.js";
import { LawmanFaction } from "../../factions/lawmanFaction.js";

import { Player } from "../../player/player.js";
import { BlankRole } from "../../roles/blankRole.js";
import {
  TOWN_POWER_THRESHOLD,
  MAFIA_POWER_THRESHOLD,
  ROLE_ASSIGNMENT_VARIANCE,
  NEUTRAL_ROLE_THRESHOLD,
  TOWN_ROLE_POWER,
  MAFIA_ROLE_POWER,
  NEUTRAL_ROLE_POWER,
} from "../../../constants/gameConstants.js";

/**
 * Handles role assignment and game balance for MERN-Mafia
 * 
 * Generates a balanced team composition based on room size and maintains
 * game balance through power rating calculations.
 */
export class RoleHandler {
  roomSize: number;
  
  constructor(roomSize: number) {
    this.roomSize = roomSize;
  }

  /**
   * Assigns roles for the game based on balance algorithm
   * @returns Array of role classes to be instantiated for players
   */
  assignGame(): (typeof BlankRole)[] {
    let roleList: (typeof BlankRole)[] = []; // The array of roles to be returned to the room object
    let comparativePower = 0; // The comparative power, positive is in favour of town, negative in favour of the mafia

    // Role Lists - Available roles for random selection
    let randomTownList: (typeof BlankRole)[] = [
      Doctor,
      Judge,
      Watchman,
      Investigator,
      Lawman,
      Vetter,
      Tapper,
      Tracker,
      Bodyguard,
      Nimby,
      Sacrificer,
      Fortifier,
      Roleblocker,
      Jailor,
    ];
    let randomMafiaList = [Mafia, MafiaRoleblocker, MafiaInvestigator];
    let randomNeutralList = [Maniac, Sniper, Framer, Confesser, Peacemaker];

    for (let i = 0; i < this.roomSize; i++) {
      // Random variance for role selection decisions
      let randomiser = Math.random() * (ROLE_ASSIGNMENT_VARIANCE * 2) - ROLE_ASSIGNMENT_VARIANCE; // Random Integer between -15 and 15
      
      // For testing specific roles, comment out otherwise
      /*             if(i == 0) {
                roleList.push(MafiaInvestigator);
                comparativePower += this.getPower(MafiaInvestigator);
                randomNeutralList.splice(4, 1);
                continue;
            }  */

      if (comparativePower < TOWN_POWER_THRESHOLD && comparativePower > MAFIA_POWER_THRESHOLD) {
        // Power is balanced - use randomizer to decide role type
        if (randomiser > comparativePower) {
          // The weaker the town, the higher the chance of a town member being added
          let index = Math.floor(Math.random() * randomTownList.length);
          let addedRole = randomTownList[index];
          if (!addedRole) {
            continue;
          }
          roleList.push(addedRole);

          comparativePower += this.getPower(addedRole);
          if (this.uniqueRoleCheck(addedRole)) randomTownList.splice(index, 1);
        } else {
          // Add mafia/neutral role
          if (Math.random() > NEUTRAL_ROLE_THRESHOLD || randomNeutralList.length == 0) {
            // Add Mafia
            let index = Math.floor(Math.random() * randomMafiaList.length);
            let addedRole = randomMafiaList[index];
            if (!addedRole) {
              continue;
            }
            roleList.push(addedRole);
            comparativePower += this.getPower(addedRole);
            if (this.uniqueRoleCheck(addedRole))
              randomMafiaList.splice(index, 1);
          } else {
            // Add neutral role
            let index = Math.floor(Math.random() * randomNeutralList.length);
            let addedRole = randomNeutralList[index];
            if (!addedRole) {
              continue;
            }
            roleList.push(addedRole);
            comparativePower += this.getPower(addedRole);
            if (this.uniqueRoleCheck(addedRole))
              randomNeutralList.splice(index, 1);
          }
        }
      } else if (comparativePower >= TOWN_POWER_THRESHOLD) {
        // Town is too powerful - Add mafia
        let index = Math.floor(Math.random() * randomMafiaList.length);
        let addedRole = randomMafiaList[index];
        if (!addedRole) {
          continue;
        }
        roleList.push(addedRole);
        comparativePower += this.getPower(addedRole);
        if (this.uniqueRoleCheck(addedRole)) randomMafiaList.splice(index, 1);
      } else {
        // Mafia is too powerful - Add town
        let index = Math.floor(Math.random() * randomTownList.length);
        let addedRole = randomTownList[index];
        if (!addedRole) {
          continue;
        }
        roleList.push(addedRole);
        comparativePower += this.getPower(addedRole);
        if (this.uniqueRoleCheck(addedRole)) randomTownList.splice(index, 1);
      }
    }
    return roleList;
  }

  /**
   * Creates faction instances based on roles assigned to players
   * @param playerList List of players with assigned roles
   * @returns Array of faction instances for coordinated play
   */
  assignFactionsFromPlayerList(playerList: Player[]) {
    let factionList = [];

    for (const player of playerList) {
      if (player.role.name === "Lawman") {
        factionList.push(new LawmanFaction());
        break;
      }
    }

    for (const player of playerList) {
      if (player.role.group === "mafia") {
        factionList.push(new MafiaFaction());
        break;
      }
    }

    return factionList;
  }

  /**
   * Checks if a role should only appear once per game
   * @param role The role class to check
   * @returns True if the role is unique (should be removed from selection pool)
   */
  uniqueRoleCheck(role: typeof BlankRole) {
    switch (role) {
      //Town
      case Jailor:
        return true;
      case Lawman:
        return true;

      //Mafia
      //None applicable at present

      //Neutral
      case Maniac:
        return true;
      case Sniper:
        return true;
      case Framer:
        return true;
      case Confesser:
        return true;
      case Peacemaker:
        return true;
      default:
        return false;
    }
  }

  /**
   * Returns the power rating of a role for game balance calculations
   * @param role The role class to get power rating for
   * @returns Power rating (positive helps town, negative helps mafia/neutrals)
   */
  getPower(role: typeof BlankRole) {
    switch (role) {
      // Town Roles
      case Doctor:
        return TOWN_ROLE_POWER.DOCTOR;
      case Judge:
        return TOWN_ROLE_POWER.JUDGE;
      case Watchman:
        return TOWN_ROLE_POWER.WATCHMAN;
      case Investigator:
        return TOWN_ROLE_POWER.INVESTIGATOR;
      case Lawman:
        return TOWN_ROLE_POWER.LAWMAN;
      case Vetter:
        return TOWN_ROLE_POWER.VETTER;
      case Tapper:
        return TOWN_ROLE_POWER.TAPPER;
      case Tracker:
        return TOWN_ROLE_POWER.TRACKER;
      case Bodyguard:
        return TOWN_ROLE_POWER.BODYGUARD;
      case Nimby:
        return TOWN_ROLE_POWER.NIMBY;
      case Sacrificer:
        return TOWN_ROLE_POWER.SACRIFICER;
      case Fortifier:
        return TOWN_ROLE_POWER.FORTIFIER;
      case Roleblocker:
        return TOWN_ROLE_POWER.ROLEBLOCKER;
      case Jailor:
        return TOWN_ROLE_POWER.JAILOR;
      // Mafia Roles
      case Mafia:
        return MAFIA_ROLE_POWER.MAFIA;
      case MafiaRoleblocker:
        return MAFIA_ROLE_POWER.MAFIA_ROLEBLOCKER;
      case MafiaInvestigator:
        return MAFIA_ROLE_POWER.MAFIA_INVESTIGATOR;
      // Neutral Roles
      case Maniac:
        return NEUTRAL_ROLE_POWER.MANIAC;
      case Sniper:
        return NEUTRAL_ROLE_POWER.SNIPER;
      case Framer:
        return NEUTRAL_ROLE_POWER.FRAMER;
      case Confesser:
        return NEUTRAL_ROLE_POWER.CONFESSER;
      case Peacemaker:
        return NEUTRAL_ROLE_POWER.PEACEMAKER;
      default:
        return 0;
    }
  }
}
