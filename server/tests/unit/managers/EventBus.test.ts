import { describe, it, expect, beforeEach } from "vitest";
import {
  EventBus,
  GameEventType,
  type GameEvent,
} from "../../model/managers/EventBus.js";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("Event Publishing", () => {
    it("should publish and receive events", () => {
      let receivedEvent: GameEvent | null = null;

      eventBus.subscribe(GameEventType.GAME_STARTED, (event: GameEvent) => {
        receivedEvent = event;
      });

      const testEvent: GameEvent = {
        type: GameEventType.GAME_STARTED,
        timestamp: Date.now(),
        data: { test: "data" },
      };

      eventBus.publish(testEvent);
      expect(receivedEvent).not.toBe(null);
    });

    it("should add timestamp if not provided", () => {
      let receivedEvent: GameEvent | null = null;

      eventBus.subscribe("TEST_EVENT", (event: GameEvent) => {
        receivedEvent = event;
      });

      eventBus.publish({
        type: "TEST_EVENT",
        timestamp: 0,
        data: {},
      });

      expect(receivedEvent?.timestamp).toBeGreaterThan(0);
    });
  });

  describe("Subscription Management", () => {
    it("should subscribe to events", () => {
      let callCount = 0;

      eventBus.subscribe("TEST", (_event: GameEvent) => {
        callCount++;
      });

      eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });
      expect(callCount).toBe(1);
    });

    it("should unsubscribe from events", () => {
      let callCount = 0;
      const listener = (_event: GameEvent) => {
        callCount++;
      };

      eventBus.subscribe("TEST", listener);
      eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });

      eventBus.unsubscribe("TEST", listener);
      eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });

      expect(callCount).toBe(1); // Should not increase after unsubscribe
    });

    it("should handle multiple subscribers", () => {
      let count1 = 0;
      let count2 = 0;

      eventBus.subscribe("TEST", (_event: GameEvent) => {
        count1++;
      });
      eventBus.subscribe("TEST", (_event: GameEvent) => {
        count2++;
      });

      eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it("should unsubscribe all listeners for an event type", () => {
      let count1 = 0;
      let count2 = 0;

      eventBus.subscribe("TEST", (_event: GameEvent) => {
        count1++;
      });
      eventBus.subscribe("TEST", (_event: GameEvent) => {
        count2++;
      });

      eventBus.unsubscribeAll("TEST");
      eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });

      expect(count1).toBe(0);
      expect(count2).toBe(0);
    });

    it("should clear all subscriptions", () => {
      let count = 0;

      eventBus.subscribe("TEST1", (_event: GameEvent) => {
        count++;
      });
      eventBus.subscribe("TEST2", (_event: GameEvent) => {
        count++;
      });

      eventBus.clearAllSubscriptions();
      eventBus.publish({ type: "TEST1", timestamp: Date.now(), data: {} });
      eventBus.publish({ type: "TEST2", timestamp: Date.now(), data: {} });

      expect(count).toBe(0);
    });
  });

  describe("Event History", () => {
    it("should store event history", () => {
      eventBus.publish({
        type: "TEST",
        timestamp: Date.now(),
        data: { id: 1 },
      });
      eventBus.publish({
        type: "TEST",
        timestamp: Date.now(),
        data: { id: 2 },
      });

      const history = eventBus.getHistory();
      expect(history).toHaveLength(2);
    });

    it("should filter history by type", () => {
      eventBus.publish({ type: "TEST1", timestamp: Date.now(), data: {} });
      eventBus.publish({ type: "TEST2", timestamp: Date.now(), data: {} });
      eventBus.publish({ type: "TEST1", timestamp: Date.now(), data: {} });

      const filtered = eventBus.getHistoryByType("TEST1");
      expect(filtered).toHaveLength(2);
    });

    it("should limit history size", () => {
      eventBus.setMaxHistorySize(5);

      for (let i = 0; i < 10; i++) {
        eventBus.publish({ type: "TEST", timestamp: Date.now(), data: { i } });
      }

      const history = eventBus.getHistory();
      expect(history).toHaveLength(5);
    });

    it("should clear history", () => {
      eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });
      eventBus.clearHistory();

      const history = eventBus.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe("Subscriber Checking", () => {
    it("should check if event has subscribers", () => {
      expect(eventBus.hasSubscribers("TEST")).toBe(false);

      eventBus.subscribe("TEST", () => {
        return undefined;
      });
      expect(eventBus.hasSubscribers("TEST")).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should not crash if listener throws error", () => {
      eventBus.subscribe("TEST", () => {
        throw new Error("Test error");
      });

      expect(() => {
        eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });
      }).not.toThrow();
    });

    it("should continue notifying other listeners if one throws", () => {
      let count = 0;

      eventBus.subscribe("TEST", () => {
        throw new Error("Test error");
      });
      eventBus.subscribe("TEST", () => {
        count++;
      });

      eventBus.publish({ type: "TEST", timestamp: Date.now(), data: {} });
      expect(count).toBe(1);
    });
  });
});
