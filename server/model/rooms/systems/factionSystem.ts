import type { Room } from "../room.js";

export class FactionSystem {
  constructor(private readonly room: Room) {}

  resolveNight(): void {
    for (const faction of this.room.factionList) {
      faction.removeMembers();
      faction.handleNightVote();
    }
  }
}
