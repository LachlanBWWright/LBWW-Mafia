import { Time } from "../../../shared/socketTypes/socketTypes.js";

/**
 * Game state snapshot for save/load functionality
 */
export interface GameStateSnapshot {
  currentPhase: Time;
  dayNumber: number;
  started: boolean;
  gameHasEnded: boolean;
  endDay: number;
  confesserVotedOut: boolean;
  timestamp: number;
}

/**
 * Listener function for state changes
 */
export type StateChangeListener = (
  newState: GameStateSnapshot,
  previousState: GameStateSnapshot,
) => void;

/**
 * Centralized game state management with snapshot support and observer pattern
 *
 * Responsibilities:
 * - Single source of truth for game state
 * - State transition validation
 * - State snapshots for save/load
 * - Observer pattern for state changes
 */
export class GameStateManager {
  private currentPhase: Time = Time.Between;
  private dayNumber = 0;
  private started = false;
  private gameHasEnded = false;
  private endDay = 0;
  private confesserVotedOut = false;
  private listeners: StateChangeListener[] = [];

  /**
   * Get the current game phase
   */
  getCurrentPhase(): Time {
    return this.currentPhase;
  }

  /**
   * Set the current game phase
   */
  setCurrentPhase(phase: Time): void {
    const previousState = this.getSnapshot();
    this.currentPhase = phase;
    this.notifyListeners(previousState);
  }

  /**
   * Get the current day number
   */
  getDayNumber(): number {
    return this.dayNumber;
  }

  /**
   * Set the current day number
   */
  setDayNumber(day: number): void {
    const previousState = this.getSnapshot();
    this.dayNumber = day;
    this.notifyListeners(previousState);
  }

  /**
   * Increment the day number
   */
  incrementDayNumber(): void {
    this.setDayNumber(this.dayNumber + 1);
  }

  /**
   * Check if the game has started
   */
  hasStarted(): boolean {
    return this.started;
  }

  /**
   * Set whether the game has started
   */
  setStarted(started: boolean): void {
    const previousState = this.getSnapshot();
    this.started = started;
    this.notifyListeners(previousState);
  }

  /**
   * Check if the game has ended
   */
  hasEnded(): boolean {
    return this.gameHasEnded;
  }

  /**
   * Set whether the game has ended
   */
  setGameEnded(ended: boolean): void {
    const previousState = this.getSnapshot();
    this.gameHasEnded = ended;
    this.notifyListeners(previousState);
  }

  /**
   * Get the end day (day when game will end if no deaths)
   */
  getEndDay(): number {
    return this.endDay;
  }

  /**
   * Set the end day
   */
  setEndDay(day: number): void {
    const previousState = this.getSnapshot();
    this.endDay = day;
    this.notifyListeners(previousState);
  }

  /**
   * Check if confesser was voted out
   */
  isConjesserVotedOut(): boolean {
    return this.confesserVotedOut;
  }

  /**
   * Set whether confesser was voted out
   */
  setConjesserVotedOut(votedOut: boolean): void {
    const previousState = this.getSnapshot();
    this.confesserVotedOut = votedOut;
    this.notifyListeners(previousState);
  }

  /**
   * Get a snapshot of the current state
   */
  getSnapshot(): GameStateSnapshot {
    return {
      currentPhase: this.currentPhase,
      dayNumber: this.dayNumber,
      started: this.started,
      gameHasEnded: this.gameHasEnded,
      endDay: this.endDay,
      confesserVotedOut: this.confesserVotedOut,
      timestamp: Date.now(),
    };
  }

  /**
   * Restore state from a snapshot
   */
  restoreSnapshot(snapshot: GameStateSnapshot): void {
    const previousState = this.getSnapshot();
    this.currentPhase = snapshot.currentPhase;
    this.dayNumber = snapshot.dayNumber;
    this.started = snapshot.started;
    this.gameHasEnded = snapshot.gameHasEnded;
    this.endDay = snapshot.endDay;
    this.confesserVotedOut = snapshot.confesserVotedOut;
    this.notifyListeners(previousState);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(listener: StateChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of a state change
   */
  private notifyListeners(previousState: GameStateSnapshot): void {
    const currentState = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(currentState, previousState);
    }
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    const previousState = this.getSnapshot();
    this.currentPhase = Time.Between;
    this.dayNumber = 0;
    this.started = false;
    this.gameHasEnded = false;
    this.endDay = 0;
    this.confesserVotedOut = false;
    this.notifyListeners(previousState);
  }
}
