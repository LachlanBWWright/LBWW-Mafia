import { Player } from "../player/player.js";
import { Faction } from "./abstractFaction.js";
import { Room } from "../rooms/room.js";
import { io } from "../../servers/emitter.js";
import { fromThrowable } from "neverthrow";

export class LawmanFaction extends Faction {
  room?: Room;

  findMembers(playerList: Player[]) {
    //Go through a list of members, add them to the this.memberList
    for (const player of playerList) {
      if (player.role.name == "Lawman") {
        this.memberList.push(player);
      }
    }

    if (this.memberList.length > 0) this.room = this.memberList[0].role.room;

    this.initializeMembers(); //Then adds this faction to each relevant member's object
  }

  handleNightVote() {
    //Called at the end of the night. Forces a random visit for insane members.
    if (this.room === undefined) return;
    for (const member of this.memberList) {
      if (member.role.isInsane) {
        //Selects a random person to visit
        for (let f = 0; f < 100; f++) {
          //Uses this instead of a while loop just in case some error occurs
          const setRandomVisit = fromThrowable(
            () => {
              const randomIndex = Math.floor(
                Math.random() * this.room.playerList.length,
              );
              const randomVictim = this.room.playerList[randomIndex];
              if (randomVictim.isAlive) {
                console.log(randomVictim.role.name);
                member.role.visiting = randomVictim.role;
                f = 1000;
              }
            },
            (error) => error,
          );
          const result = setRandomVisit();

          if (result.isErr()) {
            console.error(result.error);
          }
        }
      }
    }
  }

  handleNightMessage(message: string, playerUsername: string) {
    //Tells the player that they cannot speak at night.
    for (const member of this.memberList) {
      if (member.playerUsername == playerUsername) {
        io.to(member.socketId).emit(
          "receiveMessage",
          "You cannot speak at night.",
        );
      }
    }
  }

  sendMessage(message: string) {
    for (const member of this.memberList) {
      io.to(member.socketId).emit("receiveMessage", message);
    }
  }

  removeMembers() {
    this.memberList = this.memberList.filter(
      (member) => member.isAlive && member.role.name == "Lawman",
    );
  }
}
