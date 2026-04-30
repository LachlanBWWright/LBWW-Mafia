import { RoleGroup } from "../../roles/roleGroup.js";
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

const ROLE_BALANCE_TOLERANCE = 15;
const RANDOM_BALANCE_OFFSET_MIN = -15;
const RANDOM_BALANCE_OFFSET_RANGE = 30;
const NEUTRAL_ROLE_SELECTION_THRESHOLD = 0.3;

const ROLE_POWER_VALUES = {
  DOCTOR: 5,
  JUDGE: 6,
  WATCHMAN: 4,
  INVESTIGATOR: 4,
  LAWMAN: 8,
  VETTER: 4,
  TAPPER: 3,
  TRACKER: 5,
  BODYGUARD: 6,
  NIMBY: 5,
  SACRIFICER: 8,
  FORTIFIER: 8,
  ROLEBLOCKER: 5,
  JAILOR: 12,
  MAFIA: -13,
  MAFIA_ROLEBLOCKER: -20,
  MAFIA_INVESTIGATOR: -15,
  MANIAC: -12,
  SNIPER: -10,
  FRAMER: -5,
  CONFESSER: -5,
  PEACEMAKER: -2,
} as const;

//This generates the an array of role classes to be used, and then returns it to the room.
/**
 * Manages role assignment for games, balancing team power dynamically.
 * Assigns roles to players using power scoring to maintain game balance between Town and Mafia.
 * Also creates and assigns faction groups for coordinated roles.
 *
 * @class RoleHandler
 */
export class RoleHandler {
  /**
   * The size of the game room (number of players).
   * @type {number}
   */
  roomSize: number;

  /**
   * Creates a new RoleHandler for a given room size.
   *
   * @param {number} roomSize - The number of players in the game
   */
  constructor(roomSize: number) {
    this.roomSize = roomSize;
  }

  /**
   * Assigns a balanced set of roles for all players in the game.
   * Uses comparative power scoring to ensure Town and Mafia remain balanced.
   * Removes unique roles from selection pools to prevent duplicates.
   *
   * @returns {(typeof BlankRole)[]} Array of role classes to assign to players
   */
  assignGame(): (typeof BlankRole)[] {
    let roleList: (typeof BlankRole)[] = [];
    let comparativePower = 0;

    //Role Lists
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

    for (const slotToken of Array.from({ length: this.roomSize }, () => true)) {
      if (!slotToken) continue;
      //
      let randomiser =
        Math.random() * RANDOM_BALANCE_OFFSET_RANGE + RANDOM_BALANCE_OFFSET_MIN;
      //For testing specific roles, comment out otherwise
      /*             if(i == 0) {
                roleList.push(MafiaInvestigator);
                comparativePower += this.getPower(MafiaInvestigator);
                randomNeutralList.splice(4, 1);
                continue;
            }  */

      if (
        comparativePower < ROLE_BALANCE_TOLERANCE &&
        comparativePower > -ROLE_BALANCE_TOLERANCE
      ) {
        if (randomiser > comparativePower) {
          //The weaker the town, the higher the chance of a town member being added
          let index = Math.floor(Math.random() * randomTownList.length);
          let addedRole = randomTownList[index];
          roleList.push(addedRole);
          comparativePower += this.getPower(addedRole);
          if (this.uniqueRoleCheck(addedRole)) randomTownList.splice(index, 1);
        } else {
          //Add mafia/neutral role
          if (
            Math.random() > NEUTRAL_ROLE_SELECTION_THRESHOLD ||
            randomNeutralList.length == 0
          ) {
            //Add Mafia
            let index = Math.floor(Math.random() * randomMafiaList.length);
            let addedRole = randomMafiaList[index];
            roleList.push(addedRole);
            comparativePower += this.getPower(addedRole);
            if (this.uniqueRoleCheck(addedRole))
              randomMafiaList.splice(index, 1);
          } else {
            //Add neutral role
            let index = Math.floor(Math.random() * randomNeutralList.length);
            let addedRole = randomNeutralList[index];
            roleList.push(addedRole);
            comparativePower += this.getPower(addedRole);
            if (this.uniqueRoleCheck(addedRole))
              randomNeutralList.splice(index, 1);
          }
        }
      } else if (comparativePower >= ROLE_BALANCE_TOLERANCE) {
        //Town is too powerful - Add mafia
        let index = Math.floor(Math.random() * randomMafiaList.length);
        let addedRole = randomMafiaList[index];
        roleList.push(addedRole);
        comparativePower += this.getPower(addedRole);
        if (this.uniqueRoleCheck(addedRole)) randomMafiaList.splice(index, 1);
      } else {
        //Mafia is too powerful - Add town
        let index = Math.floor(Math.random() * randomTownList.length);
        let addedRole = randomTownList[index];
        roleList.push(addedRole);
        comparativePower += this.getPower(addedRole);
        if (this.uniqueRoleCheck(addedRole)) randomTownList.splice(index, 1);
      }
    }
    return roleList;
  }

  /**
   * Assigns faction objects to players based on their roles.
   * Creates a LawmanFaction if any Lawman exists, and a MafiaFaction if any Mafia role exists.
   *
   * @param {Player[]} playerList - List of all players in the game
   * @returns {any[]} Array of faction objects to manage coordinated role actions
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
      if (player.role.group === RoleGroup.Mafia) {
        factionList.push(new MafiaFaction());
        break;
      }
    }

    return factionList;
  }

  /**
   * Determines if a role is unique and should only appear once per game.
   * Checks against a hardcoded list of unique roles.
   *
   * @param {typeof BlankRole} role - The role class to check
   * @returns {boolean} True if the role is unique and should be removed from selection, false otherwise
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
   * Calculates the power value of a role for game balance purposes.
   * Positive values favor Town, negative values favor Mafia/Neutral.
   * Used to dynamically select roles to maintain competitive balance.
   *
   * @param {typeof BlankRole} role - The role class to evaluate
   * @returns {number} Power value of the role (higher = more Town-favorable)
   */
  getPower(role: typeof BlankRole) {
    switch (role) {
      //Town Roles
      case Doctor:
        return ROLE_POWER_VALUES.DOCTOR;
      case Judge:
        return ROLE_POWER_VALUES.JUDGE;
      case Watchman:
        return ROLE_POWER_VALUES.WATCHMAN;
      case Investigator:
        return ROLE_POWER_VALUES.INVESTIGATOR;
      case Lawman:
        return ROLE_POWER_VALUES.LAWMAN;
      case Vetter:
        return ROLE_POWER_VALUES.VETTER;
      case Tapper:
        return ROLE_POWER_VALUES.TAPPER;
      case Tracker:
        return ROLE_POWER_VALUES.TRACKER;
      case Bodyguard:
        return ROLE_POWER_VALUES.BODYGUARD;
      case Nimby:
        return ROLE_POWER_VALUES.NIMBY;
      case Sacrificer:
        return ROLE_POWER_VALUES.SACRIFICER;
      case Fortifier:
        return ROLE_POWER_VALUES.FORTIFIER;
      case Roleblocker:
        return ROLE_POWER_VALUES.ROLEBLOCKER;
      case Jailor:
        return ROLE_POWER_VALUES.JAILOR;
      //Mafia Roles
      case Mafia:
        return ROLE_POWER_VALUES.MAFIA;
      case MafiaRoleblocker:
        return ROLE_POWER_VALUES.MAFIA_ROLEBLOCKER;
      case MafiaInvestigator:
        return ROLE_POWER_VALUES.MAFIA_INVESTIGATOR;
      //Neutral Roles
      case Maniac:
        return ROLE_POWER_VALUES.MANIAC;
      case Sniper:
        return ROLE_POWER_VALUES.SNIPER;
      case Framer:
        return ROLE_POWER_VALUES.FRAMER;
      case Confesser:
        return ROLE_POWER_VALUES.CONFESSER;
      case Peacemaker:
        return ROLE_POWER_VALUES.PEACEMAKER;
      default:
        return 0;
    }
  }
}
