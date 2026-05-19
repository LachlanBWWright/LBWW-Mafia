import { setGameEmitter } from "../../servers/emitter.js";
import { Player } from "../player/player.js";
import { createRoleInstance } from "../roles/composition/roleFactory.js";
import type { RoleDefinition } from "../roles/composition/roleDefinition.js";
import { RoleHandler } from "../rooms/initRoles/roleHandler.js";
import { GameSystems } from "../rooms/systems/gameSystems.js";
import { Room } from "../rooms/room.js";
import { User } from "../user/user.js";

export type TestSocket = {
  id: string;
  data: { position?: number; roomObject?: Room };
  join(room: string): void;
};

export type EmittedCall = {
  target: string;
  event: string;
  args: unknown[];
};

export function createTestSocket(id: string): TestSocket {
  return {
    id,
    data: {},
    join: () => undefined,
  };
}

export function createTestUser(name: string, socketId = `${name}-socket`): User {
  return new User(createTestSocket(socketId), name);
}

export function createTestPlayer(name: string): Player {
  return new Player(createTestUser(name));
}

export function createRoomWithPlayers(name: string, playerNames: string[]) {
  const room = new Room(playerNames.length, name);
  const players = playerNames.map(createTestPlayer);
  room.playerList = players;
  room.userList = players.map((player) => player.user);
  return { room, players };
}

export function assignRole(
  room: Room,
  player: Player,
  definition: RoleDefinition,
) {
  const role = createRoleInstance(definition, room, player);
  player.assignRole(role);
  return role;
}

export function wireGameSystems(room: Room): void {
  const roleHandler = new RoleHandler(room.playerList.length);
  room.factionList = roleHandler.assignFactionsFromPlayerList(room.playerList, room);
  for (const faction of room.factionList) {
    faction.findMembers(room.playerList);
  }
  room.systems = new GameSystems(room);
}

export function installNoopEmitter(): void {
  setGameEmitter({
    to: () => ({ emit: () => undefined }),
    in: () => ({ disconnectSockets: () => undefined }),
  });
}

export function captureEmitter(): EmittedCall[] {
  const calls: EmittedCall[] = [];
  setGameEmitter({
    to(target: string) {
      return {
        emit(event: string, ...args: unknown[]) {
          calls.push({ target, event, args });
        },
      };
    },
    in(target: string) {
      return {
        disconnectSockets() {
          calls.push({ target, event: "disconnectSockets", args: [] });
        },
      };
    },
  });
  return calls;
}

export function setDeterministicRandom(room: Room, values: readonly number[]): void {
  let index = 0;
  room.setRandomSource(() => {
    const value = values[index % values.length];
    index += 1;
    return value ?? 0;
  });
}
