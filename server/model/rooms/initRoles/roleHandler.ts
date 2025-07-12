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

//This generates the an array of role classes to be used, and then returns it to the room.
export class RoleHandler {
  roomSize: number;
  constructor(roomSize: number) {
    this.roomSize = roomSize;
  }

  assignGame(): (typeof BlankRole)[] {
    let roleList: (typeof BlankRole)[] = []; //The array of roles to be returned to the room object roleList.push;
    let comparativePower = 0; //The comparative power, positive is in favour of town, negative in favour of the mafia

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

    for (let i = 0; i < this.roomSize; i++) {
      //
      let randomiser = Math.random() * 30 - 15; //Random Integer betweek -15 and 15
      //For testing specific roles, comment out otherwise
      /*             if(i == 0) {
                roleList.push(MafiaInvestigator);
                comparativePower += this.getPower(MafiaInvestigator);
                randomNeutralList.splice(4, 1);
                continue;
            }  */

      if (comparativePower < 15 && comparativePower > -15) {
        if (randomiser > comparativePower) {
          //The weaker the town, the higher the chance of a town member being added
          let index = Math.floor(Math.random() * randomTownList.length);
          let addedRole = randomTownList[index];
          if (!addedRole) {
            continue;
          }
          roleList.push(addedRole);

          comparativePower += this.getPower(addedRole);
          if (this.uniqueRoleCheck(addedRole)) randomTownList.splice(index, 1);
        } else {
          //Add mafia/neutral role
          if (Math.random() > 0.3 || randomNeutralList.length == 0) {
            //Add Mafia
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
            //Add neutral role
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
      } else if (comparativePower >= 15) {
        //Town is too powerful - Add mafia
        let index = Math.floor(Math.random() * randomMafiaList.length);
        let addedRole = randomMafiaList[index];
        if (!addedRole) {
          continue;
        }
        roleList.push(addedRole);
        comparativePower += this.getPower(addedRole);
        if (this.uniqueRoleCheck(addedRole)) randomMafiaList.splice(index, 1);
      } else {
        //Mafia is too powerful - Add town
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

  //Returns true if a role is unique, so it can be removed from the propsective role list for additional players
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

  //Returns the extent to which a role helps the town
  getPower(role: typeof BlankRole) {
    switch (role) {
      //Town Roles
      case Doctor:
        return 5;
      case Judge:
        return 6;
      case Watchman:
        return 4;
      case Investigator:
        return 4;
      case Lawman:
        return 8;
      case Vetter:
        return 4;
      case Tapper:
        return 3;
      case Tracker:
        return 5;
      case Bodyguard:
        return 6;
      case Nimby:
        return 5;
      case Sacrificer:
        return 8;
      case Fortifier:
        return 8;
      case Roleblocker:
        return 5;
      case Jailor:
        return 12;
      //Mafia Roles
      case Mafia:
        return -13;
      case MafiaRoleblocker:
        return -20;
      case MafiaInvestigator:
        return -15;
      //Neutral Roles
      case Maniac:
        return -12;
      case Sniper:
        return -10;
      case Framer:
        return -5;
      case Confesser:
        return -5;
      case Peacemaker:
        return -2;
      default:
        return 0;
    }
  }
}
