/**
 * Explicit chat handler result.
 */
export type HandlerResult = "handled" | "not-handled";

/**
 * Explicit command/vote handler result.
 */
export type CommandResult =
  | { outcome: "accepted" }
  | { outcome: "rejected" }
  | { outcome: "not-applicable" };

/**
 * Shared result constants for handlers.
 */
export const handled: HandlerResult = "handled";
export const notHandled: HandlerResult = "not-handled";
export const accepted: CommandResult = { outcome: "accepted" };
export const rejected: CommandResult = { outcome: "rejected" };
export const notApplicable: CommandResult = { outcome: "not-applicable" };

/**
 * Returns true when a command result should stop dispatch.
 *
 * @param result - Result to inspect.
 * @returns Whether dispatch should stop.
 */
export function isTerminalCommandResult(
  result: CommandResult | undefined,
): boolean {
  return result?.outcome === "accepted" || result?.outcome === "rejected";
}
