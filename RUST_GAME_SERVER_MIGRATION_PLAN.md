# Rust Gameplay Server Migration Plan

## Goal

Migrate the stateful gameplay servers from the current TypeScript `Room`/Socket.IO/PartyKit implementation to Rust while preserving client protocol compatibility, gameplay behavior, and operational fallback paths.

The migration should not start as a transport rewrite. The first milestone is a Rust gameplay core that can replay the same inputs as the current TypeScript model and produce the same state changes and emitted events. Socket.IO, PartyKit, and any future transport should remain adapters around the same game contract.

## Current Shape

The gameplay server is split across these areas:

- `server/servers/socket.ts`: Socket.IO connection handling, CAPTCHA validation, room assignment, and event routing.
- `server/servers/partykit/partykitServer.ts`: PartyKit room lifecycle and JSON envelope routing.
- `server/model/rooms/room.ts`: stateful room lifecycle, lobby behavior, phase handling, chat, voting, visits, whispers, game start, game end, and match history.
- `server/model/rooms/systems/*`: focused gameplay systems for votes, combat, factions, visits, status effects, victory, chat, and phase scheduling.
- `server/model/roles/**` and `server/model/factions/**`: role/faction definitions and runtime behavior.
- `shared/communication/*`: event names, payload schemas, client/server contracts, and transport-neutral adapters.

The existing architecture already has the right conceptual boundary: clients speak a small event protocol, transports adapt sockets into `GamePlayerSocket`, and gameplay is concentrated in the room model and systems.

## Migration Principles

1. Preserve the existing wire protocol until there is a deliberate client migration.
2. Keep TypeScript and Rust implementations running side by side until parity is proven.
3. Treat emitted events as the source of compatibility, not just final room state.
4. Make randomness and timers injectable so replay tests are deterministic.
5. Move gameplay logic before moving hosting/runtime concerns.
6. Avoid rewriting unrelated Next.js, mobile, auth, database, or admin flows as part of this migration.

## Target Architecture

Create a Rust workspace package for the gameplay core and expose it through one or more adapters:

```text
rust/
  Cargo.toml
  game-core/
    src/
      room/
      systems/
      roles/
      factions/
      protocol/
  game-server/
    src/
      socketio_adapter.rs
      websocket_adapter.rs
      http.rs
```

Recommended crates:

- `serde` / `serde_json` for protocol serialization.
- `schemars` or `typify` for JSON schema interchange where useful.
- `tokio` for the native server runtime.
- `axum` for HTTP/WebSocket hosting.
- `socketioxide` or a dedicated Socket.IO crate if direct Socket.IO compatibility is required.
- `proptest` for invariant and property tests.
- `insta` for snapshot/golden output tests.

For PartyKit specifically, decide early whether the Rust implementation will:

- run as a separate authoritative service behind PartyKit acting as a thin relay, or
- compile to WebAssembly for a Workers-style runtime if the hosting model supports the required socket semantics.

The lower-risk path is a native Rust authoritative gameplay service with PartyKit retained temporarily as a compatibility relay.

## Phase 0: Baseline Inventory

Deliverables:

- A complete list of client-to-server events, server-to-client events, payloads, callbacks, and rejection cases from `shared/communication/events.ts` and `shared/communication/protocol.ts`.
- A gameplay feature inventory covering lobby joins/leaves, game start, phase changes, chat, whispers, day votes, night votes, visits, role actions, faction actions, status effects, combat, victory, draws, abandonment, and match history.
- A list of all random decisions and timer-driven transitions.

Testing requirements:

- Add or update TypeScript tests to cover every public room action:
  - `addUser`
  - `removePlayer`
  - `handleSentMessage`
  - `handleVote`
  - `handleVisit`
  - `handleWhisper`
  - `startGame`
  - phase transitions
  - `endGame`
- Verify current suites pass with:

```bash
pnpm --dir server test
pnpm --dir server run typecheck
```

Exit criteria:

- Every gameplay behavior being migrated has at least one TypeScript characterization test or golden replay fixture.
- Randomness and timers used by tests are deterministic.

## Phase 1: Contract And Fixture Layer

Build a shared replay format that both TypeScript and Rust can consume.

Example fixture shape:

```json
{
  "roomSize": 4,
  "roomName": "parity-room",
  "random": [0.1, 0.7, 0.2],
  "actions": [
    { "socketId": "a", "event": "playerJoinRoom", "args": ["captcha"] },
    { "socketId": "b", "event": "messageSentByUser", "args": ["hello", "day"] }
  ],
  "expectedEvents": [],
  "expectedState": {}
}
```

Deliverables:

- `server/model/testUtils` replay runner for the current TypeScript implementation.
- A fixture directory such as `shared/gameplay-fixtures/`.
- Snapshot outputs for emitted events and normalized state.
- A strict normalizer for dynamic values such as timestamps, room names, generated socket IDs, and random order.

Testing requirements:

- Fixture tests must assert both:
  - emitted event stream, including target room/socket and payload
  - normalized room state, including players, roles, factions, votes, alive/dead state, visits, status effects, phase, day number, and history
- Fixtures should include negative/ignored actions:
  - invalid phase
  - invalid recipient
  - duplicate vote
  - dead player chat
  - full room
  - pre-game disconnect
  - in-game disconnect

Exit criteria:

- The TypeScript server can generate and verify golden fixtures without involving real sockets.

## Phase 2: Rust Protocol Model

Implement Rust equivalents of the shared communication contract before gameplay logic.

Deliverables:

- Rust enums and structs for:
  - `ClientEvent`
  - `ServerEvent`
  - `DayTime`
  - `JoinRoomResult`
  - `GameOutcome`
  - `ActionKind`
  - all server payloads
  - PartyKit-style JSON envelopes if that transport is retained
- JSON serialization tests that prove Rust output matches existing TypeScript payloads.
- Generated or checked-in protocol fixtures shared between TypeScript and Rust.

Testing requirements:

- Round-trip JSON tests for every event payload.
- Rejection tests for malformed payloads currently blocked by `socketValidation.ts` and `shared/communication/protocol.ts`.
- Compatibility tests that compare Rust serialized payloads with TypeScript fixture JSON byte-for-byte after stable key ordering.

Exit criteria:

- Rust can parse every valid client event fixture and serialize every expected server event fixture.

## Phase 3: Rust Gameplay Core

Port gameplay logic into a transport-free Rust core.

Recommended order:

1. Core data model: room, user, player, phase, role runtime state, faction runtime state.
2. Lobby lifecycle: join, leave, room full, start game.
3. Deterministic role/faction assignment.
4. Chat and whisper behavior.
5. Vote system.
6. Visit resolution.
7. Role command system and individual role definitions.
8. Faction system.
9. Combat, status effects, and victory resolution.
10. Phase scheduler and timer abstraction.
11. Match history events.

Design the core around explicit inputs and outputs:

```text
GameCore::apply(input) -> Vec<ServerEmission>
```

The Rust core should not directly know about Socket.IO, PartyKit, HTTP, databases, or CAPTCHA.

Testing requirements:

- For every TypeScript characterization fixture, add a Rust replay test.
- Add Rust unit tests for each system ported from `server/model/rooms/systems`.
- Add property tests for invariants:
  - no alive player has a revealed death role
  - no player votes more than once per phase
  - actions in the wrong phase do not mutate state
  - emitted player lists match internal alive/dead state
  - game end is idempotent
  - phase transitions stop after game end
- Add deterministic random tests for role assignment and whisper overhearing.

Exit criteria:

- Rust replay output matches TypeScript golden fixtures for all currently covered gameplay paths.
- Rust unit/property tests pass independently through `cargo test`.

## Phase 4: Parity Harness In CI

Make parity a required check, not a one-time audit.

Deliverables:

- Root scripts for combined checks, for example:

```json
{
  "test:gameplay:ts": "pnpm --dir server test",
  "test:gameplay:rust": "cargo test --workspace",
  "test:gameplay:parity": "pnpm --dir server test:fixtures && cargo test -p game-core replay"
}
```

- CI job that runs TypeScript tests, Rust tests, and replay parity tests.
- Snapshot review process for intentional gameplay changes.

Testing requirements:

- Any change to gameplay must update both TypeScript and Rust outputs until TypeScript is retired.
- Fixtures should be organized by behavior area:
  - `lobby`
  - `chat`
  - `vote`
  - `visit`
  - `roles`
  - `factions`
  - `combat`
  - `victory`
  - `disconnects`

Exit criteria:

- CI fails if TypeScript and Rust disagree on an existing fixture.

## Phase 5: Adapter Implementation

After the Rust core reaches fixture parity, build runtime adapters.

Socket.IO options:

- Use a Rust Socket.IO-compatible crate and keep the existing web/mobile clients unchanged.
- Or keep the Node Socket.IO server as a thin adapter that forwards normalized gameplay inputs to a Rust service over HTTP/gRPC/WebSocket.

PartyKit options:

- Keep PartyKit as a relay to the Rust authoritative service.
- Or replace PartyKit rooms with direct WebSocket rooms hosted by the Rust server.

Recommended initial production path:

1. Keep existing TypeScript transports.
2. Add an internal Rust gameplay service.
3. Route a shadow copy of gameplay inputs to Rust.
4. Compare Rust outputs against TypeScript outputs in logs/metrics without sending Rust events to clients.
5. Promote Rust to authoritative only after shadow parity is stable.

Testing requirements:

- Adapter integration tests with fake sockets.
- End-to-end tests from web/mobile socket clients against the Rust-backed path.
- Disconnect/reconnect tests.
- Load tests for room creation, room full behavior, concurrent rooms, and phase timer churn.

Exit criteria:

- Clients can play a full game through the Rust-backed path with no protocol changes.
- Shadow-mode mismatches are zero for a meaningful test window.

## Phase 6: Shadow Mode And Cutover

Shadow mode should run TypeScript as authoritative and Rust as observer.

Observability requirements:

- Log input event ID, room ID, phase, actor socket ID, and deterministic replay index.
- Compare emitted event type, target, and normalized payload.
- Track mismatch counters by system area.
- Record replay bundles for mismatches so they can become fixtures.

Cutover gates:

- No known parity mismatches in CI.
- No unresolved shadow-mode mismatches in staging.
- Full-game manual QA passes for both web and mobile clients.
- Load test results meet or exceed the current Node runtime baseline.
- Rollback is a config switch back to TypeScript authority.

Rollout sequence:

1. Local development parity.
2. Staging shadow mode.
3. Staging Rust authoritative mode.
4. Small production cohort or private room cohort.
5. Full production switch.
6. Remove TypeScript gameplay authority only after a stable production window.

## Code Parity Checklist

For each TypeScript gameplay module being ported, track:

- Source file path.
- Rust destination file path.
- Public methods/actions.
- State fields.
- Emitted events.
- Random decisions.
- Timer behavior.
- Existing tests.
- New fixture coverage.
- Known intentional differences.

Initial mapping:

| TypeScript area | Rust area | Notes |
| --- | --- | --- |
| `server/model/rooms/room.ts` | `game-core/src/room/` | Primary state machine and lifecycle |
| `server/model/rooms/systems/voteSystem.ts` | `game-core/src/systems/vote.rs` | Day vote and quorum behavior |
| `server/model/rooms/systems/visitResolution*` | `game-core/src/systems/visits.rs` | Visit ordering and action resolution |
| `server/model/rooms/systems/combat*` | `game-core/src/systems/combat.rs` | Damage/defence parity is critical |
| `server/model/rooms/systems/victory*` | `game-core/src/systems/victory.rs` | Draw/faction outcome parity |
| `server/model/rooms/systems/phaseScheduler.ts` | `game-core/src/scheduler.rs` | Must be timer-injectable |
| `server/model/roles/composition/**` | `game-core/src/roles/` | Port definitions and runtime state together |
| `server/model/factions/**` | `game-core/src/factions/` | Keep faction membership and night intent behavior aligned |
| `shared/communication/**` | `game-core/src/protocol/` | Wire compatibility boundary |

## Testing Strategy Summary

Use four layers of tests:

1. Characterization tests in TypeScript to freeze current behavior.
2. Shared replay fixtures consumed by both implementations.
3. Rust unit/property tests for system-level correctness.
4. Adapter and end-to-end tests to verify real socket behavior.

Minimum parity fixture set before cutover:

- Lobby fills and starts a game.
- Lobby user leaves and remaining positions are reindexed.
- In-game disconnect applies fatal damage.
- Wrong-phase actions are ignored.
- Day chat, dead chat rejection, and lobby chat.
- Day vote success, duplicate vote rejection, self-vote rejection, dead-target rejection.
- Night vote allowed and disallowed by role capability.
- Day visit cancel and target behavior.
- Night visit cancel and target behavior.
- Whisper delivery, invalid recipient, night rejection, tapper notification, overheard broadcast.
- Every role’s core action.
- Every faction’s night behavior.
- Combat resolution scenarios.
- Victory and draw scenarios.
- Game end cleanup and disconnect.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Hidden behavior in emitted socket events | Assert full emitted event streams in fixtures |
| Random role/action differences | Inject deterministic RNG and snapshot assignments |
| Timer race differences | Abstract schedulers and test phase transitions with fake clocks |
| Socket.IO protocol mismatch | Keep Node adapter temporarily or test Rust Socket.IO implementation against current clients |
| PartyKit hosting mismatch | Use PartyKit as relay first instead of forcing Rust into the same runtime |
| Large role-surface regression | Port one behavior cluster at a time and require fixture parity before moving on |
| Snapshot churn masking real regressions | Require each snapshot update to document the gameplay reason |

## Definition Of Done

The migration is complete when:

- Rust is the authoritative implementation for gameplay state.
- Existing web and mobile clients can play without protocol changes.
- Socket.IO and/or PartyKit compatibility paths are either preserved or intentionally replaced.
- TypeScript gameplay model is removed or retained only as a test oracle/archive.
- CI runs Rust tests, TypeScript compatibility tests, and replay parity tests.
- Production has a documented rollback path and mismatch replay process.
