import { type Player } from "../player/player.js";
import { Faction } from "./abstractFaction.js";
import { type Room } from "../rooms/room.js";
import type { Role } from "../roles/abstractRole.js";
import { RoleName } from "../../../shared/roles/roleEnums.js";

type LawmanRole = Role & { isInsane?: boolean };

export class LawmanFaction extends Faction {
  // Members are players whose role is Lawman; role may have `isInsane` flag
  memberList: (Player & { role: LawmanRole })[] = [];

  room?: Room;

  findMembers(playerList: Player[]) {
    //Go through a list of members, add them to the this.memberList
    for (const player of playerList) {
      if (player.role.name === RoleName.Lawman) {
        this.memberList.push(player);
      }
    }

    if (this.memberList.length > 0 && this.memberList[0]) {
      this.room = this.memberList[0].role.room;
    }

    this.initializeMembers(); //Then adds this faction to each relevant member's object
  }

  handleNightVote() {
    //Called at the end of the night. Forces a random visit for insane members.
    if (this.room === undefined) return;
    for (const member of this.memberList) {
      const role = member.role;
      const isInsane =
        typeof role.isInsane === "boolean" ? role.isInsane : false;
      if (isInsane) {
        //Selects a random person to visit
        for (let f = 0; f < 100; f++) {
          //Uses this instead of a while loop just in case some error occurs
          try {
            const randomVictim =
              this.room.playerList[
                Math.floor(Math.random() * this.room.playerList.length)
              ];
            if (randomVictim?.isAlive) {
              console.log(randomVictim.role.name);
              member.role.visiting = randomVictim.role;
              f = 1000;
            }
          } catch (error) {
            console.log(error);
          }
        }
      }
    }
  }

  handleNightMessage(_message: string, playerUsername: string) {
    //Tells the player that they cannot speak at night.
    if (!this.room) return;
    for (const member of this.memberList) {
      if (member.playerUsername == playerUsername) {
        this.room.socketHandler.sendPlayerMessage(member.socketId, {
          name: "receiveMessage",
          data: { message: "You cannot speak at night." },
        });
      }
    }
  }

  sendMessage(message: string) {
    if (!this.room) return;
    for (const member of this.memberList) {
      this.room.socketHandler.sendPlayerMessage(member.socketId, {
        name: "receiveMessage",
        data: { message },
      });
    }
  }

  removeMembers() {
    for (let i = 0; i < this.memberList.length; i++) {
      const member = this.memberList[i];
      if (!member) continue;
      if (!member.isAlive || member.role.name !== RoleName.Lawman) {
        this.memberList.splice(i, 1);
        i--;
      }
    }
  }
}
