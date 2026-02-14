import { Player } from "../player/player.js";
import { Faction } from "./abstractFaction.js";
import { Room } from "../rooms/room.js";
import { io } from "../../servers/socket.js";
import { fromThrowable } from "neverthrow";

export class LawmanFaction extends Faction {
  room?: Room;

  findMembers(playerList: Player[]) {
    //Go through a list of members, add them to the this.memberList
    for (let i = 0; i < playerList.length; i++) {
      if (playerList[i].role.name == "Lawman") {
        this.memberList.push(playerList[i]);
      }
    }

    if (this.memberList.length > 0) this.room = this.memberList[0].role.room;

    this.initializeMembers(); //Then adds this faction to each relevant member's object
  }

  handleNightVote() {
    //Called at the end of the night. Forces a random visit for insane members.
    if (this.room === undefined) return;
    for (let i = 0; i < this.memberList.length; i++) {
      if (this.memberList[i].role.isInsane) {
        //Selects a random person to visit
        for (let f = 0; f < 100; f++) {
          //Uses this instead of a while loop just in case some error occurs
          const setRandomVisit = fromThrowable(
            () => {
              let randomVictim =
                this.room.playerList[
                  Math.floor(Math.random() * this.room.playerList.length)
                ];
              if (randomVictim.isAlive) {
                console.log(randomVictim.role.name);
                this.memberList[i].role.visiting = randomVictim.role;
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
    for (let i = 0; i < this.memberList.length; i++) {
      if (this.memberList[i].playerUsername == playerUsername) {
        io.to(this.memberList[i].socketId).emit(
          "receiveMessage",
          "You cannot speak at night.",
        );
      }
    }
  }

  sendMessage(message: string) {
    for (let i = 0; i < this.memberList.length; i++) {
      io.to(this.memberList[i].socketId).emit("receiveMessage", message);
    }
  }

  removeMembers() {
    for (let i = 0; i < this.memberList.length; i++) {
      if (
        !this.memberList[i].isAlive ||
        this.memberList[i].role.name != "Lawman"
      ) {
        this.memberList.splice(i, 1);
        i--;
      }
    }
  }
}
