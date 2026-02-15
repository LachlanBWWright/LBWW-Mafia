import Crypto from "crypto";
import { RoleHandler } from "./initRoles/roleHandler.js";
import { Player } from "../player/player.js";
import { PlayerSocket, io } from "../../servers/socket.js";
import { Confesser } from "../roles/neutral/confesser.js";
import { Faction } from "../factions/abstractFaction.js";
import { BlankRole } from "../roles/blankRole.js";
import { Framer } from "../roles/neutral/framer.js";
import { Peacemaker } from "../roles/neutral/peacemaker.js";
import { names } from "../player/names/namesList.js";
import { fromThrowable } from "neverthrow";

export class Room {
  name: string;
  size: number;
  playerCount = 0;
  playerList: Player[] = [];

  started = false;
  time: "day" | "night" | "" | "undefined" = "";
  roleList: (typeof BlankRole)[] = [];
  factionList: Faction[] = [];
  sessionLength: number;
  gameHasEnded = false;
  endDay = 3;

  //Data for handling unique roles
  framer: Framer | null = null; //Reference to the framer role, initialized by the roles constructor if applicable.
  confesserVotedOut = false; //Confessor role, who wants to get voted out
  peacemaker: Peacemaker | null = null; //Pleacemaker role, who wants to cause a tie by nobody dying for three days

  confesser?: Confesser;

  constructor(size: number) {
    //Data relating to the players in the room
    this.name = Crypto.randomBytes(8).toString("hex"); //Generates the room's "name"
    this.size = size; //Capacity of the room

    //Data relating to the state of the game.
    this.sessionLength = this.size * 4000; //How long the days/nights initially last for. Decreases over time, with nights at half the length of days
  }

  private runSafely(action: () => void) {
    const safeAction = fromThrowable(action, (error) => error);
    const result = safeAction();

    if (result.isErr()) {
      console.error(result.error);
    }
  }

  //Adds a new player to the room, and makes the game start if it is full. Returns error code if the user failed to join, or their username
  addPlayer(playerSocket: PlayerSocket) {
    let playerSocketId = playerSocket.id;
    //Stops the user from being added if there's an existing user with the same username or socketId, or if the room is full
    for (let i = 0; i < this.playerList.length; i++) {
      if (this.playerList[i].socketId === playerSocketId) return 1;
      else if (this.playerList.length >= this.size) return 3;
    }

    //Generates username
    let playerUsername = "";
    let takenNames = [];
    for (let i = 0; i < this.playerList.length; i++)
      takenNames.push(this.playerList[i].playerUsername);
    for (let i = 0; i < names.length; i++) {
      if (!takenNames.includes(names[i])) {
        playerUsername = names[i];
        break;
      }
    }

    this.emitPlayerList(playerSocketId);

    io.to(this.name).emit(
      "receiveMessage",
      playerUsername + " has joined the room!",
    );
    playerSocket.data.position =
      this.playerList.push(
        new Player(playerSocket, playerSocketId, playerUsername, this),
      ) - 1; //Adds a player to the array
    this.playerCount = this.playerList.length; //Updates the player count
    io.to(this.name).emit("receive-new-player", { name: playerUsername });

    //Starts the game if the room has filled its maximum size
    if (this.playerCount === this.size) {
      this.started = true;
      io.to(this.name).emit(
        "receiveMessage",
        "The room is full! Starting the game!",
      );
      this.emitPlayerList(this.name);

      this.startGame();
    }
    return playerUsername; //Successfully joined
  }

  //Handles a player being removed if they've disconnected
  removePlayer(playerSocketId: string) {
    for (let i = 0; i < this.playerList.length; i++) {
      if (
        this.playerList[i].socketId === playerSocketId &&
        !this.gameHasEnded
      ) {
        //!gameHasEnded stops leaving messages when the clients are booted when the game ends
        if (!this.started) {
          //Removes the player if the game has not started
          io.to(this.name).emit("remove-player", {
            name: this.playerList[i].playerUsername,
          });
          io.to(this.name).emit(
            "receiveMessage",
            this.playerList[i].playerUsername + " has left the room!",
          );
          this.playerList.splice(i, 1);
          for (let x = i; x < this.playerList.length; x++)
            this.playerList[x].socket.data.position = x; //Updates positions
          this.playerCount = this.playerList.length;
        } else {
          //Kills the player if the game has started
          io.to(this.name).emit(
            "receiveMessage",
            this.playerList[i].playerUsername + " has abandoned the game!",
          );
          this.playerList[i].role.damage = 999;
        }
      }
    }
  }

  isInRoom(playerSocketId: string) {
    for (let i = 0; i < this.playerList.length; i++)
      if (this.playerList[i].socketId == playerSocketId) return true;
    return false;
  }

  emitPlayerList(socketId: string) {
    //Returns a player list
    let playersReturned = [];
    for (let i = 0; i < this.playerList.length; i++) {
      playersReturned.push({
        name: this.playerList[i].playerUsername,
        isAlive: this.started ? this.playerList[i].isAlive : undefined, //isAlive is undefined if the game has not started
        role:
          this.started && !this.playerList[i].isAlive
            ? this.playerList[i].role.name
            : undefined, //Reveals the role if the player is dead, and the game has started
      });
    }
    io.to(socketId).emit("receive-player-list", playersReturned);
  }

  //Handles users sending messages to the chat
  handleSentMessage(
    playerSocket: PlayerSocket,
    message: string,
    isDay: boolean,
  ) {
    const handleMessage = fromThrowable(
      () => {
        if (
          (!isDay && this.time === "day") ||
          (isDay && this.time === "night") ||
          playerSocket.data.position === undefined
        )
          return;

        let foundPlayer = this.playerList[playerSocket.data.position];
        if (this.started) {
          //If the game has started, handle the message with the role object
          if (foundPlayer.isAlive) foundPlayer.role.handleMessage(message);
          //Doesn't start with either - send as a regular message
          else
            io.to(playerSocket.id).emit(
              "receiveMessage",
              "You cannot speak, as you are dead.",
            );
        } else
          io.to(this.name).emit(
            "receive-chat-message",
            foundPlayer.playerUsername + ": " + message,
          ); //If the game hasn't started, no roles have been assigned, just send the message directly
      },
      (error) => error,
    );
    const result = handleMessage();

    if (result.isErr()) {
      io.to(playerSocket.id).emit(
        "receiveMessage",
        "You cannot speak, as you are dead. Or an error occured.",
      );
      console.error(result.error); //Error is thrown if a player cannot be found
    }
  }

  handleVote(playerSocket: PlayerSocket, recipient: number, isDay: boolean) {
    this.runSafely(() => {
      if (
        (!isDay && this.time === "day") ||
        (isDay && this.time === "night") ||
        this.time === "" ||
        playerSocket.data.position === undefined
      )
        return; //Cancels on client-server time mismatch, or if the time is invalid
      let foundPlayer = this.playerList[playerSocket.data.position];
      let foundRecipient = this.playerList[recipient];

      if (foundPlayer.hasVoted)
        io.to(playerSocket.id).emit(
          "receiveMessage",
          "You cannot change your vote.",
        );
      else if (foundPlayer === foundRecipient)
        io.to(playerSocket.id).emit(
          "receiveMessage",
          "You cannot vote for yourself.",
        );
      else if (this.time != "day") {
        if (foundPlayer.role.nightVote) {
          foundPlayer.hasVoted = true;
          foundPlayer.role.handleNightVote(foundRecipient);
        } else
          io.to(playerSocket.id).emit(
            "receiveMessage",
            "You cannot vote at night.",
          );
      } else if (this.confesserVotedOut)
        io.to(playerSocket.id).emit(
          "receiveMessage",
          "The town voted out a confessor, disabling voting.",
        );
      else if (foundRecipient.isAlive && !foundPlayer.hasVoted) {
        foundPlayer.hasVoted = true;
        foundRecipient.votesReceived++;
        if (foundRecipient.votesReceived > 1)
          io.to(this.name).emit(
            "receiveMessage",
            foundPlayer.playerUsername +
              " has voted for " +
              foundRecipient.playerUsername +
              " to be executed! There are " +
              foundRecipient.votesReceived +
              " votes for " +
              foundRecipient.playerUsername +
              " to be killed.",
          );
        else
          io.to(this.name).emit(
            "receiveMessage",
            foundPlayer.playerUsername +
              " has voted for " +
              foundRecipient.playerUsername +
              " to be executed! There is 1 vote for " +
              foundRecipient.playerUsername +
              " to be killed.",
          );
      } else
        io.to(playerSocket.id).emit("receiveMessage", "Your vote was invalid.");
    });
  }

  handleWhisper(
    playerSocket: PlayerSocket,
    recipient: number,
    message: string,
    isDay: boolean,
  ) {
    this.runSafely(() => {
      if (
        (!isDay && this.time === "day") ||
        (isDay && this.time == "night") ||
        this.time === "" ||
        playerSocket.data.position === undefined
      )
        return;
      let foundPlayer = this.playerList[playerSocket.data.position];
      let foundRecipient = this.playerList[recipient];

      if (this.time === "night")
        io.to(foundPlayer.socketId).emit(
          "receiveMessage",
          "You cannot whisper at night.",
        );
      else if (this.time === "day" && foundRecipient.isAlive) {
        if (0.1 > Math.random()) {
          //10% chance of the whisper being overheard by the town.
          io.to(foundPlayer.socketId).emit(
            "receiveMessage",
            "Your whispers were overheard by the town!",
          );
          io.to(this.name).emit(
            "receiveMessage",
            foundPlayer.playerUsername +
              ' tried to whisper "' +
              message +
              '" to ' +
              foundRecipient.playerUsername +
              ", but was overheard by the town!",
          );
        } else {
          io.to(foundRecipient.socketId).emit(
            "receive-whisper-message",
            "Whisper from " + foundPlayer.playerUsername + ": " + message,
          );
          io.to(foundPlayer.socketId).emit(
            "receive-whisper-message",
            "Whisper to " + foundRecipient.playerUsername + ": " + message,
          );
          if (foundPlayer.role.dayTapped != false)
            io.to(foundPlayer.role.dayTapped.player.socketId).emit(
              "receive-whisper-message",
              foundPlayer.playerUsername +
                ' whispered "' +
                message +
                '" to ' +
                foundRecipient.playerUsername +
                ".",
            );
          else if (foundRecipient.role.dayTapped != false)
            io.to(foundPlayer.role.dayTapped.player.socketId).emit(
              "receive-whisper-message",
              foundPlayer.playerUsername +
                ' whispered "' +
                message +
                '" to ' +
                foundRecipient.playerUsername +
                ".",
            );
        }
      } else
        io.to(foundPlayer.socketId).emit(
          "receiveMessage",
          "You didn't whisper to a valid recipient, or they are dead.",
        );
    });
  }

  handleVisit(
    playerSocket: PlayerSocket,
    recipient: number | null,
    isDay: boolean,
  ) {
    this.runSafely(() => {
      if (
        (!isDay && this.time === "day") ||
        (isDay && this.time === "night") ||
        this.time === "" ||
        playerSocket.data.position === undefined
      )
        return;
      let foundPlayer = this.playerList[playerSocket.data.position];
      let foundRecipient =
        recipient !== null ? this.playerList[recipient] : null;

      if (this.time === "day") {
        if (foundRecipient !== null)
          foundPlayer.role.handleDayAction(foundRecipient);
        else foundPlayer.role.cancelDayAction();
      } else if (this.time === "night") {
        if (foundPlayer.role.roleblocked)
          io.to(playerSocket.id).emit(
            "receiveMessage",
            "You are roleblocked, and cannot call commands.",
          );
        else {
          if (foundRecipient !== null)
            foundPlayer.role.handleNightAction(foundRecipient);
          else foundPlayer.role.cancelNightAction();
        }
      }
    });
  }

  async startGame() {
    let roleHandler = new RoleHandler(this.playerCount);
    this.roleList.push(...roleHandler.assignGame()); //The function returns an array of 'roles' classes, and appends them to the empty rolelist array

    //Shuffles the list of roles so that they can be randomly allocated to users
    let currentIndex = this.roleList.length;
    let randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex); //Math.floor truncates to make integers (5.99 => 5)
      currentIndex--;
      [this.roleList[currentIndex], this.roleList[randomIndex]] = [
        this.roleList[randomIndex],
        this.roleList[currentIndex],
      ];
    }

    //Allocates the shuffled rolelist to users
    for (let i = 0; i < this.playerList.length; i++) {
      this.playerList[i].socket.data.position = i;
      this.playerList[i].role = new this.roleList[i](this, this.playerList[i]); //Assigns the role to the player (this.roleList[i] is an ES6 class)

      let playerReturned = {
        name: this.playerList[i].playerUsername,
        role: this.playerList[i].role.name,
        dayVisitSelf: this.playerList[i].role.dayVisitSelf,
        dayVisitOthers: this.playerList[i].role.dayVisitOthers,
        dayVisitFaction: this.playerList[i].role.dayVisitFaction,
        nightVisitSelf: this.playerList[i].role.nightVisitSelf,
        nightVisitOthers: this.playerList[i].role.nightVisitOthers,
        nightVisitFaction: this.playerList[i].role.nightVisitFaction,
        nightVote: this.playerList[i].role.nightVote,
      };
      io.to(this.playerList[i].socketId).emit(
        "assign-player-role",
        playerReturned,
      );
    }

    this.factionList.push(
      ...roleHandler.assignFactionsFromPlayerList(this.playerList),
    );
    //Assigns roles to each faction, then factions to each relevant role.
    for (let i = 0; i < this.factionList.length; i++)
      this.factionList[i].findMembers(this.playerList);
    for (let i = 0; i < this.playerList.length; i++)
      this.playerList[i].role.initRole();

    this.startFirstDaySession(this.sessionLength);
  }

  //Sessions - Each session lasts for a period of time.
  //After it is over, the room executes the actions decided by the players.
  //Then, it checks the living player's factions to determine if the game is over.

  //The first day session is shorter than normal.
  startFirstDaySession(sessionLength: number) {
    this.time = "day";
    io.to(this.name).emit("receiveMessage", "Day 1 has started.");
    io.to(this.name).emit("update-day-time", {
      time: "Day",
      dayNumber: 1,
      timeLeft: 5,
    });
    setTimeout(() => {
      this.runSafely(() => {
        for (let i = 0; i < this.playerList.length; i++)
          if (this.playerList[i].isAlive) this.playerList[i].role.dayVisit();
        io.to(this.name).emit("receiveMessage", "Night 1 has started.");
      });
      this.startNightSession(1, sessionLength);
    }, 5000); //Starts the first day quicker
  }

  startDaySession(dayNumber: number, sessionLength: number) {
    this.time = "day";

    if (this.endDay <= dayNumber) {
      io.to(this.name).emit(
        "receiveMessage",
        "Nobody has died in three consecutive days, so the game has ended.",
      );
      if (this.peacemaker !== null) {
        this.peacemaker.victoryCondition = true;
        io.to(this.peacemaker.player.socketId).emit(
          "receiveMessage",
          "You have won the game by causing a tie!",
        );
      }
      this.endGame("nobody");
      return;
    } else if (this.endDay - 1 <= dayNumber) {
      io.to(this.name).emit(
        "receiveMessage",
        "The game will end in a draw if nobody dies today or tonight.",
      );
    }

    let dateTimeJson = {
      time: "Day",
      dayNumber: dayNumber,
      timeLeft: Math.floor(sessionLength / 1000 + 10), //Converts ms to s, adds the 10s minimum
    };
    io.to(this.name).emit("update-day-time", dateTimeJson);

    //Announcements to the game
    io.to(this.name).emit(
      "receiveMessage",
      "Day " + dayNumber + " has started.",
    );
    let livingPlayerList: Player[] = [];
    for (let i = 0; i < this.playerList.length; i++) {
      if (this.playerList[i].isAlive) {
        this.playerList[i].role.dayUpdate();
        this.playerList[i].hasVoted = false;
        this.playerList[i].votesReceived = 0;
        livingPlayerList.push(this.playerList[i]);
      }
    }

    let votesRequired = Math.floor(livingPlayerList.length / 2) + 1; //A majority of the players, for an execution to be carried out.
    io.to(this.name).emit(
      "receiveMessage",
      "It takes " + votesRequired + " votes for the town to kill a player.",
    );

    setTimeout(() => {
      this.runSafely(() => {
        if (!this.confesserVotedOut)
          for (let i = 0; i < livingPlayerList.length; i++) {
            //Eliminates the player if they have a majority of the votes.
            if (livingPlayerList[i].votesReceived >= votesRequired) {
              this.endDay = dayNumber + 3;

              if (livingPlayerList[i].role.name === "Confesser") {
                io.to(this.name).emit(
                  "receiveMessage",
                  livingPlayerList[i].playerUsername +
                    " was a confesser! Voting has been disabled for the remainder of the game.",
                );
                this.confesserVotedOut = true;
                livingPlayerList[i].role.victoryCondition = true;
                io.to(this.name).emit("disable-voting");
              } else
                io.to(this.name).emit(
                  "receiveMessage",
                  livingPlayerList[i].playerUsername +
                    " has been voted out by the town.",
                );

              io.to(livingPlayerList[i].socketId).emit(
                "receiveMessage",
                "You have been voted out of the town.",
              );
              io.to(livingPlayerList[i].socketId).emit("blockMessages");
              livingPlayerList[i].isAlive = false;
              io.to(this.name).emit("update-player-role", {
                name: livingPlayerList[i].playerUsername,
              }); //Marks player as dead client-side, does not reveal their role

              if (
                this.framer !== null &&
                this.framer.target === livingPlayerList[i]
              ) {
                this.framer.victoryCondition = true;
                io.to(this.framer.player.socketId).emit(
                  "receiveMessage",
                  "You have successfully gotten your target voted out!",
                );
              }
            }
          }

        io.to(this.name).emit(
          "receiveMessage",
          "Night " + dayNumber + " has started.",
        );

        //Handles day visits
        for (let i = 0; i < this.playerList.length; i++) {
          if (this.playerList[i].isAlive) {
            this.playerList[i].role.dayVisit();
            this.playerList[i].role.dayTapped = false; //Undoes daytapping by the tapper class
            this.playerList[i].hasVoted = false;
          }
        }
      });

      //Checks if the game is over, and ends the room, or starts the next night.
      if (dayNumber < 25) {
        //Starts the next session, and ends the game if there's been 25 days.
        const winningFaction = this.findWinningFaction();
        if (winningFaction !== null) {
          this.endGame(winningFaction);
        } else {
          this.startNightSession(dayNumber, sessionLength * 0.85); //The time each session lasts for decreases over time
        }
      } else {
        this.endGame("nobody");
      }
    }, sessionLength + 10000); //Days are a minimum of 10 seconds long
  }

  startNightSession(nightNumber: number, sessionLength: number) {
    this.time = "night";
    io.to(this.name).emit("update-day-time", {
      time: "Night",
      dayNumber: nightNumber,
      timeLeft: 15,
    }); //TimeLeft is in seconds

    setTimeout(() => {
      this.runSafely(() => {
        this.time = "undefined"; //Prevents users from changing their visits

        //This handles factional decisions, and lets the factions assign the members "visiting" variable.
        for (let i = 0; i < this.factionList.length; i++) {
          this.factionList[i].removeMembers();
          this.factionList[i].handleNightVote();
        }

        //Roleblocking classes go first, and give the victims the roleblocked attribute
        for (let i = 0; i < this.playerList.length; i++)
          if (this.playerList[i].role.roleblocker)
            this.playerList[i].role.visit();
        //Marks who has visited who, and handles players whose abilities were disabled by being roleblocked
        for (let i = 0; i < this.playerList.length; i++) {
          if (
            this.playerList[i].role.roleblocked &&
            !this.playerList[i].role.roleblocker
          ) {
            //Cancels vists for players that were roleblocked, and informs them.
            this.playerList[i].role.visiting = null;
            io.to(this.playerList[i].socketId).emit(
              "receiveMessage",
              "You were roleblocked!",
            );
            this.playerList[i].role.roleblocked = false;
          } else if (
            this.playerList[i].role.visiting != null &&
            !this.playerList[i].role.roleBlocker
          )
            this.playerList[i].role.visit();
        }
        //Executes the effects that each visit has
        for (let i = 0; i < this.playerList.length; i++)
          if (this.playerList[i].isAlive)
            this.playerList[i].role.handleVisits(); //Handles actions for certain roles whose behaviour depends on who has visited who.
        //Kills players who have been attacked without an adequate defence, resets visits after night logic has been completed
        for (let i = 0; i < this.playerList.length; i++) {
          if (this.playerList[i].isAlive) {
            if (this.playerList[i].role.handleDamage())
              this.endDay = nightNumber + 3; //Handles the player being attacked, potentially killing them.
            this.playerList[i].role.dayVisiting = null; //Resets dayvisiting
            this.playerList[i].role.visiting = null; //Resets visiting.
            this.playerList[i].role.roleblocked = false; //Resets roleblocked status
            this.playerList[i].role.visitors = []; //Resets visitor list.
            this.playerList[i].role.nightTapped = false;
          }
        }
      });

      const winningFaction = this.findWinningFaction();
      if (winningFaction !== null) {
        this.endGame(winningFaction);
      } else this.startDaySession(nightNumber + 1, sessionLength);
    }, 15000); //Nights are 15 seconds long.
  }

  findWinningFaction() {
    //Note: Roles considered to be 'neutral' in the roleHandler do NOT necessarily have the 'neutral' group attribute in their role class.
    //Only roles that can win with anyone else are will be of the 'neutral' group.

    let lastFaction = "neutral"; //Compares the previous (non-neutral) faction with the next.
    for (let i = 0; i < this.playerList.length; i++) {
      //Roles with the 'neutral' group have a victory condition. TODO: Check to allow them to win
      if (
        this.playerList[i].role.group != "neutral" &&
        this.playerList[i].isAlive
      ) {
        if (lastFaction == "neutral")
          lastFaction = this.playerList[i].role.group;
        else if (this.playerList[i].role.group != lastFaction) return null; //Game is NOT over if there are are members of two different factions alive (excluding neutral)
      }
    }
    return lastFaction;
  }

  endGame(winningFactionName: string) {
    this.gameHasEnded = true;
    if (winningFactionName == "nobody")
      io.to(this.name).emit(
        "receiveMessage",
        "The game has ended with a draw!",
      );
    else if (winningFactionName == "neutral")
      io.to(this.name).emit("receiveMessage", "The neutral players have won!");
    else {
      if (winningFactionName.endsWith("s"))
        io.to(this.name).emit(
          "receiveMessage",
          "The " + winningFactionName + " have won!",
        );
      else
        io.to(this.name).emit(
          "receiveMessage",
          "The " + winningFactionName + " has won!",
        );
    }
    io.to(this.name).emit("receiveMessage", "Closing the room!");
    io.to(this.name).emit("blockMessages");
    io.in(this.name).disconnectSockets();
  }
}
