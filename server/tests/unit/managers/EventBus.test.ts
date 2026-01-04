import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EventBus,
  GameEventType,
  type GameEvent,
} from "../../../model/managers/EventBus.js";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it("should subscribe and emit events", () => {
    const callback = vi.fn();
    const eventType = "TEST_EVENT" as GameEventType;
    const event: GameEvent = { type: eventType, data: { data: 123 }, timestamp: Date.now() };

    eventBus.subscribe(eventType, callback);
    eventBus.publish(event);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: eventType }));
  });

  it("should unsubscribe from events", () => {
    const callback = vi.fn();
    const eventType = "TEST_EVENT" as GameEventType;
    const event: GameEvent = { type: eventType, data: { data: 123 }, timestamp: Date.now() };

    eventBus.subscribe(eventType, callback);
    eventBus.unsubscribe(eventType, callback);
    eventBus.publish(event);

    expect(callback).not.toHaveBeenCalled();
  });
});
