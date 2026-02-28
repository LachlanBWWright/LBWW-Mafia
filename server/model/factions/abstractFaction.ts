import { io } from "../../servers/emitter.js";
import { Player } from "../player/player.js";

export abstract class Faction {
  memberList: Player[] = [];

  initializeMembers() {
    for (const member of this.memberList) {
      member.role.assignFaction(this);
      for (const targetMember of this.memberList) {
        io.to(targetMember.socketId).emit("update-faction-role", {
          name: member.playerUsername,
          role: member.role.name,
        });
      }
    }
  }

  abstract findMembers(playerList: Player[]): void; //Finds members of the faction
  abstract sendMessage(message: string): void; //Sends a message to all members of the faction
  abstract handleNightVote(): void; //Handles factional decisions
  abstract handleNightMessage(message: string, playerUsername: string): void; //Handles night chat
  abstract removeMembers(): void; //Removes members if they have died, or been converted to another faction
}
