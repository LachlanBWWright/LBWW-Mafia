/**
 * Server-side game phase enum.
 * Represents the internal lifecycle state of a Room on the server.
 * This is distinct from the client-facing DayTime enum used in the wire protocol.
 */
export enum GamePhase {
  /** No game is in progress; the room is in the lobby/waiting state. */
  Idle = "idle",
  /** Daytime phase — players can chat, vote, and take day actions. */
  Day = "day",
  /** Nighttime phase — players submit night actions. */
  Night = "night",
  /** Transition phase — night actions are being processed before the next day starts. */
  Processing = "processing",
}
