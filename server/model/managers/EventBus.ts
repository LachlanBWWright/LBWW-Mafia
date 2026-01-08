/**
 * Game event interface
 */
export interface GameEvent<T = unknown> {
  type: string;
  timestamp: number;
  data: T;
}

/**
 * Event listener function type
 */
export type EventListener<T = unknown> = (event: GameEvent<T>) => void;

/**
 * Event bus for decoupled component communication using pub/sub pattern
 *
 * Responsibilities:
 * - Event publishing
 * - Subscription management
 * - Event history (optional)
 */
export class EventBus {
  private listeners = new Map<string, EventListener[]>();
  private eventHistory: GameEvent[] = [];
  private maxHistorySize = 1000;

  /**
   * Publish an event to all subscribers
   * @param event The event to publish
   */
  publish<T>(event: GameEvent<T>): void {
    const eventWithTimestamp: GameEvent<T> = {
      ...event,
      timestamp: event.timestamp,
    };

    // Add to history
    this.eventHistory.push(eventWithTimestamp);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const eventListeners = this.listeners.get(event.type) ?? [];
    for (const listener of eventListeners) {
      try {
        listener(eventWithTimestamp);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    }
  }

  /**
   * Subscribe to an event type
   * @param eventType The event type to subscribe to
   * @param listener The listener function to call when event is published
   */
  subscribe<T>(eventType: string, listener: EventListener<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    const listeners = this.listeners.get(eventType);
    if (listeners) {
        listeners.push(listener as EventListener);
    }
  }

  /**
   * Unsubscribe from an event type
   * @param eventType The event type to unsubscribe from
   * @param listener The listener function to remove
   */
  unsubscribe<T>(eventType: string, listener: EventListener<T>): void {
    const eventListeners = this.listeners.get(eventType);
    if (!eventListeners) return;

    const index = eventListeners.indexOf(listener as EventListener);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }

    // Clean up empty listener arrays
    if (eventListeners.length === 0) {
      this.listeners.delete(eventType);
    }
  }

  /**
   * Unsubscribe all listeners for an event type
   */
  unsubscribeAll(eventType: string): void {
    this.listeners.delete(eventType);
  }

  /**
   * Clear all subscriptions
   */
  clearAllSubscriptions(): void {
    this.listeners.clear();
  }

  /**
   * Get event history
   */
  getHistory(): readonly GameEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events of a specific type from history
   */
  getHistoryByType(eventType: string): GameEvent[] {
    return this.eventHistory.filter((event) => event.type === eventType);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Set maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    // Trim history if needed
    while (this.eventHistory.length > size) {
      this.eventHistory.shift();
    }
  }

  /**
   * Check if there are any subscribers for an event type
   */
  hasSubscribers(eventType: string): boolean {
    const eventListeners = this.listeners.get(eventType);
    return eventListeners !== undefined && eventListeners.length > 0;
  }
}

/**
 * Common event types
 */
export enum GameEventType {
  // Game lifecycle
  GAME_STARTED = "GAME_STARTED",
  GAME_ENDED = "GAME_ENDED",

  // Phase events
  PHASE_CHANGED = "PHASE_CHANGED",
  DAY_STARTED = "DAY_STARTED",
  NIGHT_STARTED = "NIGHT_STARTED",

  // Player events
  PLAYER_JOINED = "PLAYER_JOINED",
  PLAYER_LEFT = "PLAYER_LEFT",
  PLAYER_DIED = "PLAYER_DIED",

  // Voting events
  VOTE_CAST = "VOTE_CAST",
  VOTE_REMOVED = "VOTE_REMOVED",
  MAJORITY_REACHED = "MAJORITY_REACHED",

  // Action events
  ROLE_ABILITY_USED = "ROLE_ABILITY_USED",
  PLAYER_VISITED = "PLAYER_VISITED",

  // Message events
  MESSAGE_SENT = "MESSAGE_SENT",
  WHISPER_SENT = "WHISPER_SENT",

  // Win condition events
  WIN_CONDITION_CHECKED = "WIN_CONDITION_CHECKED",
  FACTION_WON = "FACTION_WON",
}
