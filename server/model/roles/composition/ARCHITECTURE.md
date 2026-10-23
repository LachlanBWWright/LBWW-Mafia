# Role and faction composition boundaries

- `RoleDefinition` describes stable catalog data: metadata, combat baseline, capabilities, traits, and per-hook handler buckets such as `onNightVisit`, `onNightCommand`, and `onPlayerVotedOut`.
- `RoleInstance` is the runtime adapter that keeps legacy `Role` compatibility fields in sync with a structured `RoleRuntimeState`.
- Hook callbacks are executable behavior. They should use the composition helper modules for command results, targeting, effects, notices, and persistent runtime slots instead of mutating ad hoc closure state.
- Room systems continue to drive phase order, but they interact with composed roles through explicit runtime state and faction intents rather than implicit mutable flags where possible.
- `FactionDefinition` describes membership, chat, cleanup, and night-vote resolution rules. `ComposedFaction` owns a `FactionRuntimeState` that stores per-night votes and resolved intents.
- Built-in and custom roles both normalize through `createRoleInstance()`, then share the same handler/runtime path.
- New gameplay behavior should be added through role/faction definitions and handlers, not by introducing new `Role` subclasses.
